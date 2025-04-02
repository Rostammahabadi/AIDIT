"use client"

import { useState } from "react"
import { AlertTriangle, X } from "lucide-react"

export function SecurityNotice() {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 relative">
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-blue-500" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-blue-800">Security Information</h3>
          <div className="mt-2 text-sm text-blue-700">
            <p>
              Your API key is now encrypted and stored in session storage (not localStorage), which means:
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>It will be automatically cleared when you close your browser</li>
              <li>It's encrypted before being stored to provide an additional layer of security</li>
              <li>It's never sent to our servers - all API calls are made directly from your browser to OpenAI</li>
            </ul>
            <p className="mt-2">
              <strong>Best practice:</strong> For maximum security, we recommend clearing your API key manually when you're done using the application.
            </p>
          </div>
        </div>
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute top-2 right-2 text-blue-500 hover:text-blue-700"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
