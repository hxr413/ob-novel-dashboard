import { EditorView, ViewUpdate } from '@codemirror/view';

import NovelDashboardPlugin from '../main';

export function createWritingExtension(plugin: NovelDashboardPlugin) {
	return [
		EditorView.domEventHandlers({
			paste: () => {
				plugin.writingSession.ignoreNextInputChange();
			},
			drop: () => {
				plugin.writingSession.ignoreNextInputChange();
			},
			compositionstart: () => {
				plugin.writingSession.beginComposition();
			},
			compositionend: () => {
				plugin.writingSession.endComposition();
			},
		}),
		EditorView.updateListener.of((update: ViewUpdate) => {
			plugin.writingSession.handleUpdate(update);
		}),
	];
}
