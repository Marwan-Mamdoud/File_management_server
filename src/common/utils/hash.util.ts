import bcrypt from 'bcrypt'

const PASSWORD_ROUNDS = 12
const OTP_ROUNDS = 10

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, PASSWORD_ROUNDS)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, OTP_ROUNDS)
}

export function verifyCodeHash(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash)
}
