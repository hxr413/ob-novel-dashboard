import { DailyWritingSummary } from '../dashboard-data';

export class MonthlyCalendar {
	static create(parent: HTMLElement, data: DailyWritingSummary[]) {
		const container = parent.createDiv({
			cls: 'novel-dashboard-calendar',
		});

		/*
			星期标题
		*/

		const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

		for (const day of weekdays) {
			container.createDiv({
				cls: 'calendar-weekday',
				text: day,
			});
		}

		/*
			计算月份第一天偏移

		*/

		const firstDate = new Date(data[0]?.date ?? new Date().toISOString());

		const startDay = firstDate.getDay();

		for (let i = 0; i < startDay; i++) {
			container.createDiv({
				cls: 'calendar-empty',
			});
		}

		/*
			最大写作量

			用于 heatmap 强度

		*/

		const maxWords = Math.max(...data.map((item) => item.words), 1);

		const today = this.formatDate(new Date());

		/*
			日期格子

		*/

		for (const item of data) {
			const date = new Date(item.date);

			const day = container.createDiv({
				cls: 'calendar-day',
			});

			/*
				今天高亮

			*/

			if (item.date === today) {
				day.addClass('today');
			}

			/*
				heatmap 等级

			*/

			const level = this.getHeatLevel(item.words, maxWords);

			if (level > 0) {
				day.addClass(`heat-${level}`);
			}

			day.createEl('div', {
				cls: 'calendar-date',
				text: String(date.getDate()),
			});

			day.createEl('div', {
				cls: 'calendar-words',
				text: item.words > 0 ? item.words.toLocaleString() : '-',
			});
		}

		return container;
	}

	/**
	 * 写作量 -> 热力等级
	 *
	 * 0 无
	 *
	 * 1 少量
	 *
	 * 5 大量
	 */

	private static getHeatLevel(words: number, max: number): number {
		if (words <= 0) {
			return 0;
		}

		const ratio = words / max;

		if (ratio < 0.2) {
			return 1;
		}

		if (ratio < 0.4) {
			return 2;
		}

		if (ratio < 0.7) {
			return 3;
		}

		return 4;
	}

	private static formatDate(date: Date) {
		return [
			date.getFullYear(),

			String(date.getMonth() + 1).padStart(2, '0'),

			String(date.getDate()).padStart(2, '0'),
		].join('-');
	}
}
