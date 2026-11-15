import { t } from '../../i18n';
import { attachHoverTips, setHoverTip } from '../../ui/hover-tip';
import { openPeriodPicker } from './period-picker';
import { todayKey } from '../../utils/date';
import type { DashboardDataProvider } from '../dashboard-data';
import { heatLevel, Panel, renderPager, renderPanel } from '../sections';

function compact(words: number): string {
	return Math.abs(words) >= 10000 ? `${Math.round(words / 1000)}k` : String(words);
}

/**
 * 月历：可以翻到起始日期所在月份，最晚到本月
 *
 * 实例由视图持有，重绘时保留当前选中的月份
 */
export class MonthlyCalendar {
	/** year * 12 + (month - 1) */
	private index: number;

	private panel: Panel | null = null;

	constructor(private provider: DashboardDataProvider) {
		const now = new Date();

		this.index = now.getFullYear() * 12 + now.getMonth();
	}

	mount(parent: HTMLElement) {
		this.panel = renderPanel(parent, t('calendarTitle'));
		this.render();
	}

	private getBounds() {
		const now = new Date();
		const max = now.getFullYear() * 12 + now.getMonth();
		const [year, month] = this.provider.getStartDate().split('-').map(Number);
		const min = Math.min((year ?? now.getFullYear()) * 12 + (month ?? 1) - 1, max);

		return { min, max };
	}

	private go(delta: number) {
		this.index += delta;
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
		const { min, max } = this.getBounds();

		// 起始日期改动后，当前月份可能越界
		this.index = Math.min(max, Math.max(min, this.index));

		const year = Math.floor(this.index / 12);
		const month = (this.index % 12) + 1;
		const data = this.provider.getMonthlyWriting(year, month);
		const startDate = this.provider.getStartDate();
		const today = todayKey();

		renderPager(
			aside,
			t('monthLabel', {
				year,
				month: t('monthNames').split(',')[month - 1] ?? String(month),
			}),
			{
				canPrev: this.index > min,
				canNext: this.index < max,
				onPrev: () => this.go(-1),
				onNext: () => this.go(1),
				prevLabel: t('prevMonth'),
				nextLabel: t('nextMonth'),
				onLabelClick: (label) =>
					openPeriodPicker(panel.el, label, {
						mode: 'month',
						min,
						max,
						value: this.index,
						onPick: (value) => {
							this.index = value;
							this.render();
						},
					}),
			},
		);

		const total = data.reduce((sum, item) => sum + item.words, 0);

		body.createDiv({
			cls: 'nd-summary',
			text: t('monthSummary', {
				total,
				days: data.filter((item) => item.words > 0).length,
			}),
		});

		const grid = body.createDiv({ cls: 'nd-calendar-grid' });

		attachHoverTips(grid);

		for (const weekday of t('weekdays').split(',')) {
			grid.createDiv({ cls: 'nd-calendar-weekday', text: weekday });
		}

		// 周一开始：周日排在最后
		const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;

		for (let i = 0; i < offset; i++) {
			grid.createDiv({ cls: 'nd-calendar-cell is-blank' });
		}

		const monthMax = Math.max(...data.map((item) => item.words), 500);

		for (const item of data) {
			const cell = grid.createDiv({ cls: 'nd-calendar-cell' });

			cell.createDiv({
				cls: 'nd-calendar-date',
				text: String(Number(item.date.slice(8))),
			});

			if (item.date === today) {
				cell.addClass('is-today');
			}

			if (item.date < startDate || item.date > today) {
				cell.addClass('is-outside');
				continue;
			}

			if (item.words === 0) {
				continue;
			}

			const level = heatLevel(item.words, monthMax);

			if (level > 0) {
				cell.addClass(`heat-${level}`);
			}

			cell.createDiv({ cls: 'nd-calendar-words', text: compact(item.words) });
			setHoverTip(cell, t('dayTooltip', { date: item.date, words: item.words }));
		}

		panel.aside.replaceChildren(...Array.from(aside.childNodes));
		panel.body.replaceChildren(...Array.from(body.childNodes));
	}
}
