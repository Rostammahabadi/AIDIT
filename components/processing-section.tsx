"use client"

import { Loader2 } from "lucide-react"

interface ProcessingSectionProps {
  files: File[]
  isProcessing: boolean
  isConnected: boolean | null
  progress?: number
  onProcess: () => void
}

export function ProcessingSection({ files, isProcessing, isConnected, progress = 0, onProcess }: ProcessingSectionProps) {
  const isDisabled = files.length === 0 || !isConnected || isProcessing

  // Calculate total file size to display to the user
  const totalSize = files.reduce((acc, file) => acc + file.size, 0)
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes"
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    else return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Process Documents</h2>

      {files.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-[#6B7280]">
            Ready to process {files.length} {files.length === 1 ? "file" : "files"} ({formatFileSize(totalSize)})
          </p>
          <div className="mt-2 text-xs text-[#6B7280]">
            <p>Processing will:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Extract text from your documents</li>
              <li>Analyze content using OpenAI</li>
              <li>Generate metadata and vectorization recommendations</li>
              <li>All processing happens locally in your browser</li>
            </ul>
          </div>
        </div>
      )}

      <button
        className={`
          py-2 px-4 rounded-md transition-transform hover:scale-105
          ${isDisabled ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-[#10B981] hover:bg-[#059669] text-white"}
        `}
        onClick={onProcess}
        disabled={isDisabled}
      >
        {isProcessing ? (
          <span className="flex items-center">
            <Loader2 className="animate-spin mr-2" size={18} />
            Processing... {progress > 0 && `(${Math.round(progress)}%)`}
          </span>
        ) : (
          "Process Files"
        )}
      </button>

      {files.length === 0 && <p className="mt-2 text-sm text-[#6B7280]">Please upload files to process</p>}

      {files.length > 0 && !isConnected && (
        <p className="mt-2 text-sm text-[#6B7280]">Please connect to OpenAI before processing</p>
      )}

      {isProcessing && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-[#6B7280]">Analyzing documents and generating insights...</p>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-[#10B981] h-2.5 rounded-full animate-pulse w-3/4"></div>
          </div>
          <div className="text-xs text-[#6B7280] italic">
            This may take a few moments depending on file size and complexity
          </div>
        </div>
      )}
    </div>
  )
}
