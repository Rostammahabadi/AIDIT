"use client"

import { useState } from "react"
import { Check, X, Loader2, Info } from "lucide-react"

interface ApiConfigurationProps {
  apiKey: string
  aiService: string
  maxQuestionDepth: number
  maxTokens: number
  model: string
  isConnected: boolean | null
  isConnecting: boolean
  onApiKeyChange: (key: string) => void
  onAiServiceChange: (service: string) => void
  onMaxQuestionDepthChange: (depth: number) => void
  onMaxTokensChange: (tokens: number) => void
  onModelChange: (model: string) => void
  onTestConnection: () => void
}

export function ApiConfiguration({
  apiKey,
  maxQuestionDepth,
  maxTokens,
  model,
  isConnected,
  isConnecting,
  onApiKeyChange,
  onMaxQuestionDepthChange,
  onMaxTokensChange,
  onModelChange,
  onTestConnection,
}: ApiConfigurationProps) {
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false)
  const [showDepthTooltip, setShowDepthTooltip] = useState(false)
  const [showTokensTooltip, setShowTokensTooltip] = useState(false)
  const [showModelTooltip, setShowModelTooltip] = useState(false)
  const [tokenError, setTokenError] = useState(false)

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">AI Service Configuration</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">AI Service</label>
          <input
            type="text"
            className="w-full p-2 border border-[#D1D5DB] rounded-md bg-gray-100"
            value="OpenAI"
            disabled
            readOnly
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">API Key</label>
          <div className="relative">
            <input
              type={isApiKeyVisible ? "text" : "password"}
              className="w-full p-2 border border-[#D1D5DB] rounded-md pr-24"
              placeholder="Enter your OpenAI API key"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-sm text-[#6B7280] hover:text-[#3B82F6]"
              onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
            >
              {isApiKeyVisible ? "Hide" : "Show"}
            </button>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            Your API key is stored locally in your browser and never sent to our servers.
          </p>
        </div>

        <div>
          <div className="flex items-center mb-1">
            <label className="block text-sm font-medium">OpenAI Model</label>
            <div className="relative ml-2">
              <Info 
                size={16} 
                className="text-[#6B7280] cursor-pointer hover:text-[#3B82F6]" 
                onMouseEnter={() => setShowModelTooltip(true)}
                onMouseLeave={() => setShowModelTooltip(false)}
              />
              {showModelTooltip && (
                <div className="absolute z-10 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg -left-32 top-6">
                  Different models have different capabilities and context windows. All models here have at least 16K token context windows, with newer models offering up to 200K tokens.
                </div>
              )}
            </div>
          </div>
          <select
            className="w-full p-2 border border-[#D1D5DB] rounded-md"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
          >
            <option value="o3-mini">o3-mini (200K context)</option>
            <option value="o1">o1 (200K context)</option>
            <option value="o1-mini">o1-mini (128K context)</option>
            <option value="gpt-4o-mini">GPT-4o mini (128K context)</option>
            <option value="gpt-4-turbo">GPT-4 Turbo (128K context)</option>
            <option value="gpt-4-1106-preview">GPT-4 Turbo Preview (128K context)</option>
            <option value="gpt-4-0125-preview">GPT-4 Turbo Preview 0125 (128K context)</option>
            <option value="gpt-4-vision-preview">GPT-4 Vision (128K context)</option>
            <option value="gpt-3.5-turbo-16k">GPT-3.5 Turbo 16K (16K context)</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo (16K context)</option>
          </select>
        </div>

        <div>
          <div className="flex items-center mb-1">
            <label className="block text-sm font-medium">Maximum Question Depth</label>
            <div className="relative ml-2">
              <Info 
                size={16} 
                className="text-[#6B7280] cursor-pointer hover:text-[#3B82F6]" 
                onMouseEnter={() => setShowDepthTooltip(true)}
                onMouseLeave={() => setShowDepthTooltip(false)}
              />
              {showDepthTooltip && (
                <div className="absolute z-10 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg -left-32 top-6">
                  Represents how many times the AI can ask questions and refine the approach. More depth potentially means more aligned metadata construction.
                </div>
              )}
            </div>
          </div>
          <input
            type="text"
            className="w-full p-2 border border-[#D1D5DB] rounded-md"
            value={maxQuestionDepth === 0 ? '' : maxQuestionDepth}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '');
              onMaxQuestionDepthChange(value === '' ? 0 : parseInt(value));
            }}
          />
        </div>

        <div>
          <div className="flex items-center mb-1">
            <label className="block text-sm font-medium">Maximum Tokens</label>
            <div className="relative ml-2">
              <Info 
                size={16} 
                className="text-[#6B7280] cursor-pointer hover:text-[#3B82F6]" 
                onMouseEnter={() => setShowTokensTooltip(true)}
                onMouseLeave={() => setShowTokensTooltip(false)}
              />
              {showTokensTooltip && (
                <div className="absolute z-10 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg -left-32 top-6">
                  Controls the maximum length of AI responses. Higher values allow for more detailed responses but may cost more tokens. Lower values are more concise.
                </div>
              )}
            </div>
          </div>
          <input
            type="text"
            className={`w-full p-2 border ${tokenError ? 'border-red-500' : 'border-[#D1D5DB]'} rounded-md`}
            value={maxTokens === 0 ? '' : maxTokens}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '');
              const numValue = value === '' ? 0 : parseInt(value);
              
              // Set different max token limits based on the selected model
              let maxLimit = 4000; // Default limit
              
              // Adjust max token limit based on model
              if (model.startsWith('gpt-3.5')) {
                maxLimit = 4000;
              } else if (model.startsWith('gpt-4-0')) {
                maxLimit = 8000;
              } else if (model.startsWith('gpt-4-1') || model === 'gpt-4-turbo') {
                maxLimit = 4000;
              } else if (model.startsWith('gpt-4o') || model === 'gpt-4-vision-preview') {
                maxLimit = 4000;
              } else if (model.startsWith('o1')) {
                maxLimit = 8000;
              } else if (model.startsWith('o3')) {
                maxLimit = 4000;
              }
              
              if (numValue > maxLimit) {
                setTokenError(true);
              } else {
                setTokenError(false);
                onMaxTokensChange(numValue);
              }
            }}
          />
          {tokenError && (
            <p className="text-xs text-red-500 mt-1">
              Maximum tokens for {model} is limited to {
                model.startsWith('gpt-3.5') ? '4,000' :
                model.startsWith('gpt-4-0') ? '8,000' :
                model.startsWith('gpt-4-1') || model === 'gpt-4-turbo' ? '4,000' :
                model.startsWith('gpt-4o') || model === 'gpt-4-vision-preview' ? '4,000' :
                model.startsWith('o1') ? '8,000' :
                model.startsWith('o3') ? '4,000' : '4,000'
              } tokens
            </p>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <button
            className={`
              py-2 px-4 rounded-md transition-transform hover:scale-105
              ${
                !apiKey
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-[#3B82F6] hover:bg-[#2563EB] text-white"
              }
            `}
            onClick={onTestConnection}
            disabled={!apiKey || isConnecting}
          >
            {isConnecting ? (
              <span className="flex items-center">
                <Loader2 className="animate-spin mr-2" size={18} />
                Connecting...
              </span>
            ) : (
              "Test Connection"
            )}
          </button>

          {isConnected !== null && (
            <div className="flex items-center">
              {isConnected ? (
                <>
                  <Check className="text-green-500 mr-2" size={18} />
                  <span className="text-green-500">Connected successfully</span>
                </>
              ) : (
                <>
                  <X className="text-red-500 mr-2" size={18} />
                  <span className="text-red-500">Connection failed</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
