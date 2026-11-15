import { MarkdownRenderChild } from 'obsidian';

import { t } from '../i18n';
import { MonthlyCalendar } from './components/monthly-calendar';
import { WritingChart } from './components/writing-chart';
import { YearHeatmap } from './components/year-heatmap';
import type NovelDashboardPlugin from '../main';
import {
	CardRefs,
	renderCards,
	renderHeader,
	renderRecent,
	swapContent,
	updateCards,
} from './sections';

export const HOMEPAGE_CODE_BLOCK = 'webnovel-homepage';

/**
 * 每个主页代码块各自保留月历 / 热力图的翻页状态
 */
interface HomepageState {
	calendar: MonthlyCalendar;
	heatmap: YearHeatmap;
}

/**
 * 主页文档里 ```webnovel-homepage``` 代码块的渲染
 */
export class HomepageRenderer {
	private children = new Set<HomepageRenderChild>();

	constructor(private plugin: NovelDashboardPlugin) {}

	createChild(container: HTMLElement): HomepageRenderChild {
		const child = new HomepageRenderChild(this, container, {
			calendar: new MonthlyCalendar(this.plugin.dashboardData),
			heatmap: new YearHeatmap(this.plugin.dashboardData),
		});

		this.children.add(child);

		child.render();

		return child;
	}

	refresh() {
		for (const child of this.children) {
			child.render();
		}
	}

	updateLive() {
		for (const child of this.children) {
			child.updateLive();
		}
	}

	removeChild(child: HomepageRenderChild) {
		this.children.delete(child);
	}

	renderContent(container: HTMLElement, state: HomepageState): CardRefs {
		const provider = this.plugin.dashboardData;
		const summary = provider.getSummary();

		let cards!: CardRefs;

		// 离屏构建再整体替换：文档不会因为高度塌陷而滚动
		swapContent(container, (next) => {
			const root = next.createDiv({ cls: 'nd-root nd-homepage' });

			renderHeader(root, null, summary, () => this.plugin.openRecordsModal());

			cards = renderCards(root, summary);

			renderRecent(root, this.plugin, summary);

			WritingChart.create(root, t('last7Days'), provider.getDailyWriting(7));

			state.calendar.mount(root);
			state.heatmap.mount(root);
		});

		return cards;
	}

	updateCards(refs: CardRefs) {
		updateCards(refs, this.plugin.dashboardData.getSummary());
	}
}

class HomepageRenderChild extends MarkdownRenderChild {
	private cards: CardRefs | null = null;

	constructor(
		private renderer: HomepageRenderer,
		container: HTMLElement,
		private state: HomepageState,
	) {
		super(container);
	}

	render() {
		this.cards = this.renderer.renderContent(this.containerEl, this.state);
	}

	updateLive() {
		if (this.cards) {
			this.renderer.updateCards(this.cards);
		}
	}

	onunload() {
		this.renderer.removeChild(this);
	}
}
