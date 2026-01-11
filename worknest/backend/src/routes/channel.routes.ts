import { Router } from "express";
import { channelController } from "../controllers/index.js";
import { asyncHandler } from "../utils/index.js";

const router = Router();

/**
 * @route   GET /api/channels
 * @desc    Get all channels for the user
 * @access  Private
 */
router.get("/", asyncHandler(channelController.getAll.bind(channelController)));

/**
 * @route   POST /api/channels
 * @desc    Create a new channel
 * @access  Private (Admin for PUBLIC/PRIVATE, all for DM)
 */
router.post(
  "/",
  asyncHandler(channelController.create.bind(channelController))
);

/**
 * @route   POST /api/channels/dm
 * @desc    Create or get DM channel
 * @access  Private
 */
router.post(
  "/dm",
  asyncHandler(channelController.createDM.bind(channelController))
);

/**
 * @route   GET /api/channels/:id
 * @desc    Get channel details
 * @access  Private (member only)
 */
router.get(
  "/:id",
  asyncHandler(channelController.getById.bind(channelController))
);

/**
 * @route   DELETE /api/channels/:id
 * @desc    Delete channel
 * @access  Private (Admin only)
 */
router.delete(
  "/:id",
  asyncHandler(channelController.delete.bind(channelController))
);

/**
 * @route   POST /api/channels/:id/members
 * @desc    Add member to channel
 * @access  Private (Admin only)
 */
router.post(
  "/:id/members",
  asyncHandler(channelController.addMember.bind(channelController))
);

/**
 * @route   GET /api/channels/:id/files
 * @desc    Get all files in a channel
 * @access  Private (member only)
 */
router.get(
  "/:id/files",
  asyncHandler(channelController.getFiles.bind(channelController))
);

/**
 * @route   DELETE /api/channels/:id/members/:userId
 * @desc    Remove member from channel
 * @access  Private (Admin only)
 */
router.delete(
  "/:id/members/:userId",
  asyncHandler(channelController.removeMember.bind(channelController))
);

/**
 * @route   PUT /api/channels/:id/notifications
 * @desc    Update channel notification settings
 * @access  Private (member only)
 */
router.put(
  "/:id/notifications",
  asyncHandler(
    channelController.updateNotificationSettings.bind(channelController)
  )
);

/**
 * @route   PUT /api/channels/:id/columns
 * @desc    Update Kanban columns
 * @access  Private (member only)
 */
router.put(
  "/:id/columns",
  asyncHandler(channelController.updateColumns.bind(channelController))
);

export default router;
