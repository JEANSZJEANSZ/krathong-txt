/** Live river client: one WebSocket to the shared river, reconnect with jittered backoff, offline-safe. */
import type { FloatInput, RiverItem, ServerMsg } from '../../worker/protocol';

export type RiverStatus = 'connecting' | 'live' | 'offline';
export type RiverHandlers = {
	onHello?: (recent: RiverItem[], count: number) => void;
	onFloat?: (item: RiverItem, mine: boolean) => void;
	onPresence?: (count: number) => void;
	onStatus?: (s: RiverStatus) => void;
	onRate?: (retryInMs: number, hourly: boolean) => void;
	onBlocked?: () => void;
	onHide?: (id: string) => void;
};

export type River = { float(k: FloatInput): string | null; report(id: string): boolean; close(): void; readonly status: RiverStatus };

export function connectRiver(h: RiverHandlers): River {
	let ws: WebSocket | null = null;
	let status: RiverStatus = 'connecting';
	let tries = 0;
	let closed = false;
	let retry = 0;
	let ping = 0;
	const mine = new Set<string>();

	const setStatus = (s: RiverStatus) => {
		status = s;
		h.onStatus?.(s);
	};

	function url() {
		const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
		const host = (import.meta.env.VITE_RIVER_HOST as string | undefined) || location.host;
		return `${proto}//${host}/api/river`;
	}

	function open() {
		if (closed) return;
		if (status !== 'live') setStatus(tries > 2 ? 'offline' : 'connecting');
		try {
			ws = new WebSocket(url());
		} catch {
			schedule();
			return;
		}
		ws.onopen = () => {
			tries = 0;
			setStatus('live');
			clearInterval(ping);
			ping = window.setInterval(() => ws?.readyState === 1 && ws.send('{"type":"ping"}'), 25_000);
		};
		ws.onmessage = (ev) => {
			let m: ServerMsg;
			try {
				m = JSON.parse(String(ev.data));
			} catch {
				return;
			}
			if (m.type === 'hello') h.onHello?.(m.recent ?? [], m.count);
			else if (m.type === 'float') h.onFloat?.(m.item, !!m.cid && mine.has(m.cid));
			else if (m.type === 'presence') h.onPresence?.(m.count);
			else if (m.type === 'hide') h.onHide?.(m.id);
			else if (m.type === 'error' && (m.code === 'rate' || m.code === 'hourly')) h.onRate?.(m.retryIn ?? 10_000, m.code === 'hourly');
			else if (m.type === 'error' && m.code === 'blocked') h.onBlocked?.();
		};
		ws.onclose = () => {
			clearInterval(ping);
			ws = null;
			if (!closed) {
				setStatus(tries > 1 ? 'offline' : 'connecting');
				schedule();
			}
		};
		ws.onerror = () => ws?.close();
	}

	function schedule() {
		tries++;
		const base = Math.min(30_000, 800 * 2 ** Math.min(tries, 6));
		clearTimeout(retry);
		retry = window.setTimeout(open, base * (0.6 + Math.random() * 0.8));
	}

	const onOnline = () => {
		if (!ws && !closed) {
			tries = 0;
			open();
		}
	};
	window.addEventListener('online', onOnline);
	open();

	return {
		get status() {
			return status;
		},
		float(k) {
			if (!ws || ws.readyState !== 1) return null;
			const cid = Math.random().toString(36).slice(2, 12);
			mine.add(cid);
			ws.send(JSON.stringify({ type: 'float', k, cid }));
			return cid;
		},
		report(id) {
			if (!ws || ws.readyState !== 1) return false;
			ws.send(JSON.stringify({ type: 'report', id }));
			return true;
		},
		close() {
			closed = true;
			clearTimeout(retry);
			clearInterval(ping);
			window.removeEventListener('online', onOnline);
			ws?.close();
		},
	};
}
