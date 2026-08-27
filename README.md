<div align="center">

# File Management System — Server

**Backend API for a complete file management system**

JWT auth with email-verification OTPs · File uploads with automatic content extraction · Cloudinary storage · Per-user dashboards · Admin statistics · Admin user management

[![Node.js](https://img.shields.io/badge/Node.js-24-<%= c98b0f %>?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-5-<%= c98b0f %>?style=flat-square)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io)

</div>

## Demo Credentials

The following accounts are available for testing the application:

### Admin Account

- **Email:** admin@example.com
- **Password:** Admin123

### User Account

- **Email:** marwanmamdouh159@gmail.com
- **Password:** Marwan123

The Admin account provides access to the admin dashboard, user management, and file management features.

The User account provides access to the standard file management features.

---

## Quick Links

| Link | Path |
|---|---|
| Landing page | [`/`](http://localhost:8080/) |
| Health check | [`GET /health`](http://localhost:8080/health) |
| Interactive Swagger UI | [`/api-docs`](http://localhost:8080/api-docs) |
| OpenAPI 3.0 spec (JSON) | [`/openapi.json`](http://localhost:8080/openapi.json) |

---

## Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js 24 · **ESM only** |
| Framework | Express 5 (native async-rejection forwarding) |
| Language | TypeScript (strict, NodeNext) |
| ORM / DB | Prisma 7 + PostgreSQL ([Neon](https://neon.tech)) via `@prisma/adapter-pg` |
| Auth | JWT (`jsonwebtoken`), bcrypt password hashing |
| Validation | zod (env vars + every request body/query) |
| Uploads | Multer **memoryStorage only** — files never touch disk |
| File storage | Cloudinary (`resource_type: 'auto'`, streamed from memory) |
| Email | SendGrid `@sendgrid/mail` (transactional OTP emails) |
| Extraction | pdf-parse v2, mammoth, SheetJS (xlsx), sharp, file-type |

---

## Architecture

Layered: **routes → controllers → services → Prisma**. Controllers are thin; all business logic lives in services; a single central error handler maps typed errors to HTTP responses.

```
src/
├── config/          env.ts (zod-validated), db.ts, cloudinary.config.ts,
│                    email.config.ts, docs.config.ts, landing.page.ts
├── common/
│   ├── errors/      AppError + 5 subclasses
│   └── utils/       jwt.util, hash.util, mime.util (magic-byte detection)
├── middlewares/     authenticate · authorize(...roles) · validate(zod) · errorHandler
└── modules/
    ├── auth/        routes · controller · service · dto · otp.service
    ├── files/       routes · controller · service · upload.service · query-builder · dto
    │   ├── files-admin.routes · files-admin.controller   (admin-only)
    │   └── extraction/   extraction.service (dispatcher) + 5 extractors
    ├── stats/       routes · controller · service
    └── users/       routes · controller · service · dto
api/index.ts         Vercel entrypoint (same app)
openapi.json         OpenAPI 3.0.3 spec
```

---

## Endpoints (23 operations)

### Auth — `/auth`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | — | Create unverified account, email 6-digit OTP (10 min). Duplicate → 409 |
| POST | `/auth/verify-email` | — | Consume OTP, set `isVerified = true` |
| POST | `/auth/resend-code` | — | Invalidate previous codes, send fresh one. Generic 202 |
| POST | `/auth/login` | — | Return JWT `{ userId, role }` + user. 401 bad creds · 403 unverified |
| POST | `/auth/forgot-password` | — | Email PASSWORD_RESET OTP. Generic 200 always |
| POST | `/auth/reset-password` | — | Verify + consume OTP, replace password |
| POST | `/auth/change-password` | Bearer | Verify current password, apply new one |
| GET | `/auth/profile` | Bearer | Own public user object |

### Files — `/files`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/files/upload` | Bearer | Batch upload — up to 10 files, **total ≤4MB**. Allowed: PDF, DOCX, XLS, XLSX, CSV, TXT, JPEG, PNG, WEBP, GIF |
| GET | `/files` | Bearer | List own uploads. Query: `page, limit, search, type, from, to, minSize, maxSize, sortBy, order` |
| GET | `/files/:id` | Bearer | Full detail incl. extracted content — owner or admin |
| PATCH | `/files/:id` | Bearer | Rename `{ filename }` — owner or admin |
| DELETE | `/files/:id` | Bearer | Hard delete + Cloudinary cleanup — owner or admin |

### Files (Admin) — `/files/admin`

| Method | Path | Purpose |
|---|---|---|
| GET | `/files/admin/all` | List all files with `uploadedBy` owner data. `?userId` filter available |
| GET | `/files/admin/:id` | Get any file by ID with owner data |
| PATCH | `/files/admin/:id` | Rename any file |
| DELETE | `/files/admin/:id` | Delete any file + Cloudinary cleanup |

### Stats — `/stats`

| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/stats/user` | Bearer | Totals + per-MIME breakdown + 14-day upload history (zero-filled) |
| GET | `/stats/admin` | Admin | Platform totals + top 5 MIME types + 10 recent uploads with uploader |

### Users (Admin) — `/users`

| Method | Path | Purpose |
|---|---|---|
| GET | `/users` | Paginated list with search, role/verification filters, date range, sort |
| PATCH | `/users/:id` | Edit `role` / `name` / `isVerified` — at least one required |
| DELETE | `/users/:id` | Delete user + cascade files + Cloudinary cleanup |

---

## Upload Pipeline

```
multipart "files" (up to 10 per request)
→ multer memoryStorage (batch total ≤4MB)
→ authenticate (JWT)
→ derive MIME from content (magic bytes, OLE2, text sniffing)
→ allow-list check
→ Promise.all: [ extractFile(buffer) ∥ uploadToCloudinary(buffer) ]
→ persist File row (url + publicId + extracted metadata + status)
→ 201 all ok · 207 partial · 400/502 nothing persisted
```

Each file is processed **independently** — one failure never blocks the rest.

---

## Content Extraction

| Family | Library | Produces |
|---|---|---|
| PDF | pdf-parse v2 | text (≤100k chars) + `pageCount` |
| DOCX | mammoth | raw text + `charCount` |
| XLSX / XLS / CSV | SheetJS | CSV per sheet + `sheetNames`, `rowCounts` |
| TXT | utf-8 decode | text + `lineCount`, `charCount` |
| image/* | sharp | `format`, `width`, `height` |

Every row records `extractedMetadata.mimeDetectionMethod` for audit trail.

---

## Security

- JWT payload carries `{ userId, role }` only — no PII
- Passwords bcrypt-hashed (12 rounds), never returned in any response
- OTP codes: `crypto.randomInt` 6-digit, bcrypt-hashed at rest, 10-min expiry
- MIME types derived from bytes — never trusted from client
- Anti-enumeration: generic responses for resend-code / forgot-password
- All secrets via zod-validated env vars (fails fast at boot)
- CORS allow-list from `CORS_ORIGINS`

---

## Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [{ "path": "password", "message": "Password must be at least 8 characters" }]
  }
}
```

| Status | Codes | Typical cause |
|---|---|---|
| 400 | `VALIDATION_ERROR`, `MULTIPART_ERROR` | zod failures, malformed multipart |
| 401 | `UNAUTHORIZED` | missing/expired token, bad credentials |
| 403 | `FORBIDDEN` | non-admin on admin routes, unverified login |
| 404 | `NOT_FOUND` | unknown id or resource you don't own |
| 409 | `CONFLICT` | duplicate email, last-admin protection |
| 502 | `UPLOAD_FAILED`, `EMAIL_SEND_FAILED` | Cloudinary / SendGrid outage |
| 500 | `INTERNAL_SERVER_ERROR` | unexpected (logged server-side) |

---

## Environment Variables

Copy `.env.example` → `.env` and fill in:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon **pooled** endpoint |
| `DIRECT_DATABASE_URL` | Neon **direct** endpoint (migrations) |
| `JWT_SECRET` | ≥32 chars |
| `JWT_EXPIRES_IN` | e.g. `7d` |
| `CLOUDINARY_NAME` | Cloud storage name |
| `CLOUDINARY_KEY` | Cloud storage key |
| `CLOUDINARY_SECRET` | Cloud storage secret |
| `SENDGRID_API_KEY` | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | Verified sender email |
| `SENDGRID_FROM_NAME` | Sender display name |
| `ADMIN_EMAIL` | Seeded admin email |
| `ADMIN_NAME` | Seeded admin name |
| `ADMIN_PASSWORD` | Seeded admin password (≥8 chars) |
| `PORT` | Listen port (default: 8080) |
| `NODE_ENV` | `development` / `production` |
| `CORS_ORIGINS` | Comma-separated frontend origins |

---

## Scripts

| Command | Action |
|---|---|
| `npm run dev` | Dev server with watch (tsx) |
| `npm run build` / `start` | Compile to `dist/` / run compiled |
| `npm run typecheck` | Strict TS check, no emit |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` (CI/prod) |
| `npm run db:seed` | Idempotent admin creation |

---

## Deploy to Vercel

1. Push to GitHub and import in Vercel
2. Set all env vars in the dashboard (use pooled `DATABASE_URL`)
3. `vercel-build` runs `prisma generate` automatically
4. Run migrations: `DATABASE_URL=<direct-url> npm run db:deploy`

> Vercel caps request bodies at ~4.5 MB — our batch cap is **4 MB** so local matches deployed behavior.

---

## License

MIT
