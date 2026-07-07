import { MarkdownPostProcessorContext, Plugin } from 'obsidian';

import { NovelDashboardData, DEFAULT_DATA } from './core/saved-data';

import { DailyStatisticsManager } from './analytics/daily-statistics';

import { StatisticsEngine } from './analytics/statistics';

import { ExplorerManager } from './observers/explorer';

import { EventManager } from './observers/event-manager';

import { WritingSession } from './observers/writing-session';

import { FileEventManager } from './observers/file-event-manager';

import { NovelDashboardSettingTab } from './core/settings';

import { createWritingExtension } from './observers/writing-extension';

import { DashboardManager } from './dashboard/dashboard';

import { DashboardDataProvider } from './dashboard/dashboard-data';

import { DashboardFileManager } from './dashboard/dashboard-file';

import { DASHBOARD_VIEW_TYPE, DashboardView } from './dashboard/dashboard-view';

import { HomepageRenderer } from './dashboard/homepage-renderer';

export default class NovelDashboardPlugin extends Plugin {
	data!: NovelDashboardData;

	statistics!: StatisticsEngine;

	dailyStatistics!: DailyStatisticsManager;

	explorer!: ExplorerManager;

	events!: EventManager;

	writingSession!: WritingSession;

	fileEvents!: FileEventManager;

	dashboard!: DashboardManager;

	dashboardData!: DashboardDataProvider;

	dashboardFile!: DashboardFileManager;

	homepageRenderer!: HomepageRenderer;

	private saveTimer: number | null = null;

	get settings() {
		return this.data.settings;
	}

	private inferWritingFolderFromCache(saved: any): string {
		const candidates: string[] = [];

		for (const file of saved?.recentFiles ?? []) {
			if (file?.path) {
				candidates.push(file.path);
			}
		}

		for (const path of Object.keys(saved?.documentCounts ?? {})) {
			candidates.push(path);
		}

		for (const path of Object.keys(saved?.folderCounts ?? {})) {
			candidates.push(path);
		}

		for (const candidate of candidates) {
			const normalized = candidate.replace(/^\/+|\/+$/g, '');

			if (!normalized) {
				continue;
			}

			const parts = normalized.split('/');

			if (parts.length > 1) {
				return parts[0] ?? DEFAULT_DATA.settings.writingFolder;
			}
		}

		return DEFAULT_DATA.settings.writingFolder;
	}

	private getEffectiveWritingFolder(saved: any = this.data): string {
		const configured = saved?.settings?.writingFolder?.trim();

		if (configured) {
			return configured;
		}

		return this.inferWritingFolderFromCache(saved);
	}

	getIgnoredPaths(): string[] {
		const configured = this.data?.settings?.ignoredPaths ?? '';

		const entries = configured
			.split(',')
			.map((entry) => entry.trim())
			.filter(Boolean);

		const allEntries = [
			this.settings.dashboard.dashboardFilePath,
			...entries,
		]
			.map((entry) => entry.trim())
			.filter(Boolean)
			.map((entry) => entry.replace(/^\/+|\/+$/g, ''));

		return [...new Set(allEntries)];
	}

	isPathIgnored(path: string): boolean {
		const normalizedPath = path.replace(/^\/+|\/+$/g, '');

		return this.getIgnoredPaths().some((entry) => {
			const normalizedEntry = entry.replace(/^\/+|\/+$/g, '');

			if (!normalizedEntry) {
				return false;
			}

			return (
				normalizedPath === normalizedEntry ||
				normalizedPath.startsWith(normalizedEntry + '/') ||
				normalizedPath.includes('/' + normalizedEntry + '/') ||
				normalizedPath.endsWith('/' + normalizedEntry)
			);
		});
	}

