import { EditorState, Range as CmRange, StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';

/**
 * 编辑器里的批注高亮
 *
 * 位置随编辑自动映射；被批注的文字整段删掉时，标记会自动消失（批注变成「找不到原文」）
 */

export interface AnnotationRange {
	id: string;
	from: number;
	to: number;
}

/** 整体替换（打开文档、切换文件时） */
export const setAnnotationsEffect = StateEffect.define<AnnotationRange[]>();

export const addAnnotationEffect = StateEffect.define<AnnotationRange>();

export const removeAnnotationEffect = StateEffect.define<string>();

/** 当前选中的批注，正文和卡片一起高亮 */
export const activeAnnotationEffect = StateEffect.define<string | null>();

interface FieldValue {
	decorations: DecorationSet;
	active: string | null;
}

function markFor(id: string, active: boolean) {
	return Decoration.mark({
		class: active ? 'nd-anno-mark is-active' : 'nd-anno-mark',
		attributes: { 'data-nd-anno': id },
		id,
		inclusiveStart: false,
		inclusiveEnd: false,
	});
}

function build(ranges: AnnotationRange[], active: string | null, docLength: number) {
	const marks: CmRange<Decoration>[] = [];

	for (const range of ranges) {
		const from = Math.max(0, Math.min(range.from, docLength));
		const to = Math.max(0, Math.min(range.to, docLength));

		if (to > from) {
			marks.push(markFor(range.id, range.id === active).range(from, to));
		}
	}

	return Decoration.set(marks, true);
}

export function readRanges(decorations: DecorationSet): AnnotationRange[] {
	const ranges: AnnotationRange[] = [];
	const cursor = decorations.iter();

	while (cursor.value) {
		const id = (cursor.value.spec as { id?: string }).id;

		if (id) {
			ranges.push({ id, from: cursor.from, to: cursor.to });
		}

		cursor.next();
	}

	return ranges;
}

export const annotationField = StateField.define<FieldValue>({
	create: () => ({ decorations: Decoration.none, active: null }),

	update(value, tr) {
		let decorations = value.decorations.map(tr.changes);
		let active = value.active;
		let ranges: AnnotationRange[] | null = null;

		for (const effect of tr.effects) {
			if (effect.is(setAnnotationsEffect)) {
				ranges = effect.value;
			} else if (effect.is(addAnnotationEffect)) {
				ranges = [...(ranges ?? readRanges(decorations)), effect.value];
			} else if (effect.is(removeAnnotationEffect)) {
				ranges = (ranges ?? readRanges(decorations)).filter(
					(range) => range.id !== effect.value,
				);
			} else if (effect.is(activeAnnotationEffect)) {
				active = effect.value;
				ranges ??= readRanges(decorations);
			}
		}

		if (ranges) {
			decorations = build(ranges, active, tr.state.doc.length);
		}

		return { decorations, active };
	},

	provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

export function getActiveAnnotation(state: EditorState): string | null {
	return state.field(annotationField, false)?.active ?? null;
}

export function getAnnotationRanges(state: EditorState): AnnotationRange[] {
	const value = state.field(annotationField, false);

	return value ? readRanges(value.decorations) : [];
}
