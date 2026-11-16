import { Router } from 'express';
import { db } from '../db.js';

export const router = Router();

const SELECT_JOIN = `
  SELECT horarios.*, asignaturas.nombre AS asignatura_nombre, asignaturas.color AS asignatura_color
  FROM horarios
  JOIN asignaturas ON asignaturas.id = horarios.asignatura_id
`;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DURACIONES = [60, 90, 120, 150, 180];

router.get('/', (req, res) => {
  res.json(db.prepare(`${SELECT_JOIN} ORDER BY horarios.fecha_desde, horarios.hora`).all());
});

router.post('/', (req, res) => {
  const { asignatura_id, dias_semana, fecha_desde, fecha_hasta, hora, duracion_min } = req.body;
  // dias_semana: lista de días ISO (1 = lunes ... 7 = domingo), sin repetir.
  const dias = [...new Set((Array.isArray(dias_semana) ? dias_semana : []).map(Number))]
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
    .sort();
  if (!asignatura_id || !db.prepare('SELECT 1 FROM asignaturas WHERE id = ?').get(asignatura_id)) {
    return res.status(400).json({ error: 'asignatura_id no válida' });
  }
  if (dias.length === 0) return res.status(400).json({ error: 'elige al menos un día de la semana' });
  if (!FECHA.test(fecha_desde || '') || !FECHA.test(fecha_hasta || '')) {
    return res.status(400).json({ error: 'fecha_desde y fecha_hasta deben ser AAAA-MM-DD' });
  }
  if (fecha_hasta < fecha_desde) return res.status(400).json({ error: 'la fecha final es anterior a la inicial' });
  const horaFinal = HORA.test(hora || '') ? hora : '16:00';
  const duracionFinal = DURACIONES.includes(Number(duracion_min)) ? Number(duracion_min) : 120;
  const info = db
    .prepare(
      'INSERT INTO horarios (asignatura_id, dias_semana, fecha_desde, fecha_hasta, hora, duracion_min) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(asignatura_id, dias.join(','), fecha_desde, fecha_hasta, horaFinal, duracionFinal);
  res.status(201).json(db.prepare(`${SELECT_JOIN} WHERE horarios.id = ?`).get(info.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM horarios WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'no encontrado' });
  res.status(204).end();
});
