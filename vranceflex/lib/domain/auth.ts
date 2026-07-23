import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(254);

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128)
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: "Include at least one letter and one number.",
  });

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  organizationName: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;

export const otpVerificationSchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the six-digit code."),
});

export type OtpVerificationInput = z.infer<typeof otpVerificationSchema>;

export const signinSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export type SigninInput = z.infer<typeof signinSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = otpVerificationSchema.extend({
  password: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

export function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase("en-US");
}
