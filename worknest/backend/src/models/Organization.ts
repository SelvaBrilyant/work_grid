import mongoose, { Document, Schema, Model } from "mongoose";
import { OrganizationStatus, OrganizationPlan } from "../types/index.js";

export interface IOrganization extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  subdomain: string;
  status: OrganizationStatus;
  plan: OrganizationPlan;
  logo?: string;
  settings?: {
    allowPublicChannels: boolean;
    maxChannels: number;
    maxMembers: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      minlength: [2, "Organization name must be at least 2 characters"],
      maxlength: [100, "Organization name cannot exceed 100 characters"],
    },
    subdomain: {
      type: String,
      required: [true, "Subdomain is required"],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, "Subdomain must be at least 3 characters"],
      maxlength: [50, "Subdomain cannot exceed 50 characters"],
      match: [
        /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
        "Subdomain can only contain lowercase letters, numbers, and hyphens",
      ],
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED"],
      default: "ACTIVE",
    },
    plan: {
      type: String,
      enum: ["FREE", "PRO", "ENTERPRISE"],
      default: "FREE",
    },
    logo: {
      type: String,
      default: null,
    },
    settings: {
      allowPublicChannels: { type: Boolean, default: true },
      maxChannels: { type: Number, default: 50 },
      maxMembers: { type: Number, default: 100 },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
organizationSchema.index({ status: 1 });

// Static method to find by subdomain
organizationSchema.statics.findBySubdomain = function (subdomain: string) {
  return this.findOne({ subdomain: subdomain.toLowerCase() });
};

export interface IOrganizationModel extends Model<IOrganization> {
  findBySubdomain(subdomain: string): Promise<IOrganization | null>;
}

const Organization = mongoose.model<IOrganization, IOrganizationModel>(
  "Organization",
  organizationSchema
);

export default Organization;
