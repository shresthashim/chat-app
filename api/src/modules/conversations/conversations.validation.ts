import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const conversationIdParamSchema = z.object({ id: objectId });
export const memberParamSchema = z.object({ id: objectId, memberId: objectId });

export const createDirectSchema = z.object({
  userId: objectId,
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(60),
  memberIds: z.array(objectId).min(1, "Add at least one member").max(200),
  avatarUrl: z.string().url().max(500).optional().or(z.literal("")),
});

export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    description: z.string().trim().max(280).optional(),
    avatarUrl: z.string().url().max(500).optional().or(z.literal("")),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nothing to update" });

export const membersSchema = z.object({
  memberIds: z.array(objectId).min(1).max(200),
});

export const markReadSchema = z.object({
  messageId: objectId.optional(),
});
