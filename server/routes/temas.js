import { Router } from 'express';
import { db } from '../db.js';

export const router = Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM temas ORDER BY asignatura_id, id').all());
});

router.post('/', (req, res) => {
  const { asignatura_id, titulo } = req.body;
  if (!asignatura_id || !titulo || !titulo.trim()) {
    return res.status(400).json({ error: 'asignatura_id y titulo son obligatorios' });
  }
  const info = db
    .prepare('INSERT INTO temas (asignatura_id, titulo) VALUES (?, ?)')
    .run(asignatura_id, titulo.trim());
  res.status(201).json(db.prepare('SELECT * FROM temas WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM temas WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'no encontrado' });
  const titulo = req.body.titulo?.trim() || existing.titulo;
  const completado = 'completado' in req.body ? (req.body.completado ? 1 : 0) : existing.completado;
  db.prepare('UPDATE temas SET titulo = ?, completado = ? WHERE id = ?').run(titulo, completado, req.params.id);
  res.json(db.prepare('SELECT * FROM temas WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM temas WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'no encontrado' });
  res.status(204).end();
});
