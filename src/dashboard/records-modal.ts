import { App, Modal, Notice, Setting } from 'obsidian';

import type { DailyStat } from '../core/saved-data';
import { t } from '../i18n';
import type NovelDashboardPlugin from '../main';
import { isDateKey, todayKey } from '../utils/date';
import { formatDuration } from './sections';

type RecordInput = Omit<DailyStat, 'adjust'>;

/**
 * 手动修改 / 导入写作记录
 */
export class RecordsModal extends Modal {
	private form = { date: todayKey(), words: 0, typed: 0, minutes: 0 };

	constructor(
		app: App,
		private plugin: NovelDashboardPlugin,
	) {
		super(app);
	}

	onOpen() {
		this.setTitle(t('recordsTitle'));
		this.loadForm(todayKey());
		this.render();
	}

	onClose() {
		this.contentEl.empty();
	}

	private loadForm(date: string) {
		const stat = this.plugin.data.dailyStats[date];

		this.form = {
			date,
			words: stat?.words ?? 0,
			typed: stat?.typed ?? 0,
			minutes: Math.round((stat?.duration ?? 0) / 60),
		};
	}

	private render() {
		const { contentEl } = this;

		contentEl.empty();
		contentEl.addClass('nd-records');

		new Setting(contentEl)
			.setName(t('recordsStartDate'))
			.setDesc(t('recordsStartDateDesc'))
			.addText((text) => {
				text.inputEl.type = 'date';
				text.setValue(this.plugin.data.startDate).onChange((value) => {
					if (isDateKey(value)) {
						this.plugin.data.startDate = value;
						this.plugin.onDataChanged(true);
					}
				});
			});

		new Setting(contentEl).setName(t('recordsEditHeading')).setHeading();

		new Setting(contentEl).setName(t('recordsDate')).addText((text) => {
			text.inputEl.type = 'date';
			text.setValue(this.form.date).onChange((value) => {
				if (isDateKey(value)) {
					this.loadForm(value);
					this.render();
				}
			});
		});

		this.numberField(t('recordsNet'), this.form.words, (value) => {
			this.form.words = value;
		});

		this.numberField(t('recordsTyped'), this.form.typed, (value) => {
			this.form.typed = Math.max(0, value);
		});

		this.numberField(t('recordsMinutes'), this.form.minutes, (value) => {
			this.form.minutes = Math.max(0, value);
		});

		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText(t('recordsSave'))
				.setCta()
				.onClick(() => {
					if (!isDateKey(this.form.date)) {
						new Notice(t('recordsInvalidDate'));

						return;
					}

					this.plugin.tracker.setRecord(this.form.date, {
						words: this.form.words,
						typed: this.form.typed,
						duration: this.form.minutes * 60,
					});

					this.plugin.onDataChanged(true);
					this.render();
				}),
		);

