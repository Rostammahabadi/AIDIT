"use client"

import { useState, useEffect, useMemo } from "react"
import { Loader2, Send } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface FollowUpQuestionsProps {
  questions: string
  isLoading: boolean
  onSubmitResponse: (response: string) => void
}

interface Question {
  category: string;
  questions: string[];
}

export function FollowUpQuestions({ questions, isLoading, onSubmitResponse }: FollowUpQuestionsProps) {
  console.log("FollowUpQuestions component rendering with questions:", questions ? "present" : "null");
  console.log("isLoading:", isLoading);
  
  const [responses, setResponses] = useState<{[key: string]: string}>({});
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([])
  const [summaryText, setSummaryText] = useState("")
  
  // Parse the questions from the AI response
  useEffect(() => {
    if (!questions) return;
    
    console.log("Parsing questions from text");
    
    // Look for the FOLLOW-UP QUESTIONS section (case insensitive)
    const followUpIndex = questions.search(/FOLLOW-UP QUESTIONS/i);
    if (followUpIndex !== -1) {
      // Extract the summary section (everything before the follow-up questions)
      setSummaryText(questions.substring(0, followUpIndex).trim());
      
      // Extract the questions section
      const questionsSection = questions.substring(followUpIndex);
      
      // First try to find category headers (like "A) CORE USE CASE & QUERY NEEDS")
      const categoryRegex = /([A-Z]\)\s+[^0-9]+)(?=\d+\.|[A-Z]\)|\n\n|$)/g;
      const categoryMatches = [...questionsSection.matchAll(categoryRegex)];
      
      if (categoryMatches.length > 0) {
        console.log("Found category headers:", categoryMatches.length);
        
        // Process each category
        const extractedQuestions: Question[] = [];
        
        categoryMatches.forEach((match, index) => {
          const categoryText = match[1].trim();
          const categoryStart = match.index || 0;
          const nextCategoryStart = index < categoryMatches.length - 1 
            ? categoryMatches[index + 1].index 
            : questionsSection.length;
          
          // Extract the content for this category
          const categoryContent = questionsSection.substring(
            categoryStart + match[0].length,
            nextCategoryStart
          );
          
          // Find numbered questions within this category
          const questionRegex = /(\d+)\.\s+([^\n]+)/g;
          const questionMatches = [...categoryContent.matchAll(questionRegex)];
          
          if (questionMatches.length > 0) {
            console.log("Found numbered questions in category:", questionMatches.length);
            
            questionMatches.forEach(qMatch => {
              extractedQuestions.push({
                category: categoryText,
                questions: [qMatch[2].trim()]
              });
            });
          }
        });
        
        if (extractedQuestions.length > 0) {
          console.log("Parsed questions with categories:", extractedQuestions.length);
          setParsedQuestions(extractedQuestions);
          
          // Initialize responses object with empty strings
          const initialResponses: {[key: string]: string} = {};
          extractedQuestions.forEach((q, i) => {
            initialResponses[`question_${i}`] = '';
          });
          setResponses(initialResponses);
          return;
        }
      }
      
      // If category parsing failed, fall back to just finding numbered questions
      const questionRegex = /(\d+)\.\s+([^\n]+)/g;
      const matches = [...questionsSection.matchAll(questionRegex)];
      
      if (matches.length > 0) {
        console.log("Found numbered questions:", matches.length);
        
        const extractedQuestions: Question[] = matches.map(match => {
          return {
            category: `Question ${match[1]}`,
            questions: [match[2].trim()]
          };
        });
        
        console.log("Parsed questions without categories:", extractedQuestions.length);
        setParsedQuestions(extractedQuestions);
        
        // Initialize responses object with empty strings
        const initialResponses: {[key: string]: string} = {};
        extractedQuestions.forEach((q, i) => {
          initialResponses[`question_${i}`] = '';
        });
        setResponses(initialResponses);
      } else {
        // If no questions found, use the whole section as one question
        console.log("No questions found, using whole section as one question");
        setParsedQuestions([{
          category: "Additional Information",
          questions: ["Please provide any additional information that might help with metadata construction."]
        }]);
        
        setResponses({ "question_0": "" });
      }
    } else {
      // If no follow-up questions section found, check for numbered questions directly
      const questionRegex = /(\d+)\.\s+([^\n]+)/g;
      const matches = [...questions.matchAll(questionRegex)];
      
      if (matches.length > 0) {
        console.log("Found numbered questions:", matches.length);
        
        const extractedQuestions: Question[] = matches.map(match => {
          return {
            category: `Question ${match[1]}`,
            questions: [match[2].trim()]
          };
        });
        
        console.log("Parsed questions without categories:", extractedQuestions.length);
        setParsedQuestions(extractedQuestions);
        
        // Initialize responses object with empty strings
        const initialResponses: {[key: string]: string} = {};
        extractedQuestions.forEach((q, i) => {
          initialResponses[`question_${i}`] = '';
        });
        setResponses(initialResponses);
      } else {
        // If no questions found, use the whole text as one question
        console.log("No questions found, using whole text as one question");
        setParsedQuestions([{
          category: "Additional Information",
          questions: ["Please provide any additional information that might help with metadata construction."]
        }]);
        
        setResponses({ "question_0": "" });
      }
    }
  }, [questions]);
  
  const handleResponseChange = (questionIndex: number, value: string) => {
    console.log("Response changed for question", questionIndex);
    setResponses(prev => ({
      ...prev,
      [`question_${questionIndex}`]: value
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted");
    
    // Combine all responses into a single formatted string
    const combinedResponse = parsedQuestions.map((question, index) => {
      const response = responses[`question_${index}`];
      if (!response.trim()) return '';
      
      return `**${question.category}**:\n${response}\n\n`;
    }).filter(Boolean).join('');
    
    if (combinedResponse.trim()) {
      console.log("Combined response created, length:", combinedResponse.length);
      // Call the onSubmitResponse callback with the combined response
      onSubmitResponse(combinedResponse);
      
      // Don't reset responses here - let the parent component handle this
      // after the API call is complete
    } else {
      console.log("No response to submit");
    }
  };
  
  const isAnyResponseFilled = Object.values(responses).some(response => response.trim().length > 0);
  console.log("isAnyResponseFilled:", isAnyResponseFilled);

  return (
    <div className="border border-[#E5E7EB] rounded-md p-4 mb-6">
      <h3 className="text-lg font-medium mb-3">Follow-up Questions</h3>
      
      {/* Summary Section */}
      {summaryText && (
        <div className="bg-[#F9FAFB] p-3 rounded-md mb-4">
          <h4 className="font-medium mb-2">Summary</h4>
          <div className="prose max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {summaryText}
            </ReactMarkdown>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex flex-col">
        {parsedQuestions.map((question, index) => (
          <div key={index} className="mb-4 border border-[#E5E7EB] rounded-md p-3">
            <h4 className="font-medium mb-2">{question.category}</h4>
            <div className="mb-3">
              {question.questions.map((q, qIndex) => (
                <p key={qIndex} className="mb-2 text-[#4B5563]">{q}</p>
              ))}
            </div>
            <textarea
              className="w-full border border-[#E5E7EB] rounded-md p-3 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              placeholder={`Your response to ${question.category}...`}
              value={responses[`question_${index}`] || ''}
              onChange={(e) => handleResponseChange(index, e.target.value)}
              disabled={isLoading}
            />
          </div>
        ))}
        
        <button
          type="submit"
          disabled={!isAnyResponseFilled || isLoading}
          className={`
            flex items-center justify-center py-2 px-4 rounded-md transition-transform hover:scale-105 self-end
            ${!isAnyResponseFilled || isLoading ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-[#10B981] hover:bg-[#059669] text-white"}
          `}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={18} />
              Processing...
            </>
          ) : (
            <>
              <Send className="mr-2" size={18} />
              Submit All Responses
            </>
          )}
        </button>
      </form>
    </div>
  )
}
