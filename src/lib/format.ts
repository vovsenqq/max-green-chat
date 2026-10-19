export function normalizePhone(value: string): string {
  if (!/^[+\d\s()-]+$/.test(value.trim())) {
    throw new Error('Введите номер телефона: допускаются цифры, пробелы, +, скобки и дефисы.');
  }
  let phone = value.replace(/\D/g, '');
  if (phone.length === 11 && phone.startsWith('8')) phone = `7${phone.slice(1)}`;
  if (!/^\d{11,12}$/.test(phone)) {
    throw new Error('Введите 11–12 цифр с кодом страны, например +7 999 123-45-67.');
  }
  return phone;
}

export function formatPhone(phone: string): string {
  if (/^7\d{10}$/.test(phone)) {
    return `+7 ${phone.slice(1, 4)} ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`;
  }
  return phone ? `+${phone}` : '';
}

export function initials(name: string): string {
  if (/^[+\d\s()-]+$/.test(name)) return name.replace(/\D/g, '').slice(-2);
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

export const timeLabel = (timestamp: number) => new Date(timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
export const dateKey = (timestamp: number) => new Date(timestamp).toLocaleDateString('ru-RU');
export function dayLabel(timestamp: number): string {
  if (dateKey(timestamp) === dateKey(Date.now())) return 'Сегодня';
  return new Date(timestamp).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Произошла ошибка. Попробуйте ещё раз.';
}

export function instanceStateMessage(state: string): string {
  const descriptions: Record<string, string> = {
    notAuthorized: 'Авторизуйте MAX-инстанс в личном кабинете GREEN-API.',
    starting: 'Инстанс запускается. Подождите несколько минут и подключитесь снова.',
    blocked: 'Аккаунт MAX заблокирован. Проверьте его состояние в личном кабинете.',
    pendingPassword: 'Завершите двухфакторную авторизацию инстанса в личном кабинете.',
    suspended: 'На аккаунте временные ограничения. Проверьте инстанс в личном кабинете.',
  };
  return descriptions[state] ?? `Инстанс недоступен (состояние: ${state}). Проверьте личный кабинет.`;
}
