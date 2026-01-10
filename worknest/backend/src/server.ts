import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

import { connectDatabase } from "./config/db.js";
import { initializeSocket } from "./config/socket.js";
import { initializeChatSocket } from "./sockets/chat.socket.js";
import {
  authenticate,
  extractSubdomain,
  validateOrganization,
  enforceOrganizationIsolation,
  errorHandler,
  notFoundHandler,
} from "./middlewares/index.js";
import {
  authRoutes,
  channelRoutes,
  messageRoutes,
  userRoutes,
  uploadRoutes,
  settingsRoutes,
} from "./routes/index.js";

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = initializeSocket(httpServer);
initializeChatSocket(io);

// ============= MIDDLEWARE =============

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
        "http://localhost:5173",
      ];

      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Check if it's a subdomain of localhost:5173
      const isLocalSubdomain = /^http:\/\/([a-z0-9-]+\.)?localhost:5173$/.test(
        origin
      );
      if (isLocalSubdomain) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Organization-Subdomain",
      "X-Subdomain",
    ],
  })
);

// Body parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
  message: {
    success: false,
    error: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============= HEALTH CHECK =============
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "WorkNest API is healthy",
    timestamp: new Date().toISOString(),
  });
});

// ============= PUBLIC ROUTES =============

// Apply subdomain extraction to all routes
app.use(extractSubdomain);

// Organization registration (no auth needed)
app.use("/api/auth/register", authRoutes);

// Validate organization for all other routes
app.use(validateOrganization);

// Auth routes (login, activate - no auth needed but need org context)
app.use("/api/auth", authRoutes);

// ============= PROTECTED ROUTES =============

// Apply authentication middleware
app.use("/api", authenticate);

// Apply organization isolation
app.use("/api", enforceOrganizationIsolation);

// Channel routes
app.use("/api/channels", channelRoutes);

// Message routes
app.use("/api/messages", messageRoutes);

// User routes
app.use("/api/users", userRoutes);

// Settings routes
app.use("/api/settings", settingsRoutes);

// Upload routes
app.use("/api/uploads", uploadRoutes);

// Static files for uploads
app.use("/uploads", express.static("uploads"));

// ============= ERROR HANDLING =============

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============= START SERVER =============

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 WorkNest Server is running!                              ║
║                                                               ║
║   📡 HTTP Server:  http://localhost:${PORT}                    ║
║   🔌 Socket.IO:    ws://localhost:${PORT}                      ║
║   📊 Health:       http://localhost:${PORT}/health             ║
║                                                               ║
║   Environment: ${
        process.env.NODE_ENV || "development"
      }                              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

export { app, httpServer, io };
