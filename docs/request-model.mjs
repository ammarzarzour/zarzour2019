export const services = ['travel', 'tourism', 'visa', 'hajj', 'umrah'];
export function validateRequest(input, today = new Date().toISOString().slice(0,10)) {
  const errors = [];
  if (!services.includes(input.service)) errors.push('service');
  if (!String(input.destination || '').trim() || input.destination.length > 120) errors.push('destination');
  const date = input.departure || '';
  const parsed = new Date(date + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+parsed) || parsed.toISOString().slice(0,10) !== date || date < today) errors.push('departure');
  if (!Number.isInteger(Number(input.travelers)) || Number(input.travelers) < 1 || Number(input.travelers) > 200) errors.push('travelers');
  if (String(input.notes || '').length > 1000) errors.push('notes');
  if (input.returnDate) {
    const end = new Date(input.returnDate + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.returnDate) || !Number.isFinite(+end) || end.toISOString().slice(0,10) !== input.returnDate || input.returnDate < date) errors.push('returnDate');
  }
  return errors;
}
export function requestSummary(input, language) {
  const labels = language === 'en' ? ['Travel planning request — not a confirmed booking', 'Service', 'Destination', 'Departure', 'Travelers', 'Notes'] : ['طلب تخطيط رحلة — ليس حجزاً مؤكداً', 'الخدمة', 'الوجهة', 'المغادرة', 'عدد المسافرين', 'ملاحظات'];
  const names = language === 'en' ? ['Travel', 'Tourism', 'Visa', 'Hajj', 'Umrah'] : ['سفر', 'سياحة', 'تأشيرة', 'حج', 'عمرة'];
  const returnLine = input.returnDate ? '\n' + (language === 'en' ? 'Expected return: ' : 'العودة المتوقعة: ') + input.returnDate : '';
  return [labels[0], ...[names[services.indexOf(input.service)] || '', input.destination.trim(), input.departure, input.travelers, (input.notes || '').trim()].map((value, index) => `${labels[index + 1]}: ${value}`)].join('\n') + returnLine;
}
