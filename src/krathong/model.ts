/** Loy Krathong (ลอยกระทง) — data model, options and bilingual copy. Self-contained. */

import {
	ACCENTS,
	BASES as BASE_IDS,
	CANDLES,
	COLORS,
	DECOR,
	FLOWER_KINDS,
	FOLDS,
	INCENSE,
	WAXES,
	type WireAccent,
	type WireBase,
	type WireColor,
	type WireDecor,
	type WireFlower,
	type WireFold,
	type WireWax,
} from '../../worker/protocol';

export type BaseId = WireBase;
export type FlowerKind = WireFlower;
export type FoldId = WireFold;
export type ColorId = WireColor;
export type WaxId = WireWax;
export type AccentId = WireAccent;
export type DecorId = WireDecor;

/** Everything that changes how a krathong looks (shared by the river, previews and links). */
export type Look = {
	base: BaseId;
	/** Leaf-fold pattern; used by the banana-leaf family. */
	fold: FoldId;
	/** 1–3 flower kinds, alternating around the crown. */
	flowers: FlowerKind[];
	/** Colour per flower, parallel to `flowers`. 'natural' = the flower's own colour. */
	colors: ColorId[];
	candles: 1 | 2 | 3;
	wax: WaxId;
	incense: 0 | 1 | 3;
	coin: boolean;
	hair: boolean;
	flags: boolean;
	pinwheel: boolean;
	lanterns: boolean;
	fireflies: boolean;
	accent: AccentId;
};

export type Krathong = Look & {
	/** Wish (คำอธิษฐาน). Empty when kept secret. */
	wish: string;
	/** Wish kept private: recipient only sees that a wish was made. */
	secret: boolean;
	to: string;
	from: string;
};

export const KLIMITS = { wish: 200, to: 40, from: 40, flowers: 3 } as const;

type BaseInfo = { id: BaseId; th: string; en: string; hint: string; hintTh: string; leafy?: boolean };
export const BASES: BaseInfo[] = [
	{ id: 'leaf', th: 'ใบตอง', en: 'Banana leaf', hint: 'Classic folded leaf on a banana-trunk slice', hintTh: 'พับใบตองบนหยวกกล้วย แบบดั้งเดิม', leafy: true },
	{ id: 'pleat', th: 'ใบตองจีบ', en: 'Modern pleat', hint: 'Crisp, tight modern pleats', hintTh: 'จีบใบตองแบบโมเดิร์น เรียบคม', leafy: true },
	{ id: 'petal', th: 'กลีบบัว', en: 'Lotus petals', hint: 'A bowl of real lotus petals', hintTh: 'ซ้อนกลีบบัวเป็นกระทง', leafy: false },
	{ id: 'bread', th: 'ขนมปัง', en: 'Bread', hint: 'Eco — the fish get a snack', hintTh: 'รักษ์โลก ปลาได้กินด้วย' },
	{ id: 'cone', th: 'โคนไอศกรีม', en: 'Ice-cream cone', hint: 'Eco — a crunchy waffle bowl', hintTh: 'รักษ์โลก ย่อยสลายได้' },
	{ id: 'coconut', th: 'กะลามะพร้าว', en: 'Coconut shell', hint: 'Eco — a polished coconut shell', hintTh: 'รักษ์โลก กะลามะพร้าวขัดเงา' },
	{ id: 'ice', th: 'น้ำแข็ง', en: 'Ice krathong', hint: 'Eco — melts back into the river', hintTh: 'รักษ์โลก ละลายกลับเป็นน้ำ' },
	{ id: 'hyacinth', th: 'ผักตบชวา', en: 'Water hyacinth', hint: 'Eco — woven from river weeds', hintTh: 'รักษ์โลก สานจากผักตบชวา', leafy: true },
	{ id: 'boat', th: 'เรือกระดาษ', en: 'Paper boat', hint: 'A folded paper boat, like childhood', hintTh: 'พับเรือกระดาษ เหมือนตอนเด็ก ๆ' },
];
export const isLeafy = (b: BaseId) => !!BASES.find((x) => x.id === b)?.leafy;

