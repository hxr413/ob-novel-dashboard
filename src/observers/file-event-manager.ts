import { Notice, TFile, TFolder } from 'obsidian';

import { t } from '../i18n';
import type NovelDashboardPlugin from '../main';
import {
	ancestorFolders,
	baseName,
	isSameOrUnder,
	parentPath,
} from '../utils/paths';

/**
 * 监听 vault 文件变化
 *
 * 必须在 onLayoutReady 之后调用 start()：
 * Obsidian 启动时会为每个已有文件触发一次 create
 */
export class FileEventManager {
	constructor(private plugin: NovelDashboardPlugin) {}

	start() {
		const { vault } = this.plugin.app;
		const tracker = this.plugin.tracker;

		this.plugin.registerEvent(
			vault.on('modify', async (file) => {
				if (!(file instanceof TFile) || file.extension !== 'md') {
					return;
				}

				await tracker.updateFile(file, 'modify');

				this.changed([file.path]);
			}),
		);

		this.plugin.registerEvent(
			vault.on('create', async (file) => {
				if (file instanceof TFile) {
					if (file.extension !== 'md') {
						return;
					}

					await tracker.updateFile(file, 'create');

					this.changed([file.path]);
				} else if (file instanceof TFolder) {
					tracker.rebuildFolders();

					this.changed([file.path]);
				}
			}),
		);

		this.plugin.registerEvent(
			vault.on('delete', (file) => {
				if (file instanceof TFile) {
					tracker.forgetFile(file.path);
				} else if (file instanceof TFolder) {
					for (const path of Object.keys(
						this.plugin.data.documentCounts,
					)) {
						if (path.startsWith(file.path + '/')) {
							tracker.forgetFile(path);
						}
					}

					tracker.rebuildFolders();
				}

				this.plugin.annotations.onDelete(file.path);
				this.changed([file.path]);
			}),
		);

		this.plugin.registerEvent(
			vault.on('rename', async (file, oldPath) => {
				if (!(file instanceof TFile) && !(file instanceof TFolder)) {
					return;
				}

				if (file instanceof TFile && file.extension !== 'md') {
					return;
				}

				if (await this.guardLayout(file, oldPath)) {
					return;
				}

				this.plugin.annotations.onRename(oldPath, file.path);

				await tracker.rename(file, oldPath);

				// 路径整体变化，重新标注整个文件树
				this.plugin.explorer.refreshAll();
				this.plugin.onDataChanged();
			}),
		);
	}

	/**
	 * 主页与写作文件夹的位置保护
	 *
	 * - 写作文件夹（或其上级）被改名：设置跟着更新
	 * - 主页在原文件夹内改名：当作修改主页名称
	 * - 主页被移出写作文件夹根目录：移回原处
	 *
	 * @returns 是否已处理（主页被移回时不再继续）
	 */
	private async guardLayout(
		file: TFile | TFolder,
		oldPath: string,
	): Promise<boolean> {
		const settings = this.plugin.settings;

		if (file instanceof TFolder) {
			if (isSameOrUnder(settings.writingFolder, oldPath)) {
				settings.writingFolder =
					file.path + settings.writingFolder.slice(oldPath.length);

				await this.plugin.savePluginData();
			}

			return false;
		}

		if (oldPath !== this.plugin.layout.getDashboardPath()) {
			return false;
		}

		if (parentPath(file.path) === parentPath(oldPath)) {
			settings.homepageName = baseName(file.path);

			await this.plugin.savePluginData();
			this.plugin.explorer.resort();

			return false;
		}

		await this.plugin.app.fileManager.renameFile(file, oldPath);
		new Notice(t('noticeHomepagePinned'));

		return true;
	}

	private changed(paths: string[]) {
		const affected = new Set<string>();

		for (const path of paths) {
			affected.add(path);

			for (const folder of ancestorFolders(path)) {
				affected.add(folder);
			}
		}

		this.plugin.explorer.refreshPaths([...affected]);
		this.plugin.onDataChanged();
	}
}
