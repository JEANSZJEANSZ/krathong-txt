/**
 * The ASCII night river for Loy Krathong: moon + glade, stars, temple shore,
 * sky lanterns, fireworks, layered water, ambient krathongs and the hero krathong.
 * Glyphs are blitted from a cached atlas so a full-screen grid holds 60fps.
 */
import { lookFromWire, type BaseId, type FlowerKind, type Krathong, type Look } from './model';
import { buildSprite, hex, type RGB, type SpriteSpec } from './sprite';

export type LiveInput = { id: string; look: Look; label: string };
export type SceneMode = 'build' | 'float' | 'arrive';
export type SceneEvent = 'arrived' | 'floated' | 'gone';
export type SceneLayout = { homeX: number; homeY: number; horizon: number; moonX: number; moonY: number };

export type KrathongScene = {
	setKrathong(k: Krathong): void;
	setMode(m: SceneMode): void;
	setLayout(l: Partial<SceneLayout>): void;
	resize(): void;
	draw(now: number): void;
	destroy(): void;
	/** Friends' krathongs from the live river. `fresh` ones enter from upstream with a name tag. */
	addLive(item: LiveInput, fresh: boolean): void;
	clearLive(): void;
	removeLive(id: string): void;
	/** Returns the live krathong id under a CSS-pixel point, if any. */
	hitTest(x: number, y: number): string | null;
	setSelected(id: string | null): void;
	/** Freeze time for deterministic stills (screenshots/tests). */
	_freeze?: (t: number | null) => void;
};

const AMBIENT_N = 7;
const FLOAT_S = 26;
const ARRIVE_S = 11;

function hash(a: number, b: number, s = 0): number {
	let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function mulberry(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const scale = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u));

const MOON_HI = hex('#fffaf0');
const MOON_LO = hex('#cdb88e');
const GLADE = hex('#ffe9bd');
const WATER_DEEP = hex('#0d2440');
const WATER_HI = hex('#4f8fb8');
const SHORE = hex('#16202e');
const TEMPLE = hex('#6e5632');
const TEMPLE_HI = hex('#d9b66a');
const WARM = hex('#ffb35c');
const FW_COLORS = [hex('#ffe14a'), hex('#ff79de'), hex('#b8ffc8'), hex('#7cbcff'), hex('#ffb3e0')];

const BASE_IDS: BaseId[] = ['leaf', 'leaf', 'leaf', 'pleat', 'petal', 'bread', 'cone', 'coconut', 'ice', 'hyacinth', 'boat'];
const KINDS: FlowerKind[] = ['marigold', 'marigold', 'orchid', 'lotus', 'jasmine', 'garland', 'bud', 'rose', 'mum', 'dokrak'];

type Ambient = { spec: SpriteSpec; z: number; x: number; speed: number; phase: number };
type Live = Ambient & { id: string; born: number; label: string; fresh: boolean };
type Ripple = { x: number; y: number; t0: number; big: boolean };

