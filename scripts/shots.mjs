import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import lz from 'lz-string';

const base = process.env.BASE || 'http://127.0.0.1:8787/';
const out = path.resolve(process.env.OUT || 'screenshots');
await mkdir(out, { recursive: true });
const only = process.argv[2] || 'all';
const room = process.env.ROOM || '';
const q = room ? `?room=${room}` : '';
const token = lz.compressToEncodedURIComponent(
	JSON.stringify({ k: 1, b: 'leaf', f: ['lotus', 'marigold', 'orchid'], x: 1, w: 'ขอให้เราได้ลอยกระทงด้วยกันทุกปีนะ', t: 'Ploy', s: 'Marqo' }),
);
const b = await chromium.launch();
const shot = (p, n) => p.screenshot({ path: path.join(out, n) });
async function page(vp, opts = {}) {
	const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: opts.dsf ?? 1, ...(opts.video ? { recordVideo: { dir: out, size: vp } } : {}) });
	const p = await ctx.newPage();
	p.on('pageerror', (e) => console.log('pageerror', e.message));
	return { ctx, p };
}
async function holdCandle(p) {
	const c = p.locator('button.candle');
	const box = await c.boundingBox();
	await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await p.mouse.down();
	await p.waitForTimeout(1400);
	await p.mouse.up();
}
async function steps(p, prefix) {
	for (let i = 0; i < 4; i++) {
		if (i) await p.locator('.pager .next').click();
		await p.waitForTimeout(500);
		if (i === 1) await p.locator('.flowers .item').nth(3).click();
		if (i === 2) await p.locator('.receipt label').first().click();
		if (i === 3) {
			await p.fill('.slip textarea', 'ขอให้ครอบครัวมีความสุข สุขภาพแข็งแรง');
			await p.fill('.sign input >> nth=0', 'Marqo');
		}
		await p.waitForTimeout(400);
		await shot(p, `${prefix}-step${i + 1}.png`);
	}
}
if (only === 'all' || only === 'desktop') {
	const { ctx, p } = await page({ width: 1440, height: 900 });
	await p.goto(base + q);
	await p.waitForTimeout(2500);
	await shot(p, 'build.png');
	await steps(p, 'desktop');
	await holdCandle(p);
	await p.waitForTimeout(5000);
	await shot(p, 'float.png');
	await p.waitForTimeout(5000);
	await shot(p, 'done.png');
	await ctx.close();
}
if (only === 'all' || only === 'mobile') {
	const { ctx, p } = await page({ width: 390, height: 844 }, { dsf: 2 });
	await p.goto(base + q);
	await p.waitForTimeout(2500);
	await shot(p, 'mobile.png');
	await steps(p, 'mobile');
	await holdCandle(p);
	await p.waitForTimeout(10000);
	await shot(p, 'mobile-done.png');
	await ctx.close();
}
if (only === 'all' || only === 'recipient') {
	const { ctx, p } = await page({ width: 1440, height: 900 });
	await p.goto(base + q + '#/' + token);
	await p.waitForTimeout(1800);
	await shot(p, 'invite.png');
	await p.locator('.invite button').click();
	await p.waitForTimeout(12500);
	await shot(p, 'recipient.png');
	await ctx.close();
	const m = await page({ width: 390, height: 844 }, { dsf: 2 });
	await m.p.goto(base + q + '#/' + token);
	await m.p.waitForTimeout(1500);
	await shot(m.p, 'mobile-invite.png');
	await m.p.locator('.invite button').click();
	await m.p.waitForTimeout(12500);
	await shot(m.p, 'mobile-recipient.png');
	await m.ctx.close();
}
if (only === 'live') {
	const { ctx, p } = await page({ width: Number(process.env.W || 1440), height: Number(process.env.H || 900) }, { dsf: Number(process.env.DSF || 1) });
	await p.goto(base + q + (q ? '&' : '?') + 'debug');
	await p.waitForTimeout(3000);
	if (process.env.SEED_CMD) execFileSync('sh', ['-c', process.env.SEED_CMD], { stdio: 'inherit' });
	await p.waitForTimeout(Number(process.env.LIVE_WAIT || 3500));
	await shot(p, process.env.NAME || 'live-river.png');
	const pt = await p.evaluate(() => {
		const s = window.__kr;
		for (let y = innerHeight * 0.3; y < innerHeight; y += 8) for (let x = 0; x < innerWidth; x += 8) if (s.hitTest(x, y)) return { x, y };
		return null;
	});
	if (pt) {
		await p.mouse.click(pt.x, pt.y);
		await p.waitForTimeout(900);
		await shot(p, (process.env.NAME || 'live-river.png').replace('.png', '-read.png'));
	}
	await ctx.close();
}
await b.close();
console.log('done');
