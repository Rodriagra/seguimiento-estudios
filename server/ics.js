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

// start/end pueden ser ISO (se convierten a UTC) o, para las sesiones de estudio, la hora "flotante"
// ya formateada (AAAAMMDDTHHMMSS, sin Z): así 16:00 es 16:00 en el calendario de quien la lea.
function buildEvent({ uid, start, startLocal, endLocal, summary, description, alarmMinutesBefore }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date().toISOString())}`,
    startLocal ? `DTSTART:${startLocal}` : `DTSTART:${toICSDate(start)}`,
    ...(endLocal ? [`DTEND:${endLocal}`] : []),
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

const pad = (n) => String(n).padStart(2, '0');

// Una sesión por cada día del rango cuyo día de la semana (1 = lunes ... 7 = domingo) esté elegido.
function* diasDeSesion(h) {
  const [y1, m1, d1] = h.fecha_desde.split('-').map(Number);
  const fin = Date.UTC(...h.fecha_hasta.split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n)));
  const dias = h.dias_semana.split(',').map(Number);
  let t = Date.UTC(y1, m1 - 1, d1);
  for (let n = 0; t <= fin && n < 800; n++, t += 86400000) {
    const d = new Date(t);
    if (dias.includes(((d.getUTCDay() + 6) % 7) + 1)) yield d;
  }
}

const flotante = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').slice(0, 15);

export function buildCalendarFeed({ examenes, tareas, horarios = [] }) {
  const events = [];

  for (const h of horarios) {
    const [hh, mm] = h.hora.split(':').map(Number);
    for (const dia of diasDeSesion(h)) {
      const inicio = Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate(), hh, mm);
      events.push(
        buildEvent({
          uid: `estudio-${h.id}-${dia.getUTCFullYear()}${pad(dia.getUTCMonth() + 1)}${pad(dia.getUTCDate())}@seguimiento-estudios`,
          startLocal: flotante(inicio),
          endLocal: flotante(inicio + h.duracion_min * 60000),
          summary: `Estudio: ${h.asignatura_nombre}`,
          alarmMinutesBefore: 30,
        })
      );
    }
  }

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
