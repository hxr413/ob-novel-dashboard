import { Plugin, TFile } from 'obsidian';

import { WordTracker } from './analytics/word-tracker';
import { AnnotationManager } from './annotations/annotation-manager';
import { migrateData, NovelDashboardData } from './core/saved-data';
import { NovelDashboardSettingTab } from './core/settings';
import { VaultLayout } from './core/vault-layout';
import { DashboardDataProvider } from './dashboard/dashboard-data';
import { DashboardFileManager } from './dashboard/dashboard-file';
import {
	DASHBOARD_ICON,
	DASHBOARD_VIEW_TYPE,
	DashboardView,
} from './dashboard/dashboard-view';
import {
	HOMEPAGE_CODE_BLOCK,
	HomepageRenderer,
} from './dashboard/homepage-renderer';
import { RecordsModal } from './dashboard/records-modal';
import { setLanguage, t } from './i18n';
import { ExplorerDecorator } from './observers/explorer';
import { FileEventManager } from './observers/file-event-manager';
import { createWritingExtension } from './observers/writing-extension';
import { WritingSession } from './observers/writing-session';
import { hideHoverTip } from './ui/hover-tip';
import { StatusBar } from './ui/status-bar';
import { todayKey } from './utils/date';

const SAVE_DELAY = 3000;
const REFRESH_DELAY = 1000;

export default class NovelDashboardPlugin extends Plugin {
	data!: NovelDashboardData;
	layout!: VaultLayout;
	tracker!: WordTracker;
	dashboardData!: DashboardDataProvider;
	dashboardFile!: DashboardFileManager;
	homepageRenderer!: HomepageRenderer;
	explorer!: ExplorerDecorator;
	writingSession!: WritingSession;
	annotations!: AnnotationManager;
	statusBar!: StatusBar;

	private saveTimer: number | null = null;
	private refreshTimer: number | null = null;

	get settings() {
		return this.data.settings;
	}

