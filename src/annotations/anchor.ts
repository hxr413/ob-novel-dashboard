/**
 * 批注定位
 *
 * 保存「原文 + 前后各 32 个字符」。重新打开文档时：
 * 1. 原位置文字没变 -> 直接用
 * 2. 否则在全文里找原文，按前后文吻合度 + 离原位置远近挑最合适的一处
 * 3. 都找不到 -> 返回 null（批注保留，标记为「原文已找不到」）
 */

const CONTEXT = 32;

export interface AnchorData {
	from: number;
	to: number;
	quote: string;
	prefix: string;
	suffix: string;
}

export interface Range {
	from: number;
	to: number;
}

export function captureAnchor(doc: string, from: number, to: number): AnchorData {
	return {
		from,
		to,
		quote: doc.slice(from, to),
		prefix: doc.slice(Math.max(0, from - CONTEXT), from),
		suffix: doc.slice(to, to + CONTEXT),
	};
}

function commonSuffixLength(a: string, b: string): number {
	let i = 0;

	while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) {
		i++;
	}

	return i;
}

function commonPrefixLength(a: string, b: string): number {
	let i = 0;

	while (i < a.length && i < b.length && a[i] === b[i]) {
		i++;
	}

	return i;
}

export function resolveAnchor(doc: string, anchor: AnchorData): Range | null {
	const { quote } = anchor;

	if (!quote) {
		return null;
	}

	let best: Range | null = null;
	let bestScore = -Infinity;
	let bestContext = 0;
	let index = doc.indexOf(quote);

	while (index !== -1) {
		const end = index + quote.length;

		// 前后文吻合的字符数
		const context =
			commonSuffixLength(doc.slice(Math.max(0, index - CONTEXT), index), anchor.prefix) +
			commonPrefixLength(doc.slice(end, end + CONTEXT), anchor.suffix);

		// 同样吻合时，离原位置越近越好；原位置略加分
		const score =
			context + (index === anchor.from ? 0.5 : 0) - Math.abs(index - anchor.from) / 1e7;

		if (score > bestScore) {
			bestScore = score;
			bestContext = context;
			best = { from: index, to: end };
		}

		index = doc.indexOf(quote, index + 1);
	}

	// 前后文几乎都对不上：宁可标记为「找不到」，也不要挂到别处的同样文字上
	const required = Math.min(3, anchor.prefix.length + anchor.suffix.length);

	return bestContext >= required ? best : null;
}
