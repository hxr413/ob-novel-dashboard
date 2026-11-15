import type { Annotation, NovelDashboardData } from '../core/saved-data';
import { isSameOrUnder } from '../utils/paths';
import { captureAnchor } from './anchor';

/**
 * 批注的增删改查，数据存放在插件 data.json 的 annotations 字段
 */
export class AnnotationStore {
	constructor(
		private getData: () => NovelDashboardData,
		private onChange: () => void,
	) {}

	private get all() {
		return this.getData().annotations;
	}

	list(path: string): Annotation[] {
		return this.all[path] ?? [];
	}

	get(path: string, id: string): Annotation | undefined {
		return this.list(path).find((item) => item.id === id);
	}

	add(path: string, doc: string, from: number, to: number): Annotation {
		const now = Date.now();

		const annotation: Annotation = {
			id: now.toString(36) + Math.random().toString(36).slice(2, 7),
			...captureAnchor(doc, from, to),
			text: '',
			created: now,
			updated: now,
		};

		this.all[path] = [...this.list(path), annotation];
		this.onChange();

		return annotation;
	}

	setText(path: string, id: string, text: string) {
		const annotation = this.get(path, id);

		if (annotation && annotation.text !== text) {
			annotation.text = text;
			annotation.updated = Date.now();
			this.onChange();
		}
	}

	remove(path: string, id: string) {
		const list = this.list(path).filter((item) => item.id !== id);

		if (list.length > 0) {
			this.all[path] = list;
		} else {
			delete this.all[path];
		}

		this.onChange();
	}

	/**
	 * 编辑器里位置变化后回写（原文被修改时也更新原文）
	 */
	syncRanges(path: string, doc: string, ranges: Map<string, { from: number; to: number }>) {
		let changed = false;

		for (const annotation of this.list(path)) {
			const range = ranges.get(annotation.id);

			if (!range) {
				continue;
			}

			const anchor = captureAnchor(doc, range.from, range.to);

			if (
				anchor.from !== annotation.from ||
				anchor.to !== annotation.to ||
				anchor.quote !== annotation.quote
			) {
				Object.assign(annotation, anchor);
				changed = true;
			}
		}

		if (changed) {
			this.onChange();
		}
	}

	/**
	 * 文件或文件夹改名 / 移动
	 */
	rename(oldPath: string, newPath: string) {
		let changed = false;

		for (const path of Object.keys(this.all)) {
			if (!isSameOrUnder(path, oldPath)) {
				continue;
			}

			const target = newPath + path.slice(oldPath.length);
			const list = this.all[path];

			if (list) {
				this.all[target] = list;
				delete this.all[path];
				changed = true;
			}
		}

		if (changed) {
			this.onChange();
		}
	}

	/**
	 * 文件或文件夹被删除
	 */
	removePath(deletedPath: string) {
		let changed = false;

		for (const path of Object.keys(this.all)) {
			if (isSameOrUnder(path, deletedPath)) {
				delete this.all[path];
				changed = true;
			}
		}

		if (changed) {
			this.onChange();
		}
	}
}
