import { describe, expect, it } from 'vitest';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { BASES, DEFAULT_KRATHONG, DEFAULT_LOOK, FLOWERS, FOLD_INFO, type Krathong } from './model';
import { decodeKrathong, encodeKrathong, krathongHash, normalizeKrathong, parseKrathongRoute } from './share';

const full: Krathong = {
	...DEFAULT_LOOK,
	base: 'bread',
	flowers: ['lotus', 'marigold'],
	colors: ['natural', 'natural'],
	coin: true,
	hair: true,
	wish: 'ขอให้ครอบครัวมีความสุข แข็งแรง 🙏\nand may we meet again next year',
	secret: false,
	to: 'แม่',
	from: 'Marqo',
};

describe('krathong share', () => {
	it('round-trips a full krathong with Thai text', () => {
		expect(decodeKrathong(encodeKrathong(full))).toEqual(full);
	});

	it('round-trips defaults', () => {
		expect(decodeKrathong(encodeKrathong(DEFAULT_KRATHONG))).toEqual(DEFAULT_KRATHONG);
	});

	it('drops the wish text when the wish is secret', () => {
		const out = decodeKrathong(encodeKrathong({ ...full, secret: true }))!;
		expect(out.secret).toBe(true);
		expect(out.wish).toBe('');
	});

	it('produces URL-safe tokens', () => {
		expect(encodeKrathong(full)).toMatch(/^[A-Za-z0-9+\-$_]+$/);
	});

	it('rejects garbage and wrong payloads', () => {
		expect(decodeKrathong('not-a-token')).toBeNull();
		expect(decodeKrathong('')).toBeNull();
		expect(decodeKrathong(compressToEncodedURIComponent(JSON.stringify({ v: 1, f: [] })))).toBeNull();
	});

	it('sanitises unknown ids, duplicates and over-long text', () => {
		const token = compressToEncodedURIComponent(
			JSON.stringify({ k: 1, b: 'plastic', f: ['lotus', 'lotus', 'tulip', 'orchid', 'marigold', 'jasmine'], w: 'x'.repeat(500), t: ' a   b ' }),
		);
		const k = decodeKrathong(token)!;
		expect(k.base).toBe('leaf');
		expect(k.flowers).toEqual(['lotus', 'orchid', 'marigold']);
		expect(Array.from(k.wish).length).toBe(200);
		expect(k.to).toBe('a b');
	});

	it('falls back to default flowers when none are valid', () => {
		expect(normalizeKrathong({ flowers: [] }).flowers).toEqual(DEFAULT_KRATHONG.flowers);
	});

	it('parses krathong routes and leaves others alone', () => {
		expect(parseKrathongRoute('#/krathong')).toEqual({ page: 'krathong', token: null });
		expect(parseKrathongRoute('#/krathong/')).toEqual({ page: 'krathong', token: null });
		expect(parseKrathongRoute('#/krathong/abc')).toEqual({ page: 'krathong', token: 'abc' });
		expect(parseKrathongRoute('#/gift/abc')).toBeNull();
		expect(parseKrathongRoute('')).toBeNull();
		const h = krathongHash(full);
		const r = parseKrathongRoute(h)!;
		expect(decodeKrathong(r.token!)).toEqual(full);
	});
});

import { parseAppRoute, standaloneUrl } from './share';
describe('standalone routes', () => {
	it('reads tokens from #/<token> and #/krathong/<token>', () => {
		const tok = encodeKrathong(full);
		expect(parseAppRoute('#/' + tok)).toEqual({ token: tok });
		expect(parseAppRoute('#/krathong/' + tok)).toEqual({ token: tok });
		expect(parseAppRoute('')).toEqual({ token: null });
		expect(parseAppRoute('#/krathong')).toEqual({ token: null });
	});
	it('builds share links with no room that round-trip', () => {
		const u = new URL(standaloneUrl(full, 'https://krathong-txt.marqotone.space'));
		expect(u.search).toBe('');
		expect(decodeKrathong(parseAppRoute(u.hash).token!)).toEqual(full);
	});
});

describe('krathong variants in links', () => {
	const fancy: Krathong = {
		...full,
		base: 'coconut',
		fold: 'pakha',
		flowers: ['garland', 'rose', 'dokrak'],
		colors: ['purple', 'pink', 'natural'],
		candles: 3,
		wax: 'gold',
		incense: 1,
		flags: true,
		pinwheel: true,
		lanterns: true,
		fireflies: true,
		accent: 'jade',
	};
	it('round-trips every new option', () => expect(decodeKrathong(encodeKrathong(fancy))).toEqual(fancy));
	it('round-trips each base, fold and flower', () => {
		for (const b of BASES)
			for (const f of FOLD_INFO) {
				const k = { ...full, base: b.id, fold: f.id };
				expect(decodeKrathong(encodeKrathong(k))).toEqual(k);
			}
		for (const f of FLOWERS) {
			const k = { ...full, flowers: [f.id], colors: [f.colors[f.colors.length - 1]] };
			expect(decodeKrathong(encodeKrathong(k))).toEqual(k);
		}
	});
	it('decodes links made before variants existed (classic look)', () => {
		const old = compressToEncodedURIComponent(JSON.stringify({ k: 1, b: 'leaf', f: ['marigold', 'jasmine'], x: 1, w: 'ขอให้รวย', s: 'แม่' }));
		const k = decodeKrathong(old)!;
		expect(k).toEqual({ ...DEFAULT_KRATHONG, flowers: ['marigold', 'jasmine'], colors: ['natural', 'natural'], coin: true, wish: 'ขอให้รวย', from: 'แม่' });
		expect(k.fold).toBe('nail');
		expect(k.candles).toBe(1);
		expect(k.incense).toBe(3);
	});
	it('keeps old-style tokens for classic krathongs (no new keys)', () => {
		const t = encodeKrathong({ ...DEFAULT_KRATHONG, wish: 'hi' });
		expect(decodeKrathong(t)!.wish).toBe('hi');
		expect(Object.keys(JSON.parse(decompressFromEncodedURIComponent(t)!)).sort()).toEqual(['b', 'f', 'k', 'w']);
	});
	it('falls back to defaults on unknown option values', () => {
		const t = compressToEncodedURIComponent(
			JSON.stringify({ k: 1, b: 'spaceship', f: ['rose', 'cactus', 'rose'], c: ['neon', 'red'], o: 'origami', n: 9, m: 'plaid', i: 7, d: 255, a: 'rainbow' }),
		);
		const k = decodeKrathong(t)!;
		expect(k.base).toBe('leaf');
		expect(k.flowers).toEqual(['rose']);
		expect(k.colors).toEqual(['natural']);
		expect(k.fold).toBe('nail');
		expect(k.candles).toBe(1);
		expect(k.wax).toBe('cream');
		expect(k.incense).toBe(3);
		expect(k.accent).toBe('none');
		expect([k.flags, k.pinwheel, k.lanterns, k.fireflies]).toEqual([true, true, true, true]);
	});
});
