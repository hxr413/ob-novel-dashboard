import { editorInfoField, MarkdownFileInfo, MarkdownView, setIcon } from 'obsidian';
import type { EditorView, PluginValue, ViewUpdate } from '@codemirror/view';
import { Transaction } from '@codemirror/state';

import type { Annotation } from '../core/saved-data';
import { t } from '../i18n';
import { resolveAnchor } from './anchor';
import {
	activeAnnotationEffect,
	addAnnotationEffect,
	AnnotationRange,
	getActiveAnnotation,
	getAnnotationRanges,
	removeAnnotationEffect,
	setAnnotationsEffect,
} from './annotation-field';
import type { AnnotationManager } from './annotation-manager';

const CARD_GAP = 8;

function truncate(text: string, length: number): string {
	const flat = text.replace(/\s+/g, ' ').trim();

	return flat.length > length ? flat.slice(0, length) + '…' : flat;
}

function formatTime(time: number): string {
	const date = new Date(time);
	const pad = (value: number) => String(value).padStart(2, '0');

	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 编辑器右侧页边的批注卡片
 *
 * 卡片层放在 .cm-scroller 内部，随正文一起滚动；每张卡片对齐到被批注文字所在的行，
 * 互相重叠时依次往下推。
 */
export class AnnotationMargin implements PluginValue {
	private layer: HTMLElement;

	private path: string | null = null;

	private editing: string | null = null;

	private cards = new Map<string, HTMLElement>();

	private destroyed = false;

	constructor(
		readonly view: EditorView,
		private manager: AnnotationManager,
	) {
		this.layer = view.scrollDOM.createDiv({ cls: 'nd-anno-layer' });

		// 卡片里的点击不交给 CodeMirror 处理
		this.layer.addEventListener('mousedown', (event) => event.stopPropagation());

		manager.margins.add(this);
		this.reloadSoon();
	}

	get info(): MarkdownFileInfo | null {
		return this.view.state.field(editorInfoField, false) ?? null;
	}

	get filePath(): string | null {
		return this.info?.file?.path ?? null;
	}

	/**
	 * 只在文档标签页的主编辑器里显示批注
	 *
	 * 脚注面板、悬浮预览等也会为同一个文件创建编辑器，但内容只是片段，不能挂批注
	 */
	private get isMainEditor(): boolean {
		const info = this.info;

		return info instanceof MarkdownView && info.contentEl.contains(this.view.dom);
	}

	private get isActiveFile(): boolean {
		return (
			this.path !== null && this.isMainEditor && this.manager.isTracked(this.path)
		);
	}

	/* ---------- 生命周期 ---------- */

	update(update: ViewUpdate) {
		if (this.filePath !== this.path) {
			this.reloadSoon();

			return;
		}

		if (!this.isActiveFile) {
			return;
		}

		if (update.docChanged) {
			// 没有 userEvent 的修改：Obsidian 载入/外部改动文件，重新定位
			const external = update.transactions.every(
				(tr) => !tr.docChanged || !tr.annotation(Transaction.userEvent),
			);

			if (external) {
				this.reloadSoon();

				return;
			}

			this.manager.requestSync(this);
		}

		this.updateActiveClass();
		this.schedulePosition();
	}

	destroy() {
		this.destroyed = true;
		this.layer.remove();
		this.view.scrollDOM.removeClass('nd-anno-visible');
		this.manager.margins.delete(this);
	}

	reloadSoon() {
		window.setTimeout(() => {
			if (!this.destroyed) {
				this.reload();
			}
		}, 0);
	}

	/**
	 * 打开文档 / 切换文件：把保存的批注定位到当前正文
	 */
	reload() {
		this.path = this.filePath;

		if (!this.isActiveFile || !this.path) {
			this.cards.clear();
			this.layer.empty();

			if (getAnnotationRanges(this.view.state).length > 0) {
				this.view.dispatch({ effects: setAnnotationsEffect.of([]) });
			}

			this.applyVisibility();

			return;
		}

		const doc = this.view.state.doc.toString();

		// 编辑器里已有的位置（随编辑映射过）优先，其次按原文重新查找
		const current = new Map(
			getAnnotationRanges(this.view.state).map((range) => [range.id, range]),
		);

		const ranges: AnnotationRange[] = [];

		for (const annotation of this.manager.store.list(this.path)) {
			const known = current.get(annotation.id);

			const range =
				known && known.to > known.from ? known : resolveAnchor(doc, annotation);

			if (range) {
				ranges.push({ id: annotation.id, from: range.from, to: range.to });
			}
		}

		this.view.dispatch({ effects: setAnnotationsEffect.of(ranges) });
		this.renderCards();
	}

	/**
	 * 把编辑器里的最新位置写回数据
	 */
	sync() {
		if (!this.isActiveFile || !this.path) {
			return;
		}

		const ranges = new Map(
			getAnnotationRanges(this.view.state).map((range) => [range.id, range]),
		);

		this.manager.store.syncRanges(this.path, this.view.state.doc.toString(), ranges);
	}

	/* ---------- 增删改 ---------- */

	addAnnotation(from: number, to: number) {
		if (!this.isActiveFile || !this.path || to <= from) {
			return;
		}

		const annotation = this.manager.store.add(
			this.path,
			this.view.state.doc.toString(),
			from,
			to,
		);

		this.view.dispatch({
			effects: [
				addAnnotationEffect.of({ id: annotation.id, from, to }),
				activeAnnotationEffect.of(annotation.id),
			],
		});

		this.manager.ensureVisible();
		this.startEditing(annotation.id);
	}

	private removeAnnotation(id: string) {
		if (!this.path) {
			return;
		}

		this.manager.store.remove(this.path, id);

		if (this.editing === id) {
			this.editing = null;
		}

		this.view.dispatch({ effects: removeAnnotationEffect.of(id) });
		this.renderCards();
	}

	private startEditing(id: string) {
		this.editing = id;
		this.renderCards();

		const textarea = this.cards.get(id)?.querySelector('textarea');

		textarea?.focus();
	}

	/**
	 * 点击正文里的高亮：选中对应卡片；点别处：取消选中
	 */
	onEditorClick(event: MouseEvent) {
		const target = event.target;
		const mark =
			target instanceof HTMLElement
				? target.closest<HTMLElement>('[data-nd-anno]')
				: null;

		this.activate(mark?.getAttribute('data-nd-anno') ?? null);
	}

	activate(id: string | null) {
		if (getActiveAnnotation(this.view.state) === id) {
			return;
		}

		this.view.dispatch({ effects: activeAnnotationEffect.of(id) });
	}

	/* ---------- 渲染 ---------- */

	applyVisibility() {
		const visible =
			this.manager.isVisible() &&
			this.isActiveFile &&
			this.path !== null &&
			this.manager.store.list(this.path).length > 0;

		this.view.scrollDOM.toggleClass('nd-anno-visible', visible);
		this.layer.toggle(visible);

		if (visible) {
			this.schedulePosition();
		}
	}

	renderCards() {
		this.layer.empty();
		this.cards.clear();

		if (!this.path) {
			return;
		}

		for (const annotation of this.manager.store.list(this.path)) {
			this.cards.set(annotation.id, this.renderCard(annotation));
		}

		this.applyVisibility();
		this.updateActiveClass();
	}

	private renderCard(annotation: Annotation): HTMLElement {
		const card = this.layer.createDiv({ cls: 'nd-anno-card' });

		card.addEventListener('click', () => {
			// 正在拖选文字复制时不切换选中状态
			if (!card.doc.getSelection()?.isCollapsed) {
				return;
			}

			this.activate(annotation.id);
		});

		const quote = card.createDiv({ cls: 'nd-anno-quote' });

		quote.createSpan({ cls: 'nd-anno-orphan', text: t('annoOrphan') });
		quote.createSpan({ text: truncate(annotation.quote, 40) });

		if (this.editing === annotation.id) {
			this.renderEditor(card, annotation);
		} else {
			card.createDiv({
				cls: annotation.text ? 'nd-anno-text' : 'nd-anno-text is-empty',
				text: annotation.text || t('annoPlaceholder'),
			});
		}

		const footer = card.createDiv({ cls: 'nd-anno-footer' });

		footer.createSpan({ cls: 'nd-anno-time', text: formatTime(annotation.updated) });

		const actions = footer.createDiv({ cls: 'nd-anno-actions' });

		const action = (icon: string, label: string, onClick: () => void) => {
			const button = actions.createEl('button', {
				cls: 'clickable-icon',
				attr: { 'aria-label': label },
			});

			setIcon(button, icon);
			button.addEventListener('click', (event) => {
				event.stopPropagation();
				onClick();
			});
		};

		if (this.editing !== annotation.id) {
			action('pencil', t('annoEdit'), () => this.startEditing(annotation.id));
		}

		action('trash-2', t('annoDelete'), () => this.removeAnnotation(annotation.id));

		return card;
	}

	private renderEditor(card: HTMLElement, annotation: Annotation) {
		const textarea = card.createEl('textarea', {
			cls: 'nd-anno-input',
			attr: { rows: '3', placeholder: t('annoPlaceholder') },
		});

		textarea.value = annotation.text;

		let finished = false;

		const finish = (save: boolean) => {
			if (finished) {
				return;
			}

			finished = true;

			const text = textarea.value.trim();
			const path = this.path;

			this.editing = null;

			if (!path) {
				return;
			}

			if (save && text) {
				this.manager.store.setText(path, annotation.id, text);
			}

			// 没写内容的批注直接丢弃
			if (!(save ? text : annotation.text)) {
				this.removeAnnotation(annotation.id);

				return;
			}

			this.renderCards();
		};

		const autosize = () => {
			textarea.setCssStyles({ height: 'auto' });
			textarea.setCssStyles({ height: `${textarea.scrollHeight}px` });
			this.schedulePosition();
		};

		textarea.addEventListener('input', autosize);
		textarea.addEventListener('blur', () => finish(true));
		textarea.addEventListener('keydown', (event) => {
			// 不触发 Obsidian 的全局快捷键
			event.stopPropagation();

			if (event.key === 'Escape') {
				event.preventDefault();
				finish(false);
			} else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
				event.preventDefault();
				finish(true);
			}
		});

		window.setTimeout(autosize, 0);
	}

	private updateActiveClass() {
		const active = getActiveAnnotation(this.view.state);

		for (const [id, card] of this.cards) {
			card.toggleClass('is-active', id === active);
		}
	}

	/**
	 * 卡片对齐到被批注文字所在行，重叠时往下推
	 */
	schedulePosition() {
		if (this.cards.size === 0 || !this.path) {
			return;
		}

		const path = this.path;

		this.view.requestMeasure({
			key: this,
			read: (view) => {
				const ranges = new Map(
					getAnnotationRanges(view.state).map((range) => [range.id, range]),
				);
				const scrollRect = view.scrollDOM.getBoundingClientRect();
				const base = view.documentTop - scrollRect.top + view.scrollDOM.scrollTop;
				const docLength = view.state.doc.length;

				return [...this.cards].map(([id, el]) => {
					const range = ranges.get(id);
					const fallback = this.manager.store.get(path, id)?.from ?? 0;
					const pos = Math.min(range ? range.from : fallback, docLength);

					return {
						el,
						top: base + view.lineBlockAt(pos).top,
						height: el.offsetHeight,
						orphan: !range,
					};
				});
			},
			write: (items) => {
				items.sort((a, b) => a.top - b.top);

				let bottom = -Infinity;

				for (const item of items) {
					const top = Math.max(item.top, bottom + CARD_GAP);

					item.el.setCssStyles({ top: `${top}px` });
					item.el.toggleClass('is-orphan', item.orphan);
					bottom = top + item.height;
				}
			},
		});
	}
}
