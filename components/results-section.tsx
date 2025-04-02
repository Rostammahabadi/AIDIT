"use client"

import { useState } from "react"
import { Clipboard, Download } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ResultsProps {
  results: {
    insights?: string;
    metadata?: {
      fieldName: string
      type: string
      description: string
      explanation: string
    }[]
    vectorization?: {
      model: string
      chunking: string
      modelExplanation: string
      chunkingExplanation: string
    }
    apiResponse?: {
      model: string;
      usage: any;
    }
    error?: string;
  } | null;
  aiService: string
}

export function ResultsSection({ results, aiService }: ResultsProps) {
  const [activeTab, setActiveTab] = useState("insights")
  const [copySuccess, setCopySuccess] = useState(false)

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(results, null, 2))
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const handleDownloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2))
    const downloadAnchorNode = document.createElement("a")
    downloadAnchorNode.setAttribute("href", dataStr)
    downloadAnchorNode.setAttribute("download", "document_insights.json")
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }

  // Format the AI service name for display
  const formatServiceName = (service: string) => {
    if (!service) return ""

    const serviceMap: Record<string, string> = {
      openai: "OpenAI",
      anthropic: "Anthropic",
      cohere: "Cohere",
      huggingface: "Hugging Face",
      azure: "Azure OpenAI",
    }

    return serviceMap[service] || service
  }

  if (!results) {
    return null;
  }
  
  if (results.error) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Results</h2>
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          <p className="font-medium">Error</p>
          <p>{results.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Results</h2>

      {aiService && results.apiResponse && (
        <div className="mb-4 text-sm text-[#6B7280]">
          Processed using <span className="font-medium">{formatServiceName(aiService)}</span>
          {results.apiResponse.model && (
            <span> | Model: <span className="font-medium">{results.apiResponse.model}</span></span>
          )}
          {results.apiResponse.usage && (
            <span> | Tokens: <span className="font-medium">{results.apiResponse.usage.total_tokens}</span></span>
          )}
        </div>
      )}

      <div className="border-b border-[#E5E7EB] mb-4">
        <div className="flex">
          <button
            className={`py-2 px-4 border-b-2 ${
              activeTab === "insights" ? "border-[#3B82F6] text-[#3B82F6]" : "border-transparent text-[#6B7280]"
            }`}
            onClick={() => setActiveTab("insights")}
          >
            AI Insights
          </button>
          <button
            className={`py-2 px-4 border-b-2 ${
              activeTab === "metadata" ? "border-[#3B82F6] text-[#3B82F6]" : "border-transparent text-[#6B7280]"
            }`}
            onClick={() => setActiveTab("metadata")}
          >
            Metadata Suggestions
          </button>
          <button
            className={`py-2 px-4 border-b-2 ${
              activeTab === "vectorization" ? "border-[#3B82F6] text-[#3B82F6]" : "border-transparent text-[#6B7280]"
            }`}
            onClick={() => setActiveTab("vectorization")}
          >
            Vectorization Strategy
          </button>
        </div>
      </div>

      <div className="mb-6">
        {activeTab === "insights" && results.insights && (
          <div className="prose max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({node, ...props}) => (
                  <div className="overflow-x-auto my-4">
                    <table className="w-full border-collapse" {...props} />
                  </div>
                ),
                thead: ({node, ...props}) => <thead className="bg-[#F9FAFB]" {...props} />,
                th: ({node, ...props}) => <th className="border border-[#E5E7EB] px-4 py-2 text-left" {...props} />,
                td: ({node, ...props}) => <td className="border border-[#E5E7EB] px-4 py-2" {...props} />
              }}
            >
              {results.insights}
            </ReactMarkdown>
          </div>
        )}
        
        {activeTab === "metadata" && results.metadata && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB]">
                  <th className="border border-[#E5E7EB] px-4 py-2 text-left">Field Name</th>
                  <th className="border border-[#E5E7EB] px-4 py-2 text-left">Type</th>
                  <th className="border border-[#E5E7EB] px-4 py-2 text-left">Description</th>
                  <th className="border border-[#E5E7EB] px-4 py-2 text-left">Explanation</th>
                </tr>
              </thead>
              <tbody>
                {results.metadata.map((field, index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                    <td className="border border-[#E5E7EB] px-4 py-2">{field.fieldName}</td>
                    <td className="border border-[#E5E7EB] px-4 py-2">{field.type}</td>
                    <td className="border border-[#E5E7EB] px-4 py-2">{field.description}</td>
                    <td className="border border-[#E5E7EB] px-4 py-2">{field.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "vectorization" && results.vectorization && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#F9FAFB] p-4 rounded-md">
                <h3 className="font-medium text-lg mb-2">Recommended Model</h3>
                <p className="text-[#6B7280] mb-1">{results.vectorization.model}</p>
                <p className="text-sm">{results.vectorization.modelExplanation}</p>
              </div>
              <div className="bg-[#F9FAFB] p-4 rounded-md">
                <h3 className="font-medium text-lg mb-2">Chunking Strategy</h3>
                <p className="text-[#6B7280] mb-1">{results.vectorization.chunking}</p>
                <p className="text-sm">{results.vectorization.chunkingExplanation}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex space-x-4">
        <button
          className="flex items-center border border-[#3B82F6] text-[#3B82F6] py-2 px-4 rounded-md transition-transform hover:scale-105"
          onClick={handleCopyToClipboard}
        >
          <Clipboard size={16} className="mr-2" />
          {copySuccess ? "Copied!" : "Copy to Clipboard"}
        </button>

        <button
          className="flex items-center bg-[#3B82F6] hover:bg-[#2563EB] text-white py-2 px-4 rounded-md transition-transform hover:scale-105"
          onClick={handleDownloadJson}
        >
          <Download size={16} className="mr-2" />
          Download as JSON
        </button>
      </div>
    </div>
  )
}
