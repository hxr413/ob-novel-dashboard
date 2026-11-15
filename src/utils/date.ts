/**
 * 日期工具：统一使用本地时区的 YYYY-MM-DD
 */

export function formatDate(date: Date): string {
	return [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, '0'),
		String(date.getDate()).padStart(2, '0'),
	].join('-');
}

export function todayKey(): string {
	return formatDate(new Date());
}

export function isDateKey(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseDateKey(key: string): Date {
	const [year, month, day] = key.split('-').map(Number);

	return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/**
 * 两个日期之间相差的天数（b - a）
 */
export function daysBetween(a: string, b: string): number {
	const ms = parseDateKey(b).getTime() - parseDateKey(a).getTime();

	return Math.round(ms / 86400000);
}
