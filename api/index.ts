import { createApp } from '../src/app.js'

// Vercel entrypoint: @vercel/node treats the exported Express app as the
// request handler. vercel.json rewrites every route here, so "/", /api-docs,
// /openapi.json and the API all behave exactly like local development.
const app = createApp()

export default app
