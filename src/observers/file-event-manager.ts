import { App, TFile, TFolder } from 'obsidian';

import NovelDashboardPlugin from '../main';

export class FileEventManager {
	app: App;

	plugin: NovelDashboardPlugin;

	constructor(app: App, plugin: NovelDashboardPlugin) {
		this.app = app;

		this.plugin = plugin;
	}

	start() {
		console.log('FileEventManager started');

		/*
			文件内容修改
		*/

		this.plugin.registerEvent(
			this.app.vault.on('modify', async (file) => {
				if (!(file instanceof TFile)) {
					return;
				}

				if (file.extension !== 'md') {
					return;
				}

				await this.updateFile(file);
			}),
		);

		/*
			新建文件 / 文件夹
		*/

		this.plugin.registerEvent(
			this.app.vault.on('create', async (file) => {
				if (file instanceof TFile) {
					if (file.extension !== 'md') {
						return;
					}

					await this.updateFile(file);
				} else if (file instanceof TFolder) {
					/*
							新文件夹需要刷新 explorer

							让空文件夹显示 0
						*/

					await this.rebuildFolderCounts();
				}
			}),
		);

		/*
			删除
		*/

		this.plugin.registerEvent(
			this.app.vault.on('delete', async (file) => {
				if (file instanceof TFile) {
					this.removeFile(file.path);
				} else if (file instanceof TFolder) {
					this.removeFolder(file.path);
				}

				await this.rebuildFolderCounts();

				this.plugin.dashboardFile.requestUpdate();

				this.plugin.requestSave();
			}),
		);

		/*
			移动 / 重命名

		*/

		this.plugin.registerEvent(
			this.app.vault.on('rename', async (file, oldPath) => {
				if (file instanceof TFile) {
					/*
							删除旧缓存
						*/

					this.removeFile(oldPath);

					/*
							重新计算新路径

						*/

					if (file.extension === 'md') {
						await this.updateFile(file);
					}
				} else if (file instanceof TFolder) {
					/*
							文件夹移动/改名

							路径全部变化

							直接重新扫描缓存结构
						*/

					await this.rebuildFolderCounts();
				}
			}),
		);
	}

	/**
	 * 更新文件
	 */

	async updateFile(file: TFile) {
		const path = file.path;

		if (!path.startsWith(this.plugin.settings.writingFolder + '/')) {
			return;
		}

		if (this.plugin.isPathIgnored(path)) {
			delete this.plugin.data.documentCounts[path];
			this.plugin.dashboardFile.requestUpdate();
			this.plugin.requestSave();
			await this.rebuildFolderCounts();

			return;
		}

		const content = await this.app.vault.read(file);

		const count = this.plugin.statistics.countWords(content);

		/*
			更新文件字数
		*/

		this.plugin.data.documentCounts[path] = count;

		/*
			更新最近写作

		*/

		this.updateRecentFile(path);

		/*
			Explorer

		*/

		await this.plugin.explorer.updateSingleFileCount(path, count);

		await this.rebuildFolderCounts();

		/*
			Dashboard 更新

		*/

		this.plugin.dashboardFile.requestUpdate();

		/*
			debounce 保存

		*/

		this.plugin.requestSave();

		console.log('File updated:', path, count);
	}

	/**
	 * 最近写作记录
	 *
	 * 保留 20 个
	 */

	updateRecentFile(path: string) {
		const list = this.plugin.data.recentFiles;

		const filtered = list.filter((item) => item.path !== path);

		filtered.unshift({
			path,

			time: Date.now(),
		});

		this.plugin.data.recentFiles = filtered.slice(0, 20);
	}

	/**
	 * 删除文件
	 */

	private isDashboardFile(path: string): boolean {
		const dashboardPath =
			this.plugin.settings.dashboard.dashboardFilePath.replace(
				/^\/+|\/+$/g,
				'',
			);
		const normalizedPath = path.replace(/^\/+|\/+$/g, '');

		return (
			normalizedPath === dashboardPath ||
			normalizedPath.endsWith('/' + dashboardPath)
		);
	}

	removeFile(path: string) {
		if (this.isDashboardFile(path)) {
			return;
		}

		delete this.plugin.data.documentCounts[path];

		this.plugin.data.recentFiles = this.plugin.data.recentFiles.filter(
			(item) => item.path !== path,
		);
	}

	/**
	 * 删除文件夹

	 */

	removeFolder(path: string) {
		const prefix = path + '/';

		for (const filePath in this.plugin.data.documentCounts) {
			if (filePath.startsWith(prefix)) {
				delete this.plugin.data.documentCounts[filePath];
			}
		}

		this.plugin.data.recentFiles = this.plugin.data.recentFiles.filter(
			(item) => !item.path.startsWith(prefix),
		);
	}

	/**
	 * 重建文件夹统计
	 */

	async rebuildFolderCounts() {
		const folderCounts = this.plugin.statistics.calculateFolderCounts(
			this.plugin.data.documentCounts,
			this.plugin.statistics.getFolderPaths(),
		);

		this.plugin.data.folderCounts = folderCounts;

		await this.plugin.explorer.updateCounts({
			...this.plugin.data.documentCounts,

			...folderCounts,
		});
	}
}
