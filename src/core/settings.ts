import {
	AbstractInputSuggest,
	App,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
	TFolder,
} from 'obsidian';

import { LanguagePreference, setLanguage, t } from '../i18n';
import type NovelDashboardPlugin from '../main';
import { DEFAULT_SETTINGS } from './saved-data';
import { cleanPath } from '../utils/paths';

/**
 * 文件夹 / 文档路径补全
 */
class PathSuggest extends AbstractInputSuggest<TAbstractFile> {
	constructor(
		app: App,
		private input: HTMLInputElement,
		private includeFiles: boolean,
		private onPick: (path: string) => void,
	) {
		super(app, input);
	}

	protected getSuggestions(query: string): TAbstractFile[] {
		const lower = query.toLowerCase();

		return this.app.vault
			.getAllLoadedFiles()
			.filter(
				(file) =>
					file.path !== '/' &&
					(file instanceof TFolder ||
						(this.includeFiles &&
							file instanceof TFile &&
							file.extension === 'md')) &&
					file.path.toLowerCase().includes(lower),
			)
			.slice(0, 50);
	}

	renderSuggestion(file: TAbstractFile, el: HTMLElement) {
		el.setText(file.path);
	}

	selectSuggestion(file: TAbstractFile) {
		this.input.value = file.path;
		this.onPick(file.path);
		this.close();
	}
}

export class NovelDashboardSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: NovelDashboardPlugin,
	) {
		super(app, plugin);
	}

	display() {
		const { containerEl } = this;
		const settings = this.plugin.settings;

		containerEl.empty();

		new Setting(containerEl).setName(t('setHeadingGeneral')).setHeading();

		/*
			写作文件夹：失去焦点 / 回车 / 选中补全时才生效
		*/
		new Setting(containerEl)
			.setName(t('setWritingFolder'))
			.setDesc(t('setWritingFolderDesc'))
			.addText((text) => {
				const apply = async () => {
					const value = cleanPath(text.getValue());

					if (value && value !== this.plugin.settings.writingFolder) {
						await this.plugin.changeWritingFolder(value);
					}

					text.setValue(this.plugin.settings.writingFolder);
				};

				text.setPlaceholder('写作').setValue(settings.writingFolder);
				text.inputEl.addEventListener('change', () => void apply());

				new PathSuggest(this.app, text.inputEl, false, () => void apply());
			});

		new Setting(containerEl)
			.setName(t('setHomepageName'))
			.setDesc(t('setHomepageNameDesc'))
			.addText((text) => {
				text.setPlaceholder(DEFAULT_SETTINGS.homepageName).setValue(settings.homepageName);

				text.inputEl.addEventListener('change', () => {
					const value = text
						.getValue()
						.trim()
						.replace(/\.md$/i, '')
						.replace(/[\\/:*?"<>|#^[\]]/g, '');

					if (value && value !== this.plugin.settings.homepageName) {
						void this.plugin.changeHomepageName(value);
					}

					text.setValue(value || this.plugin.settings.homepageName);
				});
			});

		this.renderIgnoredPaths(containerEl);

		new Setting(containerEl).setName(t('setHeadingDisplay')).setHeading();

		new Setting(containerEl)
			.setName(t('setSidebar'))
			.setDesc(t('setSidebarDesc'))
			.addToggle((toggle) =>
				toggle.setValue(settings.enableSidebar).onChange(async (value) => {
					settings.enableSidebar = value;
					await this.plugin.savePluginData();

					if (value) {
						await this.plugin.openDashboardSidebar();
					} else {
						this.plugin.closeDashboardSidebar();
					}
				}),
			);

		new Setting(containerEl)
			.setName(t('setDashboardFile'))
			.setDesc(t('setDashboardFileDesc'))
			.addToggle((toggle) =>
				toggle
					.setValue(settings.enableDashboardFile)
					.onChange(async (value) => {
						settings.enableDashboardFile = value;
						await this.plugin.savePluginData();

						if (value) {
							await this.plugin.dashboardFile.ensure();
						}
					}),
			);

		new Setting(containerEl)
			.setName(t('setPin'))
			.setDesc(t('setPinDesc'))
			.addToggle((toggle) =>
				toggle.setValue(settings.pinDashboardFile).onChange(async (value) => {
					settings.pinDashboardFile = value;
					await this.plugin.savePluginData();
					this.plugin.explorer.resort();
				}),
			);

		new Setting(containerEl)
			.setName(t('setStatusBar'))
			.setDesc(t('setStatusBarDesc'))
			.addToggle((toggle) =>
				toggle.setValue(settings.showStatusBar).onChange(async (value) => {
					settings.showStatusBar = value;
					await this.plugin.savePluginData();
					this.plugin.statusBar.update();
				}),
			);

		new Setting(containerEl)
			.setName(t('setAnnotations'))
			.setDesc(t('setAnnotationsDesc'))
			.addToggle((toggle) =>
				toggle
					.setValue(settings.showAnnotations)
					.onChange((value) => void this.plugin.annotations.setVisible(value)),
			);

		new Setting(containerEl)
			.setName(t('setLanguage'))
			.setDesc(t('setLanguageDesc'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('auto', t('langAuto'))
					.addOption('zh', t('langZh'))
					.addOption('en', t('langEn'))
					.setValue(settings.language)
					.onChange(async (value) => {
						settings.language = value as LanguagePreference;
						setLanguage(settings.language);
						await this.plugin.savePluginData();
						this.plugin.onDataChanged(true);
						this.display();
					}),
			);
	}

	private renderIgnoredPaths(containerEl: HTMLElement) {
		const settings = this.plugin.settings;

		const save = async () => {
			await this.plugin.savePluginData();
			await this.plugin.rescan();
			this.display();
		};

		let pending = '';

		const add = async () => {
			const value = cleanPath(pending);

			if (!value || settings.ignoredPaths.includes(value)) {
				return;
			}

			settings.ignoredPaths.push(value);
			await save();
		};

		new Setting(containerEl)
			.setName(t('setIgnored'))
			.setDesc(t('setIgnoredDesc'))
			.addText((text) => {
				text.setPlaceholder(t('setIgnoredPlaceholder')).onChange((value) => {
					pending = value;
				});

				text.inputEl.addEventListener('keydown', (event) => {
					if (event.key === 'Enter') {
						void add();
					}
				});

				new PathSuggest(this.app, text.inputEl, true, (path) => {
					pending = path;
				});
			})
			.addButton((button) =>
				button.setButtonText(t('setIgnoredAdd')).onClick(() => void add()),
			);

		const list = containerEl.createDiv({ cls: 'nd-ignored-list' });

		if (settings.ignoredPaths.length === 0) {
			list.createDiv({ cls: 'nd-empty', text: t('setIgnoredEmpty') });
		}

		for (const path of settings.ignoredPaths) {
			new Setting(list).setName(path).addExtraButton((button) =>
				button
					.setIcon('x')
					.setTooltip(t('setIgnoredRemove'))
					.onClick(async () => {
						settings.ignoredPaths = settings.ignoredPaths.filter(
							(entry) => entry !== path,
						);
						await save();
					}),
			);
		}
	}
}
