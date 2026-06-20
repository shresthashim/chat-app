import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  v2 as cloudinary,
  type UploadApiOptions,
  type UploadApiResponse,
} from "cloudinary";
import { env, isUploadsEnabled } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";

if (isUploadsEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const UPLOAD_FOLDER = "chathub";

export interface UploadResult {
  url: string;
  type: "image" | "file";
  name: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
}

/** Upload a buffer to Cloudinary and normalize the result for a message attachment. */
export async function uploadFile(file: Express.Multer.File): Promise<UploadResult> {
  if (!isUploadsEnabled) {
    throw new ApiError(501, "File uploads are not configured on this server");
  }

  const isImage = file.mimetype.startsWith("image/");

  // Images use the image pipeline (transformable). Everything else uses "raw":
  // Cloudinary's "auto" classifies PDFs/ZIPs as images, and image-pipeline
  // delivery of those is blocked by default (401 "deny or ACL failure"). Raw
  // serves the bytes as-is; we keep the original extension for correct content-type.
  const options: UploadApiOptions = isImage
    ? { folder: UPLOAD_FOLDER, resource_type: "image" }
    : { folder: UPLOAD_FOLDER, resource_type: "raw", public_id: buildRawPublicId(file.originalname) };

  let result: UploadApiResponse;
  try {
    result = await uploadBuffer(file.buffer, options);
  } catch (err) {
    logger.error({ err, name: file.originalname }, "Cloudinary upload failed");
    throw new ApiError(502, "Upload failed. Please try again.");
  }

  return {
    url: result.secure_url,
    type: isImage ? "image" : "file",
    name: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
    width: result.width,
    height: result.height,
  };
}

/** Stream a buffer to Cloudinary, resolving with the upload response. */
function uploadBuffer(buffer: Buffer, options: UploadApiOptions): Promise<UploadApiResponse> {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      if (!result) return reject(new Error("Empty Cloudinary upload response"));
      resolve(result);
    });
    stream.end(buffer);
  });
}

/**
 * Build a stable, collision-resistant public_id for a raw upload that keeps the
 * original extension — e.g. "Q3 Report.pdf" -> "Q3_Report_1a2b3c4d.pdf".
 */
function buildRawPublicId(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const base =
    path
      .basename(originalName, path.extname(originalName))
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "file";
  return `${base}_${randomBytes(4).toString("hex")}${ext}`;
}
