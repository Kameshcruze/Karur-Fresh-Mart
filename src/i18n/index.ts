import { en } from './en';
import { ta } from './ta';
import type { BilingualText, Language } from '../types';

export const dictionaries = { en, ta } as const;

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<typeof en>;

/**
 * Pure translation helper supporting nested keys and `{placeholder}` interpolation.
 */
export function translate(
  lang: Language,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const dict = dictionaries[lang] ?? dictionaries.en;
  const parts = key.split('.');
  let current: unknown = dict;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      current = undefined;
      break;
    }
  }

  let template = typeof current === 'string' ? current : key;

  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      template = template.replaceAll(`{${paramKey}}`, String(paramValue));
    }
  }

  return template;
}

/**
 * Pick localized text from a BilingualText object.
 */
export function pickBilingual(text: BilingualText, lang: Language): string {
  return lang === 'ta' ? text.ta : text.en;
}
