# File Management System — Server

Backend for a complete file management system: **JWT auth with email-verification OTPs**, file uploads with automatic **content extraction** and **Cloudinary storage**, per-user dashboards, admin statistics, and admin user management.

| Explore in browser | Path |
|---|---|
| 🏠 Landing page (this service's home) | [`/`](#) |
| 💚 Health check | [`GET /health`](#) |
| 📚 Interactive Swagger UI | [`/api-docs`](#) |
| 🧾 OpenAPI 3.0 spec (raw JSON) | [`/openapi.json`](#) |

---

## Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js 24 · **ESM only** (`import`/`export`) |
| Framework | Express 5 (native async-rejection forwarding) |
| Language | TypeScript (strict, NodeNext) |
| ORM / DB | Prisma 7 + PostgreSQL ([Neon](https://neon.tech)) via `@prisma/adapter-pg` driver adapter |
| Auth | JWT (`jsonwebtoken`), bcrypt password hashing |
| Validation | zod (env vars + every request body/query) |
| Uploads | Multer **memoryStorage only** — files never touch disk |
| File storage | Cloudinary (`resource_type: 'auto'`, streamed from memory) |
| Email | SendGrid `@sendgrid/mail` (transactional OTP emails) |
| Extraction | pdf-parse v2, mammoth, SheetJS (xlsx), sharp, file-type |

## Architecture

Layered: **routes → controllers → services → Prisma**. Controllers are thin (parse → call service → format response); all business logic lives in services; a single central error handler maps typed errors to HTTP responses.

```
src/
├── config/          env.ts (zod-validated), db.ts, cloudinary.config.ts,
│                    email.config.ts, docs.config.ts, landing.page.ts
├── common/
│   ├── errors/      AppError + NotFoundError / UnauthorizedError / ForbiddenError /
│   │                ConflictError / ValidationError
│   └── utils/       jwt.util, hash.util, mime.util (magic-byte detection)
├── middlewares/     authenticate · authorize(...roles) · validate(zod) · errorHandler
└── modules/
    ├── auth/        routes · controller · service · dto · otp.service
    ├── files/       routes · controller · service · upload.service · query-builder · dto
    │   ├── files-admin.routes · files-admin.controller   (admin-only file management)
    │   └── extraction/   extraction.service (dispatcher) + extractors/{pdf,docx,spreadsheet,text,image}
    ├── stats/       routes · controller · service
    └── users/       routes · controller · service · dto
api/index.ts         Vercel entrypoint (same app)
openapi.json         OpenAPI 3.0.3 spec (single source of truth for docs)
```

### Upload pipeline (per file)

```
multipart "files" (up to 10 per request)
→ multer memoryStorage (batch total ≤4MB — reject before any I/O)
→ authenticate (JWT)
→ derive truth from content ONLY:
     size ← req.file.size          mime ← magic bytes (file-type)
            fallback OLE2 signature (.xls) or UTF-8 text sniffing (txt/csv)
→ allow-list check (per file)
→ Promise.all over files: each → [ extractFile(buffer) ∥ uploadToCloudinary(buffer) ]
→ persist one File row per valid file (url + publicId + extracted metadata + status)
→ 201 all ok · 207 partial · 400/502 when nothing persisted
```

Each file in a batch is processed **independently**: one failure never blocks the rest. The response always carries `summary {total, uploaded, failed}` plus a per-file `results[]` where every entry is either the created `FileDto` or a typed `{ code, message }` error.

Extraction failure ≠ request failure: the row is still persisted with `extractionStatus: FAILED` and the error captured in `extractedMetadata`. A Cloudinary failure marks that one file failed while siblings still upload.

---

## Features & Endpoints

### 🔐 Auth — `/auth`
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | — | Create unverified account, email a 6-digit OTP (10 min validity). Duplicate email → 409 |
| POST | `/auth/verify-email` | — | Consume OTP, set `isVerified = true` |
| POST | `/auth/resend-code` | — | Invalidate previous codes, send fresh one. Generic 202 (anti-enumeration) |
| POST | `/auth/login` | — | Return JWT `{ userId, role }` + user. 401 bad creds · 403 unverified |
| POST | `/auth/forgot-password` | — | Email PASSWORD_RESET OTP. Generic 200 always |
| POST | `/auth/reset-password` | — | Verify + consume OTP, replace password |
| POST | `/auth/change-password` | Bearer | Verify current password, apply new one |
| GET | `/auth/profile` | Bearer | Own public user object |

### 📁 Files — `/files`
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/files/upload` | Bearer | Multi-file multipart field `files` — up to 10 files, **batch total ≤4MB**. Allowed: PDF, DOCX, XLS, XLSX, CSV, TXT, JPEG, PNG, WEBP, GIF. Returns per-file results |
| GET | `/files` | Bearer | List own uploads. Query: `page, limit≤100, search, type, from, to, minSize, maxSize, sortBy, order` |
| GET | `/files/:id` | Bearer | Full detail incl. extracted content — owner or admin; others get indistinguishable 404 |
| PATCH | `/files/:id` | Bearer | Rename `{ filename }` — owner or admin |
| DELETE | `/files/:id` | Bearer | Hard delete + type-aware best-effort Cloudinary destroy — owner or admin |

List query details: `type` accepts exact MIME (`application/pdf`) or family (`image`, `image/*`); `sortBy ∈ {createdAt, updatedAt, size, filename, mimeType}`; invalid params → 400 with per-field details.

### 📁 Files (Admin) — `/files/admin` (every route: `authenticate` + `authorize('ADMIN')`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/files/admin/all` | List all files — every row includes `uploadedBy` owner object. Optional `?userId=<uuid>` narrows to one user. Supports the same pagination/search/filter/sort params as the regular list |
| GET | `/files/admin/:id` | Get any file by ID regardless of ownership, with owner data |
| PATCH | `/files/admin/:id` | Rename any file |
| DELETE | `/files/admin/:id` | Delete any file + best-effort Cloudinary destroy |

### 📊 Stats — `/stats` (read-only aggregations, computed on demand)
| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/stats/user` | Bearer | `totals{files, storageBytes}` · `fileTypes[]` (count + bytes per MIME) · `uploadHistory[]` — last 14 UTC days, zero-filled |
| GET | `/stats/admin` | Admin | `totals{users, files, storageBytes}` · top-5 `mostUploadedTypes` · last 10 `recentUploads` with uploader identity |

### 👥 Admin users — `/users` (every route: `authenticate` + `authorize('ADMIN')`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/users` | Paginated list. Search matches name OR email (ci); filters: `role`, `isVerified`, date range; sort whitelist `{createdAt, updatedAt, name, email}` |
| PATCH | `/users/:id` | Edit `role` / `name` / `isVerified` — at least one field required |
| DELETE | `/users/:id` | Delete user; owned File rows cascade, Cloudinary assets cleaned up best-effort |

**Admin safety guards**: no self-delete · no self-role-change · cannot demote/delete the *last remaining* ADMIN (409).

### 🧠 Content extraction (Strategy pattern)
| Family | Library | Produces |
|---|---|---|
| PDF | pdf-parse v2 | text (≤100k chars) + `pageCount` |
| DOCX | mammoth | raw text + `charCount` |
| XLSX / XLS / CSV | SheetJS | CSV per sheet + `sheetNames`, `rowCounts` |
| TXT | utf-8 decode | text + `lineCount`, `charCount` (POSIX line counting) |
| image/* | sharp | no text; `format`, `width`, `height` |

The dispatcher picks an extractor by the **derived** MIME type. Unsupported types (e.g. legacy `.doc`, ZIP) resolve gracefully to `{ content: null, metadata: {} }`; corrupt supported files mark the row `FAILED`.

Every stored row records how its MIME was derived: `extractedMetadata.mimeDetectionMethod ∈ {magic-bytes, ole2-signature, text-sniffing}` — useful for auditing/re-classification.

---

## Security model

- **JWT payload carries `{ userId, role }` only** — no PII; role never trusted from request bodies
- Passwords bcrypt-hashed (12 rounds) on write and stripped via a shared Prisma select — they never appear in any API response
- OTP codes: `crypto.randomInt` 6-digit, bcrypt-hashed at rest (10 rounds), 10-minute expiry, transactional invalidate-on-resend, consume-on-use
- Client-declared MIME types are never trusted — the real type is derived from bytes
- Anti-enumeration: generic responses for resend-code / forgot-password; foreign resources return 404 identical to missing ones
- All secrets via validated environment variables (zod schema fails fast at boot)
- CORS allow-list from `CORS_ORIGINS` — only listed frontend origins may call the API cross-origin; the API itself is stateless (Bearer tokens, no cookies)

## Error format

Every error uses one envelope; `details` appears only for validation failures:

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
| 401 | `UNAUTHORIZED` | missing/expired token, bad credentials, wrong current password |
| 403 | `FORBIDDEN` | non-admin on admin routes, unverified login, self-role/self-delete guards |
| 404 | `NOT_FOUND` | unknown id or resource you don't own |
| 409 | `CONFLICT` | duplicate email, last-admin protection, already-verified |
| 413 | `FILE_TOO_LARGE` | reserved — per-file oversize is now covered by the batch total guard (400) |
| 502 | `UPLOAD_FAILED`, `EMAIL_SEND_FAILED` | Cloudinary / SendGrid outage |
| 500 | `INTERNAL_SERVER_ERROR` | unexpected (logged server-side, never leaked) |

## Environment variables

Copy `.env.example` → `.env` and fill in. All are required unless marked optional.

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon **pooled** endpoint (runtime queries) |
| `DIRECT_DATABASE_URL` | Neon **direct** endpoint — used by migrations/shadow DB via `directUrl` |
| `JWT_SECRET` | ≥32 chars (`openssl rand -hex 48`) |
| `JWT_EXPIRES_IN` | e.g. `7d` |
| `CLOUDINARY_NAME` / `CLOUDINARY_KEY` / `CLOUDINARY_SECRET` | Storage credentials |
| `SENDGRID_API_KEY` | SendGrid API key for transactional email |
| `SENDGRID_FROM_EMAIL` | Sender email address (must be verified in SendGrid) |
| `SENDGRID_FROM_NAME` | Sender display name shown in inbox |
| `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` | Seeded admin account (idempotent seed, password ≥8 chars) |
| `PORT` | Local listen port |
| `NODE_ENV` | `development` default; OTPs are logged to console when not `production` |
| `CORS_ORIGINS` | Comma-separated allow-list of frontend origins, e.g. `http://localhost:3000,https://file-management-fe.vercel.app` |

## Scripts

| Command | Action |
|---|---|
| `npm run dev` | Dev server with watch (tsx) |
| `npm run build` / `start` | Compile to `dist/` / run compiled |
| `npm run typecheck` | Strict TS check, no emit |
| `npm run db:migrate` | `prisma migrate dev` (uses direct URL) |
| `npm run db:deploy` | `prisma migrate deploy` (CI/prod) |
| `npm run db:seed` | Idempotent admin creation from `ADMIN_*` vars |

## Deploying to Vercel

The repo is Vercel-ready: `api/index.ts` boots the same Express app, and `vercel.json` rewrites all traffic (`/(.*)` → the function) so **the landing page, Swagger UI, raw spec, and API all live under your deployment root**.

1. Push this folder to GitHub and import it in Vercel.
2. Set environment variables in the dashboard: everything from the table above (**use the pooled `DATABASE_URL`**; `PORT` is unnecessary).
3. `vercel-build` runs `prisma generate` automatically during deployment; the generated client is traced into the bundle.
4. Run migrations once against production from your machine: `DATABASE_URL=<direct-url> npm run db:deploy`, then `db:seed` if you want the admin there too.

**Platform limits to know:** Vercel caps serverless request bodies around **4.5 MB** — our app-level batch cap is deliberately set to **4 MB total**, so local behavior matches the deployed platform exactly. Functions are stateless/ephemeral (already fine — memory-only uploads), and long-running work should stay well inside function timeouts.

> Note: SendGrid requires a verified sender email or domain. Make sure `SENDGRID_FROM_EMAIL` is verified in your SendGrid account.
