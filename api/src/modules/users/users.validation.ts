import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().trim().max(50).optional(),
  bio: z.string().trim().max(280).optional(),
  statusText: z.string().trim().max(100).optional(),
  avatarUrl: z.string().url().max(500).optional().or(z.literal("")),
});

export const searchUsersSchema = z.object({
  q: z.string().trim().min(1, "Search query is required").max(50),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const userIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user id"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
