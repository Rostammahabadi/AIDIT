"use client"

import type React from "react"

import { useState, useRef } from "react"
import { X } from "lucide-react"

interface FileUploadSectionProps {
  files: File[]
  onFileUpload: (files: File[]) => void
  onRemoveFile: (index: number) => void
}

export function FileUploadSection({ files, onFileUpload, onRemoveFile }: FileUploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files)
      onFileUpload(newFiles)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      onFileUpload(newFiles)

      // Reset the input value so the same file can be uploaded again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Upload Documents</h2>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragging ? "border-[#3B82F6] bg-blue-50" : "border-[#D1D5DB]"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleUploadClick}
      >
        <p className="text-[#6B7280] mb-2">Drag files here or click to upload</p>
        <p className="text-xs text-[#6B7280]">Supported formats: PDF, DOCX, XLSX, JSON, TXT, CSV, HTML</p>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept=".pdf,.docx,.xlsx,.json,.txt,.csv,.html"
          onChange={handleFileInputChange}
        />
      </div>

      <button
        className="mt-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white py-2 px-4 rounded-md transition-transform hover:scale-105"
        onClick={handleUploadClick}
      >
        Upload Files
      </button>

      {files.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Uploaded Files ({files.length})</p>
          <div className="border border-[#E5E7EB] rounded-md max-h-[150px] overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between px-3 py-2 border-b border-[#E5E7EB] last:border-b-0"
              >
                <span className="text-sm truncate">{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveFile(index)
                  }}
                  className="text-gray-500 hover:text-red-500"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

