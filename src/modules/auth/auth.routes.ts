import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import * as authController from './auth.controller.js'
import {
  changePasswordDto,
  forgotPasswordDto,
  loginDto,
  registerDto,
  resendCodeDto,
  resetPasswordDto,
  verifyEmailDto,
} from './auth.dto.js'

export const authRoutes = Router()

authRoutes.post('/register', validate(registerDto), authController.register)
authRoutes.post('/verify-email', validate(verifyEmailDto), authController.verifyEmail)
authRoutes.post('/resend-code', validate(resendCodeDto), authController.resendCode)
authRoutes.post('/login', validate(loginDto), authController.login)
authRoutes.post('/forgot-password', validate(forgotPasswordDto), authController.forgotPassword)
authRoutes.post('/reset-password', validate(resetPasswordDto), authController.resetPassword)
authRoutes.post('/change-password', authenticate, validate(changePasswordDto), authController.changePassword)
authRoutes.get('/profile', authenticate, authController.profile)
