import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from "mongoose";

/**
 * A participant entry tracks per-user read state so we can compute unread
 * counts and read receipts without scanning every message.
 */
const participantSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["member", "admin"], default: "member" },
    joinedAt: { type: Date, default: () => new Date() },
    // Last message this participant has read, for receipts / unread counts.
    lastReadAt: { type: Date, default: null },
    lastReadMessage: { type: Schema.Types.ObjectId, ref: "Message", default: null },
    // Per-user mute toggle for notifications.
    muted: { type: Boolean, default: false },
  },
  { _id: false },
);

const conversationSchema = new Schema(
  {
    type: { type: String, enum: ["direct", "group"], required: true },
    participants: {
      type: [participantSchema],
      validate: [(v: unknown[]) => v.length >= 1, "A conversation needs at least 1 participant"],
    },
    // Group-only metadata.
    name: { type: String, trim: true, maxlength: 60, default: "" },
    description: { type: String, maxlength: 280, default: "" },
    avatarUrl: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    // Deterministic key (sorted participant ids) enforcing one direct chat per pair.
    directKey: { type: String, default: undefined },
    // Denormalized for fast conversation-list ordering and previews.
    lastMessage: { type: Schema.Types.ObjectId, ref: "Message", default: null },
    lastMessageAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, returnValue) {
        const ret = returnValue as Record<string, any>;
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// One direct conversation per unique pair of users.
conversationSchema.index({ directKey: 1 }, { unique: true, sparse: true });
// Fast lookup of a user's conversations ordered by recent activity.
conversationSchema.index({ "participants.user": 1, lastMessageAt: -1 });

/** Build the deterministic direct-conversation key from two user ids. */
export function buildDirectKey(a: string | Types.ObjectId, b: string | Types.ObjectId): string {
  return [a.toString(), b.toString()].sort().join(":");
}

export type ConversationDoc = HydratedDocument<InferSchemaType<typeof conversationSchema>> & {
  createdAt: Date;
  updatedAt: Date;
};

export const Conversation = model("Conversation", conversationSchema);
