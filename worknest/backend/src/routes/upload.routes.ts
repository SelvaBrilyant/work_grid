import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { AuthenticatedRequest } from "../types/index.js";
import { UnauthorizedError } from "../utils/AppError.js";
import fs from "fs";

const router = Router();

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only images, PDFs, Word, Excel, and text files are allowed."
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter,
});

/**
 * @route   POST /api/uploads
 * @desc    Upload a file
 * @access  Private
 */
router.post(
  "/",
  (req: AuthenticatedRequest, res: Response, next) => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required."));
    }
    next();
  },
  upload.single("file"),
  (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    // Construct URL - in prod this would be S3 or similar
    // For dev, we'll use the local path
    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      data: {
        url: fileUrl,
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
      },
    });
  }
);

export default router;
