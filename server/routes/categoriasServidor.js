import { Router } from 'express';
import { db } from '../db.js';

export const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM categorias_servidor ORDER BY nombre').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { nombre, color } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'nombre es obligatorio' });
  }
  const info = db
    .prepare('INSERT INTO categorias_servidor (nombre, color) VALUES (?, ?)')
    .run(nombre.trim(), color || '#0ea5e9');
  const row = db.prepare('SELECT * FROM categorias_servidor WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM categorias_servidor WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'no encontrada' });
  const nombre = req.body.nombre?.trim() || existing.nombre;
  const color = req.body.color || existing.color;
  db.prepare('UPDATE categorias_servidor SET nombre = ?, color = ? WHERE id = ?').run(nombre, color, req.params.id);
  res.json(db.prepare('SELECT * FROM categorias_servidor WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM categorias_servidor WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'no encontrada' });
  res.status(204).end();
});
