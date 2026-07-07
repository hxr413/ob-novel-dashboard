import NovelDashboardPlugin from '../main';

export interface RecentFileSummary {
	path: string;

	time: number;
}

export interface DailyWritingSummary {
	date: string;

	words: number;

	duration: number;
}

export interface DashboardSummary {
	// 总字数

	totalWords: number;

	// 今日新增

	todayWords: number;

	// 今日写作时间

	todayDuration: number;

	// 最近写作

	recentFiles: RecentFileSummary[];
}

export class DashboardDataProvider {
	plugin: NovelDashboardPlugin;

	constructor(plugin: NovelDashboardPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Dashboard 首页数据
	 */

	getSummary(): DashboardSummary {
		const data = this.plugin.data;

		const today = this.getToday();

		const todayStat = data.dailyStats[today];

		return {
			totalWords: this.getTotalWords(),

			todayWords: todayStat?.words ?? 0,

			todayDuration: todayStat?.duration ?? 0,

			recentFiles: this.getRecentFiles(5),
		};
	}

	/**
	 * 总字数
	 */

	getTotalWords(): number {
		return Object.values(this.plugin.data.documentCounts).reduce(
			(total, count) => total + count,
			0,
		);
	}

	/**
	 * 最近写作

	 * 默认最多 5 个

	 */

	getRecentFiles(limit = 5): RecentFileSummary[] {
		return [...this.plugin.data.recentFiles]
			.sort((a, b) => b.time - a.time)
			.slice(0, limit);
	}

	/**
	 * 获取每日数据

	 */

	getDailyWriting(days = 30): DailyWritingSummary[] {
		const result: DailyWritingSummary[] = [];

		const now = new Date();

		for (let i = days - 1; i >= 0; i--) {
			const date = new Date(now);

			date.setDate(now.getDate() - i);

			const key = this.formatDate(date);

			const stat = this.plugin.data.dailyStats[key];

			result.push({
				date: key,

				words: stat?.words ?? 0,

				duration: stat?.duration ?? 0,
			});
		}

		return result;
	}

	/**
	 * 周统计

	 */

	getWeeklyWriting() {
		return this.getDailyWriting(7);
	}

	/**
	 * 月日历数据

	 */

	getMonthlyWriting(year: number, month: number) {
		const result: DailyWritingSummary[] = [];

		const days = new Date(year, month, 0).getDate();

		for (let i = 1; i <= days; i++) {
			const date = new Date(year, month - 1, i);

			const key = this.formatDate(date);

			const stat = this.plugin.data.dailyStats[key];

			result.push({
				date: key,

				words: stat?.words ?? 0,

				duration: stat?.duration ?? 0,
			});
		}

		return result;
	}

	/**
	 * 年热力图

	 */

	getYearWriting(year: number) {
		const result: DailyWritingSummary[] = [];

		const start = new Date(year, 0, 1);

		const end = new Date(year + 1, 0, 1);

		for (let date = start; date < end; date.setDate(date.getDate() + 1)) {
			const key = this.formatDate(date);

			const stat = this.plugin.data.dailyStats[key];

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
