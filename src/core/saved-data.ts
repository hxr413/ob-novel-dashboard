import type { LanguagePreference } from '../i18n';
import { isDateKey, todayKey } from '../utils/date';
import { baseName, cleanPath, isSameOrUnder } from '../utils/paths';

export interface DailyStat {
	/** 净增字数（当前字数 − 当天起始字数，含手动修正） */
	words: number;

	/** 键盘输入字数（删除、粘贴不计） */
	typed: number;

	/** 写作时长，秒 */
	duration: number;

	/** 仅当天有效：手动修正净增时的偏移量 */
	adjust?: number;
}

export interface RecentFile {
	path: string;
	time: number;
}

export interface NovelDashboardSettings {
	writingFolder: string;
	homepageName: string;
	ignoredPaths: string[];
	enableSidebar: boolean;
	enableDashboardFile: boolean;
	pinDashboardFile: boolean;
	showStatusBar: boolean;
	showAnnotations: boolean;
	language: LanguagePreference;
}

/**
 * 批注：正文不插入任何标记，位置靠「原文 + 前后文」定位
 */
export interface Annotation {
	id: string;
	from: number;
	to: number;
	/** 被批注的原文 */
	quote: string;
	prefix: string;
	suffix: string;
	text: string;
	created: number;
	updated: number;
}

/**
 * 当天每个文档的起始字数，用来算净增
 */
export interface DayBaseline {
	date: string;
	counts: Record<string, number>;
}

export interface NovelDashboardData {
	settings: NovelDashboardSettings;

	/** 开始记录的日期 */
	startDate: string;

	documentCounts: Record<string, number>;
	folderCounts: Record<string, number>;
	baseline: DayBaseline;
	dailyStats: Record<string, DailyStat>;
	recentFiles: RecentFile[];

	/** 文件路径 -> 批注 */
	annotations: Record<string, Annotation[]>;
}

export const DEFAULT_SETTINGS: NovelDashboardSettings = {
	writingFolder: '写作',
	homepageName: 'Novel Dashboard',
	ignoredPaths: [],
	enableSidebar: true,
	enableDashboardFile: true,
	pinDashboardFile: true,
	showStatusBar: true,
	showAnnotations: true,
	language: 'auto',
};

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Raw)
		: {};
}

