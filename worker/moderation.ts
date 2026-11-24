/**
 * Text moderation for names and wishes on the shared river (Thai + English).
 * Shared by the Worker (authoritative) and the browser (instant feedback).
 *
 *  - 'reject': clearly abusive (sexual, slurs, profanity, death wishes / self-harm, gore) → sender is asked to rewrite.
 *  - 'shadow': borderline words or spam → accepted for the sender only, never stored or shown to others.
 *  - 'ok'.
 */
import { LDNOOBW_BLOCK_EN, LDNOOBW_MILD_EN } from './wordlists';

export type Verdict = { action: 'ok' | 'shadow' | 'reject'; score: number; reasons: string[] };

/* ------------------------------------------------------------------ word lists */

/** English roots matched anywhere inside a word (after normalisation), minus the allowlist. */
const EN_ROOTS = [
	'fuck', 'fuk', 'fck', 'phuck', 'motherf', 'shit', 'cunt', 'nigg', 'fagg', 'bitch', 'biatch', 'whore', 'slut',
	'dildo', 'blowjob', 'handjob', 'rimjob', 'jizz', 'porn', 'penis', 'vagina', 'pussy', 'masturbat', 'ejaculat',
	'orgasm', 'bestial', 'incest', 'pedophil', 'paedophil', 'cumshot', 'gangbang', 'bukkake', 'creampie', 'hentai',
	'suicid', 'dumbass', 'jackass', 'asshole', 'arsehole', 'retard', 'wanker', 'bollock', 'boner', 'tranny',
	'motherfuck', 'killyourself', 'killurself', 'kmsnow',
];
/** English words matched as whole words (with common suffixes). Score 3 = reject. */
const EN_WORDS_BLOCK = [
	...LDNOOBW_BLOCK_EN,
	'fu', 'stfu', 'gtfo', 'kys', 'kms', 'wtf', 'ass', 'arse', 'cock', 'dick', 'cum', 'tit', 'tits', 'twat', 'prick',
	'damn you', 'go to hell', 'piss off', 'screw you', 'bastard', 'chink', 'gook', 'kike', 'spic', 'coon', 'paki',
	'rape', 'raped', 'rapist', 'raping', 'molest', 'pedo', 'nazi', 'hitler', 'heil', 'isis', 'jihad',
	'idiot', 'moron', 'loser', 'scum', 'skank', 'hoe', 'thot', 'nonce',
	'kill yourself', 'kill urself', 'kill your self', 'go die', 'just die', 'drop dead', 'die in a fire',
	'hope you die', 'hope u die', 'hope he dies', 'hope she dies', 'hope they die', 'you should die', 'u should die',
	'i want to die', 'want to die', 'wanna die', 'kill myself', 'end my life', 'hang yourself', 'slit your',
	'shoot you', 'stab you', 'murder you', 'kill you', 'kill u', 'death to', 'rot in hell', 'burn in hell',
	'behead', 'decapitat', 'mutilat', 'dismember',
];
/** Softer English words: score 2 → shadow-hide (not shown to others). */
const EN_WORDS_MILD = [
	...LDNOOBW_MILD_EN,
	'kill', 'killed', 'murder', 'die', 'dies', 'corpse', 'gore', 'blood', 'stupid', 'dumb', 'ugly', 'hate you',
	'hate u', 'shut up', 'crap', 'piss', 'hell', 'damn', 'bloody', 'sex', 'sexting', 'nsfw', 'onlyfans', 'horny',
	'gun', 'bomb', 'terrorist',
];
/** Benign words that contain a root (Scunthorpe guard). Removed before root matching. */
const EN_ALLOW = [
	'scunthorpe', 'shitake', 'shiitake', 'cocktail', 'cockatoo', 'cockpit', 'peacock', 'hancock', 'dickens', 'dickinson',
	'therapist', 'therapists', 'grapes', 'drape', 'assassin', 'assess', 'assist', 'associate', 'bass', 'class', 'glass',
	'grass', 'mass', 'pass', 'passion', 'compass', 'embarrass', 'harass', 'titanic', 'title', 'titan', 'constitution',
	'penistone', 'cumulative', 'cucumber', 'circumstance', 'document', 'pussycat', 'pussywillow', 'hello', 'shell',
	'michelle', 'diet', 'died', 'kiln', 'skill', 'skills', 'hellen', 'helen', 'butter', 'button', 'butterfly',
	'sussex', 'essex', 'middlesex', 'sextet', 'hoedown', 'shoe', 'canal', 'analysis', 'analog', 'banal', 'gunther',
	'begun', 'bombay', 'dumbo', 'sucks',
];

