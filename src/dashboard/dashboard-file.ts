import { TFile } from 'obsidian';

import type NovelDashboardPlugin from '../main';
import { openOrRevealFile } from '../ui/open-file';
import { HOMEPAGE_CODE_BLOCK } from './homepage-renderer';

const HOMEPAGE_CONTENT = '```' + HOMEPAGE_CODE_BLOCK + '\n```\n';

/**
 * 主页文档：只在不存在时创建，之后内容由代码块实时渲染，不再写入文件
 */
export class DashboardFileManager {
	constructor(private plugin: NovelDashboardPlugin) {}

	async ensure(): Promise<TFile | null> {
		if (!this.plugin.settings.enableDashboardFile) {
			return null;
		}

		const { vault } = this.plugin.app;
		const path = this.plugin.layout.getDashboardPath();
		const existing = vault.getAbstractFileByPath(path);

		if (existing instanceof TFile) {
			return existing;
		}

		if (existing) {
			return null;
		}

		await this.plugin.layout.ensureFolder(this.plugin.layout.writingFolder);

		return vault.create(path, HOMEPAGE_CONTENT);
	}

	async open() {
		const file = await this.ensure();
		const path = file?.path ?? this.plugin.layout.getDashboardPath();

		await openOrRevealFile(this.plugin.app, path);
	}
}
