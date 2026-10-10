//src/services/playwright.service.ts

import { Page, Locator } from 'playwright';
import sharp from 'sharp';
import { contextPool } from '../pool/browser.pool';

export interface UrlScreenshotOptions {
    url: string;
    selector?: string;
    width?: number;
    height?: number;
    fullPage?: boolean;
    format?: 'png' | 'jpeg' | 'webp';
    quality?: number;
    waitFor?: string;
    waitMs?: number;
    limit?: number;
    waitForImages?: boolean;
    waitUntil?: 'domcontentloaded' | 'load' | 'networkidle';
    blockAds?: boolean;
    scale?: number;
}

const AD_DOMAINS = [
    'googlesyndication.com',
    'doubleclick.net',
    'adnxs.com',
    'facebook.net',
    'analytics.google.com',
    'hotjar.com',
    'intercom.io',
];

const MAX_WAIT_MS = 30_000;

async function waitForImagesInElement(page: Page, locator: Locator): Promise<void> {
    await locator.evaluate(async (el) => {
        const imgs = Array.from(el.querySelectorAll('img')) as HTMLImageElement[];
        if (imgs.length === 0) return;

        await Promise.all(
            imgs.map(
                (img) =>
                    new Promise<void>((resolve) => {
                        if (img.complete && img.naturalWidth > 0) {
                            resolve();
                            return;
                        }
                        img.addEventListener('load', () => resolve(), { once: true });
                        img.addEventListener('error', () => resolve(), { once: true });
                    })
            )
        );
    });
}

async function waitForAllPageImages(page: Page): Promise<void> {
    await page.evaluate(async () => {
        const imgs = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
        if (imgs.length === 0) return;

        await Promise.all(
            imgs.map(
                (img) =>
                    new Promise<void>((resolve) => {
                        if (img.complete && img.naturalWidth > 0) {
                            resolve();
                            return;
                        }
                        img.addEventListener('load', () => resolve(), { once: true });
                        img.addEventListener('error', () => resolve(), { once: true });
                    })
            )
        );
    });
}

/**
 * Captures screenshots of targets and returns an array of image buffers.
 */
export async function screenshotUrl(opts: UrlScreenshotOptions): Promise<Buffer[]> {
    const ctx = await contextPool.acquire();
    let page: Page | null = null;

    try {
        page = await ctx.newPage();

        await page.setViewportSize({
            width: opts.width ?? 1280,
            height: opts.height ?? 800,
        });

        if (opts.blockAds !== false) {
            await page.route('**/*', (route) => {
                const url = route.request().url();
                const resourceType = route.request().resourceType();
                const isAd = AD_DOMAINS.some((d) => url.includes(d));
                const isMedia = resourceType === 'media';
                return isAd || isMedia ? route.abort() : route.continue();
            });
        }

        // Navigation
        await page.goto(opts.url, {
            waitUntil: opts.waitUntil ?? 'load',
            timeout: 15_000,
        });

        if (opts.waitFor) {
            await page.waitForSelector(opts.waitFor, { timeout: 10_000 });
        }

        if (opts.waitMs && opts.waitMs > 0) {
            const safeWait = Math.min(opts.waitMs, MAX_WAIT_MS);
            await page.waitForTimeout(safeWait);
        }

        // ── Case A: Multiple Element Screenshots ─────────────────────────────
        if (opts.selector) {
            await page.waitForSelector(opts.selector, { state: 'visible', timeout: 10_000 });

            const locator = page.locator(opts.selector);
            const count = await locator.count();

            if (count === 0) {
                throw new Error(`No elements matched selector: "${opts.selector}"`);
            }

            // FIX: Changed to any[] to safely accumulate any type of generic Node buffer variation
            const buffers: any[] = [];

            // Track how many we've successfully processed
            let capturedCount = 0;
            const maxLimit = opts.limit && opts.limit > 0 ? opts.limit : count;

            // Loop through the available elements, but break early if we hit our limit
            for (let i = 0; i < count && capturedCount < maxLimit; i++) {
                const element = locator.nth(i);

                // If the element is hidden (e.g., mobile menu items on desktop), skip it
                // We do NOT increment capturedCount here, so it keeps looking for visible ones.
                if (!(await element.isVisible())) continue;

                if (opts.waitForImages !== false) {
                    await waitForImagesInElement(page, element).catch(() => { });
                }

                const raw = await element.screenshot({
                    type: opts.format === 'webp' ? 'png' : (opts.format ?? 'png'),
                    quality: opts.format === 'jpeg' ? (opts.quality ?? 90) : undefined,
                });

                // FIX: Explicitly typed as 'any' to prevent error on the sharp reassignment below
                let buf: any = Buffer.from(raw);
                if (opts.format === 'webp') {
                    buf = await sharp(buf).webp({ quality: opts.quality ?? 85 }).toBuffer();
                }

                buffers.push(buf);
                capturedCount++; // Increment our success tracker
            }

            return buffers as any;
        }

        // ── Case B: Full Page / Viewport Screenshot ──────────────────────────
        if (opts.waitForImages !== false) {
            await waitForAllPageImages(page).catch(() => { });
        }

        const raw = await page.screenshot({
            type: opts.format === 'webp' ? 'png' : (opts.format ?? 'png'),
            fullPage: opts.fullPage ?? false,
            quality: opts.format === 'jpeg' ? (opts.quality ?? 90) : undefined,
        });

        const buf = Buffer.from(raw);
        if (opts.format === 'webp') {
            const webpBuf = await sharp(buf).webp({ quality: opts.quality ?? 85 }).toBuffer();
            return [webpBuf] as any;
        }

        return [buf] as any;

    } // Explicitly catch errors to pass cleanly through pool release hooks
    catch (error) {
        throw error;
    } finally {
        if (page && !page.isClosed()) {
            await page.close().catch(() => { });
        }
        contextPool.release(ctx);
    }
}