export const LANGUAGES = [
  { code: 'de', pbValue: 'german', nativeName: 'Deutsch', flag: 'de' },
  { code: 'en', pbValue: 'english', nativeName: 'English', flag: 'gb' },
  { code: 'fr', pbValue: 'french', nativeName: 'Français', flag: 'fr' },
  { code: 'it', pbValue: 'italian', nativeName: 'Italiano', flag: 'it' },
  { code: 'gsw', pbValue: 'swiss_german', nativeName: 'CH-DE', flag: 'ch', isCasual: true },
] as const

export type I18nCode = (typeof LANGUAGES)[number]['code']
export type PbLanguage = (typeof LANGUAGES)[number]['pbValue']
