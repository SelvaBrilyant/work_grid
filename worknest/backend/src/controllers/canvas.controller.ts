import { Request, Response } from "express";
import { Canvas } from "../models/Canvas.js";

export const getCanvas = async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const organizationId = (req as any).orgId;

    let canvas = await Canvas.findOne({ channelId, organizationId });

    if (!canvas) {
      // Create empty canvas if it doesn't exist
      canvas = await Canvas.create({
        channelId,
        organizationId,
        elements: [],
        updatedBy: (req as any).userId,
      });
    }

    res.json({ success: true, data: canvas });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCanvas = async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { elements } = req.body;
    const organizationId = (req as any).orgId;
    const userId = (req as any).userId;

    const canvas = await Canvas.findOneAndUpdate(
      { channelId, organizationId },
      {
        elements,
        updatedBy: userId,
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: canvas });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
