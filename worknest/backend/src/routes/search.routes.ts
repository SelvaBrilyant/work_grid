import { Router } from "express";
import { searchController } from "../controllers/search.controller.js";
import { asyncHandler } from "../utils/index.js";

const router = Router();

/**
 * @route   GET /api/search
 * @desc    Global search across messages and files
 * @access  Private
 */
router.get("/", asyncHandler(searchController.search.bind(searchController)));

/**
 * @route   GET /api/search/history
 * @desc    Get user's recent search history
 * @access  Private
 */
router.get(
  "/history",
  asyncHandler(searchController.getHistory.bind(searchController))
);

export default router;
