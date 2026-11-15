/**
 * 出版模式字数统计
 *
 * 规则：
 *
 * 中文（含日文、韩文 CJK）：
 * 一个字符 = 1
 *
 * 英文：
 * 一个连续单词 = 1
 *
 * 数字：
 * 一个连续数字 = 1
 *
 * abc123
 * hello2025
 * 作为一个 token = 1
 *
 * 不统计：
 * 空格
 * 换行
 * Tab
 * 标点
 * Markdown 语法
 */

export class TextCounter {
	/**
	 * 清理 Markdown
	 */
	static cleanMarkdown(text: string): string {
		return (
			text
				// YAML
				.replace(/^---[\s\S]*?---(?=\r?\n|$)/, '')

				// Code block
				.replace(/```[\s\S]*?```/g, '')

				// Inline code
				.replace(/`[^`]*`/g, '')

				// Obsidian comment
				.replace(/%%[\s\S]*?%%/g, '')

				// Heading #
				.replace(/^#{1,6}\s/gm, '')

				// Quote >
				.replace(/^>\s?/gm, '')

				// Horizontal line
				.replace(/^[-*_]{3,}\s*$/gm, '')

				// Task list
				.replace(/^[\s]*[-*+]\s\[[ xX]\]\s/gm, '')

				// Ordered list
				.replace(/^[\s]*\d+\.\s/gm, '')

				// Unordered list
				.replace(/^[\s]*[-*+]\s/gm, '')

				// Table separator
				.replace(
					/^\|?[\s:]*-{3,}[\s:]*(?:\|[\s:]*-{3,}[\s:]*)*\|?\s*$/gm,
					'',
				)

				// Image
				.replace(/!\[[^\]]*]\([^)]*\)/g, '')

				// Markdown link
				.replace(/\[([^\]]*)]\([^)]*\)/g, '$1')

				// Obsidian link
				.replace(
					/\[\[([^\]|]+)(?:\|([^\]]+))?]]/g,
					(_: string, file: string, alias: string | undefined) =>
						alias ?? file,
				)

				// Bold
				.replace(/(\*\*|__)(.*?)\1/g, '$2')

				// Italic
				.replace(/(\*|_)(.*?)\1/g, '$2')

				// Strikethrough
				.replace(/~~(.*?)~~/g, '$1')

				// HTML
				.replace(/<[^>]+>/g, '')

				// Footnote definition
				.replace(/^\[\^.+?]:.*$/gm, '')

				// Footnote reference
				.replace(/\[\^.+?]/g, '')
		);
	}

	/**
	 * 出版模式统计
	 *
	 * 中文：
	 * 一个字=1
	 *
	 * 英文：
	 * 一个单词=1
	 *
	 * 数字：
	 * 一个连续数字=1
	 *
	 * abc123
	 * hello2025
	 * 算一个 token
	 */
	static count(text: string): number {
		let count = 0;

		// CJK（中文/日文/韩文）
		const cjk = text.match(
			/[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g,
		);

		if (cjk) {
			count += cjk.length;
		}

		// 去掉 CJK，避免重复统计
		const nonCjk = text.replace(
			/[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g,
			' ',
		);

		/*
			Token：

			hello

			123

			abc123

			test_01

			都算一个
		*/

		const tokens = nonCjk.match(/[A-Za-z0-9_]+/g);

		if (tokens) {
			count += tokens.length;
		}

		return count;
	}

	/**
	 * Explorer 使用
	 */
	static countMarkdown(text: string): number {
		return this.count(this.cleanMarkdown(text));
	}
}
