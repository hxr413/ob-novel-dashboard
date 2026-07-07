import { DailyWritingSummary } from '../dashboard-data';

export class YearHeatmap {
	static create(parent: HTMLElement, data: DailyWritingSummary[]) {
		const container = parent.createDiv({
			cls: 'novel-dashboard-heatmap',
		});

		const maxWords = Math.max(...data.map((item) => item.words), 1);

		/*
			按星期排列

			7 行

			53 列

		*/

		for (const item of data) {
			const day = container.createDiv({
				cls: 'heatmap-day',
			});

			const level = this.getHeatLevel(item.words, maxWords);

			if (level > 0) {
				day.addClass(`heat-${level}`);
			}

			/*
				tooltip

			*/

			day.setAttr(
				'title',
				`${item.date}: ${item.words.toLocaleString()} words`,
			);
		}

		return container;
	}

	private static getHeatLevel(words: number, max: number) {
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
}
