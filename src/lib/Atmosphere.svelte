<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { createSky, type SkyHandle } from './fx';
	const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	let {
		fireflies = true,
		petals = true,
		moon = true,
		intensity = 1,
		fixed = false,
	}: {
		fireflies?: boolean;
		petals?: boolean;
		moon?: boolean;
		intensity?: number;
		fixed?: boolean;
	} = $props();

	const reduced = prefersReducedMotion();
	let canvas: HTMLCanvasElement | undefined;
	let host: HTMLDivElement | undefined;
	let sky: SkyHandle | undefined;
	let raf = 0;
	let px = 0;
	let py = 0;
	let tx = 0;
	let ty = 0;
	let visible = true;

	function onMove(e: PointerEvent) {
		if (reduced || !host) return;
		const r = host.getBoundingClientRect();
		tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
		ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
	}

	function startLoop() {
		if (!raf) raf = requestAnimationFrame(frame);
	}

	function stopLoop() {
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	}

	function frame(now: number) {
		if (!visible) {
			raf = 0;
			return;
		}
		px += (tx - px) * 0.06;
		py += (ty - py) * 0.06;
		sky?.draw(now, { x: px, y: py });
		raf = requestAnimationFrame(frame);
	}

	onMount(() => {
		if (!canvas) return;
		sky = createSky(canvas, { reduced, fireflies, petals });
		const ro = new ResizeObserver(() => sky?.resize());
		ro.observe(canvas);
		const io = new IntersectionObserver((entries) => {
			visible = entries.some((e) => e.isIntersecting && e.intersectionRatio > 0);
			if (visible && !document.hidden) startLoop();
			else stopLoop();
		});
		if (host) io.observe(host);
		const onVis = () => {
			if (document.hidden) stopLoop();
			else if (visible) startLoop();
		};
		document.addEventListener('visibilitychange', onVis);
		if (visible && !document.hidden) startLoop();
		return () => {
			ro.disconnect();
			io.disconnect();
			document.removeEventListener('visibilitychange', onVis);
			stopLoop();
		};
	});

	onDestroy(() => {
		cancelAnimationFrame(raf);
		sky?.destroy();
	});
</script>

<div class="sky" class:pinned={fixed} bind:this={host} style:--intensity={intensity} onpointermove={onMove} aria-hidden="true">
	<canvas bind:this={canvas}></canvas>
	{#if moon}
		<div class="moon-lift">
			<div class="rays"></div>
			<div class="glow"></div>
			<div class="moon"></div>
		</div>
		<div class="haze"></div>
	{/if}
</div>

<style>
	.sky.pinned {
		position: fixed;
		z-index: 0;
	}
	.sky {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		background:
			radial-gradient(120% 80% at 50% 115%, rgba(40, 24, 60, 0.55), transparent 55%),
			radial-gradient(60% 50% at 80% 8%, rgba(255, 230, 190, 0.16), transparent 50%),
			radial-gradient(80% 60% at 10% 0%, rgba(80, 100, 170, 0.16), transparent 50%),
			linear-gradient(180deg, #07080f 0%, #0c101a 55%, #14101a 100%);
	}
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
	.moon-lift {
		position: absolute;
		top: 0;
		right: 0;
		width: min(46vw, 24rem);
		height: min(46vw, 24rem);
		pointer-events: none;
	}
	.glow {
		position: absolute;
		left: 50%;
		top: 28%;
		width: 42%;
		height: 42%;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		background: radial-gradient(circle, rgba(255, 236, 200, 0.5) 0%, rgba(255, 236, 200, 0.12) 45%, transparent 70%);
	}
	.moon {
		position: absolute;
		left: 50%;
		top: 28%;
		width: clamp(4.5rem, 10vw, 8.5rem);
		height: clamp(4.5rem, 10vw, 8.5rem);
		transform: translate(-50%, -50%);
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, #fffaf0, #f0e2c4 46%, #d9c49a 100%);
		box-shadow: 0 0 28px 8px rgba(255, 236, 200, 0.28);
	}
	.rays {
		position: absolute;
		inset: -35%;
		background: repeating-conic-gradient(
			from 12deg at 50% 38%,
			rgba(255, 236, 200, 0.1) 0 0.4deg,
			transparent 0.4deg 16deg
		);
		-webkit-mask-image: radial-gradient(circle at 50% 38%, #000 0 8%, transparent 55%);
		mask-image: radial-gradient(circle at 50% 38%, #000 0 8%, transparent 55%);
		opacity: calc(0.85 * var(--intensity, 1));
	}
	.haze {
		position: absolute;
		inset: auto 0 0;
		height: 38%;
		background: linear-gradient(180deg, transparent, rgba(20, 12, 28, 0.55));
	}
</style>
