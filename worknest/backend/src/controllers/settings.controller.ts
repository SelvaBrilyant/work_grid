import { Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { Organization, User } from "../models/index.js";
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "../utils/AppError.js";

/**
 * Settings Controller
 * Handles organization-level and user-level configurations
 */
class SettingsController {
  /**
   * Update organization settings (Admin only)
   * @route PUT /api/settings/organization
   */
  async updateOrganizationSettings(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    if (!req.user || req.user.role !== "ADMIN") {
      throw new ForbiddenError(
        "Only organization admins can update organization settings."
      );
    }

    const { organizationId } = req.user;
    const { name, logo, settings } = req.body;

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      throw new NotFoundError("Organization not found.");
    }

    // Safe initialization
    if (!organization.settings) {
      organization.settings = {
        general: { timezone: "UTC", language: "en" },
        channelPolicies: {
          defaultChannels: ["general"],
          allowPrivateChannels: true,
          messageRetentionDays: 0,
        },
        security: {
          passwordPolicy: {
            minLength: 8,
            requireNumbers: false,
            requireSymbols: false,
          },
          sessionTimeoutMinutes: 1440,
        },
        notifications: {
          enableEmailNotifications: true,
          defaultPreferences: { allMessages: false, mentionsOnly: true },
        },
      };
    }

    // Update fields
    if (name) organization.name = name;
    if (logo !== undefined) organization.logo = logo;

    // Deep merge or specific field update for settings
    if (settings) {
      if (settings.general) {
        organization.settings.general = {
          ...organization.settings.general,
          ...settings.general,
        };
      }
      if (settings.channelPolicies) {
        organization.settings.channelPolicies = {
          ...organization.settings.channelPolicies,
          ...settings.channelPolicies,
        };
      }
      if (settings.security) {
        organization.settings.security = {
          ...organization.settings.security,
          ...settings.security,
        };
      }
      if (settings.notifications) {
        organization.settings.notifications = {
          ...organization.settings.notifications,
          ...settings.notifications,
        };
      }
    }
    // Help Mongoose recognize nested change
    organization.markModified("settings");

    await organization.save();

    res.json({
      success: true,
      data: organization,
      message: "Organization settings updated successfully.",
    });
  }

  /**
   * Update user settings (Per employee)
   * @route PUT /api/settings/user
   */
  async updateUserSettings(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { userId } = req.user;
    const { statusMessage, settings } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError("User not found.");
    }

    // Safe initialization
    if (!user.settings) {
      user.settings = {
        preferences: { language: "en", timezone: "UTC", theme: "system" },
        notifications: { messages: true, mentions: true, email: true },
        privacy: {
          showOnlineStatus: true,
          readReceipts: true,
          lastSeenVisibility: "everyone",
        },
      };
    }

    if (statusMessage !== undefined) user.statusMessage = statusMessage;

    if (settings) {
      if (settings.preferences) {
        user.settings.preferences = {
          ...user.settings.preferences,
          ...settings.preferences,
        };
      }
      if (settings.notifications) {
        user.settings.notifications = {
          ...user.settings.notifications,
          ...settings.notifications,
        };
      }
      if (settings.privacy) {
        user.settings.privacy = {
          ...user.settings.privacy,
          ...settings.privacy,
        };
      }
    }

    // Help Mongoose recognize nested change
    user.markModified("settings");

    await user.save();

    res.json({
      success: true,
      data: user,
      message: "User settings updated successfully.",
    });
  }

  /**
   * Force logout all users in organization (Admin only)
   * @route POST /api/settings/organization/force-logout
   */
  async forceLogoutAllUsers(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    if (!req.user || req.user.role !== "ADMIN") {
      throw new ForbiddenError(
        "Only organization admins can perform this action."
      );
    }

    const { organizationId } = req.user;

    // Increment tokenVersion for all users in this organization
    await User.updateMany({ organizationId }, { $inc: { tokenVersion: 1 } });

    res.json({
      success: true,
      message: "All users have been forced to logout.",
    });
  }

  /**
   * Logout from all devices for current user
   * @route POST /api/settings/user/logout-devices
   */
  async logoutFromAllDevices(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { userId } = req.user;

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found.");
    }

    user.tokenVersion += 1;
    await user.save();

    res.json({
      success: true,
      message: "You have been logged out from all devices.",
    });
  }
}

// Export singleton instance
export const settingsController = new SettingsController();
export default SettingsController;
