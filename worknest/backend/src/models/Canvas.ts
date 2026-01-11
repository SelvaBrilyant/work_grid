import mongoose, { Schema, Document } from "mongoose";

export interface ICanvasElement {
  id: string;
  type: "pencil" | "rectangle" | "ellipse" | "arrow" | "text";
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[]; // For pencil
  text?: string;
  color: string;
  strokeWidth: number;
  createdBy: string;
}

export interface ICanvas extends Document {
  channelId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  elements: ICanvasElement[];
  updatedBy: mongoose.Types.ObjectId;
  updatedAt: Date;
}

const CanvasElementSchema = new Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ["pencil", "rectangle", "ellipse", "arrow", "text"],
    required: true,
  },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number },
  height: { type: Number },
  points: [{ x: Number, y: Number }],
  text: { type: String },
  color: { type: String, default: "#000000" },
  strokeWidth: { type: Number, default: 2 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
});

const CanvasSchema = new Schema(
  {
    channelId: {
      type: Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    elements: [CanvasElementSchema],
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Ensure one canvas per channel
CanvasSchema.index({ channelId: 1 }, { unique: true });

export const Canvas = mongoose.model<ICanvas>("Canvas", CanvasSchema);
