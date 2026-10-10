//src/config.ts
export const config = {
    port: Number(process.env.PORT) || 3000,
    pool: {
        min: 2,
        max: 10,
        acquireTimeoutMs: 10_000,
        idleTimeoutMs: 30_000,
    },
    screenshot: {
        defaultWidth: 1280,
        defaultHeight: 800,
        defaultFormat: 'png' as 'png' | 'jpeg' | 'webp',
        maxWaitMs: 15_000,
    },
} as const
