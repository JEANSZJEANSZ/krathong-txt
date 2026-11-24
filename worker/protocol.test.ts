import { describe, expect, it } from 'vitest';
import { cleanText, LIMITS, parseClientMsg, validateFloat } from './protocol';

const ok = { base: 'leaf', flowers: ['lotus', 'marigold'], coin: true, hair: false, name: 'Marqo', wish: 'ขอให้มีความสุข' };

describe('validateFloat', () => {
	it('accepts a well-formed krathong', () => {
		expect(validateFloat(ok)).toEqual(ok);
	});
	it('rejects unknown bases / flowers and non-objects', () => {
		expect(validateFloat({ ...ok, base: 'plastic' })).toBeNull();
		expect(validateFloat({ ...ok, flowers: ['rose'] })).toBeNull();
		expect(validateFloat({ ...ok, flowers: [] })).toBeNull();
		expect(validateFloat({ ...ok, flowers: 'lotus' })).toBeNull();
		expect(validateFloat(null)).toBeNull();
		expect(validateFloat([ok])).toBeNull();
		expect(validateFloat('x')).toBeNull();
	});
	it('dedupes and caps flowers, coerces flags to strict booleans', () => {
		const v = validateFloat({ ...ok, flowers: ['lotus', 'lotus', 'orchid', 'jasmine', 'marigold'], coin: 'yes', hair: 1 })!;
		expect(v.flowers).toEqual(['lotus', 'orchid', 'jasmine']);
		expect(v.coin).toBe(false);
		expect(v.hair).toBe(false);
	});
	it('caps name and wish by code points and omits empty text', () => {
		const v = validateFloat({ ...ok, name: 'ก'.repeat(80), wish: '🙏'.repeat(500) })!;
		expect(Array.from(v.name!).length).toBe(LIMITS.name);
		expect(Array.from(v.wish!).length).toBe(LIMITS.wish);
		const w = validateFloat({ ...ok, name: '   ', wish: 42 })!;
		expect('name' in w).toBe(false);
		expect('wish' in w).toBe(false);
	});
	it('strips control and bidi spoofing characters', () => {
		const v = validateFloat({ ...ok, name: 'a\u0000b\u202Ec\u2066d', wish: 'line1\r\nline2\u0007\n\n\n\nline3' })!;
		expect(v.name).toBe('a bcd');
		expect(v.wish).toBe('line1\nline2\n\nline3');
	});
	it('keeps html-looking text as plain text (rendered as text, never as HTML)', () => {
		expect(validateFloat({ ...ok, wish: '<img src=x onerror=alert(1)>' })!.wish).toBe('<img src=x onerror=alert(1)>');
	});
});

describe('cleanText', () => {
	it('collapses whitespace on single-line fields', () => {
		expect(cleanText('  a \n\t b  ', 10)).toBe('a b');
	});
	it('keeps Thai combining marks intact', () => {
		expect(cleanText('สุขสันต์วันลอยกระทง', 50)).toBe('สุขสันต์วันลอยกระทง');
	});
});

describe('parseClientMsg', () => {
	it('parses float and ping', () => {
		expect(parseClientMsg(JSON.stringify({ type: 'float', k: ok, cid: 'abc' }))).toEqual({ type: 'float', k: ok, cid: 'abc' });
		expect(parseClientMsg('{"type":"ping"}')).toEqual({ type: 'ping' });
	});
	it('rejects oversize, garbage and unknown types', () => {
		expect(parseClientMsg('x'.repeat(LIMITS.msgBytes + 1))).toEqual({ error: 'size' });
		expect(parseClientMsg('{not json')).toEqual({ error: 'invalid' });
		expect(parseClientMsg('{"type":"delete"}')).toEqual({ error: 'invalid' });
	});
	it('measures size in bytes, not characters (Thai is 3 bytes each)', () => {
		const thai = JSON.stringify({ type: 'float', k: { ...ok, wish: 'ก'.repeat(700) } });
		expect(parseClientMsg(thai)).toEqual({ error: 'size' });
	});
});

describe('report messages', () => {
	it('parses a valid report', () => expect(parseClientMsg(JSON.stringify({ type: 'report', id: 'abc-123' }))).toEqual({ type: 'report', id: 'abc-123' }));
	it('rejects odd report ids', () => {
		expect(parseClientMsg(JSON.stringify({ type: 'report', id: '<script>' }))).toHaveProperty('error');
		expect(parseClientMsg(JSON.stringify({ type: 'report', id: 'x'.repeat(40) }))).toHaveProperty('error');
	});
});
