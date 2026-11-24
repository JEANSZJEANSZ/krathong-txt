<script lang="ts">
	import './fonts';
	import { onDestroy, onMount, untrack } from 'svelte';
	import Atmosphere from '../lib/Atmosphere.svelte';
	import AsciiPreview from './AsciiPreview.svelte';
	import Kanok from './Kanok.svelte';
	import { createAmbience } from './audio';
	import {
		ACCENT_INFO,
		BASES,
		COLOR_INFO,
		DECOR_INFO,
		DEFAULT_KRATHONG,
		FLOWERS,
		FOLD_INFO,
		isLeafy,
		KLIMITS,
		lookFromWire,
		lookToWire,
		WAX_INFO,
		type AccentId,
		type ColorId,
		type FlowerKind,
		type Krathong,
		type WaxId,
	} from './model';
	import { connectRiver, type River, type RiverStatus } from './river';
	import { moderate, REJECT_MESSAGE } from '../../worker/moderation';
	import { createKrathongScene, type KrathongScene, type SceneEvent } from './scene';
	import { decodeKrathong, normalizeKrathong, standaloneUrl } from './share';
	import type { RiverItem } from '../../worker/protocol';

	let { token = null }: { token?: string | null } = $props();

	type Phase = 'build' | 'floating' | 'done' | 'invite' | 'arriving' | 'arrived' | 'broken';

	const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	const initialToken = untrack(() => token);
	const received = initialToken ? decodeKrathong(initialToken) : null;

	let k = $state<Krathong>(received ? { ...received, wish: '', to: '', from: '', secret: false } : { ...DEFAULT_KRATHONG, flowers: [...DEFAULT_KRATHONG.flowers], colors: [...DEFAULT_KRATHONG.colors] });
	let phase = $state<Phase>(initialToken ? (received ? 'invite' : 'broken') : 'build');
	let step = $state(0);
	let muted = $state(false);
	let soundOn = $state(false);
	let copied = $state<'' | 'gift'>('');
	let shareUrl = $state('');
	let mobile = $state(false);
	let wishRise = $state(false);
	let status = $state<RiverStatus>('connecting');
	let count = $state(0);
	let sentLive = $state(false);
	let toast = $state('');
	let reading = $state<RiverItem | null>(null);
	let wishError = $state('');
	const reported = new Set<string>();
	/** Belt and braces: the server already filters, but never draw anything that fails moderation. */
	const visible = (it: RiverItem) => !reported.has(it.id) && moderate(it.name, it.wish).action === 'ok';
	let hold = $state(0);
	let holdHint = $state(false);

	let canvas: HTMLCanvasElement | undefined;
	let scene: KrathongScene | undefined;
	let river: River | undefined;
	let raf = 0;
	const amb = createAmbience();
	const items = new Map<string, RiverItem>();
	let ownItem = $state<RiverItem | null>(null);
	let heroGone = false;

	const TH_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
	const th = (n: number | string) => String(n).replace(/\d/g, (d) => TH_DIGITS[+d]);

	const steps = [
		{ th: 'ตัวกระทง', en: 'base' },
		{ th: 'ดอกไม้', en: 'flowers' },
		{ th: 'ของบูชา', en: 'offerings' },
		{ th: 'คำอธิษฐาน', en: 'wish' },
	];

	function layoutFor(w: number, h: number) {
		const m = w < 760 || h > w * 1.25;
		mobile = m;
		if (m) return { homeX: 0.5, homeY: 0.45, horizon: 0.31, moonX: 0.76, moonY: 0.15 };
		return { homeX: 0.66, homeY: 0.8, horizon: 0.5, moonX: 0.8, moonY: 0.2 };
	}
	function applyLayout() {
		if (!scene || !canvas) return;
		const r = canvas.getBoundingClientRect();
		scene.setLayout(layoutFor(r.width, r.height));
	}

	function labelOf(it: RiverItem) {
		return it.name || 'ไม่ประสงค์ออกนาม';
	}
	function addToScene(it: RiverItem, fresh: boolean) {
		items.set(it.id, it);
		scene?.addLive({ id: it.id, look: lookFromWire(it), label: labelOf(it) }, fresh);
	}

	function onEvent(e: SceneEvent) {
		if (e === 'floated' && phase === 'floating') phase = 'done';
		if (e === 'gone') {
			heroGone = true;
			if (ownItem) addToScene(ownItem, true);
		}
		if (e === 'arrived' && phase === 'arriving') phase = 'arrived';
	}

	function frame(now: number) {
		scene?.draw(now);
		raf = requestAnimationFrame(frame);
	}

	function startRiver() {
		river = connectRiver({
			onStatus: (s) => (status = s),
			onHello: (recent, c) => {
				count = c;
				scene?.clearLive();
				for (const it of recent.filter(visible).slice(-16)) addToScene(it, false);
			},
			onPresence: (c) => (count = c),
			onFloat: (it, mine) => {
				if (mine) {
					ownItem = it;
					items.set(it.id, it);
					if (heroGone) addToScene(it, true);
					return;
				}
				if (visible(it)) addToScene(it, true);
			},
			onHide: (id) => hideItem(id),
			onBlocked: () => flash(`${REJECT_MESSAGE.th} · ${REJECT_MESSAGE.en}`),
			onRate: (ms, hourly) =>
				hourly
					? flash(`วันนี้ลอยไปเยอะแล้ว พักสักครู่นะ (${th(Math.ceil(ms / 60000))} นาที) · that's a lot of krathongs — rest ${Math.ceil(ms / 60000)} min`)
					: flash(`รออีก ${th(Math.ceil(ms / 1000))} วินาที ค่อยลอยใบใหม่ · wait ${Math.ceil(ms / 1000)}s`),
		});
	}

	onMount(() => {
		if (!canvas) return;
		let ro: ResizeObserver | undefined;
		let cancelled = false;
		const start = () => {
			if (cancelled || !canvas) return;
			scene = createKrathongScene(canvas, { reduced, onEvent });
			scene.resize();
			if (location.search.includes('debug')) (window as unknown as { __kr: KrathongScene }).__kr = scene;
			applyLayout();
			if (phase === 'build') scene.setKrathong(normalizeKrathong(k));
			ro = new ResizeObserver(() => {
				scene?.resize();
				applyLayout();
			});
			ro.observe(canvas);
			raf = requestAnimationFrame(frame);
			startRiver();
		};
		const fonts = document.fonts?.ready;
		if (fonts) fonts.then(start, start);
		else start();
		const onVis = () => {
			if (document.hidden) {
				cancelAnimationFrame(raf);
				raf = 0;
			} else if (!raf && scene) raf = requestAnimationFrame(frame);
		};
		document.addEventListener('visibilitychange', onVis);
		return () => {
			cancelled = true;
			ro?.disconnect();
			document.removeEventListener('visibilitychange', onVis);
		};
	});

	onDestroy(() => {
		cancelAnimationFrame(raf);
		scene?.destroy();
		river?.close();
		amb.stop();
	});

	$effect(() => {
		const snap = normalizeKrathong(k);
		if (phase === 'build') scene?.setKrathong(snap);
	});

	let toastTimer = 0;
	function flash(msg: string) {
		toast = msg;
		clearTimeout(toastTimer);
		toastTimer = window.setTimeout(() => (toast = ''), 3800);
	}

	function ensureSound() {
		if (!soundOn && !muted) {
			amb.start();
			soundOn = true;
		}
	}
	function toggleSound() {
		if (!soundOn) {
			muted = false;
			amb.start();
			soundOn = true;
			return;
		}
		muted = !muted;
		amb.setMuted(muted);
	}

	function toggleFlower(id: FlowerKind) {
		const colors = k.flowers.map((_, i) => k.colors[i] ?? 'natural');
		const i = k.flowers.indexOf(id);
		if (i >= 0) {
			if (k.flowers.length > 1) {
				k.flowers = k.flowers.filter((_, j) => j !== i);
				k.colors = colors.filter((_, j) => j !== i);
			}
		} else if (k.flowers.length < KLIMITS.flowers) {
			k.flowers = [...k.flowers, id];
			k.colors = [...colors, 'natural'];
		} else {
			k.flowers = [...k.flowers.slice(1), id];
			k.colors = [...colors.slice(1), 'natural'];
		}
	}
	function setColor(i: number, c: ColorId) {
		const colors = k.flowers.map((_, j) => k.colors[j] ?? 'natural');
		colors[i] = c;
		k.colors = colors;
	}
	const flowerInfo = (id: FlowerKind) => FLOWERS.find((f) => f.id === id)!;
	const swatch = (id: FlowerKind, c: ColorId) => (c === 'natural' ? flowerInfo(id).color : COLOR_INFO[c].css);
	const tintOf = (id: FlowerKind) => {
		const i = k.flowers.indexOf(id);
		return i >= 0 ? swatch(id, k.colors[i] ?? 'natural') : flowerInfo(id).color;
	};
	function stepCandles(d: number) {
		k.candles = Math.max(1, Math.min(3, k.candles + d)) as 1 | 2 | 3;
	}
	const INCENSE_STEPS = [0, 1, 3] as const;
	function stepIncense(d: number) {
		const i = INCENSE_STEPS.indexOf(k.incense);
		k.incense = INCENSE_STEPS[Math.max(0, Math.min(2, i + d))];
	}
	const WAXES = Object.keys(WAX_INFO) as WaxId[];
	const ACCENTS = Object.keys(ACCENT_INFO) as AccentId[];

	function hideItem(id: string) {
		items.delete(id);
		scene?.removeLive(id);
		if (reading?.id === id) closeReading();
	}
	function reportReading() {
		if (!reading) return;
		const id = reading.id;
		reported.add(id);
		river?.report(id);
		hideItem(id);
		flash('ขอบคุณที่ช่วยดูแลสายน้ำ · thanks, we’ll take a look');
	}

	function floatIt() {
		ensureSound();
		const snap = normalizeKrathong(k);
		const v = moderate(snap.from, [snap.wish, snap.to].filter(Boolean).join(' '));
		if (v.action === 'reject') {
			wishError = REJECT_MESSAGE.th;
			flash(`${REJECT_MESSAGE.th} · ${REJECT_MESSAGE.en}`);
			return;
		}
		wishError = '';
		shareUrl = standaloneUrl(snap);
		phase = 'floating';
		wishRise = true;
		heroGone = false;
		ownItem = null;
		applyLayout();
		scene?.setKrathong(snap);
		scene?.setMode('float');
		const sent = river?.float({
			...lookToWire(snap),
			...(snap.from ? { name: snap.from.slice(0, 24) } : {}),
			...(!snap.secret && snap.wish ? { wish: snap.wish } : {}),
		});
		sentLive = !!sent;
		if (reduced) setTimeout(() => phase === 'floating' && (phase = 'done'), 2500);
	}

	// Press-and-hold the candle to light it, then the krathong floats.
	const HOLD_MS = 1100;
	let holdRaf = 0;
	let holdStart = 0;
	function holdBegin(e?: Event) {
		e?.preventDefault();
		if (holdStart) return;
		holdHint = false;
		holdStart = performance.now();
		const tick = (now: number) => {
			hold = Math.min(1, (now - holdStart) / HOLD_MS);
			if (hold >= 1) {
				holdStart = 0;
				floatIt();
				setTimeout(() => (hold = 0), 600);
				return;
			}
			holdRaf = requestAnimationFrame(tick);
		};
		holdRaf = requestAnimationFrame(tick);
	}
	function holdEnd() {
		if (!holdStart) return;
		cancelAnimationFrame(holdRaf);
		if (hold < 1) holdHint = hold < 0.5;
		holdStart = 0;
		hold = 0;
	}
	function holdKey(e: KeyboardEvent) {
		if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) holdBegin(e);
	}
	function holdKeyUp(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') holdEnd();
	}

	function again() {
		phase = 'build';
		wishRise = false;
		copied = '';
		step = 0;
		applyLayout();
		scene?.setMode('build');
		scene?.setKrathong(normalizeKrathong(k));
	}

	function openGift() {
		ensureSound();
		phase = 'arriving';
		applyLayout();
		if (received) scene?.setKrathong(received);
		scene?.setMode('arrive');
		if (reduced) setTimeout(() => phase === 'arriving' && (phase = 'arrived'), 1500);
	}

	async function copy(text: string, what: 'gift') {
		try {
			await navigator.clipboard.writeText(text);
			copied = what;
			setTimeout(() => (copied = ''), 2400);
		} catch {
			window.prompt('Copy this link', text);
		}
	}
	async function nativeShare() {
		try {
			await navigator.share({ title: 'ลอยกระทง.txt', text: 'สุขสันต์วันลอยกระทง', url: shareUrl });
		} catch {
			/* cancelled */
		}
	}
	const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

	function onCanvasClick(e: MouseEvent) {
		if (!scene || !canvas) return;
		const r = canvas.getBoundingClientRect();
		const id = scene.hitTest(e.clientX - r.left, e.clientY - r.top);
		const it = id ? items.get(id) : null;
		reading = it ?? null;
		scene.setSelected(it ? it.id : null);
	}
	function onCanvasMove(e: PointerEvent) {
		if (!scene || !canvas || e.pointerType !== 'mouse') return;
		const r = canvas.getBoundingClientRect();
		canvas.style.cursor = scene.hitTest(e.clientX - r.left, e.clientY - r.top) ? 'pointer' : '';
	}
	function closeReading() {
		reading = null;
		scene?.setSelected(null);
	}
	function ago(t: number) {
		const s = Math.max(0, (Date.now() - t) / 1000);
		const f = new Intl.RelativeTimeFormat('th', { numeric: 'auto' });
		if (s < 60) return 'เมื่อสักครู่';
		if (s < 3600) return f.format(-Math.round(s / 60), 'minute');
		return f.format(-Math.round(s / 3600), 'hour');
	}

	const flowerArt: Record<FlowerKind, string[]> = {
		marigold: [' @%@ ', '%@%@%', ' @%@ '],
		orchid: [' &*& ', '*&*&*', '  |  '],
		lotus: ['  /\\  ', ' /\\/\\ ', '(____)'],
		jasmine: [' o*o ', '*o*o*', ' o*o '],
		garland: ['o8o8o', '8   8', ' o8o '],
		bud: ['  ^  ', ' (0) ', '  |  '],
		rose: [' e@e ', '@e@e@', '  |  '],
		mum: [' *#* ', '#*#*#', ' *#* '],
		dokrak: [' +x+ ', 'x+x+x', ' +x+ '],
	};
