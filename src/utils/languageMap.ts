import { LANGUAGES } from '../i18n/languageConfig'

export function pbLangToI18n(pbLang: string): string {
  return LANGUAGES.find((l) => l.pbValue === pbLang)?.code ?? 'de'
}

export function i18nToPbLang(i18nLang: string): string {
  return LANGUAGES.find((l) => l.code === i18nLang)?.pbValue ?? 'german'
}
