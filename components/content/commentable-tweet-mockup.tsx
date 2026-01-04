'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { MessageCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

interface Comment {
  id: string
  extractionId: string
  userId: string | null
  userName: string
  userRole: string
  commentText: string
  selectedText: string | null
  startOffset: number | null
  endOffset: number | null
  resolved: boolean
  createdAt: string
  updatedAt: string
}

interface MediaItem {
  type: string
  data: string
  name?: string
  tweetIndex?: number
}

interface CommentableTweetMockupProps {
  extractionId: string
  clientName: string
  twitterHandle?: string
  profilePicture?: string
  tweetText: string
  timestamp?: Date
  onCommentAdded?: () => void
  media?: MediaItem[]
  isThread?: boolean
  threadTweets?: string[]
  userName?: string
  userRole?: string
}

export default function CommentableTweetMockup({
  extractionId,
  clientName,
  twitterHandle,
  profilePicture,
  tweetText,
  timestamp,
  onCommentAdded,
  media,
  threadTweets = [],
  userName = 'Anonymous',
  userRole = 'writer'
}: CommentableTweetMockupProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [showCommentButton, setShowCommentButton] = useState(false)
  const [showCommentPopup, setShowCommentPopup] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [guestName, setGuestName] = useState('')
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())

  // Parse thread from tweetText if it contains triple line breaks
  const parsedThreadTweets = useMemo(() => {
    if (threadTweets && threadTweets.length > 0) {
      return threadTweets
    }
    const lines = tweetText.split('\n\n\n').filter(line => line.trim().length > 0)
    if (lines.length > 1) {
      return lines
    }
    return [tweetText]
  }, [tweetText, threadTweets])

  const isActualThread = parsedThreadTweets.length > 1

  const handleImageError = (index: number) => {
    setImageErrors(prev => new Set(prev).add(index))
  }

  const [selection, setSelection] = useState<{
    text: string
    startOffset: number
    endOffset: number
    x: number
    y: number
    relativeX: number
    relativeY: number
    showBelow?: boolean
  } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch comments on mount
  useEffect(() => {
    fetchComments()
  }, [extractionId])

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/extractions/${extractionId}/comments`)
      if (response.ok) {
        const data = await response.json()
        setComments(data)
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const handleTextSelection = () => {
    try {
      const selectedText = window.getSelection()?.toString().trim()

      if (selectedText && selectedText.length > 0 && contentRef.current) {
        const range = window.getSelection()?.getRangeAt(0)
        if (!range) return

        // Calculate position for button
        const rect = range.getBoundingClientRect()
        const containerRect = contentRef.current.getBoundingClientRect()

        // Get the text offsets relative to the tweet text
        const fullText = tweetText
        const startOffset = fullText.indexOf(selectedText)
        const endOffset = startOffset + selectedText.length

        if (startOffset !== -1) {
          // Calculate relative coordinates for button (absolute positioning within container)
          const relativeX = rect.left - containerRect.left + rect.width / 2
          const relativeY = rect.top - containerRect.top - 10

          // Calculate viewport coordinates for popup (portal with fixed positioning)
          const viewportX = rect.left + rect.width / 2
          const viewportY = rect.top

          setSelection({
            text: selectedText,
            startOffset,
            endOffset,
            x: viewportX,
            y: viewportY,
            relativeX,
            relativeY,
            showBelow: false
          })
          setShowCommentButton(true)
          setShowCommentPopup(false)
        }
      } else {
        setShowCommentButton(false)
        setShowCommentPopup(false)
      }
    } catch (error) {
      console.error('Error handling text selection:', error)
      setShowCommentButton(false)
      setShowCommentPopup(false)
    }
  }

  const handleOpenCommentPopup = () => {
    try {
      setShowCommentButton(false)
      setShowCommentPopup(true)
      // Focus textarea after popup opens
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    } catch (error) {
      console.error('Error opening comment popup:', error)
      toast.error('Failed to open comment dialog')
    }
  }

  const handleAddComment = async () => {
    if (!commentText.trim() || !selection) {
      toast.error('Please enter a comment')
      return
    }

    try {
      const response = await fetch(`/api/extractions/${extractionId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          commentText: commentText.trim(),
          selectedText: selection.text,
          startOffset: selection.startOffset,
          endOffset: selection.endOffset,
          userName: guestName.trim() || userName,
          userRole
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add comment')
      }

      const newComment = await response.json()
      setComments([...comments, newComment])
      setCommentText('')
      setGuestName('')
      setShowCommentPopup(false)
      setSelection(null)
      toast.success('Comment added!')

      if (onCommentAdded) {
        onCommentAdded()
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      toast.error('Failed to add comment')
    }
  }

  const handleCancelComment = () => {
    try {
      setShowCommentButton(false)
      setShowCommentPopup(false)
      setSelection(null)
      setCommentText('')
      setGuestName('')
      window.getSelection()?.removeAllRanges()
    } catch (error) {
      console.error('Error canceling comment:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleAddComment()
    }
  }

  // Render tweet text with comment highlights for a specific tweet content
  const renderTweetWithHighlights = (content: string, contentStartOffset: number = 0) => {
    if (comments.length === 0) {
      return content
    }

    const contentEndOffset = contentStartOffset + content.length

    // Filter comments that overlap with this content
    const relevantComments = comments.filter(c =>
      c.startOffset !== null && c.endOffset !== null &&
      c.startOffset < contentEndOffset && c.endOffset > contentStartOffset
    )

    if (relevantComments.length === 0) {
      return content
    }

    const segments: Array<{
      text: string
      commentIds: string[]
      startOffset: number
      endOffset: number
    }> = []

    let currentIndex = contentStartOffset

    // Sort comments by startOffset
    const sortedComments = [...relevantComments].sort((a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0))

    sortedComments.forEach(comment => {
      // Clamp comment offsets to content bounds
      const clampedStart = Math.max(comment.startOffset ?? 0, contentStartOffset)
      const clampedEnd = Math.min(comment.endOffset ?? 0, contentEndOffset)

      // Add text before this comment
      if (currentIndex < clampedStart) {
        segments.push({
          text: tweetText.slice(currentIndex, clampedStart),
          commentIds: [],
          startOffset: currentIndex,
          endOffset: clampedStart
        })
      }

      // Add the commented text
      const existingSegment = segments.find(
        s => s.startOffset === clampedStart && s.endOffset === clampedEnd
      )

      if (existingSegment) {
        existingSegment.commentIds.push(comment.id)
      } else {
        segments.push({
          text: tweetText.slice(clampedStart, clampedEnd),
          commentIds: [comment.id],
          startOffset: clampedStart,
          endOffset: clampedEnd
        })
      }

      currentIndex = Math.max(currentIndex, clampedEnd)
    })

    // Add remaining text
    if (currentIndex < contentEndOffset) {
      segments.push({
        text: tweetText.slice(currentIndex, contentEndOffset),
        commentIds: [],
        startOffset: currentIndex,
        endOffset: contentEndOffset
      })
    }

    return segments.map((segment, index) => {
      if (segment.commentIds.length > 0) {
        const unresolvedCount = segment.commentIds.filter(
          id => !comments.find(c => c.id === id)?.resolved
        ).length

        return (
          <span
            key={index}
            className={`relative ${
              unresolvedCount > 0
                ? 'bg-yellow-500/20 border-b-2 border-yellow-500 cursor-pointer'
                : 'bg-green-500/10 border-b-2 border-green-500/50'
            }`}
            title={`${unresolvedCount} unresolved comment(s)`}
          >
            {segment.text}
            {unresolvedCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {unresolvedCount}
              </span>
            )}
          </span>
        )
      }
      return <span key={index}>{segment.text}</span>
    })
  }

  // Calculate the start offset for each thread tweet in the original text
  const getThreadTweetOffset = (tweetIndex: number): number => {
    let offset = 0
    for (let i = 0; i < tweetIndex; i++) {
      offset += parsedThreadTweets[i].length + 3 // +3 for the \n\n\n separator
    }
    return offset
  }

  // Filter media for a specific tweet index
  const getMediaForTweet = (tweetIndex: number) => {
    if (!media) return []
    return media.filter(item => {
      const itemIndex = item.tweetIndex !== undefined ? item.tweetIndex : 0
      return itemIndex === tweetIndex
    })
  }

  const displayHandle = twitterHandle?.startsWith('@')
    ? twitterHandle
    : twitterHandle
    ? `@${twitterHandle}`
    : '@user'

  // Get initials for default avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Render a single tweet card
  const renderSingleTweetCard = (content: string, tweetIndex: number, total: number) => {
    const tweetMedia = getMediaForTweet(tweetIndex)
    const contentOffset = getThreadTweetOffset(tweetIndex)

    return (
      <div key={tweetIndex} className="bg-black border border-gray-800 rounded-2xl p-5 w-full mx-auto" style={{ maxWidth: '550px' }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start space-x-3 flex-1 min-w-0">
            {/* Profile Picture */}
            <div className="flex-shrink-0">
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt={clientName}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                  {getInitials(clientName)}
                </div>
              )}
            </div>

            {/* Name and Handle */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1">
                <span className="text-white font-bold hover:underline cursor-pointer text-[15px]">
                  {clientName}
                </span>
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"
                  />
                </svg>
              </div>
              <span className="text-gray-500 text-[15px]">
                {displayHandle}
              </span>
            </div>
          </div>

          {/* More Options */}
          <button className="text-gray-500 hover:text-blue-400 p-2 hover:bg-blue-500/10 rounded-full transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>
        </div>

        {/* Thread Indicator */}
        {total > 1 && (
          <div className="inline-block px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded mb-2">
            {tweetIndex + 1}/{total}
          </div>
        )}

        {/* Tweet Content with highlights */}
        <div className="text-white text-[15px] leading-[1.4] whitespace-pre-wrap break-words mb-4">
          {renderTweetWithHighlights(content, contentOffset)}
        </div>

        {/* Media Gallery for this tweet */}
        {tweetMedia.length > 0 && (
          <div className={`mb-4 rounded-2xl overflow-hidden border border-gray-800 ${
            tweetMedia.length === 1 ? '' :
            tweetMedia.length === 2 ? 'grid grid-cols-2 gap-0.5' :
            tweetMedia.length === 3 ? 'grid grid-cols-2 grid-rows-2 gap-0.5' :
            'grid grid-cols-2 gap-0.5'
          }`}>
            {tweetMedia.map((item, index) => (
              <div
                key={index}
                className={`relative bg-gray-900 ${
                  tweetMedia.length === 3 && index === 0 ? 'row-span-2' : ''
                }`}
                style={{
                  paddingBottom: tweetMedia.length === 1 ? '56.25%' : '75%'
                }}
              >
                {!imageErrors.has(index) ? (
                  <img
                    src={item.data}
                    alt={item.name || `Media ${index + 1}`}
                    className="absolute inset-0 w-full h-full object-contain"
                    onError={() => handleImageError(index)}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center text-center p-4">
                    <p className="text-red-300 text-sm font-semibold">Image unavailable</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Timestamp - only on last tweet */}
        {tweetIndex === total - 1 && (
          <div className="text-gray-500 text-[15px] mb-4 pb-4 border-b border-gray-800">
            {timestamp ? new Date(timestamp).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, month: 'short', day: 'numeric', year: 'numeric' })} · <span className="text-white font-semibold">X</span> for iPhone
          </div>
        )}

        {/* Help text - only on last tweet */}
        {tweetIndex === total - 1 && (
          <div className="text-xs text-gray-400 text-center py-2 border-t border-gray-800">
            Select any text above to add a comment
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        ref={contentRef}
        onMouseUp={handleTextSelection}
        className="relative select-text space-y-4"
      >
        {parsedThreadTweets.map((tweet, index) =>
          renderSingleTweetCard(tweet, index, parsedThreadTweets.length)
        )}

        {/* Thread indicator */}
        {isActualThread && (
          <div className="text-center">
            <span className="inline-block px-3 py-1 bg-blue-900/30 text-blue-300 text-xs rounded-full border border-blue-800">
              Thread: {parsedThreadTweets.length} tweets
            </span>
          </div>
        )}
      </div>

      {/* Comment Button - Shows first after text selection */}
      {showCommentButton && selection && (
        <button
          onClick={handleOpenCommentPopup}
          className="absolute z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg transition-all hover:scale-110"
          style={{
            left: `${selection.relativeX}px`,
            top: `${selection.relativeY}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      )}

      {/* Comment Popup - Rendered via Portal to avoid modal clipping */}
      {showCommentPopup && selection && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-2xl p-4 w-80"
          style={{
            left: `${selection.x}px`,
            top: `${selection.y}px`,
            transform: 'translate(-50%, calc(-100% - 10px))',
            maxHeight: '400px',
            overflow: 'auto'
          }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5 text-blue-500" />
              <h4 className="text-sm font-medium text-gray-900">Add Comment</h4>
            </div>
            <button
              onClick={handleCancelComment}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            &quot;{selection.text}&quot;
          </div>

          {/* Guest Name Input - Only show for anonymous/unauthenticated users */}
          {userName === 'Anonymous' && (
            <Input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Your name"
              className="w-full mb-3 text-sm"
            />
          )}
          {userName !== 'Anonymous' && (
            <p className="text-xs text-gray-500 mb-3">
              Commenting as <span className="font-medium text-gray-700">{userName}</span>
            </p>
          )}

          <Textarea
            ref={textareaRef}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add your comment... (Ctrl+Enter to submit)"
            className="w-full text-sm mb-3"
            rows={3}
          />

          <div className="flex items-center justify-end space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelComment}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!commentText.trim()}
            >
              Add Comment
            </Button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
