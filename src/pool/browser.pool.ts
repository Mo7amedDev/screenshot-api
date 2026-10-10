//src/pool/browser.pool.ts:

import { chromium, Browser, BrowserContext } from 'playwright';
import { createPool, Pool } from 'generic-pool';
import { config } from '../config';

let browser: Browser;
export type PooledContext = BrowserContext;
export let contextPool: Pool<PooledContext>;

async function launchBrowser(): Promise<Browser> {
    return chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-extensions',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--mute-audio',
            '--no-first-run',
            '--safebrowsing-disable-auto-update',
            // NOTE: --no-zygote and --single-process are intentionally OMITTED.
            // Both flags cause "browser has been closed" crashes on Linux
            // when combined with a context pool.
        ],
    });
}

export async function initBrowserPool(): Promise<void> {
    browser = await launchBrowser();

    contextPool = createPool<PooledContext>(
        {
            create: async () => {
                if (!browser.isConnected()) {
                    browser = await launchBrowser();
                }

                const ctx = await browser.newContext({
                    viewport: {
                        width: config.screenshot.defaultWidth,
                        height: config.screenshot.defaultHeight,
                    },
                    userAgent:
                        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
                        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    ignoreHTTPSErrors: true,
                });

                return ctx;
            },

            destroy: async (ctx) => {
                try {
                    await ctx.close();
                } catch {
                    // Already closed — ignore
                }
            },

            validate: async (ctx) => {
                try {
                    return ctx.browser()?.isConnected() === true;
                } catch {
                    return false;
                }
            },
        },
        {
            min: config.pool.min,
            max: config.pool.max,
            acquireTimeoutMillis: config.pool.acquireTimeoutMs,
            idleTimeoutMillis: config.pool.idleTimeoutMs,
            evictionRunIntervalMillis: 10_000,
            testOnBorrow: true,
        }
    );

    const warmup = Array.from({ length: config.pool.min }, () =>
        contextPool.acquire().then((ctx) => contextPool.release(ctx))
    );
    await Promise.all(warmup);
}

export async function destroyBrowserPool(): Promise<void> {
    await contextPool.drain();
    await contextPool.clear();
    if (browser.isConnected()) {
        await browser.close();
    }
}