export function createKrathongScene(
	canvas: HTMLCanvasElement,
	opts: { reduced?: boolean; onEvent?: (e: SceneEvent) => void } = {},
): KrathongScene {
	const ctx = canvas.getContext('2d', { alpha: true })!;
	const reduced = !!opts.reduced;
	let dpr = 1;
	let cw = 7;
	let ch = 12;
	let fs = 11;
	let cols = 0;
	let rows = 0;
	let codes = new Uint16Array(0);
	let colr = new Float32Array(0);
	let layout: SceneLayout = { homeX: 0.6, homeY: 0.82, horizon: 0.5, moonX: 0.74, moonY: 0.2 };
	let hero: Krathong | null = null;
	let mode: SceneMode = 'build';
	let modeT0 = 0;
	let fired = new Set<SceneEvent>();
	let frozen: number | null = null;
	let lastT = 0;
	// Adaptive quality: if frames run long, drop DPR, then enlarge cells (fewer glyphs).
	let dprCap = 2;
	let fsBoost = 1;
	let ema = 0;
	let emaN = 0;
	let downgrades = 0;
	const ripples: Ripple[] = [];
	const live: Live[] = [];
	const boxes = new Map<string, { x: number; y: number; w: number; h: number }>();
	let selected: string | null = null;
	let liveSeed = 1;
	const LIVE_MAX = 16;
	const atlas = new Map<string, HTMLCanvasElement>();

	const rnd = mulberry(2611);
	const ambient: Ambient[] = Array.from({ length: AMBIENT_N }, (_, i) => {
		const n = 1 + Math.floor(rnd() * 3);
		const flowers: FlowerKind[] = [];
		for (let k = 0; k < n; k++) flowers.push(KINDS[Math.floor(rnd() * KINDS.length)]);
		return {
			spec: {
				...lookFromWire({ base: BASE_IDS[Math.floor(rnd() * BASE_IDS.length)], flowers }),
				fold: (['nail', 'nail', 'rose', 'pakha'] as const)[Math.floor(rnd() * 4)],
				candles: rnd() < 0.2 ? 3 : 1,
				lanterns: rnd() < 0.2,
				flags: rnd() < 0.15,
				lit: true,
			},
			z: 0.03 + ((i * 3) % AMBIENT_N / AMBIENT_N) * 0.3 + rnd() * 0.03,
			x: i / AMBIENT_N + rnd() * 0.08,
			speed: 0.5 + rnd() * 0.6,
			phase: rnd() * 10,
		};
	});

	// Each glyph+colour is rendered once to a tiny canvas, then blitted (fast on GPU and CPU rasterisers).
	let slotW = 10;
	let slotH = 16;
	function resetSheet() {
		slotW = Math.ceil(cw * dpr) + 2;
		slotH = Math.ceil(ch * dpr) + 2;
		atlas.clear();
	}
	function glyph(c: string, rgb: RGB): HTMLCanvasElement {
		const r = Math.min(255, Math.round(rgb[0] / 10) * 10);
		const g = Math.min(255, Math.round(rgb[1] / 10) * 10);
		const b = Math.min(255, Math.round(rgb[2] / 10) * 10);
		const key = c + ((r << 16) | (g << 8) | b);
		let cv = atlas.get(key);
		if (cv) return cv;
		if (atlas.size > 8000) atlas.clear();
		cv = document.createElement('canvas');
		cv.width = slotW;
		cv.height = slotH;
		const g2 = cv.getContext('2d')!;
		g2.font = `${fs * dpr}px 'IBM Plex Mono', ui-monospace, monospace`;
		g2.textBaseline = 'middle';
		g2.textAlign = 'center';
		g2.fillStyle = `rgb(${r},${g},${b})`;
		g2.fillText(c, slotW / 2, slotH / 2 + 0.5);
		atlas.set(key, cv);
		return cv;
	}

	function resize() {
		const rect = canvas.getBoundingClientRect();
		const w = Math.max(1, rect.width);
		const h = Math.max(1, rect.height);
		dpr = Math.min(w * h > 1.6e6 ? 1.5 : 2, window.devicePixelRatio || 1, dprCap);
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		fs = (w < 520 ? 10.5 : w < 1000 ? 12 : 14) * fsBoost;
		ctx.font = `${fs}px 'IBM Plex Mono', ui-monospace, monospace`;
		cw = ctx.measureText('M').width || fs * 0.6;
		ch = Math.round(fs * 1.08 * 10) / 10;
		cols = Math.ceil(w / cw);
		rows = Math.ceil(h / ch);
		codes = new Uint16Array(cols * rows);
		colr = new Float32Array(cols * rows * 3);
		resetSheet();
	}

	function set(x: number, y: number, c: string, rgb: RGB) {
		if (x < 0 || y < 0 || x >= cols || y >= rows) return;
		const i = y * cols + x;
		codes[i] = c.charCodeAt(0);
		colr[i * 3] = rgb[0];
		colr[i * 3 + 1] = rgb[1];
		colr[i * 3 + 2] = rgb[2];
	}

	const aspect = () => ch / cw;
	const moonR = () => Math.max(3, Math.min(rows * 0.085, (cols * 0.1) / aspect()));
	const hz = () => Math.round(rows * layout.horizon);
	const homeRow = () => rows * layout.homeY;
	const heroW = () => {
		const raw = cols < 90 ? cols * 0.36 : cols * 0.2;
		return Math.max(17, Math.min(37, raw));
	};
	/** Sprite width for a waterline row: linear in distance below the horizon (perspective). */
	const widthAt = (row: number) => heroW() * clamp((row - hz()) / (homeRow() - hz()), 0, 1.4);

	// ------------------------------------------------------------- hero path
	function heroPose(t: number): { x: number; y: number; s: number; flare: number; alpha: number } | null {
		if (!hero) return null;
		const hx = cols * layout.homeX;
		const hy = homeRow();
		const span = hy - hz();
		if (mode === 'build') return { x: hx, y: hy, s: 1, flare: 0, alpha: 1 };
		const u = (t - modeT0) / (mode === 'float' ? FLOAT_S : ARRIVE_S);
		if (mode === 'float') {
			const push = clamp((t - modeT0) / 1.4);
			const uu = clamp((t - modeT0 - 1.0) / (FLOAT_S - 1.0));
			const d = 1 + 9 * Math.pow(uu, 1.15);
			const drift = cols * (cols < 90 ? 0.28 : 0.2);
			return {
				x: hx + drift * (1 - 1 / d) + Math.sin(uu * 5) * 0.6 * (1 - uu),
				y: hz() + span / d + (1 - push) * 0,
				s: 1 / d,
				flare: clamp(1 - Math.abs((t - modeT0) - 0.9) / 0.9),
				alpha: u > 0.92 ? clamp((1 - u) / 0.08) : 1,
			};
		}
		// arrive: drift in from upstream, far → near.
		const uu = ease(clamp(u));
		const d = 1 + 8 * (1 - uu);
		const drift = cols * (cols < 90 ? 0.3 : 0.22);
		return { x: hx - drift * (1 - 1 / d), y: hz() + span / d, s: 1 / d, flare: 0, alpha: clamp(u * 6) };
	}

	// ------------------------------------------------------------- layers
	function drawSky(t: number) {
		const H = hz();
		// Sparse ASCII stars, densest high up.
		for (let y = 0; y < H - 2; y++) {
			const dens = 0.018 * (1 - y / H) + 0.003;
			for (let x = 0; x < cols; x++) {
				const r = hash(x, y, 7);
				if (r > dens) continue;
				const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + hash(x, y, 3) * 2.2) + hash(x, y, 5) * 20);
				const b = 0.35 + 0.65 * tw * (0.4 + hash(x, y, 9) * 0.6);
				const c = r < dens * 0.12 ? (b > 0.8 ? '*' : '+') : b > 0.7 ? '\u00b7' : '.';
				set(x, y, c, scale(hex('#e8ecff'), b));
			}
		}
		// Moon (ASCII disk with limb darkening and craters) + dotted halo.
		const mx = cols * layout.moonX;
		const my = rows * layout.moonY;
		const R = moonR();
		const ramp = ':*#%@@';
		const A = aspect();
		for (let y = Math.floor(my - R * 2.4); y <= my + R * 2.4; y++) {
			for (let x = Math.floor(mx - R * A * 2.4); x <= mx + R * A * 2.4; x++) {
				const nx = (x + 0.5 - mx) / (R * A);
				const ny = (y + 0.5 - my) / R;
				const d = Math.hypot(nx, ny);
				if (d < 1) {
					let lum = 0.55 + 0.45 * Math.sqrt(1 - d * d);
					const craters = [
						[-0.3, -0.25, 0.22],
						[0.28, 0.18, 0.3],
						[-0.05, 0.45, 0.16],
						[0.42, -0.4, 0.12],
					];
					for (const [cx, cy, cr] of craters) {
						const cd = Math.hypot(nx - cx, ny - cy) / cr;
						if (cd < 1) lum -= 0.13 * (1 - cd * cd);
					}
					lum -= (nx + ny) * 0.06;
					lum = clamp((lum - 0.35) / 0.65);
					set(x, y, ramp[Math.min(ramp.length - 1, Math.floor(lum * ramp.length))], mix(MOON_LO, MOON_HI, lum));
				} else if (d < 2.3) {
					const k = 1 - (d - 1) / 1.3;
					const pulse = 0.85 + 0.15 * Math.sin(t * 0.8 + d * 4);
					if (hash(x, y, 11) < k * k * k * 0.4) set(x, y, '.', scale(GLADE, (0.25 + 0.55 * k) * pulse));
				}
			}
		}
		// Sky lanterns (โคมลอย) rising slowly.
		const nL = cols < 90 ? 4 : 7;
		for (let i = 0; i < nL; i++) {
			const period = 46 + hash(i, 1) * 30;
			const p = (((reduced ? 0.3 : t) / period + hash(i, 2)) % 1 + 1) % 1;
			const y = H - 1 - p * (H + 2);
			const x = cols * (0.08 + hash(i, 3) * 0.84) + Math.sin(t * 0.3 + i) * 2 + p * 6;
			const b = clamp(1 - p * 0.9) * (0.75 + 0.25 * Math.sin(t * 5 + i));
			set(Math.round(x), Math.round(y), p > 0.6 ? '\u00b7' : 'o', scale(WARM, 0.5 + 0.5 * b));
		}
		// Fireworks.
		if (!reduced) {
			const period = 6.5;
			for (let k = Math.floor(t / period) - 1; k <= Math.floor(t / period); k++) {
				if (k < 0) continue;
				const age = t - (k * period + hash(k, 4) * 2);
				if (age < 0 || age > 2.6) continue;
				let cx = cols * (0.08 + hash(k, 5) * 0.84);
				if (Math.abs(cx - mx) < R * A * 3) cx = (cx + cols * 0.45) % cols;
				const cy = H * (0.12 + hash(k, 6) * 0.35);
				const col = FW_COLORS[Math.floor(hash(k, 7) * FW_COLORS.length)];
				const n = 26;
				const rad = (1 - Math.pow(1 - clamp(age / 1.4), 3)) * (6 + hash(k, 8) * 5);
				const fade = clamp(1 - age / 2.6);
				for (let j = 0; j < n; j++) {
					const a = (j / n) * Math.PI * 2;
					for (const f of [1, 0.6]) {
						const px = cx + Math.cos(a) * rad * f * A * 0.9;
						const py = cy + Math.sin(a) * rad * f + age * age * 0.9;
						const c = age < 0.9 ? '*' : age < 1.7 ? '+' : '.';
						set(Math.round(px), Math.round(py), f < 1 ? '.' : c, scale(col, fade * (f < 1 ? 0.6 : 1)));
					}
				}
			}
		}
	}

	function drawShore(t: number) {
		const H = hz();
		// Tree line silhouette.
		for (let x = 0; x < cols; x++) {
			const n = Math.sin(x * 0.21) * 0.6 + Math.sin(x * 0.07 + 2) * 0.9 + hash(x, 0, 13) * 0.8;
			const h = Math.max(0, Math.round(1 + n));
			for (let k = 0; k < h; k++) set(x, H - 1 - k, k === h - 1 ? '^' : '#', scale(SHORE, 1 + k * 0.08));
		}
		// Temple chedi, gold-lit.
		const tx = Math.round(cols * (layout.moonX > 0.5 ? 0.2 : 0.78));
		const chedi = ['|', '|', '^', '/#\\', '(###)', '/#####\\', '_|#####|_', '|#|#|#|#|#|'];
		for (let r = 0; r < chedi.length; r++) {
			const s = chedi[r];
			const y = H - chedi.length + r;
			for (let i = 0; i < s.length; i++) {
				const x = tx - (s.length - 1) / 2 + i;
				const shimmer = 0.75 + 0.25 * Math.sin(t * 1.3 + r);
				const c = s[i] === '#' ? scale(TEMPLE, 0.8 + 0.1 * r / chedi.length) : scale(TEMPLE_HI, shimmer * (r < 3 ? 1 : 0.8));
				set(Math.round(x), y, s[i], c);
			}
		}
		// Little houses' lights along the bank.
		for (let i = 0; i < Math.floor(cols / 9); i++) {
			const x = Math.floor(hash(i, 21) * cols);
			if (Math.abs(x - tx) < 7) continue;
			const b = 0.6 + 0.4 * Math.sin(t * (1 + hash(i, 22)) + i);
			set(x, H - 1, '.', scale(WARM, b));
		}
	}

	function drawWater(t: number, lights: { x: number; y: number; s: number }[]) {
		const H = hz();
		const tt = reduced ? t * 0.25 : t;
		const mx = cols * layout.moonX;
		const span = rows - H;
		const A = aspect();
		for (let y = H; y < rows; y++) {
			const z = (y - H + 0.5) / span;
			const persp = 0.12 + z;
			for (let x = 0; x < cols; x++) {
				const xs = x / persp;
				let w =
					Math.sin(xs * 0.16 - tt * (0.9 + z * 1.4) + y * 0.75) * 0.5 +
					Math.sin(xs * 0.061 + tt * 0.45 - y * 1.21 + 1.3) * 0.4 +
					Math.sin((x * 0.045 - tt * 0.22) / persp + y * 0.37) * 0.3 +
					(hash(x, y, 31) - 0.5) * 0.25;
				let ck = -1;
				let warm = 0;
				// Ripple rings.
				for (const r of ripples) {
					const age = t - r.t0;
					if (age < 0 || age > (r.big ? 3.2 : 2)) continue;
					const dx = (x - r.x) / A;
					const dy = (y - r.y) * 1.6;
					const d = Math.hypot(dx, dy);
					const rad = age * (r.big ? 3.2 : 1.8) + 0.6;
					const ring = Math.abs(d - rad);
					if (ring < 0.55) w += (1 - ring / 0.55) * 1.2 * (1 - age / (r.big ? 3.2 : 2));
				}
				// Moon glade: a broken column of light that widens toward the viewer.
				const band = 1.6 + z * (cols < 90 ? 7 : 11);
				const wob = Math.sin(y * 1.31 + tt * 1.7) * 0.9 + Math.sin(y * 0.53 - tt * 0.9) * 0.7;
				const dm = Math.abs(x - mx + wob) / band;
				let glade = 0;
				if (dm < 1) glade = Math.pow(1 - dm, 1.1) * clamp(0.55 + w * 0.7) * (1.15 - z * 0.3);
				// Candle light pools + streak reflections.
				for (const L of lights) {
					const dx = (x - L.x) / (L.s * 9 + 1.5);
					const dy = (y - L.y) / (L.s * 3 + 0.8);
					const dd = dx * dx + dy * dy;
					if (dd < 1) warm = Math.max(warm, (1 - dd) * 0.55 * clamp(L.s * 1.4 + 0.25));
					if (y > L.y && y < L.y + L.s * 7 + 2 && Math.abs(x - L.x + Math.sin(y * 1.9 + tt * 3) * 0.7) < 0.6 + L.s * 0.8)
						warm = Math.max(warm, (0.95 - (y - L.y) / (L.s * 7 + 2)) * clamp(0.4 + w));
				}
				const b = clamp((w + 0.35) / 1.5);
				let c: string;
				if (glade > 0.1 && w > -0.45) {
					c = glade > 0.7 ? '=' : glade > 0.4 ? '-' : glade > 0.22 ? '~' : '.';
				} else if (warm > 0.2 && w > -0.2) {
					c = warm > 0.6 ? '=' : '~';
				} else {
					const near = z * 0.25;
					c = w > 0.85 - near ? '~' : w > 0.35 - near ? '-' : w > -0.15 - near * 2 ? '.' : ' ';
					if (z < 0.08 && c === '~') c = '-';
				}
				if (c === ' ') continue;
				let rgb = mix(WATER_DEEP, WATER_HI, b * (0.35 + 0.65 * z));
				rgb = scale(rgb, 0.7 + 0.5 * z);
				if (glade > 0) rgb = mix(rgb, GLADE, clamp(glade * 1.5));
				if (warm > 0) rgb = mix(rgb, WARM, clamp(warm));
				// Shore light reflections near the horizon.
				if (y - H < 3 && hash(x, 0, 41) < 0.06) rgb = mix(rgb, WARM, 0.5 - (y - H) * 0.15);
				ck = 0;
				void ck;
				set(x, y, c, rgb);
			}
		}
	}

	type Blit = { x: number; y: number; c: string; rgb: RGB; hero?: boolean };
	const blits: Blit[] = [];
	const heroRows = new Map<number, [number, number]>();
	const glows: { x: number; y: number; r: number; a: number; rgb: RGB }[] = [];

	function placeSprite(spec: SpriteSpec, x: number, y: number, w: number, t: number, phase: number, flare: number, fade: number, alpha: number, isHero = false) {
		const sp = buildSprite(spec, w, t + phase, flare);
		const bob = reduced ? 0 : Math.sin(t * 1.5 + phase) * 0.16 * Math.min(1, w / 10);
		const tilt = reduced ? 0 : Math.sin(t * 1.05 + phase * 1.7) * 0.22;
		const fog = hex('#1b3050');
		for (const cell of sp.cells) {
			const px = x + cell.dx;
			const py = y + cell.dy + bob + (cell.dx / Math.max(1, sp.width)) * tilt * 2;
			let rgb = cell.flame ? cell.c : mix(cell.c, fog, (1 - fade) * 0.55);
			rgb = scale(rgb, (cell.flame ? 1 : 0.55 + 0.45 * fade) * alpha);
			// Blank the water behind the sprite so the krathong reads as solid.
			const gx = Math.round(px);
			const gy = Math.round(py);
			if (gx >= 0 && gy >= 0 && gx < cols && gy < rows) codes[gy * cols + gx] = 0;
			blits.push({ x: px, y: py, c: cell.ch, rgb, hero: isHero });
			if (isHero) {
				const row = heroRows.get(gy);
				if (row) {
					row[0] = Math.min(row[0], gx);
					row[1] = Math.max(row[1], gx);
				} else heroRows.set(gy, [gx, gx]);
			}
		}
		if (sp.flame) {
			const fl = 0.85 + 0.15 * Math.sin(t * 13 + phase) * Math.sin(t * 7.3 + phase * 2);
			glows.push({ x: x + sp.flame.dx + 0.5, y: y + sp.flame.dy + bob + 0.5, r: (2.2 + w * 0.55) * (1 + flare * 0.6), a: 0.42 * fl * alpha * (0.5 + 0.5 * fade), rgb: WARM });
		}
		// Incense smoke wisps.
		if (!reduced && w >= 15) {
			for (const [si, tip] of sp.incense.entries()) {
				for (let k = 0; k < 3; k++) {
					const age = ((t * 0.28 + k / 3 + si * 0.29) % 1 + 1) % 1;
					const sx = x + tip.dx + Math.sin(age * 6 + t * 0.7 + si) * 1.2 + age * 3;
					const sy = y + tip.dy + bob - 0.8 - age * 7;
					const b = (1 - age) * (1 - age) * 0.38 * alpha;
					blits.push({ x: sx, y: sy, c: age < 0.35 ? "'" : age < 0.7 ? '~' : '.', rgb: scale(hex('#cfd6e6'), b) });
				}
			}
		}
		return sp;
	}

	function draw(now: number) {
		const t0 = performance.now();
		drawFrame(now);
		const cost = performance.now() - t0;
		ema = emaN ? ema * 0.92 + cost * 0.08 : cost;
		emaN++;
		if (emaN > 45 && ema > 13 && downgrades < 3) {
			downgrades++;
			if (dprCap > 1 && dpr > 1) dprCap = 1;
			else fsBoost *= 1.18;
			emaN = 0;
			resize();
		}
	}

	function drawFrame(now: number) {
		if (!cols) resize();
		const t = frozen ?? now / 1000;
		const dt = Math.min(0.1, Math.max(0, t - lastT));
		lastT = t;
		codes.fill(0);
		blits.length = 0;
		heroRows.clear();
		glows.length = 0;
		const W = canvas.width;
		const Hp = canvas.height;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, W, Hp);
		const horizonPx = hz() * ch * dpr;

		// Water body behind glyphs.
		const top = horizonPx - ch * dpr * 2.5;
		const g = ctx.createLinearGradient(0, top, 0, Hp);
		const k0 = clamp((horizonPx - top) / Math.max(1, Hp - top), 0, 0.8);
		g.addColorStop(0, 'rgba(10,16,30,0)');
		g.addColorStop(k0, 'rgba(12,22,40,0.9)');
		g.addColorStop(k0 + 0.2, 'rgba(7,14,28,0.97)');
		g.addColorStop(1, '#03070e');
		ctx.fillStyle = g;
		ctx.fillRect(0, top, W, Hp - top);

		// Soft pixel glow: moon and its glade.
		const mxp = cols * layout.moonX * cw * dpr;
		const myp = rows * layout.moonY * ch * dpr;
		const R = moonR() * ch * dpr;
		ctx.globalCompositeOperation = 'lighter';
		let rg = ctx.createRadialGradient(mxp, myp, R * 0.6, mxp, myp, R * 4.5);
		rg.addColorStop(0, 'rgba(255,236,200,0.2)');
		rg.addColorStop(0.3, 'rgba(255,236,200,0.08)');
		rg.addColorStop(0.65, 'rgba(255,236,200,0.02)');
		rg.addColorStop(1, 'rgba(255,236,200,0)');
		ctx.fillStyle = rg;
		ctx.fillRect(mxp - R * 5, myp - R * 5, R * 10, R * 10);
		ctx.save();
		ctx.translate(mxp, horizonPx + (Hp - horizonPx) * 0.35);
		ctx.scale(1, 3.2);
		rg = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.8);
		rg.addColorStop(0, 'rgba(255,225,170,0.13)');
		rg.addColorStop(1, 'rgba(255,225,170,0)');
		ctx.fillStyle = rg;
		ctx.fillRect(-R * 2, -R * 2, R * 4, R * 4);
		ctx.restore();
		ctx.globalCompositeOperation = 'source-over';

		drawSky(t);
		drawShore(t);

		// Ambient krathongs and the hero, far → near.
		const pose = heroPose(t);
		const lights: { x: number; y: number; s: number }[] = [];
		const H = hz();
		const items: { y: number; fn: () => void }[] = [];
		const ambientCap = Math.max(cols < 90 ? 1 : 2, (cols < 90 ? 4 : AMBIENT_N) - live.length);
		let shown = 0;
		for (const [ai, a] of ambient.entries()) {
			if (cols < 90 && ai % 2 === 1) continue;
			if (shown++ >= ambientCap) continue;
			if (!reduced) a.x += (dt * a.speed * (0.25 + a.z * 1.6)) / Math.max(30, cols) * 3;
			if (a.x > 1.15) a.x -= 1.3;
			const y = H + (cols < 90 ? 0.08 + a.z * 0.95 : 0.1 + a.z * 1.9) * (homeRow() - H);
			const w = widthAt(y) * 0.72;
			const x = a.x * cols;
			lights.push({ x, y, s: w / heroW() });
			items.push({ y, fn: () => placeSprite(a.spec, x, y, w, t, a.phase, 0, clamp(a.z * 2.2 + 0.1), 1) });
		}
		boxes.clear();
		const labels: { x: number; y: number; text: string; a: number }[] = [];
		for (const L of live) {
			if (!reduced) L.x += (dt * L.speed * (0.25 + L.z * 1.6)) / Math.max(30, cols) * 3;
			if (L.x > 1.15) {
				L.x -= 1.3;
				L.fresh = false;
			}
			const y = H + (cols < 90 ? 0.1 + L.z * 1.0 : 0.12 + L.z * 1.9) * (homeRow() - H);
			const w = Math.max(5, widthAt(y) * 0.78);
			const x = L.x * cols;
			lights.push({ x, y, s: w / heroW() });
			const hh = Math.max(3, w * 0.45);
			boxes.set(L.id, { x: (x - w / 2 - 1) * cw, y: (y - hh - 1) * ch, w: (w + 2) * cw, h: (hh + 2) * ch });
			const age = t - L.born;
			const tagA = L.id === selected ? 1 : L.fresh ? clamp(Math.min(age / 0.8, (11 - age) / 2)) : 0;
			if (tagA > 0.01) labels.push({ x, y: y - hh - 0.6, text: L.label, a: tagA });
			items.push({ y, fn: () => placeSprite(L.spec, x, y, w, t, L.phase, 0, clamp(L.z * 2.2 + 0.35), 1) });
		}
		if (pose && hero) {
			const k = hero;
			const w = heroW() * pose.s;
			lights.push({ x: pose.x, y: pose.y, s: pose.s * pose.alpha });
			items.push({
				y: pose.y + 0.01,
				fn: () => placeSprite({ ...k, lit: true }, pose.x, pose.y, w, t, 0, pose.flare, clamp(0.35 + pose.s), pose.alpha, true),
			});
			if (!reduced && mode === 'build' && Math.floor(t / 2.6) !== Math.floor((t - dt) / 2.6)) ripples.push({ x: pose.x, y: pose.y + 0.6, t0: t, big: false });
		}
		for (let i = ripples.length - 1; i >= 0; i--) if (t - ripples[i].t0 > 3.5 || t < ripples[i].t0 - 1) ripples.splice(i, 1);
		drawWater(t, lights);
		items.sort((a, b) => a.y - b.y);
		for (const it of items) it.fn();

		if (mode !== 'build') {
			const u = (t - modeT0) / (mode === 'float' ? FLOAT_S : ARRIVE_S);
			if (mode === 'float' && u > 0.3 && !fired.has('floated')) {
				fired.add('floated');
				opts.onEvent?.('floated');
			}
			if (mode === 'float' && u >= 1 && !fired.has('gone')) {
				fired.add('gone');
				opts.onEvent?.('gone');
			}
			if (mode === 'arrive' && u >= 1 && !fired.has('arrived')) {
				fired.add('arrived');
				opts.onEvent?.('arrived');
			}
			// Wish sparkles rising from the flame into the sky, becoming a star.
			if (mode === 'float' && pose) {
				const st = t - modeT0 - 1.2;
				if (st > 0) {
					for (let i = 0; i < 16; i++) {
						const life = 4.2;
						const a = clamp((st - i * 0.12) / life);
						if (a <= 0) continue;
						const sx0 = cols * layout.homeX;
						const sy0 = homeRow() - heroW() * 0.35;
						const tx = cols * (0.3 + hash(i, 51) * 0.2);
						const ty = rows * layout.moonY * (0.6 + hash(i, 52) * 0.8);
						const e = 1 - Math.pow(1 - a, 2);
						const x = sx0 + (tx - sx0) * e + Math.sin(a * 9 + i) * 2 * (1 - a);
						const y = sy0 + (ty - sy0) * e;
						if (a >= 1 && i > 0) continue;
						blits.push({ x, y, c: a >= 1 ? '*' : i % 3 ? '\u00b7' : '*', rgb: scale(hex('#ffe9a8'), a >= 1 ? 0.8 + 0.2 * Math.sin(t * 3) : 1 - a * 0.4) });
						if (a >= 1) glows.push({ x: x + 0.5, y: y + 0.5, r: 5, a: 0.4, rgb: hex('#ffe9a8') });
					}
				}
			}
		}

		// Blit grid.
		const tmp: RGB = [0, 0, 0];
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				const i = y * cols + x;
				const code = codes[i];
				if (!code || code === 32) continue;
				tmp[0] = colr[i * 3];
				tmp[1] = colr[i * 3 + 1];
				tmp[2] = colr[i * 3 + 2];
				ctx.drawImage(glyph(String.fromCharCode(code), tmp), Math.round(x * cw * dpr) - 1, Math.round(y * ch * dpr) - 1);
			}
		}
		// Free-floating sprites (sub-cell positions so drift and bob stay smooth).
		for (const b of blits) {
			if (b.c === ' ') continue;
			if (!b.hero && heroRows.size) {
				// Keep the user's krathong clean: farther sprites never draw through its silhouette.
				const row = heroRows.get(Math.round(b.y));
				const gx = Math.round(b.x);
				if (row && gx >= row[0] - 1 && gx <= row[1] + 1) continue;
			}
			ctx.drawImage(glyph(b.c, b.rgb), Math.round(b.x * cw * dpr * 2) / 2 - 1, Math.round(b.y * ch * dpr * 2) / 2 - 1);
		}
		// Candle glows.
		ctx.globalCompositeOperation = 'lighter';
		for (const gl of glows) {
			const x = gl.x * cw * dpr;
			const y = gl.y * ch * dpr;
			const r = gl.r * cw * dpr;
			const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
			grad.addColorStop(0, `rgba(${gl.rgb[0]},${gl.rgb[1]},${gl.rgb[2]},${gl.a})`);
			grad.addColorStop(0.35, `rgba(${gl.rgb[0]},${Math.round(gl.rgb[1] * 0.8)},${Math.round(gl.rgb[2] * 0.6)},${gl.a * 0.35})`);
			grad.addColorStop(1, 'rgba(0,0,0,0)');
			ctx.fillStyle = grad;
			ctx.fillRect(x - r, y - r, r * 2, r * 2);
		}
		ctx.globalCompositeOperation = 'source-over';
		// Name tags for friends' krathongs (canvas text: never parsed as HTML).
		if (labels.length) {
			ctx.save();
			ctx.font = `${Math.round(12.5 * dpr)}px Mitr, 'Noto Sans Thai', sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'bottom';
			for (const L of labels) {
				const x = L.x * cw * dpr;
				const y = L.y * ch * dpr;
				ctx.globalAlpha = L.a;
				ctx.fillStyle = 'rgba(7,8,15,0.75)';
				const tw = ctx.measureText(L.text).width;
				ctx.fillRect(x - tw / 2 - 6 * dpr, y - 17 * dpr, tw + 12 * dpr, 19 * dpr);
				ctx.fillStyle = '#ffd27a';
				ctx.fillRect(x - 0.5 * dpr, y + 2 * dpr, 1 * dpr, 6 * dpr);
				ctx.fillStyle = '#f3ead8';
				ctx.fillText(L.text, x, y - 1 * dpr);
			}
			ctx.restore();
		}
	}

	return {
		setKrathong(k) {
			hero = k;
		},
		setMode(m) {
			const t = frozen ?? performance.now() / 1000;
			mode = m;
			modeT0 = t;
			fired = new Set();
			if (m === 'float') {
				const pose = heroPose(t);
				if (pose) ripples.push({ x: pose.x, y: pose.y + 0.5, t0: t + 0.6, big: true });
			}
		},
		addLive(item, fresh) {
			if (live.some((l) => l.id === item.id)) return;
			const r = mulberry(liveSeed++ * 7919 + item.id.length);
			const t = frozen ?? performance.now() / 1000;
			live.push({
				id: item.id,
				spec: { ...item.look, lit: true },
				z: 0.05 + r() * 0.3,
				x: fresh ? -0.06 : r() * 1.05,
				speed: 0.55 + r() * 0.5,
				phase: r() * 10,
				born: t,
				label: item.label,
				fresh,
			});
			while (live.length > LIVE_MAX) live.shift();
		},
		clearLive() {
			live.length = 0;
		},
		removeLive(id) {
			const i = live.findIndex((l) => l.id === id);
			if (i >= 0) live.splice(i, 1);
			boxes.delete(id);
		},
		hitTest(x, y) {
			let best: string | null = null;
			for (const [id, b] of boxes) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) best = id;
			return best;
		},
		setSelected(id) {
			selected = id;
		},
		setLayout(l) {
			layout = { ...layout, ...l };
		},
		resize,
		draw,
		destroy() {
			atlas.clear();
		},
		_freeze(t) {
			frozen = t;
		},
	};
}
