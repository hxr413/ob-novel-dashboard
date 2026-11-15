import { ItemView, WorkspaceLeaf } from 'obsidian';

import { t } from '../i18n';
import type NovelDashboardPlugin from '../main';
import { MonthlyCalendar } from './components/monthly-calendar';
import { closePeriodPicker } from './components/period-picker';
import type { DashboardSummary } from './dashboard-data';
import { hideHoverTip } from '../ui/hover-tip';
import { WritingChart } from './components/writing-chart';
import { YearHeatmap } from './components/year-heatmap';
import {
	CardRefs,
	renderCards,
	renderHeader,
	renderRecent,
	swapContent,
	updateCards,
} from './sections';

export const DASHBOARD_VIEW_TYPE = 'novel-dashboard-view';

export const DASHBOARD_ICON = 'notebook-pen';

/**
 * 右侧边栏写作面板
 */
export class DashboardView extends ItemView {
	private cards: CardRefs | null = null;

	private calendar: MonthlyCalendar | null = null;

	private heatmap: YearHeatmap | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: NovelDashboardPlugin,
	) {
		super(leaf);
	}

	getViewType() {
		return DASHBOARD_VIEW_TYPE;
	}

	getDisplayText() {
		// 与主页文档同名
		return this.plugin.settings.homepageName;
	}

	getIcon() {
		return DASHBOARD_ICON;
	}

	async onOpen() {
		this.render();
	}

	/**
	 * 完整重绘（数据结构变化时，已做防抖）
	 */
	render() {
		const provider = this.plugin.dashboardData;
		const summary = provider.getSummary();

		this.contentEl.addClass('novel-dashboard', 'nd-root');

		hideHoverTip();

		// 离屏构建再整体替换：保持滚动位置，不会跳回顶部
		swapContent(this.contentEl, (container) => this.build(container, summary));
	}

	private build(container: HTMLElement, summary: DashboardSummary) {
		const provider = this.plugin.dashboardData;

		renderHeader(container, this.getDisplayText(), summary, () =>
			this.plugin.openRecordsModal(),
		);

		this.cards = renderCards(container, summary);

		renderRecent(container, this.plugin, summary);

		WritingChart.create(container, t('last30Days'), provider.getDailyWriting(30));

		// 月历和热力图保留翻页状态
		this.calendar ??= new MonthlyCalendar(provider);
		this.calendar.mount(container);

		this.heatmap ??= new YearHeatmap(provider);
		this.heatmap.mount(container);
	}

	/**
	 * 只更新数字卡片（输入、计时时调用）
	 */
	updateLive() {
		if (this.cards) {
			updateCards(this.cards, this.plugin.dashboardData.getSummary());
		}
	}

	async onClose() {
		closePeriodPicker();
		hideHoverTip();
		this.cards = null;
	}
}