export const FOLD_INFO: { id: FoldId; th: string; en: string; art: string }[] = [
	{ id: 'nail', th: 'กลีบเล็บมือนาง', en: 'Pointed nail', art: '/\\/\\/\\' },
	{ id: 'rose', th: 'กลีบกุหลาบ', en: 'Rolled rose', art: '()()()' },
	{ id: 'pakha', th: 'กลีบผกา', en: 'Layered scallop', art: 'WWWWWW' },
];

export const FLOWERS: { id: FlowerKind; th: string; en: string; color: string; colors: ColorId[] }[] = [
	{ id: 'marigold', th: 'ดาวเรือง', en: 'Marigold', color: '#ff9f3d', colors: ['natural', 'yellow', 'red'] },
	{ id: 'orchid', th: 'กล้วยไม้', en: 'Orchid', color: '#c894ff', colors: ['natural', 'white', 'pink', 'yellow'] },
	{ id: 'lotus', th: 'ดอกบัว', en: 'Lotus', color: '#ffb3e0', colors: ['natural', 'white', 'purple', 'blue'] },
	{ id: 'bud', th: 'บัวตูม', en: 'Lotus bud', color: '#ff8ad4', colors: ['natural', 'white'] },
	{ id: 'jasmine', th: 'มะลิ', en: 'Jasmine', color: '#f6f3ec', colors: ['natural', 'yellow'] },
	{ id: 'garland', th: 'พวงมาลัย', en: 'Garland', color: '#f6f3ec', colors: ['natural', 'purple', 'yellow', 'pink'] },
	{ id: 'rose', th: 'กุหลาบ', en: 'Rose', color: '#e8323c', colors: ['natural', 'pink', 'white', 'yellow', 'orange'] },
	{ id: 'mum', th: 'เบญจมาศ', en: 'Chrysanthemum', color: '#ffd23d', colors: ['natural', 'white', 'pink', 'purple'] },
	{ id: 'dokrak', th: 'ดอกรัก', en: 'Crown flower', color: '#e9dcff', colors: ['natural', 'white'] },
];

export const COLOR_INFO: Record<ColorId, { th: string; en: string; css: string }> = {
	natural: { th: 'สีธรรมชาติ', en: 'natural', css: '' },
	red: { th: 'แดง', en: 'red', css: '#e8323c' },
	pink: { th: 'ชมพู', en: 'pink', css: '#ff7ac8' },
	white: { th: 'ขาว', en: 'white', css: '#f6f3ec' },
	yellow: { th: 'เหลือง', en: 'yellow', css: '#ffd23d' },
	orange: { th: 'ส้ม', en: 'orange', css: '#ff8a1f' },
	purple: { th: 'ม่วง', en: 'purple', css: '#a35bff' },
	blue: { th: 'ฟ้า', en: 'blue', css: '#5aa0ff' },
};

export const WAX_INFO: Record<WaxId, { th: string; css: string }> = {
	cream: { th: 'ขาวนวล', css: '#fff4d6' },
	gold: { th: 'ทอง', css: '#ffcf5a' },
	red: { th: 'แดง', css: '#ff5a4f' },
	pink: { th: 'ชมพู', css: '#ff9ad2' },
	blue: { th: 'ฟ้า', css: '#8fc3ff' },
	green: { th: 'เขียว', css: '#8fe3a0' },
};

export const ACCENT_INFO: Record<AccentId, { th: string; en: string; css: string }> = {
	none: { th: 'ไม่ใส่', en: 'none', css: '' },
	gold: { th: 'ทอง', en: 'gold', css: '#ffc53d' },
	silver: { th: 'เงิน', en: 'silver', css: '#d8dde6' },
	crimson: { th: 'แดงชาด', en: 'crimson', css: '#e0344a' },
	pink: { th: 'ชมพู', en: 'pink', css: '#ff7ac8' },
	jade: { th: 'หยก', en: 'jade', css: '#3fd29a' },
	indigo: { th: 'คราม', en: 'indigo', css: '#7c8cff' },
};

