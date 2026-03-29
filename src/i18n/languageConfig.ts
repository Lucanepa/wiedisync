export const LANGUAGES = [
  { code: 'de', backendValue: 'german', nativeName: 'Deutsch', flag: 'de' },
  { code: 'en', backendValue: 'english', nativeName: 'English', flag: 'gb' },
  { code: 'fr', backendValue: 'french', nativeName: 'Français', flag: 'fr' },
  { code: 'it', backendValue: 'italian', nativeName: 'Italiano', flag: 'it' },
  { code: 'gsw', backendValue: 'swiss_german', nativeName: 'CH-DE', flag: 'ch', isCasual: true },
] as const

export type I18nCode = (typeof LANGUAGES)[number]['code']
export type BackendLanguage = (typeof LANGUAGES)[number]['backendValue']
