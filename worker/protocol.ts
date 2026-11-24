/** Wire protocol + validation for the live river. Shared by the Worker and the browser. */

/** Allowed ids. Order matters only for the UI; never remove an id (old links and stored items use them). */
export const BASES = ['leaf', 'pleat', 'petal', 'bread', 'cone', 'coconut', 'ice', 'hyacinth', 'boat'] as const;
export const FLOWER_KINDS = ['marigold', 'orchid', 'lotus', 'jasmine', 'garland', 'bud', 'rose', 'mum', 'dokrak'] as const;
export const FOLDS = ['nail', 'rose', 'pakha'] as const;
export const COLORS = ['natural', 'red', 'pink', 'white', 'yellow', 'orange', 'purple', 'blue'] as const;
export const WAXES = ['cream', 'gold', 'red', 'pink', 'blue', 'green'] as const;
export const ACCENTS = ['none', 'gold', 'silver', 'crimson', 'pink', 'jade', 'indigo'] as const;
export const DECOR = ['flags', 'pinwheel', 'lanterns', 'fireflies'] as const;
export const INCENSE = [0, 1, 3] as const;
export const CANDLES = [1, 2, 3] as const;

export type WireBase = (typeof BASES)[number];
export type WireFlower = (typeof FLOWER_KINDS)[number];
export type WireFold = (typeof FOLDS)[number];
export type WireColor = (typeof COLORS)[number];
export type WireWax = (typeof WAXES)[number];
export type WireAccent = (typeof ACCENTS)[number];
export type WireDecor = (typeof DECOR)[number];

const has = <T>(list: readonly T[], v: unknown): v is T => list.includes(v as T);

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
	/** Optional look; omitted = default. */
	fold?: WireFold;
	/** Parallel to `flowers`. */
	colors?: WireColor[];
	candles?: 2 | 3;
	wax?: WireWax;
	incense?: 0 | 1;
	deco?: WireDecor[];
	accent?: WireAccent;
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

/**
 * Validate an untrusted float payload. Returns null when it can't be salvaged.
 * Base and flowers are strict; optional look fields fall back to defaults when unknown.
 */
export function validateFloat(k: unknown): FloatInput | null {
	if (!k || typeof k !== 'object' || Array.isArray(k)) return null;
	const o = k as Record<string, unknown>;
	if (!has(BASES, o.base)) return null;
	if (!Array.isArray(o.flowers) || o.flowers.length > 8) return null;
	const rawColors = Array.isArray(o.colors) ? o.colors : [];
	const flowers: WireFlower[] = [];
	const colors: WireColor[] = [];
	for (const [i, f] of o.flowers.entries()) {
		if (!has(FLOWER_KINDS, f)) return null;
		if (flowers.includes(f)) continue;
		flowers.push(f);
		colors.push(has(COLORS, rawColors[i]) ? rawColors[i] : 'natural');
	}
	if (!flowers.length) return null;
	const out: FloatInput = {
		base: o.base,
		flowers: flowers.slice(0, LIMITS.flowers),
		coin: o.coin === true,
		hair: o.hair === true,
	};
	const name = cleanText(o.name, LIMITS.name);
	const wish = cleanText(o.wish, LIMITS.wish, true);
	if (name) out.name = name;
	if (wish) out.wish = wish;
	if (has(FOLDS, o.fold) && o.fold !== 'nail') out.fold = o.fold;
	const cs = colors.slice(0, out.flowers.length);
	if (cs.some((c) => c !== 'natural')) out.colors = cs;
	if (o.candles === 2 || o.candles === 3) out.candles = o.candles;
	if (has(WAXES, o.wax) && o.wax !== 'cream') out.wax = o.wax;
	if (o.incense === 0 || o.incense === 1) out.incense = o.incense;
	if (Array.isArray(o.deco)) {
		const d = DECOR.filter((x) => (o.deco as unknown[]).includes(x));
		if (d.length) out.deco = d;
	}
	if (has(ACCENTS, o.accent) && o.accent !== 'none') out.accent = o.accent;
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
