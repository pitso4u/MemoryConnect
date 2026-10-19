/**
 * Convert a datetime-local value such as:
 *
 *   2026-09-19T08:00
 *
 * into the correct UTC instant for the supplied IANA timezone.
 *
 * Example:
 *   2026-09-19T08:00 + Africa/Johannesburg
 *   -> 2026-09-19T06:00:00.000Z
 *
 * Values that already contain a timezone offset or Z are treated
 * as absolute timestamps and are not converted again.
 */
export function localDateTimeToUTC(
  value: string,
  timezone = 'Africa/Johannesburg'
): Date {
  if (!value) {
    throw new Error('Date/time value is required');
  }

  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid date/time: ${value}`);
    }

    return date;
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) {
    throw new Error(`Invalid local date/time: ${value}`);
  }

  const [, year, month, day, hour, minute, second = '00'] = match;

  const assumedUTC = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(new Date(assumedUTC));

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  const timezoneAsUTC = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  );

  const offset = timezoneAsUTC - assumedUTC;

  const result = new Date(assumedUTC - offset);

  if (Number.isNaN(result.getTime())) {
    throw new Error(`Unable to convert date/time: ${value}`);
  }

  return result;
}