import { App, FileView, TFile } from 'obsidian';

/**
 * 打开文档：如果已经在某个标签页打开，直接切过去；否则新开标签页
 */
export async function openOrRevealFile(app: App, path: string) {
	const file = app.vault.getAbstractFileByPath(path);

	if (!(file instanceof TFile)) {
		return;
	}

	let existing: FileView | null = null;

	app.workspace.iterateAllLeaves((leaf) => {
		if (
			!existing &&
			leaf.view instanceof FileView &&
			leaf.view.file?.path === path
		) {
			existing = leaf.view;
		}
	});

	const found = existing as FileView | null;

	if (found) {
		app.workspace.setActiveLeaf(found.leaf, { focus: true });
		await app.workspace.revealLeaf(found.leaf);

		return;
	}

	await app.workspace.getLeaf('tab').openFile(file);
}
