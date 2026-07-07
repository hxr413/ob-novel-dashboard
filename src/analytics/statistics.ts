import { App, TFile, TFolder } from 'obsidian';

import { TextCounter } from '../utils/text-counter';

export class StatisticsEngine {
	app: App;

	writingFolder: string;

	ignoredPaths: string[];

	constructor(app: App, writingFolder: string, ignoredPaths: string[] = []) {
		this.app = app;

		this.writingFolder = writingFolder;

		this.ignoredPaths = ignoredPaths;
	}

	/**
	 * 清理文本后计算字数
	 */

	private normalizePath(path: string): string {
		return path.replace(/^\/+|\/+$/g, '');
	}

	private isExcludedPath(path: string, excludedPaths: string[] = []) {
		const normalizedPath = this.normalizePath(path);

		const allExcludedPaths = [...new Set([...this.ignoredPaths, ...excludedPaths])];

		return allExcludedPaths.some((excludedPath) => {
			const normalizedExcludedPath = this.normalizePath(excludedPath);

			if (!normalizedExcludedPath) {
				return false;
			}

			return (
				normalizedPath === normalizedExcludedPath ||
				normalizedPath.startsWith(normalizedExcludedPath + '/') ||
				normalizedPath.includes('/' + normalizedExcludedPath + '/') ||
				normalizedPath.endsWith('/' + normalizedExcludedPath)
			);
		});
	}

	countWords(text: string): number {
		return TextCounter.countMarkdown(text);
	}

	async countFile(file: TFile): Promise<number> {
		const text = await this.app.vault.read(file);

		return this.countWords(text);
	}

	async scanFolder(folder: string, excludedPaths: string[] = []) {
		const files = this.app.vault.getMarkdownFiles();

		const result: {
			[path: string]: number;
		} = {};

		for (const file of files) {
			if (!file.path.startsWith(folder + '/')) {
				continue;
			}

			if (this.isExcludedPath(file.path, excludedPaths)) {
				continue;
			}

			result[file.path] = await this.countFile(file);
		}

		return result;
	}

	/**
	 * 获取写作文件夹内部所有文件夹
	 *
	 * 例如：
	 *
	 * 写作
	 * 写作/长篇
	 * 写作/长篇/第一章
	 *
	 * 不包含：
	 *
	 * 图片
	 * 附件
	 * 其他
	 *
	 */

	getFolderPaths() {
		const folders: string[] = [];

		const files = this.app.vault.getAllLoadedFiles();

		for (const file of files) {
			if (!(file instanceof TFolder)) {
				continue;
			}

			if (
				file.path === this.writingFolder ||
				file.path.startsWith(this.writingFolder + '/')
			) {
				folders.push(file.path);
			}
		}

		return folders;
	}

	calculateFolderCounts(
		documentCounts: {
			[path: string]: number;
		},
		folders: string[],
	) {
		const folderCounts: {
			[path: string]: number;
		} = {};

		/*
			加入真实文件夹

			保证空文件夹显示 0
		*/

		for (const folder of folders) {
			folderCounts[folder] = 0;
		}

		/*
			根据文件累计
		*/

		for (const path in documentCounts) {
			const count = documentCounts[path];

			const parts = path.split('/');

			parts.pop();

			while (parts.length) {
				const folder = parts.join('/');

				/*
					只统计写作目录

				*/

				if (
					folder === this.writingFolder ||
					folder.startsWith(this.writingFolder + '/')
				) {
					folderCounts[folder] =
						(folderCounts[folder] ?? 0) + (count ?? 0);
				}

				parts.pop();
			}
		}

		return folderCounts;
	}
}