/** Thai: [term, score, matchSkeleton]. matchSkeleton = also match with tone marks stripped (only for
 * terms whose toneless form isn't an ordinary word). */
const TH: [string, number, boolean][] = [
	// profanity / insults (from LDNOOBW-th, curated, + common variants)
	['ควย', 3, true], ['เหี้ย', 3, true], ['เหี้ยๆ', 3, true], ['สัส', 3, true], ['สัด', 3, false], ['ไอ้สัตว์', 3, true],
	['อีสัตว์', 3, true], ['ไอ้เหี้ย', 3, true], ['อีเหี้ย', 3, true], ['แม่ง', 3, false], ['เย็ด', 3, true], ['หี', 3, false],
	['หำ', 3, false], ['จู๋', 3, false], ['จิ๋ม', 3, true], ['กระดอ', 3, true], ['กระเด้า', 3, true], ['กระหรี่', 3, true],
	['กะหรี่', 3, false], ['ดอกทอง', 3, true], ['อีดอก', 3, true], ['อีตัว', 3, true], ['ตอแหล', 3, true], ['ส้นตีน', 3, true],
	['เสือก', 3, true], ['หญิงชาติชั่ว', 3, true], ['ชาติหมา', 3, true], ['ชาติชั่ว', 3, true], ['หน้าหี', 3, true],
	['น้ำแตก', 3, true], ['อมนกเขา', 3, true], ['ล้างตู้เย็น', 3, true], ['รูตูด', 3, true], ['เงี่ยน', 3, true],
	['ชักว่าว', 3, true], ['ร่าน', 3, false], ['โม๊ก', 3, false], ['เย็ดแม่', 3, true], ['พ่อมึง', 3, false],
	['แม่มึง', 3, false], ['ไอ้ควาย', 3, true], ['อีควาย', 3, true], ['ไอ้เวร', 3, true], ['อีเวร', 3, true],
	['ไอ้ระยำ', 3, true], ['ระยำ', 3, true], ['จัญไร', 3, true], ['ไอ้บ้า', 2, false], ['เปรต', 2, false],
	['เชี่ย', 3, false], ['ฟัค', 3, false], ['ฟัคยู', 3, false], ['แม่เย็ด', 3, true], ['ปากหมา', 3, true], ['สันดาน', 2, true],
	['ห่า', 2, false], ['ฉิบหาย', 2, true], ['ตูด', 2, false], ['เจ๊ก', 2, false], ['แรด', 2, false], ['กาก', 2, false],
	['โง่', 1, false], ['ควาย', 1, false], ['มึง', 1, false], ['กู', 1, false], ['ไอ้', 1, false],
	['ไปตาย', 3, true], ['ตายซะ', 3, true], ['ตายห่า', 3, true], ['มึงตาย', 3, true], ['ตายๆไป', 3, true],
	['ไปตายซะ', 3, true], ['ไปลงนรก', 3, true], ['ลงนรก', 2, true], ['ฆ่าตัวตาย', 3, true], ['อยากตาย', 3, true],
	['ฆ่ามัน', 3, true], ['ฆ่ามึง', 3, true], ['ฆ่าให้ตาย', 3, true], ['แช่ง', 3, true], ['สาปแช่ง', 3, true],
	['ฆ่า', 2, false], ['ศพ', 2, false], ['ตาย', 1, false], ['เลือด', 1, false],
	['เซ็กส์', 2, false], ['เซ็กซ์', 2, false], ['เอากัน', 3, true], ['ขายตัว', 3, true], ['โป๊', 2, false],
	['คลิปหลุด', 3, true], ['หนังโป๊', 3, true], ['นมโต', 3, true],
];
/** Thai words that contain a listed term but are fine (removed before matching). */
const TH_ALLOW = [
	'หีบ', 'แม่งาน', 'สัดส่วน', 'สัดๆ', 'กะหรี่ปั๊บ', 'กะหรี่พัฟ', 'แกงกะหรี่', 'ข้าวกะหรี่', 'หำหัก', 'กูเกิล', 'กูเกิ้ล',
	'ตายาย', 'ตายตัว', 'ห่าง', 'ห่าน', 'ห่ม', 'ตูดหมึก', 'ตายใจ', 'แรดชัก', 'กากบาท', 'กากี', 'ฆ่าเชื้อ', 'มังกู', 'ไอ้หนู',
	'ไอ้ต้น', 'กูรู', 'เลือดเนื้อ', 'โง่งม', 'เชี่ยวชาญ', 'เชี่ยว', 'ตายาย',
];
/** Hostile phrase patterns (Thai + English) checked on the lightly-normalised text. */
const PATTERNS: [RegExp, number, string][] = [
	[/ขอให้.{0,14}(ตาย|ฉิบหาย|ซวย|เจ๊ง|พินาศ|บรรลัย|ไม่มีที่ไป|รถชน|เป็นมะเร็ง|ป่วยหนัก)/u, 3, 'curse'],
	[/(มึง|มัน|แก|เธอ|พวกมัน).{0,6}(ตาย|ฉิบหาย|บรรลัย)/u, 3, 'curse'],
	[/(ตาย|ฆ่า).{0,6}(ให้หมด|ทั้งบ้าน|ทั้งโคตร|ยกครัว)/u, 3, 'curse'],
	[/\b(i|we)\s*(hope|wish)\s*(you|u|he|she|they|them|him|her)\b.{0,20}\b(die|dies|dead|suffer|rot|burn)\b/, 3, 'curse'],
	[/\bmay\s+(you|u|he|she|they|his|her)\b.{0,20}\b(die|dies|suffer|rot|burn)\b/, 3, 'curse'],
];

