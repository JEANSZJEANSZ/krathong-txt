/** ASCII krathong sprites, built procedurally at any width so they shrink with distance. */
import type { BaseId, FlowerKind } from './model';

export type RGB = [number, number, number];
export type SpriteCell = { dx: number; dy: number; ch: string; c: RGB; flame?: boolean };
export type SpriteSpec = {
	base: BaseId;
	flowers: FlowerKind[];
	coin?: boolean;
	hair?: boolean;
	lit?: boolean;
};
export type Sprite = {
	cells: SpriteCell[];
	/** Flame tip offset (dx, dy) for glows and smoke. */
	flame: { dx: number; dy: number } | null;
	incense: { dx: number; dy: number }[];
	width: number;
	height: number;
};

export function hex(h: string): RGB {
	const n = parseInt(h.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const FLOWER_GLYPHS: Record<FlowerKind, { ch: [string, string]; c: [RGB, RGB] }> = {
	marigold: { ch: ['@', '%'], c: [hex('#ff8a1f'), hex('#ffc53d')] },
	orchid: { ch: ['&', '*'], c: [hex('#b46bff'), hex('#ff79de')] },
	lotus: { ch: ['/', '\\'], c: [hex('#ff8ad4'), hex('#ffc6e6')] },
	jasmine: { ch: ['o', '*'], c: [hex('#f6f3ec'), hex('#fff8d6')] },
};

const BASES: Record<BaseId, { rows: { ch: string; ends?: [string, string]; c: RGB; c2?: RGB; inset: number }[] }> = {
	leaf: {
		rows: [
			{ ch: '=', ends: ['(', ')'], c: hex('#a99f7c'), c2: hex('#8f8768'), inset: 3 },
			{ ch: '\\/', c: hex('#1e8a3f'), c2: hex('#2bc85a'), inset: 1 },
			{ ch: '/\\', c: hex('#3ee66b'), c2: hex('#7dff9a'), inset: 0 },
		],
	},
	bread: {
		rows: [
			{ ch: '_', ends: ['\\', '/'], c: hex('#9c5f27'), inset: 3 },
			{ ch: '.:', ends: ['(', ')'], c: hex('#e0a860'), c2: hex('#f2c98a'), inset: 1 },
			{ ch: 'o ', ends: ['(', ')'], c: hex('#c98a3c'), c2: hex('#e9b673'), inset: 0 },
		],
	},
	cone: {
		rows: [
			{ ch: 'X', ends: ['\\', '/'], c: hex('#b07a3a'), c2: hex('#d8a35d'), inset: 4 },
			{ ch: '#+', ends: ['\\', '/'], c: hex('#d8a35d'), c2: hex('#b07a3a'), inset: 2 },
			{ ch: '=', ends: ['(', ')'], c: hex('#f0d29a'), c2: hex('#e8c48a'), inset: 0 },
		],
	},
};

const WAX = hex('#fff4d6');
const WAX_DIM = hex('#e8d8b0');
const STICK = hex('#a0603a');
const TIP = hex('#ff5a3c');
const GOLD = hex('#ffc53d');
const HAIR = hex('#b89a80');

function odd(n: number): number {
	const r = Math.max(1, Math.round(n));
	return r % 2 === 0 ? r + 1 : r;
}

/**
 * Build a krathong whose widest row is `w` cells. dy = 0 is the waterline; negative dy is up.
 * `t` (seconds) animates the flame; `flare` (0–1) makes it taller when first floated.
 */
export function buildSprite(spec: SpriteSpec, wIn: number, t: number, flare = 0): Sprite {
	const w = odd(wIn);
	const cells: SpriteCell[] = [];
	const lit = spec.lit !== false;
	const flowers = spec.flowers.length ? spec.flowers : (['marigold'] as FlowerKind[]);
	const put = (dx: number, dy: number, ch: string, c: RGB, flame = false) => cells.push({ dx, dy, ch, c, flame });
	const half = (n: number) => (n - 1) / 2;

	if (w < 5) {
		// A far-off speck: a flame over a sliver of base.
		const base = BASES[spec.base].rows[2];
		put(0, 0, w < 3 ? '-' : '~', base.c);
		if (w >= 3) {
			put(-1, 0, '-', base.c);
			put(1, 0, '-', base.c);
		}
		if (lit) put(0, -1, (Math.floor(t * 6) % 3 === 0 ? "'" : '.'), hex('#ffd27a'), true);
		return { cells, flame: lit ? { dx: 0, dy: -1 } : null, incense: [], width: w, height: 2 };
	}

	const full = w >= 15;
	const baseRows = BASES[spec.base].rows;
	const useRows = full ? baseRows : [baseRows[0], baseRows[2]];
	let dy = 0;
	for (const row of useRows) {
		const inset = full ? row.inset : Math.min(row.inset, 1);
		const rw = Math.max(3, w - inset * 2);
		const h = half(rw);
		for (let i = 0; i < rw; i++) {
			const dx = i - h;
			let ch = row.ch[i % row.ch.length];
			if (row.ends && i === 0) ch = row.ends[0];
			else if (row.ends && i === rw - 1) ch = row.ends[1];
			const c = row.c2 && i % 4 >= 2 ? row.c2 : row.c;
			if (ch !== ' ') put(dx, -dy, ch, c);
		}
		dy++;
	}

	// Flower crown: a dome of alternating clumps.
	const domeRows = w >= 23 ? 3 : w >= 11 ? 2 : 1;
	const shrink = w >= 23 ? 4 : 3;
	let domeTopW = 1;
	for (let r = 0; r < domeRows; r++) {
		const rw = Math.max(1, w - 4 - r * shrink * (r === 0 ? 0 : 1) - (r > 0 ? 2 : 0));
		const h = half(rw);
		for (let i = 0; i < rw; i++) {
			const kind = flowers[Math.floor((i + r) / 2) % flowers.length];
			const g = FLOWER_GLYPHS[kind];
			const k = (i + r) % 2;
			put(i - h, -dy, g.ch[k], g.c[k]);
		}
		domeTopW = rw;
		dy++;
	}
	const domeTop = dy - 1;

	// Keepsakes tucked into the crown's lower edge.
	if (spec.coin && w >= 9) {
		const i = cells.findIndex((c) => c.dy === -(useRows.length) && c.dx === -half(w - 4) + 1);
		if (i >= 0) cells[i] = { dx: cells[i].dx, dy: cells[i].dy, ch: 'o', c: GOLD };
	}
	if (spec.hair && w >= 9) {
		const i = cells.findIndex((c) => c.dy === -(useRows.length) && c.dx === half(w - 4) - 1);
		if (i >= 0) cells[i] = { dx: cells[i].dx, dy: cells[i].dy, ch: '~', c: HAIR };
	}

	// Candle and flame.
	const candleH = full ? 2 : 1;
	for (let k = 0; k < candleH; k++) put(0, -(dy + k), 'I', k === 0 ? WAX_DIM : WAX);
	const wickY = dy + candleH;
	let flame: Sprite['flame'] = null;
	if (lit) {
		const f = Math.floor(t * 9 + Math.sin(t * 3.1) * 2);
		const body = ['^', 'A', '^', '*'][((f % 4) + 4) % 4];
		const tipCh = ["'", '`', ',', "'", '.'][((f % 5) + 5) % 5];
		put(0, -wickY, body, hex('#ffb347'), true);
		if (full) put(0, -(wickY + 1), tipCh, hex('#fff0b0'), true);
		if (flare > 0.3 && full) put(0, -(wickY + 2), '.', hex('#fff8d8'), true);
		flame = { dx: 0, dy: -(wickY + (full ? 1 : 0)) };
	} else {
		put(0, -wickY, "'", hex('#5a4a3a'));
	}

	// Three incense sticks, fanned, to the right of the candle.
	const incense: Sprite['incense'] = [];
	if (w >= 9) {
		const stickH = full ? candleH + 2 : 2;
		const xs = full ? [2, 3, 4] : [2];
		const top = Math.min(domeTopW, w);
		void top;
		for (let s = 0; s < xs.length; s++) {
			const x0 = xs[s];
			for (let k = 0; k < stickH; k++) {
				const lean = s === 2 && k === stickH - 1 ? 1 : s === 0 && k === stickH - 1 ? 0 : 0;
				put(x0 + lean, -(domeTop + 1 + k), s === 2 && k === stickH - 1 ? '/' : '|', STICK);
			}
			const tx = x0 + (s === 2 ? 1 : 0);
			const ty = -(domeTop + 1 + stickH);
			const glow = 0.75 + 0.25 * Math.sin(t * 2.3 + s * 1.7);
			put(tx, ty, '\u2022', [Math.round(TIP[0] * glow), Math.round(TIP[1] * glow), Math.round(TIP[2] * glow)]);
			incense.push({ dx: tx, dy: ty });
		}
	}

	return { cells, flame, incense, width: w, height: wickY + 2 };
}

/** A sprite as rows of coloured glyphs, for small static previews in the UI. */
export function spriteRows(spec: SpriteSpec, w: number, t = 0.4): { ch: string; color: string }[][] {
	const sp = buildSprite(spec, w, t);
	const minDy = Math.min(...sp.cells.map((c) => c.dy));
	const minDx = Math.min(...sp.cells.map((c) => c.dx));
	const maxDx = Math.max(...sp.cells.map((c) => c.dx));
	const H = -minDy + 1;
	const W = maxDx - minDx + 1;
	const grid = Array.from({ length: H }, () => Array.from({ length: W }, () => ({ ch: ' ', color: 'transparent' })));
	for (const c of sp.cells) {
		grid[c.dy - minDy][c.dx - minDx] = { ch: c.ch, color: `rgb(${c.c[0]},${c.c[1]},${c.c[2]})` };
	}
	return grid;
}
