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
