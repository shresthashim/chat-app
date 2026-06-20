import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  // ISO timestamp cursor — fetch messages older than this.
  cursor: z.string().datetime().optional(),
});

const attachmentSchema = z.object({
  url: z.string().url(),
  type: z.enum(["image", "file"]),
  name: z.string().max(255).optional(),
  size: z.number().int().nonnegative().max(1 * 1024 * 1024, "Attachment must be 1 MB or smaller").optional(),
  mimeType: z.string().max(127).optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
}).refine((attachment) => {
  try {
    const url = new URL(attachment.url);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
}, "Attachment must be a Cloudinary URL");

export const sendMessageSchema = z
  .object({
    text: z.string().trim().max(4000).optional().default(""),
    attachments: z.array(attachmentSchema).max(10).optional().default([]),
    replyTo: objectId.optional(),
  })
  .refine((data) => data.text.length > 0 || data.attachments.length > 0, {
    message: "Message must contain text or an attachment",
  });

export const editMessageSchema = z.object({
  text: z.string().trim().min(1, "Message cannot be empty").max(4000),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(16),
});

export const searchMessagesSchema = z.object({
  q: z.string().trim().min(1, "Search query is required").max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const messageIdParamSchema = z.object({
  id: objectId,
  messageId: objectId,
});
