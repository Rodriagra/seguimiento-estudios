import { Router } from 'express';
import { db } from '../db.js';

export const router = Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM subtemas ORDER BY tema_id, id').all());
});

router.post('/', (req, res) => {
  const { tema_id, titulo } = req.body;
  if (!tema_id || !titulo || !titulo.trim()) {
    return res.status(400).json({ error: 'tema_id y titulo son obligatorios' });
  }
  if (!db.prepare('SELECT 1 FROM temas WHERE id = ?').get(tema_id)) {
    return res.status(404).json({ error: 'tema no encontrado' });
  }
  const info = db.prepare('INSERT INTO subtemas (tema_id, titulo) VALUES (?, ?)').run(tema_id, titulo.trim());
  res.status(201).json(db.prepare('SELECT * FROM subtemas WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM subtemas WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'no encontrado' });
  const titulo = req.body.titulo?.trim() || existing.titulo;
  const completado = 'completado' in req.body ? (req.body.completado ? 1 : 0) : existing.completado;
  db.prepare('UPDATE subtemas SET titulo = ?, completado = ? WHERE id = ?').run(titulo, completado, req.params.id);
  res.json(db.prepare('SELECT * FROM subtemas WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM subtemas WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'no encontrado' });
  res.status(204).end();
});
