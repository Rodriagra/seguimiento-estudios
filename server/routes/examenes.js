import { Router } from 'express';
import { db } from '../db.js';

export const router = Router();

const SELECT_JOIN = `
  SELECT examenes.*, asignaturas.nombre AS asignatura_nombre, asignaturas.color AS asignatura_color
  FROM examenes
  JOIN asignaturas ON asignaturas.id = examenes.asignatura_id
`;

router.get('/', (req, res) => {
  const rows = db.prepare(`${SELECT_JOIN} ORDER BY fecha ASC`).all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { asignatura_id, fecha, notas } = req.body;
  if (!asignatura_id || !fecha) {
    return res.status(400).json({ error: 'asignatura_id y fecha son obligatorios' });
  }
  const info = db
    .prepare('INSERT INTO examenes (asignatura_id, fecha, notas) VALUES (?, ?, ?)')
    .run(asignatura_id, fecha, notas || '');
  const row = db.prepare(`${SELECT_JOIN} WHERE examenes.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM examenes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'no encontrado' });
  const asignatura_id = req.body.asignatura_id ?? existing.asignatura_id;
  const fecha = req.body.fecha ?? existing.fecha;
  const notas = req.body.notas ?? existing.notas;
  db.prepare('UPDATE examenes SET asignatura_id = ?, fecha = ?, notas = ? WHERE id = ?').run(
    asignatura_id,
    fecha,
    notas,
    req.params.id
  );
  res.json(db.prepare(`${SELECT_JOIN} WHERE examenes.id = ?`).get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM examenes WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'no encontrado' });
  res.status(204).end();
});
