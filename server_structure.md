# File Management System — Backend Build Brief

---

## 1. The Task (Original Assessment)

> Build a complete Managing Your Files system, including both frontend and backend, using modern TypeScript technologies.

**Required Stack**

- Backend: Express.js, TypeScript, Prisma ORM, PostgreSQL, JWT Authentication, Multer

**Auth**

- Registration, Login, JWT, Email Verification (OTP), Resend Verification Code, Profile, Password hashing, Protected Routes, Role-based Authorization (User/Admin)

**User Features**

- Upload files (drag & drop, progress, validation, multiple files)
- List files (search, filter, sort, pagination)
- File details (metadata, type, size, upload date, extracted content)
- Stats dashboard (total files, storage usage, file types, upload history)

**Admin Features**

- User management (view, search, edit roles, delete)
- Files management (view all, delete, search, filter, pagination)
- Admin dashboard (total users, total files, storage usage, most uploaded types, recent uploads)
- Admin-only access enforced on backend (and frontend later)

**Suggested Endpoints**

```
POST   /auth/register
POST   /auth/login
POST   /auth/verify-email
POST   /auth/resend-code
GET    /auth/profile

GET    /users
PATCH  /users/:id
DELETE /users/:id

POST   /files/upload
GET    /files
GET    /files/:id
DELETE /files/:id

GET    /stats/user
GET    /stats/admin
```

**Suggested Prisma Models**: User, VerificationCode, File (extendable)

**Bonus (optional)**: Dark mode (frontend), folder management, file preview, download, soft delete, audit logs, refresh tokens, Docker, unit testing.

**Evaluation Criteria**: code quality, architecture, TypeScript usage, API design, auth & authorization, database design, error handling, best practices.

---

## 2. Prompt for the AI Agent (opencode)

```
You are building the BACKEND ONLY of a File Management System. Do not touch
or scaffold any frontend code in this phase. Follow this brief exactly —
where it doesn't specify something, make the most conventional, production-
grade choice for an Express + TypeScript + Prisma backend and state the
assumption in a comment.

## Stack
- Express.js + TypeScript
- Prisma ORM + PostgreSQL
- JWT for authentication (access token; do NOT implement refresh tokens
  unless asked later)
- Multer with MEMORY storage only (memoryStorage()) — never diskStorage.
  This backend will be deployed to Render/Vercel where the filesystem is
  ephemeral or read-only, so files must never be written to local disk,
  even temporarily.
- Cloudinary as the file storage provider (resource_type: 'auto', using
  upload_stream with the in-memory buffer).
- SendGrid for transactional emails (OTP codes, password reset).
- bcrypt for password hashing.
- express-validator or zod for input validation.

## Non-negotiable architecture rules
1. Layered architecture: routes -> controllers -> services -> Prisma
   (repositories only if a service's queries get complex enough to
   warrant extraction). Controllers must be thin: parse request, call
   service, format response. All business logic lives in services.
2. Central error handling middleware. Services throw typed custom errors
   (e.g. NotFoundError, ForbiddenError, ValidationError); a single
   errorHandler middleware maps them to HTTP status codes. No
   try/catch-and-send scattered across controllers.
3. File metadata (size, mimeType) must be trusted ONLY from what the
   backend itself derives from the uploaded buffer (req.file.size,
   and mimeType verified via the `file-type` package's magic-byte
   detection — never trust the client-reported MIME type or extension).
4. File content extraction is a separate, pluggable service
   (Strategy pattern): one extractor per mime-type family (PDF, DOCX,
   XLSX/CSV, plain text, images). A dispatcher service picks the right
   extractor by mimeType. Unsupported types return
   { content: null, metadata: {} } gracefully — never throw.
5. Upload flow per file must do these in this order, using the SAME
   buffer for both branches:
   a. Validate (mime allow-list, size limit, e.g. 15MB) — reject before
      any I/O if invalid.
   b. Run extraction service on the buffer.
   c. Upload the buffer to Cloudinary.
   d. Persist one File row containing: original name, verified mimeType,
      size, Cloudinary url + public_id, extractedContent,
      extractedMetadata (Json), extractionStatus, uploadedById.
   Extraction and Cloudinary upload MAY run in parallel
   (Promise.all) since both only need the buffer.
6. Auth: JWT payload must carry { userId, role } only (no PII). Two
   middlewares: `authenticate` (verifies JWT, attaches req.user) and
   `authorize(...roles)` (checks req.user.role). Every admin route uses
   both middlewares. Never trust a role claim from the request body.
7. OTP flow: 6-digit numeric code, stored hashed in a VerificationCode
   table with an expiresAt (e.g. 10 min) and a purpose enum
   (EMAIL_VERIFY | PASSWORD_RESET) so the same table serves both OTP
   and forgot-password flows. Resending invalidates the previous code
   for that purpose instead of stacking multiple valid codes.
8. Passwords: bcrypt hash on write, never returned in any API response
   (use a Prisma select or a DTO mapper to strip the field — do not
   rely on manually deleting it from objects ad hoc).
9. Every list endpoint (files, users) must support pagination
   (page/limit or cursor), search (by name), filter (by type, date
   range, size range), and sort (by field + direction) via query
   params, implemented through a single reusable query-builder
   helper — do not hand-roll Prisma `where` objects separately in
   each controller.
10. Stats endpoints are read-only aggregations (Prisma `aggregate`/
    `groupBy`), computed on demand — no caching layer needed at this
    stage.
11. Environment variables required: DATABASE_URL, JWT_SECRET,
    JWT_EXPIRES_IN, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET, SENDGRID_API_KEY, SENDGRID_FROM_EMAIL,
    SENDGRID_FROM_NAME, ADMIN_EMAIL, ADMIN_NAME,
    ADMIN_PASSWORD, PORT. Never hardcode any secret. Provide a
    .env.example with placeholder values only.
12. Seed script creates one ADMIN user from the ADMIN_* env vars on
    first run (idempotent — skip if it already exists).

## Deliverable for this phase
Build the backend feature-by-feature in this order, and stop after each
numbered step so I can review before you continue:
1. Prisma schema (all models below) + migration + seed script
2. Auth module: register, verify-email (OTP), resend-code, login,
   forgot-password, reset-password, change-password, profile,
   auth/role middleware
3. File extraction service (pluggable extractors: pdf-parse, mammoth,
   xlsx, plain text; sharp for image dimensions)
4. File upload endpoint (multer memory -> extract -> Cloudinary -> save)
5. File listing: GET /files with search + filter + sort + pagination,
   GET /files/:id, PATCH /files/:id (rename), DELETE /files/:id
6. Stats endpoints: GET /stats/user, GET /stats/admin
7. Admin user management: GET /users, PATCH /users/:id, DELETE /users/:id
   (all guarded by authorize('ADMIN'))

Do not generate any frontend files, Docker files, or tests unless I
explicitly ask for them in a later step.
```

