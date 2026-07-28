import { App } from 'obsidian';
import { NovelDashboardData } from '../core/saved-data';
import { ViewUpdate } from '@codemirror/view';
import { Transaction } from '@codemirror/state';

export class WritingSession {
	app: App;

	data: NovelDashboardData;

	timer: number | null = null;

	lastTypingTime = 0;

	private ignoreExternalInputUntil = 0;

	private isComposing = false;

	/**
	 * 请求保存
	 *
	 * 由 main.ts 提供 debounce save
	 */
	onSaveRequested?: () => void;

	onStatsChanged?: () => void;

	constructor(app: App, data: NovelDashboardData) {
		this.app = app;

		this.data = data;
	}

	start() {
		console.log('Writing session started');
	}

	stop() {
		if (this.timer) {
			window.clearInterval(this.timer);

			this.timer = null;
		}
	}

	ignoreNextInputChange() {
		this.ignoreExternalInputUntil = Date.now() + 1000;
	}

	beginComposition() {
		this.isComposing = true;
	}

	endComposition() {
		window.setTimeout(() => {
			this.isComposing = false;
		}, 0);
	}

	/**
	 * CodeMirror 输入事件
	 *
	 * 只统计真实输入
	 */
	handleUpdate(update: ViewUpdate) {
		if (!update.docChanged) {
			return;
		}

		if (
			(this.isComposing || update.view.composing) &&
			!this.hasInsertedCjk(update)
		) {
			return;
		}

		const userEvents = update.transactions
			.map((transaction) =>
				transaction.annotation(Transaction.userEvent),
			)
			.filter((event): event is string => Boolean(event));

		console.log('Writing event:', userEvents);

		/*
			忽略：

			paste
			delete
			undo
			redo
		*/

		if (
			userEvents.some(
				(userEvent) =>
					userEvent.startsWith('delete') ||
					userEvent.startsWith('input.paste') ||
					userEvent.startsWith('input.drop') ||
					userEvent.startsWith('undo') ||
					userEvent.startsWith('redo'),
			)
		) {
			return;
		}

		if (userEvents.length === 0 && Date.now() < this.ignoreExternalInputUntil) {
			return;
		}

		/*
			只接受真实输入

			input.type
			input.compose
			input
		*/

		const isWritingInput =
			userEvents.length === 0 ||
			userEvents.some(
				(userEvent) =>
					userEvent === 'input' ||
					userEvent.startsWith('input.type') ||
					userEvent.startsWith('input.compose'),
			);

		if (!isWritingInput) {
			return;
		}

		const count = this.countInsertedWords(update);

		if (count <= 0) {
			return;
		}

		this.addWritingWords(count);
	}

	private countInsertedWords(update: ViewUpdate): number {
		let count = 0;

		update.changes.iterChanges((_fromA, _toA, fromB, _toB, insert) => {
			const insertedText = insert.toString();

			for (let offset = 0; offset < insertedText.length; offset++) {
				const char = insertedText[offset] ?? '';
				const absolutePosition = fromB + offset;

				if (this.isCjk(char)) {
					count += 1;

					continue;
				}

				if (!this.isAsciiWordChar(char)) {
					continue;
				}

				const previousChar =
					absolutePosition > 0
						? update.state.sliceDoc(
								absolutePosition - 1,
								absolutePosition,
							)
						: '';

				if (!this.isAsciiWordChar(previousChar)) {
					count += 1;
				}
			}
		});

		return count;
	}

	private hasInsertedCjk(update: ViewUpdate): boolean {
		let hasCjk = false;

		update.changes.iterChanges((_fromA, _toA, _fromB, _toB, insert) => {
			if (this.isCjk(insert.toString())) {
				hasCjk = true;
			}
		});

		return hasCjk;
	}

	private isCjk(char: string): boolean {
		return /[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(
			char,
		);
	}

	private isAsciiWordChar(char: string): boolean {
		return /[A-Za-z0-9_]/.test(char);
	}

	/**
	 * 每日写作统计
	 *
	 * 只增加
	 *
	 * 删除/paste忽略
	 */
	addWritingWords(count: number) {
		if (count <= 0) {
			return;
		}

		const today = this.getToday();

		if (!this.data.dailyStats[today]) {
			this.data.dailyStats[today] = {
				words: 0,

				duration: 0,
			};
		}

		this.data.dailyStats[today]!.words += count;

		this.lastTypingTime = Date.now();

		this.startTimer();

		console.log('Writing added:', count);

		this.onStatsChanged?.();

		/*
			触发 debounce 保存

			main.ts:
			requestSave()
		*/

		this.onSaveRequested?.();
	}

	startTimer() {
		if (this.timer) {
			return;
		}

		this.timer = window.setInterval(() => {
			if (Date.now() - this.lastTypingTime < 30000) {
				const today = this.getToday();

				const stat = this.data.dailyStats[today];

				if (stat) {
					stat.duration += 1;

					this.onStatsChanged?.();
				}
			}
		}, 1000);
	}

	getToday() {
		const date = new Date();

		return [
			date.getFullYear(),

			String(date.getMonth() + 1).padStart(2, '0'),

			String(date.getDate()).padStart(2, '0'),
		].join('-');
	}
}
