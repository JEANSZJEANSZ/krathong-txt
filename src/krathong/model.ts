/** Loy Krathong (ลอยกระทง) — data model, options and bilingual copy. Self-contained. */

export type BaseId = 'leaf' | 'bread' | 'cone';
export type FlowerKind = 'marigold' | 'orchid' | 'lotus' | 'jasmine';

export type Krathong = {
	base: BaseId;
	/** 1–3 flower kinds, alternating around the crown. */
	flowers: FlowerKind[];
	/** Tradition toggles. */
	coin: boolean;
	hair: boolean;
	/** Wish (คำอธิษฐาน). Empty when kept secret. */
	wish: string;
	/** Wish kept private: recipient only sees that a wish was made. */
	secret: boolean;
	to: string;
	from: string;
};

export const KLIMITS = { wish: 200, to: 40, from: 40, flowers: 3 } as const;

export const BASES: { id: BaseId; th: string; en: string; hint: string; hintTh: string }[] = [
	{ id: 'leaf', th: 'ใบตอง', en: 'Banana leaf', hint: 'Classic folded leaf on a banana-trunk slice', hintTh: 'พับใบตองบนหยวกกล้วย แบบดั้งเดิม' },
	{ id: 'bread', th: 'ขนมปัง', en: 'Bread', hint: 'Eco — the fish get a snack', hintTh: 'รักษ์โลก ปลาได้กินด้วย' },
	{ id: 'cone', th: 'โคนไอศกรีม', en: 'Ice-cream cone', hint: 'Eco — a crunchy waffle bowl', hintTh: 'รักษ์โลก ย่อยสลายได้' },
];

export const FLOWERS: { id: FlowerKind; th: string; en: string; color: string }[] = [
	{ id: 'marigold', th: 'ดาวเรือง', en: 'Marigold', color: '#ff9f3d' },
	{ id: 'orchid', th: 'กล้วยไม้', en: 'Orchid', color: '#c894ff' },
	{ id: 'lotus', th: 'ดอกบัว', en: 'Lotus', color: '#ffb3e0' },
	{ id: 'jasmine', th: 'มะลิ', en: 'Jasmine', color: '#f6f3ec' },
];

export const DEFAULT_KRATHONG: Krathong = {
	base: 'leaf',
	flowers: ['marigold', 'orchid', 'lotus'],
	coin: false,
	hair: false,
	wish: '',
	secret: false,
	to: '',
	from: '',
};

export function isBaseId(v: unknown): v is BaseId {
	return v === 'leaf' || v === 'bread' || v === 'cone';
}
export function isFlowerKind(v: unknown): v is FlowerKind {
	return v === 'marigold' || v === 'orchid' || v === 'lotus' || v === 'jasmine';
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
