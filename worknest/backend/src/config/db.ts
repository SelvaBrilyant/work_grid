import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/worknest";

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI, {
      // Connection options for MongoDB Atlas stability
      retryWrites: true,
      retryReads: true,
      serverSelectionTimeoutMS: 10000, // 10 seconds to select server
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      maxPoolSize: 10,
      minPoolSize: 2,
    });
    console.log("✅ MongoDB connected successfully");

    // Handle connection events
    mongoose.connection.on("error", (error) => {
      console.error("❌ MongoDB connection error:", error);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("MongoDB connection closed through app termination");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error);
    process.exit(1);
  }
};

export default mongoose;
