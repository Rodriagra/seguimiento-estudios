import { Router } from 'express';
import { db } from '../db.js';

export const router = Router();

const ESTADOS = ['pendiente', 'en_progreso', 'hecha'];
const PRIORIDADES = ['alta', 'media', 'baja'];

const SELECT_JOIN = `
  SELECT tareas.*, asignaturas.nombre AS asignatura_nombre, asignaturas.color AS asignatura_color
  FROM tareas
  JOIN asignaturas ON asignaturas.id = tareas.asignatura_id
`;

router.get('/', (req, res) => {
  const rows = db.prepare(`${SELECT_JOIN} ORDER BY (fecha_limite IS NULL), fecha_limite ASC`).all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { asignatura_id, titulo, fecha_limite, estado, prioridad, opcional } = req.body;
  if (!asignatura_id || !titulo || !titulo.trim()) {
    return res.status(400).json({ error: 'asignatura_id y titulo son obligatorios' });
  }
  const estadoFinal = ESTADOS.includes(estado) ? estado : 'pendiente';
  const prioridadFinal = PRIORIDADES.includes(prioridad) ? prioridad : 'media';
  const opcionalFinal = opcional ? 1 : 0;
  const fechaFinal = fecha_limite || null;
  const info = db
    .prepare(
      'INSERT INTO tareas (asignatura_id, titulo, fecha_limite, estado, prioridad, opcional) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(asignatura_id, titulo.trim(), fechaFinal, estadoFinal, prioridadFinal, opcionalFinal);
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
  db.prepare(
    'UPDATE tareas SET asignatura_id = ?, titulo = ?, fecha_limite = ?, estado = ?, prioridad = ?, opcional = ? WHERE id = ?'
  ).run(asignatura_id, titulo, fecha_limite, estado, prioridad, opcional, req.params.id);
  res.json(db.prepare(`${SELECT_JOIN} WHERE tareas.id = ?`).get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM tareas WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'no encontrada' });
  res.status(204).end();
});
