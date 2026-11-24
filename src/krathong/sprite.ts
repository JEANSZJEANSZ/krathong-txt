/** ASCII krathong sprites, built procedurally at any width so they shrink with distance. */
import { ACCENT_INFO, COLOR_INFO, normalizeLook, WAX_INFO, type BaseId, type ColorId, type FlowerKind, type FoldId, type Look } from './model';

export type RGB = [number, number, number];
export type SpriteCell = { dx: number; dy: number; ch: string; c: RGB; flame?: boolean };
export type SpriteSpec = Partial<Look> & { base: BaseId; flowers: FlowerKind[]; lit?: boolean };
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
const mixRGB = (a: RGB, b: RGB, k: number): RGB => [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];

const FLOWER_GLYPHS: Record<FlowerKind, { ch: [string, string]; c: [RGB, RGB] }> = {
	marigold: { ch: ['@', '%'], c: [hex('#ff8a1f'), hex('#ffc53d')] },
	orchid: { ch: ['&', '*'], c: [hex('#b46bff'), hex('#ff79de')] },
	lotus: { ch: ['/', '\\'], c: [hex('#ff8ad4'), hex('#ffc6e6')] },
	bud: { ch: ['0', '^'], c: [hex('#ff6fc4'), hex('#ffb0dc')] },
	jasmine: { ch: ['o', '*'], c: [hex('#f6f3ec'), hex('#fff8d6')] },
	garland: { ch: ['8', 'o'], c: [hex('#ff5a6a'), hex('#f6f3ec')] },
	rose: { ch: ['e', '@'], c: [hex('#e8323c'), hex('#ff6f6f')] },
	mum: { ch: ['*', '#'], c: [hex('#ffd23d'), hex('#fff08a')] },
	dokrak: { ch: ['+', 'x'], c: [hex('#d9c6ff'), hex('#f3ecff')] },
};

const COLOR_RGB: Record<Exclude<ColorId, 'natural'>, [RGB, RGB]> = {
	red: [hex('#e8323c'), hex('#ff6f6f')],
	pink: [hex('#ff7ac8'), hex('#ffc0e3')],
	white: [hex('#f6f3ec'), hex('#fffbe8')],
	yellow: [hex('#ffd23d'), hex('#fff08a')],
	orange: [hex('#ff8a1f'), hex('#ffb35c')],
	purple: [hex('#a35bff'), hex('#d6a6ff')],
	blue: [hex('#5aa0ff'), hex('#a8d0ff')],
};

function flowerTones(kind: FlowerKind, color: ColorId | undefined): [RGB, RGB] {
	const nat = FLOWER_GLYPHS[kind].c;
	if (!color || color === 'natural') return nat;
	const p = COLOR_RGB[color];
	// A garland stays jasmine-white; the colour is its rose/orchid tassel.
	if (kind === 'garland') return [p[0], nat[1]];
	return p;
}

type Row = { ch: string; ends?: [string, string]; c: RGB; c2?: RGB; inset: number };

const FOLD_CH: Record<FoldId, string> = { nail: '/\\', rose: '()', pakha: 'W' };

