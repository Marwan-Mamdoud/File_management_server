import type { Prisma } from "../../generated/prisma/client.js";
import { OtpPurpose } from "../../generated/prisma/client.js";
import { prisma } from "../../config/db.js";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from "../../common/errors/app-error.js";
import { hashPassword, verifyPassword } from "../../common/utils/hash.util.js";
import { signAccessToken } from "../../common/utils/jwt.util.js";
import { consumeOtp, issueOtp } from "./otp.service.js";

// Password is never part of any select used for API responses.
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

export interface LoginResult {
  user: PublicUser;
  token: string;
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    throw new ConflictError("Email is already registered");
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { name, email, password: passwordHash },
    select: publicUserSelect,
  });

  await issueOtp(user.id, OtpPurpose.EMAIL_VERIFY, email);

  return user;
}

export async function verifyEmail(
  email: string,
  code: string,
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: publicUserSelect,
  });

  if (!user) {
    throw new ValidationError("Invalid or expired verification code");
  }

  if (user.isVerified) {
    throw new ConflictError("Email is already verified");
  }

  await consumeOtp(user.id, OtpPurpose.EMAIL_VERIFY, code);

  return prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true },
    select: publicUserSelect,
  });
}

// Generic by design (anti-enumeration): identical response whether or not the
// account exists / is already verified.
export async function resendCode(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isVerified: true },
  });

  if (user && !user.isVerified) {
    await issueOtp(user.id, OtpPurpose.EMAIL_VERIFY, email);
  }
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const matches = await verifyPassword(password, user.password);

  if (!matches) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (!user.isVerified) {
    await issueOtp(user.id, OtpPurpose.EMAIL_VERIFY, email);
    throw new ForbiddenError("Please verify your email before logging in");
  }

  const safeUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: publicUserSelect,
  });

  if (!safeUser) {
    throw new NotFoundError("User not found");
  }

  const token = signAccessToken({ userId: safeUser.id, role: safeUser.role });

  return { user: safeUser, token };
}

// Generic by design (anti-enumeration).
export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (user) {
    await issueOtp(user.id, OtpPurpose.PASSWORD_RESET, email);
  }
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  // Same error as a bad OTP so unregistered emails are indistinguishable.
  if (!user) {
    throw new ValidationError("Invalid or expired verification code");
  }

  await consumeOtp(user.id, OtpPurpose.PASSWORD_RESET, code);

  const passwordHash = await hashPassword(newPassword);

  return prisma.user.update({
    where: { id: user.id },
    data: { password: passwordHash },
    select: publicUserSelect,
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  const matches = await verifyPassword(currentPassword, user.password);

  if (!matches) {
    throw new UnauthorizedError("Current password is incorrect");
  }

  const passwordHash = await hashPassword(newPassword);

  return prisma.user.update({
    where: { id: user.id },
    data: { password: passwordHash },
    select: publicUserSelect,
  });
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });

  if (!user) {
    // Token references a deleted user.
    throw new NotFoundError("User not found");
  }

  return user;
}
