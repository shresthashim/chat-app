import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: [/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers and underscores"],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    // Never selected by default — must be explicitly requested for auth.
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, trim: true, maxlength: 50, default: "" },
    avatarUrl: { type: String, default: "" },
    bio: { type: String, maxlength: 280, default: "" },
    // Free-text custom status, e.g. "Working from home".
    statusText: { type: String, maxlength: 100, default: "" },
    lastSeenAt: { type: Date, default: () => new Date() },
    // Incremented on "log out everywhere" to invalidate existing refresh tokens.
    tokenVersion: { type: Number, default: 0, select: false },
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
        delete ret.passwordHash;
        delete ret.tokenVersion;
        return ret;
      },
    },
  },
);

// Case-insensitive search across username and displayName.
userSchema.index({ username: "text", displayName: "text" });

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>> & {
  createdAt: Date;
  updatedAt: Date;
};

export const User = model("User", userSchema);