function baseRows(base: BaseId, fold: FoldId): Row[] {
	const f = FOLD_CH[fold];
	switch (base) {
		case 'leaf':
			return [
				{ ch: '=', ends: ['(', ')'], c: hex('#a99f7c'), c2: hex('#8f8768'), inset: 3 },
				{ ch: '\\/', c: hex('#1e8a3f'), c2: hex('#2bc85a'), inset: 1 },
				{ ch: f, c: hex('#3ee66b'), c2: hex('#7dff9a'), inset: 0 },
			];
		case 'pleat':
			return [
				{ ch: '_', ends: ['[', ']'], c: hex('#b3a985'), inset: 3 },
				{ ch: '|', ends: ['<', '>'], c: hex('#17733a'), c2: hex('#249e4e'), inset: 1 },
				{ ch: f, ends: ['<', '>'], c: hex('#2fd060'), c2: hex('#a6ffb8'), inset: 0 },
			];
		case 'hyacinth':
			return [
				{ ch: '~', ends: ['(', ')'], c: hex('#2f5a33'), c2: hex('#3d7040'), inset: 3 },
				{ ch: 'Oo', c: hex('#3fae5a'), c2: hex('#5fd07a'), inset: 1 },
				{ ch: f, c: hex('#7ccf4a'), c2: hex('#b5f07a'), inset: 0 },
			];
		case 'petal':
			return [
				{ ch: '_', ends: ['\\', '/'], c: hex('#c04c8c'), inset: 3 },
				{ ch: '()', c: hex('#ff8ad4'), c2: hex('#ffb3e0'), inset: 1 },
				{ ch: '/\\', ends: ['(', ')'], c: hex('#ffc6e6'), c2: hex('#fff0f8'), inset: 0 },
			];
		case 'bread':
			return [
				{ ch: '_', ends: ['\\', '/'], c: hex('#9c5f27'), inset: 3 },
				{ ch: '.:', ends: ['(', ')'], c: hex('#e0a860'), c2: hex('#f2c98a'), inset: 1 },
				{ ch: 'o ', ends: ['(', ')'], c: hex('#c98a3c'), c2: hex('#e9b673'), inset: 0 },
			];
		case 'cone':
			return [
				{ ch: 'X', ends: ['\\', '/'], c: hex('#b07a3a'), c2: hex('#d8a35d'), inset: 4 },
				{ ch: '#+', ends: ['\\', '/'], c: hex('#d8a35d'), c2: hex('#b07a3a'), inset: 2 },
				{ ch: '=', ends: ['(', ')'], c: hex('#f0d29a'), c2: hex('#e8c48a'), inset: 0 },
			];
		case 'coconut':
			return [
				{ ch: '_', ends: ['\\', '/'], c: hex('#4a2f1c'), inset: 3 },
				{ ch: '#;', ends: ['(', ')'], c: hex('#7a5232'), c2: hex('#946a45'), inset: 1 },
				{ ch: '~', ends: ['(', ')'], c: hex('#d4b483'), c2: hex('#b8925e'), inset: 0 },
			];
		case 'ice':
			return [
				{ ch: '_', ends: ['\\', '/'], c: hex('#6fa9cc'), inset: 3 },
				{ ch: '[]', c: hex('#bfe6ff'), c2: hex('#e6f7ff'), inset: 1 },
				{ ch: '=', ends: ['<', '>'], c: hex('#eaf8ff'), c2: hex('#ffffff'), inset: 0 },
			];
		case 'boat':
			return [
				{ ch: '_', ends: ['\\', '/'], c: hex('#cfc6ad'), inset: 2 },
				{ ch: '=', ends: ['\\', '/'], c: hex('#f3ecd8'), c2: hex('#e4dcc4'), inset: 1 },
				{ ch: '-', ends: ['<', '>'], c: hex('#fffaf0'), c2: hex('#efe6cf'), inset: 0 },
			];
	}
}

const STICK = hex('#a0603a');
const POLE = hex('#cdb08a');
const TIP = hex('#ff5a3c');
const GOLD = hex('#ffc53d');
const HAIR = hex('#b89a80');
const FIREFLY = hex('#d8ff7a');
const LANTERN: [RGB, RGB] = [hex('#ff6a3d'), hex('#ffc53d')];
const FLAG: [RGB, RGB] = [hex('#ff4d4d'), hex('#ffd23d')];
const PIN: RGB[] = [hex('#ff5a6a'), hex('#ffd23d'), hex('#5aa0ff'), hex('#3fd29a')];

function odd(n: number): number {
	const r = Math.max(1, Math.round(n));
	return r % 2 === 0 ? r + 1 : r;
}

/**
 * Build a krathong whose widest row is `w` cells. dy = 0 is the waterline; negative dy is up.
 * `t` (seconds) animates flames, the pinwheel and fireflies; `flare` (0–1) makes the flame taller.
 * Three levels of detail: speck (< 5), mid (5–14, simplified) and full (≥ 15).
 */
