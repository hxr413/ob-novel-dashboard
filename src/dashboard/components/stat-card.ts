export class StatCard {
	/**
	 * 创建一个数字卡片
	 *
	 * 示例：
	 *
	 * 120000
	 * Total Words
	 *
	 */

	static create(parent: HTMLElement, value: string, label: string) {
		const card = parent.createDiv({
			cls: 'novel-dashboard-card',
		});

		card.createEl('div', {
			cls: 'novel-dashboard-card-value',
			text: value,
		});

		card.createEl('div', {
			cls: 'novel-dashboard-card-label',
			text: label,
		});

		return card;
	}
}
