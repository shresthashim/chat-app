import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/auth.middleware.js";
import * as controller from "./uploads.controller.js";

// Keep files in memory and stream straight to Cloudinary; cap at 1MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 },
});

const router = Router();

router.post("/", requireAuth, upload.single("file"), controller.upload);

export default router;
