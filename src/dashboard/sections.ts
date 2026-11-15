import { setIcon } from 'obsidian';

import { t } from '../i18n';
import type NovelDashboardPlugin from '../main';
import { openOrRevealFile } from '../ui/open-file';
import { baseName } from '../utils/paths';
import type { DashboardSummary } from './dashboard-data';

/**
 * 侧边栏和主页共用的界面片段
 */

export interface CardRefs {
	total: HTMLElement;
	net: HTMLElement;
	typed: HTMLElement;
	duration: HTMLElement;
}

export function formatDuration(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);

	return h > 0 ? t('durationHM', { h, m }) : t('durationM', { m });
}

export function formatSigned(value: number): string {
	return value > 0 ? `+${value}` : String(value);
}

export function renderHeader(
	parent: HTMLElement,
	title: string | null,
	summary: DashboardSummary,
	onEdit: () => void,
) {
	const header = parent.createDiv({ cls: 'nd-header' });

	// 主页文档本身有标题，不再重复
	if (title) {
		header.createEl('h2', { cls: 'nd-title', text: title });
	}

	// 编辑入口放在起始日期这一行，避免和代码块右上角的按钮重叠
	const meta = header.createDiv({ cls: 'nd-start-date' });

	meta.createSpan({
		text: t('startedOn', {
			date: summary.startDate,
			days: summary.dayNumber,
		}),
	});

	const edit = meta.createEl('a', {
		cls: 'nd-edit-link',
		attr: { href: '#', 'aria-label': t('cmdEditRecords') },
	});

	setIcon(edit.createSpan({ cls: 'nd-edit-icon' }), 'pencil');

	edit.addEventListener('click', (event) => {
		event.preventDefault();
		onEdit();
	});
}

export function renderCards(
	parent: HTMLElement,
	summary: DashboardSummary,
): CardRefs {
	const grid = parent.createDiv({ cls: 'nd-cards' });

	const card = (label: string, extraCls = '') => {
		const el = grid.createDiv({ cls: `nd-card ${extraCls}`.trim() });
		const value = el.createDiv({ cls: 'nd-card-value' });

		el.createDiv({ cls: 'nd-card-label', text: label });

		return value;
	};

	const refs: CardRefs = {
		net: card(t('todayNet'), 'is-primary'),
		typed: card(t('todayTyped')),
		duration: card(t('todayDuration')),
		total: card(t('totalWords')),
	};

	updateCards(refs, summary);

	return refs;
}

export function updateCards(refs: CardRefs, summary: DashboardSummary) {
	refs.total.setText(String(summary.totalWords));
	refs.net.setText(formatSigned(summary.todayNet));
	refs.typed.setText(String(summary.todayTyped));
	refs.duration.setText(formatDuration(summary.todayDuration));
}

export function renderRecent(
	parent: HTMLElement,
	plugin: NovelDashboardPlugin,
	summary: DashboardSummary,
) {
	const list = renderPanel(parent, t('recentWriting')).body;

	list.addClass('nd-recent');

	if (summary.recentFiles.length === 0) {
		list.createDiv({ cls: 'nd-empty', text: t('noRecent') });

		return;
	}

	for (const file of summary.recentFiles) {
		const item = list.createDiv({ cls: 'nd-recent-item' });

		item.createSpan({ cls: 'nd-recent-name', text: baseName(file.path) });

		const count = plugin.data.documentCounts[file.path];

		if (count !== undefined) {
			item.createSpan({ cls: 'nd-recent-count', text: String(count) });
		}

		item.addEventListener('click', () => {
			void openOrRevealFile(plugin.app, file.path);
		});
	}
}

export interface Panel {
	el: HTMLElement;
	/** 标题右侧：摘要或翻页按钮 */
	aside: HTMLElement;
	body: HTMLElement;
}

/**
 * 统一的区块：标题 + 右侧控件 + 内容
 */
export function renderPanel(parent: HTMLElement, title: string): Panel {
	const el = parent.createDiv({ cls: 'nd-panel' });
	const header = el.createDiv({ cls: 'nd-panel-header' });

	header.createDiv({ cls: 'nd-panel-title', text: title });

	const aside = header.createDiv({ cls: 'nd-panel-aside' });
	const body = el.createDiv({ cls: 'nd-panel-body' });

	return { el, aside, body };
}

/**
 * ‹ 标签 › 翻页控件
 */
export function renderPager(
	parent: HTMLElement,
	label: string,
	options: {
		canPrev: boolean;
		canNext: boolean;
		onPrev: () => void;
		onNext: () => void;
		prevLabel: string;
		nextLabel: string;
		/** 点击中间标签：打开年月选择框 */
		onLabelClick?: (labelEl: HTMLElement) => void;
	},
) {
	const pager = parent.createDiv({ cls: 'nd-pager' });

	const bind = (el: HTMLElement, onClick: () => void) => {
		// 不抢焦点，避免编辑器 / 页面滚动
		el.addEventListener('mousedown', (event) => event.preventDefault());
		el.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			onClick();
		});
	};

	const button = (icon: string, aria: string, enabled: boolean, onClick: () => void) => {
		const el = pager.createEl('button', {
			cls: 'clickable-icon nd-pager-button',
			attr: { 'aria-label': aria },
		});

		setIcon(el, icon);
		el.toggleClass('is-disabled', !enabled);
		bind(el, onClick);
	};

	button('chevron-left', options.prevLabel, options.canPrev, options.onPrev);

	const labelEl = pager.createDiv({ cls: 'nd-pager-label', text: label });
	const onLabelClick = options.onLabelClick;

	if (onLabelClick) {
		bind(labelEl, () => onLabelClick(labelEl));
	}

	button('chevron-right', options.nextLabel, options.canNext, options.onNext);
}

/**
 * 先在离屏节点里构建，再一次性替换内容
 *
 * 直接 empty() 再重建会让高度瞬间塌陷，滚动位置被重置（页面跳回顶部）
 */
export function swapContent(target: HTMLElement, build: (el: HTMLElement) => void) {
	const next = createDiv();

	build(next);
	target.replaceChildren(...Array.from(next.childNodes));
}

/**
 * 写作强度 0-4
 */
export function heatLevel(words: number, max: number): number {
	if (words <= 0) {
		return 0;
	}

	const ratio = words / max;

	return ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4;
}
