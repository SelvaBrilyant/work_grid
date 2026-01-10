import mongoose, { Document, Schema, Model } from "mongoose";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "../types/index.js";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  tokenVersion: number;
  invitationToken?: string;
  invitationExpires?: Date;
  lastSeenAt: Date;
  statusMessage?: string;
  settings?: {
    preferences: {
      language: string;
      timezone: string;
      theme: "light" | "dark" | "system";
    };
    notifications: {
      messages: boolean;
      mentions: boolean;
      email: boolean;
    };
    privacy: {
      showOnlineStatus: boolean;
      readReceipts: boolean;
      lastSeenVisibility: "everyone" | "contacts" | "none";
    };
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization ID is required"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    passwordHash: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't include in queries by default
    },
    role: {
      type: String,
      enum: ["ADMIN", "EMPLOYEE"],
      default: "EMPLOYEE",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INVITED", "BLOCKED"],
      default: "ACTIVE",
    },
    avatar: {
      type: String,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    invitationToken: {
      type: String,
      default: null,
      select: false,
    },
    invitationExpires: {
      type: Date,
      default: null,
      select: false,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    statusMessage: {
      type: String,
      maxlength: [100, "Status message cannot exceed 100 characters"],
      default: null,
    },
    settings: {
      preferences: {
        language: { type: String, default: "en" },
        timezone: { type: String, default: "UTC" },
        theme: {
          type: String,
          enum: ["light", "dark", "system"],
          default: "system",
        },
      },
      notifications: {
        messages: { type: Boolean, default: true },
        mentions: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
      },
      privacy: {
        showOnlineStatus: { type: Boolean, default: true },
        readReceipts: { type: Boolean, default: true },
        lastSeenVisibility: {
          type: String,
          enum: ["everyone", "contacts", "none"],
          default: "everyone",
        },
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Compound unique index for email within organization
userSchema.index({ organizationId: 1, email: 1 }, { unique: true });
userSchema.index({ organizationId: 1, status: 1 });
userSchema.index({ organizationId: 1, role: 1 });

// Pre-save hook to hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Static method to find by email within organization
userSchema.statics.findByEmail = function (
  organizationId: string,
  email: string
) {
  return this.findOne({ organizationId, email: email.toLowerCase() }).select(
    "+passwordHash"
  );
};

export interface IUserModel extends Model<IUser> {
  findByEmail(organizationId: string, email: string): Promise<IUser | null>;
}

const User = mongoose.model<IUser, IUserModel>("User", userSchema);

export default User;