export function buildSprite(spec: SpriteSpec, wIn: number, t: number, flare = 0): Sprite {
	const L = normalizeLook(spec);
	const w = odd(wIn);
	const cells: SpriteCell[] = [];
	const lit = spec.lit !== false;
	const accent = L.accent !== 'none' ? hex(ACCENT_INFO[L.accent].css) : null;
	const waxHi = hex(WAX_INFO[L.wax].css);
	const waxLo = mixRGB(waxHi, [60, 50, 40], 0.18);
	// First write wins, so decorations never overprint each other.
	const taken = new Set<string>();
	const put = (dx: number, dy: number, ch: string, c: RGB, flame = false) => {
		const key = Math.round(dx * 2) + ',' + dy;
		if (taken.has(key)) return;
		taken.add(key);
		cells.push({ dx, dy, ch, c, flame });
	};
	const half = (n: number) => (n - 1) / 2;
	const rowsDef = baseRows(L.base, L.fold);

	const fireflies = (n: number, spread: number, top: number) => {
		for (let i = 0; i < n; i++) {
			const a = t * (0.55 + i * 0.13) + i * 2.4;
			const blink = 0.5 + 0.5 * Math.sin(t * (2.1 + i * 0.7) + i * 1.9);
			if (blink < 0.3) continue;
			const dx = Math.round(Math.cos(a) * spread);
			const dy = -Math.max(1, Math.round(1 + ((Math.sin(a * 1.3 + i) + 1) / 2) * (top - 1)));
			put(dx, dy, blink > 0.75 ? '*' : '.', mixRGB([80, 110, 40], FIREFLY, blink), true);
		}
	};

	if (w < 5) {
		// A far-off speck: a flame over a sliver of base.
		const base = rowsDef[2];
		put(0, 0, w < 3 ? '-' : '~', accent ?? base.c);
		if (w >= 3) {
			put(-1, 0, '-', base.c);
			put(1, 0, '-', base.c);
		}
		if (lit) put(0, -1, Math.floor(t * 6) % 3 === 0 ? "'" : '.', hex('#ffd27a'), true);
		if (L.fireflies) fireflies(1, 2, 2);
		return { cells, flame: lit ? { dx: 0, dy: -1 } : null, incense: [], width: w, height: 2 };
	}

	const full = w >= 15;
	const h = half(w);
	const useRows = full ? rowsDef : [rowsDef[0], rowsDef[2]];
	const rimN = useRows.length;
	let dy = 0;
	for (const [ri, row] of useRows.entries()) {
		const inset = full ? row.inset : Math.min(row.inset, 1);
		const rw = Math.max(3, w - inset * 2);
		const rh = half(rw);
		const top = ri === useRows.length - 1;
		for (let i = 0; i < rw; i++) {
			const dx = i - rh;
			const end = i === 0 || i === rw - 1;
			let ch = row.ch[i % row.ch.length];
			if (row.ends && i === 0) ch = row.ends[0];
			else if (row.ends && i === rw - 1) ch = row.ends[1];
			let c = row.c2 && i % 4 >= 2 ? row.c2 : row.c;
			if (accent && end && (top || ri === 0)) c = accent;
			if (ch === ' ') continue;
			if (top && L.lanterns && !end && i % 4 === 2) {
				const lc = accent && (i / 4) % 2 >= 1 ? accent : LANTERN[Math.floor(i / 4) % 2];
				const glow = 0.8 + 0.2 * Math.sin(t * 3 + i);
				put(dx, -dy, 'o', mixRGB([40, 20, 10], lc, glow), true);
				continue;
			}
			put(dx, -dy, ch, c);
		}
		dy++;
	}

	// Flower crown: a dome of alternating clumps.
	const tones = L.flowers.map((f, i) => flowerTones(f, L.colors[i]));
	const domeRows = w >= 23 ? 3 : w >= 11 ? 2 : 1;
	const shrink = w >= 23 ? 4 : 3;
	for (let r = 0; r < domeRows; r++) {
		const rw = Math.max(1, w - 4 - r * shrink * (r === 0 ? 0 : 1) - (r > 0 ? 2 : 0));
		const rh = half(rw);
		for (let i = 0; i < rw; i++) {
			const fi = Math.floor((i + r) / 2) % L.flowers.length;
			const g = FLOWER_GLYPHS[L.flowers[fi]];
			const k = (i + r) % 2;
			put(i - rh, -dy, g.ch[k], tones[fi][k]);
		}
		dy++;
	}
	const domeTop = dy - 1;

	// Keepsakes tucked into the crown's lower edge.
	if (L.coin && w >= 9) {
		const i = cells.findIndex((c) => c.dy === -rimN && c.dx === -half(w - 4) + 1);
		if (i >= 0) cells[i] = { dx: cells[i].dx, dy: cells[i].dy, ch: 'o', c: GOLD };
	}
	if (L.hair && w >= 9) {
		const i = cells.findIndex((c) => c.dy === -rimN && c.dx === half(w - 4) - 1);
		if (i >= 0) cells[i] = { dx: cells[i].dx, dy: cells[i].dy, ch: '~', c: HAIR };
	}

	const poleH = domeRows + 1;
	const poleTop = rimN + poleH - 1;
	const leftPole = w >= 9 && L.flags;
	const rightPole = w >= 9 && (L.pinwheel || L.flags);

	// Candles and flames.
	const candleN = full ? L.candles : w >= 11 ? Math.min(L.candles, 2) : 1;
	const cxs = candleN === 1 ? [0] : candleN === 2 ? [-1, 1] : [-2, 0, 2];
	const candleH = full ? 2 : 1;
	const wickY = dy + candleH;
	let flame: Sprite['flame'] = null;
	for (const [ci, cx] of cxs.entries()) {
		for (let k = 0; k < candleH; k++) put(cx, -(dy + k), 'I', k === 0 ? waxLo : waxHi);
		if (lit) {
			const f = Math.floor(t * 9 + Math.sin(t * 3.1 + ci * 1.3) * 2 + ci * 2);
			const body = ['^', 'A', '^', '*'][((f % 4) + 4) % 4];
			const tipCh = ["'", '`', ',', "'", '.'][((f % 5) + 5) % 5];
			put(cx, -wickY, body, hex('#ffb347'), true);
			if (full) put(cx, -(wickY + 1), tipCh, hex('#fff0b0'), true);
			if (flare > 0.3 && full) put(cx, -(wickY + 2), '.', hex('#fff8d8'), true);
		} else put(cx, -wickY, "'", hex('#5a4a3a'));
	}
	if (lit) flame = { dx: 0, dy: -(wickY + (full ? 1 : 0)) };

	// Incense sticks, fanned, to the right of the candles (shifting in to clear the right pole).
	const incense: Sprite['incense'] = [];
	let sticks = w >= 9 ? (full ? L.incense : Math.min(L.incense, 1)) : 0;
	if (sticks) {
		const maxX = rightPole ? h - 2 : h;
		let x0 = cxs[cxs.length - 1] + 2;
		if (x0 + sticks - 1 > maxX) x0 = cxs[cxs.length - 1] + 1;
		while (sticks > 0 && x0 + sticks - 1 > maxX) sticks--;
		const stickH = full ? candleH + 2 : 2;
		for (let s = 0; s < sticks; s++) {
			const x = x0 + s;
			const lean = full && sticks === 3 && s === 2 && x + 1 <= maxX ? 1 : 0;
			for (let k = 0; k < stickH; k++) put(x + (lean && k === stickH - 1 ? lean : 0), -(domeTop + 1 + k), lean && k === stickH - 1 ? '/' : '|', STICK);
			const tx = x + lean;
			const ty = -(domeTop + 1 + stickH);
			const glow = 0.75 + 0.25 * Math.sin(t * 2.3 + s * 1.7);
			put(tx, ty, '\u2022', [Math.round(TIP[0] * glow), Math.round(TIP[1] * glow), Math.round(TIP[2] * glow)]);
			incense.push({ dx: tx, dy: ty });
		}
	}

	// Poles at the rim ends: little flags on the left, a pinwheel (or a second flag) on the right.
	if (leftPole || rightPole) {
		const pole = (x: number) => {
			for (let k = 0; k < poleH; k++) put(x, -(rimN + k), k === poleH - 1 ? ':' : '|', POLE);
		};
		const flagC = accent ?? FLAG[0];
		if (leftPole) {
			pole(-(h - 1));
			put(-(h - 2), -poleTop, '>', flagC);
			if (full) put(-(h - 3), -poleTop, '-', mixRGB(flagC, FLAG[1], accent ? 0.35 : 1));
		}
		if (rightPole) {
			const x = h - 1;
			pole(x);
			if (L.pinwheel) {
				const f = Math.floor(t * 5);
				put(x, -(poleTop + 1), f % 2 ? 'x' : '+', PIN[f % 4], true);
				if (full) {
					put(x - 1, -(poleTop + 1), f % 2 ? '`' : '-', PIN[(f + 1) % 4]);
					put(x + 1, -(poleTop + 1), f % 2 ? ',' : '-', PIN[(f + 2) % 4]);
				}
			} else {
				put(x - 1, -poleTop, '<', accent ?? FLAG[1]);
			}
		}
	}

	let height = 0;
	for (const c of cells) height = Math.max(height, 1 - c.dy);
	if (L.fireflies) fireflies(full ? 4 : w >= 9 ? 2 : 1, h + (full ? 2 : 1), Math.max(3, height));
	return { cells, flame, incense, width: w, height: Math.max(height, wickY + 2) };
}

/** A sprite as rows of coloured glyphs, for small static previews in the UI. */
export function spriteRows(spec: SpriteSpec, w: number, t = 0.4): { ch: string; color: string }[][] {
	const sp = buildSprite(spec, w, t);
	const xs = sp.cells.map((c) => Math.round(c.dx));
	const minDy = Math.min(...sp.cells.map((c) => c.dy));
	const minDx = Math.min(...xs);
	const maxDx = Math.max(...xs);
	const H = -minDy + 1;
	const W = maxDx - minDx + 1;
	const grid = Array.from({ length: H }, () => Array.from({ length: W }, () => ({ ch: ' ', color: 'transparent' })));
	for (const c of sp.cells) {
		grid[c.dy - minDy][Math.round(c.dx) - minDx] = { ch: c.ch, color: `rgb(${c.c[0]},${c.c[1]},${c.c[2]})` };
	}
	return grid;
}
