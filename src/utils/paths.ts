import { normalizePath } from 'obsidian';

/**
 * 统一路径格式：去掉首尾斜杠，空字符串保持为空
 */
export function cleanPath(path: string): string {
	const trimmed = path.trim().replace(/^\/+|\/+$/g, '');

	return trimmed ? normalizePath(trimmed) : '';
}

/**
 * path 是否等于 root 或位于 root 之下
 */
export function isSameOrUnder(path: string, root: string): boolean {
	if (!root) {
		return false;
	}

	return path === root || path.startsWith(root + '/');
}

export function parentPath(path: string): string {
	const index = path.lastIndexOf('/');

	return index === -1 ? '' : path.slice(0, index);
}

/**
 * 包括自身在内的所有上级目录
 *
 * a/b/c.md -> [a/b, a]
 */
export function ancestorFolders(path: string): string[] {
	const result: string[] = [];

	let current = parentPath(path);

	while (current) {
		result.push(current);
		current = parentPath(current);
	}

	return result;
}

export function baseName(path: string): string {
	return (path.split('/').pop() ?? path).replace(/\.md$/i, '');
}
