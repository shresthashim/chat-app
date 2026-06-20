import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().min(1, "Enter your username or email"),
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z
  .object({
    displayName: z.string().trim().max(50).optional(),
    username: z
      .string()
      .trim()
      .min(3, "At least 3 characters")
      .max(20, "At most 20 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscores only"),
    email: z.string().trim().email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(50),
  statusText: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(280).optional(),
});

export const groupSchema = z.object({
  name: z.string().trim().min(1, "Name your group").max(60),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ProfileValues = z.infer<typeof profileSchema>;
