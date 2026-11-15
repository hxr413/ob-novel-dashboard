import type { NovelDashboardData, RecentFile } from '../core/saved-data';
import { daysBetween, formatDate, todayKey } from '../utils/date';

export interface DailyWritingSummary {
	date: string;
	words: number;
	typed: number;
	duration: number;
}

export interface DashboardSummary {
	totalWords: number;
	todayNet: number;
	todayTyped: number;
	todayDuration: number;
	startDate: string;
	/** 从起始日期到今天是第几天 */
	dayNumber: number;
	recentFiles: RecentFile[];
}

/**
 * 侧边栏和主页共用的数据读取
 */
export class DashboardDataProvider {
	constructor(
		private getData: () => NovelDashboardData,
		private exists: (path: string) => boolean,
	) {}

	getSummary(): DashboardSummary {
		const data = this.getData();
		const today = todayKey();
		const stat = data.dailyStats[today];
		const startDate = this.getStartDate();

		let totalWords = 0;

		for (const path in data.documentCounts) {
			totalWords += data.documentCounts[path] ?? 0;
		}

		return {
			totalWords,
			todayNet: stat?.words ?? 0,
			todayTyped: stat?.typed ?? 0,
			todayDuration: stat?.duration ?? 0,
			startDate,
			dayNumber: Math.max(1, daysBetween(startDate, today) + 1),
			recentFiles: this.getRecentFiles(5),
		};
	}

	/**
	 * 起始日期：设置值与最早一条记录中较早者
	 */
	getStartDate(): string {
		const data = this.getData();

		const earliest = Object.keys(data.dailyStats)
			.filter((date) => {
				const stat = data.dailyStats[date];

				return stat && (stat.words !== 0 || stat.typed > 0 || stat.duration > 0);
			})
			.sort()[0];

		return earliest && earliest < data.startDate ? earliest : data.startDate;
	}

	getRecentFiles(limit = 5): RecentFile[] {
		return [...this.getData().recentFiles]
			.filter((file) => this.exists(file.path))
			.sort((a, b) => b.time - a.time)
			.slice(0, limit);
	}

	getDailyWriting(days = 30): DailyWritingSummary[] {
		const result: DailyWritingSummary[] = [];
		const now = new Date();

		for (let i = days - 1; i >= 0; i--) {
			const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);

			result.push(this.getDay(formatDate(date)));
		}

		return result;
	}

	getMonthlyWriting(year: number, month: number): DailyWritingSummary[] {
		const result: DailyWritingSummary[] = [];
		const days = new Date(year, month, 0).getDate();

		for (let i = 1; i <= days; i++) {
			result.push(this.getDay(formatDate(new Date(year, month - 1, i))));
		}

		return result;
	}

	getYearWriting(year: number): DailyWritingSummary[] {
		const result: DailyWritingSummary[] = [];
		const date = new Date(year, 0, 1);

		while (date.getFullYear() === year) {
			result.push(this.getDay(formatDate(date)));
			date.setDate(date.getDate() + 1);
		}

		return result;
	}

	private getDay(date: string): DailyWritingSummary {
		const stat = this.getData().dailyStats[date];

		return {
			date,
			words: stat?.words ?? 0,
			typed: stat?.typed ?? 0,
			duration: stat?.duration ?? 0,
		};
	}
}
