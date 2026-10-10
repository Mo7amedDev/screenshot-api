//src/schemas/request.schema.ts

// ---------------------------------------------------------------------------
// POST /screenshot/website  (or /screenshot/playwright — same schema)
//
// All options in the request body. `url` is now a required body field,
// not a URL parameter.
//
// Wait chain order:
//   navigate (waitUntil) → waitFor → waitMs → waitForImages → screenshot
// ---------------------------------------------------------------------------

export const websiteScreenshotSchema = {
    body: {
        type: 'object',
        required: ['url'],
        properties: {
            // ── Target ────────────────────────────────────────────────────────────
            url: {
                type: 'string',
                description: 'URL to screenshot. Protocol optional — https:// added if missing.',
            },
            selector: {
                type: 'string',
                description: 'CSS selector of the element to screenshot. Omit for full page/viewport.',
            },
            // ── Viewport ──────────────────────────────────────────────────────────
            width: { type: 'number', default: 1280 },
            height: { type: 'number', default: 800 },
            fullPage: { type: 'boolean', default: false },
            // ── Output ────────────────────────────────────────────────────────────
            format: { type: 'string', enum: ['png', 'jpeg', 'webp'], default: 'png' },
            quality: { type: 'number', minimum: 1, maximum: 100, default: 90 },
            returnType: { type: 'string', enum: ['image', 'url'], default: 'image' },
            // ── Wait options ──────────────────────────────────────────────────────
            waitUntil: {
                type: 'string',
                enum: ['domcontentloaded', 'load', 'networkidle'],
                default: 'load',
                description: [
                    'domcontentloaded — fastest, HTML only.',
                    'load — wait for images/CSS (default).',
                    'networkidle — wait until no network activity for 500ms.',
                ].join(' | '),
            },
            limit: {
                type: 'number',
                minimum: 1,
                description: 'Max number of elements to capture when using a selector.'
            },
            waitFor: {
                type: 'string',
                description: 'CSS selector to wait for in the DOM before screenshotting. Good for JS-rendered components.',
            },
            waitMs: {
                type: 'number',
                minimum: 0,
                maximum: 30000,
                description: 'Fixed delay in ms after page load and waitFor, before screenshot. Capped at 30000.',
            },
            waitForImages: {
                type: 'boolean',
                default: true,
                description: 'Wait for all <img> inside the target element to fully decode before screenshot.',
            },
            // ── Misc ──────────────────────────────────────────────────────────────
            blockAds: { type: 'boolean', default: true },
        },
    },
} as const;

// ---------------------------------------------------------------------------
// POST /screenshot/html
// ---------------------------------------------------------------------------
export const htmlScreenshotSchema = {
    body: {
        type: 'object',
        required: ['htmls'],
        properties: {
            htmls: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                description: 'Array of HTML strings to render.'
            },
            width: { type: 'number', default: 1200 },
            height: { type: 'number', default: 630 },
            format: { type: 'string', enum: ['png', 'jpeg', 'webp'], default: 'png' },
            quality: { type: 'number', minimum: 1, maximum: 100, default: 90 },
            returnType: { type: 'string', enum: ['image', 'url'], default: 'image' },
        },
    },
} as const;