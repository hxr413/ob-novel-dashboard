import { App, TFile, TFolder } from 'obsidian';

import type { DailyStat, NovelDashboardData } from '../core/saved-data';
import type { VaultLayout } from '../core/vault-layout';
import { todayKey } from '../utils/date';
import { ancestorFolders, isSameOrUnder } from '../utils/paths';
import { TextCounter } from '../utils/text-counter';

const RECENT_LIMIT = 20;

/**
 * 字数统计内核
 *
 * - documentCounts：每个文档当前字数
 * - folderCounts：每个文件夹的合计
 * - baseline：每个文档在「今天第一次被看到」时的字数
 * - 今日净增 = Σ(当前字数 − baseline)
 *
 * 删 100 字再写 100 字，净增为 0；输入量由 WritingSession 另外记录。
 */
export class WordTracker {
	constructor(
		private app: App,
		private getData: () => NovelDashboardData,
		private layout: VaultLayout,
	) {}

	private get data() {
		return this.getData();
	}

	getDayStat(date: string): DailyStat {
		let stat = this.data.dailyStats[date];

		if (!stat) {
			stat = { words: 0, typed: 0, duration: 0 };
			this.data.dailyStats[date] = stat;
		}

		return stat;
	}

	/**
	 * 跨天时，用当前字数作为新一天的起点
	 */
	ensureDay(): string {
		const today = todayKey();

		if (this.data.baseline.date !== today) {
			this.data.baseline = {
				date: today,
				counts: { ...this.data.documentCounts },
			};
		}

		return today;
	}

	getTotalWords(): number {
		let total = 0;

		for (const path in this.data.documentCounts) {
			total += this.data.documentCounts[path] ?? 0;
		}

		return total;
	}

	/**
	 * 全量扫描写作文件夹
	 *
	 * 新进入统计范围的文档（改设置、移入文件夹）以当前字数为起点，不算作今天写的
	 */
	async scanAll(): Promise<number> {
		const isNewDay = this.data.baseline.date !== todayKey();

		const counts: Record<string, number> = {};

		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!this.layout.isTrackedFile(file.path)) {
				continue;
			}

			counts[file.path] = await this.countFile(file);
		}

		this.data.documentCounts = counts;

		if (isNewDay) {
			this.data.baseline = { date: todayKey(), counts: { ...counts } };
		} else {
			const baseline = this.data.baseline.counts;

			for (const path in baseline) {
				if (counts[path] === undefined) {
					delete baseline[path];
				}
			}

			for (const path in counts) {
				baseline[path] ??= counts[path] ?? 0;
			}
		}

		this.data.recentFiles = this.data.recentFiles.filter(
			(item) => counts[item.path] !== undefined,
		);

		this.rebuildFolders();
		this.recomputeToday();

		return Object.keys(counts).length;
	}

	/**
	 * 单个文档变化
	 *
	 * @returns 字数缓存是否有变化
	 */
	async updateFile(file: TFile, reason: 'modify' | 'create'): Promise<boolean> {
		this.ensureDay();

		const path = file.path;

		if (!this.layout.isTrackedFile(path)) {
			return this.forgetFile(path);
		}

		const count = await this.countFile(file);
		const previous = this.data.documentCounts[path];
		const baseline = this.data.baseline.counts;

		if (baseline[path] === undefined) {
			baseline[path] = reason === 'create' ? count : (previous ?? count);
		}

		this.data.documentCounts[path] = count;

		if (reason === 'modify') {
			this.touchRecent(path);
		}

		if (previous === count) {
			return false;
		}

		this.rebuildFolders();
		this.recomputeToday();

		return true;
	}

	forgetFile(path: string): boolean {
		const existed = this.data.documentCounts[path] !== undefined;

		delete this.data.documentCounts[path];
		delete this.data.baseline.counts[path];

		this.data.recentFiles = this.data.recentFiles.filter(
			(item) => item.path !== path,
		);

		if (existed) {
			this.rebuildFolders();
			this.recomputeToday();
		}

		return existed;
	}

	/**
	 * 重命名 / 移动：字数、起点、最近写作都跟着走
	 */
	async rename(file: TFile | TFolder, oldPath: string) {
		this.ensureDay();

		const move = (path: string) =>
			file instanceof TFolder
				? isSameOrUnder(path, oldPath)
					? file.path + path.slice(oldPath.length)
					: null
				: path === oldPath
					? file.path
					: null;

		const remap = (record: Record<string, number>) => {
			for (const path of Object.keys(record)) {
				const target = move(path);

				if (target !== null && target !== path) {
					record[target] = record[path] ?? 0;
					delete record[path];
				}
			}
		};

		remap(this.data.documentCounts);
		remap(this.data.baseline.counts);

		for (const item of this.data.recentFiles) {
			item.path = move(item.path) ?? item.path;
		}

		if (file instanceof TFolder) {
			await this.scanAll();

			return;
		}

		if (this.layout.isTrackedFile(file.path)) {
			// 从外部移入写作文件夹：以当前字数为起点
			await this.updateFile(file, 'create');
		} else {
			this.forgetFile(file.path);
		}

		this.rebuildFolders();
		this.recomputeToday();
	}

	touchRecent(path: string) {
		const list = this.data.recentFiles.filter((item) => item.path !== path);

		list.unshift({ path, time: Date.now() });

		this.data.recentFiles = list.slice(0, RECENT_LIMIT);
	}

	rebuildFolders() {
		const folderCounts: Record<string, number> = {};

		// 空文件夹显示 0
		for (const file of this.app.vault.getAllLoadedFiles()) {
			if (file instanceof TFolder && this.layout.isTrackedFolder(file.path)) {
				folderCounts[file.path] = 0;
			}
		}

		for (const path in this.data.documentCounts) {
			const count = this.data.documentCounts[path] ?? 0;

			for (const folder of ancestorFolders(path)) {
				if (folderCounts[folder] !== undefined) {
					folderCounts[folder] += count;
				}
			}
		}

		this.data.folderCounts = folderCounts;
	}

	recomputeToday() {
		const today = this.ensureDay();
		const baseline = this.data.baseline.counts;

		let net = 0;

		for (const path in this.data.documentCounts) {
			const count = this.data.documentCounts[path] ?? 0;

			net += count - (baseline[path] ?? count);
		}

		const stat = this.getDayStat(today);

		stat.words = net + (stat.adjust ?? 0);
	}

	/**
	 * 今天不含手动修正的净增
	 */
	getComputedTodayNet(): number {
		const stat = this.getDayStat(this.ensureDay());

		return stat.words - (stat.adjust ?? 0);
	}

	/**
	 * 手动修改某一天的记录
	 */
	setRecord(date: string, record: Omit<DailyStat, 'adjust'>) {
		const today = this.ensureDay();

		if (date === today) {
			const computed = this.getComputedTodayNet();
			const stat = this.getDayStat(today);

			stat.adjust = record.words - computed;
			stat.words = record.words;
			stat.typed = record.typed;
			stat.duration = record.duration;

			return;
		}

		this.data.dailyStats[date] = { ...record };
	}

	deleteRecord(date: string) {
		if (date === this.ensureDay()) {
			this.setRecord(date, {
				words: this.getComputedTodayNet(),
				typed: 0,
				duration: 0,
			});

			const stat = this.getDayStat(date);
			delete stat.adjust;

			return;
		}

		delete this.data.dailyStats[date];
	}

	private async countFile(file: TFile): Promise<number> {
		return TextCounter.countMarkdown(await this.app.vault.cachedRead(file));
	}
}
