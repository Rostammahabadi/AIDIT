"use client"

import { useState, useEffect } from "react"
import { FileUploadSection } from "@/components/file-upload-section"
import { ApiConfiguration } from "@/components/api-configuration"
import { ProcessingSection } from "@/components/processing-section"
import { ResultsSection } from "@/components/results-section"
import { FollowUpQuestions } from "@/components/follow-up-questions"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SecurityNotice } from "@/components/security-notice"
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import { processFilesInChunks } from "@/utils/workerUtils"
import { sendToOpenAI, validateOpenAIKey, sendFinalAnalysisToOpenAI, sendFollowUpQuestionToOpenAI, sendInitialAnalysisToOpenAI } from "@/utils/openaiUtils"
import { encryptApiKey, decryptApiKey } from "@/utils/securityUtils"

// Import PDF.js dynamically to avoid SSR issues
const pdfjsLib = typeof window !== 'undefined' ? require('pdfjs-dist') : null;

// Set the worker source for pdf.js (client-side only)
if (typeof window !== 'undefined' && pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

// Define FileInfo interface for document processing
interface FileInfo {
  name: string;
  type: string;
  size: number;
  lastModified: string;
  content: any;
}

// PDF handling function with SSR safety
async function handlePdf(file: File) {
  if (!pdfjsLib) {
    throw new Error('PDF processing is only available in the browser');
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: any) => item.str).join(" ") + "\n";
  }
  return {
    type: "pdf",
    preview: text.substring(0, 500),
    pageCount: pdf.numPages,
    length: text.length
  };
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([])
  const [apiKey, setApiKey] = useState("")
  const [aiService, setAiService] = useState("")
  const [maxQuestionDepth, setMaxQuestionDepth] = useState(1)
  const [maxTokens, setMaxTokens] = useState(1000)
  const [model, setModel] = useState("gpt-4-turbo")
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isProcessed, setIsProcessed] = useState(false)
  const [followUpQuestions, setFollowUpQuestions] = useState<string | null>(null)
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false)
  const [fileInfos, setFileInfos] = useState<FileInfo[]>([])
  const [currentQuestionDepth, setCurrentQuestionDepth] = useState(0)
  const [results, setResults] = useState<any>(null)
  // Add conversation memory to track all interactions
  const [conversationMemory, setConversationMemory] = useState<Array<{role: string, content: string}>>([])

  // Load saved API key and service from sessionStorage on component mount
  useEffect(() => {
    const savedEncryptedApiKey = sessionStorage.getItem("openai_api_key")
    
    if (savedEncryptedApiKey) {
      const decryptedApiKey = decryptApiKey(savedEncryptedApiKey)
      setApiKey(decryptedApiKey)
    }
    setAiService("openai") // Always set to OpenAI
  }, [])

  // Save API key to sessionStorage when it changes
  useEffect(() => {
    if (apiKey) {
      const encryptedApiKey = encryptApiKey(apiKey)
      sessionStorage.setItem("openai_api_key", encryptedApiKey)
    }
  }, [apiKey])

  // Process a single file and return its information
  const processFile = async (file: File): Promise<FileInfo> => {
    const fileInfo: FileInfo = {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: new Date(file.lastModified).toISOString(),
      content: null,
    }

    try {
      // PDF files
      if (file.type === "application/pdf") {
        fileInfo.content = await handlePdf(file)
      } 
      // Word documents
      else if (file.type.includes("wordprocessingml") || file.name.endsWith('.docx')) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          const text = result.value;
          
          // Calculate some basic stats about the document
          const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
          const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
          
          fileInfo.content = {
            type: "document",
            preview: text.substring(0, 500), // First 500 chars
            length: text.length,
            paragraphCount: paragraphs.length,
            wordCount: wordCount
          };
        } catch (error) {
          console.error("Error processing Word document:", error);
          fileInfo.content = {
            type: "document",
            error: "Failed to parse Word document"
          };
        }
      } 
      // Other file types (spreadsheets, text, JSON)
      else {
        // Use the worker utility to process the file
        fileInfo.content = await new Promise((resolve, reject) => {
          // Create a worker
          const worker = new Worker(new URL('../workers/fileProcessingWorker.ts', import.meta.url), { type: 'module' });
          
          // Handle messages from the worker
          worker.onmessage = (e) => {
            if (e.data.status === 'success') {
              resolve(e.data.result);
            } else {
              reject(new Error(e.data.error));
            }
            worker.terminate();
          };
          
          // Handle errors
          worker.onerror = (error) => {
            console.error('Worker error:', error);
            reject(error);
            worker.terminate();
          };
          
          // Determine file type
          let fileType = 'unknown';
          if (file.type.includes("spreadsheet") || file.name.endsWith('.xlsx') || file.name.endsWith('.csv')) {
            fileType = 'spreadsheet';
          } else if (file.type === "application/json" || file.name.endsWith('.json')) {
            fileType = 'json';
          } else if (file.type === "text/plain" || file.name.endsWith('.txt')) {
            fileType = 'text';
          }
          
          // Read file content
          file.arrayBuffer().then(arrayBuffer => {
            let text = '';
            
            if (fileType === 'json' || fileType === 'text') {
              const decoder = new TextDecoder();
              text = decoder.decode(arrayBuffer);
            }
            
            // Send data to worker
            worker.postMessage({
              file,
              fileType,
              arrayBuffer,
              text
            });
          }).catch(err => {
            reject(err);
            worker.terminate();
          });
        });
      }
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      fileInfo.content = {
        type: "unknown",
        error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    return fileInfo;
  };

  const handleFileUpload = (newFiles: File[]) => {
    setFiles((prevFiles) => [...prevFiles, ...newFiles])
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index))
  }

  const handleApiKeyChange = (key: string) => {
    setApiKey(key)
    setIsConnected(null) // Reset connection status when key changes
  }

  const handleMaxQuestionDepthChange = (depth: number) => {
    setMaxQuestionDepth(depth)
  }

  const handleMaxTokensChange = (tokens: number) => {
    setMaxTokens(tokens)
  }

  const handleModelChange = (newModel: string) => {
    setModel(newModel)
    
    // Automatically adjust max tokens based on the selected model
    let defaultTokens = 1000; // Default token limit
    
    // Set appropriate default token limits based on model
    if (newModel.startsWith('gpt-3.5')) {
      defaultTokens = 4000;
    } else if (newModel.startsWith('gpt-4-0')) {
      defaultTokens = 8000;
    } else if (newModel.startsWith('gpt-4-1') || newModel === 'gpt-4-turbo') {
      defaultTokens = 4000;
    } else if (newModel.startsWith('gpt-4o') || newModel === 'gpt-4-vision-preview') {
      defaultTokens = 4000;
    } else if (newModel.startsWith('o1')) {
      defaultTokens = 8000;
    } else if (newModel.startsWith('o3')) {
      defaultTokens = 4000;
    }
    
    setMaxTokens(defaultTokens);
  }

  const handleTestConnection = async () => {
    if (!apiKey) return

    setIsConnecting(true)
    setIsConnected(null)

    try {
      // Actually validate the API key with OpenAI
      const isValid = await validateOpenAIKey(apiKey)
      setIsConnected(isValid)
      
      // Store the API key in session storage if valid
      if (isValid) {
        const encryptedApiKey = encryptApiKey(apiKey)
        sessionStorage.setItem("openai_api_key", encryptedApiKey)
      }
    } catch (error) {
      console.error("Error testing connection:", error)
      setIsConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleProcessFiles = async () => {
    if (files.length === 0 || !isConnected) return

    setIsProcessing(true)
    setProgress(0)
    setFollowUpQuestions(null)
    setResults(null)
    setCurrentQuestionDepth(0) // Reset the current question depth
    
    try {
      // Process files in chunks using web workers to avoid blocking the main thread
      const processedFileInfos: FileInfo[] = []
      
      // Process files in batches to avoid overwhelming the browser
      const batchSize = 3
      const totalBatches = Math.ceil(files.length / batchSize)
      
      for (let i = 0; i < totalBatches; i++) {
        const batch = files.slice(i * batchSize, (i + 1) * batchSize)
        const batchPromises = batch.map(file => processFile(file))
        
        const batchResults = await Promise.all(batchPromises)
        processedFileInfos.push(...batchResults)
        
        // Update progress
        setProgress(Math.min(90, ((i + 1) / totalBatches) * 90))
      }
      
      // Store the processed file infos for potential follow-up questions
      setFileInfos(processedFileInfos)
      
      // Generate a prompt for OpenAI based on the file analyses
      const prompt = generateAnalysisPrompt(processedFileInfos)
      
      // Initialize conversation memory with the initial prompt
      setConversationMemory([
        { role: "system", content: "You are an AI assistant that analyzes documents and provides insights, metadata suggestions, and vectorization recommendations." },
        { role: "user", content: prompt }
      ])
      
      // Send the prompt to OpenAI
      const openAIResponse = await sendInitialAnalysisToOpenAI(apiKey, prompt, maxTokens, model)
      
      // Extract the follow-up questions if maxQuestionDepth > 0
      if (maxQuestionDepth > 0) {
        const responseText = openAIResponse.text
        
        // Check if the AI needs more information
        const needMoreInfoIndex = responseText.indexOf("NEED_MORE_INFO");
        const needMoreInfo = needMoreInfoIndex !== -1 && 
                            responseText.substring(needMoreInfoIndex).includes("YES");
        
        // Look for follow-up questions section with case insensitivity
        const followUpIndex = responseText.search(/FOLLOW-UP QUESTIONS|FOLLOW UP QUESTIONS|FOLLOW-UP QUESTIONS FOR/i);
        
        if (followUpIndex !== -1) {
          // Extract the follow-up questions section
          const followUpSection = responseText.substring(followUpIndex)
          // Remove the NEED_MORE_INFO section if present
          let cleanedFollowUpSection = "";
          
          if (needMoreInfoIndex !== -1 && followUpSection.indexOf("NEED_MORE_INFO") !== -1) {
            cleanedFollowUpSection = followUpSection.substring(0, followUpSection.indexOf("NEED_MORE_INFO")).trim();
          } else {
            cleanedFollowUpSection = followUpSection.trim();
          }
          
          console.log("Extracted follow-up questions, length:", cleanedFollowUpSection.length);
          
          // Only set follow-up questions if we actually extracted content
          if (cleanedFollowUpSection.length > 0) {
            // Add the AI's response to conversation memory
            setConversationMemory(prevMemory => [
              ...prevMemory,
              { role: "assistant", content: responseText }
            ]);
            
            // Set the follow-up questions
            console.log("Setting follow-up questions");
            setFollowUpQuestions(cleanedFollowUpSection);
            
            // Don't show results until maximum depth is reached
            // setResults(null);
          } else {
            console.log("Extracted follow-up section was empty, trying alternative extraction method");
            // Try to extract questions using a different approach
            const questionRegex = /(?:\d+\.|\([A-Za-z]\))\s+([^\n]+)/g;
            const questions = [...responseText.matchAll(questionRegex)];
            
            if (questions.length > 0) {
              // Format the questions in a clean way
              const formattedQuestions = questions.map(q => q[0]).join("\n\n");
              
              // Add the AI's response to conversation memory
              setConversationMemory(prevMemory => [
                ...prevMemory,
                { role: "assistant", content: responseText }
              ]);
              
              // Set the follow-up questions
              console.log("Setting follow-up questions from alternative method");
              setFollowUpQuestions(formattedQuestions);
              
              // Don't show results until maximum depth is reached
              // setResults(null);
            } else {
              // If still no questions found, use the entire cleaned response
              console.log("No questions found with alternative method, using entire response");
              setFollowUpQuestions(responseText);
              
              // Add the AI's response to conversation memory
              setConversationMemory(prevMemory => [
                ...prevMemory,
                { role: "assistant", content: responseText }
              ]);
              
              // Don't show results until maximum depth is reached
              // setResults(null);
            }
          }
        } else {
          // If no specific follow-up questions section found, look for numbered or lettered questions
          const questionRegex = /(?:\d+\.|\([A-Za-z]\))\s+([^\n]+)/g;
          const questions = [...responseText.matchAll(questionRegex)];
          
          if (questions.length > 0) {
            // Format the questions in a clean way
            const formattedQuestions = questions.map(q => q[0]).join("\n\n");
            
            // Add the AI's response to conversation memory
            setConversationMemory(prevMemory => [
              ...prevMemory,
              { role: "assistant", content: responseText }
            ]);
            
            // Set the follow-up questions
            console.log("Setting follow-up questions");
            setFollowUpQuestions(formattedQuestions);
            
            // Don't show results until maximum depth is reached
            // setResults(null);
          } else {
            // If still no questions found, check for sections with question marks
            const questionMarkRegex = /([^\.\?]+\?)/g;
            const questionMarkMatches = [...responseText.matchAll(questionMarkRegex)];
            
            if (questionMarkMatches.length > 0) {
              const formattedQuestions = questionMarkMatches.map(q => q[0].trim()).join("\n\n");
              
              // Add the AI's response to conversation memory
              setConversationMemory(prevMemory => [
                ...prevMemory,
                { role: "assistant", content: responseText }
              ]);
              
              // Set the follow-up questions
              console.log("Setting follow-up questions");
              setFollowUpQuestions(formattedQuestions);
              
              // Don't show results until maximum depth is reached
              // setResults(null);
            } else {
              // If still no questions found, use the whole response as a prompt for more info
              setFollowUpQuestions("Based on the AI's analysis, please provide any additional information that might help with metadata construction.");
              
              // Add the AI's response to conversation memory
              setConversationMemory(prevMemory => [
                ...prevMemory,
                { role: "assistant", content: responseText }
              ]);
              
              // Don't show results until maximum depth is reached
              // setResults(null);
            }
          }
        }
      } else {
        // No follow-up questions, just show the results
        try {
          // Try to parse the response as JSON first
          const parsedResponse = JSON.parse(openAIResponse.text)
          setResults({
            ...parsedResponse,
            apiResponse: {
              model: openAIResponse.model,
              usage: openAIResponse.usage
            }
          })
        } catch (parseError) {
          // If not valid JSON, use the text as insights
          // Check if the response contains a markdown table
          const containsTable = openAIResponse.text.includes('|') && 
                               openAIResponse.text.includes('---') && 
                               openAIResponse.text.includes('\n|');
          
          // Extract metadata from the response if it contains a table
          let metadata: Array<{
            fieldName: string;
            type: string;
            description: string;
            explanation: string;
          }> = [];
          
          let vectorization: {
            model: string;
            chunking: string;
            modelExplanation: string;
            chunkingExplanation: string;
          } | null = null;
          
          if (containsTable) {
            // Extract table rows
            const tableRegex = /\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g;
            const matches = [...openAIResponse.text.matchAll(tableRegex)];
            
            // Skip the header and separator rows
            if (matches.length > 2) {
              metadata = matches.slice(2).map(match => ({
                fieldName: match[1].trim(),
                type: match[2].trim(),
                description: match[3].trim(),
                explanation: match[4].trim()
              }));
            }
          }
          
          // If no table found, try to extract metadata fields from the text
          if (metadata.length === 0) {
            // Look for patterns like "Field Name: Description" or bullet points with field names
            const metadataRegex = /[•\-*]\s*\*\*([^:*]+)\*\*:?\s*([^\n]+)/g;
            const fieldMatches = [...openAIResponse.text.matchAll(metadataRegex)];
            
            if (fieldMatches.length > 0) {
              metadata = fieldMatches.map(match => ({
                fieldName: match[1].trim(),
                type: "string", // Default type
                description: match[2].trim(),
                explanation: "Extracted from AI recommendations"
              }));
            }
          }
          
          // Extract vectorization strategy information
          const chunkingMatch = openAIResponse.text.match(/[Cc]hunking\s+([Ss]trategy|[Aa]pproach)[:\s]+([^\n\.]+)/);
          const modelMatch = openAIResponse.text.match(/([Vv]ectorization\s+[Ss]trategy|[Rr]ecommended\s+[Mm]odel)[:\s]+([^\n\.]+)/);
          
          // Try alternate patterns if the first ones don't match
          const chunkingSectionMatch = !chunkingMatch && openAIResponse.text.match(/[Cc]hunking\s+and\s+[Ss]egmenting[^:]*:([^\.]+)/);
          const modelSectionMatch = !modelMatch && openAIResponse.text.match(/[Vv]ectorization[^:]*:([^\.]+)/);
          
          if (modelMatch || chunkingMatch || modelSectionMatch || chunkingSectionMatch) {
            vectorization = {
              model: modelMatch ? modelMatch[2].trim() : 
                     modelSectionMatch ? modelSectionMatch[1].trim() : 
                     "Extract embeddings using a domain-specific model",
              chunking: chunkingMatch ? chunkingMatch[2].trim() : 
                        chunkingSectionMatch ? chunkingSectionMatch[1].trim() : 
                        "Segment by logical document sections",
              modelExplanation: "Extracted from AI recommendations",
              chunkingExplanation: "Extracted from AI recommendations"
            };
          }
          
          // Format the response consistently
          setResults({
            insights: openAIResponse.text,
            metadata: metadata.length > 0 ? metadata : undefined,
            vectorization: vectorization,
            apiResponse: {
              model: openAIResponse.model,
              usage: openAIResponse.usage
            }
          });
        }
        
        setIsProcessed(true)
        setProgress(100)
      }
      
      setIsProcessed(true)
      setProgress(100)
    } catch (error) {
      console.error("Error processing files:", error)
      setResults({
        error: `Error processing files: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsProcessing(false)
    }
  }
  
  const handleFollowUpResponse = async (response: string) => {
    if (!apiKey || !followUpQuestions || !fileInfos.length) return
    
    console.log("handleFollowUpResponse called with response:", response.substring(0, 50) + "...");
    console.log("Current question depth:", currentQuestionDepth);
    console.log("Max question depth:", maxQuestionDepth);
    
    setIsSubmittingResponse(true)
    
    try {
      // Increment the current question depth
      const newQuestionDepth = currentQuestionDepth + 1;
      console.log("New question depth:", newQuestionDepth);
      setCurrentQuestionDepth(newQuestionDepth);
      
      // Add the user's response to the conversation memory
      setConversationMemory(prevMemory => [
        ...prevMemory,
        { role: "user", content: response }
      ]);
      
      // Create a prompt that includes all previous conversation history
      let prompt = "";
      
      // Add the original document analysis context
      prompt += `Original document analysis:\n${generateAnalysisPrompt(fileInfos)}\n\n`;
      
      // Format the conversation history as question-answer pairs
      // We need to process the conversation memory to extract questions and answers
      if (conversationMemory.length > 0) {
        prompt += "Previous questions and answers:\n\n";
        
        // Process the conversation memory in pairs (assistant question, user answer)
        for (let i = 0; i < conversationMemory.length - 1; i += 2) {
          if (i + 1 < conversationMemory.length) {
            const assistantMessage = conversationMemory[i];
            const userMessage = conversationMemory[i + 1];
            
            if (assistantMessage.role === "assistant" && userMessage.role === "user") {
              // Include the full assistant message as context
              prompt += `Assistant: ${assistantMessage.content.trim()}\n\n`;
              prompt += `User: ${userMessage.content.trim()}\n\n`;
            }
          }
        }
        // Add the last assistant message
        if (conversationMemory.length > 0) {
          const lastAssistantMessage = conversationMemory[conversationMemory.length - 1];
          if (lastAssistantMessage.role === "assistant") {
            prompt += `Assistant: ${lastAssistantMessage.content.trim()}\n\n`;
          }
        }
      }
      
      // Add the current response
      prompt += `User's latest response:\n${response}\n\n`;
      
      // Determine if this should be the final round based on max depth
      const isFinalRound = newQuestionDepth >= maxQuestionDepth;
      
      // Send the follow-up response to OpenAI using the appropriate method
      const openAIResponse = isFinalRound
        ? await sendFinalAnalysisToOpenAI(apiKey, prompt, maxTokens, model)
        : await sendFollowUpQuestionToOpenAI(apiKey, prompt, maxTokens, model);
      
      // Extract response text
      const responseText = openAIResponse.text;
      console.log("OpenAI response received, length:", responseText.length);
      
      // Check if the AI needs more information
      const needMoreInfoIndex = responseText.indexOf("NEED_MORE_INFO");
      console.log("NEED_MORE_INFO index:", needMoreInfoIndex);
      const needMoreInfo = needMoreInfoIndex !== -1 && 
                          responseText.substring(needMoreInfoIndex).includes("YES");
      console.log("needMoreInfo flag:", needMoreInfo);
      
      // Clean the response text by removing the NEED_MORE_INFO section
      const cleanedResponseText = needMoreInfoIndex !== -1 
        ? responseText.substring(0, needMoreInfoIndex).trim()
        : responseText;
      console.log("Cleaned response text length:", cleanedResponseText.length);
      
      // If this is the final round or AI explicitly indicates it has enough info, process the final results
      if (isFinalRound || (needMoreInfoIndex !== -1 && !needMoreInfo)) {
        console.log("Processing final results. isFinalRound:", isFinalRound);
        try {
          // Try to parse the response as JSON first
          const parsedResponse = JSON.parse(cleanedResponseText);
          setResults({
            ...parsedResponse,
            apiResponse: {
              model: openAIResponse.model,
              usage: openAIResponse.usage
            }
          });
        } catch (parseError) {
          // If not valid JSON, use the text as insights
          // Check if the response contains a markdown table
          const containsTable = cleanedResponseText.includes('|') && 
                               cleanedResponseText.includes('---') && 
                               cleanedResponseText.includes('\n|');
          
          // Extract metadata from the response if it contains a table
          let metadata: Array<{
            fieldName: string;
            type: string;
            description: string;
            explanation: string;
          }> = [];
          
          let vectorization: {
            model: string;
            chunking: string;
            modelExplanation: string;
            chunkingExplanation: string;
          } | null = null;
          
          if (containsTable) {
            // Extract table rows
            const tableRegex = /\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g;
            const matches = [...cleanedResponseText.matchAll(tableRegex)];
            
            // Skip the header and separator rows
            if (matches.length > 2) {
              metadata = matches.slice(2).map(match => ({
                fieldName: match[1].trim(),
                type: match[2].trim(),
                description: match[3].trim(),
                explanation: match[4].trim()
              }));
            }
          }
          
          // If no table found, try to extract metadata fields from the text
          if (metadata.length === 0) {
            // Look for patterns like "Field Name: Description" or bullet points with field names
            const metadataRegex = /[•\-*]\s*\*\*([^:*]+)\*\*:?\s*([^\n]+)/g;
            const fieldMatches = [...cleanedResponseText.matchAll(metadataRegex)];
            
            if (fieldMatches.length > 0) {
              metadata = fieldMatches.map(match => ({
                fieldName: match[1].trim(),
                type: "string", // Default type
                description: match[2].trim(),
                explanation: "Extracted from AI recommendations"
              }));
            }
          }
          
          // Extract vectorization strategy information
          const chunkingMatch = cleanedResponseText.match(/[Cc]hunking\s+([Ss]trategy|[Aa]pproach)[:\s]+([^\n\.]+)/);
          const modelMatch = cleanedResponseText.match(/([Vv]ectorization\s+[Ss]trategy|[Rr]ecommended\s+[Mm]odel)[:\s]+([^\n\.]+)/);
          
          // Try alternate patterns if the first ones don't match
          const chunkingSectionMatch = !chunkingMatch && cleanedResponseText.match(/[Cc]hunking\s+and\s+[Ss]egmenting[^:]*:([^\.]+)/);
          const modelSectionMatch = !modelMatch && cleanedResponseText.match(/[Vv]ectorization[^:]*:([^\.]+)/);
          
          if (modelMatch || chunkingMatch || modelSectionMatch || chunkingSectionMatch) {
            vectorization = {
              model: modelMatch ? modelMatch[2].trim() : 
                     modelSectionMatch ? modelSectionMatch[1].trim() : 
                     "Extract embeddings using a domain-specific model",
              chunking: chunkingMatch ? chunkingMatch[2].trim() : 
                        chunkingSectionMatch ? chunkingSectionMatch[1].trim() : 
                        "Segment by logical document sections",
              modelExplanation: "Extracted from AI recommendations",
              chunkingExplanation: "Extracted from AI recommendations"
            };
          }
          
          // Format the response consistently
          setResults({
            insights: cleanedResponseText,
            metadata: metadata.length > 0 ? metadata : undefined,
            vectorization: vectorization,
            apiResponse: {
              model: openAIResponse.model,
              usage: openAIResponse.usage
            }
          });
        }
        
        // Add the AI's response to conversation memory
        setConversationMemory(prevMemory => [
          ...prevMemory,
          { role: "assistant", content: responseText }
        ]);
        
        // Store whether this was the final round to clear follow-up questions later
        // We'll do this in the finally block to ensure loading state is properly shown
      } else {
        // Continue asking questions - either we're not at max depth and AI needs more info,
        // or we're not at max depth and there's no NEED_MORE_INFO marker (assume we need more info)
        console.log("Continuing with follow-up questions");
        // Look for follow-up questions in the response
        const followUpIndex = cleanedResponseText.search(/FOLLOW-UP QUESTIONS|FOLLOW UP QUESTIONS|FOLLOW-UP QUESTIONS FOR/i);
        console.log("Follow-up questions index:", followUpIndex);
        
        if (followUpIndex !== -1) {
          // Extract the follow-up questions section
          const followUpSection = cleanedResponseText.substring(followUpIndex);
          // Remove the NEED_MORE_INFO section if present
          let cleanedFollowUpSection = "";
          
          if (needMoreInfoIndex !== -1 && followUpSection.indexOf("NEED_MORE_INFO") !== -1) {
            cleanedFollowUpSection = followUpSection.substring(0, followUpSection.indexOf("NEED_MORE_INFO")).trim();
          } else {
            cleanedFollowUpSection = followUpSection.trim();
          }
          
          console.log("Extracted follow-up questions, length:", cleanedFollowUpSection.length);
          
          // Only set follow-up questions if we actually extracted content
          if (cleanedFollowUpSection.length > 0) {
            // Add the AI's response to conversation memory
            setConversationMemory(prevMemory => [
              ...prevMemory,
              { role: "assistant", content: responseText }
            ]);
            
            // Set the follow-up questions
            console.log("Setting follow-up questions");
            setFollowUpQuestions(cleanedFollowUpSection);
            
            // Don't show results until maximum depth is reached
            // setResults(null);
          } else {
            console.log("Extracted follow-up section was empty, trying alternative extraction method");
            // Try to extract questions using a different approach
            const questionRegex = /(?:\d+\.|\([A-Za-z]\))\s+([^\n]+)/g;
            const questions = [...cleanedResponseText.matchAll(questionRegex)];
            
            if (questions.length > 0) {
              // Format the questions in a clean way
              const formattedQuestions = questions.map(q => q[0]).join("\n\n");
              
              // Add the AI's response to conversation memory
              setConversationMemory(prevMemory => [
                ...prevMemory,
                { role: "assistant", content: responseText }
              ]);
              
              // Set the follow-up questions
              console.log("Setting follow-up questions from alternative method");
              setFollowUpQuestions(formattedQuestions);
              
              // Don't show results until maximum depth is reached
              // setResults(null);
            } else {
              // If still no questions found, use the entire cleaned response
              console.log("No questions found with alternative method, using entire response");
              setFollowUpQuestions(cleanedResponseText);
              
              // Add the AI's response to conversation memory
              setConversationMemory(prevMemory => [
                ...prevMemory,
                { role: "assistant", content: responseText }
              ]);
              
              // Don't show results until maximum depth is reached
              // setResults(null);
            }
          }
        } else {
          // If no specific follow-up questions section found, look for numbered or lettered questions
          const questionRegex = /(?:\d+\.|\([A-Za-z]\))\s+([^\n]+)/g;
          const questions = [...cleanedResponseText.matchAll(questionRegex)];
          
          if (questions.length > 0) {
            // Format the questions in a clean way
            const formattedQuestions = questions.map(q => q[0]).join("\n\n");
            
            // Add the AI's response to conversation memory
            setConversationMemory(prevMemory => [
              ...prevMemory,
              { role: "assistant", content: responseText }
            ]);
            
            // Set the follow-up questions
            console.log("Setting follow-up questions");
            setFollowUpQuestions(formattedQuestions);
            
            // Don't show results until maximum depth is reached
            // setResults(null);
          } else {
            // If still no questions found, check for sections with question marks
            const questionMarkRegex = /([^\.\?]+\?)/g;
            const questionMarkMatches = [...cleanedResponseText.matchAll(questionMarkRegex)];
            
            if (questionMarkMatches.length > 0) {
              const formattedQuestions = questionMarkMatches.map(q => q[0].trim()).join("\n\n");
              
              // Add the AI's response to conversation memory
              setConversationMemory(prevMemory => [
                ...prevMemory,
                { role: "assistant", content: responseText }
              ]);
              
              // Set the follow-up questions
              console.log("Setting follow-up questions");
              setFollowUpQuestions(formattedQuestions);
              
              // Don't show results until maximum depth is reached
              // setResults(null);
            } else {
              // If still no questions found, use the whole response as a prompt for more info
              setFollowUpQuestions("Based on the AI's analysis, please provide any additional information that might help with metadata construction.");
              
              // Add the AI's response to conversation memory
              setConversationMemory(prevMemory => [
                ...prevMemory,
                { role: "assistant", content: responseText }
              ]);
              
              // Don't show results until maximum depth is reached
              // setResults(null);
            }
          }
        }
      }
      
    } catch (error) {
      console.error("Error processing follow-up response:", error);
      console.log("Error in handleFollowUpResponse:", error);
      setResults({
        error: `Error processing follow-up response: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      // Don't clear follow-up questions on error so user can try again
    } finally {
      console.log("handleFollowUpResponse completed");
      
      // Only clear follow-up questions if we've reached the final round
      // This ensures the loading indicator is properly shown before clearing
      if (currentQuestionDepth >= maxQuestionDepth) {
        console.log("Clearing follow-up questions after final round");
        
        // Important: First turn off the loading state to ensure the UI updates properly
        setIsSubmittingResponse(false);
        
        // Then use a small timeout before clearing the questions
        // This ensures the results have time to render first
        setTimeout(() => {
          setFollowUpQuestions(null);
        }, 100);
      } else {
        setIsSubmittingResponse(false);
      }
    }
  };

  // Helper function to determine JSON depth
  const getJsonDepth = (obj: any, depth = 1): number => {
    if (typeof obj !== 'object' || obj === null) return depth
    
    const childDepths = Object.values(obj).map(value => {
      if (typeof value === 'object' && value !== null) {
        return getJsonDepth(value, depth + 1)
      }
      return depth
    })
    
    return Math.max(...childDepths)
  }
  
  // Generate a prompt for OpenAI based on file analyses
  const generateAnalysisPrompt = (fileAnalyses: FileInfo[]): string => {
    let prompt = "I'm analyzing the following files. Please help me understand their content and structure:\n\n"
    
    fileAnalyses.forEach((file, index) => {
      prompt += `File ${index + 1}: ${file.name}\n`
      prompt += `Type: ${file.type}\n`
      prompt += `Size: ${(file.size / 1024).toFixed(2)} KB\n`
      
      if (file.content.type === "spreadsheet") {
        prompt += "This is a spreadsheet with headers: " + file.content.headers.join(", ") + "\n"
        prompt += "Sample rows:\n"
        file.content.sampleRows.forEach((row: string[]) => {
          prompt += "- " + row.join(", ") + "\n"
        })
      } else if (file.content.type === "text") {
        prompt += `This is a text file with ${file.content.lineCount} lines. Preview:\n`
        prompt += file.content.preview + "\n"
      } else if (file.content.type === "json") {
        if (file.content.error) {
          prompt += "This JSON file appears to be invalid.\n"
        } else {
          prompt += `This is a JSON file with ${file.content.itemCount} top-level items and a depth of ${file.content.depth}.\n`
          prompt += "Top-level keys: " + file.content.keys.join(", ") + "\n"
          prompt += "Sample: " + file.content.sample + "\n"
          prompt += `It contains ${file.content.nestedArrays} nested arrays, ${file.content.nestedObjects} nested objects, and ${file.content.totalKeyValues} total key-value pairs.\n`
        }
      } else {
        prompt += `Content type: ${file.content.type}\n`
        if (file.content.preview) {
          prompt += "Preview: " + file.content.preview + "\n"
        }
      }
      
      prompt += "\n"
    })
    
    prompt += "Please provide:\n"
    
    if (maxQuestionDepth > 0) {
      prompt += "1. A brief summary of what these files contain\n"
      prompt += "2. Follow-up questions that would help in making the best possible decisions on metadata construction for what the user wants\n"
    } else {
      prompt += "1. A summary of what these files contain\n"
      prompt += "2. Suggested metadata fields that would be useful for these documents\n"
      prompt += "3. Recommended vectorization strategy for these types of documents\n"
    }
    
    return prompt
  }
  
  // Simulate an OpenAI response based on file analyses
  const simulateOpenAiResponse = async (fileAnalyses: FileInfo[]): Promise<any> => {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Generate dynamic metadata based on file types
    const metadata = []
    
    // Check if we have any spreadsheets
    if (fileAnalyses.some(file => file.content.type === "spreadsheet")) {
      metadata.push({
        fieldName: "columns",
        type: "array",
        description: "Spreadsheet columns",
        explanation: "Extracted from spreadsheet headers"
      })
      metadata.push({
        fieldName: "rowCount",
        type: "number",
        description: "Number of rows",
        explanation: "Counted from spreadsheet data"
      })
    }
    
    // Check if we have any text files
    if (fileAnalyses.some(file => file.content.type === "text")) {
      metadata.push({
        fieldName: "wordCount",
        type: "number",
        description: "Word count",
        explanation: "Calculated from text content"
      })
      metadata.push({
        fieldName: "language",
        type: "string",
        description: "Document language",
        explanation: "Detected from text content"
      })
    }
    
    // Add some common metadata for all files
    metadata.push({
      fieldName: "createdDate",
      type: "date",
      description: "Creation date",
      explanation: "Extracted from file metadata"
    })
    
    // If we don't have any specific metadata, use the default ones
    if (metadata.length < 3) {
      metadata.push({
        fieldName: "category",
        type: "enum",
        description: "Document category",
        explanation: "Inferred from content analysis"
      })
    }
    
    // Generate vectorization strategy based on file types
    let vectorization = {
      model: "MiniLM",
      chunking: "By paragraph",
      modelExplanation: "Efficient model for document embeddings with good performance/size ratio",
      chunkingExplanation: "Paragraph-level chunking preserves semantic coherence"
    }
    
    // Adjust vectorization strategy based on file types
    if (fileAnalyses.some(file => file.content.type === "spreadsheet")) {
      vectorization = {
        model: "BERT",
        chunking: "By row",
        modelExplanation: "BERT provides better handling of tabular data with its attention mechanism",
        chunkingExplanation: "Row-level chunking maintains the relationship between cells in the same row"
      }
    } else if (fileAnalyses.every(file => file.content.type === "json")) {
      vectorization = {
        model: "GPT-Embeddings",
        chunking: "By object",
        modelExplanation: "GPT-Embeddings excel at capturing semantic meaning in structured data",
        chunkingExplanation: "Object-level chunking preserves the structure of JSON objects"
      }
    }
    
    return {
      metadata,
      vectorization
    }
  }

  // Effect to log state changes
  useEffect(() => {
    console.log("followUpQuestions state changed:", followUpQuestions ? "present" : "null");
  }, [followUpQuestions]);
  
  useEffect(() => {
    console.log("currentQuestionDepth state changed:", currentQuestionDepth);
  }, [currentQuestionDepth]);
  
  useEffect(() => {
    console.log("isSubmittingResponse state changed:", isSubmittingResponse);
  }, [isSubmittingResponse]);

  return (
    <main className="min-h-screen bg-[#F5F5F5] flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-[800px]">
        <Header />

        <SecurityNotice />

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <FileUploadSection files={files} onFileUpload={handleFileUpload} onRemoveFile={handleRemoveFile} />
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <ApiConfiguration
            apiKey={apiKey}
            aiService={aiService}
            maxQuestionDepth={maxQuestionDepth}
            maxTokens={maxTokens}
            model={model}
            isConnected={isConnected}
            isConnecting={isConnecting}
            onApiKeyChange={handleApiKeyChange}
            onAiServiceChange={(service) => setAiService(service)}
            onMaxQuestionDepthChange={handleMaxQuestionDepthChange}
            onMaxTokensChange={handleMaxTokensChange}
            onModelChange={handleModelChange}
            onTestConnection={handleTestConnection}
          />
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <ProcessingSection
            files={files}
            isProcessing={isProcessing}
            isConnected={isConnected}
            progress={progress}
            onProcess={handleProcessFiles}
          />
        </div>

        {isProcessed && (
          <>
            {(followUpQuestions || isSubmittingResponse) && (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <FollowUpQuestions
                  questions={followUpQuestions || ""}
                  onSubmitResponse={handleFollowUpResponse}
                  isLoading={isSubmittingResponse}
                />
              </div>
            )}
            
            {/* Log when this section renders or not */}
            {console.log("Follow-up questions section rendering:", followUpQuestions ? "yes" : "no")}

            {results && (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <ResultsSection results={results} aiService={aiService} />
              </div>
            )}
            
            {/* Log when results section renders or not */}
            {console.log("Results section rendering:", results ? "yes" : "no")}
          </>
        )}

        <Footer />
      </div>
    </main>
  )
}
