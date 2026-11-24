import { describe, expect, it } from 'vitest';
import { compressToEncodedURIComponent } from 'lz-string';
import { DEFAULT_KRATHONG, type Krathong } from './model';
import { decodeKrathong, encodeKrathong, krathongHash, normalizeKrathong, parseKrathongRoute } from './share';

const full: Krathong = {
	base: 'bread',
	flowers: ['lotus', 'marigold'],
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
			JSON.stringify({ k: 1, b: 'plastic', f: ['lotus', 'lotus', 'rose', 'orchid', 'marigold', 'jasmine'], w: 'x'.repeat(500), t: ' a   b ' }),
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
