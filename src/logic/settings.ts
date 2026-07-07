import { App, PluginSettingTab, Setting } from 'obsidian';

import NovelDashboardPlugin from '../main';

export class NovelDashboardSettingTab extends PluginSettingTab {
	plugin: NovelDashboardPlugin;

	constructor(app: App, plugin: NovelDashboardPlugin) {
		super(app, plugin);

		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', {
			text: 'Novel Dashboard Settings',
		});

		/*
			写作文件夹
		*/

		new Setting(containerEl)

			.setName('Writing folder')

			.setDesc('Folder used for writing statistics')

			.addText((text) => {
				text.setPlaceholder('写作')

					.setValue(this.plugin.settings.writingFolder)

					.onChange(async (value) => {
						this.plugin.settings.writingFolder = value.trim();

						await this.plugin.savePluginData();
					});
			});

		/*
			Dashboard Sidebar
		*/

		new Setting(containerEl)

			.setName('Enable sidebar dashboard')

			.setDesc('Show Novel Dashboard in the right sidebar')

			.addToggle((toggle) => {
				toggle

					.setValue(this.plugin.settings.dashboard.enableSidebar)

					.onChange(async (value) => {
						this.plugin.settings.dashboard.enableSidebar = value;

						await this.plugin.savePluginData();

						/*
									这里后续可以增加：
									打开/关闭 sidebar leaf
								*/
					});
			});

		/*
			Dashboard Markdown 文件
		*/

		new Setting(containerEl)

			.setName('Enable dashboard file')

			.setDesc('Create and update Novel Dashboard.md')

			.addToggle((toggle) => {
				toggle

					.setValue(
						this.plugin.settings.dashboard.enableDashboardFile,
					)

					.onChange(async (value) => {
						this.plugin.settings.dashboard.enableDashboardFile =
							value;

						await this.plugin.savePluginData();

						if (value) {
							await this.plugin.dashboardFile.initialize();
						}
					});
			});

		/*
			Dashboard 文件路径
		*/

		new Setting(containerEl)

			.setName('Dashboard file path')

			.setDesc('Markdown file used as dashboard homepage')

			.addText((text) => {
				text.setPlaceholder('Novel Dashboard.md')

					.setValue(this.plugin.settings.dashboard.dashboardFilePath)

					.onChange(async (value) => {
						this.plugin.settings.dashboard.dashboardFilePath =
							value.trim();

						await this.plugin.savePluginData();
					});
			});
	}
}
