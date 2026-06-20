import { v2 as cloudinary } from "cloudinary";
import { env, isUploadsEnabled } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";

if (isUploadsEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

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
export function uploadFile(file: Express.Multer.File): Promise<UploadResult> {
  if (!isUploadsEnabled) {
    throw new ApiError(501, "File uploads are not configured on this server");
  }

  const isImage = file.mimetype.startsWith("image/");

  return new Promise<UploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "chathub", resource_type: isImage ? "image" : "auto" },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Upload failed"));
        resolve({
          url: result.secure_url,
          type: isImage ? "image" : "file",
          name: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          width: result.width,
          height: result.height,
        });
      },
    );
    stream.end(file.buffer);
  });
}
