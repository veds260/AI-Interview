'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Check, Trash2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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

interface CommentListProps {
  comments: Comment[]
  onCommentUpdate: () => void
  currentUserId: string | null
}

export default function CommentList({ comments, onCommentUpdate, currentUserId }: CommentListProps) {
  const [loadingCommentId, setLoadingCommentId] = useState<string | null>(null)

  const handleToggleResolved = async (commentId: string) => {
    setLoadingCommentId(commentId)
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        throw new Error('Failed to update comment')
      }

      toast.success('Comment updated')
      onCommentUpdate()
    } catch (error) {
      console.error('Error updating comment:', error)
      toast.error('Failed to update comment')
    } finally {
      setLoadingCommentId(null)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return
    }

    setLoadingCommentId(commentId)
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete comment')
      }

      toast.success('Comment deleted')
      onCommentUpdate()
    } catch (error) {
      console.error('Error deleting comment:', error)
      toast.error('Failed to delete comment')
    } finally {
      setLoadingCommentId(null)
    }
  }

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (role.toLowerCase()) {
      case 'client':
        return 'default'
      case 'admin':
        return 'destructive'
      case 'writer':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 text-sm font-medium">No comments yet</p>
        <p className="text-gray-400 text-xs mt-2">
          Select text in the tweet to add a comment
        </p>
      </div>
    )
  }

  const unresolvedComments = comments.filter(c => !c.resolved)
  const resolvedComments = comments.filter(c => c.resolved)

  return (
    <div className="space-y-4">
      {/* Unresolved Comments */}
      {unresolvedComments.length > 0 && (
        <div>
          <h5 className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-wider">
            Active ({unresolvedComments.length})
          </h5>
          <div className="space-y-4">
            {unresolvedComments.map(comment => (
              <div
                key={comment.id}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">
                        {comment.userName}
                      </span>
                      <Badge variant={getRoleBadgeVariant(comment.userRole)} className="text-xs">
                        {comment.userRole}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {comment.selectedText && (
                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-xs text-yellow-800 leading-relaxed">
                    &quot;{comment.selectedText}&quot;
                  </div>
                )}

                <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                  {comment.commentText}
                </p>

                <div className="flex items-center space-x-2 pt-3 border-t border-gray-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleResolved(comment.id)}
                    disabled={loadingCommentId === comment.id}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                  >
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Resolve
                  </Button>

                  {comment.userId === currentUserId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteComment(comment.id)}
                      disabled={loadingCommentId === comment.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved Comments */}
      {resolvedComments.length > 0 && (
        <div>
          <h5 className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-wider">
            Resolved ({resolvedComments.length})
          </h5>
          <div className="space-y-4">
            {resolvedComments.map(comment => (
              <div
                key={comment.id}
                className="bg-gray-50/50 border border-gray-100 rounded-lg p-4 opacity-70 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-semibold text-gray-700">
                        {comment.userName}
                      </span>
                      <Badge variant={getRoleBadgeVariant(comment.userRole)} className="text-xs">
                        {comment.userRole}
                      </Badge>
                      <Check className="w-4 h-4 text-green-500" />
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {comment.selectedText && (
                  <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md text-xs text-green-800 leading-relaxed">
                    &quot;{comment.selectedText}&quot;
                  </div>
                )}

                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  {comment.commentText}
                </p>

                <div className="flex items-center space-x-2 pt-3 border-t border-gray-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleResolved(comment.id)}
                    disabled={loadingCommentId === comment.id}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Unresolve
                  </Button>

                  {comment.userId === currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteComment(comment.id)}
                      disabled={loadingCommentId === comment.id}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
