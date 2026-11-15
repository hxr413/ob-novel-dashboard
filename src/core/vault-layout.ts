import { App, Notice, TFile, TFolder } from 'obsidian';

import { t } from '../i18n';
import { cleanPath, isSameOrUnder } from '../utils/paths';
import type { NovelDashboardSettings } from './saved-data';

/**
 * 写作文件夹、主页路径、忽略规则
 */
export class VaultLayout {
	constructor(
		private app: App,
		private getSettings: () => NovelDashboardSettings,
	) {}

	get writingFolder(): string {
		return this.getSettings().writingFolder;
	}

	getDashboardPath(
		folder = this.writingFolder,
		name = this.getSettings().homepageName,
	): string {
		return folder ? `${folder}/${name}.md` : `${name}.md`;
	}

	/**
	 * 忽略条目可以写完整路径，也可以写相对于写作文件夹的路径
	 */
	isIgnored(path: string): boolean {
		if (path === this.getDashboardPath()) {
			return true;
		}

		const folder = this.writingFolder;

		return this.getSettings().ignoredPaths.some((entry) => {
			const clean = cleanPath(entry);

			if (!clean) {
				return false;
			}

			return (
				isSameOrUnder(path, clean) ||
				(!isSameOrUnder(clean, folder) &&
					isSameOrUnder(path, `${folder}/${clean}`))
			);
		});
	}

	/**
	 * 是否参与字数统计的 Markdown 文档
	 */
	isTrackedFile(path: string): boolean {
		return (
			path.toLowerCase().endsWith('.md') &&
			isSameOrUnder(path, this.writingFolder) &&
			path !== this.writingFolder &&
			!this.isIgnored(path)
		);
	}

	isTrackedFolder(path: string): boolean {
		return isSameOrUnder(path, this.writingFolder) && !this.isIgnored(path);
	}

	async ensureFolder(path: string): Promise<TFolder | null> {
		if (!path) {
			return null;
		}

		const existing = this.app.vault.getAbstractFileByPath(path);

		if (existing instanceof TFolder) {
			return existing;
		}

		if (existing) {
			return null;
		}

		// 逐级创建
		const parts = path.split('/');

		for (let i = 1; i <= parts.length; i++) {
			const partial = parts.slice(0, i).join('/');

			if (!this.app.vault.getAbstractFileByPath(partial)) {
				await this.app.vault.createFolder(partial);
			}
		}

		new Notice(t('noticeFolderCreated', { path }));

		const created = this.app.vault.getAbstractFileByPath(path);

		return created instanceof TFolder ? created : null;
	}

	/**
	 * 把主页从旧路径移到新路径（文件夹或名称变化时）
	 */
	async moveDashboard(oldPath: string, newPath: string) {
		if (oldPath === newPath) {
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(oldPath);

		if (!(file instanceof TFile)) {
			return;
		}

		if (this.app.vault.getAbstractFileByPath(newPath)) {
			new Notice(t('noticeMoveFailed', { path: newPath }));

			return;
		}

		await this.app.fileManager.renameFile(file, newPath);
	}
}
