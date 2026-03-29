import { LANGUAGES } from '../i18n/languageConfig'

export function backendLangToI18n(lang: string): string {
  return LANGUAGES.find((l) => l.backendValue === lang)?.code ?? 'de'
}

export function i18nToBackendLang(i18nLang: string): string {
  return LANGUAGES.find((l) => l.code === i18nLang)?.backendValue ?? 'german'
}