export const DECOR_INFO: { id: DecorId; th: string; small: string; en: string }[] = [
	{ id: 'flags', th: 'ธงเล็ก', small: 'ธงชัย', en: 'little flags' },
	{ id: 'pinwheel', th: 'กังหันลม', small: 'หมุนเบา ๆ', en: 'pinwheel' },
	{ id: 'lanterns', th: 'โคมไฟ', small: 'ไฟรอบขอบ', en: 'lanterns' },
	{ id: 'fireflies', th: 'หิ่งห้อย', small: 'บินวนรอบ', en: 'fireflies' },
];

export const DEFAULT_LOOK: Look = {
	base: 'leaf',
	fold: 'nail',
	flowers: ['marigold', 'orchid', 'lotus'],
	colors: ['natural', 'natural', 'natural'],
	candles: 1,
	wax: 'cream',
	incense: 3,
	coin: false,
	hair: false,
	flags: false,
	pinwheel: false,
	lanterns: false,
	fireflies: false,
	accent: 'none',
};

export const DEFAULT_KRATHONG: Krathong = {
	...DEFAULT_LOOK,
	wish: '',
	secret: false,
	to: '',
	from: '',
};

const inList = <T>(list: readonly T[], v: unknown): v is T => list.includes(v as T);
export const isBaseId = (v: unknown): v is BaseId => inList(BASE_IDS, v);
export const isFlowerKind = (v: unknown): v is FlowerKind => inList(FLOWER_KINDS, v);
export const isFoldId = (v: unknown): v is FoldId => inList(FOLDS, v);
export const isColorId = (v: unknown): v is ColorId => inList(COLORS, v);
export const isWaxId = (v: unknown): v is WaxId => inList(WAXES, v);
export const isAccentId = (v: unknown): v is AccentId => inList(ACCENTS, v);
export const isCandles = (v: unknown): v is Look['candles'] => inList(CANDLES, v);
export const isIncense = (v: unknown): v is Look['incense'] => inList(INCENSE, v);
export { DECOR };

/** Sanitise any partial look (from a link, the wire or the UI) into a complete one. */
export function normalizeLook(k: Partial<Look>): Look {
	const flowers: FlowerKind[] = [];
	const colors: ColorId[] = [];
	const rawF = Array.isArray(k.flowers) ? k.flowers : [];
	const rawC = Array.isArray(k.colors) ? k.colors : [];
	for (const [i, f] of rawF.entries()) {
		if (!isFlowerKind(f) || flowers.includes(f)) continue;
		flowers.push(f);
		colors.push(isColorId(rawC[i]) ? rawC[i] : 'natural');
		if (flowers.length >= KLIMITS.flowers) break;
	}
	const d = DEFAULT_LOOK;
	return {
		base: isBaseId(k.base) ? k.base : d.base,
		fold: isFoldId(k.fold) ? k.fold : d.fold,
		flowers: flowers.length ? flowers : [...d.flowers],
		colors: flowers.length ? colors : [...d.colors],
		candles: isCandles(k.candles) ? k.candles : d.candles,
		wax: isWaxId(k.wax) ? k.wax : d.wax,
		incense: isIncense(k.incense) ? k.incense : d.incense,
		coin: !!k.coin,
		hair: !!k.hair,
		flags: !!k.flags,
		pinwheel: !!k.pinwheel,
		lanterns: !!k.lanterns,
		fireflies: !!k.fireflies,
		accent: isAccentId(k.accent) ? k.accent : d.accent,
	};
}

/** A river item / float payload → full look. */
export function lookFromWire(w: {
	base: string;
	flowers: string[];
	coin?: boolean;
	hair?: boolean;
	fold?: string;
	colors?: string[];
	candles?: number;
	wax?: string;
	incense?: number;
	deco?: string[];
	accent?: string;
}): Look {
	const deco = Array.isArray(w.deco) ? w.deco : [];
	return normalizeLook({
		base: w.base as BaseId,
		flowers: w.flowers as FlowerKind[],
		colors: w.colors as ColorId[],
		fold: w.fold as FoldId,
		candles: (w.candles ?? 1) as Look['candles'],
		wax: w.wax as WaxId,
		incense: (w.incense ?? 3) as Look['incense'],
		coin: w.coin,
		hair: w.hair,
		flags: deco.includes('flags'),
		pinwheel: deco.includes('pinwheel'),
		lanterns: deco.includes('lanterns'),
		fireflies: deco.includes('fireflies'),
		accent: w.accent as AccentId,
	});
}

