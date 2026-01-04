'use client'

import React, { useRef, useState } from 'react'
import { ImagePlus, X, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      className={`relative ${className}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
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
        className={`w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <ImagePlus className={`w-6 h-6 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
        <span className={`text-sm ${isDragging ? 'text-blue-600' : 'text-gray-500'}`}>
          {isDragging ? 'Drop image here' : 'Add image'}
        </span>
      </button>
    </div>
  )
}
