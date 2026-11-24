import { preview } from 'vite';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import lz from 'lz-string';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, process.env.OUT || 'screenshots');
await mkdir(out, { recursive: true });
const server = await preview({ root, preview: { port: 4317, strictPort: true }, logLevel: 'error' });
const base = 'http://localhost:4317/';
const only = process.argv[2] || 'all';
const token = lz.compressToEncodedURIComponent(
	JSON.stringify({ k: 1, b: 'leaf', f: ['lotus', 'marigold', 'orchid'], x: 1, w: 'ขอให้เราได้ลอยกระทงด้วยกันทุกปีนะ\nMay we float one together every year 🪷', t: 'Ploy', s: 'Marqo' }),
);
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const shot = async (p, name) => p.screenshot({ path: path.join(out, name) });

async function page(vp, opts = {}) {
	const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: opts.dsf ?? 1, ...(opts.video ? { recordVideo: { dir: out, size: vp } } : {}) });
	return { ctx, p: await ctx.newPage() };
}

if (only === 'all' || only === 'build') {
	const { ctx, p } = await page({ width: 1440, height: 900 });
	await p.goto(base + '#/krathong');
	await p.waitForTimeout(2500);
	await shot(p, 'krathong-build.png');
	await p.getByRole('tab').nth(3).click();
	await p.fill('textarea', 'ขอให้ครอบครัวมีความสุข สุขภาพแข็งแรง');
	await p.waitForTimeout(600);
	await shot(p, 'krathong-build-wish.png');
	await p.locator('button.float').click();
	await p.waitForTimeout(5500);
	await shot(p, 'krathong-float.png');
	await p.waitForTimeout(5000);
	await shot(p, 'krathong-done.png');
	await ctx.close();
}
if (only === 'all' || only === 'recipient') {
	const { ctx, p } = await page({ width: 1440, height: 900 });
	await p.goto(base + '#/krathong/' + token);
	await p.waitForTimeout(1800);
	await shot(p, 'krathong-invite.png');
	await p.locator('.invite .big').click();
	await p.waitForTimeout(12500);
	await shot(p, 'krathong-recipient.png');
	await ctx.close();
}
if (only === 'all' || only === 'mobile') {
	const { ctx, p } = await page({ width: 390, height: 844 }, { dsf: 2 });
	await p.goto(base + '#/krathong');
	await p.waitForTimeout(2500);
	await shot(p, 'krathong-mobile.png');
	await p.locator('button.float').click();
	await p.waitForTimeout(10000);
	await shot(p, 'krathong-mobile-done.png');
	await p.goto(base + '#/krathong/' + token);
	await p.waitForTimeout(1200);
	await p.locator('.invite .big').click();
	await p.waitForTimeout(12500);
	await shot(p, 'krathong-mobile-recipient.png');
	await p.goto(base + '?intro=done#/');
	await p.waitForTimeout(1500);
	await shot(p, 'krathong-banner-mobile.png');
	await ctx.close();
}
if (only === 'all' || only === 'landing') {
	const { ctx, p } = await page({ width: 1440, height: 900 });
	await p.goto(base + '?intro=done#/');
	await p.waitForTimeout(2000);
	await shot(p, 'krathong-banner.png');
	await ctx.close();
}
if (only === 'all' || only === 'video') {
	const { ctx, p } = await page({ width: 1280, height: 720 }, { video: true });
	await p.goto(base + '#/krathong');
	await p.waitForTimeout(2500);
	await p.locator('button.float').click();
	await p.waitForTimeout(14000);
	const v = p.video();
	await ctx.close();
	const src = await v.path();
	const mp4 = path.join(out, 'krathong-float.mp4');
	await rm(mp4, { force: true });
	execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.5', '-i', src, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', mp4]);
	await rm(src, { force: true });
}
await b.close();
server.httpServer.close();
console.log('done');
