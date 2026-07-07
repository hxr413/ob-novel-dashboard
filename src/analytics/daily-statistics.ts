import { NovelDashboardData } from '../core/saved-data';

export class DailyStatisticsManager {
	/**
	 * 更新每日新增字数
	 */
	updateDailyWords(
		data: NovelDashboardData,
		currentCounts: {
			[path: string]: number;
		},
	) {
		const today = this.getToday();

		let totalAdded = 0;

		for (const path in currentCounts) {
			const current = currentCounts[path] ?? 0;

			const previous = data.previousDocumentCounts[path] ?? 0;

			let diff = current - previous;

			// 删除内容不算负数
			if (diff < 0) {
				diff = 0;
			}

			totalAdded += diff;
		}

		// 如果今天已有记录，累加
		if (!data.dailyStats[today]) {
			data.dailyStats[today] = {
				words: 0,

				duration: 0,
			};
		}

		data.dailyStats[today].words += totalAdded;

		// 保存本次结果
		data.previousDocumentCounts = {
			...currentCounts,
		};

		return totalAdded;
	}

	getToday() {
		const now = new Date();

		const year = now.getFullYear();

		const month = String(now.getMonth() + 1).padStart(2, '0');

		const day = String(now.getDate()).padStart(2, '0');

		return `${year}-${month}-${day}`;
	}
}
