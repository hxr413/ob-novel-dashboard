import { getLanguage } from 'obsidian';

import { en } from './en';
import { zh } from './zh';

export type LanguagePreference = 'auto' | 'zh' | 'en';

export type TranslationKey = keyof typeof en;

let current: Record<TranslationKey, string> = en;

export function setLanguage(preference: LanguagePreference) {
	const language =
		preference === 'auto'
			? getLanguage().toLowerCase().startsWith('zh')
				? 'zh'
				: 'en'
			: preference;

	current = language === 'zh' ? zh : en;
}

export function t(
	key: TranslationKey,
	vars: Record<string, string | number> = {},
): string {
	let text = current[key] ?? en[key];

	for (const name in vars) {
		text = text.split(`{${name}}`).join(String(vars[name]));
	}

	return text;
}
