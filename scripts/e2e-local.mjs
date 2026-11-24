// LOCAL ONLY (wrangler dev): full moderation flow incl. a normal float, duplicates and 3-report hide. Never run against prod.
const base = process.argv[2] || 'ws://127.0.0.1:8799';
if (!/127\.0\.0\.1|localhost/.test(base)) throw new Error('local only');
function client(ip) {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(base + '/api/river', { headers: { 'CF-Connecting-IP': ip } });
		const inbox = [];
		const waiters = [];
		ws.onmessage = (e) => {
			const m = JSON.parse(e.data);
			inbox.push(m);
			for (const w of [...waiters]) if (w.pred(m)) (waiters.splice(waiters.indexOf(w), 1), w.res(m));
		};
		ws.onerror = () => reject(new Error('ws error'));
		const next = (pred, ms = 5000) =>
			new Promise((res, rej) => {
				const i = inbox.findIndex(pred);
				if (i >= 0) return res(inbox.splice(i, 1)[0]);
				waiters.push({ pred, res });
				setTimeout(() => rej(new Error('timeout')), ms);
			});
		ws.onopen = () => resolve({ ws, next, has: (p) => inbox.some(p), send: (o) => ws.send(JSON.stringify(o)) });
	});
}
let n = 0;
const ok = (c, m) => {
	if (!c) throw new Error('FAIL ' + m);
	n++;
	console.log('  ✓', m);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const K = (wish, name = 'x') => ({ base: 'leaf', flowers: ['lotus'], name, wish });
const tag = Date.now().toString(36);
const [A, B, C, D] = await Promise.all(['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4'].map(client));
await Promise.all([A, B, C, D].map((c) => c.next((m) => m.type === 'hello')));
A.send({ type: 'float', k: K(`ขอให้ครอบครัวมีความสุข ${tag}`), cid: 'a1' });
const good = await B.next((m) => m.type === 'float');
ok(good.item.wish.includes(tag), 'clean wish broadcast to others');
B.send({ type: 'float', k: K('ไอ้เหี้ย'), cid: 'b1' });
ok((await B.next((m) => m.type === 'error')).code === 'blocked', 'abusive rejected');
C.send({ type: 'float', k: K('hope you die'), cid: 'c1' });
ok((await C.next((m) => m.type === 'error')).code === 'blocked', 'death wish rejected');
D.send({ type: 'float', k: K('I would die for you'), cid: 'd1' });
const sh = await D.next((m) => m.type === 'float' && m.cid === 'd1');
await sleep(800);
ok(!A.has((m) => m.type === 'float' && m.item.id === sh.item.id), 'borderline shadowed: echo to sender only');
await sleep(10_200);
A.send({ type: 'float', k: K(`ขอให้ครอบครัวมีความสุข ${tag}`), cid: 'a2' });
const dup = await A.next((m) => m.type === 'float' && m.cid === 'a2');
await sleep(800);
ok(!B.has((m) => m.type === 'float' && m.item.id === dup.item.id), 'same-network duplicate shadowed');
for (const c of [B, C]) c.send({ type: 'report', id: good.item.id });
await sleep(500);
ok(!D.has((m) => m.type === 'hide'), '2 reports: still visible');
D.send({ type: 'report', id: good.item.id });
ok((await A.next((m) => m.type === 'hide')).id === good.item.id, '3rd distinct report hides for everyone');
const E = await client('5.5.5.5');
const hE = await E.next((m) => m.type === 'hello');
ok(!hE.recent.some((it) => it.id === good.item.id), 'hidden krathong gone from recent');
console.log(`\n${n} local checks passed`);
process.exit(0);
