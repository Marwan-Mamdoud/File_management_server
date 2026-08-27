import { randomInt } from 'node:crypto'
import { env } from '../../config/env.js'
import { sendOtpEmail } from '../../config/email.config.js'
import { prisma } from '../../config/db.js'
import { OtpPurpose } from '../../generated/prisma/client.js'
import { hashCode, verifyCodeHash } from '../../common/utils/hash.util.js'
import { ValidationError } from '../../common/errors/app-error.js'

const OTP_TTL_MINUTES = 10
const INVALID_CODE_MESSAGE = 'Invalid or expired verification code'

export interface IssuedOtp {
  expiresAt: Date
}

// Assumption: email delivery is awaited inline; a Resend outage surfaces as a
// 502 so the client can retry registration/resend instead of silently losing codes.
export async function issueOtp(userId: string, purpose: OtpPurpose, email: string): Promise<IssuedOtp> {
  const code = randomInt(100_000, 1_000_000).toString()
  const codeHash = await hashCode(code)
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000)

  await prisma.$transaction([
    prisma.verificationCode.updateMany({
      where: { userId, purpose, consumed: false },
      data: { consumed: true },
    }),
    prisma.verificationCode.create({
      data: { userId, purpose, codeHash, expiresAt },
    }),
  ])

  await sendOtpEmail(email, code, purpose, OTP_TTL_MINUTES)

  if (env.NODE_ENV !== 'production') {
    // Dev-only convenience: codes are bcrypt-hashed at rest and unrecoverable otherwise.
    console.log(`[dev-only] OTP for ${email} (${purpose}): ${code}`)
  }

  return { expiresAt }
}

export async function consumeOtp(userId: string, purpose: OtpPurpose, code: string): Promise<void> {
  const record = await prisma.verificationCode.findFirst({
    where: { userId, purpose, consumed: false },
    orderBy: { createdAt: 'desc' },
  })

  if (!record || record.expiresAt < new Date()) {
    throw new ValidationError(INVALID_CODE_MESSAGE)
  }

  const matches = await verifyCodeHash(code, record.codeHash)

  if (!matches) {
    throw new ValidationError(INVALID_CODE_MESSAGE)
  }

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { consumed: true },
  })
}
