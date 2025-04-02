"use client"

import { useState, useEffect } from "react"
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
  const [responses, setResponses] = useState<{[key: string]: string}>({})
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([])
  const [summaryText, setSummaryText] = useState("")
  
  // Parse the questions from the AI response
  useEffect(() => {
    if (!questions) return;
    
    // Extract the summary section (everything before "Follow-up Questions")
    const followUpIndex = questions.indexOf("Follow-up Questions");
    if (followUpIndex !== -1) {
      setSummaryText(questions.substring(0, followUpIndex).trim());
      
      // Extract the questions section
      const questionsSection = questions.substring(followUpIndex);
      
      // Parse the numbered questions and their sub-questions
      const questionRegex = /(\d+)\.\s+\*\*([^:]+)\*\*:([^0-9]+)/g;
      const matches = [...questionsSection.matchAll(questionRegex)];
      
      const extractedQuestions: Question[] = matches.map(match => {
        const category = match[2].trim();
        const questionText = match[3].trim();
        
        // Split into individual questions (look for bullet points or lines starting with -)
        const subQuestions = questionText
          .split(/\n\s*-\s*|\n\s*•\s*/)
          .map(q => q.trim())
          .filter(q => q.length > 0 && q.includes('?'));
        
        return {
          category,
          questions: subQuestions.length > 0 ? subQuestions : [questionText]
        };
      });
      
      setParsedQuestions(extractedQuestions);
      
      // Initialize responses object with empty strings
      const initialResponses: {[key: string]: string} = {};
      extractedQuestions.forEach((q, i) => {
        initialResponses[`question_${i}`] = '';
      });
      setResponses(initialResponses);
    }
  }, [questions]);
  
  const handleResponseChange = (questionIndex: number, value: string) => {
    setResponses(prev => ({
      ...prev,
      [`question_${questionIndex}`]: value
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Combine all responses into a single formatted string
    const combinedResponse = parsedQuestions.map((question, index) => {
      const response = responses[`question_${index}`];
      if (!response.trim()) return '';
      
      return `**${question.category}**:\n${response}\n\n`;
    }).filter(Boolean).join('');
    
    if (combinedResponse.trim()) {
      onSubmitResponse(combinedResponse);
      
      // Reset responses
      const resetResponses: {[key: string]: string} = {};
      parsedQuestions.forEach((_, i) => {
        resetResponses[`question_${i}`] = '';
      });
      setResponses(resetResponses);
    }
  };
  
  const isAnyResponseFilled = Object.values(responses).some(response => response.trim().length > 0);

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
