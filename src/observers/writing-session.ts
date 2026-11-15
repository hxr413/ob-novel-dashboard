import { editorInfoField } from 'obsidian';
import { Transaction } from '@codemirror/state';
import type { ViewUpdate } from '@codemirror/view';

import type { WordTracker } from '../analytics/word-tracker';
import type { VaultLayout } from '../core/vault-layout';

const CJK = /[㐀-䶿一-鿿぀-ヿ가-힯]/;
const WORD_CHAR = /[A-Za-z0-9_]/;

/** 停止输入多久后不再计时 */
const IDLE_MS = 30000;

/**
 * 输入量与写作时长
 *
 * 只统计写作文件夹内、当前获得焦点的编辑器里的真实键盘输入：
 * 删除、粘贴、拖放、撤销、重做都不计入。
 */
export class WritingSession {
	private lastTypingTime = 0;

	private ignoreExternalInputUntil = 0;

	private isComposing = false;

	/** 输入量变化 */
	onTyped?: () => void;

	/** 每秒计时 */
	onTick?: () => void;

	constructor(
		private tracker: WordTracker,
		private layout: VaultLayout,
	) {}

	/**
	 * 由 main.ts 用 registerInterval 每秒调用
	 */
	tick() {
		if (Date.now() - this.lastTypingTime >= IDLE_MS) {
			return;
		}

		const stat = this.tracker.getDayStat(this.tracker.ensureDay());

		stat.duration += 1;

		this.onTick?.();
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

	handleUpdate(update: ViewUpdate) {
		if (!update.docChanged || !update.view.hasFocus) {
			return;
		}

		const path = update.state.field(editorInfoField, false)?.file?.path;

		if (!path || !this.layout.isTrackedFile(path)) {
			return;
		}

		if (
			(this.isComposing || update.view.composing) &&
			!this.hasInsertedCjk(update)
		) {
			return;
		}

		const userEvents = update.transactions
			.map((transaction) => transaction.annotation(Transaction.userEvent))
			.filter((event): event is string => Boolean(event));

		const isIgnored = userEvents.some(
			(event) =>
				event.startsWith('delete') ||
				event.startsWith('input.paste') ||
				event.startsWith('input.drop') ||
				event.startsWith('undo') ||
				event.startsWith('redo'),
		);

		if (isIgnored) {
			return;
		}

		if (userEvents.length === 0 && Date.now() < this.ignoreExternalInputUntil) {
			return;
		}

		const isWritingInput =
			userEvents.length === 0 ||
			userEvents.some(
				(event) =>
					event === 'input' ||
					event.startsWith('input.type') ||
					event.startsWith('input.compose'),
			);

		if (!isWritingInput) {
			return;
		}

		const count = this.countInsertedWords(update);

		if (count <= 0) {
			return;
		}

		const stat = this.tracker.getDayStat(this.tracker.ensureDay());

		stat.typed += count;

		this.lastTypingTime = Date.now();

		this.onTyped?.();
	}

	/**
	 * 中文按字计；英文/数字只在新单词开头计 1
	 */
	private countInsertedWords(update: ViewUpdate): number {
		let count = 0;

		update.changes.iterChanges((_fromA, _toA, fromB, _toB, insert) => {
			const text = insert.toString();

			for (let offset = 0; offset < text.length; offset++) {
				const char = text[offset] ?? '';

				if (CJK.test(char)) {
					count += 1;
					continue;
				}

				if (!WORD_CHAR.test(char)) {
					continue;
				}

				const position = fromB + offset;

				const previous =
					position > 0
						? update.state.sliceDoc(position - 1, position)
						: '';

				if (!WORD_CHAR.test(previous)) {
					count += 1;
				}
			}
		});

		return count;
	}

	private hasInsertedCjk(update: ViewUpdate): boolean {
		let hasCjk = false;

		update.changes.iterChanges((_fromA, _toA, _fromB, _toB, insert) => {
			if (CJK.test(insert.toString())) {
				hasCjk = true;
			}
		});

		return hasCjk;
	}
}
