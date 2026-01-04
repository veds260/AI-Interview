'use client'

import React, { useRef, useState, useEffect } from 'react'
import { ImagePlus, X, Clipboard } from 'lucide-react'

interface ImageUploadProps {
  onImageChange: (imageUrl: string | null) => void
  currentImage?: string | null
  className?: string
}

export default function ImageUpload({
  onImageChange,
  currentImage,
  className = '',
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      onImageChange(result)
    }
    reader.readAsDataURL(file)
  }

  // Handle clipboard paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only handle paste when this component area is focused or active
      if (!isFocused && !containerRef.current?.contains(document.activeElement)) {
        return
      }

      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault()
          const file = items[i].getAsFile()
          if (file) {
            handleFileSelect(file)
          }
          break
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [isFocused])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleRemove = () => {
    onImageChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (currentImage) {
    return (
      <div className={`relative group ${className}`}>
        <img
          src={currentImage}
          alt="Uploaded"
          className="w-full h-32 object-cover rounded-lg border border-gray-200"
        />
        <button
          onClick={handleRemove}
          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
          Click X to remove
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      tabIndex={0}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        onFocus={() => setIsFocused(true)}
        className={`w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
          isDragging || isFocused
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-2">
          <ImagePlus className={`w-5 h-5 ${isDragging || isFocused ? 'text-blue-500' : 'text-gray-400'}`} />
          <Clipboard className={`w-4 h-4 ${isDragging || isFocused ? 'text-blue-500' : 'text-gray-400'}`} />
        </div>
        <span className={`text-sm ${isDragging || isFocused ? 'text-blue-600' : 'text-gray-500'}`}>
          {isDragging ? 'Drop image here' : 'Click, drop, or paste image'}
        </span>
        <span className="text-xs text-gray-400">
          Ctrl+V / Cmd+V to paste
        </span>
      </button>
    </div>
  )
}
