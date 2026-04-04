import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import './CommentSection.css';

const CommentSection = ({ violationId }) => {
  const { user } = useContext(AuthContext);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCommentText, setNewCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    fetchComments();
    setupSocket();

    return () => {
      if (socket) {
        socket.emit('leave-violation', violationId);
        socket.disconnect();
      }
    };
  }, [violationId, sortBy]);

  const setupSocket = () => {
    const newSocket = io(window.location.origin);
    newSocket.emit('join-violation', violationId);

    newSocket.on('new-comment', (data) => {
      setComments(prev => [data.comment, ...prev]);
    });

    newSocket.on('comment-like-update', (data) => {
      setComments(prev => prev.map(comment =>
        comment._id === data.commentId
          ? { ...comment, likes: { count: data.likesCount } }
          : comment
      ));
    });

    newSocket.on('comment-deleted', (data) => {
      setComments(prev => prev.filter(comment => comment._id !== data.commentId));
    });

    setSocket(newSocket);
  };

  const fetchComments = async () => {
    try {
      setLoading(true);
      const config = { withCredentials: true };

      const response = await axios.get(
        `/api/violations/${violationId}/comments?sort=${sortBy}`,
        config
      );

      setComments(response.data.comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();

    if (!user) {
      alert('Please login to comment');
      return;
    }

    if (newCommentText.trim().length === 0) {
      return;
    }

    if (newCommentText.length > 500) {
      alert('Comment must not exceed 500 characters');
      return;
    }

    try {
      setSubmitting(true);
      const response = await axios.post(
        `/api/violations/${violationId}/comments`,
        { text: newCommentText },
        {
          withCredentials: true
        }
      );

      // Socket will handle adding the comment via real-time event
      setNewCommentText('');
    } catch (error) {
      console.error('Error posting comment:', error);
      alert(error.response?.data?.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId) => {
    if (!user) {
      alert('Please login to like comments');
      return;
    }

    try {
      await axios.post(
        `/api/violations/comments/${commentId}/like`,
        {},
        {
          withCredentials: true
        }
      );

      // Update local state optimistically
      setComments(prev => prev.map(comment => {
        if (comment._id === commentId) {
          const hasLiked = comment.hasUserLiked;
          return {
            ...comment,
            hasUserLiked: !hasLiked,
            likes: {
              count: hasLiked ? comment.likes.count - 1 : comment.likes.count + 1
            }
          };
        }
        return comment;
      }));
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      await axios.delete(
        `/api/violations/comments/${commentId}`,
        {
          withCredentials: true
        }
      );

      // Socket will handle removing the comment via real-time event
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert(error.response?.data?.message || 'Failed to delete comment');
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const charCount = newCommentText.length;
  const charLimitExceeded = charCount > 500;

  return (
    <div className="comment-section">
      <h3>Comments</h3>

      {/* Comment Form */}
      {user ? (
        <form className="comment-form" onSubmit={handleSubmitComment}>
          <textarea
            className={`comment-textarea ${charLimitExceeded ? 'exceeded' : ''}`}
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Share your thoughts... (500 characters max)"
            rows="3"
            disabled={submitting}
          />
          <div className="comment-form-footer">
            <span className={`char-counter ${charLimitExceeded ? 'exceeded' : ''}`}>
              {charCount}/500
            </span>
            <button
              type="submit"
              className="comment-submit-btn"
              disabled={submitting || charCount === 0 || charLimitExceeded}
            >
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      ) : (
        <div className="comment-login-prompt">
          Please log in to comment
        </div>
      )}

      {/* Sort Options */}
      <div className="comment-sort">
        <button
          className={sortBy === 'recent' ? 'active' : ''}
          onClick={() => setSortBy('recent')}
        >
          Most Recent
        </button>
        <button
          className={sortBy === 'popular' ? 'active' : ''}
          onClick={() => setSortBy('popular')}
        >
          Most Liked
        </button>
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="comment-loading">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="no-comments">No comments yet. Be the first to comment!</div>
      ) : (
        <div className="comments-list">
          {comments.map(comment => (
            <div key={comment._id} className="comment">
              <div className="comment-header">
                <div className="comment-author">
                  {comment.author?.avatar && (
                    <img src={comment.author.avatar} alt="" className="comment-avatar" />
                  )}
                  <span className="comment-username">
                    {comment.author?.username || 'Anonymous'}
                  </span>
                  <span className="comment-timestamp">
                    {formatTimestamp(comment.createdAt)}
                  </span>
                </div>
                {user && (user._id === comment.author._id || ['moderator', 'admin'].includes(user.role)) && (
                  <button
                    className="comment-delete-btn"
                    onClick={() => handleDeleteComment(comment._id)}
                    title="Delete comment"
                  >
                    🗑️
                  </button>
                )}
              </div>

              <div className="comment-text">
                {comment.text}
              </div>

              <div className="comment-actions">
                <button
                  className={`comment-like-btn ${comment.hasUserLiked ? 'liked' : ''}`}
                  onClick={() => handleLikeComment(comment._id)}
                  disabled={!user}
                >
                  {comment.hasUserLiked ? '❤️' : '🤍'} {comment.likes.count}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
