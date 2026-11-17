import { Injectable, signal } from '@angular/core';

export type LangCode = 'kk' | 'ru' | 'en';

const LANG_KEY = 'fitslot_lang';

const TRANSLATIONS: Record<LangCode, Record<string, string>> = {
  kk: {
    NAV_BOOK: 'Жазылу',
    NAV_TRAINERS: 'Тренерлер',
    NAV_MY_BOOKINGS: 'Менің жазбаларым',
    NAV_STATS: 'Статистика',
    NAV_WALLET: 'Әмиян',
    NAV_NEWS: 'Жаңалықтар',
    NAV_PROFILE: 'Профиль',
    NAV_DASHBOARD: 'Басқару панелі',
    LOG_OUT: 'Шығу',
    MY_BOOKINGS_TITLE: 'Менің жазбаларым',
    NEW_BOOKING: 'Жаңа жазылу',
    BTN_CANCEL: 'Бас тарту / Ауыстыру',
  },
  ru: {
    NAV_BOOK: 'Запись',
    NAV_TRAINERS: 'Тренеры',
    NAV_MY_BOOKINGS: 'Мои записи',
    NAV_STATS: 'Статистика',
    NAV_WALLET: 'Кошелек',
    NAV_NEWS: 'Новости',
    NAV_PROFILE: 'Профиль',
    NAV_DASHBOARD: 'Панель админа',
    LOG_OUT: 'Выйти',
    MY_BOOKINGS_TITLE: 'Мои записи',
    NEW_BOOKING: 'Новая запись',
    BTN_CANCEL: 'Отмена / Перенос',
  },
  en: {
    NAV_BOOK: 'Book',
    NAV_TRAINERS: 'Trainers',
    NAV_MY_BOOKINGS: 'My bookings',
    NAV_STATS: 'Stats',
    NAV_WALLET: 'Wallet',
    NAV_NEWS: 'News',
    NAV_PROFILE: 'Profile',
    NAV_DASHBOARD: 'Dashboard',
    LOG_OUT: 'Log out',
    MY_BOOKINGS_TITLE: 'My bookings',
    NEW_BOOKING: 'New booking',
    BTN_CANCEL: 'Cancel',
  },
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<LangCode>((localStorage.getItem(LANG_KEY) as LangCode) || 'en');

  setLang(code: LangCode) {
    this.lang.set(code);
    localStorage.setItem(LANG_KEY, code);
  }

  t(key: string): string {
    return TRANSLATIONS[this.lang()]?.[key] ?? key;
  }
}