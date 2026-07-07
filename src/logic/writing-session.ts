import { App } from 'obsidian';
import { TextCounter } from '../utils/text-counter';
import { NovelDashboardData } from './saved-data';
import { ViewUpdate } from '@codemirror/view';
import { Transaction } from '@codemirror/state';

export class WritingSession {
	app: App;

	data: NovelDashboardData;

	timer: number | null = null;

	lastTypingTime = 0;

	/**
	 * 请求保存
	 *
	 * 由 main.ts 提供 debounce save
	 */
	onSaveRequested?: () => void;

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

	/**
	 * CodeMirror 输入事件
	 *
	 * 只统计真实输入
	 */
	handleUpdate(update: ViewUpdate) {
		if (!update.docChanged) {
			return;
		}

		const transaction = update.transactions[0];

		const userEvent = transaction.annotation(Transaction.userEvent);

		console.log('Writing event:', userEvent);

		/*
			忽略：

			paste
			delete
			undo
			redo
		*/

		if (
			!userEvent ||
			userEvent.startsWith('delete') ||
			userEvent.startsWith('input.paste') ||
			userEvent.startsWith('undo') ||
			userEvent.startsWith('redo')
		) {
			return;
		}

		/*
			只接受真实输入

			input.type
			input.compose
		*/

		if (userEvent !== 'input.type' && userEvent !== 'input.compose') {
			return;
		}

		let insertedText = '';

		update.changes.iterChanges((_fromA, _fromB, _fromC, _fromD, insert) => {
			insertedText += insert.toString();
		});

		if (!insertedText) {
			return;
		}

		const count = TextCounter.count(insertedText);

		if (count <= 0) {
			return;
		}

		this.addWritingWords(count);
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