		this.renderList(contentEl);
		this.renderImport(contentEl);
	}

	private numberField(
		name: string,
		value: number,
		onChange: (value: number) => void,
	) {
		new Setting(this.contentEl).setName(name).addText((text) => {
			text.inputEl.type = 'number';
			text.setValue(String(value)).onChange((raw) => {
				const parsed = Number(raw);

				if (Number.isFinite(parsed)) {
					onChange(Math.round(parsed));
				}
			});
		});
	}

	private renderList(parent: HTMLElement) {
		const dates = Object.keys(this.plugin.data.dailyStats).sort().reverse();

		const list = parent.createDiv({ cls: 'nd-records-list' });

		if (dates.length === 0) {
			list.createDiv({ cls: 'nd-empty', text: t('recordsEmpty') });

			return;
		}

		const table = list.createEl('table', { cls: 'nd-table' });
		const header = table.createEl('thead').createEl('tr');

		header.createEl('th', { text: t('colDate') });
		header.createEl('th', { text: t('colNet') });
		header.createEl('th', { text: t('colTyped') });
		header.createEl('th', { text: t('colDuration') });
		header.createEl('th');

		const body = table.createEl('tbody');

		for (const date of dates) {
			const stat = this.plugin.data.dailyStats[date];

			if (!stat) {
				continue;
			}

			const row = body.createEl('tr');

			row.createEl('td', { text: date });
			row.createEl('td', { text: String(stat.words) });
			row.createEl('td', { text: String(stat.typed) });
			row.createEl('td', { text: formatDuration(stat.duration) });

			const actions = row.createEl('td', { cls: 'nd-records-actions' });

			actions
				.createEl('button', { text: t('recordsEdit') })
				.addEventListener('click', () => {
					this.loadForm(date);
					this.render();
				});

			actions
				.createEl('button', { cls: 'mod-warning', text: t('recordsDelete') })
				.addEventListener('click', () => {
					this.plugin.tracker.deleteRecord(date);
					this.plugin.onDataChanged(true);
					this.render();
				});
		}
	}

	private renderImport(parent: HTMLElement) {
		new Setting(parent)
			.setName(t('recordsImportHeading'))
			.setDesc(t('recordsImportDesc'))
			.setHeading();

		const textarea = parent.createEl('textarea', {
			cls: 'nd-records-import',
			attr: { rows: '6', placeholder: '2026-11-01,3200,3500,90' },
		});

		new Setting(parent)
			.addButton((button) =>
				button.setButtonText(t('recordsExport')).onClick(async () => {
					await navigator.clipboard.writeText(
						JSON.stringify(this.plugin.data.dailyStats, null, 2),
					);
					new Notice(t('recordsCopied'));
				}),
			)
			.addButton((button) =>
				button
					.setButtonText(t('recordsImport'))
					.setCta()
					.onClick(() => {
						const records = parseRecords(textarea.value);
						const dates = Object.keys(records);

						if (dates.length === 0) {
							new Notice(t('recordsImportFailed'));

							return;
						}

						for (const date of dates) {
							const record = records[date];

							if (record) {
								this.plugin.tracker.setRecord(date, record);
							}
						}

						this.plugin.onDataChanged(true);
						new Notice(t('recordsImported', { n: dates.length }));
						this.render();
					}),
			);
	}
}

/**
 * 支持：
 * - JSON 对象 { "2026-11-01": { words, typed, duration } } 或 { "2026-11-01": 3200 }
 * - JSON 数组 [{ date, words, typed, duration }]
 * - CSV：日期,净增[,输入[,分钟]]
 */
export function parseRecords(input: string): Record<string, RecordInput> {
	const text = input.trim();
	const result: Record<string, RecordInput> = {};

	if (!text) {
		return result;
	}

	const toRecord = (value: unknown): RecordInput | null => {
		if (typeof value === 'number') {
			return { words: Math.round(value), typed: 0, duration: 0 };
		}

		if (value && typeof value === 'object') {
			const raw = value as Record<string, unknown>;
			const num = (v: unknown) =>
				typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0;

			return {
				words: num(raw.words),
				typed: num(raw.typed),
				duration: num(raw.duration),
			};
		}

		return null;
	};

	if (text.startsWith('{') || text.startsWith('[')) {
		try {
			const parsed: unknown = JSON.parse(text);

			if (Array.isArray(parsed)) {
				for (const item of parsed) {
					const date = (item as Record<string, unknown> | null)?.date;
					const record = toRecord(item);

					if (typeof date === 'string' && isDateKey(date) && record) {
						result[date] = record;
					}
				}
			} else if (parsed && typeof parsed === 'object') {
				for (const [date, value] of Object.entries(parsed)) {
					const record = toRecord(value);

					if (isDateKey(date) && record) {
						result[date] = record;
					}
				}
			}
		} catch {
			return {};
		}

		return result;
	}

	for (const line of text.split(/\r?\n/)) {
		const [date, words, typed, minutes] = line
			.split(/[,，\t]/)
			.map((cell) => cell.trim());

		if (!date || !isDateKey(date)) {
			continue;
		}

		const num = (v: string | undefined) => {
			const parsed = Number(v);

			return Number.isFinite(parsed) ? Math.round(parsed) : 0;
		};

		result[date] = {
			words: num(words),
			typed: num(typed),
			duration: num(minutes) * 60,
		};
	}

	return result;
}
