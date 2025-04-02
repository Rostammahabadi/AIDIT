// OpenAI API utilities

/**
 * Checks if the model requires max_completion_tokens instead of max_tokens
 * @param model The model name to check
 * @returns True if the model requires max_completion_tokens, false otherwise
 */
export const requiresMaxCompletionTokens = (model: string): boolean => {
  // All o-series models (o1, o3, etc.) require max_completion_tokens
  if (model.includes('o1') || model.includes('o3')) {
    return true;
  }
  
  // GPT-4o models require max_completion_tokens
  if (model.includes('gpt-4o')) {
    return true;
  }
  
  // GPT-4.5 models require max_completion_tokens
  if (model.includes('gpt-4.5')) {
    return true;
  }
  
  // Older models use max_tokens
  return false;
};

/**
 * Checks if the model supports the temperature parameter
 * @param model The model name to check
 * @returns True if the model supports temperature, false otherwise
 */
export const supportsTemperature = (model: string): boolean => {
  // o-series models do not support temperature
  if (model.includes('o1') || model.includes('o3')) {
    return false;
  }
  
  // All other models support temperature
  return true;
};

/**
 * Base function to send a request to OpenAI API
 * @param apiKey OpenAI API key
 * @param systemMessage The system message that defines the AI's role
 * @param userPrompt The user's prompt to send to OpenAI
 * @param maxTokens Maximum number of tokens to generate (default: 1000)
 * @param model The model to use for the request (default: 'gpt-4-turbo')
 * @returns The response from OpenAI
 */