---

## 3. Structure

### Folder Structure

```
server/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── config/
│   │   ├── env.ts                 # validated env loader
│   │   ├── cloudinary.config.ts
│   │   └── email.config.ts
│   ├── middlewares/
│   │   ├── authenticate.middleware.ts
│   │   ├── authorize.middleware.ts
│   │   ├── validate.middleware.ts
│   │   └── error.middleware.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.dto.ts
│   │   │   └── otp.service.ts
│   │   ├── users/
│   │   │   ├── users.routes.ts
│   │   │   ├── users.controller.ts
│   │   │   └── users.service.ts
│   │   ├── files/
│   │   │   ├── files.routes.ts
│   │   │   ├── files.controller.ts
│   │   │   ├── files.service.ts
│   │   │   ├── upload.service.ts          # Cloudinary upload logic
│   │   │   ├── query-builder.ts           # search/filter/sort/pagination
│   │   │   └── extraction/
│   │   │       ├── extraction.service.ts  # dispatcher
│   │   │       └── extractors/
│   │   │           ├── pdf.extractor.ts
│   │   │           ├── docx.extractor.ts
│   │   │           ├── spreadsheet.extractor.ts
│   │   │           ├── text.extractor.ts
│   │   │           └── image.extractor.ts
│   │   └── stats/
│   │       ├── stats.routes.ts
│   │       ├── stats.controller.ts
│   │       └── stats.service.ts
│   ├── common/
│   │   ├── errors/
│   │   │   └── app-error.ts               # NotFoundError, ForbiddenError, etc.
│   │   ├── utils/
│   │   │   ├── jwt.util.ts
│   │   │   ├── hash.util.ts
│   │   │   └── mime.util.ts               # file-type magic-byte check
│   │   └── types/
│   │       └── express.d.ts               # req.user typing
│   ├── app.ts                             # express app, middleware wiring
│   └── server.ts                          # entrypoint
├── .env.example
├── package.json
└── tsconfig.json
```

### Prisma Schema (core)

```prisma
enum Role {
  USER
  ADMIN
}

enum ExtractionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum OtpPurpose {
  EMAIL_VERIFY
  PASSWORD_RESET
}

model User {
  id            String   @id @default(uuid())
  name          String
  email         String   @unique
  password      String
  role          Role     @default(USER)
  isVerified    Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  files         File[]
  verifications VerificationCode[]
}

model VerificationCode {
  id        String     @id @default(uuid())
  codeHash  String
  purpose   OtpPurpose
  expiresAt DateTime
  consumed  Boolean    @default(false)
  createdAt DateTime   @default(now())

  userId    String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, purpose])
}

model File {
  id                String            @id @default(uuid())
  filename          String
  mimeType          String
  size              Int

  url               String
  storageKey        String

  extractedContent  String?           @db.Text
  extractedMetadata Json?
  extractionStatus  ExtractionStatus  @default(PENDING)

  uploadedById      String
  uploadedBy        User              @relation(fields: [uploadedById], references: [id], onDelete: Cascade)

  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@index([uploadedById])
  @@index([mimeType])
  @@index([createdAt])
}
```

### Request Flow (upload)

```
Client (multipart/form-data)
  → Multer (memoryStorage) — buffer in RAM, no disk write
  → validate.middleware (mime allow-list + size limit)
  → files.controller.upload
      ├─→ extraction.service.extract(buffer, mimeType)   ┐
      └─→ upload.service.uploadToCloudinary(buffer)      ┘ Promise.all
  → prisma.file.create({ ...both results })
  → 201 response
```

### Route Guard Pattern

```
router.get('/users', authenticate, authorize('ADMIN'), usersController.list);
```
