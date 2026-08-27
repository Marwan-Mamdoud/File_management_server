import { z } from 'zod'

// Shared fields -------------------------------------------------------------
const emailField = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .pipe(z.email({ message: 'Must be a valid email address' }))

const nameField = z.string().trim().min(1, 'Name is required').max(100)

const passwordField = z.string().min(8, 'Password must be at least 8 characters').max(72)

const codeField = z.string().trim().regex(/^\d{6}$/, 'Code must be a 6-digit number')

// DTOs ----------------------------------------------------------------------
export const registerDto = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
})

export const loginDto = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
})

export const verifyEmailDto = z.object({
  email: emailField,
  code: codeField,
})

export const resendCodeDto = z.object({
  email: emailField,
})

export const forgotPasswordDto = z.object({
  email: emailField,
})

export const resetPasswordDto = z.object({
  email: emailField,
  code: codeField,
  newPassword: passwordField,
})

export const changePasswordDto = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordField,
})
