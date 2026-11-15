import { MarkdownFileInfo, MarkdownView, Notice } from 'obsidian';
import { EditorView, ViewPlugin } from '@codemirror/view';

import { t } from '../i18n';
import type NovelDashboardPlugin from '../main';
import { annotationField } from './annotation-field';
import { AnnotationMargin } from './annotation-margin';
import { AnnotationStore } from './annotation-store';

const SYNC_DELAY = 400;
const TOGGLE_ICON = 'message-square-text';

/**
 * 批注功能入口：编辑器扩展、右键菜单、命令、标题栏开关、文件事件
 *
 * 只对写作文件夹内参与统计的文档生效
 */
export class AnnotationManager {
	readonly store: AnnotationStore;

	readonly margins = new Set<AnnotationMargin>();

	private syncTimers = new Map<AnnotationMargin, number>();

	private actions = new Map<MarkdownView, HTMLElement>();

	constructor(private plugin: NovelDashboardPlugin) {
		this.store = new AnnotationStore(
			() => plugin.data,
			() => plugin.requestSave(),
		);
	}

	isTracked(path: string): boolean {
		return this.plugin.layout.isTrackedFile(path);
	}

	isVisible(): boolean {
		return this.plugin.settings.showAnnotations;
	}

	register() {
		const { plugin } = this;
		const { workspace } = plugin.app;
		const createMargin = (view: EditorView) => new AnnotationMargin(view, this);

		plugin.registerEditorExtension([
			annotationField,
			ViewPlugin.define(createMargin, {
				eventHandlers: {
					click(event) {
						this.onEditorClick(event);
					},
				},
			}),
		]);

		plugin.registerEvent(
			workspace.on('editor-menu', (menu, editor, info) => {
				const path = info.file?.path;

				if (!editor.somethingSelected() || !path || !this.isTracked(path)) {
					return;
				}

				menu.addItem((item) =>
					item
						.setTitle(t('annoAdd'))
						.setIcon('message-square-plus')
						.onClick(() => this.addFromEditor(info)),
				);
			}),
		);

		plugin.addCommand({
			id: 'add-annotation',
			name: t('annoAdd'),
			editorCheckCallback: (checking, editor, info) => {
				const path = info.file?.path;
				const available =
					editor.somethingSelected() && !!path && this.isTracked(path);

				if (available && !checking) {
					this.addFromEditor(info);
				}

				return available;
			},
		});

		plugin.addCommand({
			id: 'toggle-annotations',
			name: t('annoToggle'),
			callback: () => void this.setVisible(!this.isVisible()),
		});

		plugin.registerEvent(workspace.on('layout-change', () => this.refreshActions()));
		plugin.registerEvent(workspace.on('file-open', () => this.refreshActions()));
		workspace.onLayoutReady(() => this.refreshActions());

		plugin.register(() => {
			for (const timer of this.syncTimers.values()) {
				window.clearTimeout(timer);
			}

			for (const margin of this.margins) {
				margin.sync();
			}

			for (const el of this.actions.values()) {
				el.remove();
			}

			this.actions.clear();
		});
	}

	addFromEditor(info: MarkdownFileInfo) {
		const margin = [...this.margins].find((item) => item.info === info);

		if (!margin) {
			return;
		}

		const selection = margin.view.state.selection.main;

		if (selection.empty) {
			new Notice(t('annoNeedSelection'));

			return;
		}

		margin.addAnnotation(selection.from, selection.to);
	}

	/**
	 * 编辑后延迟把位置写回数据
	 */
	requestSync(margin: AnnotationMargin) {
		const existing = this.syncTimers.get(margin);

		if (existing) {
			window.clearTimeout(existing);
		}

		this.syncTimers.set(
			margin,
			window.setTimeout(() => {
				this.syncTimers.delete(margin);
				margin.sync();
			}, SYNC_DELAY),
		);
	}

	ensureVisible() {
		if (!this.isVisible()) {
			void this.setVisible(true);
		}
	}

	async setVisible(visible: boolean) {
		this.plugin.settings.showAnnotations = visible;
		await this.plugin.savePluginData();

		for (const margin of this.margins) {
			margin.applyVisibility();
		}

		this.refreshActions();
	}

	/* ---------- 文件事件 ---------- */

	onRename(oldPath: string, newPath: string) {
		this.store.rename(oldPath, newPath);
		this.reloadAll();
	}

	onDelete(path: string) {
		this.store.removePath(path);
	}

	/** 设置变化（写作文件夹、忽略列表）后重新判断哪些文档可以批注 */
	reloadAll() {
		for (const margin of this.margins) {
			margin.reloadSoon();
		}

		this.refreshActions();
	}

	/* ---------- 标题栏开关 ---------- */

	private refreshActions() {
		const views = new Set<MarkdownView>();

		for (const leaf of this.plugin.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;

			if (!(view instanceof MarkdownView)) {
				continue;
			}

			views.add(view);

			let el = this.actions.get(view);

			if (!el) {
				el = view.addAction(TOGGLE_ICON, t('annoToggle'), () => {
					void this.setVisible(!this.isVisible());
				});
				el.addClass('nd-anno-toggle');
				this.actions.set(view, el);
			}

			const path = view.file?.path;

			el.toggle(!!path && this.isTracked(path));
			el.toggleClass('is-active', this.isVisible());
		}

		// 已关闭的视图
		for (const [view, el] of this.actions) {
			if (!views.has(view)) {
				el.remove();
				this.actions.delete(view);
			}
		}
	}
}