	async onload() {
		await this.loadPluginData();

		this.statistics = new StatisticsEngine(
			this.app,
			this.settings.writingFolder,
			this.getIgnoredPaths(),
		);

		this.dailyStatistics = new DailyStatisticsManager();

		this.explorer = new ExplorerManager(this.app);

		this.writingSession = new WritingSession(this.app, this.data);

		this.dashboard = new DashboardManager(this.data);

		this.dashboardData = new DashboardDataProvider(this);

		this.dashboardFile = new DashboardFileManager(this);

		this.homepageRenderer = new HomepageRenderer(this);

		/*
			注册 Dashboard Sidebar
		*/

		this.registerView(
			DASHBOARD_VIEW_TYPE,
			(leaf) => new DashboardView(leaf, this),
		);

		/*
			Writing
		*/

		this.writingSession.onSaveRequested = () => {
			this.requestSave();

			this.dashboardFile.requestUpdate();
		};

		this.writingSession.start();

		this.registerEditorExtension(createWritingExtension(this));

		/*
			File Events
		*/

		this.fileEvents = new FileEventManager(this.app, this);

		this.fileEvents.start();

		this.events = new EventManager(this.app);

		this.events.start();

		this.app.workspace.onLayoutReady(async () => {
			await this.initializeCounts(true);

			// 创建主页文档

			await this.dashboardFile.initialize();

			// 自动打开侧边栏

			if (this.settings.dashboard.enableSidebar) {
				await this.openDashboardSidebar();
			}
		});

		this.registerMarkdownCodeBlockProcessor(
			'webnovel-homepage',
			(
				source: string,
				el: HTMLElement,
				ctx: MarkdownPostProcessorContext,
			) => {
				this.homepageRenderer.render(source, el, ctx);
			},
		);

		this.addSettingTab(new NovelDashboardSettingTab(this.app, this));

		this.addCommand({
			id: 'scan-writing-folder',

			name: 'Scan Writing Folder',

			callback: async () => {
				await this.initializeCounts(true);
			},
		});

		this.addCommand({
			id: 'open-novel-dashboard-sidebar',
			name: 'Open Novel Dashboard Sidebar',

			callback: async () => {
				await this.openDashboardSidebar();
			},
		});

		console.log('Novel Dashboard loaded');
	}

	async openDashboardSidebar() {
		const leaf = this.app.workspace.getRightLeaf(false);

		if (!leaf) {
			console.warn('Cannot create dashboard sidebar');

			return;
		}

		await leaf.setViewState({
			type: DASHBOARD_VIEW_TYPE,

			active: true,
		});

		this.app.workspace.revealLeaf(leaf);
	}

	async closeDashboardSidebar() {
		const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);

		for (const leaf of leaves) {
			await leaf.detach();
		}
	}

	async loadPluginData() {
		const saved = await this.loadData();

		const effectiveWritingFolder = this.getEffectiveWritingFolder(saved);

		this.data = {
			...DEFAULT_DATA,

			...saved,

			settings: {
				...DEFAULT_DATA.settings,

				...(saved?.settings ?? {}),

				writingFolder: effectiveWritingFolder,

				dashboard: {
					...DEFAULT_DATA.settings.dashboard,

					...(saved?.settings?.dashboard ?? {}),
				},
			},

			documentCounts: {
				...DEFAULT_DATA.documentCounts,

				...(saved?.documentCounts ?? {}),
			},

			folderCounts: {
				...DEFAULT_DATA.folderCounts,

				...(saved?.folderCounts ?? {}),
			},

			previousDocumentCounts: {
				...DEFAULT_DATA.previousDocumentCounts,

				...(saved?.previousDocumentCounts ?? {}),
			},

			dailyStats: {
				...DEFAULT_DATA.dailyStats,

				...(saved?.dailyStats ?? {}),
			},
		};
	}

	requestSave() {
		if (this.saveTimer) {
			window.clearTimeout(this.saveTimer);
		}

		this.saveTimer = window.setTimeout(async () => {
			await this.savePluginData();

			this.saveTimer = null;
		}, 3000);
	}

	async initializeCounts(manual = false) {
		const ignoredPaths = this.getIgnoredPaths();

		const writingFolder = this.getEffectiveWritingFolder(this.data);

		this.data.settings.writingFolder = writingFolder;

		this.statistics = new StatisticsEngine(
			this.app,
			writingFolder,
			ignoredPaths,
		);

		const documentCounts = await this.statistics.scanFolder(
			writingFolder,
			ignoredPaths,
		);

		const folderCounts = this.statistics.calculateFolderCounts(
			documentCounts,
			this.statistics.getFolderPaths(),
		);

		if (manual) {
			this.dailyStatistics.updateDailyWords(this.data, documentCounts);
		}

		this.data.documentCounts = documentCounts;

		this.data.folderCounts = folderCounts;

		await this.explorer.updateCounts(documentCounts);

		await this.explorer.updateCounts(folderCounts);

		await this.savePluginData();
	}

	async restoreExplorerCounts() {
		await this.explorer.updateCounts(this.data.documentCounts);

		await this.explorer.updateCounts(this.data.folderCounts);
	}

	async savePluginData() {
		await this.saveData(this.data);
	}

	async onunload() {
		if (this.saveTimer) {
			window.clearTimeout(this.saveTimer);
		}

		await this.savePluginData();

		this.writingSession?.stop();

		console.log('Novel Dashboard unloaded');
	}
}
