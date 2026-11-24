/** Canvas motion for the landing field, the night sky, and bloom charms. */

export const PETAL_GLYPHS = ['.', ',', "'", '*', '+', 'o', '°', '~', '·', '✶', '✦', '❀', '*', '+'];

export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

export function clamp(n: number, a: number, b: number): number {
	return Math.max(a, Math.min(b, n));
}

export function easeOutCubic(t: number): number {
	const x = clamp(t, 0, 1);
	return 1 - (1 - x) ** 3;
}

export function easeOutExpo(t: number): number {
	const x = clamp(t, 0, 1);
	return x >= 1 ? 1 : 1 - 2 ** (-10 * x);
}

export function easeInOut(t: number): number {
	const x = clamp(t, 0, 1);
	return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
}

export function resizeCanvas(
	canvas: HTMLCanvasElement,
	maxDpr = 2,
): { w: number; h: number; dpr: number; cssW: number; cssH: number } {
	const dpr = Math.min(maxDpr, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
	const r = canvas.getBoundingClientRect();
	const cssW = Math.max(1, r.width);
	const cssH = Math.max(1, r.height);
	const w = Math.max(1, Math.round(cssW * dpr));
	const h = Math.max(1, Math.round(cssH * dpr));
	if (canvas.width !== w || canvas.height !== h) {
		canvas.width = w;
		canvas.height = h;
	}
	return { w, h, dpr, cssW, cssH };
}

const COLORS = ['#f7efe6', '#ffd0e0', '#e8c988', '#c9e4ff', '#f6c6a8', '#d7b7ff', '#b8f0c8', '#ffffff'];

export type WordmarkPoint = { x: number; y: number };

/**
 * Sample the "Bloom.txt" wordmark in CSS-pixel space, matching the landing typography:
 * italic Fraunces for "Bloom", IBM Plex Mono for ".txt".
 */
export function sampleWordmark(
	cssW: number,
	cssH: number,
	cx: number,
	cy: number,
	bloomPx: number,
): WordmarkPoint[] {
	const canvas = document.createElement('canvas');
	const dpr = 2;
	canvas.width = Math.max(2, Math.ceil(cssW * dpr));
	canvas.height = Math.max(2, Math.ceil(cssH * dpr));
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return [];
	ctx.scale(dpr, dpr);
	ctx.clearRect(0, 0, cssW, cssH);
	ctx.fillStyle = '#fff';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `italic 600 ${bloomPx}px Fraunces, "Times New Roman", serif`;
	const bloom = 'Bloom';
	const tail = '.txt';
	const bloomW = ctx.measureText(bloom).width;
	ctx.font = `400 ${Math.max(18, bloomPx * 0.38)}px "IBM Plex Mono", ui-monospace, monospace`;
	const tailW = ctx.measureText(tail).width;
	const gap = bloomPx * 0.04;
	const total = bloomW + gap + tailW;
	const left = cx - total / 2;
	ctx.font = `italic 600 ${bloomPx}px Fraunces, "Times New Roman", serif`;
	ctx.fillText(bloom, left + bloomW / 2, cy);
	ctx.font = `400 ${Math.max(18, bloomPx * 0.38)}px "IBM Plex Mono", ui-monospace, monospace`;
	ctx.fillText(tail, left + bloomW + gap + tailW / 2, cy + bloomPx * 0.06);
	const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const points: WordmarkPoint[] = [];
	const step = Math.max(3, Math.round(dpr * (cssW < 640 ? 5 : 4)));
	for (let y = 0; y < height; y += step) {
		for (let x = 0; x < width; x += step) {
			if (data[(y * width + x) * 4 + 3] > 80) {
				points.push({ x: x / dpr, y: y / dpr });
			}
		}
	}
	return points;
}

export function bloomFontSize(cssW: number): number {
	return clamp(cssW * 0.16, 56, 152);
}

type Glyph = {
	x: number;
	y: number;
	sx: number;
	sy: number;
	tx: number;
	ty: number;
	vx: number;
	vy: number;
	ch: string;
	color: string;
	size: number;
	rot: number;
	spin: number;
	phase: number;
	role: 'field' | 'mark';
};

function rand(a: number, b: number): number {
	return a + Math.random() * (b - a);
}

function pick<T>(xs: T[]): T {
	return xs[Math.floor(Math.random() * xs.length)]!;
}

export type IntroHandle = {
	draw: (now: number) => void;
	resize: () => void;
	skipToEnd: () => void;
	ready: () => boolean;
	destroy: () => void;
};

export function createIntroField(
	canvas: HTMLCanvasElement,
	opts: { reduced?: boolean; skipToEnd?: boolean },
): IntroHandle {
	let dim = resizeCanvas(canvas, 2);
	let glyphs: Glyph[] = [];
	let start = performance.now();
	let assembled = Boolean(opts.skipToEnd);
	let ready = assembled;
	const reduced = Boolean(opts.reduced);

	function layout() {
		dim = resizeCanvas(canvas, 2);
		const { cssW, cssH } = dim;
		const size = bloomFontSize(cssW);
		const cx = cssW / 2;
		const cy = cssH * 0.42;
		const marks = sampleWordmark(cssW, cssH, cx, cy, size);
		const mobile = cssW < 700;
		const fieldN = mobile ? 90 : 160;
		const useMarks = marks.length ? marks : [{ x: cx, y: cy }];
		const next: Glyph[] = [];
		for (const p of useMarks) {
			next.push({
				x: assembled ? p.x : rand(0, cssW),
				y: assembled ? p.y : rand(0, cssH),
				sx: rand(0, cssW),
				sy: rand(0, cssH),
				tx: p.x,
				ty: p.y,
				vx: rand(-8, 8),
				vy: rand(-6, 6),
				ch: pick(PETAL_GLYPHS),
				color: pick(COLORS),
				size: rand(size * 0.055, size * 0.1),
				rot: rand(0, Math.PI * 2),
				spin: rand(-0.4, 0.4),
				phase: rand(0, Math.PI * 2),
				role: 'mark',
			});
		}
		for (let i = 0; i < fieldN; i++) {
			next.push({
				x: rand(0, cssW),
				y: rand(0, cssH),
				sx: 0,
				sy: 0,
				tx: 0,
				ty: 0,
				vx: rand(-12, 12),
				vy: rand(-18, -4),
				ch: pick(PETAL_GLYPHS),
				color: pick(COLORS),
				size: rand(8, 18),
				rot: rand(0, Math.PI * 2),
				spin: rand(-0.7, 0.7),
				phase: rand(0, Math.PI * 2),
				role: 'field',
			});
		}
		glyphs = next;
	}

	layout();

	function skipToEnd() {
		assembled = true;
		ready = true;
		start = performance.now() - 4000;
		for (const g of glyphs) {
			if (g.role === 'mark') {
				g.x = g.tx;
				g.y = g.ty;
			}
		}
	}

	if (opts.skipToEnd || reduced) skipToEnd();

	function draw(now: number) {
		const { w, h, dpr, cssW, cssH } = dim;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const t = (now - start) / 1000;
		const gather = reduced || assembled ? 1 : easeInOut(clamp((t - 0.55) / 2.05, 0, 1));
		if (gather > 0.97) ready = true;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, cssW, cssH);
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		for (const g of glyphs) {
			if (g.role === 'mark') {
				const breathe = assembled || gather >= 1 ? Math.sin(now / 900 + g.phase) * 1.2 : 0;
				g.x = lerp(g.sx, g.tx, gather) + breathe * 0.2;
				g.y = lerp(g.sy, g.ty, gather) + Math.sin(now / 1100 + g.phase) * (gather > 0.95 ? 0.8 : 0);
				g.rot += g.spin * 0.008;
				// Once the crisp HTML wordmark fades in, leave only a soft glyph halo.
				const fade = gather >= 1 ? 0.18 : 0.35 + gather * 0.65;
				ctx.save();
				ctx.translate(g.x, g.y);
				ctx.rotate(g.rot * (1 - gather * 0.85));
				ctx.globalAlpha = fade;
				ctx.fillStyle = g.color;
				ctx.shadowColor = g.color;
				ctx.shadowBlur = 8 * gather;
				ctx.font = `${g.size}px "IBM Plex Mono", ui-monospace, monospace`;
				ctx.fillText(g.ch, 0, 0);
				ctx.restore();
			} else {
				g.x += (g.vx * (1 / 60)) % 1;
				g.y += g.vy / 60;
				g.x += Math.sin(now / 1400 + g.phase) * 0.08;
				g.rot += g.spin * 0.01;
				if (g.y < -20) {
					g.y = cssH + 20;
					g.x = rand(0, cssW);
				}
				if (g.x < -20) g.x = cssW + 20;
				if (g.x > cssW + 20) g.x = -20;
				ctx.save();
				ctx.translate(g.x, g.y);
				ctx.rotate(g.rot);
				ctx.globalAlpha = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(now / 800 + g.phase));
				ctx.fillStyle = g.color;
				ctx.font = `${g.size}px "IBM Plex Mono", ui-monospace, monospace`;
				ctx.fillText(g.ch, 0, 0);
				ctx.restore();
			}
		}
		void w;
		void h;
	}

	return {
		draw,
		resize: layout,
		skipToEnd,
		ready: () => ready,
		destroy() {
			glyphs = [];
		},
	};
}

