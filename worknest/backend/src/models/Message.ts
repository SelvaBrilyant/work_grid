import mongoose, { Document, Schema, Model } from "mongoose";
import { ContentType } from "../types/index.js";

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  channelId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  contentType: ContentType;
  attachments?: {
    url: string;
    name: string;
    type: string;
    size: number;
  }[];
  replyTo?: mongoose.Types.ObjectId;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  isPinned: boolean;
  pinnedAt?: Date;
  pinnedBy?: mongoose.Types.ObjectId;
  reactions?: Map<string, mongoose.Types.ObjectId[]>;
  readBy: {
    userId: mongoose.Types.ObjectId;
    readAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization ID is required"],
      index: true,
    },
    channelId: {
      type: Schema.Types.ObjectId,
      ref: "Channel",
      required: [true, "Channel ID is required"],
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender ID is required"],
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
      maxlength: [4000, "Message cannot exceed 4000 characters"],
    },
    contentType: {
      type: String,
      enum: ["TEXT", "FILE", "SYSTEM"],
      default: "TEXT",
    },
    attachments: [
      {
        url: String,
        name: String,
        type: String,
        size: Number,
      },
    ],
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedAt: {
      type: Date,
      default: null,
    },
    pinnedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reactions: {
      type: Map,
      of: [Schema.Types.ObjectId],
      default: new Map(),
    },
    readBy: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Critical index for message retrieval - optimized for pagination
messageSchema.index({ channelId: 1, createdAt: -1 });
messageSchema.index({ organizationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });

// Virtual for sender info
messageSchema.virtual("sender", {
  ref: "User",
  localField: "senderId",
  foreignField: "_id",
  justOne: true,
});

// Static method to get channel messages with pagination
messageSchema.statics.getChannelMessages = async function (
  channelId: string,
  options: { limit?: number; before?: Date; after?: Date } = {}
): Promise<IMessage[]> {
  const { limit = 50, before, after } = options;

  const query: Record<string, unknown> = {
    channelId,
    isDeleted: false,
  };

  if (before) {
    query.createdAt = { $lt: before };
  } else if (after) {
    query.createdAt = { $gt: after };
  }

  return this.find(query)
    .populate("senderId", "name email avatar")
    .populate("replyTo")
    .sort({ createdAt: -1 })
    .limit(limit);
};

export interface IMessageModel extends Model<IMessage> {
  getChannelMessages(
    channelId: string,
    options?: { limit?: number; before?: Date; after?: Date }
  ): Promise<IMessage[]>;
}

const Message = mongoose.model<IMessage, IMessageModel>(
  "Message",
  messageSchema
);

export default Message;
