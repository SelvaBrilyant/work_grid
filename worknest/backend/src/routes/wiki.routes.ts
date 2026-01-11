import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  getChannelWikiPages,
  getWikiPage,
  createWikiPage,
  updateWikiPage,
  deleteWikiPage,
  getWikiPageVersions,
  restoreWikiPageVersion,
  reorderWikiPages,
} from "../controllers/wiki.controller.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all wiki pages for a channel
router.get("/channel/:channelId", getChannelWikiPages);

// Get a single wiki page by slug
router.get("/channel/:channelId/:slug", getWikiPage);

// Create a new wiki page
router.post("/channel/:channelId", createWikiPage);

// Update a wiki page
router.patch("/channel/:channelId/:slug", updateWikiPage);

// Delete a wiki page
router.delete("/channel/:channelId/:slug", deleteWikiPage);

// Get version history
router.get("/channel/:channelId/:slug/versions", getWikiPageVersions);

// Restore a specific version
router.post(
  "/channel/:channelId/:slug/versions/:versionId/restore",
  restoreWikiPageVersion
);

// Reorder pages
router.post("/channel/:channelId/reorder", reorderWikiPages);

export default router;
