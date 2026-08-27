// Self-contained landing page served at GET / — inline CSS, zero external
// requests, so it renders identically locally and inside a Vercel lambda.
export const landingPageHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>File Management System API</title>
<style>
  :root { --bg:#0b1020; --card:#141a2f; --line:#232c4d; --text:#e6e9f5; --muted:#8b93b5; --accent:#6ea8fe; --green:#34d399; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background:radial-gradient(1200px 600px at 20% -10%, #1a2347 0%, var(--bg) 55%); color:var(--text); min-height:100vh; padding:48px 20px; }
  .wrap { max-width:960px; margin:0 auto; }
  header { text-align:center; margin-bottom:40px; }
  h1 { font-size:2rem; letter-spacing:-.02em; }
  h1 span { color:var(--accent); }
  .subtitle { color:var(--muted); margin-top:10px; font-size:.95rem; line-height:1.6; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px; margin-bottom:40px; }
  a.card { display:block; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:24px; text-decoration:none; color:var(--text); transition:transform .15s ease, border-color .15s ease; }
  a.card:hover { transform:translateY(-3px); border-color:var(--accent); }
  .card .icon { font-size:1.6rem; margin-bottom:12px; }
  .card h2 { font-size:1.05rem; margin-bottom:6px; }
  .card p { color:var(--muted); font-size:.85rem; line-height:1.5; }
  .card .url { display:inline-block; margin-top:12px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.75rem; color:var(--accent); background:#0e1428; border:1px solid var(--line); border-radius:6px; padding:4px 8px; }
  section.table-block { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:24px; margin-bottom:16px; }
  section.table-block h3 { font-size:.95rem; margin-bottom:14px; color:var(--accent); text-transform:uppercase; letter-spacing:.06em; }
  table { width:100%; border-collapse:collapse; font-size:.82rem; }
  th { text-align:left; color:var(--muted); font-weight:600; padding:8px 10px; border-bottom:1px solid var(--line); }
  td { padding:8px 10px; border-bottom:1px solid rgba(35,44,77,.5); vertical-align:top; }
  tr:last-child td { border-bottom:none; }
  code.m { font-family:ui-monospace,Menlo,monospace; font-size:.72rem; font-weight:700; padding:2px 7px; border-radius:5px; white-space:nowrap; }
  .get  { color:#34d399; background:rgba(52,211,153,.12); }
  .post { color:#6ea8fe; background:rgba(110,168,254,.12); }
  .patch{ color:#fbbf24; background:rgba(251,191,36,.12); }
  .del  { color:#f87171; background:rgba(248,113,113,.12); }
  code.path { font-family:ui-monospace,Menlo,monospace; color:var(--text); }
  .lock { color:var(--muted); font-size:.75rem; }
  footer { text-align:center; color:var(--muted); font-size:.78rem; margin-top:32px; line-height:1.7; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>📁 File Management System <span>API</span></h1>
    <p class="subtitle">Express 5 · TypeScript · Prisma · PostgreSQL · Cloudinary · JWT auth with email-verification OTPs<br/>All authenticated routes use <code style="font-family:monospace">Authorization: Bearer &lt;token&gt;</code></p>
  </header>

  <div class="cards">
    <a class="card" href="/health">
      <div class="icon">💚</div>
      <h2>Health Check</h2>
      <p>Quick liveness probe for the running service.</p>
      <span class="url">GET /health</span>
    </a>
    <a class="card" href="/api-docs">
      <div class="icon">📚</div>
      <h2>Swagger Docs</h2>
      <p>Browse and try every endpoint interactively.</p>
      <span class="url">GET /api-docs</span>
    </a>
    <a class="card" href="/openapi.json">
      <div class="icon">🧾</div>
      <h2>OpenAPI Spec (JSON)</h2>
      <p>Raw OpenAPI 3.0 document — import into Postman or any tool.</p>
      <span class="url">GET /openapi.json</span>
    </a>
  </div>

  <section class="table-block">
    <h3>Auth</h3>
    <table>
      <tr><th>Method</th><th>Path</th><th>Auth</th><th>Purpose</th></tr>
      <tr><td><code class="m post">POST</code></td><td><code class="path">/auth/register</code></td><td class="lock">—</td><td>Create account, send verification OTP</td></tr>
      <tr><td><code class="m post">POST</code></td><td><code class="path">/auth/verify-email</code></td><td class="lock">—</td><td>Verify email with 6-digit code</td></tr>
      <tr><td><code class="m post">POST</code></td><td><code class="path">/auth/resend-code</code></td><td class="lock">—</td><td>Resend verification code (generic response)</td></tr>
      <tr><td><code class="m post">POST</code></td><td><code class="path">/auth/login</code></td><td class="lock">—</td><td>Get JWT access token</td></tr>
      <tr><td><code class="m post">POST</code></td><td><code class="path">/auth/forgot-password</code></td><td class="lock">—</td><td>Request password-reset OTP</td></tr>
      <tr><td><code class="m post">POST</code></td><td><code class="path">/auth/reset-password</code></td><td class="lock">—</td><td>Reset password with OTP</td></tr>
      <tr><td><code class="m post">POST</code></td><td><code class="path">/auth/change-password</code></td><td class="lock">Bearer</td><td>Change own password</td></tr>
      <tr><td><code class="m get">GET</code></td><td><code class="path">/auth/profile</code></td><td class="lock">Bearer</td><td>Own profile</td></tr>
    </table>
  </section>

  <section class="table-block">
    <h3>Files</h3>
    <table>
      <tr><th>Method</th><th>Path</th><th>Auth</th><th>Purpose</th></tr>
      <tr><td><code class="m post">POST</code></td><td><code class="path">/files/upload</code></td><td class="lock">Bearer</td><td>Multipart upload → extract ∥ Cloudinary → persist (≤4MB total · up to 10 files)</td></tr>
      <tr><td><code class="m get">GET</code></td><td><code class="path">/files</code></td><td class="lock">Bearer</td><td>List with search / type / date / size filters, sort, pagination</td></tr>
      <tr><td><code class="m get">GET</code></td><td><code class="path">/files/:id</code></td><td class="lock">Bearer</td><td>File detail incl. extracted content</td></tr>
      <tr><td><code class="m patch">PATCH</code></td><td><code class="path">/files/:id</code></td><td class="lock">Bearer</td><td>Rename</td></tr>
      <tr><td><code class="m del">DELETE</code></td><td><code class="path">/files/:id</code></td><td class="lock">Bearer</td><td>Delete row + best-effort storage cleanup</td></tr>
    </table>
  </section>

  <section class="table-block">
    <h3>Stats &amp; Admin Users</h3>
    <table>
      <tr><th>Method</th><th>Path</th><th>Auth</th><th>Purpose</th></tr>
      <tr><td><code class="m get">GET</code></td><td><code class="path">/stats/user</code></td><td class="lock">Bearer</td><td>Totals, per-type breakdown, 14-day upload history</td></tr>
      <tr><td><code class="m get">GET</code></td><td><code class="path">/stats/admin</code></td><td class="lock">Admin</td><td>Platform totals, top types, recent uploads</td></tr>
      <tr><td><code class="m get">GET</code></td><td><code class="path">/users</code></td><td class="lock">Admin</td><td>User list w/ search, filters, sort, pagination</td></tr>
      <tr><td><code class="m patch">PATCH</code></td><td><code class="path">/users/:id</code></td><td class="lock">Admin</td><td>Edit role / name / verified status</td></tr>
      <tr><td><code class="m del">DELETE</code></td><td><code class="path">/users/:id</code></td><td class="lock">Admin</td><td>Delete user (+ cascade files)</td></tr>
    </table>
  </section>

  <footer>
    Built with Express 5 (ESM) · Prisma ORM · PostgreSQL (Neon) · Cloudinary · Resend<br/>
    OpenAPI 3.0.3 spec served at <a href="/openapi.json" style="color:var(--accent)">/openapi.json</a>
  </footer>
</div>
</body>
</html>`
