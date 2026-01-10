import { Response, NextFunction } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { AuthenticatedRequest, JWTPayload } from "../types/index.js";
import User from "../models/User.js";

/**
 * Authentication Middleware
 * Validates JWT token and attaches user info to request
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Authentication required. Please provide a valid token.",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: "Invalid token format.",
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "secret"
    ) as JWTPayload;

    // Verify user exists and is active
    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        error: "User not found.",
      });
      return;
    }

    if (user.status === "BLOCKED") {
      res.status(403).json({
        success: false,
        error: "Your account has been blocked. Contact your administrator.",
      });
      return;
    }

    // Attach user to request
    req.user = {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      role: decoded.role,
    };

    // Update last seen
    user.lastSeenAt = new Date();
    await user.save();

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: "Token expired. Please login again.",
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: "Invalid token.",
      });
      return;
    }

    console.error("Authentication error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication failed.",
    });
  }
};

/**
 * Role-based Authorization Middleware
 */
export const authorize = (...roles: string[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required.",
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: "You do not have permission to perform this action.",
      });
      return;
    }

    next();
  };
};

/**
 * Generate JWT Token
 */
export const generateToken = (payload: JWTPayload): string => {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, process.env.JWT_SECRET || "secret", options);
};

/**
 * Verify JWT Token
 */
export const verifyToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "secret") as JWTPayload;
  } catch {
    return null;
  }
};

export default { authenticate, authorize, generateToken, verifyToken };
