import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { errorHandler } from './middlewares/error.middleware.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { filesRoutes } from './modules/files/files.routes.js'
import { filesAdminRoutes } from './modules/files/files-admin.routes.js'
import { statsRoutes } from './modules/stats/stats.routes.js'
import { usersRoutes } from './modules/users/users.routes.js'
import { openapiDocument } from './config/docs.config.js'
import { landingPageHtml } from './config/landing.page.js'

const swaggerHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>API Docs — Swagger UI</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/>
<style>
  body { margin:0; background:#fafafa; }
  .topbar { display:none; }
</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
  SwaggerUIBundle({
    url: '/openapi.json',
    dom_id: '#swagger-ui',
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
    layout: 'BaseLayout',
    deepLinking: true
  });
</script>
</body>
</html>`

export function createApp(): express.Express {
  const app = express()

  app.use(cors({ origin: env.CORS_ORIGINS }))

  app.use(express.json({ limit: '1mb' }))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // Landing page + docs — served by the same app so the root path works
  // identically locally and on Vercel.
  app.get('/', (_req, res) => {
    res.type('html').send(landingPageHtml)
  })
  app.get('/openapi.json', (_req, res) => {
    res.json(openapiDocument)
  })
  app.get('/api-docs', (_req, res) => {
    res.type('html').send(swaggerHtml)
  })

  app.use('/auth', authRoutes)
  app.use('/files/admin', filesAdminRoutes)
  app.use('/files', filesRoutes)
  app.use('/stats', statsRoutes)
  app.use('/users', usersRoutes)

  app.use(errorHandler)

  return app
}