/** Look → compact float payload (defaults omitted; the server re-validates everything). */
export function lookToWire(l: Look) {
	const n = normalizeLook(l);
	const deco = DECOR.filter((d) => n[d]);
	return {
		base: n.base,
		flowers: n.flowers,
		coin: n.coin,
		hair: n.hair,
		...(n.fold !== 'nail' ? { fold: n.fold } : {}),
		...(n.colors.some((c) => c !== 'natural') ? { colors: n.colors } : {}),
		...(n.candles !== 1 ? { candles: n.candles as 2 | 3 } : {}),
		...(n.wax !== 'cream' ? { wax: n.wax } : {}),
		...(n.incense !== 3 ? { incense: n.incense as 0 | 1 } : {}),
		...(deco.length ? { deco } : {}),
		...(n.accent !== 'none' ? { accent: n.accent } : {}),
	};
}

/** Bilingual copy. Thai first, English second — the festival is Thai. */
export const T = {
	title: { th: 'ลอยกระทงออนไลน์', en: 'Loy Krathong, in ASCII' },
	greet: { th: 'สุขสันต์วันลอยกระทง', en: 'Happy Loy Krathong' },
	stepBase: { th: 'เลือกตัวกระทง', en: 'Choose a base' },
	stepFlowers: { th: 'แต่งดอกไม้', en: 'Add flowers' },
	stepExtras: { th: 'ธูป เทียน และของใส่กระทง', en: 'Candle, incense & keepsakes' },
	stepWish: { th: 'อธิษฐาน', en: 'Make a wish' },
	candle: { th: 'เทียน 1 เล่ม · ธูป 3 ดอก', en: '1 candle · 3 incense sticks' },
	coin: { th: 'ใส่เหรียญ', en: 'Add a coin' },
	coinHint: { th: 'ขอให้โชคดี มีเงินทอง', en: 'for luck and plenty' },
	hair: { th: 'ใส่เส้นผม', en: 'A strand of hair' },
	hairHint: { th: 'ลอยเคราะห์ ลอยทุกข์', en: 'let the bad luck float away' },
	wishPh: { th: 'ขอให้…', en: 'I wish…' },
	secret: { th: 'เก็บคำอธิษฐานเป็นความลับ', en: 'Keep my wish a secret' },
	toPh: { th: 'ถึง (ไม่ใส่ก็ได้)', en: 'To (optional)' },
	fromPh: { th: 'จาก (ไม่ใส่ก็ได้)', en: 'From (optional)' },
	float: { th: 'ลอยกระทง', en: 'Float it' },
	floating: { th: 'กระทงกำลังลอยไป…', en: 'drifting downstream…' },
	done: { th: 'ขอให้คำอธิษฐานเป็นจริง', en: 'May your wish come true' },
	share: { th: 'ส่งให้คนพิเศษ', en: 'Send it to someone' },
	copied: { th: 'คัดลอกลิงก์แล้ว', en: 'Link copied' },
	again: { th: 'ลอยอีกใบ', en: 'Float another' },
	back: { th: 'กลับไป Bloom.txt', en: 'Back to Bloom.txt' },
	arriving: { th: 'มีกระทงลอยมาหาคุณ', en: 'A krathong is floating your way' },
	open: { th: 'แตะเพื่อดู', en: 'Tap to watch it arrive' },
	wishOf: { th: 'คำอธิษฐาน', en: 'The wish' },
	secretWish: { th: 'อธิษฐานไว้ในใจ เป็นความลับ', en: 'a secret wish, kept in their heart' },
	yourOwn: { th: 'ลอยกระทงของคุณเอง', en: 'Float your own' },
	sound: { th: 'เสียง', en: 'Sound' },
} as const;
