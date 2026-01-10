import { Router } from "express";
import { authController } from "../controllers/index.js";
import { asyncHandler } from "../utils/index.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register new organization and admin user
 * @access  Public
 */
router.post(
  "/register",
  asyncHandler(authController.register.bind(authController))
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public (requires subdomain)
 */
router.post("/login", asyncHandler(authController.login.bind(authController)));

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get(
  "/me",
  authenticate,
  asyncHandler(authController.me.bind(authController))
);

/**
 * @route   POST /api/auth/invite
 * @desc    Invite a user to the organization
 * @access  Private (Admin only)
 */
router.post(
  "/invite",
  authenticate,
  asyncHandler(authController.invite.bind(authController))
);

/**
 * @route   POST /api/auth/activate
 * @desc    Activate invited user account
 * @access  Public (requires org subdomain)
 */
router.post(
  "/activate",
  asyncHandler(authController.activate.bind(authController))
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  "/change-password",
  authenticate,
  asyncHandler(authController.changePassword.bind(authController))
);

export default router;
