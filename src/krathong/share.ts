import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { DEFAULT_KRATHONG, isBaseId, isFlowerKind, KLIMITS, type FlowerKind, type Krathong } from './model';

/** Compact wire format kept in the URL hash: #/krathong/<token>. */
export type KrathongPayload = {
	k: 1;
	b: string;
	f: string[];
	/** bit 1 = coin, bit 2 = hair, bit 4 = secret wish */
	x?: number;
	w?: string;
	t?: string;
	s?: string;
};

function clip(s: unknown, max: number, keepLines = false): string {
	let v = String(s ?? '');
	v = keepLines ? v.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n') : v.replace(/\s+/g, ' ');
	return Array.from(v.trim()).slice(0, max).join('');
}

function cleanFlowers(list: unknown): FlowerKind[] {
	const out: FlowerKind[] = [];
	if (Array.isArray(list)) for (const f of list) if (isFlowerKind(f) && !out.includes(f)) out.push(f);
	return out.slice(0, KLIMITS.flowers);
}

export function normalizeKrathong(k: Partial<Krathong>): Krathong {
	const flowers = cleanFlowers(k.flowers);
	const secret = !!k.secret;
	return {
		base: isBaseId(k.base) ? k.base : DEFAULT_KRATHONG.base,
		flowers: flowers.length ? flowers : [...DEFAULT_KRATHONG.flowers],
		coin: !!k.coin,
		hair: !!k.hair,
		secret,
		wish: secret ? '' : clip(k.wish, KLIMITS.wish, true),
		to: clip(k.to, KLIMITS.to),
		from: clip(k.from, KLIMITS.from),
	};
}

export function toKPayload(k: Krathong): KrathongPayload {
	const n = normalizeKrathong(k);
	const p: KrathongPayload = { k: 1, b: n.base, f: n.flowers };
	const x = (n.coin ? 1 : 0) | (n.hair ? 2 : 0) | (n.secret ? 4 : 0);
	if (x) p.x = x;
	if (n.wish) p.w = n.wish;
	if (n.to) p.t = n.to;
	if (n.from) p.s = n.from;
	return p;
}

export function fromKPayload(p: KrathongPayload): Krathong {
	const x = typeof p.x === 'number' ? p.x : 0;
	return normalizeKrathong({
		base: p.b as Krathong['base'],
		flowers: p.f as FlowerKind[],
		coin: !!(x & 1),
		hair: !!(x & 2),
		secret: !!(x & 4),
		wish: p.w ?? '',
		to: p.t ?? '',
		from: p.s ?? '',
	});
}

export function encodeKrathong(k: Krathong): string {
	return compressToEncodedURIComponent(JSON.stringify(toKPayload(k)));
}

export function decodeKrathong(token: string): Krathong | null {
	try {
		const raw = decompressFromEncodedURIComponent(token);
		if (!raw) return null;
		const data = JSON.parse(raw) as KrathongPayload;
		if (!data || data.k !== 1 || !Array.isArray(data.f)) return null;
		return fromKPayload(data);
	} catch {
		return null;
	}
}

export type KrathongRoute = { page: 'krathong'; token: string | null } | null;

/** Returns a route for #/krathong and #/krathong/<token>; null for anything else. */
export function parseKrathongRoute(hash: string): KrathongRoute {
	const h = hash.replace(/^#/, '').replace(/^\/+/, '');
	const m = h.match(/^(?:krathong|loykrathong)(?:\/(.*))?$/i);
	if (!m) return null;
	const token = m[1] ? decodeURIComponent(m[1]) : '';
	return { page: 'krathong', token: token || null };
}

export function krathongHash(k: Krathong): string {
	return `#/krathong/${encodeKrathong(k)}`;
}

export function krathongUrl(k: Krathong, origin?: string, path?: string): string {
	const o = origin ?? (typeof location !== 'undefined' ? location.origin : '');
	const p = path ?? (typeof location !== 'undefined' ? location.pathname : '/');
	return `${o}${p}${krathongHash(k)}`;
}

/** App-level route for the standalone site: token from #/<token> or #/krathong/<token>. */
export function parseAppRoute(hash: string): { token: string | null } {
	const h = hash.replace(/^#/, '').replace(/^\/+/, '');
	let token: string | null = null;
	const m = h.match(/^(?:krathong|loykrathong)(?:\/(.*))?$/i);
	if (m) token = m[1] ? decodeURIComponent(m[1]) : null;
	else if (h && !h.includes('/')) token = decodeURIComponent(h);
	return { token: token || null };
}

/** Share link for the standalone site. */
export function standaloneUrl(k: Krathong, origin?: string): string {
	const o = origin ?? (typeof location !== 'undefined' ? location.origin : '');
	return `${o}/#/${encodeKrathong(k)}`;
}
