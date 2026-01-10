import { Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { generateToken } from "../middlewares/auth.middleware.js";
import { Organization, User, Channel, ChannelMember } from "../models/index.js";
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../utils/AppError.js";
import { emailService } from "../utils/index.js";
import xss from "xss";
import crypto from "crypto";

/**
 * Authentication Controller
 * Handles all authentication-related operations
 */
class AuthController {
  /**
   * Register new organization and admin user
   * @route POST /api/auth/register
   */
  async register(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { organizationName, subdomain, name, email, password } = req.body;

    // Validate required fields
    if (!organizationName || !subdomain || !name || !email || !password) {
      throw new BadRequestError("All fields are required.");
    }

    // Check if subdomain already exists
    const existingOrg = await Organization.findOne({
      subdomain: subdomain.toLowerCase(),
    });

    if (existingOrg) {
      throw new ConflictError("This subdomain is already taken.");
    }

    // Create organization
    const organization = await Organization.create({
      name: xss(organizationName),
      subdomain: subdomain.toLowerCase(),
      status: "ACTIVE",
      plan: "FREE",
    });

    // Create admin user
    const user = await User.create({
      organizationId: organization._id,
      name: xss(name),
      email: email.toLowerCase(),
      passwordHash: password,
      role: "ADMIN",
      status: "ACTIVE",
    });

    // Create default general channel
    const generalChannel = await Channel.create({
      organizationId: organization._id,
      name: "general",
      description: "General discussion channel for everyone",
      type: "PUBLIC",
      createdBy: user._id,
    });

    // Add admin to general channel
    await ChannelMember.create({
      organizationId: organization._id,
      channelId: generalChannel._id,
      userId: user._id,
      role: "ADMIN",
    });

    // Generate token
    const token = generateToken({
      userId: user._id.toString(),
      organizationId: organization._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    // Send welcome email (non-blocking)
    emailService
      .sendWelcomeEmail(
        user.email,
        user.name,
        organization.name,
        organization.subdomain
      )
      .catch((err) => console.error("Welcome email failed", err));

    res.status(201).json({
      success: true,
      data: {
        organization: {
          id: organization._id,
          name: organization.name,
          subdomain: organization.subdomain,
          settings: organization.settings,
        },
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          settings: user.settings,
        },
        token,
      },
      message: "Organization and admin account created successfully.",
    });
  }

  /**
   * Login user
   * @route POST /api/auth/login
   */
  async login(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { email, password } = req.body;
    const organizationId = req.organizationId;

    if (!email || !password) {
      throw new BadRequestError("Email and password are required.");
    }

    if (!organizationId) {
      throw new BadRequestError("Organization context is required.");
    }

    // Find user with password
    const user = await User.findOne({
      organizationId,
      email: email.toLowerCase(),
    }).select("+passwordHash");

    if (!user) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    // Check user status
    if (user.status === "BLOCKED") {
      throw new ForbiddenError(
        "Your account has been blocked. Contact your administrator."
      );
    }

    if (user.status === "INVITED") {
      throw new ForbiddenError("Please complete your registration first.");
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    // Update last seen
    user.lastSeenAt = new Date();
    await user.save();

    // Generate token
    const token = generateToken({
      userId: user._id.toString(),
      organizationId: user.organizationId.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    // Get organization info
    const organization = await Organization.findById(organizationId);

    // Calculate redirect URL if not already on the correct subdomain
    let redirectUrl = null;
    if (organization) {
      const host = req.headers.host || "";
      const baseDomain = process.env.BASE_DOMAIN || "localhost";
      const expectedHost = `${organization.subdomain}.${baseDomain}`;

      if (!host.startsWith(expectedHost)) {
        redirectUrl = `http://${expectedHost}:5173/auth-callback?token=${token}&subdomain=${organization.subdomain}`;
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          status: user.status,
          statusMessage: user.statusMessage,
          settings: user.settings,
        },
        organization: organization
          ? {
              id: organization._id,
              name: organization.name,
              subdomain: organization.subdomain,
              logo: organization.logo,
              settings: organization.settings,
            }
          : null,
        token,
        redirectUrl,
      },
    });
  }

  /**
   * Get current user info
   * @route GET /api/auth/me
   */
  async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const orgId = req.organizationId || req.user.organizationId;
    const user = await User.findById(req.user.userId);
    const organization = await Organization.findById(orgId);

    if (!user || !organization) {
      throw new NotFoundError("User or organization not found.");
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          status: user.status,
          statusMessage: user.statusMessage,
          lastSeenAt: user.lastSeenAt,
          settings: user.settings,
        },
        organization: {
          id: organization._id,
          name: organization.name,
          subdomain: organization.subdomain,
          plan: organization.plan,
          logo: organization.logo,
          settings: organization.settings,
        },
      },
    });
  }

  /**
   * Invite a user to the organization
   * @route POST /api/auth/invite
   */
  async invite(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user || req.user.role !== "ADMIN") {
      throw new ForbiddenError("Only admins can invite users.");
    }

    const { email, name, role = "EMPLOYEE" } = req.body;

    if (!email || !name) {
      throw new BadRequestError("Email and name are required.");
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      organizationId: req.user.organizationId,
      email: email.toLowerCase(),
    });

    if (existingUser) {
      throw new ConflictError(
        "User with this email already exists in your organization."
      );
    }

    // Create invited user with invitation token
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const user = await User.create({
      organizationId: req.user.organizationId,
      name: xss(name),
      email: email.toLowerCase(),
      passwordHash: crypto.randomBytes(16).toString("hex"), // Temp random password
      role: role === "ADMIN" ? "ADMIN" : "EMPLOYEE",
      status: "INVITED",
      invitationToken: inviteToken,
      invitationExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Get organization info for the email
    const organization = await Organization.findById(req.user.organizationId);

    if (organization) {
      // Send invitation email (non-blocking)
      emailService
        .sendInvitationEmail(
          user.email,
          req.user.userId, // Should ideally be user name, but we have ID here.
          organization.name,
          organization.subdomain,
          inviteToken
        )
        .catch((err) => console.error("Invitation email failed", err));
    }

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
      message: "User invited successfully. An email has been sent.",
    });
  }

  /**
   * Activate invited user account
   * @route POST /api/auth/activate
   */
  async activate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { token: invitationToken, newPassword, name } = req.body;

    if (!invitationToken || !newPassword) {
      throw new BadRequestError(
        "Invitation token and new password are required."
      );
    }

    const user = await User.findOne({
      invitationToken,
      invitationExpires: { $gt: new Date() },
      status: "INVITED",
    }).select("+invitationToken +invitationExpires");

    if (!user) {
      throw new NotFoundError("Invitation invalid, expired, or already used.");
    }

    // Update password, status, and clear token
    if (name) user.name = xss(name);
    user.passwordHash = newPassword;
    user.status = "ACTIVE";
    user.invitationToken = undefined;
    user.invitationExpires = undefined;
    await user.save();

    // Add user to all public channels ONLY NOW when they are active
    const publicChannels = await Channel.find({
      organizationId: user.organizationId,
      type: "PUBLIC",
    });

    for (const channel of publicChannels) {
      // Check if already a member
      const existing = await ChannelMember.findOne({
        channelId: channel._id,
        userId: user._id,
      });

      if (!existing) {
        await ChannelMember.create({
          organizationId: user.organizationId,
          channelId: channel._id,
          userId: user._id,
          role: "MEMBER",
        });
      }
    }

    // Generate login token
    const token = generateToken({
      userId: user._id.toString(),
      organizationId: user.organizationId.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    // Get organization info for redirect
    const organization = await Organization.findById(user.organizationId);

    // Calculate redirect URL
    let redirectUrl = null;
    if (organization) {
      const host = req.headers.host || "";
      const baseDomain = process.env.BASE_DOMAIN || "localhost";
      const expectedHost = `${organization.subdomain}.${baseDomain}`;

      if (!host.startsWith(expectedHost)) {
        redirectUrl = `http://${expectedHost}:5173/auth-callback?token=${token}&subdomain=${organization.subdomain}`;
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          settings: user.settings,
        },
        organization: organization
          ? {
              id: organization._id,
              name: organization.name,
              subdomain: organization.subdomain,
            }
          : null,
        token,
        redirectUrl,
      },
      message: "Account activated successfully.",
    });
  }

  /**
   * Change user password
   * @route POST /api/auth/change-password
   */
  async changePassword(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new BadRequestError(
        "Current password and new password are required."
      );
    }

    if (newPassword.length < 8) {
      throw new BadRequestError("New password must be at least 8 characters.");
    }

    // Find user with password
    const user = await User.findById(req.user.userId).select("+passwordHash");

    if (!user) {
      throw new NotFoundError("User not found.");
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new UnauthorizedError("Current password is incorrect.");
    }

    // Update password
    user.passwordHash = newPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully.",
    });
  }
}

// Export singleton instance
export const authController = new AuthController();
export default AuthController;
