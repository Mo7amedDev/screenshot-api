//src/server.ts

import 'dotenv/config';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import { join } from 'path';
import { config } from './config';
import { initBrowserPool, destroyBrowserPool } from './pool/browser.pool';
import { ensureStorageDir } from './services/storage.service';
import { websiteScreenshotRoute } from './routes/screenshot.website';
import { htmlScreenshotRoute } from './routes/screenshot.html';
import { storageRoutes } from './routes/storage';



async function bootstrap() {
    const app = Fastify({
        logger: { level: 'info' },
        bodyLimit: 5 * 1024 * 1024, // 5 MB
    });
    //console.log(process.env.NODE_ENV, '\n===================================');

    // ── CORS ───────────────────────────────────────────────────────────────────
    await app.register(cors, {
        // In production, replace with your actual Next.js domain:
        //origin: ['http://localhost:*', 'https://www.yourapp.com'],
        // origin: process.env.NODE_ENV === 'production'
        //     ? (process.env.CORS_ORIGIN ?? false)
        //     : true,                           // allow all in development
        origin: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: false,
    });

    // ── Rate limiting ──────────────────────────────────────────────────────────
    await app.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
        errorResponseBuilder: () => ({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'Max 100 screenshots/minute.',
        }),
    });

    // ── Static file serving (/storage/*) ──────────────────────────────────────
    await app.register(fastifyStatic, {
        root: join(process.cwd(), 'storage'),
        prefix: '/storage/',
        decorateReply: false,
    });

    // ── Health check ───────────────────────────────────────────────────────────
    app.get('/health', async () => ({ status: 'ok', ts: Date.now() }));

    // ── Routes ─────────────────────────────────────────────────────────────────
    // POST /screenshot/website    — Playwright (semantic name)
    // POST /screenshot/playwright — Playwright (engine name alias)
    // POST /screenshot/html       — Satori (no browser, HTML/JSX input)
    await app.register(websiteScreenshotRoute);
    await app.register(htmlScreenshotRoute);
    await app.register(storageRoutes);

    // ── Graceful shutdown ──────────────────────────────────────────────────────
    const shutdown = async () => {
        app.log.info('Shutting down...');
        await destroyBrowserPool();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // ── Init storage + browser pool before accepting traffic ───────────────────
    await ensureStorageDir();
    app.log.info('Storage directory ready');

    app.log.info('Warming up browser pool...');
    await initBrowserPool();
    app.log.info(`Browser pool ready (min: ${config.pool.min}, max: ${config.pool.max})`);

    await app.listen({ port: config.port, host: '0.0.0.0' });
}

bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
});