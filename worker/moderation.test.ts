import { describe, expect, it } from 'vitest';
import { dupKey, moderate, spamScore } from './moderation';

const act = (wish: string, name?: string) => moderate(name, wish).action;

describe('moderation: rejects clearly abusive text (Thai + English)', () => {
	const bad = [
		// English profanity, sexual, slurs + obfuscations
		'fuck you', 'FUCK', 'f.u.c.k', 'f u c k off', 'fuuuuuck', 'f*ck this', 'phuck', 'sh1t', 'bullsh!t', 'a$$hole', 'a s s',
		'bitch', 'b1tch', 'motherfucker', 'cunt', 'dick', 'd1ck pic', 'cock', 'pussy', 'porn', 'p0rn0', 'blowjob', 'dildo',
		'n1gger', 'nigga', 'faggot', 'retard', 'whore', 'slut', 'rape', 'stfu', 'wtf', 'ｆｕｃｋ', 'fцck', 'ſhit',
		'f\u200Bu\u200Bc\u200Bk', 'gangbang', 'hentai', 'pedophile', 'sexy',
		// death wishes / self-harm / gore
		'kill yourself', 'k i l l yourself', 'kys', 'go die', 'i hope you die', 'may you die', 'die in a fire',
		'i want to die', 'kill myself', 'drop dead', 'rot in hell', 'behead',
		// Thai profanity (+ spacing / repeats / punctuation tricks)
		'ควย', 'ค.ว.ย', 'ค ว ย', 'ควยยยยย', 'เหี้ย', 'เหี้ยยยย', 'ไอ้เหี้ย', 'สัส', 'สัด', 'ไอ้สัตว์', 'เย็ด', 'เย็ดแม่',
		'หี', 'หน้าหี', 'แม่ง', 'แม่งเอ๊ย', 'กระหรี่', 'ดอกทอง', 'ตอแหล', 'ส้นตีน', 'เสือก', 'เงี่ยน', 'ชักว่าว', 'เชี่ย',
		'ฟัคยู', 'ปากหมา', 'จัญไร',
		// Thai death wishes / curses
		'มึงตาย', 'ไปตาย', 'ไปตายซะ', 'ตายห่า', 'ขอให้มันตาย', 'ขอให้แฟนเก่าเป็นมะเร็ง', 'ขอให้มันฉิบหาย', 'แช่งให้มันซวย',
		'อยากตาย', 'ฆ่าตัวตาย', 'ฆ่ามึง', 'ตายให้หมดทั้งบ้าน',
	];
	for (const s of bad) it(`rejects ${JSON.stringify(s)}`, () => expect(act(s)).toBe('reject'));
	it('checks the name field too', () => expect(moderate('ไอ้เหี้ย', 'ขอให้รวย').action).toBe('reject'));
});

describe('moderation: does not block benign festival text (false-positive guard)', () => {
	const good = [
		'ขอให้ครอบครัวมีความสุข สุขภาพแข็งแรง', 'คิดถึงคุณยายที่จากไป', 'ขอให้ถูกหวย', 'ขอให้รวย ๆ เฮง ๆ', 'ขอให้สอบติด',
		'ขอให้ห่างไกลโรคภัย', 'หาเงินได้เยอะ ๆ', 'กะหรี่ปั๊บอร่อยมาก', 'แกงกะหรี่ฝีมือแม่', 'แม่งานลอยกระทงปีนี้',
		'สัดส่วนดีขึ้น', 'เปิดหีบสมบัติ', 'ขอให้เป็นผู้เชี่ยวชาญ', 'ไอ้หนูน้อย', 'ขอบคุณกูรู', 'ตายายสุขภาพดี', 'ตายใจ',
		'May next year be gentler', 'Happy Loy Krathong!', 'rest in peace grandpa, I miss you', 'Scunthorpe United',
		'cocktail party with the class', 'pass the glass', 'I passed my exam', 'peacock and butterfly', 'my therapist says hi',
		'assessment done', 'Dickens novels', 'cucumber salad', 'hello shell', 'shiitake soup', 'skills to learn', 'Essex',
		'🙏 สุขสันต์วันลอยกระทง 🪷', 'this hit song tonight', 'a big cocktail', 'night sky', 'skill it', 'ลอยกระทงกับแฟน ขอให้รักกันนาน ๆ',
	];
	for (const s of good) it(`allows ${JSON.stringify(s)}`, () => expect(act(s)).toBe('ok'));
	it('allows empty text', () => expect(moderate(undefined, undefined).action).toBe('ok'));
});

describe('moderation: shadow-hides borderline + spam', () => {
	const hidden = [
		'die', 'I would die for you', 'kill it tonight', 'so stupid', 'hell yeah', 'มึงกับกู', 'ศพ', 'ห่า',
		'visit www.slot.com', 'add line @abc123', 'line id: somebody99', 'แอดไลน์ abc1234', 'โทร 081-234-5678', '๐๘๑๒๓๔๕๖๗๘',
		'สมัครสล็อต เว็บตรง เครดิตฟรี', 'bit.ly/xyz', 'example dot com', 'HAPPY LOY KRATHONG EVERYONE!!!', 'aaaaaaaaaa',
		'🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏', '!!!???###$$$%%%', 'follow me on tiktok',
	];
	for (const s of hidden) it(`shadows ${JSON.stringify(s)}`, () => expect(act(s)).toBe('shadow'));
});

describe('spam helpers', () => {
	it('spam score is 0 for normal wishes', () => expect(spamScore('ขอให้มีความสุขมาก ๆ').score).toBe(0));
	it('dupKey ignores spacing, punctuation, case and repeats', () => {
		expect(dupKey('Hello,  WORLD!!!')).toBe(dupKey('helo world'));
		expect(dupKey('ขอให้รวยยยย')).toBe(dupKey('ขอให้ รวย'));
		expect(dupKey(undefined)).toBe('');
	});
});