function asNumber(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
	return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function asCounts(value: unknown): Record<string, number> {
	const result: Record<string, number> = {};
	const record = asRecord(value);

	for (const key in record) {
		result[key] = asNumber(record[key]);
	}

	return result;
}

function migrateSettings(raw: Raw): NovelDashboardSettings {
	// 旧版本把 dashboard 相关设置放在 settings.dashboard 里
	const legacyDashboard = asRecord(raw.dashboard);

	const writingFolder =
		cleanPath(asString(raw.writingFolder, DEFAULT_SETTINGS.writingFolder)) ||
		DEFAULT_SETTINGS.writingFolder;

	const legacyDashboardPath = cleanPath(
		asString(legacyDashboard.dashboardFilePath, ''),
	);

	const homepageName = asString(
		raw.homepageName,
		legacyDashboardPath
			? baseName(legacyDashboardPath)
			: DEFAULT_SETTINGS.homepageName,
	);

	// 旧版本是逗号分隔字符串
	let ignoredPaths: string[] = [];

	if (Array.isArray(raw.ignoredPaths)) {
		ignoredPaths = raw.ignoredPaths.filter(
			(entry): entry is string => typeof entry === 'string',
		);
	} else if (typeof raw.ignoredPaths === 'string') {
		ignoredPaths = raw.ignoredPaths.split(',');
	}

	ignoredPaths = [
		...new Set(
			ignoredPaths
				.map(cleanPath)
				.filter(Boolean)
				// 主页本来就会被忽略，不需要出现在列表里
				.filter(
					(entry) =>
						entry !== legacyDashboardPath &&
						baseName(entry) !== homepageName,
				),
		),
	];

	const language = raw.language;

	return {
		writingFolder,
		homepageName,
		ignoredPaths,
		enableSidebar: asBoolean(
			raw.enableSidebar ?? legacyDashboard.enableSidebar,
			DEFAULT_SETTINGS.enableSidebar,
		),
		enableDashboardFile: asBoolean(
			raw.enableDashboardFile ?? legacyDashboard.enableDashboardFile,
			DEFAULT_SETTINGS.enableDashboardFile,
		),
		pinDashboardFile: asBoolean(
			raw.pinDashboardFile,
			DEFAULT_SETTINGS.pinDashboardFile,
		),
		showStatusBar: asBoolean(raw.showStatusBar, DEFAULT_SETTINGS.showStatusBar),
		showAnnotations: asBoolean(
			raw.showAnnotations,
			DEFAULT_SETTINGS.showAnnotations,
		),
		language:
			language === 'zh' || language === 'en' || language === 'auto'
				? language
				: DEFAULT_SETTINGS.language,
	};
}

function migrateDailyStats(raw: unknown): Record<string, DailyStat> {
	const result: Record<string, DailyStat> = {};
	const record = asRecord(raw);
	const today = todayKey();

	for (const date in record) {
		if (!isDateKey(date)) {
			continue;
		}

		const stat = asRecord(record[date]);
		const words = asNumber(stat.words);

		const migrated: DailyStat = {
			words,
			// 旧版本的 words 是按键输入量
			typed: asNumber(stat.typed, words),
			duration: asNumber(stat.duration),
		};

		if (typeof stat.adjust === 'number') {
			migrated.adjust = stat.adjust;
		} else if (date === today && typeof stat.typed !== 'number') {
			// 旧数据的今天：保留已记录的字数，之后的净增在此基础上累加
			migrated.adjust = words;
		}

		result[date] = migrated;
	}

	return result;
}

function migrateAnnotations(raw: unknown): Record<string, Annotation[]> {
	const result: Record<string, Annotation[]> = {};
	const record = asRecord(raw);

	for (const path in record) {
		const list = record[path];

		if (!Array.isArray(list)) {
			continue;
		}

		const annotations = list.map(asRecord).flatMap((item): Annotation[] => {
			if (typeof item.id !== 'string' || typeof item.quote !== 'string') {
				return [];
			}

			return [
				{
					id: item.id,
					from: asNumber(item.from),
					to: asNumber(item.to),
					quote: item.quote,
					prefix: typeof item.prefix === 'string' ? item.prefix : '',
					suffix: typeof item.suffix === 'string' ? item.suffix : '',
					text: typeof item.text === 'string' ? item.text : '',
					created: asNumber(item.created, Date.now()),
					updated: asNumber(item.updated, Date.now()),
				},
			];
		});

		if (annotations.length > 0) {
			result[path] = annotations;
		}
	}

	return result;
}

export function migrateData(saved: unknown): NovelDashboardData {
	const raw = asRecord(saved);
	const settings = migrateSettings(asRecord(raw.settings));
	const dailyStats = migrateDailyStats(raw.dailyStats);

	const earliestRecord = Object.keys(dailyStats).sort()[0];

	const startDate =
		typeof raw.startDate === 'string' && isDateKey(raw.startDate)
			? raw.startDate
			: (earliestRecord ?? todayKey());

	const baselineRaw = asRecord(raw.baseline);

	const recentFiles = Array.isArray(raw.recentFiles)
		? raw.recentFiles
				.map(asRecord)
				.filter((item) => typeof item.path === 'string')
				.map((item) => ({
					path: item.path as string,
					time: asNumber(item.time),
				}))
		: [];

	return {
		settings,
		startDate,
		documentCounts: asCounts(raw.documentCounts),
		folderCounts: asCounts(raw.folderCounts),
		baseline: {
			date: typeof baselineRaw.date === 'string' ? baselineRaw.date : '',
			counts: asCounts(baselineRaw.counts),
		},
		dailyStats,
		recentFiles: recentFiles.filter((item) =>
			isSameOrUnder(item.path, settings.writingFolder),
		),
		annotations: migrateAnnotations(raw.annotations),
	};
}
