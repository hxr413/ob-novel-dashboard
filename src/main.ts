import { Plugin } from 'obsidian';

import { NovelDashboardData, DEFAULT_DATA } from './logic/saved-data';

import { DailyStatisticsManager } from './logic/daily-statistics';

import { StatisticsEngine } from './logic/statistics';

import { ExplorerManager } from './logic/explorer';

import { EventManager } from './logic/event-manager';

import { WritingSession } from './logic/writing-session';

import { FileEventManager } from './logic/file-event-manager';

import { NovelDashboardSettingTab } from './logic/settings';

import { createWritingExtension } from './logic/writing-extension';

import { DashboardManager } from './dashboard/dashboard';

import { DashboardDataProvider } from './dashboard/dashboard-data';

import { DashboardFileManager } from './dashboard/dashboard-file';

import { DASHBOARD_VIEW_TYPE, DashboardView } from './dashboard/dashboard-view';

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

	private saveTimer: number | null = null;

	get settings() {
		return this.data.settings;
	}

	async onload() {
		await this.loadPluginData();

		this.statistics = new StatisticsEngine(
			this.app,
			this.settings.writingFolder,
		);

		this.dailyStatistics = new DailyStatisticsManager();

		this.explorer = new ExplorerManager(this.app);

		this.writingSession = new WritingSession(this.app, this.data);

		this.dashboard = new DashboardManager(this.data);

		this.dashboardData = new DashboardDataProvider(this);

		this.dashboardFile = new DashboardFileManager(this);

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
			if (Object.keys(this.data.documentCounts).length === 0) {
				await this.initializeCounts();
			} else {
				await this.restoreExplorerCounts();
			}

			// 创建主页文档

			await this.dashboardFile.initialize();

			// 自动打开侧边栏

			if (this.settings.dashboard.enableSidebar) {
				await this.openDashboardSidebar();
			}
		});

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

		this.data = {
			...DEFAULT_DATA,

			...saved,

			settings: {
				...DEFAULT_DATA.settings,

				...(saved?.settings ?? {}),

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
		const documentCounts = await this.statistics.scanFolder(
			this.settings.writingFolder,
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
