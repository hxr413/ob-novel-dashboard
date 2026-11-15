import { t } from '../../i18n';
import { attachHoverTips, setHoverTip } from '../../ui/hover-tip';
import { openPeriodPicker } from './period-picker';
import { todayKey } from '../../utils/date';
import type { DailyWritingSummary, DashboardDataProvider } from '../dashboard-data';
import { heatLevel, Panel, renderPager, renderPanel } from '../sections';

/**
 * 最长连续写作天数
 */
function longestStreak(data: DailyWritingSummary[]): number {
	let best = 0;
	let current = 0;

	for (const item of data) {
		current = item.words > 0 ? current + 1 : 0;
		best = Math.max(best, current);
	}

	return best;
}

/**
 * 年度热力图：按周排列（列 = 周，行 = 星期），宽度自适应
 *
 * 可以翻到起始日期所在年份
 */
export class YearHeatmap {
	private year = new Date().getFullYear();

	private panel: Panel | null = null;

	constructor(private provider: DashboardDataProvider) {}

	mount(parent: HTMLElement) {
		this.panel = renderPanel(parent, t('heatmapTitle'));
		this.render();
	}

	private render() {
		if (!this.panel) {
			return;
		}

		const panel = this.panel;

		// 离屏构建，最后一次性替换，避免高度塌陷导致滚动跳动
		const aside = createDiv();
		const body = createDiv();
		const maxYear = new Date().getFullYear();
		const minYear = Math.min(Number(this.provider.getStartDate().slice(0, 4)) || maxYear, maxYear);

		this.year = Math.min(maxYear, Math.max(minYear, this.year));

		const data = this.provider.getYearWriting(this.year);
		const startDate = this.provider.getStartDate();
		const today = todayKey();

		renderPager(aside, String(this.year), {
			canPrev: this.year > minYear,
			canNext: this.year < maxYear,
			onPrev: () => {
				this.year--;
				this.render();
			},
			onNext: () => {
				this.year++;
				this.render();
			},
			prevLabel: t('prevYear'),
			nextLabel: t('nextYear'),
			onLabelClick: (label) =>
				openPeriodPicker(panel.el, label, {
					mode: 'year',
					min: minYear,
					max: maxYear,
					value: this.year,
					onPick: (value) => {
						this.year = value;
						this.render();
					},
				}),
		});

		const total = data.reduce((sum, item) => sum + item.words, 0);

		body.createDiv({
			cls: 'nd-summary',
			text: t('yearSummary', {
				total,
				days: data.filter((item) => item.words > 0).length,
				streak: longestStreak(data),
			}),
		});

		// 与月历一致：每列从周一开始
		const offset = (new Date(this.year, 0, 1).getDay() + 6) % 7;
		const weeks = Math.ceil((offset + data.length) / 7);

		const wrapper = body.createDiv({ cls: 'nd-heatmap' });

		/* 月份标签：放在每月 1 号所在的列 */

		const months = wrapper.createDiv({ cls: 'nd-heatmap-months' });
		const monthNames = t('monthShort').split(',');

		months.setCssStyles({ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` });

		data.forEach((item, index) => {
			if (item.date.endsWith('-01')) {
				const month = Number(item.date.slice(5, 7));

				// 只标单数月，窄屏下不会挤在一起
				if (month % 2 === 1) {
					months.createSpan({
						text: monthNames[month - 1] ?? '',
					}).setCssStyles({
						gridColumnStart: String(Math.floor((offset + index) / 7) + 1),
					});
				}
			}
		});

		/* 格子 */

		const grid = wrapper.createDiv({ cls: 'nd-heatmap-grid' });

		attachHoverTips(grid);

		grid.setCssStyles({ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` });

		for (let i = 0; i < offset; i++) {
			grid.createDiv({ cls: 'nd-heatmap-cell is-blank' });
		}

		const yearMax = Math.max(...data.map((item) => item.words), 500);

		for (const item of data) {
			const cell = grid.createDiv({ cls: 'nd-heatmap-cell' });

			if (item.date < startDate || item.date > today) {
				cell.addClass('is-outside');
				continue;
			}

			const level = heatLevel(item.words, yearMax);

			if (level > 0) {
				cell.addClass(`heat-${level}`);
			}

			if (item.date === today) {
				cell.addClass('is-today');
			}

			// 有字数才显示悬浮提示
			if (item.words !== 0) {
				cell.addClass('has-words');
				setHoverTip(cell, t('dayTooltip', { date: item.date, words: item.words }));
			}
		}

		panel.aside.replaceChildren(...Array.from(aside.childNodes));
		panel.body.replaceChildren(...Array.from(body.childNodes));
	}
}
