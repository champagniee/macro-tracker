import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(60, "Name is too long"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const updateNameSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(60, "Name is too long"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