/* ------------------------------------------------------------------ normalisation */

const ZW = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\u{E0000}-\u{E007F}]/gu;
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '€': 'e', '¢': 'c' };
// Cyrillic/Greek homoglyphs commonly used to dodge filters.
const HOMO: Record<string, string> = { а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's', к: 'k', м: 'm', т: 't', н: 'h', в: 'b', α: 'a', ο: 'o', ν: 'v', ц: 'u', ρ: 'p', τ: 't', ι: 'i', κ: 'k' };
const TONE = /[\u0E47-\u0E4E]/g; // ็ ่ ้ ๊ ๋ ์ ํ ๎

export function baseNormalize(s: string): string {
	return s.normalize('NFKC').replace(ZW, '').toLowerCase();
}

/** Latin form: accents stripped, homoglyphs/leet mapped, non-letters → single spaces, single-letter runs joined. */
function latinForms(s: string): { spaced: string; joined: string; c1: string; c2: string } {
	let t = baseNormalize(s).normalize('NFKD').replace(/\p{M}+/gu, '');
	t = t.replace(/[^\s]/gu, (ch) => HOMO[ch] ?? LEET[ch] ?? ch);
	t = t.replace(/\*/g, '*');
	t = t.replace(/[^a-z*]+/g, ' ').trim();
	// Join runs of ≥3 single letters ("f u c k", "f.u.c.k") into one token.
	const toks = t.split(' ');
	const out: string[] = [];
	let run: string[] = [];
	const flush = () => {
		if (run.length >= 3) out.push(run.join(''));
		else out.push(...run);
		run = [];
	};
	for (const tok of toks) {
		if (tok.length === 1) run.push(tok);
		else {
			flush();
			out.push(tok);
		}
	}
	flush();
	const spaced = out.join(' ');
	return {
		spaced,
		joined: spaced.replace(/ /g, ''),
		c1: spaced.replace(/([a-z])\1+/g, '$1'),
		c2: spaced.replace(/([a-z])\1{2,}/g, '$1$1'),
	};
}

