import { User } from "../../models/User.js";
import { ApiError } from "../../utils/ApiError.js";
import type { UpdateProfileInput } from "./users.validation.js";

export async function getUserById(id: string) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

/**
 * Search users by username/displayName. Uses a case-insensitive prefix-ish
 * regex which works well for the typeahead "start a chat" flow.
 */
export async function searchUsers(query: string, excludeId: string, limit: number) {
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(safe, "i");
  return User.find({
    _id: { $ne: excludeId },
    $or: [{ username: regex }, { displayName: regex }],
  })
    .limit(limit)
    .sort({ username: 1 });
}

export async function updateProfile(id: string, input: UpdateProfileInput) {
  const user = await User.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound("User not found");
  return user;
}