	async onload() {
		this.data = migrateData(await this.loadData());
		setLanguage(this.settings.language);

		const getData = () => this.data;

		this.layout = new VaultLayout(this.app, () => this.settings);
		this.tracker = new WordTracker(this.app, getData, this.layout);
		this.dashboardData = new DashboardDataProvider(
			getData,
			(path) => this.app.vault.getAbstractFileByPath(path) instanceof TFile,
		);
		this.dashboardFile = new DashboardFileManager(this);
		this.homepageRenderer = new HomepageRenderer(this);
		this.explorer = new ExplorerDecorator(this);
		this.writingSession = new WritingSession(this.tracker, this.layout);
		this.annotations = new AnnotationManager(this);
		this.annotations.register();

		this.registerView(DASHBOARD_VIEW_TYPE, (leaf) => new DashboardView(leaf, this));

		this.registerMarkdownCodeBlockProcessor(HOMEPAGE_CODE_BLOCK, (_source, el, ctx) => {
			ctx.addChild(this.homepageRenderer.createChild(el));
		});

		this.writingSession.onTyped = () => this.onLiveChanged();
		this.writingSession.onTick = () => this.onLiveChanged();
		this.registerEditorExtension(createWritingExtension(this));
		this.registerInterval(window.setInterval(() => this.writingSession.tick(), 1000));

		// 跨过午夜但没有编辑时，也要切到新的一天
		let lastDay = todayKey();
		this.registerInterval(
			window.setInterval(() => {
				if (todayKey() !== lastDay) {
					lastDay = todayKey();
					this.tracker.recomputeToday();
					this.onDataChanged(true);
				}
			}, 60000),
		);

		this.statusBar = new StatusBar(this);

		this.addRibbonIcon(DASHBOARD_ICON, t('ribbonTooltip'), () => {
			void this.openDashboardSidebar();
		});

		this.registerCommands();
		this.addSettingTab(new NovelDashboardSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(async () => {
			await this.tracker.scanAll();
			this.explorer.refreshAll();

			this.registerEvent(this.app.workspace.on('layout-change', () => this.explorer.attach()));
			new FileEventManager(this).start();

			await this.dashboardFile.ensure();

			if (this.settings.enableSidebar) {
				await this.openDashboardSidebar(false);
			}

			this.onDataChanged(true);
		});
	}

	onunload() {
		this.explorer?.detach();
		hideHoverTip();

		if (this.saveTimer) {
			window.clearTimeout(this.saveTimer);
		}

		if (this.refreshTimer) {
			window.clearTimeout(this.refreshTimer);
		}

		void this.savePluginData();
	}

	private registerCommands() {
		this.addCommand({
			id: 'open-novel-dashboard-sidebar',
			name: t('cmdOpenSidebar'),
			callback: () => void this.openDashboardSidebar(),
		});

		this.addCommand({
			id: 'open-homepage',
			name: t('cmdOpenHomepage'),
			callback: () => void this.dashboardFile.open(),
		});

		this.addCommand({
			id: 'edit-writing-records',
			name: t('cmdEditRecords'),
			callback: () => this.openRecordsModal(),
		});
	}

	/* ---------- 面板 ---------- */

	async openDashboardSidebar(reveal = true) {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE)[0];

		if (existing) {
			if (reveal) {
				await workspace.revealLeaf(existing);
			}

			return;
		}

		const leaf = workspace.getRightLeaf(false);

		if (!leaf) {
			return;
		}

		await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: reveal });

		if (reveal) {
			await workspace.revealLeaf(leaf);
		}
	}

	closeDashboardSidebar() {
		for (const leaf of this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE)) {
			leaf.detach();
		}
	}

	openRecordsModal() {
		new RecordsModal(this.app, this).open();
	}

	/* ---------- 设置变化 ---------- */

	async changeWritingFolder(folder: string) {
		const oldDashboard = this.layout.getDashboardPath();

		this.settings.writingFolder = folder;

		await this.layout.ensureFolder(folder);
		await this.layout.moveDashboard(oldDashboard, this.layout.getDashboardPath());
		await this.savePluginData();
		await this.rescan();
		await this.dashboardFile.ensure();

		this.explorer.resort();
	}

	async changeHomepageName(name: string) {
		const oldDashboard = this.layout.getDashboardPath();

		this.settings.homepageName = name;

		await this.layout.moveDashboard(oldDashboard, this.layout.getDashboardPath());
		await this.savePluginData();
		await this.rescan();
		await this.dashboardFile.ensure();

		this.explorer.resort();
	}

	async rescan(): Promise<number> {
		const count = await this.tracker.scanAll();

		this.explorer.refreshAll();
		this.annotations.reloadAll();
		this.onDataChanged(true);

		return count;
	}

	/* ---------- 刷新与保存 ---------- */

	/**
	 * 输入、计时：只更新数字
	 */
	onLiveChanged() {
		this.statusBar.update();
		this.homepageRenderer.updateLive();

		for (const view of this.getDashboardViews()) {
			view.updateLive();
		}

		this.requestSave();
	}

	/**
	 * 字数或记录变化：数字立即更新，图表防抖重绘
	 */
	onDataChanged(immediate = false) {
		this.onLiveChanged();

		if (this.refreshTimer) {
			window.clearTimeout(this.refreshTimer);
		}

		this.refreshTimer = window.setTimeout(
			() => {
				this.refreshTimer = null;

				for (const view of this.getDashboardViews()) {
					view.render();
				}

				this.homepageRenderer.refresh();
			},
			immediate ? 50 : REFRESH_DELAY,
		);
	}

	private getDashboardViews(): DashboardView[] {
		return this.app.workspace
			.getLeavesOfType(DASHBOARD_VIEW_TYPE)
			.map((leaf) => leaf.view)
			.filter((view): view is DashboardView => view instanceof DashboardView);
	}

	/**
	 * 最多延迟 3 秒保存（持续输入时不会一直推迟）
	 */
	requestSave() {
		if (this.saveTimer) {
			return;
		}

		this.saveTimer = window.setTimeout(() => {
			this.saveTimer = null;
			void this.savePluginData();
		}, SAVE_DELAY);
	}

	async savePluginData() {
		await this.saveData(this.data);
	}
}
