import { NovelDashboardData } from '../core/saved-data';

export interface DashboardDailyItem {
	date: string;

	words: number;

	duration: number;
}

export interface DashboardRecentFile {
	path: string;

	time: number;
}

export class DashboardManager {
	data: NovelDashboardData;

	constructor(data: NovelDashboardData) {
		this.data = data;
	}

	/**
	 * 总字数
	 */

	getTotalWords(): number {
		return Object.values(this.data.documentCounts).reduce(
			(total, count) => total + count,
			0,
		);
	}

	/**
	 * 今日新增

	 */

	getTodayWords(): number {
		const today = this.getToday();

		return this.data.dailyStats[today]?.words ?? 0;
	}

	/**
	 * 今日写作时间

	 */

	getTodayDuration(): number {
		const today = this.getToday();

		return this.data.dailyStats[today]?.duration ?? 0;
	}

	getWritingStreak(): number {
		let streak = 0;

		const date = new Date();

		while (true) {
			const key = this.formatDate(date);

			const stat = this.data.dailyStats[key];

			if (!stat || stat.words <= 0) {
				break;
			}

			streak++;

			date.setDate(date.getDate() - 1);
		}

		return streak;
	}

	/**
	 * 格式化时间

	 */

	formatDuration(seconds: number): string {
		const hours = Math.floor(seconds / 3600);

		const minutes = Math.floor((seconds % 3600) / 60);

		if (hours > 0) {
			return `${hours} 时 ${minutes} 分`;
		}

		return `${minutes} 分`;
	}

	/**
	 * 最近写作文件

	 */

	getRecentFiles(limit = 5): DashboardRecentFile[] {
		return [...this.data.recentFiles]
			.sort((a, b) => b.time - a.time)
			.slice(0, limit);
	}

	/**
	 * 最近 30 天

	 */

	getDailyChart(days = 30): DashboardDailyItem[] {
		return this.getDays(days);
	}

	/**
	 * 最近 7 天

	 */

	getWeeklyChart(): DashboardDailyItem[] {
		return this.getDays(7);
	}

	/**
	 * 月度日历

	 */

	getMonthlyCalendar(year: number, month: number): DashboardDailyItem[] {
		const result: DashboardDailyItem[] = [];

		const days = new Date(year, month, 0).getDate();

		for (let i = 1; i <= days; i++) {
			const date = new Date(year, month - 1, i);

			const key = this.formatDate(date);

			result.push({
				date: key,

				words: this.data.dailyStats[key]?.words ?? 0,

				duration: this.data.dailyStats[key]?.duration ?? 0,
			});
		}

		return result;
	}

	/**
	 * 年热力图

	 */

	getYearHeatmap(year: number): DashboardDailyItem[] {
		const result: DashboardDailyItem[] = [];

		const date = new Date(year, 0, 1);

		const end = new Date(year + 1, 0, 1);

		while (date < end) {
			const key = this.formatDate(date);

			result.push({
				date: key,

				words: this.data.dailyStats[key]?.words ?? 0,

				duration: this.data.dailyStats[key]?.duration ?? 0,
			});

			date.setDate(date.getDate() + 1);
		}

		return result;
	}

	private getDays(days: number): DashboardDailyItem[] {
		const result: DashboardDailyItem[] = [];

		const now = new Date();

		for (let i = days - 1; i >= 0; i--) {
			const date = new Date(now);

			date.setDate(now.getDate() - i);

			const key = this.formatDate(date);

			const stat = this.data.dailyStats[key];

			result.push({
				date: key,

				words: stat?.words ?? 0,

				duration: stat?.duration ?? 0,
			});
		}

		return result;
	}

	private getToday(): string {
		return this.formatDate(new Date());
	}

	private formatDate(date: Date): string {
		return [
			date.getFullYear(),

			String(date.getMonth() + 1).padStart(2, '0'),

			String(date.getDate()).padStart(2, '0'),
		].join('-');
	}
}
