import { Router } from 'express';
import { db } from '../db.js';

export const router = Router();

const ESTADOS = ['pendiente', 'en_progreso', 'hecha'];
const PRIORIDADES = ['alta', 'media', 'baja'];
// Horas estimadas de estudio cuando la tarea es un apartado de un tema; 3 es la opción "+2 h".
const HORAS = [0.5, 1, 1.5, 2, 3];

const SELECT_JOIN = `
  SELECT tareas.*, asignaturas.nombre AS asignatura_nombre, asignaturas.color AS asignatura_color,
         temas.titulo AS tema_titulo
  FROM tareas
  JOIN asignaturas ON asignaturas.id = tareas.asignatura_id
  LEFT JOIN temas ON temas.id = tareas.tema_id
`;

// Un tema solo vale si existe y pertenece a la asignatura de la tarea; si no, la tarea queda sin tema.
function temaValido(tema_id, asignatura_id) {
  if (!tema_id) return null;
  const tema = db.prepare('SELECT id FROM temas WHERE id = ? AND asignatura_id = ?').get(tema_id, asignatura_id);
  return tema ? tema.id : null;
}

router.get('/', (req, res) => {
  const rows = db.prepare(`${SELECT_JOIN} ORDER BY (fecha_limite IS NULL), fecha_limite ASC`).all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { asignatura_id, titulo, fecha_limite, estado, prioridad, opcional, tema_id } = req.body;
  if (!asignatura_id || !titulo || !titulo.trim()) {
    return res.status(400).json({ error: 'asignatura_id y titulo son obligatorios' });
  }
  const estadoFinal = ESTADOS.includes(estado) ? estado : 'pendiente';
  const opcionalFinal = opcional ? 1 : 0;
  const prioridadFinal = PRIORIDADES.includes(prioridad) ? prioridad : opcionalFinal ? 'media' : 'alta';
  const fechaFinal = fecha_limite || null;
  const info = db
    .prepare(
      'INSERT INTO tareas (asignatura_id, titulo, fecha_limite, estado, prioridad, opcional, tema_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(asignatura_id, titulo.trim(), fechaFinal, estadoFinal, prioridadFinal, opcionalFinal, temaValido(tema_id, asignatura_id));
  const row = db.prepare(`${SELECT_JOIN} WHERE tareas.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tareas WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'no encontrada' });
  const asignatura_id = req.body.asignatura_id ?? existing.asignatura_id;
  const titulo = req.body.titulo?.trim() || existing.titulo;
  const fecha_limite = 'fecha_limite' in req.body ? req.body.fecha_limite || null : existing.fecha_limite;
  const estado = ESTADOS.includes(req.body.estado) ? req.body.estado : existing.estado;
  const prioridad = PRIORIDADES.includes(req.body.prioridad) ? req.body.prioridad : existing.prioridad;
  const opcional = 'opcional' in req.body ? (req.body.opcional ? 1 : 0) : existing.opcional;
  const tema_id = temaValido('tema_id' in req.body ? req.body.tema_id : existing.tema_id, asignatura_id);
  const horas = HORAS.includes(Number(req.body.horas)) ? Number(req.body.horas) : existing.horas;
  db.prepare(
    'UPDATE tareas SET asignatura_id = ?, titulo = ?, fecha_limite = ?, estado = ?, prioridad = ?, opcional = ?, tema_id = ?, horas = ? WHERE id = ?'
  ).run(asignatura_id, titulo, fecha_limite, estado, prioridad, opcional, tema_id, horas, req.params.id);
  res.json(db.prepare(`${SELECT_JOIN} WHERE tareas.id = ?`).get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM tareas WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'no encontrada' });
  res.status(204).end();
});
