/**
 * 轻量悬浮提示
 *
 * 统计图里的格子很小，依赖 Obsidian 全局 aria-label 提示不稳定，
 * 这里用事件委托 + 一个 fixed 定位的提示框自己实现。
 *
 * 用法：给格子加 data-nd-tip="文字"，再对容器调用 attachHoverTips(container)
 */

const TIP_ATTR = 'data-nd-tip';

let tipEl: HTMLElement | null = null;

function findTarget(event: Event, container: HTMLElement): HTMLElement | null {
	const target = event.target;

	if (!(target instanceof HTMLElement)) {
		return null;
	}

	const el = target.closest<HTMLElement>(`[${TIP_ATTR}]`);

	return el && container.contains(el) ? el : null;
}

function show(target: HTMLElement) {
	const text = target.getAttribute(TIP_ATTR);

	if (!text) {
		return;
	}

	const doc = target.doc;

	if (!tipEl || tipEl.doc !== doc) {
		tipEl?.remove();
		tipEl = doc.body.createDiv({ cls: 'nd-tooltip' });
	}

	const rect = target.getBoundingClientRect();

	tipEl.setText(text);
	tipEl.setCssStyles({
		left: `${rect.left + rect.width / 2}px`,
		top: `${rect.top - 6}px`,
	});
}

export function hideHoverTip() {
	tipEl?.remove();
	tipEl = null;
}

export function setHoverTip(el: HTMLElement, text: string) {
	el.setAttribute(TIP_ATTR, text);
}

export function attachHoverTips(container: HTMLElement) {
	container.addEventListener('mouseover', (event) => {
		const target = findTarget(event, container);

		if (target) {
			show(target);
		}
	});

	container.addEventListener('mouseout', (event) => {
		const target = findTarget(event, container);
		const related = event.relatedTarget;

		if (target && related instanceof Node && target.contains(related)) {
			return;
		}

		hideHoverTip();
	});
}
