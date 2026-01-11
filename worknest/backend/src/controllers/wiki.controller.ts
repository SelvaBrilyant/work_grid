import { Request, Response } from "express";
import { WikiPage, ChannelMember } from "../models/index.js";

// Helper to generate slug from title
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

// Get all wiki pages for a channel
export const getChannelWikiPages = async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const userId = (req as any).user.userId;

    // Check membership
    const isMember = await ChannelMember.findOne({ channelId, userId });
    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this channel" });
    }

    const pages = await WikiPage.find({ channelId, isPublished: true })
      .select("title slug parentId order updatedAt lastEditedBy")
      .populate("lastEditedBy", "name avatar")
      .sort({ parentId: 1, order: 1 });

    res.json(pages);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single wiki page by slug
export const getWikiPage = async (req: Request, res: Response) => {
  try {
    const { channelId, slug } = req.params;
    const userId = (req as any).user.userId;

    // Check membership
    const isMember = await ChannelMember.findOne({ channelId, userId });
    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this channel" });
    }

    const page = await WikiPage.findOne({ channelId, slug })
      .populate("authorId", "name avatar")
      .populate("lastEditedBy", "name avatar");

    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    res.json(page);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new wiki page
export const createWikiPage = async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { title, content, parentId } = req.body;
    const userId = (req as any).user.userId;
    const organizationId = (req as any).user.organizationId;

    // Check membership
    const isMember = await ChannelMember.findOne({ channelId, userId });
    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this channel" });
    }

    // Generate slug
    let slug = generateSlug(title);

    // Check for duplicate slug and make unique
    const existingPage = await WikiPage.findOne({ channelId, slug });
    if (existingPage) {
      slug = `${slug}-${Date.now()}`;
    }

    // Get order for new page
    const lastPage = await WikiPage.findOne({
      channelId,
      parentId: parentId || null,
    }).sort({ order: -1 });
    const order = lastPage ? lastPage.order + 1 : 0;

    const page = await WikiPage.create({
      title,
      slug,
      content: content || "",
      channelId,
      organizationId,
      authorId: userId,
      lastEditedBy: userId,
      parentId: parentId || null,
      order,
      versions: [
        {
          content: content || "",
          authorId: userId,
          summary: "Initial version",
        },
      ],
    });

    const populatedPage = await page.populate([
      { path: "authorId", select: "name avatar" },
      { path: "lastEditedBy", select: "name avatar" },
    ]);

    res.status(201).json(populatedPage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Update a wiki page
export const updateWikiPage = async (req: Request, res: Response) => {
  try {
    const { channelId, slug } = req.params;
    const { title, content, versionSummary } = req.body;
    const userId = (req as any).user.userId;

    // Check membership
    const isMember = await ChannelMember.findOne({ channelId, userId });
    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this channel" });
    }

    const page = await WikiPage.findOne({ channelId, slug });
    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    // Add current content to versions before updating
    if (content !== undefined && content !== page.content) {
      page.versions.push({
        content: page.content,
        authorId: page.lastEditedBy,
        summary: versionSummary || `Updated by user`,
        createdAt: new Date(),
      });
    }

    // Update fields
    if (title !== undefined) {
      page.title = title;
      // Update slug only if title changed significantly
      const newSlug = generateSlug(title);
      if (newSlug !== page.slug) {
        const existingPage = await WikiPage.findOne({
          channelId,
          slug: newSlug,
          _id: { $ne: page._id },
        });
        if (!existingPage) {
          page.slug = newSlug;
        }
      }
    }
    if (content !== undefined) {
      page.content = content;
    }
    page.lastEditedBy = userId;

    await page.save();

    const updatedPage = await WikiPage.findById(page._id)
      .populate("authorId", "name avatar")
      .populate("lastEditedBy", "name avatar");

    res.json(updatedPage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a wiki page
export const deleteWikiPage = async (req: Request, res: Response) => {
  try {
    const { channelId, slug } = req.params;
    const userId = (req as any).user.userId;

    // Check membership
    const isMember = await ChannelMember.findOne({ channelId, userId });
    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this channel" });
    }

    const page = await WikiPage.findOne({ channelId, slug });
    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    // Check if page has children
    const hasChildren = await WikiPage.exists({ parentId: page._id });
    if (hasChildren) {
      return res.status(400).json({
        message: "Cannot delete page with child pages. Delete children first.",
      });
    }

    await WikiPage.findByIdAndDelete(page._id);
    res.json({ message: "Page deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get version history for a page
export const getWikiPageVersions = async (req: Request, res: Response) => {
  try {
    const { channelId, slug } = req.params;
    const userId = (req as any).user.userId;

    // Check membership
    const isMember = await ChannelMember.findOne({ channelId, userId });
    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this channel" });
    }

    const page = await WikiPage.findOne({ channelId, slug })
      .select("title versions")
      .populate("versions.authorId", "name avatar");

    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    // Return versions in reverse chronological order
    const versions = [...page.versions].reverse();
    res.json({ title: page.title, versions });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Restore a specific version
export const restoreWikiPageVersion = async (req: Request, res: Response) => {
  try {
    const { channelId, slug, versionId } = req.params;
    const userId = (req as any).user.userId;

    // Check membership
    const isMember = await ChannelMember.findOne({ channelId, userId });
    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this channel" });
    }

    const page = await WikiPage.findOne({ channelId, slug });
    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    const version = page.versions.find(
      (v: any) => v._id?.toString() === versionId
    );
    if (!version) {
      return res.status(404).json({ message: "Version not found" });
    }

    // Save current content as a new version
    page.versions.push({
      content: page.content,
      authorId: page.lastEditedBy,
      summary: "Before restore",
      createdAt: new Date(),
    });

    // Restore the selected version
    page.content = version.content;
    page.lastEditedBy = userId;
    await page.save();

    const updatedPage = await WikiPage.findById(page._id)
      .populate("authorId", "name avatar")
      .populate("lastEditedBy", "name avatar");

    res.json(updatedPage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Reorder pages
export const reorderWikiPages = async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { pages } = req.body; // Array of { id, parentId, order }
    const userId = (req as any).user.userId;

    // Check membership
    const isMember = await ChannelMember.findOne({ channelId, userId });
    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this channel" });
    }

    // Update each page
    await Promise.all(
      pages.map((p: { id: string; parentId: string | null; order: number }) =>
        WikiPage.findByIdAndUpdate(p.id, {
          parentId: p.parentId || null,
          order: p.order,
        })
      )
    );

    res.json({ message: "Pages reordered successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
