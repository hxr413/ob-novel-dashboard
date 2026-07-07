// 左侧边栏显示文档/文件夹字数

export class ExplorerManager {
	app: any;

	constructor(app: any) {
		this.app = app;
	}

	private formatCount(count: number): string {
		return String(count);
	}

	/**
	 * 获取 Obsidian 文件浏览器
	 */
	async getExplorer(): Promise<any> {
		return new Promise((resolve, reject) => {
			const leaves = this.app.workspace.getLeavesOfType('file-explorer');

			for (const leaf of leaves) {
				const view = leaf.view as any;

				if (view && view.fileItems) {
					resolve(view);

					return;
				}
			}

			reject(new Error('File explorer not found'));
		});
	}

	/**
	 * 更新文件树显示
	 *
	 * counts:
	 *
	 * {
	 *   "写作/短篇/故事 A.md":3000,
	 *   "写作/长篇/第一卷/第一章.md":5000
	 * }
	 *
	 */
	async updateCounts(counts: { [path: string]: number }) {
		const explorer = await this.getExplorer();

		const fileItems = explorer.fileItems;

		for (const path in fileItems) {
			const item = fileItems[path];

			const count = counts[path];

			// 没有统计数据跳过

			if (count === undefined) {
				continue;
			}

			const element = item.titleEl ?? item.selfEl;

			if (!element) {
				continue;
			}

			element.setAttribute(
				'data-novel-dashboard-count',
				this.formatCount(count),
			);
		}
	}

	/**
	 * 实时更新单个文件
	 */
	async updateSingleFileCount(path: string, count: number) {
		const explorer = await this.getExplorer();

		const item = explorer.fileItems[path];

		if (!item) {
			console.log('Explorer item not found:', path);

			return;
		}

		const element = item.titleEl ?? item.selfEl;

		if (!element) {
			return;
		}

		element.setAttribute(
			'data-novel-dashboard-count',
			this.formatCount(count),
		);
	}

	/**
	 * 更新文件夹字数
	 *
	 * 现在由 StatisticsEngine
	 * 重新计算后直接传入
	 *
	 */
	async updateFolderCounts(folderCounts: { [path: string]: number }) {
		await this.updateCounts(folderCounts);
	}

	/**
	 * 清除所有显示
	 */
	clearCounts() {
		const leaves = this.app.workspace.getLeavesOfType('file-explorer');

		for (const leaf of leaves) {
			const view = leaf.view as any;

			if (!view.fileItems) {
				continue;
			}

			for (const path in view.fileItems) {
				const item = view.fileItems[path];

				const element = item.titleEl ?? item.selfEl;

				element?.removeAttribute('data-novel-dashboard-count');
			}
		}
	}
}
