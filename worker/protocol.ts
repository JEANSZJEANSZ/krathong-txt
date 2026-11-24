/** Wire protocol + validation for the live river. Shared by the Worker and the browser. */

export const BASES = ['leaf', 'bread', 'cone'] as const;
export const FLOWER_KINDS = ['marigold', 'orchid', 'lotus', 'jasmine'] as const;
export type WireBase = (typeof BASES)[number];
export type WireFlower = (typeof FLOWER_KINDS)[number];

export const LIMITS = {
	name: 24,
	wish: 200,
	flowers: 3,
	msgBytes: 2048,
	keep: 60,
	maxAgeMs: 24 * 60 * 60 * 1000,
	floatEveryMs: 10_000,
	floatsPerHour: 20,
	reportsPerHour: 30,
	reportsToHide: 3,
} as const;

export type FloatInput = {
	base: WireBase;
	flowers: WireFlower[];
	coin: boolean;
	hair: boolean;
	name?: string;
	wish?: string;
};

export type RiverItem = FloatInput & { id: string; t: number };

export type ClientMsg = { type: 'float'; k: unknown; cid?: string } | { type: 'report'; id: string } | { type: 'ping' };
export type ServerMsg =
	| { type: 'hello'; room: string; recent: RiverItem[]; count: number }
	| { type: 'float'; item: RiverItem; cid?: string }
	| { type: 'presence'; count: number }
	| { type: 'hide'; id: string }
	| { type: 'reported'; id: string }
	| { type: 'error'; code: 'rate' | 'hourly' | 'invalid' | 'size' | 'blocked'; retryIn?: number }
	| { type: 'pong' };

/**
 * Strip control characters (C0/C1, DEL), bidi overrides/isolates and other invisible
 * formatting chars that can be used to spoof text, collapse whitespace, cap by code points.
 */
export function cleanText(v: unknown, max: number, keepLines = false): string {
	if (typeof v !== 'string') return '';
	let s = v.normalize('NFC');
	s = s.replace(/[\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\uFFF9-\uFFFB]/g, '');
	if (keepLines) {
		s = s.replace(/\r\n?/g, '\n');
		s = s.replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '');
		s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
	} else {
		s = s.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').replace(/\s+/g, ' ');
	}
	return Array.from(s.trim()).slice(0, max).join('').trim();
}

/** Validate an untrusted float payload. Returns null when it can't be salvaged. */
export function validateFloat(k: unknown): FloatInput | null {
	if (!k || typeof k !== 'object' || Array.isArray(k)) return null;
	const o = k as Record<string, unknown>;
	if (!BASES.includes(o.base as WireBase)) return null;
	if (!Array.isArray(o.flowers) || o.flowers.length > 8) return null;
	const flowers: WireFlower[] = [];
	for (const f of o.flowers) {
		if (!FLOWER_KINDS.includes(f as WireFlower)) return null;
		if (!flowers.includes(f as WireFlower)) flowers.push(f as WireFlower);
	}
	if (!flowers.length) return null;
	const out: FloatInput = {
		base: o.base as WireBase,
		flowers: flowers.slice(0, LIMITS.flowers),
		coin: o.coin === true,
		hair: o.hair === true,
	};
	const name = cleanText(o.name, LIMITS.name);
	const wish = cleanText(o.wish, LIMITS.wish, true);
	if (name) out.name = name;
	if (wish) out.wish = wish;
	return out;
}

/** Parse + size-check a raw client frame. */
export function parseClientMsg(raw: string | ArrayBuffer): ClientMsg | { error: 'size' | 'invalid' } {
	const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
	if (new TextEncoder().encode(text).length > LIMITS.msgBytes) return { error: 'size' };
	try {
		const m = JSON.parse(text);
		if (m && m.type === 'ping') return { type: 'ping' };
		if (m && m.type === 'report' && typeof m.id === 'string' && /^[a-z0-9-]{1,32}$/.test(m.id)) return { type: 'report', id: m.id };
		if (m && m.type === 'float') return { type: 'float', k: m.k, cid: typeof m.cid === 'string' ? m.cid.slice(0, 32) : undefined };
	} catch {
		/* fallthrough */
	}
	return { error: 'invalid' };
}
