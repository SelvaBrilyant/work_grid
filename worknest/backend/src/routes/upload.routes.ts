import { Router, Response } from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import { AuthenticatedRequest } from "../types/index.js";
import { UnauthorizedError, BadRequestError } from "../utils/AppError.js";

const router = Router();

// Configure Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    console.log(
      `Cloudinary storage params for: ${file.originalname} (${file.mimetype})`
    );
    const isImage = file.mimetype.startsWith("image/");
    const isVideo = file.mimetype.startsWith("video/");

    let folder = "worknest/others";
    let resource_type = "auto";

    if (isImage) {
      folder = "worknest/images";
      resource_type = "image";
    } else if (isVideo) {
      folder = "worknest/videos";
      resource_type = "video";
    } else if (
      file.mimetype === "application/pdf" ||
      file.mimetype.includes("msword") ||
      file.mimetype.includes("officedocument")
    ) {
      folder = "worknest/docs";
      resource_type = "raw";
    }

    return {
      folder: folder,
      resource_type: resource_type,
      public_id: `${Date.now()}-${file.originalname.split(".")[0]}`,
    };
  },
});

// File filter
const fileFilter = (req: any, file: any, cb: any) => {
  const isImage = file.mimetype.startsWith("image/");
  const isVideo = file.mimetype.startsWith("video/");
  const isDoc = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
  ].includes(file.mimetype);

  if (isImage || isVideo || isDoc) {
    cb(null, true);
  } else {
    console.warn(`File upload rejected. Unallowed MIME type: ${file.mimetype}`);
    cb(
      new Error(
        "Invalid file type. Allowed types: Images, Videos, PDFs, Word, Excel, PowerPoint, and text files."
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB (increased for videos)
  },
  fileFilter,
});

/**
 * @route   POST /api/uploads
 * @desc    Upload a file to Cloudinary
 * @access  Private
 */
router.post("/", (req: AuthenticatedRequest, res: Response, next) => {
  if (!req.user) {
    return next(new UnauthorizedError("Authentication required."));
  }

  upload.single("file")(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return next(new BadRequestError(`Upload error: ${err.message}`));
      }
      return next(err);
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    // req.file.path will contain the Cloudinary URL
    const fileUrl = req.file.path;

    res.json({
      success: true,
      data: {
        url: fileUrl,
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
        public_id: (req.file as any).filename, // Cloudinary public_id
      },
    });
  });
});

export default router;
