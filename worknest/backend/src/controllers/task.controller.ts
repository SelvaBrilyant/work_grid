import { Request, Response } from "express";
import { Task, ChannelMember } from "../models/index.js";
import mongoose from "mongoose";

export const getChannelTasks = async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const userId = (req as any).user.id;

    // Check if user is member of the channel
    const isMember = await ChannelMember.findOne({
      channelId,
      userId,
    });

    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this channel" });
    }

    const tasks = await Task.find({ channelId })
      .populate("assigneeId", "name avatar")
      .populate("creatorId", "name avatar")
      .sort({ order: 1 });

    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createTask = async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const {
      title,
      description,
      status,
      priority,
      assigneeId,
      dueDate,
      labels,
    } = req.body;
    const userId = (req as any).user.id;
    const organizationId = (req as any).user.organizationId;

    // Check if user is member of the channel
    const isMember = await ChannelMember.findOne({
      channelId,
      userId,
    });

    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this channel" });
    }

    // Get the highest order to append to the end
    const lastTask = await Task.findOne({ channelId, status }).sort({
      order: -1,
    });
    const order = lastTask ? lastTask.order + 1 : 0;

    const task = await Task.create({
      title,
      description,
      status: status || "todo",
      priority: priority || "medium",
      channelId,
      organizationId,
      creatorId: userId,
      assigneeId,
      dueDate,
      labels: labels || [],
      order,
    });

    const populatedTask = await task.populate([
      { path: "assigneeId", select: "name avatar" },
      { path: "creatorId", select: "name avatar" },
    ]);

    res.status(201).json(populatedTask);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = (req as any).user.id;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Check if user is member of the channel
    const isMember = await ChannelMember.findOne({
      channelId: task.channelId,
      userId,
    });

    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this channel" });
    }

    // If status changed, we might want to recalculate order, but for simplicity we'll just move it to the end
    if (updates.status && updates.status !== task.status) {
      const lastTask = await Task.findOne({
        channelId: task.channelId,
        status: updates.status,
      }).sort({ order: -1 });
      updates.order = lastTask ? lastTask.order + 1 : 0;
    }

    const updatedTask = await Task.findByIdAndUpdate(id, updates, { new: true })
      .populate("assigneeId", "name avatar")
      .populate("creatorId", "name avatar");

    res.json(updatedTask);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Check if user is member of the channel
    const isMember = await ChannelMember.findOne({
      channelId: task.channelId,
      userId,
    });

    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this channel" });
    }

    await Task.findByIdAndDelete(id);

    res.json({ message: "Task deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateTaskOrder = async (req: Request, res: Response) => {
  try {
    const { tasks } = req.body; // Array of { id, status, order }

    const bulkOps = tasks.map((t: any) => ({
      updateOne: {
        filter: { _id: t.id },
        update: { $set: { status: t.status, order: t.order } },
      },
    }));

    await Task.bulkWrite(bulkOps);
    res.json({ message: "Task orders updated successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
