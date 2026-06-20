import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { uploadFile } from "./uploads.service.js";

export const upload = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("No file provided");
  const attachment = await uploadFile(req.file);
  sendSuccess(res, { attachment }, 201, "File uploaded");
});
