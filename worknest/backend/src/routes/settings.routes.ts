import { Router } from "express";
import { settingsController } from "../controllers/index.js";
import { asyncHandler } from "../utils/index.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * @route   PUT /api/settings/organization
 * @desc    Update organization settings
 * @access  Private (Admin only)
 */
router.put(
  "/organization",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(
    settingsController.updateOrganizationSettings.bind(settingsController)
  )
);

/**
 * @route   POST /api/settings/organization/force-logout
 * @desc    Force logout all users in organization
 * @access  Private (Admin only)
 */
router.post(
  "/organization/force-logout",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(settingsController.forceLogoutAllUsers.bind(settingsController))
);

/**
 * @route   PUT /api/settings/user
 * @desc    Update user settings
 * @access  Private
 */
router.put(
  "/user",
  authenticate,
  asyncHandler(settingsController.updateUserSettings.bind(settingsController))
);

/**
 * @route   POST /api/settings/user/logout-devices
 * @desc    Logout from all devices for current user
 * @access  Private
 */
router.post(
  "/user/logout-devices",
  authenticate,
  asyncHandler(settingsController.logoutFromAllDevices.bind(settingsController))
);

export default router;
