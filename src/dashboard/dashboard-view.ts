import { ItemView, WorkspaceLeaf } from 'obsidian';

import NovelDashboardPlugin from '../main';

import { WritingChart } from './components/writing-chart';

import { MonthlyCalendar } from './components/monthly-calendar';

import { YearHeatmap } from './components/year-heatmap';

export const DASHBOARD_VIEW_TYPE = 'novel-dashboard-view';

export class DashboardView extends ItemView {
	plugin: NovelDashboardPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: NovelDashboardPlugin) {
		super(leaf);

		this.plugin = plugin;
	}

	getViewType() {
		return DASHBOARD_VIEW_TYPE;
	}

	getDisplayText() {
		return 'Novel Dashboard';
	}

	async onOpen() {
		await this.render();
	}

	async render() {
		const container = this.contentEl;

		container.empty();

		container.addClass('novel-dashboard');

		const provider = this.plugin.dashboardData;

		if (!provider) {
			container.createEl('p', {
				text: 'Dashboard not initialized',
			});

			return;
		}

		const summary = provider.getSummary();

		/*
			标题

		*/

		container.createEl('h2', {
			text: 'Novel Dashboard',
		});

		/*
			统计卡片

		*/

		const cards = container.createDiv({
			cls: 'novel-dashboard-cards',
		});

		this.createCard(
			cards,
			summary.totalWords.toLocaleString(),
			'Total Words',
		);

		this.createCard(
			cards,
			`+${summary.todayWords.toLocaleString()}`,
			'Today',
		);

		this.createCard(
			cards,
			this.formatDuration(summary.todayDuration),
			'Writing Time',
		);

		/*
			最近写作

		*/

		this.createSectionTitle(container, 'Recent Writing');

		const recent = container.createDiv({
			cls: 'novel-dashboard-recent',
		});

		for (const file of summary.recentFiles) {
			const item = recent.createDiv({
				cls: 'novel-dashboard-file',
			});

			item.setText(file.path);

			item.addEventListener('click', () => {
				const target = this.plugin.app.vault.getAbstractFileByPath(
					file.path,
				);

				if (target) {
					this.plugin.app.workspace.openLinkText(file.path, '');
				}
			});
		}

		/*
			每日柱状图

		*/

		this.createSectionTitle(container, 'Daily Writing');

		WritingChart.create(container, provider.getDailyWriting(30));

		/*
			月历

		*/

		this.createSectionTitle(container, 'Monthly Writing');

		const now = new Date();

		MonthlyCalendar.create(
			container,
			provider.getMonthlyWriting(now.getFullYear(), now.getMonth() + 1),
		);

		/*
			年度热力图

		*/

		this.createSectionTitle(container, 'Year Writing');

		YearHeatmap.create(
			container,
			provider.getYearWriting(now.getFullYear()),
		);
	}

	createCard(parent: HTMLElement, value: string, title: string) {
		const card = parent.createDiv({
			cls: 'novel-dashboard-card',
		});

		card.createEl('strong', {
			text: value,
			cls: 'card-value',
		});

		card.createEl('div', {
			text: title,
			cls: 'card-title',
		});
	}

	createSectionTitle(parent: HTMLElement, text: string) {
		parent.createEl('h3', {
			text,
			cls: 'novel-dashboard-section-title',
		});
	}

	formatDuration(seconds: number) {
		const hours = Math.floor(seconds / 3600);

		const minutes = Math.floor((seconds % 3600) / 60);

		if (hours) {
			return `${hours}h ${minutes}m`;
		}

		return `${minutes}m`;
	}

	async onClose() {}
}
