import { TAbstractFile, TFolder, View } from 'obsidian';

import type NovelDashboardPlugin from '../main';

/**
 * 左侧文件树：字数后缀、主页标记、主页置顶
 *
 * 文件浏览器没有公开 API，这里只依赖 fileItems / getSortedFolderItems / requestSort，
 * 并在卸载时全部还原。
 */

interface FileItem {
	file: TAbstractFile;
	selfEl?: HTMLElement;
	titleEl?: HTMLElement;
}

interface FileExplorerView extends View {
	fileItems: Record<string, FileItem | undefined>;
	getSortedFolderItems?: (folder: TFolder) => FileItem[];
	requestSort?: () => void;
}

const COUNT_ATTR = 'data-nd-count';
const KIND_ATTR = 'data-nd-kind';
const HOME_ATTR = 'data-nd-home';

export class ExplorerDecorator {
	private patchedViews = new Set<FileExplorerView>();

	constructor(private plugin: NovelDashboardPlugin) {}

	private getViews(): FileExplorerView[] {
		const views: FileExplorerView[] = [];

		for (const leaf of this.plugin.app.workspace.getLeavesOfType(
			'file-explorer',
		)) {
			const view = leaf.view as Partial<FileExplorerView>;

			if (view.fileItems) {
				views.push(view as FileExplorerView);
			}
		}

		return views;
	}

	/**
	 * 新出现的文件浏览器：打补丁并整体标注
	 */
	attach() {
		for (const view of this.getViews()) {
			if (this.patchedViews.has(view)) {
				continue;
			}

			this.patchSort(view);
			this.blockHomepageDrag(view);
			this.patchedViews.add(view);
			this.decorateView(view);
		}
	}

	refreshAll() {
		this.attach();

		for (const view of this.patchedViews) {
			this.decorateView(view);
		}
	}

	refreshPaths(paths: string[]) {
		this.attach();

		for (const view of this.patchedViews) {
			for (const path of paths) {
				const item = view.fileItems[path];

				if (item) {
					this.decorateItem(path, item);
				}
			}
		}
	}

	/**
	 * 设置变化后让文件浏览器重新排序（置顶开关、主页改名）
	 */
	resort() {
		for (const view of this.patchedViews) {
			view.requestSort?.();
		}
	}

	detach() {
		for (const view of this.patchedViews) {
			// 只删实例上的覆盖，恢复原型方法
			delete (view as Partial<FileExplorerView>).getSortedFolderItems;
			view.requestSort?.();

			for (const path in view.fileItems) {
				const item = view.fileItems[path];
				const el = item?.titleEl ?? item?.selfEl;

				el?.removeAttribute(COUNT_ATTR);
				el?.removeAttribute(KIND_ATTR);
				item?.selfEl?.removeAttribute(HOME_ATTR);
			}
		}

		this.patchedViews.clear();
	}

	private decorateView(view: FileExplorerView) {
		for (const path in view.fileItems) {
			const item = view.fileItems[path];

			if (item) {
				this.decorateItem(path, item);
			}
		}
	}

	private decorateItem(path: string, item: FileItem) {
		const el = item.titleEl ?? item.selfEl;

		if (!el) {
			return;
		}

		const { documentCounts, folderCounts } = this.plugin.data;

		const isFolder = item.file instanceof TFolder;
		const count = isFolder ? folderCounts[path] : documentCounts[path];

		if (count === undefined) {
			el.removeAttribute(COUNT_ATTR);
			el.removeAttribute(KIND_ATTR);
		} else {
			el.setAttribute(COUNT_ATTR, String(count));
			el.setAttribute(KIND_ATTR, isFolder ? 'folder' : 'file');
		}

		if (path === this.plugin.layout.getDashboardPath()) {
			item.selfEl?.setAttribute(HOME_ATTR, '');
		} else {
			item.selfEl?.removeAttribute(HOME_ATTR);
		}
	}

	/**
	 * 主页不能被拖动：在捕获阶段拦截 dragstart，先于文件浏览器自己的处理
	 */
	private blockHomepageDrag(view: FileExplorerView) {
		this.plugin.registerDomEvent(
			view.containerEl,
			'dragstart',
			(event) => {
				const target = event.target;

				if (!(target instanceof HTMLElement)) {
					return;
				}

				const path = target.closest('[data-path]')?.getAttribute('data-path');

				if (path === this.plugin.layout.getDashboardPath()) {
					event.preventDefault();
					event.stopPropagation();
				}
			},
			{ capture: true },
		);
	}

	private patchSort(view: FileExplorerView) {
		const original = view.getSortedFolderItems;

		if (typeof original !== 'function') {
			return;
		}

		const plugin = this.plugin;

		view.getSortedFolderItems = function (folder: TFolder) {
			const items = original.call(this, folder);

			if (!plugin.settings.pinDashboardFile) {
				return items;
			}

			const home = plugin.layout.getDashboardPath();
			const index = items.findIndex((item) => item.file.path === home);

			if (index > 0) {
				const [homeItem] = items.splice(index, 1);

				if (homeItem) {
					items.unshift(homeItem);
				}
			}

			return items;
		};

		view.requestSort?.();
	}
}
