import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import Organization from "../models/Organization.js";

/**
 * Subdomain Extraction Middleware
 * Extracts subdomain from Host header and maps to organization
 */
export const extractSubdomain = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const host = req.headers.host || "";
    const baseDomain = process.env.BASE_DOMAIN || "localhost";

    let subdomain: string | null = null;

    // Handle localhost development
    if (host.includes("localhost")) {
      // Check for subdomain in query param for development
      subdomain =
        (req.query.org as string) ||
        (req.headers["x-subdomain"] as string) ||
        null;
    } else {
      // Production: Extract subdomain from host
      // e.g., zoho.worknest.com -> zoho
      const parts = host.split(".");
      if (parts.length >= 3) {
        subdomain = parts[0];
      } else if (parts.length === 2 && !host.includes(baseDomain)) {
        subdomain = parts[0];
      }
    }

    // If no subdomain found, check custom header (useful for testing)
    if (!subdomain) {
      subdomain = (req.headers["x-organization-subdomain"] as string) || null;
    }

    if (!subdomain) {
      // Allow requests without subdomain for specific routes
      const publicRoutes = ["/health", "/api/organizations/register"];
      if (publicRoutes.some((route) => req.path.startsWith(route))) {
        return next();
      }

      res.status(400).json({
        success: false,
        error: "Organization subdomain is required.",
      });
      return;
    }

    req.subdomain = subdomain;
    next();
  } catch (error) {
    console.error("Subdomain extraction error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process organization.",
    });
  }
};

/**
 * Organization Validation Middleware
 * Validates that the organization exists and is active
 */
export const validateOrganization = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const subdomain = req.subdomain;

    if (!subdomain) {
      // Allow requests without subdomain for specific routes
      const publicRoutes = ["/health", "/api/organizations/register"];
      if (publicRoutes.some((route) => req.path.startsWith(route))) {
        return next();
      }

      res.status(400).json({
        success: false,
        error: "Organization subdomain is required.",
      });
      return;
    }

    // Find organization by subdomain
    const organization = await Organization.findOne({ subdomain });

    if (!organization) {
      res.status(404).json({
        success: false,
        error: "Organization not found.",
      });
      return;
    }

    // Check if organization is active
    if (organization.status === "SUSPENDED") {
      res.status(403).json({
        success: false,
        error: "This organization has been suspended. Contact support.",
      });
      return;
    }

    // Attach organization ID to request
    req.organizationId = organization._id.toString();
    next();
  } catch (error) {
    console.error("Organization validation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to validate organization.",
    });
  }
};

/**
 * Organization Isolation Middleware
 * Ensures user can only access their own organization's data
 */
export const enforceOrganizationIsolation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({
        success: false,
        error: "Authentication required.",
      });
      return;
    }

    // Verify user belongs to the organization
    if (req.user.organizationId !== req.organizationId) {
      res.status(403).json({
        success: false,
        error: "Access denied. You do not belong to this organization.",
      });
      return;
    }

    next();
  } catch (error) {
    console.error("Organization isolation error:", error);
    res.status(500).json({
      success: false,
      error: "Access validation failed.",
    });
  }
};

export default {
  extractSubdomain,
  validateOrganization,
  enforceOrganizationIsolation,
};
