import { DurableObject } from 'cloudflare:workers';
import { dupKey, moderate } from './moderation';
import { LIMITS, parseClientMsg, validateFloat, type RiverItem, type ServerMsg } from './protocol';

export interface Env {
	ASSETS: Fetcher;
	RIVER: DurableObjectNamespace<River>;
}

/** ip is a salted hash, never the raw address. */
type Attachment = { last: number; ip: string };
const HOUR = 3_600_000;

async function hashIp(ip: string): Promise<string> {
	const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('loykrathong-2569:' + ip));
	return [...new Uint8Array(d).slice(0, 10)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class River extends DurableObject<Env> {
	private readonly room = 'public';

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		const sql = ctx.storage.sql;
		sql.exec(`CREATE TABLE IF NOT EXISTS floats (id TEXT PRIMARY KEY, t INTEGER NOT NULL, data TEXT NOT NULL)`);
		sql.exec(`CREATE INDEX IF NOT EXISTS floats_t ON floats (t)`);
		sql.exec(`CREATE TABLE IF NOT EXISTS hits (ip TEXT NOT NULL, t INTEGER NOT NULL)`);
		sql.exec(`CREATE INDEX IF NOT EXISTS hits_ip ON hits (ip, t)`);
		sql.exec(`CREATE TABLE IF NOT EXISTS dups (k TEXT NOT NULL, ip TEXT NOT NULL, t INTEGER NOT NULL)`);
		sql.exec(`CREATE INDEX IF NOT EXISTS dups_k ON dups (k, t)`);
		sql.exec(`CREATE TABLE IF NOT EXISTS reports (id TEXT NOT NULL, ip TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (id, ip))`);
		ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'));
	}

	/** Recent krathongs, re-moderated on read so anything that now fails the filter never resurfaces. */
	private recent(): RiverItem[] {
		const cutoff = Date.now() - LIMITS.maxAgeMs;
		const rows = this.ctx.storage.sql
			.exec<{ data: string }>(`SELECT data FROM floats WHERE t >= ? ORDER BY t DESC LIMIT ?`, cutoff, LIMITS.keep)
			.toArray();
		return rows
			.map((r) => JSON.parse(r.data) as RiverItem)
			.filter((it) => moderate(it.name, it.wish).action === 'ok')
			.reverse();
	}

	private open(except?: WebSocket): WebSocket[] {
		return this.ctx.getWebSockets().filter((w) => w !== except && w.readyState === WebSocket.OPEN);
	}

	private send(ws: WebSocket, msg: ServerMsg) {
		try {
			ws.send(JSON.stringify(msg));
		} catch {
			/* gone */
		}
	}

	private broadcast(msg: ServerMsg, except?: WebSocket) {
		const s = JSON.stringify(msg);
		for (const w of this.open(except)) {
			try {
				w.send(s);
			} catch {
				/* socket went away */
			}
		}
	}

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get('Upgrade') !== 'websocket') {
			return Response.json({ room: this.room, count: this.open().length, recent: this.recent().length });
		}
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);
		this.ctx.acceptWebSocket(server);
		const ip = await hashIp(request.headers.get('CF-Connecting-IP') ?? 'unknown');
		server.serializeAttachment({ last: 0, ip } satisfies Attachment);
		const count = this.open().length;
		this.send(server, { type: 'hello', room: this.room, recent: this.recent(), count });
		this.broadcast({ type: 'presence', count }, server);
		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
		const msg = parseClientMsg(raw);
		if ('error' in msg) return this.send(ws, { type: 'error', code: msg.error });
		if (msg.type === 'ping') return this.send(ws, { type: 'pong' });
		const att = (ws.deserializeAttachment() as Attachment | null) ?? { last: 0, ip: 'unknown' };
		const now = Date.now();
		const sql = this.ctx.storage.sql;

		if (msg.type === 'report') return this.report(ws, att, msg.id, now);

		// Rate limits: 1 per 10s per connection and per network, max 20 per hour per network.
		const h = sql.exec<{ n: number; last: number | null; first: number | null }>(
			`SELECT COUNT(*) AS n, MAX(t) AS last, MIN(t) AS first FROM hits WHERE ip = ? AND t > ?`,
			att.ip,
			now - HOUR,
		).one();
		const last = Math.max(att.last, h.last ?? 0);
		if (now - last < LIMITS.floatEveryMs) return this.send(ws, { type: 'error', code: 'rate', retryIn: LIMITS.floatEveryMs - (now - last) });
		if (h.n >= LIMITS.floatsPerHour) return this.send(ws, { type: 'error', code: 'hourly', retryIn: (h.first ?? now) + HOUR - now });

		const k = validateFloat(msg.k);
		if (!k) return this.send(ws, { type: 'error', code: 'invalid' });

		ws.serializeAttachment({ ...att, last: now } satisfies Attachment);
		sql.exec(`INSERT INTO hits (ip, t) VALUES (?, ?)`, att.ip, now);
		sql.exec(`DELETE FROM hits WHERE t < ?`, now - HOUR);

		const verdict = moderate(k.name, k.wish);
		if (verdict.action === 'reject') return this.send(ws, { type: 'error', code: 'blocked' });

		// Duplicate text: same network within an hour, or the same words from 2+ others in 10 minutes.
		let shadow = verdict.action === 'shadow';
		const dk = dupKey(k.wish);
		if (dk.length >= 6) {
			const d = sql.exec<{ mine: number; others: number }>(
				`SELECT SUM(CASE WHEN ip = ? THEN 1 ELSE 0 END) AS mine, SUM(CASE WHEN ip != ? AND t > ? THEN 1 ELSE 0 END) AS others FROM dups WHERE k = ? AND t > ?`,
				att.ip,
				att.ip,
				now - 10 * 60_000,
				dk,
				now - HOUR,
			).one();
			if ((d.mine ?? 0) >= 1 || (d.others ?? 0) >= 2) shadow = true;
			sql.exec(`INSERT INTO dups (k, ip, t) VALUES (?, ?, ?)`, dk, att.ip, now);
			sql.exec(`DELETE FROM dups WHERE t < ?`, now - HOUR);
		}

		const item: RiverItem = { ...k, id: crypto.randomUUID().slice(0, 12), t: now };
		if (shadow) {
			// Looks fine to the sender; nobody else ever sees it.
			return this.send(ws, { type: 'float', item, cid: msg.cid });
		}
		sql.exec(`INSERT INTO floats (id, t, data) VALUES (?, ?, ?)`, item.id, item.t, JSON.stringify(item));
		sql.exec(`DELETE FROM floats WHERE t < ?`, now - LIMITS.maxAgeMs);
		sql.exec(`DELETE FROM floats WHERE id NOT IN (SELECT id FROM floats ORDER BY t DESC LIMIT ?)`, LIMITS.keep);
		this.broadcast({ type: 'float', item, cid: msg.cid });
	}

	private report(ws: WebSocket, att: Attachment, id: string, now: number) {
		const sql = this.ctx.storage.sql;
		const mine = sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM reports WHERE ip = ? AND t > ?`, att.ip, now - HOUR).one().n;
		this.send(ws, { type: 'reported', id });
		if (mine >= LIMITS.reportsPerHour) return;
		const exists = sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM floats WHERE id = ?`, id).one().n;
		if (!exists) return;
		sql.exec(`INSERT OR IGNORE INTO reports (id, ip, t) VALUES (?, ?, ?)`, id, att.ip, now);
		sql.exec(`DELETE FROM reports WHERE t < ?`, now - LIMITS.maxAgeMs);
		const n = sql.exec<{ n: number }>(`SELECT COUNT(DISTINCT ip) AS n FROM reports WHERE id = ?`, id).one().n;
		if (n >= LIMITS.reportsToHide) {
			sql.exec(`DELETE FROM floats WHERE id = ?`, id);
			this.broadcast({ type: 'hide', id });
		}
	}

	async webSocketClose(ws: WebSocket, code: number) {
		try {
			ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye');
		} catch {
			/* already closed */
		}
		this.broadcast({ type: 'presence', count: this.open(ws).length }, ws);
	}

	async webSocketError(ws: WebSocket) {
		this.broadcast({ type: 'presence', count: this.open(ws).length }, ws);
	}
}

function originAllowed(origin: string, host: string): boolean {
	try {
		const o = new URL(origin);
		if (o.host === host) return true;
		return o.hostname === 'krathong-txt.marqotone.space' || o.hostname === 'localhost' || o.hostname === '127.0.0.1' || o.hostname.endsWith('.workers.dev');
	} catch {
		return false;
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === '/api/river') {
			const origin = request.headers.get('Origin');
			if (origin && !originAllowed(origin, url.host)) return new Response('forbidden origin', { status: 403 });
			// One shared river for everyone: any ?room= is ignored.
			const stub = env.RIVER.get(env.RIVER.idFromName('public'));
			return stub.fetch(request);
		}
		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env>;
