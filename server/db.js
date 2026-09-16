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
    fecha_limite TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    prioridad TEXT NOT NULL DEFAULT 'media',
    opcional INTEGER NOT NULL DEFAULT 0
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
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migración: en 'tareas' (Estudios), la fecha límite pasa a ser opcional y se añade 'opcional'.
// SQLite no permite relajar un NOT NULL con ALTER TABLE, así que se reconstruye la tabla.
const tareasCols = db.prepare('PRAGMA table_info(tareas)').all().map((c) => c.name);
if (!tareasCols.includes('opcional')) {
  db.exec(`
    CREATE TABLE tareas_nueva (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asignatura_id INTEGER NOT NULL REFERENCES asignaturas(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      fecha_limite TEXT,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      prioridad TEXT NOT NULL DEFAULT 'media',
      opcional INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO tareas_nueva (id, asignatura_id, titulo, fecha_limite, estado, prioridad, opcional)
      SELECT id, asignatura_id, titulo, fecha_limite, estado, prioridad, 0 FROM tareas;
    DROP TABLE tareas;
    ALTER TABLE tareas_nueva RENAME TO tareas;
  `);
}

// Migración: las Tareas del Servidor no llevan fecha ni opcional; se quitan si venían de un
// parche anterior que sí las tenía.
const tareasServidorCols = db.prepare('PRAGMA table_info(tareas_servidor)').all().map((c) => c.name);
if (tareasServidorCols.includes('opcional')) {
  db.exec('ALTER TABLE tareas_servidor DROP COLUMN opcional');
}
if (tareasServidorCols.includes('fecha_limite')) {
  db.exec('ALTER TABLE tareas_servidor DROP COLUMN fecha_limite');
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
