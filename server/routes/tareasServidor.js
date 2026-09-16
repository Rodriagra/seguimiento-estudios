import { Router } from 'express';
import { db } from '../db.js';

export const router = Router();

const ESTADOS = ['pendiente', 'en_progreso', 'hecha'];
const PRIORIDADES = ['alta', 'media', 'baja'];

const SELECT_JOIN = `
  SELECT tareas_servidor.*, categorias_servidor.nombre AS categoria_nombre, categorias_servidor.color AS categoria_color
  FROM tareas_servidor
  JOIN categorias_servidor ON categorias_servidor.id = tareas_servidor.categoria_id
`;

router.get('/', (req, res) => {
  const rows = db.prepare(`${SELECT_JOIN} ORDER BY tareas_servidor.creado_en DESC`).all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { categoria_id, titulo, descripcion, estado, prioridad } = req.body;
  if (!categoria_id || !titulo || !titulo.trim()) {
    return res.status(400).json({ error: 'categoria_id y titulo son obligatorios' });
  }
  const estadoFinal = ESTADOS.includes(estado) ? estado : 'pendiente';
  const prioridadFinal = PRIORIDADES.includes(prioridad) ? prioridad : 'media';
  const info = db
    .prepare(
      'INSERT INTO tareas_servidor (categoria_id, titulo, descripcion, estado, prioridad) VALUES (?, ?, ?, ?, ?)'
    )
    .run(categoria_id, titulo.trim(), descripcion || '', estadoFinal, prioridadFinal);
  const row = db.prepare(`${SELECT_JOIN} WHERE tareas_servidor.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tareas_servidor WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'no encontrada' });
  const categoria_id = req.body.categoria_id ?? existing.categoria_id;
  const titulo = req.body.titulo?.trim() || existing.titulo;
  const descripcion = req.body.descripcion ?? existing.descripcion;
  const estado = ESTADOS.includes(req.body.estado) ? req.body.estado : existing.estado;
  const prioridad = PRIORIDADES.includes(req.body.prioridad) ? req.body.prioridad : existing.prioridad;
  db.prepare(
    'UPDATE tareas_servidor SET categoria_id = ?, titulo = ?, descripcion = ?, estado = ?, prioridad = ? WHERE id = ?'
  ).run(categoria_id, titulo, descripcion, estado, prioridad, req.params.id);
  res.json(db.prepare(`${SELECT_JOIN} WHERE tareas_servidor.id = ?`).get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM tareas_servidor WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'no encontrada' });
  res.status(204).end();
});
