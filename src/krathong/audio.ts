/**
 * Original 8-bit lofi score for the river: ~74 bpm, swung, warm 7th/9th pads, a soft
 * low-passed square lead on a Thai-flavoured pentatonic line, brushed lofi drums,
 * vinyl + water bed and a little tape wobble. Seamless 8-bar loop. Starts only on a tap.
 */
export type Ambience = { start(): void; setMuted(m: boolean): void; stop(): void; readonly running: boolean };

const BPM = 74;
const BEAT = 60 / BPM;
const EIGHTH = BEAT / 2;
const SWING = 0.58; // first eighth of each beat gets 58%
const MASTER = 0.3;

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// C major pentatonic, C4..G5.
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79];
const _ = -1;
const MELODY = [
	[4, _, 5, _, 6, _, 5, 4],
	[3, _, _, _, 2, _, 3, _],
	[4, _, 3, _, 2, 1, _, _],
	[2, _, _, _, _, _, _, _],
	[5, _, 6, 7, _, 6, 5, _],
	[4, _, _, 3, _, _, 2, _],
	[1, _, 2, _, 3, _, 4, _],
	[3, _, _, _, _, _, _, _],
];
const CHORDS = [
	[53, 57, 60, 64, 67], // Fmaj9
	[52, 55, 59, 62], // Em7
	[50, 53, 57, 60, 64], // Dm9
	[48, 52, 55, 59, 62], // Cmaj9
	[53, 57, 60, 64, 67],
	[52, 55, 59, 62],
	[50, 53, 57, 60, 64],
	[53, 57, 60, 62], // G9sus (over G)
];
const ROOTS = [41, 40, 38, 36, 41, 40, 38, 43];

