import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ["image", "file"], required: true },
    name: { type: String, default: "" },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: "" },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false },
);

const reactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true },
  },
  { _id: false },
);

const readReceiptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    readAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["text", "image", "file", "system"], default: "text" },
    text: { type: String, default: "", maxlength: 4000 },
    attachments: { type: [attachmentSchema], default: [] },
    // Threaded replies / quotes.
    replyTo: { type: Schema.Types.ObjectId, ref: "Message", default: null },
    reactions: { type: [reactionSchema], default: [] },
    readBy: { type: [readReceiptSchema], default: [] },
    editedAt: { type: Date, default: null },
    // Soft delete — preserves ordering/threads while hiding content.
    deletedAt: { type: Date, default: null },
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

// Primary access pattern: paginate a conversation newest-first.
messageSchema.index({ conversation: 1, createdAt: -1 });
// Full-text search within messages.
messageSchema.index({ text: "text" });

export type MessageDoc = HydratedDocument<InferSchemaType<typeof messageSchema>> & {
  createdAt: Date;
  updatedAt: Date;
};

export const Message = model("Message", messageSchema);
