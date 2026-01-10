import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { generateToken, authenticate } from "../middlewares/auth.middleware.js";
import { Organization, User, Channel, ChannelMember } from "../models/index.js";
import xss from "xss";

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register new organization and admin user
 * @access  Public
 */
router.post(
  "/register",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { organizationName, subdomain, name, email, password } = req.body;

      // Validate required fields
      if (!organizationName || !subdomain || !name || !email || !password) {
        res.status(400).json({
          success: false,
          error: "All fields are required.",
        });
        return;
      }

      // Check if subdomain already exists
      const existingOrg = await Organization.findOne({
        subdomain: subdomain.toLowerCase(),
      });
      if (existingOrg) {
        res.status(400).json({
          success: false,
          error: "This subdomain is already taken.",
        });
        return;
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
      });

      res.status(201).json({
        success: true,
        data: {
          organization: {
            id: organization._id,
            name: organization.name,
            subdomain: organization.subdomain,
          },
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          token,
        },
        message: "Organization and admin account created successfully.",
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create organization.",
      });
    }
  }
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public (requires subdomain)
 */
router.post(
  "/login",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      const organizationId = req.organizationId;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          error: "Email and password are required.",
        });
        return;
      }

      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: "Organization context is required.",
        });
        return;
      }

      // Find user with password
      const user = await User.findOne({
        organizationId,
        email: email.toLowerCase(),
      }).select("+passwordHash");

      if (!user) {
        res.status(401).json({
          success: false,
          error: "Invalid email or password.",
        });
        return;
      }

      // Check user status
      if (user.status === "BLOCKED") {
        res.status(403).json({
          success: false,
          error: "Your account has been blocked. Contact your administrator.",
        });
        return;
      }

      if (user.status === "INVITED") {
        res.status(403).json({
          success: false,
          error: "Please complete your registration first.",
        });
        return;
      }

      // Verify password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        res.status(401).json({
          success: false,
          error: "Invalid email or password.",
        });
        return;
      }

      // Update last seen
      user.lastSeenAt = new Date();
      await user.save();

      // Generate token
      const token = generateToken({
        userId: user._id.toString(),
        organizationId: user.organizationId.toString(),
        role: user.role,
      });

      // Get organization info
      const organization = await Organization.findById(organizationId);

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
          },
          organization: organization
            ? {
                id: organization._id,
                name: organization.name,
                subdomain: organization.subdomain,
              }
            : null,
          token,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        error: "Login failed.",
      });
    }
  }
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get(
  "/me",
  authenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "Authentication required.",
        });
        return;
      }

      const user = await User.findById(req.user.userId);
      const organization = await Organization.findById(req.user.organizationId);

      if (!user || !organization) {
        res.status(404).json({
          success: false,
          error: "User or organization not found.",
        });
        return;
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
            lastSeenAt: user.lastSeenAt,
          },
          organization: {
            id: organization._id,
            name: organization.name,
            subdomain: organization.subdomain,
            plan: organization.plan,
          },
        },
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user info.",
      });
    }
  }
);

/**
 * @route   POST /api/auth/invite
 * @desc    Invite a user to the organization
 * @access  Private (Admin only)
 */
router.post(
  "/invite",
  authenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        res.status(403).json({
          success: false,
          error: "Only admins can invite users.",
        });
        return;
      }

      const { email, name, role = "EMPLOYEE" } = req.body;

      if (!email || !name) {
        res.status(400).json({
          success: false,
          error: "Email and name are required.",
        });
        return;
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        organizationId: req.user.organizationId,
        email: email.toLowerCase(),
      });

      if (existingUser) {
        res.status(400).json({
          success: false,
          error: "User with this email already exists in your organization.",
        });
        return;
      }

      // Create invited user with temporary password
      const tempPassword = Math.random().toString(36).slice(-8);
      const user = await User.create({
        organizationId: req.user.organizationId,
        name: xss(name),
        email: email.toLowerCase(),
        passwordHash: tempPassword,
        role: role === "ADMIN" ? "ADMIN" : "EMPLOYEE",
        status: "INVITED",
      });

      // Add user to all public channels
      const publicChannels = await Channel.find({
        organizationId: req.user.organizationId,
        type: "PUBLIC",
      });

      for (const channel of publicChannels) {
        await ChannelMember.create({
          organizationId: req.user.organizationId,
          channelId: channel._id,
          userId: user._id,
          role: "MEMBER",
        });
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
          tempPassword, // In production, send this via email
        },
        message: "User invited successfully.",
      });
    } catch (error) {
      console.error("Invite error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to invite user.",
      });
    }
  }
);

/**
 * @route   POST /api/auth/activate
 * @desc    Activate invited user account
 * @access  Public (requires org subdomain)
 */
router.post(
  "/activate",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { email, tempPassword, newPassword } = req.body;
      const organizationId = req.organizationId;

      if (!email || !tempPassword || !newPassword) {
        res.status(400).json({
          success: false,
          error: "Email, temporary password, and new password are required.",
        });
        return;
      }

      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: "Organization context is required.",
        });
        return;
      }

      const user = await User.findOne({
        organizationId,
        email: email.toLowerCase(),
        status: "INVITED",
      }).select("+passwordHash");

      if (!user) {
        res.status(404).json({
          success: false,
          error: "Invitation not found or already activated.",
        });
        return;
      }

      // Verify temp password
      const isMatch = await user.comparePassword(tempPassword);
      if (!isMatch) {
        res.status(401).json({
          success: false,
          error: "Invalid temporary password.",
        });
        return;
      }

      // Update password and activate
      user.passwordHash = newPassword;
      user.status = "ACTIVE";
      await user.save();

      // Generate token
      const token = generateToken({
        userId: user._id.toString(),
        organizationId: user.organizationId.toString(),
        role: user.role,
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          token,
        },
        message: "Account activated successfully.",
      });
    } catch (error) {
      console.error("Activation error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to activate account.",
      });
    }
  }
);

export default router;
