import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_PATH || './data/estudios.db';

const dir = dirname(DB_PATH);
if (dir && dir !== '.' && !existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS asignaturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#4f46e5'
  );

  CREATE TABLE IF NOT EXISTS examenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asignatura_id INTEGER NOT NULL REFERENCES asignaturas(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL,
    notas TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS tareas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asignatura_id INTEGER NOT NULL REFERENCES asignaturas(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    fecha_limite TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    prioridad TEXT NOT NULL DEFAULT 'media'
  );

  CREATE TABLE IF NOT EXISTS categorias_servidor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#0ea5e9'
  );

  CREATE TABLE IF NOT EXISTS tareas_servidor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria_id INTEGER NOT NULL REFERENCES categorias_servidor(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    estado TEXT NOT NULL DEFAULT 'pendiente',
    prioridad TEXT NOT NULL DEFAULT 'media',
    opcional INTEGER NOT NULL DEFAULT 0,
    fecha_limite TEXT,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migración: añade columnas nuevas si la base de datos viene de una versión anterior.
const tareasServidorCols = db.prepare("PRAGMA table_info(tareas_servidor)").all().map((c) => c.name);
if (!tareasServidorCols.includes('opcional')) {
  db.exec('ALTER TABLE tareas_servidor ADD COLUMN opcional INTEGER NOT NULL DEFAULT 0');
}
if (!tareasServidorCols.includes('fecha_limite')) {
  db.exec('ALTER TABLE tareas_servidor ADD COLUMN fecha_limite TEXT');
}

const ASIGNATURAS_INICIALES = [
  ['Inglés', '#0ea5e9'],
  ['Competencias Profesionales', '#8b5cf6'],
  ['Acceso a datos', '#22c55e'],
  ['Desarrollo de Interfaces', '#f97316'],
  ['Programación multimedia y dispositivos móviles', '#ec4899'],
  ['Programación de servicios y procesos', '#eab308'],
  ['Sistemas de gestión empresarial', '#14b8a6'],
  ['Digitalización aplicada a sectores productivos', '#6366f1'],
];

const count = db.prepare('SELECT COUNT(*) AS n FROM asignaturas').get().n;
if (count === 0) {
  const insert = db.prepare('INSERT INTO asignaturas (nombre, color) VALUES (?, ?)');
  for (const [nombre, color] of ASIGNATURAS_INICIALES) {
    insert.run(nombre, color);
  }
}
