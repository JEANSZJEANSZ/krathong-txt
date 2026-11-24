// Non-polluting live check of the single shared river: connect, presence, validation rejects. Never floats a valid krathong.
const base = process.argv[2] || 'wss://krathong-txt.marqotone.space';
const origin = base.replace(/^ws/, 'http');
function client(path = '/api/river') {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(base + path, { headers: { Origin: origin } });
		const inbox = [];
		const waiters = [];
		ws.onmessage = (e) => {
			const m = JSON.parse(e.data);
			inbox.push(m);
			for (const w of [...waiters]) if (w.pred(m)) (waiters.splice(waiters.indexOf(w), 1), w.res(m));
		};
		ws.onerror = () => reject(new Error('ws error'));
		const next = (pred, ms = 6000) =>
			new Promise((res, rej) => {
				const hit = inbox.find(pred);
				if (hit) return res(hit);
				waiters.push({ pred, res });
				setTimeout(() => rej(new Error('timeout')), ms);
			});
		ws.onopen = () => resolve({ ws, next, inboxHas: (p) => inbox.some(p), send: (o) => ws.send(typeof o === 'string' ? o : JSON.stringify(o)) });
	});
}
let n = 0;
const ok = (c, m) => {
	if (!c) throw new Error('FAIL ' + m);
	n++;
	console.log('  ✓', m);
};
const A = await client();
const hA = await A.next((m) => m.type === 'hello');
ok(hA.room === 'public', `A joins the shared river (count ${hA.count}, ${hA.recent.length} recent)`);
const B = await client('/api/river?room=secret123');
const hB = await B.next((m) => m.type === 'hello');
ok(hB.room === 'public' && hB.count === hA.count + 1, `?room= is ignored: B lands on the same river (count ${hB.count})`);
ok((await A.next((m) => m.type === 'presence' && m.count === hB.count)).count === hB.count, 'A sees presence go up');
A.send({ type: 'float', k: { base: 'plastic', flowers: ['lotus'] } });
ok((await A.next((m) => m.type === 'error')).code === 'invalid', 'invalid base rejected');
A.send('x'.repeat(5000));
ok((await A.next((m) => m.type === 'error' && m.code === 'size')).code === 'size', 'oversize frame rejected');
A.send('{"type":"ping"}');
ok((await A.next((m) => m.type === 'pong')).type === 'pong', 'ping → pong (auto-response)');
// Moderation — only content that must never be shown is sent, so the public river stays clean.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
A.send({ type: 'float', k: { base: 'leaf', flowers: ['lotus'], name: 'e2e', wish: 'ไปตายซะ f.u.c.k' }, cid: 'bad1' });
ok((await A.next((m) => m.type === 'error' && m.code === 'blocked')).code === 'blocked', 'abusive wish rejected (blocked)');
await sleep(10_500);
A.send({ type: 'float', k: { base: 'leaf', flowers: ['lotus'], name: 'e2e', wish: 'สมัครสล็อต เว็บตรง www.example-slot.com แอดไลน์ @e2etest' }, cid: 'spam1' });
const echo = await A.next((m) => m.type === 'float' && m.cid === 'spam1');
ok(!!echo.item.id, 'spam wish: sender gets its own echo (shadow)');
await sleep(2500);
ok(!B.inboxHas((m) => m.type === 'float' && m.item.id === echo.item.id), 'spam wish NOT broadcast to B');
const C = await client();
const hC = await C.next((m) => m.type === 'hello');
ok(!hC.recent.some((it) => it.id === echo.item.id), 'spam wish NOT stored (absent from new client recent)');
C.ws.close();
A.send({ type: 'float', k: { base: 'leaf', flowers: ['lotus'], wish: 'ควย' } });
ok((await A.next((m) => m.type === 'error' && m.code === 'rate')).code === 'rate', 'per-network 10s rate limit');
A.send({ type: 'report', id: 'nonexistent-1' });
ok((await A.next((m) => m.type === 'reported')).id === 'nonexistent-1', 'report acknowledged (unknown id is a no-op)');
A.ws.close();
ok((await B.next((m) => m.type === 'presence' && m.count === hA.count)).count === hA.count, 'B sees presence go down');
B.ws.close();
console.log(`\n${n} checks passed — no krathongs floated`);
process.exit(0);
