import { Router } from "express";
import { messageController } from "../controllers/index.js";
import { asyncHandler } from "../utils/index.js";

const router = Router();

/**
 * @route   GET /api/messages/:channelId
 * @desc    Get messages for a channel
 * @access  Private (member only)
 */
router.get(
  "/:channelId",
  asyncHandler(messageController.getByChannel.bind(messageController))
);

/**
 * @route   POST /api/messages/:channelId
 * @desc    Send a message
 * @access  Private (member only)
 */
router.post(
  "/:channelId",
  asyncHandler(messageController.send.bind(messageController))
);

/**
 * @route   PUT /api/messages/:id
 * @desc    Edit a message
 * @access  Private (sender only)
 */
router.put(
  "/:id",
  asyncHandler(messageController.edit.bind(messageController))
);

/**
 * @route   DELETE /api/messages/:id
 * @desc    Delete a message (soft delete)
 * @access  Private (sender or admin)
 */
router.delete(
  "/:id",
  asyncHandler(messageController.delete.bind(messageController))
);

/**
 * @route   POST /api/messages/:id/reactions
 * @desc    Add/toggle reaction to message
 * @access  Private (member only)
 */
router.post(
  "/:id/reactions",
  asyncHandler(messageController.toggleReaction.bind(messageController))
);

/**
 * @route   POST /api/messages/:channelId/read
 * @desc    Mark messages in a channel as read
 * @access  Private (member only)
 */
router.post(
  "/:channelId/read",
  asyncHandler(messageController.markRead.bind(messageController))
);

/**
 * @route   GET /api/messages/:channelId/search
 * @desc    Search messages in a channel
 * @access  Private (member only)
 */
router.get(
  "/:channelId/search",
  asyncHandler(messageController.search.bind(messageController))
);

/**
 * @route   GET /api/messages/:channelId/pinned
 * @desc    Get pinned messages for a channel
 * @access  Private (member only)
 */
router.get(
  "/:channelId/pinned",
  asyncHandler(messageController.getPinned.bind(messageController))
);

/**
 * @route   POST /api/messages/:id/pin
 * @desc    Toggle pin status of a message
 * @access  Private (member only)
 */
router.post(
  "/:id/pin",
  asyncHandler(messageController.togglePin.bind(messageController))
);

/**
 * @route   GET /api/messages/:messageId/thread
 * @desc    Get thread replies for a message
 * @access  Private (member only)
 */
router.get(
  "/:messageId/thread",
  asyncHandler(messageController.getThread.bind(messageController))
);

/**
 * @route   POST /api/messages/:messageId/thread
 * @desc    Reply to a thread
 * @access  Private (member only)
 */
router.post(
  "/:messageId/thread",
  asyncHandler(messageController.replyToThread.bind(messageController))
);

export default router;
