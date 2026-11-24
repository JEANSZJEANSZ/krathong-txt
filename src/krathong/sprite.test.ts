import { describe, expect, it } from 'vitest';
import { ACCENT_INFO, BASES, DECOR_INFO, FLOWERS, FOLD_INFO, WAX_INFO, type Look } from './model';
import { buildSprite, type SpriteSpec } from './sprite';

const widths = [1, 3, 4, 5, 7, 9, 11, 13, 15, 17, 19, 23, 27, 31, 41];
const everything: Partial<Look> = { candles: 3, incense: 3, coin: true, hair: true, flags: true, pinwheel: true, lanterns: true, fireflies: true, accent: 'gold' };

function check(spec: SpriteSpec, w: number, t: number) {
	const sp = buildSprite(spec, w, t, 0.5);
	expect(sp.cells.length).toBeGreaterThan(0);
	const seen = new Set<string>();
	for (const c of sp.cells) {
		// stays near its own footprint so hit boxes and silhouettes stay honest
		expect(Math.abs(c.dx)).toBeLessThanOrEqual(sp.width / 2 + 3);
		expect(c.dy).toBeLessThanOrEqual(0);
		expect(-c.dy).toBeLessThan(sp.height + 1);
		expect(c.ch).toHaveLength(1);
		expect(c.c.every((v) => Number.isFinite(v) && v >= 0 && v <= 255)).toBe(true);
		const key = `${Math.round(c.dx * 2)},${c.dy}`;
		expect(seen.has(key), `overprint at ${key} (${spec.base}, w=${w})`).toBe(false);
		seen.add(key);
	}
	return sp;
}

describe('sprites render every variant at every size', () => {
	it('all bases × folds, plain and fully decorated', () => {
		for (const b of BASES)
			for (const f of FOLD_INFO)
				for (const w of widths)
					for (const extra of [{}, everything]) check({ base: b.id, fold: f.id, flowers: ['marigold', 'rose', 'garland'], ...extra }, w, 1.3);
	});
	it('all flowers in every colour they offer', () => {
		for (const fl of FLOWERS) for (const c of fl.colors) for (const w of [5, 11, 23]) check({ base: 'leaf', flowers: [fl.id], colors: [c] }, w, 0.2);
	});
	it('each decoration alone, all candle/incense counts, waxes and accents', () => {
		for (const d of DECOR_INFO) for (const w of widths) check({ base: 'pleat', flowers: ['lotus'], [d.id]: true }, w, 2.2);
		for (const candles of [1, 2, 3] as const) for (const incense of [0, 1, 3] as const) for (const w of widths) check({ base: 'boat', flowers: ['mum'], candles, incense, flags: true, pinwheel: true }, w, 0.7);
		for (const wax of Object.keys(WAX_INFO)) check({ base: 'ice', flowers: ['jasmine'], wax: wax as Look['wax'] }, 15, 0);
		for (const accent of Object.keys(ACCENT_INFO)) check({ base: 'coconut', flowers: ['bud'], accent: accent as Look['accent'] }, 15, 0);
	});
	it('animates without breaking over time', () => {
		for (let t = 0; t < 12; t += 0.37) check({ base: 'hyacinth', flowers: ['dokrak', 'orchid'], ...everything }, 19, t);
	});
	it('shows more candles and decorations when close, fewer when far', () => {
		const spec: SpriteSpec = { base: 'leaf', flowers: ['lotus'], candles: 3, flags: true, pinwheel: true };
		const flames = (w: number) => buildSprite(spec, w, 0).cells.filter((c) => c.flame && /[\^A*]/.test(c.ch)).length;
		expect(flames(23)).toBeGreaterThanOrEqual(3);
		expect(flames(11)).toBe(2);
		expect(flames(3)).toBe(0);
		expect(buildSprite(spec, 23, 0).cells.some((c) => c.ch === '>')).toBe(true);
		expect(buildSprite(spec, 7, 0).cells.some((c) => c.ch === '>')).toBe(false);
	});
	it('the classic krathong is unchanged by defaults', () => {
		const a = buildSprite({ base: 'leaf', flowers: ['marigold', 'orchid', 'lotus'] }, 15, 0.4).cells.map((c) => c.ch).join('');
		const b = buildSprite({ base: 'leaf', flowers: ['marigold', 'orchid', 'lotus'], fold: 'nail', candles: 1, incense: 3, accent: 'none' }, 15, 0.4).cells.map((c) => c.ch).join('');
		expect(a).toBe(b);
	});
});
