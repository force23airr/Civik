import Comment from '../models/Comment.js';
import ViolationReport from '../models/ViolationReport.js';

// @desc    Get comments for a violation report
// @route   GET /api/violations/:id/comments
// @access  Public (optional auth to check user likes)
export const getComments = async (req, res) => {
  try {
    const { sort = 'recent', limit = 20, page = 1 } = req.query;
    const violationId = req.params.id;

    // Verify violation report exists
    const violation = await ViolationReport.findById(violationId);
    if (!violation) {
      return res.status(404).json({ message: 'Violation report not found' });
    }

    const query = { violationReport: violationId, isDeleted: false };

    // Determine sort order
    let sortOption = {};
    if (sort === 'popular') {
      sortOption = { 'likes.count': -1, createdAt: -1 };
    } else {
      sortOption = { createdAt: -1 };
    }

    const total = await Comment.countDocuments(query);
    const pages = Math.ceil(total / parseInt(limit));

    const comments = await Comment.find(query)
      .populate('author', 'username avatar')
      .sort(sortOption)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Add hasUserLiked flag if user is authenticated
    const commentsWithLikeStatus = comments.map(comment => {
      const commentObj = comment.toObject();
      if (req.user) {
        commentObj.hasUserLiked = comment.hasUserLiked(req.user._id);
      } else {
        commentObj.hasUserLiked = false;
      }
      // Don't send full users array to client
      commentObj.likes = { count: comment.likes.count };
      return commentObj;
    });

    res.json({
      success: true,
      comments: commentsWithLikeStatus,
      pagination: {
        current: parseInt(page),
        pages,
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Create a comment on a violation report
// @route   POST /api/violations/:id/comments
// @access  Private
export const createComment = async (req, res) => {
  try {
    const { text } = req.body;
    const violationId = req.params.id;

    // Validate input
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    if (text.length > 500) {
      return res.status(400).json({ message: 'Comment must not exceed 500 characters' });
    }

    // Verify violation report exists
    const violation = await ViolationReport.findById(violationId);
    if (!violation) {
      return res.status(404).json({ message: 'Violation report not found' });
    }

    // Create comment
    const comment = new Comment({
      violationReport: violationId,
      author: req.user._id,
      text: text.trim()
    });

    await comment.save();

    // Populate author info
    await comment.populate('author', 'username avatar');

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.to(`violation-${violationId}`).emit('new-comment', {
        comment: {
          ...comment.toObject(),
          hasUserLiked: false,
          likes: { count: 0 }
        }
      });
    }

    res.status(201).json({
      success: true,
      comment: {
        ...comment.toObject(),
        hasUserLiked: false,
        likes: { count: 0 }
      }
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Toggle like on a comment
// @route   POST /api/violations/comments/:commentId/like
// @access  Private
export const toggleCommentLike = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.isDeleted) {
      return res.status(404).json({ message: 'Comment has been deleted' });
    }

    // Toggle like
    const liked = comment.toggleLike(req.user._id);
    await comment.save();

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.to(`violation-${comment.violationReport}`).emit('comment-like-update', {
        commentId: comment._id,
        likesCount: comment.likes.count
      });
    }

    res.json({
      success: true,
      liked,
      likesCount: comment.likes.count
    });
  } catch (error) {
    console.error('Error toggling comment like:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Delete a comment
// @route   DELETE /api/violations/comments/:commentId
// @access  Private (author or moderator/admin)
export const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.isDeleted) {
      return res.status(404).json({ message: 'Comment already deleted' });
    }

    // Check permission: author, moderator, or admin
    const isAuthor = comment.author.toString() === req.user._id.toString();
    const isModerator = ['moderator', 'admin'].includes(req.user.role);

    if (!isAuthor && !isModerator) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    // Soft delete
    comment.softDelete(req.user._id);
    await comment.save();

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.to(`violation-${comment.violationReport}`).emit('comment-deleted', {
        commentId: comment._id
      });
    }

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Flag a comment for moderation
// @route   POST /api/violations/comments/:commentId/flag
// @access  Private
export const flagComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reason } = req.body;

    const validReasons = ['spam', 'harassment', 'misinformation', 'inappropriate', 'other'];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({ message: 'Invalid flag reason' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.isDeleted) {
      return res.status(404).json({ message: 'Comment has been deleted' });
    }

    // Check if user already flagged
    const alreadyFlagged = comment.flags.some(
      f => f.user.toString() === req.user._id.toString()
    );

    if (alreadyFlagged) {
      return res.status(400).json({ message: 'You have already flagged this comment' });
    }

    // Add flag
    comment.flags.push({
      user: req.user._id,
      reason,
      timestamp: new Date()
    });

    await comment.save();

    res.json({
      success: true,
      message: 'Comment flagged for moderation'
    });
  } catch (error) {
    console.error('Error flagging comment:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

export default {
  getComments,
  createComment,
  toggleCommentLike,
  deleteComment,
  flagComment
};
