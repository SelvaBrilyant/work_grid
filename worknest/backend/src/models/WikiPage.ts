import mongoose, { Document, Schema } from "mongoose";

export interface IWikiPageVersion {
  content: string;
  authorId: mongoose.Types.ObjectId;
  createdAt: Date;
  summary?: string;
}

export interface IWikiPage extends Document {
  title: string;
  slug: string;
  content: string;
  channelId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  lastEditedBy: mongoose.Types.ObjectId;
  parentId?: mongoose.Types.ObjectId; // For nested pages
  order: number;
  versions: IWikiPageVersion[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const wikiPageVersionSchema = new Schema<IWikiPageVersion>(
  {
    content: {
      type: String,
      required: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    summary: {
      type: String,
      maxlength: [200, "Version summary cannot exceed 200 characters"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const wikiPageSchema = new Schema<IWikiPage>(
  {
    title: {
      type: String,
      required: [true, "Page title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    content: {
      type: String,
      default: "",
    },
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
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastEditedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "WikiPage",
    },
    order: {
      type: Number,
      default: 0,
    },
    versions: [wikiPageVersionSchema],
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient fetching
wikiPageSchema.index({ channelId: 1, slug: 1 }, { unique: true });
wikiPageSchema.index({ channelId: 1, parentId: 1, order: 1 });

export default mongoose.model<IWikiPage>("WikiPage", wikiPageSchema);
