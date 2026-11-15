import { setIcon } from 'obsidian';

import { t } from '../../i18n';

/**
 * 年月选择框：点击翻页标签弹出，选完或点外面关闭
 *
 * - month 模式：顶部切换年份，下面 12 个月
 * - year 模式：列出可选年份
 *
 * 值用 year * 12 + (month - 1) 表示（year 模式下直接是年份）
 */
export interface PeriodPickerOptions {
	mode: 'month' | 'year';
	min: number;
	max: number;
	value: number;
	onPick: (value: number) => void;
}

let openPicker: { el: HTMLElement; close: () => void } | null = null;

export function openPeriodPicker(
	host: HTMLElement,
	anchor: HTMLElement,
	options: PeriodPickerOptions,
) {
	// 同一个标签再点一次：关闭
	if (openPicker) {
		const wasSame = openPicker.el.parentElement === host;

		openPicker.close();

		if (wasSame) {
			return;
		}
	}

	const el = host.createDiv({ cls: 'nd-picker' });
	const doc = host.doc;

	anchor.addClass('is-active');

	const onPointerDown = (event: PointerEvent) => {
		const target = event.target;

		if (target instanceof Node && !el.contains(target) && !anchor.contains(target)) {
			close();
		}
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			close();
		}
	};

	const close = () => {
		el.remove();
		anchor.removeClass('is-active');
		doc.removeEventListener('pointerdown', onPointerDown, true);
		doc.removeEventListener('keydown', onKeyDown, true);
		openPicker = null;
	};

	doc.addEventListener('pointerdown', onPointerDown, true);
	doc.addEventListener('keydown', onKeyDown, true);
	openPicker = { el, close };

	const pick = (value: number) => {
		close();
		options.onPick(value);
	};

	// 选择框里的点击不要冒泡到编辑器
	el.addEventListener('mousedown', (event) => event.preventDefault());
	el.addEventListener('click', (event) => event.stopPropagation());

	if (options.mode === 'year') {
		renderYears(el, options, pick);
	} else {
		let year = Math.floor(options.value / 12);

		const render = () => {
			el.empty();
			renderMonths(el, year, options, pick, (delta) => {
				year += delta;
				render();
			});
		};

		render();
	}
}

/**
 * 视图卸载时调用，避免残留
 */
export function closePeriodPicker() {
	openPicker?.close();
}

function renderYears(
	el: HTMLElement,
	options: PeriodPickerOptions,
	pick: (value: number) => void,
) {
	const grid = el.createDiv({ cls: 'nd-picker-grid' });

	for (let year = options.min; year <= options.max; year++) {
		const item = grid.createDiv({ cls: 'nd-picker-item', text: String(year) });

		item.toggleClass('is-selected', year === options.value);
		item.addEventListener('click', () => pick(year));
	}
}

function renderMonths(
	el: HTMLElement,
	year: number,
	options: PeriodPickerOptions,
	pick: (value: number) => void,
	shiftYear: (delta: number) => void,
) {
	const minYear = Math.floor(options.min / 12);
	const maxYear = Math.floor(options.max / 12);

	const header = el.createDiv({ cls: 'nd-picker-header' });

	const nav = (icon: string, aria: string, enabled: boolean, delta: number) => {
		const button = header.createEl('button', {
			cls: 'clickable-icon nd-pager-button',
			attr: { 'aria-label': aria },
		});

		setIcon(button, icon);
		button.toggleClass('is-disabled', !enabled);
		button.addEventListener('click', () => shiftYear(delta));
	};

	nav('chevron-left', t('prevYear'), year > minYear, -1);
	header.createSpan({ text: String(year) });
	nav('chevron-right', t('nextYear'), year < maxYear, 1);

	const grid = el.createDiv({ cls: 'nd-picker-grid' });
	const names = t('monthNames').split(',');

	for (let month = 0; month < 12; month++) {
		const value = year * 12 + month;
		const item = grid.createDiv({
			cls: 'nd-picker-item',
			text: names[month] ?? String(month + 1),
		});

		item.toggleClass('is-selected', value === options.value);
		item.toggleClass('is-disabled', value < options.min || value > options.max);
		item.addEventListener('click', () => pick(value));
	}
}
