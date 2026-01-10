import mongoose, { Document, Schema, Model } from "mongoose";
import { ChannelMemberRole } from "../types/index.js";

export interface IChannelMember extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  channelId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: ChannelMemberRole;
  lastReadAt?: Date;
  unreadCount: number;
  notifications: boolean;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const channelMemberSchema = new Schema<IChannelMember>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization ID is required"],
    },
    channelId: {
      type: Schema.Types.ObjectId,
      ref: "Channel",
      required: [true, "Channel ID is required"],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    role: {
      type: String,
      enum: ["ADMIN", "MEMBER"],
      default: "MEMBER",
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
    unreadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    notifications: {
      type: Boolean,
      default: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound unique index to prevent duplicate memberships
channelMemberSchema.index({ channelId: 1, userId: 1 }, { unique: true });
channelMemberSchema.index({ userId: 1 });
channelMemberSchema.index({ organizationId: 1 });
channelMemberSchema.index({ channelId: 1 });

// Static method to check membership
channelMemberSchema.statics.isMember = async function (
  channelId: string,
  userId: string
): Promise<boolean> {
  const membership = await this.findOne({ channelId, userId });
  return !!membership;
};

// Static method to get user's channels
channelMemberSchema.statics.getUserChannels = async function (
  organizationId: string,
  userId: string
): Promise<IChannelMember[]> {
  return this.find({ organizationId, userId })
    .populate("channelId")
    .sort({ updatedAt: -1 });
};

// Static method to get channel members
channelMemberSchema.statics.getChannelMembers = async function (
  channelId: string
): Promise<IChannelMember[]> {
  return this.find({ channelId })
    .populate("userId", "name email avatar status lastSeenAt")
    .sort({ joinedAt: 1 });
};

export interface IChannelMemberModel extends Model<IChannelMember> {
  isMember(channelId: string, userId: string): Promise<boolean>;
  getUserChannels(
    organizationId: string,
    userId: string
  ): Promise<IChannelMember[]>;
  getChannelMembers(channelId: string): Promise<IChannelMember[]>;
}

const ChannelMember = mongoose.model<IChannelMember, IChannelMemberModel>(
  "ChannelMember",
  channelMemberSchema
);

export default ChannelMember;
