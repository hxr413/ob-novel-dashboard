import { TFile } from 'obsidian';

import NovelDashboardPlugin from '../main';

import { DashboardDataProvider } from './dashboard-data';

export class DashboardFileManager {
	plugin: NovelDashboardPlugin;

	provider: DashboardDataProvider;

	private updateTimer: number | null = null;

	constructor(plugin: NovelDashboardPlugin) {
		this.plugin = plugin;

		this.provider = new DashboardDataProvider(plugin);
	}

	async initialize() {
		if (!this.plugin.settings.dashboard.enableDashboardFile) {
			return;
		}

		await this.updateDashboardFile();
	}

	requestUpdate() {
		if (this.updateTimer) {
			window.clearTimeout(this.updateTimer);
		}

		this.updateTimer = window.setTimeout(async () => {
			await this.updateDashboardFile();

			this.updateTimer = null;
		}, 2000);
	}

	async updateDashboardFile() {
		if (!this.plugin.settings.dashboard.enableDashboardFile) {
			return;
		}

		const path = this.plugin.settings.dashboard.dashboardFilePath;

		const content = this.generateMarkdown();

		const existing = this.plugin.app.vault.getAbstractFileByPath(path);

		if (!existing) {
			await this.plugin.app.vault.create(path, content);

			return;
		}

		if (!(existing instanceof TFile)) {
			return;
		}

		await this.plugin.app.vault.modify(existing, content);
	}

	private generateMarkdown(): string {
		const summary = this.provider.getSummary();

		const daily = this.provider.getDailyWriting(7);

		const recent = summary.recentFiles;

		return `# Novel Dashboard


<div class="novel-dashboard-grid">


<div class="novel-card">

<div class="novel-value">

${summary.totalWords.toLocaleString()}

</div>

<div class="novel-label">

Total Words

</div>

</div>



<div class="novel-card">

<div class="novel-value">

+${summary.todayWords.toLocaleString()}

</div>

<div class="novel-label">

Today

</div>

</div>



<div class="novel-card">

<div class="novel-value">

${this.formatDuration(summary.todayDuration)}

</div>

<div class="novel-label">

Writing Time

</div>

</div>


</div>



## Recent Writing


<div class="novel-list">

${
	recent.length > 0
		? recent
				.map(
					(file) =>
						`
<div class="novel-list-item">

${file.path}

</div>
`,
				)
				.join('')
		: `
<div class="novel-list-item">

No recent writing

</div>
`
}

</div>




## Daily Writing


<div class="novel-table">


| Date | Words | Duration |
| --- | --- | --- |
${daily
	.map(
		(item) =>
			`
| ${item.date} | ${item.words} | ${this.formatDuration(item.duration)} |
`,
	)
	.join('')}

</div>


`;
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
