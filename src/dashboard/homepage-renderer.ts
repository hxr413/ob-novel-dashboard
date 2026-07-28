import { MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';

import NovelDashboardPlugin from '../main';

import { DashboardDataProvider } from './dashboard-data';

export class HomepageRenderer {
	plugin: NovelDashboardPlugin;

	provider: DashboardDataProvider;

	private children = new Set<HomepageRenderChild>();

	constructor(plugin: NovelDashboardPlugin) {
		this.plugin = plugin;

		this.provider = new DashboardDataProvider(plugin);
	}

	render(
		_source: string,
		container: HTMLElement,
		context: MarkdownPostProcessorContext,
	) {
		const child = new HomepageRenderChild(this, container);

		this.children.add(child);

		context.addChild(child);

		child.render();
	}

	refresh() {
		for (const child of this.children) {
			child.render();
		}
	}

	removeChild(child: HomepageRenderChild) {
		this.children.delete(child);
	}

	renderContent(container: HTMLElement) {
		container.empty();

		const summary = this.provider.getSummary();

		const daily = this.provider.getDailyWriting(7);

		const root = container.createDiv({ cls: 'novel-homepage-root' });

		const cards = root.createDiv({ cls: 'novel-homepage-grid' });

		this.createCard(cards, summary.totalWords.toLocaleString(), '总字数');

		this.createCard(
			cards,
			`+${summary.todayWords.toLocaleString()}`,
			'今日新增',
		);

		this.createCard(
			cards,
			this.formatDuration(summary.todayDuration),
			'今日时长',
		);

		const recentSection = root.createDiv({ cls: 'novel-homepage-section' });

		recentSection.createEl('h3', {
			text: '最近写作',
			cls: 'novel-homepage-section-title',
		});

		const recentList = recentSection.createDiv({
			cls: 'novel-homepage-list',
		});

		if (summary.recentFiles.length > 0) {
			for (const file of summary.recentFiles) {
				const item = recentList.createDiv({
					cls: 'novel-homepage-list-item',
				});

				item.setText(file.path);
			}
		} else {
			recentList.createDiv({
				cls: 'novel-homepage-empty',
				text: '暂无最近写作记录',
			});
		}

		const dailySection = root.createDiv({ cls: 'novel-homepage-section' });

		dailySection.createEl('h3', {
			text: '近 7 日',
			cls: 'novel-homepage-section-title',
		});

		const table = dailySection.createEl('table', {
			cls: 'novel-homepage-table',
		});

		const thead = table.createEl('thead');

		const headerRow = thead.createEl('tr');

		headerRow.createEl('th', { text: '日期' });
		headerRow.createEl('th', { text: '字数' });
		headerRow.createEl('th', { text: '时长' });

		const tbody = table.createEl('tbody');

		for (const item of daily) {
			const row = tbody.createEl('tr');

			row.createEl('td', { text: item.date });
			row.createEl('td', { text: item.words.toLocaleString() });
			row.createEl('td', { text: this.formatDuration(item.duration) });
		}
	}

	private createCard(parent: HTMLElement, value: string, label: string) {
		const card = parent.createDiv({ cls: 'novel-homepage-card' });

		card.createEl('div', {
			cls: 'novel-homepage-card-value',
			text: value,
		});

		card.createEl('div', {
			cls: 'novel-homepage-card-label',
			text: label,
		});
	}

	private formatDuration(seconds: number): string {
		const hours = Math.floor(seconds / 3600);

		const minutes = Math.floor((seconds % 3600) / 60);

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}

		return `${minutes}m`;
	}
}

class HomepageRenderChild extends MarkdownRenderChild {
	renderer: HomepageRenderer;

	constructor(renderer: HomepageRenderer, container: HTMLElement) {
		super(container);

		this.renderer = renderer;
	}

	render() {
		this.renderer.renderContent(this.containerEl);
	}

	onunload() {
		this.renderer.removeChild(this);
	}
}
