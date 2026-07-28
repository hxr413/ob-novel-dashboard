// 左侧边栏显示文档/文件夹字数

export class ExplorerManager {
	app: any;

	private pendingCounts: { [path: string]: number } = {};

	private pendingClearPaths = new Set<string>();

	constructor(app: any) {
		this.app = app;
	}

	private formatCount(count: number): string {
		return String(count);
	}

	/**
	 * 获取 Obsidian 文件浏览器
	 */
	async getExplorer(retries = 6, delay = 150): Promise<any | null> {
		for (let attempt = 0; attempt < retries; attempt++) {
			const leaves = this.app.workspace.getLeavesOfType('file-explorer');

			for (const leaf of leaves) {
				const view = leaf.view as any;

				if (view && view.fileItems) {
					return view;
				}
			}

			if (attempt < retries - 1) {
				await new Promise((resolve) =>
					window.setTimeout(resolve, delay),
				);
			}
		}

		return null;
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
	private shouldHidePath(
		path: string,
		ignoredPaths: string[],
		writingRoot: string,
	) {
		const normalizedPath = path.replace(/^\/+|\/+$/g, '');
		const normalizedWritingRoot = writingRoot.replace(/^\/+|\/+$/g, '');

		if (!normalizedWritingRoot) {
			return false;
		}

		if (normalizedPath === normalizedWritingRoot) {
			return false;
		}

		return ignoredPaths.some((ignoredPath) => {
			const normalizedIgnoredPath = ignoredPath.replace(/^\/+|\/+$/g, '');

			if (!normalizedIgnoredPath) {
				return false;
			}

			return (
				normalizedPath === normalizedIgnoredPath ||
				normalizedPath.startsWith(normalizedIgnoredPath + '/') ||
				normalizedIgnoredPath.startsWith(normalizedPath + '/')
			);
		});
	}

	private shouldShowPath(
		path: string,
		ignoredPaths: string[],
		writingRoot: string,
	) {
		const normalizedPath = path.replace(/^\/+|\/+$/g, '');
		const normalizedWritingRoot = writingRoot.replace(/^\/+|\/+$/g, '');

		if (!normalizedWritingRoot) {
			return true;
		}

		if (!normalizedPath) {
			return false;
		}

		if (
			normalizedPath !== normalizedWritingRoot &&
			!normalizedPath.startsWith(normalizedWritingRoot + '/')
		) {
			return false;
		}

		return !this.shouldHidePath(path, ignoredPaths, writingRoot);
	}

	private clearPathFromFileItems(fileItems: any, path: string): boolean {
		const item = fileItems[path];

		if (!item) {
			return false;
		}

		const element = item.titleEl ?? item.selfEl;

		if (!element) {
			return false;
		}

		element.removeAttribute('data-novel-dashboard-count');

		return true;
	}

	private flushPendingClears(fileItems: any) {
		for (const path of [...this.pendingClearPaths]) {
			if (this.clearPathFromFileItems(fileItems, path)) {
				this.pendingClearPaths.delete(path);
			}
		}
	}

	async updateCounts(counts: { [path: string]: number }) {
		const plugin = this.app.plugins?.plugins?.['ob-novel-dashboard'];
		const ignoredPaths = plugin?.getIgnoredPaths?.() ?? [];
		const writingRoot = plugin?.settings?.writingFolder?.trim() ?? '';

		this.pendingCounts = {
			...this.pendingCounts,
			...counts,
		};

		const explorer = await this.getExplorer();

		if (!explorer?.fileItems) {
			return;
		}

		const fileItems = explorer.fileItems;

		this.flushPendingClears(fileItems);

		for (const path in this.pendingCounts) {
			const item = fileItems[path];

			const count = this.pendingCounts[path];

			if (count === undefined || !item) {
				continue;
			}

			const element = item.titleEl ?? item.selfEl;

			if (!element) {
				continue;
			}

			if (this.shouldHidePath(path, ignoredPaths, writingRoot)) {
				element.removeAttribute('data-novel-dashboard-count');
				continue;
			}

			element.setAttribute(
				'data-novel-dashboard-count',
				this.formatCount(count),
			);
		}

		this.pendingCounts = {};
	}

	/**
	 * 实时更新单个文件
	 */
	async updateSingleFileCount(path: string, count: number) {
		this.pendingCounts[path] = count;

		const plugin = this.app.plugins?.plugins?.['ob-novel-dashboard'];
		const ignoredPaths = plugin?.getIgnoredPaths?.() ?? [];
		const writingRoot = plugin?.settings?.writingFolder?.trim() ?? '';

		const explorer = await this.getExplorer();

		if (!explorer?.fileItems) {
			return;
		}

		const item = explorer.fileItems[path];

		if (!item) {
			return;
		}

		const element = item.titleEl ?? item.selfEl;

		if (!element) {
			return;
		}

		if (!this.shouldShowPath(path, ignoredPaths, writingRoot)) {
			element.removeAttribute('data-novel-dashboard-count');
			delete this.pendingCounts[path];

			return;
		}

		element.setAttribute(
			'data-novel-dashboard-count',
			this.formatCount(count),
		);

		delete this.pendingCounts[path];
	}

	async clearPathCount(path: string) {
		delete this.pendingCounts[path];

		this.pendingClearPaths.add(path);

		const explorer = await this.getExplorer();

		if (!explorer?.fileItems) {
			return;
		}

		this.flushPendingClears(explorer.fileItems);
	}

	async clearPathCounts(paths: string[]) {
		for (const path of paths) {
			await this.clearPathCount(path);
		}
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
		this.pendingCounts = {};

		this.pendingClearPaths.clear();

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