export function createAmbience(): Ambience {
	let ac: AudioContext | null = null;
	let master: GainNode | null = null;
	let bus: BiquadFilterNode | null = null;
	let wobble: GainNode | null = null;
	let noise: AudioBuffer | null = null;
	let timer = 0;
	let muted = false;
	let running = false;
	let step = 0; // eighth-note index
	let nextAt = 0;
	const bed: AudioScheduledSourceNode[] = [];

	const level = () => (muted ? 0 : MASTER);

	function osc(type: OscillatorType, freq: number, when: number, end: number, dest: AudioNode, detune = 0) {
		const o = ac!.createOscillator();
		o.type = type;
		o.frequency.value = freq;
		o.detune.value = detune;
		wobble?.connect(o.detune);
		o.connect(dest);
		o.start(when);
		o.stop(end + 0.05);
		return o;
	}

	function env(when: number, a: number, peak: number, hold: number, r: number) {
		const g = ac!.createGain();
		g.gain.setValueAtTime(0.0001, when);
		g.gain.exponentialRampToValueAtTime(peak, when + a);
		g.gain.setValueAtTime(peak, when + a + hold);
		g.gain.exponentialRampToValueAtTime(0.0001, when + a + hold + r);
		return g;
	}

	function pad(notes: number[], when: number, dur: number) {
		const f = ac!.createBiquadFilter();
		f.type = 'lowpass';
		f.frequency.value = 850;
		f.Q.value = 0.4;
		const g = env(when, 0.7, 0.045, dur - 1.1, 1.6);
		f.connect(g).connect(bus!);
		for (const [i, n] of notes.entries()) {
			osc('triangle', mtof(n), when, when + dur + 0.6, f, (i % 2 ? 7 : -7));
			osc('sine', mtof(n), when, when + dur + 0.6, f, 0);
		}
	}

	function lead(n: number, when: number, dur: number) {
		const f = ac!.createBiquadFilter();
		f.type = 'lowpass';
		f.frequency.setValueAtTime(1700, when);
		f.frequency.exponentialRampToValueAtTime(900, when + dur);
		const g = env(when, 0.02, 0.05, Math.max(0.05, dur - 0.25), 0.5);
		f.connect(g).connect(bus!);
		const o = osc('square', mtof(n), when, when + dur + 0.6, f);
		// Gentle delayed vibrato.
		const v = ac!.createOscillator();
		const vg = ac!.createGain();
		v.frequency.value = 5.2;
		vg.gain.setValueAtTime(0, when);
		vg.gain.linearRampToValueAtTime(9, when + Math.min(dur, 0.6));
		v.connect(vg).connect(o.detune);
		v.start(when);
		v.stop(when + dur + 0.6);
		// Soft octave-down triangle for body.
		const g2 = env(when, 0.02, 0.03, Math.max(0.05, dur - 0.25), 0.4);
		g2.connect(bus!);
		osc('triangle', mtof(n - 12), when, when + dur + 0.5, g2);
	}

	function bass(n: number, when: number, dur: number) {
		const g = env(when, 0.03, 0.12, dur * 0.6, dur * 0.5);
		const f = ac!.createBiquadFilter();
		f.type = 'lowpass';
		f.frequency.value = 320;
		f.connect(g).connect(bus!);
		osc('triangle', mtof(n), when, when + dur * 1.2, f);
	}

	function kick(when: number) {
		const o = ac!.createOscillator();
		const g = ac!.createGain();
		o.frequency.setValueAtTime(105, when);
		o.frequency.exponentialRampToValueAtTime(42, when + 0.22);
		g.gain.setValueAtTime(0.0001, when);
		g.gain.exponentialRampToValueAtTime(0.28, when + 0.008);
		g.gain.exponentialRampToValueAtTime(0.0001, when + 0.38);
		o.connect(g).connect(bus!);
		o.start(when);
		o.stop(when + 0.4);
	}

	function hiss(when: number, dur: number, type: BiquadFilterType, freq: number, q: number, peak: number) {
		const src = ac!.createBufferSource();
		src.buffer = noise;
		const f = ac!.createBiquadFilter();
		f.type = type;
		f.frequency.value = freq;
		f.Q.value = q;
		const g = ac!.createGain();
		g.gain.setValueAtTime(0.0001, when);
		g.gain.exponentialRampToValueAtTime(peak, when + 0.004);
		g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
		src.connect(f).connect(g).connect(bus!);
		src.start(when, Math.random() * 2);
		src.stop(when + dur + 0.02);
	}

	function schedule() {
		if (!ac) return;
		while (nextAt < ac.currentTime + 0.9) {
			const bar = Math.floor(step / 8) % 8;
			const i = step % 8;
			const t = nextAt;
			if (i === 0) {
				pad(CHORDS[bar], t, BEAT * 4);
				bass(ROOTS[bar], t, BEAT * 1.8);
			}
			if (i === 4) bass(ROOTS[bar] + (bar % 2 ? 7 : 0), t, BEAT * 1.6);
			const note = MELODY[bar][i];
			// Every fourth pass the lead sits out, so the loop breathes.
			if (note >= 0 && Math.floor(step / 64) % 4 !== 3) {
				let len = 1;
				while (i + len < 8 && MELODY[bar][i + len] === _ && len < 4) len++;
				lead(SCALE[note], t + 0.012, len * EIGHTH * 0.95);
			}
			// Drums: soft kick on 1 and the "and" of 2, brush on 2 & 4, swung hats.
			if (i === 0 || i === 3) kick(t);
			if (i === 2 || i === 6) hiss(t, 0.22, 'bandpass', 1900, 0.8, 0.045);
			hiss(t, 0.05, 'highpass', 7200, 0.5, i % 2 ? 0.014 : 0.022);
			step++;
			nextAt += i % 2 === 0 ? EIGHTH * 2 * SWING : EIGHTH * 2 * (1 - SWING);
		}
	}

	function makeNoise() {
		const len = ac!.sampleRate * 4;
		noise = ac!.createBuffer(1, len, ac!.sampleRate);
		const d = noise.getChannelData(0);
		for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
	}

	function startBed() {
		// Vinyl: low hiss + sparse crackle.
		const len = ac!.sampleRate * 6;
		const buf = ac!.createBuffer(1, len, ac!.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < len; i++) {
			d[i] = (Math.random() * 2 - 1) * 0.06;
			if (Math.random() < 0.00035) d[i] += (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.5);
		}
		const vinyl = ac!.createBufferSource();
		vinyl.buffer = buf;
		vinyl.loop = true;
		const vf = ac!.createBiquadFilter();
		vf.type = 'lowpass';
		vf.frequency.value = 4200;
		const vg = ac!.createGain();
		vg.gain.value = 0.12;
		vinyl.connect(vf).connect(vg).connect(master!);
		vinyl.start();
		bed.push(vinyl);
		// River: band-passed brown-ish noise with a slow swell.
		const water = ac!.createBufferSource();
		water.buffer = noise;
		water.loop = true;
		const wf = ac!.createBiquadFilter();
		wf.type = 'lowpass';
		wf.frequency.value = 520;
		const wg = ac!.createGain();
		wg.gain.value = 0.09;
		const lfo = ac!.createOscillator();
		const lg = ac!.createGain();
		lfo.frequency.value = 0.11;
		lg.gain.value = 0.05;
		lfo.connect(lg).connect(wg.gain);
		water.connect(wf).connect(wg).connect(master!);
		water.start();
		lfo.start();
		bed.push(water, lfo);
		// Tape wobble: two slow LFOs summed into every oscillator's detune.
		wobble = ac!.createGain();
		wobble.gain.value = 1;
		for (const [rate, cents] of [
			[0.33, 5],
			[0.07, 9],
		] as const) {
			const o = ac!.createOscillator();
			const g = ac!.createGain();
			o.frequency.value = rate;
			g.gain.value = cents;
			o.connect(g).connect(wobble);
			o.start();
			bed.push(o);
		}
	}

	return {
		get running() {
			return running;
		},
		start() {
			if (running) return;
			const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			if (!AC) return;
			ac = new AC();
			master = ac.createGain();
			master.gain.value = 0.0001;
			const comp = ac.createDynamicsCompressor();
			comp.threshold.value = -20;
			comp.ratio.value = 3;
			master.connect(comp).connect(ac.destination);
			bus = ac.createBiquadFilter();
			bus.type = 'lowpass';
			bus.frequency.value = 5200;
			bus.connect(master);
			master.gain.setTargetAtTime(level(), ac.currentTime, 1.1);
			makeNoise();
			startBed();
			nextAt = ac.currentTime + 0.3;
			step = 0;
			running = true;
			schedule();
			timer = window.setInterval(schedule, 150);
		},
		setMuted(m) {
			muted = m;
			if (ac && master) master.gain.setTargetAtTime(level() || 0.0001, ac.currentTime, 0.25);
		},
		stop() {
			clearInterval(timer);
			running = false;
			const a = ac;
			if (a && master) {
				master.gain.setTargetAtTime(0.0001, a.currentTime, 0.3);
				setTimeout(() => a.close(), 1400);
			}
			ac = null;
		},
	};
}
