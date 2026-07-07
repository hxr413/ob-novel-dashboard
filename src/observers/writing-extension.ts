import { EditorView, ViewUpdate } from '@codemirror/view';

import NovelDashboardPlugin from '../main';

export function createWritingExtension(plugin: NovelDashboardPlugin) {
	return EditorView.updateListener.of((update: ViewUpdate) => {
		plugin.writingSession.handleUpdate(update);
	});
}
