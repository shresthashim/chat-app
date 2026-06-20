import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { ApiError } from "../../utils/ApiError.js";
import { UPLOAD } from "../../config/constants.js";
import * as controller from "./uploads.controller.js";

const allowedTypes = new Set<string>(UPLOAD.ALLOWED_MIME_TYPES);

// Buffer the file in memory and stream it straight to Cloudinary (no temp files).
// Size and type are validated up front so bad uploads never reach the service.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD.MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (allowedTypes.has(file.mimetype)) return cb(null, true);
    cb(new ApiError(415, `Unsupported file type: ${file.mimetype}`));
  },
});

const router = Router();

router.post("/", requireAuth, upload.single("file"), controller.upload);

export default router;