export const sendOpenAIRequest = async (
  apiKey: string, 
  systemMessage: string, 
  userPrompt: string, 
  maxTokens = 1000,
  model = 'gpt-4-turbo'
): Promise<any> => {
  try {
    // Determine if we need to use max_completion_tokens instead of max_tokens
    const useMaxCompletionTokens = requiresMaxCompletionTokens(model);
    const usesTemperature = supportsTemperature(model);
    
    const requestBody: any = {
      model: model,
      messages: [
        {
          role: 'system',
          content: systemMessage
        },
        {
          role: 'user',
          content: userPrompt
        }
      ]
    };
    
    // Add temperature only for models that support it
    if (usesTemperature) {
      requestBody.temperature = 0.7;
    }
    
    // Add the appropriate token limit parameter based on the model
    if (useMaxCompletionTokens) {
      requestBody.max_completion_tokens = maxTokens;
    } else {
      requestBody.max_tokens = maxTokens;
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      text: data.choices[0].message.content,
      usage: data.usage,
      model: data.model
    };
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
};

/**
 * Send a document analysis prompt to OpenAI
 * @param apiKey OpenAI API key
 * @param prompt The prompt to send to OpenAI
 * @param maxTokens Maximum number of tokens to generate (default: 1000)
 * @param model The model to use for the request (default: 'gpt-4-turbo')
 * @returns The response from OpenAI
 */
export const sendInitialAnalysisToOpenAI = async (
  apiKey: string, 
  prompt: string, 
  maxTokens = 1000,
  model = 'gpt-4-turbo'
): Promise<any> => {
  const systemMessage = `Your Role: You are an expert consultant in designing and implementing vector databases, with a focus on optimizing metadata schemas for enhanced search and retrieval.

Your Objective: Guide the user to define a robust and effective metadata strategy tailored to their specific application. Remember, metadata is crucial for filtering results accurately, boosting relevance beyond pure vector similarity, and providing necessary context.

Your Method: Actively probe the user with insightful follow-up questions. Don't just passively receive information. Your questions should aim to uncover:

The Core Use Case: What is the end goal? (Q&A system, semantic product search, document discovery, etc.) Why is a vector database being used here?
Anticipated Queries: How will users interact? Natural language? Keywords? Structured queries? What information do they expect back?
Essential Filtering Requirements: What non-negotiable filters must be supported? (e.g., "show only documents created after date X," "search only within source Y," "filter by user group Z").
Data Provenance & Structure: Where does the data come from? How is it being chunked/segmented for vectorization? (e.g., by paragraph, document, sentence?). What inherent attributes does the source data have (author, timestamp, category, ID)?
Metadata Utility: What information about the data chunks needs to be retrieved alongside the vectors? (e.g., filenames, page numbers, URLs, specific fields from a database row).

Base your follow-up questions on these areas to elicit the necessary details for making informed decisions on metadata field creation, data types, and indexing strategies.

RESPONSE FORMAT:
Your response MUST be structured in exactly these sections with these exact headings:

1. BRIEF SUMMARY OF FILE CONTENT
Provide a concise analysis of the document's content, structure, and key attributes.

2. FOLLOW-UP QUESTIONS FOR METADATA CONSTRUCTION
Organize your questions into these categories (use exactly these category headers):
A) CORE USE CASE & QUERY NEEDS
B) ANTICIPATED QUERIES & INFORMATION NEEDS
C) ESSENTIAL FILTERING & CONSTRAINTS
D) DATA PROVENANCE & STRUCTURE
E) METADATA RETRIEVAL & UTILITY
F) FUTURE USAGE & MAINTENANCE

Under each category, include 1-2 numbered questions that are most relevant.

IMPORTANT: At the end of your response, include a section titled "NEED_MORE_INFO" with a value of either "YES" or "NO". If you have all the information you need to provide a final recommendation, set it to "NO". If you still need more information, set it to "YES".`;

  return sendOpenAIRequest(apiKey, systemMessage, prompt, maxTokens, model);
};

/**
 * Send a follow-up question to OpenAI to gather more information
 * @param apiKey OpenAI API key
 * @param prompt The prompt to send to OpenAI
 * @param maxTokens Maximum number of tokens to generate (default: 1000)
 * @param model The model to use for the request (default: 'gpt-4-turbo')
 * @returns The response from OpenAI
 */
export const sendFollowUpQuestionToOpenAI = async (
  apiKey: string, 
  prompt: string, 
  maxTokens = 1000,
  model = 'gpt-4-turbo'
): Promise<any> => {
  const systemMessage = `Your Role: You are an expert consultant in designing and implementing vector databases, with a focus on optimizing metadata schemas for enhanced search and retrieval.

Your Context: You've already received some information about the user's document and their needs, but you need more specific details to provide the best recommendations.

Your Task: Review the conversation history and previous responses carefully. Then, ask SPECIFIC follow-up questions to fill in the gaps in your understanding. Focus on areas where you still need clarity to design an optimal metadata schema.

Your questions should be clear, direct, and focused on the most important missing information. Avoid repeating questions that have already been answered.

Consider asking about:
1. Specific details about how users will query the data
2. Particular filtering requirements that weren't fully explained
3. Clarification on data structure or relationships
4. Implementation constraints or preferences
5. Any other critical information needed to finalize your recommendations

RESPONSE FORMAT:
Your response MUST be structured in exactly these sections with these exact headings:

1. BRIEF SUMMARY OF UNDERSTANDING
Provide a concise summary of what you understand so far from the document and previous responses.

2. FOLLOW-UP QUESTIONS FOR METADATA CONSTRUCTION
Organize your questions into these categories (use exactly these category headers):
A) CORE USE CASE & QUERY NEEDS
B) ANTICIPATED QUERIES & INFORMATION NEEDS
C) ESSENTIAL FILTERING & CONSTRAINTS
D) DATA PROVENANCE & STRUCTURE
E) METADATA RETRIEVAL & UTILITY
F) FUTURE USAGE & MAINTENANCE

Under each relevant category, include 1-2 numbered questions that are most important to ask.

IMPORTANT: At the end of your response, include a section titled "NEED_MORE_INFO" with a value of either "YES" or "NO". If you have all the information you need to provide a final recommendation, set it to "NO". If you still need more information, set it to "YES".`;

  return sendOpenAIRequest(apiKey, systemMessage, prompt, maxTokens, model);
};

/**
 * Send a final analysis request to OpenAI when we have enough information
 * @param apiKey OpenAI API key
 * @param prompt The prompt to send to OpenAI
 * @param maxTokens Maximum number of tokens to generate (default: 1000)
 * @param model The model to use for the request (default: 'gpt-4-turbo')
 * @returns The response from OpenAI
 */
export const sendFinalAnalysisToOpenAI = async (
  apiKey: string, 
  prompt: string, 
  maxTokens = 1000,
  model = 'gpt-4-turbo'
): Promise<any> => {
  const systemMessage = `Your Role: You are an expert AI specializing in vector database construction and metadata schema design.
Your Input: You will be given:

Analysis data derived from user-uploaded files (structure, type, content snippets, etc.).
User responses clarifying their goals, query patterns, and filtering needs for the vector database.
Your Task: Synthesize all provided information (file analysis + user answers) to design and recommend the optimal metadata schema. Do not ask more questions. 

Your response MUST be structured in exactly these three sections with these exact headings:

## AI Insights
Provide a comprehensive analysis of the document and user requirements. Include your overall recommendations and insights about the data structure, use case, and implementation approach.

## Metadata Suggestions
Present your recommended metadata schema in a structured format with these columns:
| Field Name | Type | Description | Explanation |
Include all relevant fields that would enhance search, filtering, and retrieval capabilities.

## Vectorization Strategy
Describe the recommended approach for vectorizing the data, including:
- Recommended Model: Specify which embedding model would work best and why
- Chunking Strategy: Explain how the data should be segmented for optimal vector representation

Present each section clearly and comprehensively.`;

  return sendOpenAIRequest(apiKey, systemMessage, prompt, maxTokens, model);
};

/**
 * Send a request to OpenAI based on the current state of the conversation
 * @param apiKey OpenAI API key
 * @param prompt The prompt to send to OpenAI
 * @param isFollowUp Whether this is a follow-up question (default: false)
 * @param maxTokens Maximum number of tokens to generate (default: 1000)
 * @param model The model to use for the request (default: 'gpt-4-turbo')
 * @param hasEnoughInfo Whether the AI has enough information to provide a final answer (default: false)
 * @returns The response from OpenAI
 */
export const sendToOpenAI = async (
  apiKey: string, 
  prompt: string, 
  isFollowUp = false, 
  maxTokens = 1000,
  model = 'gpt-4-turbo',
  hasEnoughInfo = false
): Promise<any> => {
  if (!isFollowUp) {
    return sendInitialAnalysisToOpenAI(apiKey, prompt, maxTokens, model);
  } else if (isFollowUp && !hasEnoughInfo) {
    return sendFollowUpQuestionToOpenAI(apiKey, prompt, maxTokens, model);
  } else {
    return sendFinalAnalysisToOpenAI(apiKey, prompt, maxTokens, model);
  }
};

/**
 * Validate an OpenAI API key by making a test request
 * @param apiKey The API key to validate
 * @returns True if the key is valid, false otherwise
 */
export const validateOpenAIKey = async (apiKey: string): Promise<boolean> => {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    return response.ok;
  } catch (error) {
    console.error('Error validating OpenAI API key:', error);
    return false;
  }
};
