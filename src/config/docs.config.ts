import openapiDocument from '../../openapi.json' with { type: 'json' }

// Single source of truth: the spec lives only in openapi.json at the project
// root and is imported statically — bundled by tsc/tsx and traced by Vercel's
// packer, so no filesystem reads are needed anywhere.
export { openapiDocument }
