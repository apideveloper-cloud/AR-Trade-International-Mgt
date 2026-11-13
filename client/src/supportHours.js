// Support desk hours: Saturday to Thursday, 10:00 to 20:00 Dhaka time (closed on Friday).
// The status follows Dhaka time whatever the visitor's own clock or time zone says.
const OPEN = 10, CLOSE = 20, FRIDAY = 5, DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dhakaNow(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now).map(x => [x.type, x.value]));
  return { day: DAYS.indexOf(p.weekday), mins: +p.hour * 60 + +p.minute };
}

/** The current Dhaka day and time, e.g. "Fri 9:19 PM". */
export function dhakaClock(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
    .formatToParts(now).map(x => [x.type, x.value]));
  return `${p.weekday} ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

/** { online, label }: label is the line shown under the support team's name, with the current Dhaka time. */
export function supportStatus(now = new Date()) {
  const { day, mins } = dhakaNow(now), clock = dhakaClock(now);
  if (day !== FRIDAY && mins >= OPEN * 60 && mins < CLOSE * 60) return { online: true, label: `Online · ${clock} · open till 8:00 PM` };
  const opensToday = day !== FRIDAY && mins < OPEN * 60;
  const next = opensToday ? 'today' : day === 4 || day === FRIDAY ? 'Sat' : 'tomorrow';
  return { online: false, label: `Offline · ${clock} · back ${next} 10:00 AM` };
}

/** The chat is a virtual assistant that answers at any hour, so it always shows as online, with the current Dhaka time. */
export function assistantStatus(now = new Date()) {
  return { online: true, label: `Online · ${dhakaClock(now)}` };
}
