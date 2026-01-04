'use client'

import React, { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  ThumbsUp,
  MessageCircle,
  Repeat2,
  Send,
  Globe,
  MoreHorizontal,
} from 'lucide-react'

interface LinkedInMockupProps {
  clientName: string
  headline?: string
  profilePicture?: string
  postText: string
  timestamp?: Date
}

export default function LinkedInMockup({
  clientName,
  headline,
  profilePicture,
  postText,
  timestamp,
}: LinkedInMockupProps) {
  // Get initials for default avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Format post text with paragraph spacing
  const formattedText = useMemo(() => {
    return postText.split('\n').map((paragraph, index) => {
      if (paragraph.trim() === '') return null
      return (
        <p key={index} className="mb-3 last:mb-0">
          {paragraph}
        </p>
      )
    }).filter(Boolean)
  }, [postText])

  // Generate realistic engagement numbers
  const stats = useMemo(() => {
    const baseReactions = Math.floor(Math.random() * 800) + 100
    const comments = Math.floor(baseReactions * (0.05 + Math.random() * 0.1))
    const reposts = Math.floor(baseReactions * (0.02 + Math.random() * 0.05))

    return {
      reactions: baseReactions,
      comments,
      reposts,
    }
  }, [])

  const displayTime = timestamp
    ? formatDistanceToNow(new Date(timestamp), { addSuffix: false })
    : '2h'

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm w-full mx-auto" style={{ maxWidth: '550px' }}>
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* Profile Picture */}
            {profilePicture ? (
              <img
                src={profilePicture}
                alt={clientName}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-lg ring-2 ring-gray-100">
                {getInitials(clientName)}
              </div>
            )}

            {/* Name and Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-gray-900 hover:text-blue-600 hover:underline cursor-pointer text-[15px]">
                  {clientName}
                </span>
                {/* LinkedIn 1st connection indicator */}
                <span className="text-gray-500 text-sm">• 1st</span>
              </div>
              <p className="text-gray-500 text-[13px] line-clamp-1">
                {headline || 'Founder & CEO'}
              </p>
              <div className="flex items-center gap-1 text-gray-500 text-xs mt-0.5">
                <span>{displayTime}</span>
                <span>•</span>
                <Globe className="w-3 h-3" />
              </div>
            </div>
          </div>

          {/* More Options */}
          <button className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Post Content */}
      <div className="px-4 pb-3">
        <div className="text-[14px] text-gray-900 leading-relaxed whitespace-pre-wrap">
          {formattedText}
        </div>
      </div>

      {/* Engagement Stats */}
      <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-500 border-b border-gray-100">
        <div className="flex items-center gap-1">
          {/* Reaction icons */}
          <div className="flex -space-x-1">
            <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px]">👍</span>
            <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-[8px]">❤️</span>
            <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-[8px]">👏</span>
          </div>
          <span className="ml-1">{stats.reactions.toLocaleString()}</span>
        </div>
        <div className="flex gap-3">
          <span>{stats.comments} comments</span>
          <span>{stats.reposts} reposts</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-2 py-1 flex items-center justify-around">
        <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-4 py-3 hover:bg-gray-100 rounded-lg transition-colors flex-1 justify-center">
          <ThumbsUp className="w-5 h-5" />
          <span className="text-sm font-medium">Like</span>
        </button>
        <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-4 py-3 hover:bg-gray-100 rounded-lg transition-colors flex-1 justify-center">
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-medium">Comment</span>
        </button>
        <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-4 py-3 hover:bg-gray-100 rounded-lg transition-colors flex-1 justify-center">
          <Repeat2 className="w-5 h-5" />
          <span className="text-sm font-medium">Repost</span>
        </button>
        <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-4 py-3 hover:bg-gray-100 rounded-lg transition-colors flex-1 justify-center">
          <Send className="w-5 h-5" />
          <span className="text-sm font-medium">Send</span>
        </button>
      </div>
    </div>
  )
}