export type SkyHandle = {
	draw: (now: number, parallax: { x: number; y: number }) => void;
	resize: () => void;
	destroy: () => void;
};

type Star = { x: number; y: number; r: number; a: number; tw: number; z: number };
type Fly = { x: number; y: number; vx: number; vy: number; phase: number; size: number; hue: string };
type Petal = { x: number; y: number; vx: number; vy: number; ch: string; size: number; rot: number; spin: number; color: string; z: number };

export function createSky(
	canvas: HTMLCanvasElement,
	opts: { reduced?: boolean; fireflies?: boolean; petals?: boolean },
): SkyHandle {
	let dim = resizeCanvas(canvas, 1.75);
	let stars: Star[] = [];
	let flies: Fly[] = [];
	let petals: Petal[] = [];
	const reduced = Boolean(opts.reduced);

	function layout() {
		dim = resizeCanvas(canvas, 1.75);
		const { cssW, cssH } = dim;
		const mobile = cssW < 700;
		const starN = reduced ? (mobile ? 40 : 70) : mobile ? 90 : 160;
		stars = Array.from({ length: starN }, () => ({
			x: rand(0, cssW),
			y: rand(0, cssH),
			r: rand(0.4, 1.6),
			a: rand(0.25, 0.95),
			tw: rand(0.4, 2.2),
			z: rand(0.2, 1),
		}));
		flies = [];
		petals = [];
		if (opts.fireflies && !reduced) {
			const n = mobile ? 14 : 26;
			for (let i = 0; i < n; i++) {
				flies.push({
					x: rand(0, cssW),
					y: rand(cssH * 0.15, cssH * 0.9),
					vx: rand(-12, 12),
					vy: rand(-8, 8),
					phase: rand(0, Math.PI * 2),
					size: rand(1.2, 2.4),
					hue: Math.random() < 0.7 ? '#ffe9a8' : '#ffd0e6',
				});
			}
		}
		if (opts.petals && !reduced) {
			const n = mobile ? 10 : 18;
			for (let i = 0; i < n; i++) {
				petals.push({
					x: rand(0, cssW),
					y: rand(0, cssH),
					vx: rand(-8, 8),
					vy: rand(6, 18),
					ch: pick(['*', '+', '❀', '✿', "'", '·', 'o']),
					size: rand(10, 18),
					rot: rand(0, Math.PI * 2),
					spin: rand(-0.6, 0.6),
					color: pick(['#ffd0e0', '#f7efe6', '#e8c988', '#e6b3ff', '#ffc6b8']),
					z: rand(0.4, 1),
				});
			}
		}
	}

	layout();

	function draw(now: number, parallax: { x: number; y: number }) {
		const { dpr, cssW, cssH } = dim;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, cssW, cssH);
		const px = parallax.x;
		const py = parallax.y;
		for (const s of stars) {
			const tw = reduced ? s.a : s.a * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now / 700 * s.tw + s.x)));
			ctx.beginPath();
			ctx.fillStyle = `rgba(247, 239, 230, ${tw})`;
			ctx.arc(s.x + px * 10 * s.z, s.y + py * 8 * s.z, s.r, 0, Math.PI * 2);
			ctx.fill();
		}
		if (!reduced) {
			for (const f of flies) {
				f.x += f.vx / 60 + Math.sin(now / 900 + f.phase) * 0.15;
				f.y += f.vy / 60 + Math.cos(now / 1100 + f.phase) * 0.12;
				if (f.x < -10) f.x = cssW + 10;
				if (f.x > cssW + 10) f.x = -10;
				if (f.y < -10) f.y = cssH + 10;
				if (f.y > cssH + 10) f.y = -10;
				const pulse = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(now / 400 + f.phase));
				ctx.save();
				ctx.globalAlpha = pulse;
				ctx.fillStyle = f.hue;
				ctx.shadowColor = f.hue;
				ctx.shadowBlur = 16;
				ctx.beginPath();
				ctx.arc(f.x + px * 18, f.y + py * 14, f.size, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
			}
			for (const p of petals) {
				p.x += p.vx / 60 + Math.sin(now / 1200 + p.rot) * 0.2;
				p.y += p.vy / 60;
				p.rot += p.spin * 0.012;
				if (p.y > cssH + 20) {
					p.y = -20;
					p.x = rand(0, cssW);
				}
				ctx.save();
				ctx.translate(p.x + px * 24 * p.z, p.y + py * 16 * p.z);
				ctx.rotate(p.rot);
				ctx.globalAlpha = 0.28 + 0.25 * p.z;
				ctx.fillStyle = p.color;
				ctx.font = `${p.size}px "IBM Plex Mono", ui-monospace, monospace`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(p.ch, 0, 0);
				ctx.restore();
			}
		}
	}

	return {
		draw,
		resize: layout,
		destroy() {
			stars = [];
			flies = [];
			petals = [];
		},
	};
}

