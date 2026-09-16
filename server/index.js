import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { db } from './db.js';
import { buildCalendarFeed } from './ics.js';
import { router as asignaturasRouter } from './routes/asignaturas.js';
import { router as examenesRouter } from './routes/examenes.js';
import { router as tareasRouter } from './routes/tareas.js';
import { router as categoriasServidorRouter } from './routes/categoriasServidor.js';
import { router as tareasServidorRouter } from './routes/tareasServidor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

app.use('/api/asignaturas', asignaturasRouter);
app.use('/api/examenes', examenesRouter);
app.use('/api/tareas', tareasRouter);
app.use('/api/categorias-servidor', categoriasServidorRouter);
app.use('/api/tareas-servidor', tareasServidorRouter);

app.get('/api/dashboard', (req, res) => {
  const ahora = new Date().toISOString();
  const examenes = db
    .prepare(
      `SELECT examenes.*, asignaturas.nombre AS asignatura_nombre, asignaturas.color AS asignatura_color
       FROM examenes JOIN asignaturas ON asignaturas.id = examenes.asignatura_id
       WHERE fecha >= ? ORDER BY fecha ASC LIMIT 10`
    )
    .all(ahora);
  const tareas = db
    .prepare(
      `SELECT tareas.*, asignaturas.nombre AS asignatura_nombre, asignaturas.color AS asignatura_color
       FROM tareas JOIN asignaturas ON asignaturas.id = tareas.asignatura_id
       WHERE estado != 'hecha' AND fecha_limite IS NOT NULL ORDER BY fecha_limite ASC LIMIT 10`
    )
    .all();
  res.json({ examenes, tareas });
});

app.get('/calendar.ics', (req, res) => {
  const examenes = db
    .prepare(
      `SELECT examenes.*, asignaturas.nombre AS asignatura_nombre
       FROM examenes JOIN asignaturas ON asignaturas.id = examenes.asignatura_id`
    )
    .all();
  const tareas = db
    .prepare(
      `SELECT tareas.*, asignaturas.nombre AS asignatura_nombre
       FROM tareas JOIN asignaturas ON asignaturas.id = tareas.asignatura_id`
    )
    .all();
  const ics = buildCalendarFeed({ examenes, tareas });
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', 'inline; filename="estudios.ics"');
  res.send(ics);
});

app.use(express.static(PUBLIC_DIR));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'error interno' });
});

app.listen(PORT, () => {
  console.log(`Seguimiento Estudios escuchando en el puerto ${PORT}`);
});
