import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().min(1),
  CLOUDINARY_NAME: z.string().min(1),
  CLOUDINARY_KEY: z.string().min(1),
  CLOUDINARY_SECRET: z.string().min(1),
  SENDGRID_API_KEY: z.string().min(1),
  SENDGRID_FROM_EMAIL: z.string().email(),
  SENDGRID_FROM_NAME: z.string().min(1),
  ADMIN_EMAIL: z.email(),
  ADMIN_NAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(8),
  CORS_ORIGINS: z
    .string()
    .min(1, 'At least one allowed origin is required')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter((origin) => origin.length > 0),
    )
    .refine((origins) => origins.every((origin) => /^https?:\/\/[^\s]+$/.test(origin)), {
      message: 'CORS_ORIGINS entries must be http(s) origins separated by commas',
    }),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