/** Thai forms: only Thai letters kept (so ค.ว.ย / ค ว ย collapse), repeats collapsed; skeleton has no tone marks. */
function thaiForms(s: string): { exact: string; skeleton: string } {
	const t = baseNormalize(s).replace(/[^\u0E00-\u0E7F]+/g, '');
	const exact = t.replace(/(.)\1+/gu, '$1').replace(/ๆ+/g, 'ๆ');
	const skeleton = exact.replace(TONE, '').replace(/(.)\1+/gu, '$1');
	return { exact, skeleton };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const collapse1 = (s: string) => s.replace(/([a-z])\1+/g, '$1');
function wordRe(term: string, collapsed: boolean): RegExp {
	const t = collapsed ? collapse1(term) : term;
	const body = t.split(' ').map((w) => [...w].map((c, i) => (i === 0 ? esc(c) : `(?:${esc(c)}|\\*)`)).join('')).join(' ');
	return new RegExp(`(?:^| )${body}(?:s|es|ed|er|ers|ing|in|y|z)?(?= |$)`);
}

type Compiled = { re: RegExp; reC: RegExp | null; score: number; term: string };
function compileWords(list: string[], score: number): Compiled[] {
	return [...new Set(list.map((w) => w.toLowerCase().trim()).filter(Boolean))].map((term) => ({
		term,
		score,
		re: wordRe(term, false),
		reC: collapse1(term.replace(/ /g, '')).length >= 4 ? wordRe(term, true) : null,
	}));
}
let CW: { block: Compiled[]; mild: Compiled[]; roots: string[]; rootsC: string[]; th: { exact: string; skel: string | null; score: number }[]; thAllow: { exact: string; skel: string }[]; allow: RegExp } | null = null;
function compiled() {
	if (CW) return CW;
	const block = compileWords(EN_WORDS_BLOCK, 3);
	const blockSet = new Set(block.map((b) => b.term));
	CW = {
		block,
		mild: compileWords(EN_WORDS_MILD.filter((w) => !blockSet.has(w)), 2),
		roots: EN_ROOTS,
		rootsC: EN_ROOTS.map(collapse1),
		th: TH.map(([w, score, skel]) => {
			const f = thaiForms(w);
			return { exact: f.exact, skel: skel ? f.skeleton : null, score };
		}),
		thAllow: TH_ALLOW.map((w) => {
			const f = thaiForms(w);
			return { exact: f.exact, skel: f.skeleton };
		}),
		allow: new RegExp(`(?:^| )(?:${EN_ALLOW.map(esc).join('|')})(?= |$)`, 'g'),
	};
	return CW;
}

/* ------------------------------------------------------------------ scoring */

export function scoreText(raw: string): { score: number; hits: string[] } {
	if (!raw) return { score: 0, hits: [] };
	const C = compiled();
	const hits: string[] = [];
	let score = 0;
	const add = (s: number, why: string) => {
		score += s;
		hits.push(why);
	};

	// English
	const L = latinForms(raw);
	const seen = new Set<string>();
	for (const form of [L.spaced, L.c2, L.c1]) {
		for (const w of C.block) {
			if (seen.has(w.term)) continue;
			if (w.re.test(form) || (form === L.c1 && w.reC?.test(form))) {
				seen.add(w.term);
				add(3, w.term);
			}
		}
	}
	if (!seen.size) {
		for (const w of C.mild) {
			if (seen.has(w.term)) continue;
			if (w.re.test(L.spaced) || w.re.test(L.c2) || w.reC?.test(L.c1)) {
				seen.add(w.term);
				add(2, w.term);
			}
		}
	}
	// Roots match inside a single token only (never across word gaps: "this hit" ≠ "shit").
	const toks = new Set<string>();
	for (const f of [L.spaced, L.c2]) for (const tok of (' ' + f + ' ').replace(C.allow, ' ').split(' ')) if (tok) toks.add(tok);
	for (const [i, r] of C.roots.entries()) {
		if (seen.has(r)) continue;
		const rc = C.rootsC[i];
		for (const tok of toks) {
			if (tok.includes(r) || (rc.length >= 4 && collapse1(tok).includes(rc))) {
				seen.add(r);
				add(3, r);
				break;
			}
		}
	}

	// Thai
	const T = thaiForms(raw);
	if (T.exact) {
		let ex = T.exact;
		let sk = T.skeleton;
		for (const a of C.thAllow) {
			ex = ex.split(a.exact).join('·');
			sk = sk.split(a.skel).join('·');
		}
		for (const t of C.th) {
			if (ex.includes(t.exact) || (t.skel && sk.includes(t.skel))) add(t.score, t.exact);
		}
	}

	// Phrase patterns on lightly-normalised text.
	const light = baseNormalize(raw).replace(/\s+/g, ' ');
	for (const [re, s, why] of PATTERNS) if (re.test(light)) add(s, why);
	return { score, hits };
}

/* ------------------------------------------------------------------ spam */

const EMOJI = /\p{Extended_Pictographic}/gu;
export function spamScore(raw: string): { score: number; hits: string[] } {
	const hits: string[] = [];
	if (!raw) return { score: 0, hits };
	const s = baseNormalize(raw);
	const ascii = s.replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d)));
	if (/(https?:|www\.|:\/\/)/.test(ascii)) hits.push('url');
	if (/\b[a-z0-9-]{2,}\s*(\.|dot|จุด)\s*(com|net|org|io|co|th|me|ly|gg|xyz|app|shop|link|site|info|biz|cc|tv|vip|bet|club|online|store)\b/.test(ascii)) hits.push('domain');
	if (/(^|\s)@[a-z0-9_.]{3,}/.test(ascii)) hits.push('handle');
	if (
		/(^|[^a-z])(line|ig|instagram|tiktok|telegram|facebook|fb|wechat|whatsapp|discord|snapchat)(?![a-z])\s*(id)?\s*[:：=]?\s*@?[a-z0-9_.]{4,}/.test(ascii) ||
		/(ไลน์|ไลน|แอดไลน์|แอด|ไอจี|ติ๊กต็อก|เทเลแกรม|เฟส)\s*(ไอดี|id)?\s*[:：=]?\s*@?[a-z0-9_.]{4,}/.test(ascii)
	)
		hits.push('contact');
	if (/(\d[\s\-.]*){9,}/.test(ascii)) hits.push('phone');
	if (/(สล็อต|บาคาร่า|เว็บตรง|แทงบอล|เครดิตฟรี|ฝากถอน|คาสิโน|ufa|betflix|pgslot|pg slot|casino|slot|lottovip|หวยออนไลน์|กู้เงิน|สินเชื่อ|เงินด่วน|crypto|bitcoin|forex|โปรโมชั่น|สมัครเลย|รับสมัคร|ดูดวงฟรี|onlyfans|คลิกเลย|click here|free money|follow me|subscribe)/.test(ascii)) hits.push('ad');
	if (/(.)\1{5,}/u.test(s)) hits.push('repeat');
	const letters = (raw.match(/[A-Za-z]/g) ?? []).length;
	const upper = (raw.match(/[A-Z]/g) ?? []).length;
	if (letters >= 16 && upper / letters > 0.85) hits.push('caps');
	const emoji = (raw.match(EMOJI) ?? []).length;
	const visible = Array.from(raw.replace(/\s/g, '')).length;
	if (emoji > 8 || (visible >= 6 && emoji / visible > 0.5)) hits.push('emoji');
	const lettersAll = (raw.match(/[\p{L}]/gu) ?? []).length;
	if (visible >= 8 && lettersAll / visible < 0.4 && emoji / visible <= 0.5) hits.push('symbols');
	return { score: hits.length ? 2 : 0, hits };
}

