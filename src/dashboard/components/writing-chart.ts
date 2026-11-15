import { t } from '../../i18n';
import { attachHoverTips, setHoverTip } from '../../ui/hover-tip';
import { todayKey } from '../../utils/date';
import type { DailyWritingSummary } from '../dashboard-data';
import { renderPanel } from '../sections';

/**
 * 近 N 日柱状图（纯 DOM，跟随主题、宽度自适应）
 */
export class WritingChart {
	static create(parent: HTMLElement, title: string, data: DailyWritingSummary[]) {
		const today = todayKey();
		const root = renderPanel(parent, title).body;

		root.addClass('nd-chart');

		const total = data.reduce((sum, item) => sum + item.words, 0);
		const activeDays = data.filter((item) => item.words > 0).length;

		root.createDiv({
			cls: 'nd-summary',
			text: t('chartSummary', {
				total,
				avg: Math.round(Math.max(total, 0) / Math.max(data.length, 1)),
				days: activeDays,
			}),
		});

		const max = Math.max(...data.map((item) => item.words), 1);
		const bars = root.createDiv({ cls: 'nd-chart-bars' });

		attachHoverTips(bars);

		for (const item of data) {
			const column = bars.createDiv({ cls: 'nd-chart-col' });

			if (item.words !== 0) {
				setHoverTip(column, t('dayTooltip', { date: item.date, words: item.words }));
			}

			if (item.date === today) {
				column.addClass('is-today');
			}

			const bar = column.createDiv({ cls: 'nd-chart-bar' });

			if (item.words > 0) {
				// 有字的日子至少露出一点
				const percent = Math.max(4, (item.words / max) * 100);

				bar.setCssStyles({ height: `${percent}%` });
			} else {
				column.addClass('is-empty');
			}
		}

		const axis = root.createDiv({ cls: 'nd-chart-axis' });
		const first = data[0];
		const middle = data[Math.floor(data.length / 2)];

		axis.createSpan({ text: first?.date.slice(5) ?? '' });
		axis.createSpan({ text: middle?.date.slice(5) ?? '' });
		axis.createSpan({ text: t('today') });

		return root;
	}
}