</script>

<svelte:head>
	<title>ลอยกระทง.txt — ลอยกระทงออนไลน์</title>
</svelte:head>

<div class="kr" data-phase={phase} class:mobile>
	<Atmosphere fixed fireflies={true} petals={false} moon={false} intensity={0.7} />
	<canvas
		bind:this={canvas}
		class="river"
		onclick={onCanvasClick}
		onpointermove={onCanvasMove}
		aria-label="แม่น้ำยามค่ำคืนใต้พระจันทร์เต็มดวง มีกระทงลอยอยู่ · An ASCII river at night with krathongs floating by"
	></canvas>

	<header class="mast">
		<div class="name">
			<h1><span class="th">ลอยกระทง</span><span class="ext">.txt</span></h1>
			<p class="date">คืนวันเพ็ญ เดือนสิบสอง · ๒๔ พ.ย. ๒๕๖๙</p>
		</div>
		<div class="meta">
			<p class="live" data-status={status}>
				{#if status === 'live'}
					<span class="pip" aria-hidden="true"></span> {th(count)} คนบนแม่น้ำ<span class="en"> · {count} on the river</span>
				{:else if status === 'connecting'}
					<span class="pip" aria-hidden="true"></span> กำลังต่อแม่น้ำ…<span class="en"> · connecting</span>
				{:else}
					<span class="pip" aria-hidden="true"></span> ลอยคนเดียวไปก่อน<span class="en"> · offline</span>
				{/if}
			</p>
			<button type="button" class="txtbtn" onclick={toggleSound} aria-pressed={soundOn && !muted}>
				[ {soundOn && !muted ? 'ปิดเสียง' : 'เปิดเพลง'} ]<span class="en"> {soundOn && !muted ? 'mute' : 'music'}</span>
			</button>
		</div>
	</header>

	{#if phase === 'build'}
		<section class="tray" aria-label="ประดิษฐ์กระทง · Make your krathong">
			<span class="c tl" aria-hidden="true">+</span><span class="c tr" aria-hidden="true">+</span><span class="c bl" aria-hidden="true">+</span><span class="c br" aria-hidden="true">+</span>
			<p class="tray-title" aria-hidden="true">[ ถาดกระทง ]</p>

			<nav class="steps" aria-label="ขั้นตอน">
				{#each steps as s, i (i)}
					<button type="button" class:on={step === i} aria-current={step === i ? 'step' : undefined} onclick={() => (step = i)}>
						<span class="num">{th(i + 1)}</span>
						<span class="lbl">{s.th}</span>
					</button>
					{#if i < steps.length - 1}<span class="dash" aria-hidden="true">—</span>{/if}
				{/each}
			</nav>
			<Kanok />

			<div class="body">
				{#if step === 0}
					<p class="say">เลือกตัวกระทงก่อน<span class="en">choose what it floats on · {BASES.length} kinds</span></p>
					<div class="row bases scroll">
						{#each BASES as b (b.id)}
							<button type="button" class="item" class:on={k.base === b.id} aria-pressed={k.base === b.id} onclick={() => (k.base = b.id)}>
								<AsciiPreview spec={{ ...k, base: b.id, lit: true }} width={11} />
								<span class="hand">{b.th}</span>
								<span class="en">{b.en}</span>
							</button>
						{/each}
					</div>
					{#if isLeafy(k.base)}
						<div class="chips" role="radiogroup" aria-label="ลายพับใบตอง · leaf fold">
							<span class="chips-label">ลายพับ <small>fold</small></span>
							{#each FOLD_INFO as f (f.id)}
								<button type="button" class="chip" class:on={k.fold === f.id} role="radio" aria-checked={k.fold === f.id} onclick={() => (k.fold = f.id)} title={f.en}>
									<code aria-hidden="true">{f.art}</code>{f.th}
								</button>
							{/each}
						</div>
					{/if}
					<p class="note">{BASES.find((b) => b.id === k.base)?.hintTh}</p>
				{:else if step === 1}
					<p class="say">หยิบดอกไม้ใส่ได้ {th(3)} อย่าง<span class="en">pick up to three</span></p>
					<div class="row flowers scroll">
						{#each FLOWERS as f (f.id)}
							<button type="button" class="item" class:on={k.flowers.includes(f.id)} aria-pressed={k.flowers.includes(f.id)} onclick={() => toggleFlower(f.id)}>
								<pre class="bunch" style:color={tintOf(f.id)} aria-hidden="true">{flowerArt[f.id].join('\n')}</pre>
								<span class="hand">{f.th}</span>
								<span class="box" aria-hidden="true">{k.flowers.includes(f.id) ? '[x]' : '[ ]'}</span>
							</button>
						{/each}
					</div>
					<ul class="receipt tints" aria-label="สีดอกไม้ · flower colours">
						{#each k.flowers as id, i (id)}
							<li>
								<span class="what">{flowerInfo(id).th} <small>สี{COLOR_INFO[k.colors[i] ?? 'natural'].th}</small></span><span class="lead"></span>
								<span class="sws" role="radiogroup" aria-label={`สี${flowerInfo(id).th}`}>
									{#each flowerInfo(id).colors as c (c)}
										<button type="button" class="sw" class:on={(k.colors[i] ?? 'natural') === c} role="radio" aria-checked={(k.colors[i] ?? 'natural') === c} style:--sw={swatch(id, c)} onclick={() => setColor(i, c)} aria-label={`${COLOR_INFO[c].th} · ${COLOR_INFO[c].en}`} title={COLOR_INFO[c].th}></button>
									{/each}
								</span>
							</li>
						{/each}
					</ul>
				{:else if step === 2}
					<p class="say">ของบูชาบนกระทง<span class="en">what goes on top</span></p>
					<ul class="receipt">
						<li>
							<span class="what">เทียน <small>candles</small></span><span class="lead"></span>
							<span class="stepper"><button type="button" onclick={() => stepCandles(-1)} disabled={k.candles <= 1} aria-label="เทียนน้อยลง · fewer candles">‹</button><span class="qty">{th(k.candles)} เล่ม</span><button type="button" onclick={() => stepCandles(1)} disabled={k.candles >= 3} aria-label="เทียนเพิ่ม · more candles">›</button></span>
						</li>
						<li>
							<span class="what">สีเทียน <small>{WAX_INFO[k.wax].th}</small></span><span class="lead"></span>
							<span class="sws" role="radiogroup" aria-label="สีเทียน · candle colour">
								{#each WAXES as c (c)}
									<button type="button" class="sw" class:on={k.wax === c} role="radio" aria-checked={k.wax === c} style:--sw={WAX_INFO[c].css} onclick={() => (k.wax = c)} aria-label={WAX_INFO[c].th} title={WAX_INFO[c].th}></button>
								{/each}
							</span>
						</li>
						<li>
							<span class="what">ธูป <small>incense</small></span><span class="lead"></span>
							<span class="stepper"><button type="button" onclick={() => stepIncense(-1)} disabled={k.incense === 0} aria-label="ธูปน้อยลง · less incense">‹</button><span class="qty">{k.incense ? `${th(k.incense)} ดอก` : 'ไม่ใส่'}</span><button type="button" onclick={() => stepIncense(1)} disabled={k.incense === 3} aria-label="ธูปเพิ่ม · more incense">›</button></span>
						</li>
						<li>
							<label>
								<input type="checkbox" bind:checked={k.coin} />
								<span class="what">เหรียญ <small>ขอให้มีโชค</small></span><span class="lead"></span><span class="qty">{th(1)} เหรียญ</span><span class="box" aria-hidden="true">{k.coin ? '[x]' : '[ ]'}</span>
							</label>
						</li>
						<li>
							<label>
								<input type="checkbox" bind:checked={k.hair} />
								<span class="what">เส้นผม <small>ลอยเคราะห์</small></span><span class="lead"></span><span class="qty">{th(1)} เส้น</span><span class="box" aria-hidden="true">{k.hair ? '[x]' : '[ ]'}</span>
							</label>
						</li>
						{#each DECOR_INFO as d (d.id)}
							<li>
								<label>
									<input type="checkbox" bind:checked={k[d.id]} />
									<span class="what">{d.th} <small>{d.small}</small></span><span class="lead"></span><span class="qty">{d.en}</span><span class="box" aria-hidden="true">{k[d.id] ? '[x]' : '[ ]'}</span>
								</label>
							</li>
						{/each}
						<li>
							<span class="what">สีประจำกระทง <small>{ACCENT_INFO[k.accent].th}</small></span><span class="lead"></span>
							<span class="sws" role="radiogroup" aria-label="สีประจำกระทง · accent">
								{#each ACCENTS as c (c)}
									<button type="button" class="sw" class:none={c === 'none'} class:on={k.accent === c} role="radio" aria-checked={k.accent === c} style:--sw={ACCENT_INFO[c].css || 'transparent'} onclick={() => (k.accent = c)} aria-label={`${ACCENT_INFO[c].th} · ${ACCENT_INFO[c].en}`} title={ACCENT_INFO[c].th}></button>
								{/each}
							</span>
						</li>
					</ul>
				{:else}
					<div class="wishrow">
						<div class="slip">
							<p class="slip-head">คำอธิษฐาน</p>
							<textarea bind:value={k.wish} oninput={() => (wishError = '')} maxlength={KLIMITS.wish} rows="3" placeholder="ขอให้…" aria-label="คำอธิษฐาน · your wish" class:folded={k.secret}></textarea>
							<div class="sign">
								<label><span>จาก</span><input bind:value={k.from} maxlength={24} placeholder="ชื่อเล่น" aria-label="จาก · from" /></label>
								<label><span>ถึง</span><input bind:value={k.to} maxlength={KLIMITS.to} placeholder="(ไม่ใส่ก็ได้)" aria-label="ถึง · to" /></label>
							</div>
							{#if wishError}<p class="wish-error" role="alert">{wishError} <small>· {REJECT_MESSAGE.en}</small></p>{/if}
							<label class="fold"><input type="checkbox" bind:checked={k.secret} /><span aria-hidden="true">{k.secret ? '[x]' : '[ ]'}</span> พับเก็บไว้ในใจ <small>· keep it secret</small></label>
						</div>
						<button
							type="button"
							class="candle"
							style:--p={hold}
							onpointerdown={holdBegin}
							onpointerup={holdEnd}
							onpointerleave={holdEnd}
							onpointercancel={holdEnd}
							onkeydown={holdKey}
							onkeyup={holdKeyUp}
							oncontextmenu={(e) => e.preventDefault()}
							aria-label="กดค้างเพื่อจุดเทียนแล้วลอยกระทง · press and hold to light the candle and float"
						>
							<span class="flame" aria-hidden="true"><span class="core"></span></span>
							<pre class="wax" aria-hidden="true">{" '\n |\n |\n |\n_|_"}</pre>
							<span class="how">{holdHint ? 'ค้างไว้อีกนิด' : 'กดค้าง จุดเทียน'}</span>
							<span class="en">hold to light &amp; float</span>
						</button>
					</div>
				{/if}
			</div>

			<div class="pager">
				<button type="button" class="txtbtn" disabled={step === 0} onclick={() => (step -= 1)}>‹ ย้อน</button>
				<span class="of">{th(step + 1)} / {th(4)}</span>
				{#if step < 3}
					<button type="button" class="txtbtn next" onclick={() => (step += 1)}>ต่อไป ›</button>
				{:else}
					<span class="txtbtn ghost">จุดเทียนเลย</span>
				{/if}
			</div>
		</section>
	{/if}

	{#if wishRise && (phase === 'floating' || phase === 'done')}
		<p class="wish-rise" class:still={reduced} style:left="{mobile ? 50 : 66}%" style:top="{mobile ? 34 : 60}%">
			{k.secret || !k.wish ? '·  ·  ·' : k.wish}
		</p>
	{/if}

	{#if phase === 'floating'}
		<p class="caption">กระทงกำลังลอยไป…<span class="en"> drifting downstream</span></p>
	{/if}

	{#if phase === 'done'}
		<section class="ending" aria-live="polite">
			<h2>ขอให้สมหวัง</h2>
			<p class="en-line">May it come true.</p>
			<p class="small">
				{#if sentLive}ลอยอยู่บนแม่น้ำแล้ว — ทุกคนที่เปิดอยู่เห็นกระทงของคุณ{:else}ลอยไปแล้ว (ออฟไลน์ — มีแค่คุณที่เห็น){/if}
			</p>
			<div class="links">
				<button type="button" class="txtbtn strong" onclick={() => copy(shareUrl, 'gift')}>[ {copied === 'gift' ? 'คัดลอกแล้ว ✓' : 'ส่งลิงก์ให้คนพิเศษ'} ]</button>
				{#if canShare}<button type="button" class="txtbtn" onclick={nativeShare}>[ แชร์ ]</button>{/if}
				<button type="button" class="txtbtn" onclick={again}>[ ลอยอีกใบ ]</button>
			</div>
		</section>
	{/if}

	{#if phase === 'invite' && received}
		<section class="invite">
			<p class="mono">จดหมายจากแม่น้ำ · a krathong from</p>
			<h2>{received.from || 'ใครบางคน'}</h2>
			{#if received.to}<p class="to">ถึง {received.to}</p>{/if}
			<Kanok tone="var(--candle)" />
			<button type="button" class="txtbtn strong big" onclick={openGift}>[ แตะเพื่อดูกระทงลอยมา ]<span class="en">tap to watch it arrive · music on</span></button>
		</section>
	{/if}

	{#if phase === 'arrived' && received}
		<section class="letter" aria-live="polite">
			<div class="slip read">
				<p class="slip-head">{received.to ? `ถึง ${received.to}` : 'คำอธิษฐาน'}</p>
				{#if received.secret || !received.wish || moderate(received.from, received.wish).action === 'reject'}
					<p class="wish">อธิษฐานไว้ในใจ<br /><small>a wish kept secret</small></p>
				{:else}
					<p class="wish">{received.wish}</p>
				{/if}
				{#if received.from}<p class="from">— {received.from}</p>{/if}
			</div>
			<div class="links">
				<a class="txtbtn strong" href="/" onclick={() => setTimeout(() => location.reload(), 0)}>[ ลอยกระทงของคุณเอง ]</a>
			</div>
		</section>
	{/if}

	{#if phase === 'broken'}
		<section class="invite">
			<h2>กระทงหลงทาง</h2>
			<p class="to">ลิงก์นี้ไม่ครบ อาจถูกตัดตอนคัดลอก · this link looks cut off</p>
			<a class="txtbtn strong big" href="/">[ ลอยกระทงของคุณเอง ]</a>
		</section>
	{/if}

	{#if reading}
		<aside class="slip reading" aria-live="polite">
			<button type="button" class="x" onclick={closeReading} aria-label="ปิด · close">×</button>
			<p class="slip-head">{reading.name || 'ไม่ประสงค์ออกนาม'} <small>· {ago(reading.t)}</small></p>
			{#if reading.wish}<p class="wish">{reading.wish}</p>{:else}<p class="wish quiet">อธิษฐานไว้ในใจ</p>{/if}
			{#if reading.id !== ownItem?.id}<button type="button" class="report" onclick={reportReading}>รายงาน <small>· report</small></button>{/if}
		</aside>
	{/if}

	{#if toast}<p class="toast" role="status">{toast}</p>{/if}
</div>

<style>
	.kr {
		position: relative;
		height: 100svh;
		overflow: hidden;
		background: var(--night);
		color: var(--moon);
		font-family: var(--thai);
		font-weight: 300;
	}
	.en {
		font-family: var(--mono);
		font-size: 0.72em;
		color: var(--moon-soft);
		letter-spacing: 0.02em;
		font-weight: 400;
	}
	.river {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		z-index: 1;
		touch-action: manipulation;
	}

	/* masthead */
	.mast {
		position: fixed;
		z-index: 5;
		inset: 0 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: clamp(0.9rem, 2.4vw, 1.6rem) clamp(1rem, 3vw, 2.4rem) 0;
		pointer-events: none;
	}
	.mast > * {
		pointer-events: auto;
	}
	h1 {
		margin: 0;
		font-family: var(--display);
		font-weight: 400;
		font-size: clamp(2rem, 5.2vw, 3.6rem);
		line-height: 1.15;
		color: var(--moon);
		letter-spacing: 0.01em;
		text-shadow: 0 2px 24px rgba(255, 210, 122, 0.18);
	}
	h1 .ext {
		font-family: var(--mono);
		font-size: 0.42em;
		color: var(--candle);
		margin-left: 0.1em;
	}
	.date {
		margin: 0.1rem 0 0;
		font-size: 0.82rem;
		color: var(--moon-soft);
		border-top: 1px solid var(--moon-faint);
		padding-top: 0.3rem;
		display: inline-block;
	}
	.meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.2rem;
		font-size: 0.85rem;
		text-align: right;
	}
	.live {
		margin: 0.4rem 0 0;
		font-weight: 400;
	}
	.pip {
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--leaf);
		box-shadow: 0 0 8px var(--leaf);
		margin-right: 0.2rem;
		vertical-align: 0.05em;
		animation: breathe 2.4s ease-in-out infinite;
	}
	.live[data-status='connecting'] .pip {
		background: var(--candle);
		box-shadow: 0 0 8px var(--candle);
	}
	.live[data-status='offline'] .pip {
		background: var(--moon-faint);
		box-shadow: none;
		animation: none;
	}
	.txtbtn {
		border: 0;
		background: none;
		padding: 0.15rem 0;
		color: var(--moon);
		font: inherit;
		font-family: var(--mono);
		font-size: 0.82rem;
		cursor: pointer;
		text-decoration: none;
		letter-spacing: 0.01em;
	}
	.txtbtn:hover:not(:disabled) {
		color: var(--candle);
	}
	.txtbtn:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.txtbtn.strong {
		color: var(--candle);
		font-size: 0.95rem;
	}
	.txtbtn.ghost {
		color: var(--moon-faint);
		cursor: default;
	}
	:global(.kr button:focus-visible),
	:global(.kr a:focus-visible),
	:global(.kr input:focus-visible) {
		outline: 1px dashed var(--candle);
		outline-offset: 3px;
	}

	/* the tray */
	.tray {
		position: fixed;
		z-index: 4;
		left: clamp(1rem, 3vw, 2.4rem);
		bottom: 3.2rem;
		width: min(27rem, calc(100% - 2rem));
		padding: 1.25rem 1.2rem 0.8rem;
		background: rgba(9, 12, 20, 0.93);
		border: 1px solid rgba(243, 234, 216, 0.14);
		border-radius: 1px;
		animation: settle 0.9s var(--ease-out) both;
	}
	.c {
		position: absolute;
		font-family: var(--mono);
		font-size: 0.8rem;
		line-height: 1;
		color: var(--candle);
	}
	.tl {
		top: -0.45rem;
		left: -0.3rem;
	}
	.tr {
		top: -0.45rem;
		right: -0.3rem;
	}
	.bl {
		bottom: -0.45rem;
		left: -0.3rem;
	}
	.br {
		bottom: -0.45rem;
		right: -0.3rem;
	}
	.tray-title {
		position: absolute;
		top: -0.6rem;
		left: 1rem;
		margin: 0;
		padding: 0 0.4rem;
		background: #090c14;
		font-family: var(--mono);
		font-size: 0.75rem;
		color: var(--candle);
	}
	.steps {
		display: flex;
		align-items: baseline;
		gap: 0.3rem;
		margin-bottom: 0.55rem;
		flex-wrap: nowrap;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.steps button {
		border: 0;
		background: none;
		color: var(--moon-soft);
		font: inherit;
		font-size: 0.84rem;
		padding: 0.15rem 0;
		cursor: pointer;
		white-space: nowrap;
		border-bottom: 1px solid transparent;
	}
	.steps .num {
		font-family: var(--thai);
		color: var(--moon-faint);
		margin-right: 0.15rem;
	}
	.steps button.on {
		color: var(--moon);
		border-bottom-color: var(--marigold);
	}
	.steps button.on .num {
		color: var(--marigold);
	}
	.dash {
		color: var(--moon-faint);
		font-size: 0.7rem;
	}
	.body {
		min-height: 12.2rem;
		max-height: min(21rem, 52vh);
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-width: thin;
		scrollbar-color: rgba(243, 234, 216, 0.18) transparent;
		padding-top: 0.75rem;
		padding-right: 0.15rem;
	}
	.row.scroll {
		grid-auto-columns: minmax(4.9rem, 1fr);
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
		mask-image: linear-gradient(90deg, #000 88%, transparent);
	}
	.row.scroll::-webkit-scrollbar {
		display: none;
	}
	.row.scroll .item {
		scroll-snap-align: start;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.2rem 0.5rem;
		margin-top: 0.55rem;
		font-size: 0.85rem;
	}
	.chips-label {
		color: var(--moon-soft);
		font-size: 0.78rem;
	}
	.chips-label small {
		font-size: 0.62rem;
		color: var(--moon-faint);
	}
	.chip {
		border: 0;
		border-bottom: 1px dashed rgba(243, 234, 216, 0.2);
		background: none;
		color: var(--moon-soft);
		font: inherit;
		padding: 0.15rem 0.1rem;
		cursor: pointer;
	}
	.chip code {
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--leaf);
		margin-right: 0.3rem;
		opacity: 0.6;
	}
	.chip.on {
		color: var(--moon);
		border-bottom: 1px solid var(--marigold);
	}
	.chip.on code {
		opacity: 1;
	}
	.chip:focus-visible,
	.sw:focus-visible,
	.stepper button:focus-visible {
		outline: 1px dashed var(--candle);
		outline-offset: 2px;
	}
	.tints {
		margin-top: 0.5rem;
		font-size: 0.85rem;
	}
	.sws {
		display: inline-flex;
		gap: 0.28rem;
		align-items: center;
	}
	.sw {
		width: 0.95rem;
		height: 0.95rem;
		padding: 0;
		border-radius: 50%;
		border: 1px solid rgba(243, 234, 216, 0.25);
		background: var(--sw);
		cursor: pointer;
		position: relative;
		transition: transform 0.2s var(--ease-out);
	}
	.sw.none {
		background: repeating-linear-gradient(135deg, transparent 0 3px, rgba(243, 234, 216, 0.35) 3px 4px);
	}
	.sw.on {
		transform: scale(1.18);
		box-shadow: 0 0 0 2px #090c14, 0 0 0 3px var(--marigold);
	}
	.stepper {
		display: inline-flex;
		align-items: baseline;
		gap: 0.25rem;
	}
	.stepper button {
		border: 0;
		background: none;
		color: var(--marigold);
		font-family: var(--mono);
		font-size: 0.95rem;
		padding: 0 0.2rem;
		cursor: pointer;
	}
	.stepper button:disabled {
		color: var(--moon-faint);
		cursor: default;
	}
	.stepper .qty {
		min-width: 3.2rem;
		text-align: center;
	}
	.say {
		margin: 0 0 0.7rem;
		font-family: var(--hand);
		font-size: 1.15rem;
		color: var(--paper);
		line-height: 1.3;
	}
	.say .en {
		display: block;
		font-size: 0.68rem;
		margin-top: 0.1rem;
	}
	.row {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
	}
	.item {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
		background: none;
		border: 0;
		border-left: 1px dashed rgba(243, 234, 216, 0.14);
		color: var(--moon);
		cursor: pointer;
		padding: 0.4rem 0.2rem 0.3rem;
		font: inherit;
		transition: transform 0.35s var(--ease-out);
	}
	.item:first-child {
		border-left: 0;
	}
	.item:hover {
		transform: translateY(-2px);
	}
	.item::before,
	.item::after {
		position: absolute;
		top: 30%;
		font-family: var(--mono);
		font-size: 1.6rem;
		font-weight: 300;
		color: var(--marigold);
		opacity: 0;
		transition: opacity 0.25s, transform 0.35s var(--ease-out);
	}
	.item::before {
		content: '[';
		left: 0.15rem;
		transform: translateX(-4px);
	}
	.item::after {
		content: ']';
		right: 0.15rem;
		transform: translateX(4px);
	}
	.bases .item.on::before,
	.bases .item.on::after {
		opacity: 1;
		transform: none;
	}
	.hand {
		font-family: var(--hand);
		font-size: 1.02rem;
		line-height: 1.3;
		margin-top: 0.3rem;
	}
	.item .en {
		font-size: 0.62rem;
	}
	.item:not(.on) .hand {
		color: var(--moon-soft);
	}
	.note {
		margin: 0.6rem 0 0;
		font-size: 0.78rem;
		color: var(--moon-soft);
		border-left: 2px solid var(--leaf-deep);
		padding-left: 0.55rem;
	}
	.bunch {
		margin: 0;
		font-family: var(--mono);
		font-size: 0.78rem;
		line-height: 1.05;
		opacity: 0.42;
		transition: opacity 0.3s, text-shadow 0.3s;
	}
	.flowers .item.on .bunch {
		opacity: 1;
		text-shadow: 0 0 10px currentColor;
	}
	.box {
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--marigold);
	}
	.item:not(.on) .box {
		color: var(--moon-faint);
	}
	.receipt {
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 0.95rem;
	}
	.receipt li,
	.receipt label {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		padding: 0.36rem 0;
	}
	.receipt label {
		width: 100%;
		padding: 0;
		cursor: pointer;
	}
	.receipt li + li {
		border-top: 1px solid rgba(243, 234, 216, 0.06);
	}
	.receipt input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.receipt small {
		color: var(--moon-soft);
		font-size: 0.72rem;
	}
	.lead {
		flex: 1;
		border-bottom: 1px dotted var(--moon-faint);
		transform: translateY(-0.25rem);
	}
	.qty {
		font-size: 0.8rem;
		color: var(--moon-soft);
	}
	.receipt label:has(input:focus-visible) {
		outline: 1px dashed var(--candle);
		outline-offset: 2px;
	}
	.receipt label:has(input:checked) .what {
		color: var(--candle);
	}

	/* the wish slip (banana-leaf note) */
	.wishrow {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 5.2rem;
		gap: 0.9rem;
		align-items: end;
	}
	.slip {
		position: relative;
		min-width: 0;
		background:
			repeating-linear-gradient(180deg, transparent 0 1.55rem, rgba(59, 42, 24, 0.13) 1.55rem calc(1.55rem + 1px)),
			radial-gradient(120% 80% at 20% 10%, #f6ecd3, #e8d8b4);
		color: var(--paper-ink);
		padding: 0.75rem 0.85rem 0.6rem;
		clip-path: polygon(0 4px, 4% 0, 9% 4px, 14% 0, 19% 4px, 24% 0, 29% 4px, 34% 0, 39% 4px, 44% 0, 49% 4px, 54% 0, 59% 4px, 64% 0, 69% 4px, 74% 0, 79% 4px, 84% 0, 89% 4px, 94% 0, 100% 4px, 100% 100%, 0 100%);
		box-shadow: 0 14px 30px -18px rgba(0, 0, 0, 0.9);
		transform: rotate(-0.6deg);
	}
	.slip::after {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 5px;
		background: var(--leaf-deep);
		opacity: 0.85;
	}
	.slip-head {
		margin: 0 0 0.1rem;
		font-family: var(--hand);
		font-size: 0.85rem;
		color: #7a5a2e;
	}
	.slip textarea {
		display: block;
		width: 100%;
		border: 0;
		background: transparent;
		resize: none;
		font-family: var(--hand);
		font-size: 1.12rem;
		line-height: 1.55rem;
		color: var(--paper-ink);
		padding: 0;
		outline: none;
		transition: filter 0.4s, opacity 0.4s;
	}
	.slip textarea::placeholder {
		color: rgba(59, 42, 24, 0.4);
	}
	.slip textarea.folded {
		filter: blur(3.5px);
		opacity: 0.7;
	}
	.sign {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
		margin-top: 0.35rem;
	}
	.sign label {
		min-width: 0;
		display: flex;
		align-items: baseline;
		gap: 0.3rem;
		font-size: 0.78rem;
		color: #7a5a2e;
	}
	.sign input {
		min-width: 0;
		flex: 1;
		border: 0;
		border-bottom: 1px solid rgba(59, 42, 24, 0.35);
		background: transparent;
		font-family: var(--hand);
		font-size: 0.95rem;
		color: var(--paper-ink);
		padding: 0 0 0.05rem;
		outline: none;
	}
	.sign input::placeholder {
		color: rgba(59, 42, 24, 0.35);
	}
	.fold {
		display: block;
		margin-top: 0.45rem;
		font-size: 0.78rem;
		color: #5a4022;
		cursor: pointer;
	}
	.fold input {
		position: absolute;
		opacity: 0;
	}
	.fold span {
		font-family: var(--mono);
	}
	.fold small {
		font-family: var(--mono);
		font-size: 0.65rem;
		opacity: 0.7;
	}

	/* the candle you light */
	.candle {
		--p: 0;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		border: 0;
		background: none;
		color: var(--moon);
		cursor: pointer;
		padding: 2.6rem 0 0;
		font: inherit;
		user-select: none;
		-webkit-user-select: none;
		touch-action: none;
	}
	.flame {
		position: absolute;
		top: calc(1.9rem - var(--p) * 1.3rem);
		left: 50%;
		width: calc(0.25rem + var(--p) * 0.9rem);
		height: calc(0.4rem + var(--p) * 1.9rem);
		transform: translateX(-50%);
		border-radius: 50% 50% 45% 45% / 65% 65% 35% 35%;
		background: radial-gradient(60% 70% at 50% 70%, #fff7d6, #ffcf6b 45%, #f2832e 80%, transparent);
		box-shadow: 0 0 calc(var(--p) * 40px) calc(var(--p) * 10px) rgba(255, 170, 70, 0.55);
		opacity: calc(0.25 + var(--p));
		transition: opacity 0.2s;
	}
	.candle:hover .flame {
		opacity: calc(0.45 + var(--p));
	}
	.core {
		position: absolute;
		left: 30%;
		right: 30%;
		bottom: 12%;
		height: 35%;
		border-radius: 50%;
		background: #fffbe8;
		opacity: var(--p);
	}
	.wax {
		margin: 0;
		font-family: var(--mono);
		font-size: 1.1rem;
		font-weight: 600;
		line-height: 1;
		color: var(--paper);
		text-shadow: 0 0 calc(var(--p) * 12px) rgba(255, 200, 110, 0.9);
	}
	.how {
		margin-top: 0.4rem;
		font-family: var(--hand);
		font-size: 0.95rem;
		color: var(--candle);
		white-space: nowrap;
	}
	.candle .en {
		font-size: 0.58rem;
		white-space: nowrap;
	}
	.pager {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-top: 0.8rem;
		padding-top: 0.55rem;
		border-top: 1px solid rgba(243, 234, 216, 0.08);
	}
	.pager .of {
		font-size: 0.75rem;
		color: var(--moon-faint);
	}
	.pager .next {
		color: var(--candle);
	}

	/* floating + endings */
	.wish-rise {
		position: fixed;
		z-index: 3;
		transform: translate(-50%, 0);
		margin: 0;
		max-width: min(22rem, 80vw);
		text-align: center;
		font-family: var(--hand);
		font-size: clamp(1.05rem, 2.6vw, 1.35rem);
		color: #fff1cf;
		text-shadow: 0 0 18px rgba(255, 200, 110, 0.8);
		pointer-events: none;
		animation: wish 7s var(--ease-soft) 0.8s both;
	}
	.wish-rise.still {
		animation: fadein 2s ease both;
	}
	.caption {
		position: fixed;
		z-index: 4;
		left: 50%;
		bottom: 3.4rem;
		transform: translateX(-50%);
		margin: 0;
		font-size: 0.9rem;
		color: var(--moon-soft);
		white-space: nowrap;
		animation: fadein 1.2s ease both;
	}
	.ending {
		position: fixed;
		z-index: 4;
		left: clamp(1rem, 3vw, 2.4rem);
		bottom: 3.4rem;
		max-width: 26rem;
		animation: settle 1.1s var(--ease-out) both;
	}
	.ending h2,
	.invite h2 {
		margin: 0;
		font-family: var(--display);
		font-weight: 400;
		font-size: clamp(2.2rem, 6vw, 3.4rem);
		line-height: 1.2;
		color: var(--candle);
		text-shadow: 0 0 34px rgba(255, 190, 90, 0.35);
	}
	.en-line {
		margin: 0.1rem 0 0.5rem;
		font-family: var(--mono);
		font-size: 0.82rem;
		color: var(--moon-soft);
	}
	.small {
		margin: 0 0 0.7rem;
		font-size: 0.85rem;
		color: var(--moon-soft);
		max-width: 22rem;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 1rem;
	}
	.invite {
		position: fixed;
		z-index: 4;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 2rem;
		background: radial-gradient(60% 50% at 50% 50%, rgba(7, 8, 15, 0.82), rgba(7, 8, 15, 0.35) 70%, transparent);
		animation: fadein 1.2s ease both;
	}
	.invite .mono {
		margin: 0 0 0.3rem;
		font-family: var(--mono);
		font-size: 0.78rem;
		color: var(--moon-soft);
		letter-spacing: 0.04em;
	}
	.invite .to {
		margin: 0.2rem 0 0.8rem;
		color: var(--lotus);
	}
	.invite :global(.kanok) {
		max-width: 14rem;
		margin: 0.4rem auto 1rem;
	}
	.big {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		font-size: 1.05rem;
	}
	.letter {
		position: fixed;
		z-index: 4;
		left: clamp(1rem, 3vw, 2.4rem);
		bottom: 3.4rem;
		width: min(24rem, calc(100% - 2rem));
		animation: settle 1.1s var(--ease-out) both;
	}
	.slip.read {
		padding: 1rem 1.1rem 0.9rem 1.3rem;
		margin-bottom: 0.9rem;
	}
	.slip .wish {
		margin: 0.2rem 0 0;
		font-family: var(--hand);
		font-size: 1.25rem;
		line-height: 1.55rem;
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.slip .wish small {
		font-family: var(--mono);
		font-size: 0.7rem;
		opacity: 0.6;
	}
	.slip .wish.quiet {
		opacity: 0.6;
	}
	.slip .from {
		margin: 0.4rem 0 0;
		text-align: right;
		font-family: var(--hand);
		color: #7a5a2e;
	}
	.reading {
		position: fixed;
		z-index: 6;
		right: clamp(1rem, 3vw, 2.4rem);
		bottom: 3.4rem;
		width: min(20rem, calc(100% - 2rem));
		padding: 0.9rem 1rem 0.8rem 1.2rem;
		animation: settle 0.5s var(--ease-out) both;
	}
	.reading .x {
		position: absolute;
		right: 0.4rem;
		top: 0.3rem;
		border: 0;
		background: none;
		font-size: 1.2rem;
		color: #7a5a2e;
		cursor: pointer;
	}
	.wish-error {
		margin: 0.35rem 0 0;
		font-family: var(--thai);
		font-size: 0.82rem;
		color: #8a2b1a;
	}
	.wish-error small {
		font-family: var(--mono);
		font-size: 0.65rem;
		opacity: 0.8;
	}
	.reading .report {
		display: block;
		margin: 0.5rem 0 0 auto;
		border: 0;
		background: none;
		padding: 0.1rem 0;
		font-family: var(--thai);
		font-size: 0.75rem;
		color: #7a5a2e;
		text-decoration: underline dotted;
		text-underline-offset: 3px;
		cursor: pointer;
		opacity: 0.75;
	}
	.reading .report:hover,
	.reading .report:focus-visible {
		opacity: 1;
	}
	.reading small {
		font-family: var(--mono);
		font-size: 0.65rem;
	}
	.toast {
		position: fixed;
		z-index: 7;
		left: 50%;
		top: 5.5rem;
		transform: translateX(-50%);
		margin: 0;
		padding: 0.4rem 0.8rem;
		background: #090c14;
		border: 1px solid var(--moon-faint);
		font-size: 0.82rem;
		white-space: nowrap;
	}

	/* mobile: the tray is a sheet along the bank */
	.mobile .mast {
		padding: 0.8rem 0.9rem 0;
	}
	.mobile h1 {
		font-size: 1.75rem;
	}
	.mobile .date {
		font-size: 0.7rem;
	}
	.mobile .meta {
		font-size: 0.74rem;
	}
	.mobile .meta .en {
		display: none;
	}
	.mobile .tray {
		left: 0.55rem;
		right: 0.55rem;
		width: auto;
		bottom: 1.9rem;
		padding: 1.05rem 0.85rem 0.55rem;
		animation-name: rise;
	}
	.mobile .body {
		min-height: 11rem;
		max-height: 40vh;
		padding-top: 0.6rem;
	}
	.mobile .steps button {
		font-size: 0.8rem;
	}
	.mobile .ending,
	.mobile .letter {
		left: 0.9rem;
		right: 0.9rem;
		bottom: 2.4rem;
		width: auto;
	}
	.mobile .reading {
		left: 0.9rem;
		right: 0.9rem;
		width: auto;
		bottom: 2.4rem;
	}
	.mobile .caption {
		bottom: 2.4rem;
	}

	@keyframes settle {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(40px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes fadein {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes breathe {
		50% {
			opacity: 0.45;
		}
	}
	@keyframes wish {
		0% {
			opacity: 0;
			transform: translate(-50%, 0);
			filter: blur(4px);
		}
		15% {
			opacity: 1;
			filter: blur(0);
		}
		70% {
			opacity: 0.9;
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -36vh);
			filter: blur(2px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.tray,
		.ending,
		.letter,
		.invite,
		.reading,
		.caption,
		.pip {
			animation: none !important;
		}
	}
</style>
