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
		return `
\`\`\`webnovel-homepage
\`\`\`
`;
	}
}
