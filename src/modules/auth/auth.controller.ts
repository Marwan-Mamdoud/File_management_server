import type { Request, Response } from 'express'
import * as authService from './auth.service.js'

// Controllers are intentionally thin: parse request → call service → format
// response. Validation happens in validate.middleware; errors are forwarded to
// the central errorHandler by Express 5's native async rejection handling.

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body as { name: string; email: string; password: string }
  const user = await authService.register(name, email, password)
  res.status(201).json({
    message: 'Account created. A verification code has been sent to your email.',
    user,
  })
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { email, code } = req.body as { email: string; code: string }
  const user = await authService.verifyEmail(email, code)
  res.json({ message: 'Email verified successfully', user })
}

export async function resendCode(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string }
  await authService.resendCode(email)
  res.status(202).json({
    message: 'If that email belongs to an unverified account, a new code has been sent.',
  })
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string }
  const { user, token } = await authService.login(email, password)
  res.json({ message: 'Logged in successfully', user, token })
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string }
  await authService.forgotPassword(email)
  res.json({
    message: 'If that email exists, a password reset code has been sent.',
  })
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { email, code, newPassword } = req.body as { email: string; code: string; newPassword: string }
  const user = await authService.resetPassword(email, code, newPassword)
  res.json({ message: 'Password reset successfully', user })
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string }
  const user = await authService.changePassword(userId, currentPassword, newPassword)
  res.json({ message: 'Password changed successfully', user })
}

export async function profile(req: Request, res: Response): Promise<void> {
  const user = await authService.getProfile(req.user!.userId)
  res.json({ user })
}
