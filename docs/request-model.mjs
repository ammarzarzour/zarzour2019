export const services = ['travel', 'tourism', 'visa', 'hajj', 'umrah'];
export function validateRequest(input, today = new Date().toISOString().slice(0,10)) {
  const errors = [];
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return ['service', 'destination', 'departure', 'travelers'];
  }
  if (!services.includes(input.service)) errors.push('service');
  if (typeof input.destination !== 'string' || !input.destination.trim() || input.destination.length > 120) errors.push('destination');
  const date = input.departure;
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;
  if (!validDate(date) || date < today) errors.push('departure');
  if (!((typeof input.travelers === 'string' && /^[1-9][0-9]*$/.test(input.travelers)) || (typeof input.travelers === 'number' && Number.isInteger(input.travelers))) || Number(input.travelers) < 1 || Number(input.travelers) > 200) errors.push('travelers');
  if (input.notes != null && typeof input.notes !== 'string' || String(input.notes || '').length > 1000) errors.push('notes');
  if (input.returnDate !== undefined && input.returnDate !== null && input.returnDate !== '') {
    if (!validDate(input.returnDate) || !validDate(date) || input.returnDate < date) errors.push('returnDate');
  }
  return errors;
}
export function requestSummary(input, language) {
  const labels = language === 'en' ? ['Travel planning request — not a confirmed booking', 'Service', 'Destination', 'Departure', 'Travelers', 'Notes'] : ['طلب تخطيط رحلة — ليس حجزاً مؤكداً', 'الخدمة', 'الوجهة', 'المغادرة', 'عدد المسافرين', 'ملاحظات'];
  const names = language === 'en' ? ['Travel', 'Tourism', 'Visa', 'Hajj', 'Umrah'] : ['سفر', 'سياحة', 'تأشيرة', 'حج', 'عمرة'];
  const returnLine = input.returnDate ? '\n' + (language === 'en' ? 'Expected return: ' : 'العودة المتوقعة: ') + input.returnDate : '';
  return [labels[0], ...[names[services.indexOf(input.service)] || '', input.destination.trim(), input.departure, input.travelers, (input.notes || '').trim()].map((value, index) => `${labels[index + 1]}: ${value}`)].join('\n') + returnLine;
}
