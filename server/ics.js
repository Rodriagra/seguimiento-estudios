function toICSDate(dateStr) {
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeText(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line) {
  if (line.length <= 74) return line;
  let result = '';
  let rest = line;
  while (rest.length > 74) {
    result += rest.slice(0, 74) + '\r\n ';
    rest = rest.slice(74);
  }
  return result + rest;
}

function buildEvent({ uid, start, summary, description, alarmMinutesBefore }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date().toISOString())}`,
    `DTSTART:${toICSDate(start)}`,
    `SUMMARY:${escapeText(summary)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (alarmMinutesBefore) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(summary)}`,
      `TRIGGER:-PT${alarmMinutesBefore}M`,
      'END:VALARM'
    );
  }
  lines.push('END:VEVENT');
  return lines.map(foldLine).join('\r\n');
}

export function buildCalendarFeed({ examenes, tareas }) {
  const events = [];

  for (const examen of examenes) {
    events.push(
      buildEvent({
        uid: `examen-${examen.id}@seguimiento-estudios`,
        start: examen.fecha,
        summary: `Examen: ${examen.asignatura_nombre}`,
        description: examen.notas,
        alarmMinutesBefore: 24 * 60,
      })
    );
  }

  for (const tarea of tareas.filter((t) => t.estado !== 'hecha' && t.fecha_limite)) {
    events.push(
      buildEvent({
        uid: `tarea-${tarea.id}@seguimiento-estudios`,
        start: tarea.fecha_limite,
        summary: `Entrega: ${tarea.titulo} (${tarea.asignatura_nombre})`,
        description: `Prioridad: ${tarea.prioridad}`,
        alarmMinutesBefore: 24 * 60,
      })
    );
  }

  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Seguimiento Estudios//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Estudios',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  return body;
}
