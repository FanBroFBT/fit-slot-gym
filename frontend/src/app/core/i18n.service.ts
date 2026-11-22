import { Injectable, signal } from '@angular/core';
export type LangCode = 'kk' | 'ru' | 'en';

type Phrase = { kk: string; ru: string };
export const DICTIONARY: Record<string, Phrase> = {
  'Wallet': {kk:'Әмиян',ru:'Кошелёк'},
  'Stats': {kk:'Статистика',ru:'Статистика'},
  'Profile': {kk:'Профиль',ru:'Профиль'},
  'Wallet & Subscriptions': {kk:'Әмиян және жазылымдар',ru:'Кошелёк и абонементы'},
  'Wallet balance': {kk:'Әмияндағы қаражат',ru:'Баланс кошелька'},
  'Subscription': {kk:'Жазылым',ru:'Абонемент'},
  'Active subscription': {kk:'Белсенді жазылым',ru:'Активный абонемент'},
  'No active subscription': {kk:'Белсенді жазылым жоқ',ru:'Нет активного абонемента'},
  'Individual session': {kk:'Жеке жаттығу',ru:'Индивидуальное занятие'},
  'Top up wallet': {kk:'Әмиянды толтыру',ru:'Пополнить кошелёк'},
  'Amount KZT': {kk:'Сома (теңге)',ru:'Сумма (тенге)'},
  'Top up': {kk:'Толтыру',ru:'Пополнить'},
  'Subscribe': {kk:'Жазылу',ru:'Купить абонемент'},
  'days': {kk:'күн',ru:'дней'},
  'Transactions': {kk:'Транзакциялар',ru:'Транзакции'},
  'Date': {kk:'Күні',ru:'Дата'},
  'Type': {kk:'Түрі',ru:'Тип'},
  'Description': {kk:'Сипаттамасы',ru:'Описание'},
  'Cannot load wallet': {kk:'Әмиян жүктелмеді',ru:'Не удалось загрузить кошелёк'},
  'Wallet updated': {kk:'Әмиян жаңартылды',ru:'Кошелёк обновлён'},
  'Subscription updated': {kk:'Жазылым жаңартылды',ru:'Абонемент обновлён'},
  'Payment failed': {kk:'Төлем қатесі',ru:'Ошибка платежа'},
  'Workout Statistics': {kk:'Жаттығу статистикасы',ru:'Статистика тренировок'},
  'Completed workouts': {kk:'Аяқталған жаттығулар',ru:'Завершённые тренировки'},
  'Training hours': {kk:'Жаттығу сағаттары',ru:'Часы тренировок'},
  'Upcoming sessions': {kk:'Алдағы сабақтар',ru:'Предстоящие занятия'},
  'Total spent': {kk:'Барлық шығын',ru:'Всего потрачено'},
  'paid sessions until the cashback bonus': {kk:'ақылы жаттығудан кейін кешбэк',ru:'платных тренировок до кешбэка'},
  'By trainer': {kk:'Жаттықтырушы бойынша',ru:'По тренерам'},
  'By month': {kk:'Ай бойынша',ru:'По месяцам'},
  'sessions': {kk:'сабақ',ru:'занятий'},
  'Favorite trainer': {kk:'Сүйікті жаттықтырушы',ru:'Любимый тренер'},
  'My profile': {kk:'Менің профилім',ru:'Мой профиль'},
  'Personal information': {kk:'Жеке ақпарат',ru:'Личная информация'},
  'Full name': {kk:'Толық аты-жөні',ru:'Полное имя'},
  'Phone': {kk:'Телефон',ru:'Телефон'},
  'Save changes': {kk:'Өзгерістерді сақтау',ru:'Сохранить изменения'},
  'Change password': {kk:'Құпиясөзді өзгерту',ru:'Изменить пароль'},
  'Old password': {kk:'Ескі құпиясөз',ru:'Старый пароль'},
  'New password': {kk:'Жаңа құпиясөз',ru:'Новый пароль'},
  'Confirm password': {kk:'Құпиясөзді растау',ru:'Подтвердить пароль'},
  'Update password': {kk:'Құпиясөзді жаңарту',ru:'Обновить пароль'},
  'Profile updated': {kk:'Профиль жаңартылды',ru:'Профиль обновлён'},
  'Passwords do not match': {kk:'Құпиясөздер сәйкес келмейді',ru:'Пароли не совпадают'},
  'Password updated': {kk:'Құпиясөз жаңартылды',ru:'Пароль обновлён'},
  'Operation failed': {kk:'Операция орындалмады',ru:'Не удалось выполнить операцию'},

  'Book': { kk: 'Брондау', ru: 'Записаться' },
  'Book now': { kk: 'Қазір брондау', ru: 'Записаться сейчас' },
  'Book this trainer →': { kk: 'Осы жаттықтырушыға жазылу →', ru: 'Записаться к этому тренеру →' },
  'My bookings': { kk: 'Менің броньдарым', ru: 'Мои записи' },
  'Trainers': { kk: 'Жаттықтырушылар', ru: 'Тренеры' },
  'Trainer profile': { kk: 'Жаттықтырушы профилі', ru: 'Профиль тренера' },
  'Working hours': { kk: 'Жұмыс уақыты', ru: 'Часы работы' },
  'Specialization': { kk: 'Мамандануы', ru: 'Специализация' },
  'Experience': { kk: 'Тәжірибесі', ru: 'Опыт' },
  'years': { kk: 'жыл', ru: 'лет' },
  'Rating': { kk: 'Бағалау', ru: 'Рейтинг' },
  'Client reviews': { kk: 'Клиент пікірлері', ru: 'Отзывы клиентов' },
  'Certificates & Qualifications': { kk: 'Сертификаттар және біліктілік', ru: 'Сертификаты и квалификация' },
  'No reviews yet': { kk: 'Әзірге пікір жоқ', ru: 'Пока нет отзывов' },
  'Choose date': { kk: 'Күнді таңдаңыз', ru: 'Выберите дату' },
  'Choose time': { kk: 'Уақытты таңдаңыз', ru: 'Выберите время' },
  'Available slots': { kk: 'Бос уақыттар', ru: 'Свободное время' },
  'No slots on this day.': { kk: 'Бұл күні бос уақыт жоқ.', ru: 'Нет свободных мест на этот день.' },
  'Book a training session': { kk: 'Жаттығуға жазылу', ru: 'Запись на тренировку' },
  'Individual': { kk: 'Жеке жаттығу', ru: 'Индивидуальная' },
  'Group': { kk: 'Топтық жаттығу', ru: 'Групповая' },
  'Group Training': { kk: 'Топтық жаттығу', ru: 'Групповая тренировка' },
  'Training format': { kk: 'Жаттығу форматы', ru: 'Формат тренировки' },
  'Remaining spots': { kk: 'Қалған орындар', ru: 'Свободных мест' },
  'Confirm and pay': { kk: 'Растау және төлеу', ru: 'Подтвердить и оплатить' },
  'Confirm booking': { kk: 'Броньды растау', ru: 'Подтвердить запись' },
  'Payment method': { kk: 'Төлем әдісі', ru: 'Способ оплаты' },
  'Booking confirmed': { kk: 'Бронь расталды', ru: 'Запись подтверждена' },
  'Booking rescheduled': { kk: 'Бронь уақыты өзгерді', ru: 'Запись перенесена' },
  'Booking cancelled': { kk: 'Бронь жойылды', ru: 'Запись отменена' },
  'Notifications': { kk: 'Хабарламалар', ru: 'Уведомления' },
  'Mark all as read': { kk: 'Барлығын оқылған деп белгілеу', ru: 'Отметить все прочитанными' },
  'No notifications': { kk: 'Хабарламалар жоқ', ru: 'Нет уведомлений' },
  'Upcoming workout': { kk: 'Алдағы жаттығу', ru: 'Предстоящая тренировка' },
  'Loyalty streak reward': { kk: 'Адалдық бонусы', ru: 'Бонус лояльности' },
  'Loyalty progress': { kk: 'Бонусқа дейінгі прогресс', ru: 'Прогресс до бонуса' },
  'Refund': { kk: 'Ақшаны қайтару', ru: 'Возврат средств' },
  '10% cashback on your 5th paid session': { kk: 'Әр бесінші ақылы жаттығуға 10% кешбэк', ru: '10% кешбэк за каждую пятую платную тренировку' },
  'AI Coach is temporarily unavailable': { kk: 'AI жаттықтырушысы уақытша қолжетімсіз', ru: 'ИИ-тренер временно недоступен' },
  'Trainer not found': { kk: 'Жаттықтырушы табылмады', ru: 'Тренер не найден' },
  'Unable to load trainers': { kk: 'Жаттықтырушылар жүктелмеді', ru: 'Не удалось загрузить тренеров' },
  'Cannot reschedule': { kk: 'Уақытын өзгерту мүмкін болмады', ru: 'Не удалось перенести тренировку' },
  'AI mode': { kk: 'AI режимі', ru: 'Режим ИИ' },
  'Local mode': { kk: 'Жергілікті режим', ru: 'Локальный режим' },
  'Typing…': { kk: 'Жауап жазылуда…', ru: 'Печатает…' },
  'AI connection problem': { kk: 'AI қосылым қатесі', ru: 'Ошибка подключения ИИ' },
  'Check backend terminal for details': { kk: 'Толығырақ backend терминалын қараңыз', ru: 'Подробности в терминале backend' },
  'AI Fitness Coach': { kk: 'AI фитнес жаттықтырушысы', ru: 'ИИ фитнес-тренер' },
  'Ask about training…': { kk: 'Жаттығу туралы сұраңыз…', ru: 'Спросите о тренировках…' },
  'Send': { kk: 'Жіберу', ru: 'Отправить' },
  'Close': { kk: 'Жабу', ru: 'Закрыть' },
  'Loading…': { kk: 'Жүктелуде…', ru: 'Загрузка…' },
  'Select a trainer': { kk: 'Жаттықтырушыны таңдаңыз', ru: 'Выберите тренера' },
  'New booking': { kk: 'Жаңа бронь', ru: 'Новая запись' },
  'Cancel': { kk: 'Бас тарту', ru: 'Отмена' },
  'Reschedule': { kk: 'Уақытын ауыстыру', ru: 'Перенести' },
  'Dashboard': { kk: 'Басқару панелі', ru: 'Панель управления' },
  'Admin dashboard': { kk: 'Әкімші панелі', ru: 'Панель администратора' },
  'Log out': { kk: 'Шығу', ru: 'Выйти' },
  'News': { kk: 'Жаңалықтар', ru: 'Новости' },
  'Individual (5,000 KZT)': { kk: 'Жеке (5 000 ₸)', ru: 'Индивидуальная (5 000 ₸)' },
  'Group (2,500 KZT)': { kk: 'Топтық (2 500 ₸)', ru: 'Групповая (2 500 ₸)' },
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<LangCode>(this.saved());
  private originals = new WeakMap<Text, { source: string; rendered: string }>();
  private observer?: MutationObserver;
  private pending = new Set<Node>();
  private queued = false;

  constructor() {
    if (typeof document === 'undefined') return;
    queueMicrotask(() => {
      this.translateTree(document.body);
      // Translate only new/changed nodes, not the ENTIRE page for every DOM mutation.
      this.observer = new MutationObserver(records => {
        for (const record of records) {
          if (record.type === 'characterData') this.pending.add(record.target);
          else record.addedNodes.forEach(node => this.pending.add(node));
        }
        this.scheduleTranslation();
      });
      this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
  }

  private saved(): LangCode {
    try { const v = localStorage.getItem('fitslot_lang'); return v === 'kk' || v === 'ru' ? v : 'en'; }
    catch { return 'en'; }
  }
  t(value: string): string {
    const lang = this.lang();
    return lang === 'en' ? value : DICTIONARY[value]?.[lang] || value;
  }
  setLang(lang: LangCode): void {
    this.lang.set(lang);
    try { localStorage.setItem('fitslot_lang', lang); } catch { /* storage disabled */ }
    if (typeof document !== 'undefined') this.translateTree(document.body);
  }
  private scheduleTranslation(): void {
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      const pending = Array.from(this.pending);
      this.pending.clear();
      for (const node of pending) if (node.isConnected) this.translateTree(node);
    });
  }
  private translateTree(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) { this.translateText(node as Text); return; }
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let text: Node | null;
    while ((text = walker.nextNode())) this.translateText(text as Text);
  }
  private translateText(text: Text): void {
    const parent = text.parentElement;
    if (!parent || parent.closest('script, style, code, textarea, [contenteditable="true"]')) return;
    const current = text.textContent ?? '';
    const previous = this.originals.get(text);
    // Angular may reuse a text node for different content; reset the source when it does.
    const source = previous && (current === previous.rendered || current === previous.source)
      ? previous.source : current;
    const key = source.trim();
    if (!key || !DICTIONARY[key]) { this.originals.delete(text); return; }
    const next = source.replace(key, this.t(key));
    this.originals.set(text, { source, rendered: next });
    if (current !== next) text.textContent = next;
  }
}
