import mongoose, { Document, Schema, Model } from "mongoose";
import { ChannelType } from "../types/index.js";

export interface IChannel extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  type: ChannelType;
  createdBy: mongoose.Types.ObjectId;
  dmParticipants?: mongoose.Types.ObjectId[]; // For DM channels
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const channelSchema = new Schema<IChannel>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization ID is required"],
    },
    name: {
      type: String,
      required: [true, "Channel name is required"],
      trim: true,
      minlength: [1, "Channel name must be at least 1 character"],
      maxlength: [100, "Channel name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    type: {
      type: String,
      enum: ["PUBLIC", "PRIVATE", "DM"],
      default: "PUBLIC",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
    },
    dmParticipants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for optimal query performance
channelSchema.index({ organizationId: 1, type: 1 });
channelSchema.index({ organizationId: 1, name: 1 });
channelSchema.index({ organizationId: 1, lastMessageAt: -1 });
channelSchema.index({ dmParticipants: 1 }); // For finding DM channels

// Virtual for member count (populated via ChannelMember)
channelSchema.virtual("members", {
  ref: "ChannelMember",
  localField: "_id",
  foreignField: "channelId",
});

// Static method to find or create DM channel
channelSchema.statics.findOrCreateDM = async function (
  organizationId: string,
  participants: string[]
): Promise<IChannel> {
  // Sort participants to ensure consistent lookup
  const sortedParticipants = participants.sort();

  let channel = await this.findOne({
    organizationId,
    type: "DM",
    dmParticipants: { $all: sortedParticipants, $size: 2 },
  });

  if (!channel) {
    channel = await this.create({
      organizationId,
      name: "Direct Message",
      type: "DM",
      createdBy: sortedParticipants[0],
      dmParticipants: sortedParticipants,
    });
  }

  return channel;
};

export interface IChannelModel extends Model<IChannel> {
  findOrCreateDM(
    organizationId: string,
    participants: string[]
  ): Promise<IChannel>;
}

const Channel = mongoose.model<IChannel, IChannelModel>(
  "Channel",
  channelSchema
);

export default Channel;
