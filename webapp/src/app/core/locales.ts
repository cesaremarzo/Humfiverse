import { Locale } from './models';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'it', 'es', 'fr', 'de', 'ru', 'ja', 'zh', 'ar'];
export const RTL_LOCALES: Locale[] = ['ar'];
export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English',
  it: 'Italiano',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ru: 'Русский',
  ja: '日本語',
  zh: '中文',
  ar: 'العربية'
};
