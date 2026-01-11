import { Router } from "express";
import { userController } from "../controllers/index.js";
import { asyncHandler } from "../utils/index.js";

const router = Router();

/**
 * @route   GET /api/users
 * @desc    Get all users in organization
 * @access  Private
 */
router.get("/", asyncHandler(userController.getAll.bind(userController)));

/**
 * @route   PUT /api/users/status
 * @desc    Update custom status
 * @access  Private
 */
router.put(
  "/status",
  asyncHandler(userController.updateStatus.bind(userController))
);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  "/profile",
  asyncHandler(userController.updateProfile.bind(userController))
);

/**
 * @route   DELETE /api/users/me
 * @desc    Delete own account
 * @access  Private
 */
router.delete(
  "/me",
  asyncHandler(userController.deleteMe.bind(userController))
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get("/:id", asyncHandler(userController.getById.bind(userController)));

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (self or admin)
 */
router.put("/:id", asyncHandler(userController.update.bind(userController)));

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete/block user
 * @access  Private (admin only)
 */
router.delete("/:id", asyncHandler(userController.delete.bind(userController)));

export default router;