export type CharmHandle = {
	draw: (now: number) => void;
	resize: () => void;
	restart: () => void;
	destroy: () => void;
};

type Charm = {
	born: number;
	life: number;
	cx: number;
	turns: number;
	r0: number;
	phase: number;
	ch: string;
	color: string;
	size: number;
};

export function createCharms(canvas: HTMLCanvasElement, opts: { reduced?: boolean }): CharmHandle {
	let dim = resizeCanvas(canvas, 1.5);
	let charms: Charm[] = [];
	let origin = performance.now();
	const reduced = Boolean(opts.reduced);

	function spawn(now: number, burst = false) {
		const { cssW, cssH } = dim;
		const n = burst ? (cssW < 700 ? 28 : 48) : 1;
		for (let i = 0; i < n; i++) {
			charms.push({
				born: now + i * 20,
				life: rand(1800, 3200),
				cx: cssW * 0.5 + rand(-cssW * 0.08, cssW * 0.08),
				turns: rand(1.2, 2.6),
				r0: rand(cssW * 0.04, cssW * 0.16),
				phase: rand(0, Math.PI * 2),
				ch: pick(['*', '+', '.', '·', '✦', "'", 'o']),
				color: pick(['#ffe9a8', '#ffd0e6', '#e8f4ff', '#f7efe6', '#c9f5d4']),
				size: rand(9, 16),
			});
		}
	}

	function resize() {
		dim = resizeCanvas(canvas, 1.5);
	}

	function restart() {
		charms = [];
		origin = performance.now();
		if (!reduced) spawn(origin, true);
	}

	restart();

	function draw(now: number) {
		const { dpr, cssW, cssH } = dim;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, cssW, cssH);
		if (reduced) return;
		const elapsed = now - origin;
		if (elapsed < 4200 && Math.random() < 0.35) spawn(now, false);
		if (elapsed < 5200 && charms.length < 80 && Math.random() < 0.2) spawn(now, false);
		const baseY = cssH * 0.82;
		const topY = cssH * 0.18;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const live: Charm[] = [];
		for (const c of charms) {
			const t = (now - c.born) / c.life;
			if (t < 0) {
				live.push(c);
				continue;
			}
			if (t > 1) continue;
			const rise = easeOutCubic(t);
			const y = lerp(baseY, topY, rise);
			const rad = c.r0 * (1 - rise * 0.55) * (0.7 + 0.3 * Math.sin(t * Math.PI));
			const ang = c.phase + t * c.turns * Math.PI * 2;
			const x = c.cx + Math.cos(ang) * rad;
			ctx.save();
			ctx.translate(x, y);
			ctx.globalAlpha = Math.sin(t * Math.PI) * 0.9;
			ctx.fillStyle = c.color;
			ctx.shadowColor = c.color;
			ctx.shadowBlur = 12;
			ctx.font = `${c.size}px "IBM Plex Mono", ui-monospace, monospace`;
			ctx.fillText(c.ch, 0, 0);
			ctx.restore();
			live.push(c);
		}
		charms = live;
	}

	return {
		draw,
		resize,
		restart,
		destroy() {
			charms = [];
		},
	};
}