/** Key for duplicate detection: letters and digits only. */
export function dupKey(raw: string | undefined): string {
	if (!raw) return '';
	return baseNormalize(raw).replace(/[^\p{L}\p{N}]+/gu, '').replace(/(.)\1+/gu, '$1');
}

/* ------------------------------------------------------------------ policy */

export const REJECT_AT = 3;
export const SHADOW_AT = 2;

export function moderate(name: string | undefined, wish: string | undefined): Verdict {
	const reasons: string[] = [];
	let score = 0;
	for (const [field, text] of [
		['name', name],
		['wish', wish],
	] as const) {
		if (!text) continue;
		const a = scoreText(text);
		score = Math.max(score, a.score);
		reasons.push(...a.hits.map((h) => `${field}:${h}`));
	}
	if (score >= REJECT_AT) return { action: 'reject', score, reasons };
	const sp = spamScore(`${name ?? ''} ${wish ?? ''}`.trim());
	reasons.push(...sp.hits.map((h) => `spam:${h}`));
	score = Math.max(score, sp.score);
	return { action: score >= SHADOW_AT ? 'shadow' : 'ok', score, reasons };
}

export const REJECT_MESSAGE = { th: 'คำอธิษฐานนี้มีคำไม่เหมาะสม ลองเขียนใหม่นะ', en: 'That wish has words we can’t float — try writing it another way.' };
