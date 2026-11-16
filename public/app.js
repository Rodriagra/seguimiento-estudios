const state = {
  asignaturas: [],
  examenes: [],
  tareas: [],
  temas: [],
  subtemas: [],
  categoriasServidor: [],
  tareasServidor: [],
  abiertas: new Set(),
  calMes: { y: new Date().getFullYear(), m: new Date().getMonth() },
  ultimaCarga: null,
  horarios: [],
  semanaInicio: null, // lunes de la semana visible en Horario; se fija más abajo con lunesDe()
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const pad2 = (n) => String(n).padStart(2, '0');

// Fecha corta; la hora solo se muestra si no es medianoche (00:00 es la hora por defecto).
function fmtFecha(iso) {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return d.getHours() === 0 && d.getMinutes() === 0 ? dia : `${dia}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const toDatetimeLocalValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const inicioDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diasHasta = (iso) => Math.round((inicioDia(new Date(iso)) - inicioDia(new Date())) / 86400000);

function textoPlazo(dias) {
  if (dias < 0) return `vencida hace ${-dias} d`;
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  return `en ${dias} días`;
}

const plazoHtml = (iso) => {
  const dias = diasHasta(iso);
  const clase = dias < 0 ? ' vencida' : dias <= 2 ? ' pronto' : '';
  return `<span class="plazo${clase}">${textoPlazo(dias)}</span>`;
};

// Horas estimadas por tema. El valor 3 es la opción "+2 h" y cuenta 3 h en los totales.
const HORAS_OPCIONES = [
  [0.5, '0,5 h'],
  [1, '1 h'],
  [1.5, '1,5 h'],
  [2, '2 h'],
  [3, '+2 h'],
];
const fmtHoras = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fechaDeYmd = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const lunesDe = (d) => {
  const x = inicioDia(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const diaIso = (d) => ((d.getDay() + 6) % 7) + 1; // 1 = lunes ... 7 = domingo
const minutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const hhmm = (min) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
const fechaCorta = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

// Franjas de estudio que caen en un día concreto.
const horariosEnDia = (d) => {
  const f = ymd(d);
  const iso = diaIso(d);
  return state.horarios.filter(
    (h) => f >= h.fecha_desde && f <= h.fecha_hasta && h.dias_semana.split(',').map(Number).includes(iso)
  );
};

state.semanaInicio = lunesDe(new Date());

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'error de red');
  }
  return res.status === 204 ? null : res.json();
}

/* ---------- Navegación ---------- */

function switchApp(app) {
  document.querySelectorAll('.app-btn').forEach((b) => b.classList.toggle('active', b.dataset.app === app));
  document.querySelectorAll('[data-app-tabs]').forEach((nav) => {
    nav.hidden = nav.dataset.appTabs !== app;
  });
  document.querySelectorAll('[data-app-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.appPanel !== app;
  });
}

function switchTab(tab) {
  const panel = document.getElementById(`tab-${tab}`);
  if (!panel) return;
  const container = panel.closest('[data-app-panel]');
  container.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  panel.classList.add('active');
  const nav = document.querySelector(`nav[data-app-tabs="${container.dataset.appPanel}"]`);
  if (nav) {
    nav.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  }
}

function goTo(app, tab) {
  switchApp(app);
  if (tab) switchTab(tab);
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function initAppSwitch() {
  document.querySelectorAll('.app-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchApp(btn.dataset.app));
  });
}

function initDashboardLinks() {
  document.body.addEventListener('click', (e) => {
    const item = e.target.closest('[data-goto-app]');
    if (!item) return;
    goTo(item.dataset.gotoApp, item.dataset.gotoTab);
  });
}

/* ---------- Selects ---------- */

function fillAsignaturaSelects() {
  document.querySelectorAll('select[name="asignatura_id"]').forEach((select) => {
    const previo = select.value;
    select.innerHTML = state.asignaturas.map((a) => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('');
    if (previo && state.asignaturas.some((a) => String(a.id) === previo)) select.value = previo;
  });
  fillTemaSelect();
}

// El selector de tema de una tarea solo ofrece los temas de la asignatura elegida.
function fillTemaSelect(seleccionado) {
  const form = document.getElementById('form-tarea');
  const select = form.elements['tema_id'];
  const previo = seleccionado !== undefined ? String(seleccionado ?? '') : select.value;
  const asignaturaId = Number(form.elements['asignatura_id'].value);
  const temas = state.temas.filter((t) => t.asignatura_id === asignaturaId);
  select.innerHTML =
    '<option value="">Sin tema</option>' + temas.map((t) => `<option value="${t.id}">${esc(t.titulo)}</option>`).join('');
  select.value = temas.some((t) => String(t.id) === previo) ? previo : '';
}

function fillCategoriaServidorSelects() {
  document.querySelectorAll('select[name="categoria_id"]').forEach((select) => {
    const previo = select.value;
    select.innerHTML = state.categoriasServidor.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
    if (previo && state.categoriasServidor.some((c) => String(c.id) === previo)) select.value = previo;
  });
}

/* ---------- Asignaturas, temas y apartados ---------- */

// Los apartados de un tema son sus subtemas y las tareas que cuelgan de él. Completar una tarea
// aquí o en la pestaña Tareas es lo mismo: ambas leen y escriben tarea.estado.
function hijosDeTema(tema) {
  const subtemas = state.subtemas
    .filter((s) => s.tema_id === tema.id)
    .map((s) => ({ tipo: 'subtema', id: s.id, titulo: s.titulo, hecho: !!s.completado, horas: Number(s.horas) }));
  const tareas = state.tareas
    .filter((t) => t.tema_id === tema.id)
    .map((t) => ({
      tipo: 'tarea',
      id: t.id,
      titulo: t.titulo,
      hecho: t.estado === 'hecha',
      horas: Number(t.horas),
      fecha: t.fecha_limite,
      opcional: !!t.opcional,
    }));
  return [...subtemas, ...tareas];
}

// Con apartados, el tema está completo cuando lo están todos; sin apartados se marca a mano.
function temaCompleto(tema) {
  const hijos = hijosDeTema(tema);
  return hijos.length ? hijos.every((h) => h.hecho) : !!tema.completado;
}

function hijoHtml(h) {
  const meta = [h.tipo === 'tarea' ? 'Tarea' : null, h.fecha ? fmtFecha(h.fecha) : null, h.opcional ? 'opcional' : null]
    .filter(Boolean)
    .join(' · ');
  return `
        <li class="hijo${h.hecho ? ' done' : ''}">
          <label class="check">
            <input type="checkbox" data-action="toggle-hijo" data-tipo="${h.tipo}" data-id="${h.id}" ${h.hecho ? 'checked' : ''} />
            <span class="check-text">${esc(h.titulo)}</span>
          </label>
          ${meta ? `<span class="row-meta">${esc(meta)}</span>` : ''}
          <select class="horas-select" data-action="horas-hijo" data-tipo="${h.tipo}" data-id="${h.id}" aria-label="Horas de estudio de ${esc(h.titulo)}">
            ${HORAS_OPCIONES.map(([v, t]) => `<option value="${v}" ${h.horas === v ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          ${
            h.tipo === 'subtema'
              ? `<button type="button" class="link danger" data-action="del-subtema" data-id="${h.id}" aria-label="Eliminar apartado ${esc(h.titulo)}">Eliminar</button>`
              : '<span class="hijo-slot"></span>'
          }
        </li>`;
}

function temaHtml(tema) {
  const hijos = hijosDeTema(tema);
  const completo = temaCompleto(tema);
  const hechos = hijos.filter((h) => h.hecho).length;
  const conteo = hijos.length ? `<span class="num row-meta">${hechos}/${hijos.length}</span>` : '';
  const casilla = hijos.length
    ? `<input type="checkbox" disabled ${completo ? 'checked' : ''} aria-label="Tema completado cuando lo estén todos sus apartados" />`
    : `<input type="checkbox" data-action="toggle-tema" data-id="${tema.id}" ${completo ? 'checked' : ''} />`;
  return `
      <li class="tema${completo ? ' done' : ''}">
        <div class="tema-row">
          <label class="check">${casilla}<span class="check-text">${esc(tema.titulo)}</span></label>
          ${conteo}
          <button type="button" class="link danger" data-action="del-tema" data-id="${tema.id}" aria-label="Eliminar tema ${esc(tema.titulo)}">Eliminar</button>
        </div>
        ${hijos.length ? `<ul class="hijos">${hijos.map(hijoHtml).join('')}</ul>` : ''}
      </li>`;
}

function renderAsignaturas() {
  const ul = document.getElementById('lista-asignaturas');
  if (state.asignaturas.length === 0) {
    ul.innerHTML = '<li class="empty">No hay asignaturas todavía. Añade la primera arriba.</li>';
    return;
  }
  ul.innerHTML = state.asignaturas
    .map((a) => {
      const temas = state.temas.filter((t) => t.asignatura_id === a.id);
      const completos = temas.filter(temaCompleto).length;
      const pct = temas.length ? Math.round((completos / temas.length) * 100) : 0;
      // Las horas viven en los apartados; cada apartado hecho suma las suyas.
      const apartados = temas.flatMap(hijosDeTema);
      const horasTotal = apartados.reduce((n, h) => n + h.horas, 0);
      const horasHechas = apartados.filter((h) => h.hecho).reduce((n, h) => n + h.horas, 0);
      const otras = state.tareas.filter((t) => t.asignatura_id === a.id && t.estado === 'hecha' && !t.tema_id);
      const temasHtml = temas.length
        ? temas.map(temaHtml).join('')
        : '<li class="empty">Sin temas todavía. Añade el primero.</li>';
      const otrasHtml = otras.length
        ? otras
            .map(
              (t) => `
        <li class="hijo done">
          <span class="check-text">${esc(t.titulo)}${t.opcional ? ' <span class="row-meta">opcional</span>' : ''}</span>
          <button type="button" class="link" data-action="reabrir-tarea" data-id="${t.id}">Reabrir</button>
        </li>`
            )
            .join('')
        : '<li class="empty">Ninguna tarea completada sin tema.</li>';
      const opcionesTema = temas.map((t) => `<option value="${t.id}">${esc(t.titulo)}</option>`).join('');
      return `
    <li class="asig">
      <details data-asignatura="${a.id}" ${state.abiertas.has(a.id) ? 'open' : ''}>
        <summary>
          <span class="dot" style="background:${esc(a.color)}"></span>
          <span class="asig-name">${esc(a.nombre)}</span>
          <span class="asig-prog">
            <span class="progreso" role="img" aria-label="${completos} de ${temas.length} temas completados"><i style="width:${pct}%"></i></span>
            <span class="num row-meta">${temas.length ? `${completos}/${temas.length} temas · ${fmtHoras(horasHechas)}/${fmtHoras(horasTotal)} horas` : 'sin temas'}</span>
          </span>
        </summary>
        <div class="asig-body">
          <div class="asig-actions">
            <button type="button" class="btn-secondary" data-action="add-tema" data-id="${a.id}">Añadir tema</button>
          </div>
          ${
            temas.length
              ? `<form class="form-grid form-apartado">
            <label class="field">
              <span>Tema del apartado</span>
              <select name="tema_id" required>${opcionesTema}</select>
            </label>
            <label class="field field-wide">
              <span>Nuevo apartado</span>
              <input type="text" name="titulo" required />
            </label>
            <div class="form-actions"><button type="submit" class="btn-secondary">Añadir apartado</button></div>
          </form>`
              : ''
          }
          <h3>Temas</h3>
          <ul class="arbol">${temasHtml}</ul>
          <h3>Otras tareas completadas</h3>
          <ul class="hijos plano">${otrasHtml}</ul>
          <div class="asig-footer">
            <button type="button" class="link danger" data-action="del-asignatura" data-id="${a.id}">Eliminar asignatura</button>
          </div>
        </div>
      </details>
    </li>`;
    })
    .join('');
}

/* ---------- Exámenes ---------- */

function renderExamenes() {
  const ul = document.getElementById('lista-examenes');
  if (state.examenes.length === 0) {
    ul.innerHTML = '<li class="empty">No hay exámenes todavía.</li>';
    return;
  }
  ul.innerHTML = state.examenes
    .map(
      (e) => `
    <li class="row">
      <span class="dot" style="background:${esc(e.asignatura_color)}"></span>
      <div class="row-main">
        <span class="row-title">${esc(e.asignatura_nombre)}</span>
        <span class="row-meta">${fmtFecha(e.fecha)}${e.notas ? ' · ' + esc(e.notas) : ''}</span>
      </div>
      <div class="row-actions">
        <button type="button" class="link danger" data-action="del-examen" data-id="${e.id}">Eliminar</button>
      </div>
    </li>`
    )
    .join('');
}

/* ---------- Tareas de estudios ---------- */

function renderTareas() {
  // Más urgentes arriba; las tareas sin fecha van al final de su columna.
  const porFecha = (a, b) => {
    if (!a.fecha_limite && !b.fecha_limite) return 0;
    if (!a.fecha_limite) return 1;
    if (!b.fecha_limite) return -1;
    return new Date(a.fecha_limite) - new Date(b.fecha_limite);
  };
  const pendientes = state.tareas.filter((t) => t.estado !== 'hecha').sort(porFecha);
  const render = (ulId, tareas, vacio) => {
    const ul = document.getElementById(ulId);
    ul.innerHTML = tareas.length ? tareas.map(tareaEstudiosHtml).join('') : `<li class="empty">${vacio}</li>`;
  };
  render('lista-tareas-obligatorias', pendientes.filter((t) => !t.opcional), 'No hay tareas obligatorias pendientes.');
  render('lista-tareas-opcionales', pendientes.filter((t) => t.opcional), 'No hay tareas opcionales pendientes.');
}

function tareaEstudiosHtml(t) {
  const meta = [
    t.asignatura_nombre,
    t.tema_titulo,
    t.fecha_limite ? fmtFecha(t.fecha_limite) : 'sin fecha',
    `prioridad ${t.prioridad}`,
  ]
    .filter(Boolean)
    .map(esc)
    .join(' · ');
  return `
    <li class="row">
      <span class="dot" style="background:${esc(t.asignatura_color)}"></span>
      <div class="row-main">
        <span class="row-title">${esc(t.titulo)}</span>
        <span class="row-meta">${meta}</span>
      </div>
      <div class="row-actions">
        <select data-action="estado-tarea" data-id="${t.id}" aria-label="Estado de ${esc(t.titulo)}">
          <option value="pendiente" ${t.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
          <option value="en_progreso" ${t.estado === 'en_progreso' ? 'selected' : ''}>En progreso</option>
          <option value="hecha" ${t.estado === 'hecha' ? 'selected' : ''}>Hecha</option>
        </select>
        <button type="button" class="link" data-action="edit-tarea" data-id="${t.id}">Editar</button>
        <button type="button" class="link danger" data-action="del-tarea" data-id="${t.id}">Eliminar</button>
      </div>
    </li>`;
}

function startEditTarea(tarea) {
  const form = document.getElementById('form-tarea');
  form.elements['id'].value = tarea.id;
  form.elements['asignatura_id'].value = tarea.asignatura_id;
  fillTemaSelect(tarea.tema_id);
  form.elements['titulo'].value = tarea.titulo;
  const [fecha, hora] = toDatetimeLocalValue(tarea.fecha_limite).split('T');
  form.elements['fecha_limite'].value = fecha || '';
  form.elements['hora_limite'].value = hora || '00:00';
  form.elements['prioridad'].value = tarea.prioridad;
  form.elements['opcional'].value = tarea.opcional ? '1' : '0';
  document.getElementById('btn-tarea-submit').textContent = 'Guardar cambios';
  document.getElementById('btn-tarea-cancelar').hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelEditTarea() {
  const form = document.getElementById('form-tarea');
  form.reset();
  form.elements['id'].value = '';
  fillTemaSelect('');
  document.getElementById('btn-tarea-submit').textContent = 'Añadir tarea';
  document.getElementById('btn-tarea-cancelar').hidden = true;
}

/* ---------- Horario ---------- */

const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const PX_HORA = 48;

function renderHorario() {
  const lunes = state.semanaInicio;
  const dias = [...Array(7)].map((_, i) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + i);
    return d;
  });
  document.getElementById('horario-rango').textContent =
    `${fechaCorta(dias[0])} – ${dias[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  // La franja visible abarca de 08:00 a 21:00 y se amplía si alguna sesión cae fuera.
  let desde = 8 * 60;
  let hasta = 21 * 60;
  for (const h of state.horarios) {
    desde = Math.min(desde, Math.floor(minutos(h.hora) / 60) * 60);
    hasta = Math.max(hasta, Math.ceil((minutos(h.hora) + h.duracion_min) / 60) * 60);
  }
  const alto = ((hasta - desde) / 60) * PX_HORA;
  const hoy = ymd(new Date());

  const etiquetas = [];
  const lineas = [];
  for (let min = desde; min < hasta; min += 60) {
    const top = ((min - desde) / 60) * PX_HORA;
    etiquetas.push(`<span style="top:${top}px">${hhmm(min)}</span>`);
    lineas.push(`<i style="top:${top}px"></i>`);
  }

  const cabeceras = dias
    .map(
      (d, i) =>
        `<div class="sem-dia${ymd(d) === hoy ? ' today' : ''}${i >= 5 ? ' finde' : ''}"><span>${DIAS_CORTO[i]}</span><b>${d.getDate()}</b></div>`
    )
    .join('');

  const columnas = dias
    .map((d, i) => {
      const ses = horariosEnDia(d)
        .map((h) => ({ h, ini: minutos(h.hora), dur: h.duracion_min }))
        .sort((a, b) => a.ini - b.ini);
      // Las sesiones que se solapan se reparten en carriles lado a lado.
      const finCarril = [];
      for (const s of ses) {
        let c = finCarril.findIndex((fin) => fin <= s.ini);
        if (c === -1) c = finCarril.length;
        finCarril[c] = s.ini + s.dur;
        s.c = c;
      }
      const n = Math.max(1, finCarril.length);
      const bloques = ses
        .map(
          (s) => `
        <div class="sesion${n > 1 ? ' multi' : ''}" title="${esc(s.h.asignatura_nombre)} ${s.h.hora}–${hhmm(s.ini + s.dur)}" style="--c:${esc(s.h.asignatura_color)};top:${((s.ini - desde) / 60) * PX_HORA}px;height:${(s.dur / 60) * PX_HORA - 2}px;left:calc(${s.c} * 100% / ${n} + 2px);width:calc(100% / ${n} - 4px)">
          <span class="sesion-nombre">${esc(s.h.asignatura_nombre)}</span>
          <span class="sesion-hora">${s.h.hora}–${hhmm(s.ini + s.dur)}</span>
        </div>`
        )
        .join('');
      return `<div class="sem-col${ymd(d) === hoy ? ' today' : ''}${i >= 5 ? ' finde' : ''}" style="height:${alto}px">${bloques}</div>`;
    })
    .join('');

  document.getElementById('horario-semana').innerHTML = `
    <div class="semana">
      <div class="sem-esquina"></div>${cabeceras}
      <div class="sem-horas" style="height:${alto}px">${etiquetas.join('')}</div>${columnas}
      <div class="sem-lineas" style="height:${alto}px">${lineas.join('')}</div>
    </div>`;

  const ul = document.getElementById('horario-franjas');
  ul.innerHTML = state.horarios.length
    ? state.horarios
        .map((h) => {
          const nombres = h.dias_semana
            .split(',')
            .map((i) => DIAS_CORTO[Number(i) - 1])
            .join(', ');
          const fin = hhmm(minutos(h.hora) + h.duracion_min);
          return `
    <li class="row">
      <span class="dot" style="background:${esc(h.asignatura_color)}"></span>
      <div class="row-main">
        <span class="row-title">${esc(h.asignatura_nombre)}</span>
        <span class="row-meta">${nombres} · ${fechaCorta(fechaDeYmd(h.fecha_desde))} – ${fechaCorta(fechaDeYmd(h.fecha_hasta))} · ${h.hora}–${fin}</span>
      </div>
      <div class="row-actions">
        <button type="button" class="link danger" data-action="del-horario" data-id="${h.id}">Eliminar</button>
      </div>
    </li>`;
        })
        .join('')
    : '<li class="empty">Aún no hay franjas de estudio. Añade la primera arriba.</li>';
}

/* ---------- Servidor ---------- */

function renderCategoriasServidor() {
  const ul = document.getElementById('lista-categorias-servidor');
  if (state.categoriasServidor.length === 0) {
    ul.innerHTML = '<li class="empty">No hay categorías todavía.</li>';
    return;
  }
  ul.innerHTML = state.categoriasServidor
    .map(
      (c) => `
    <li class="row">
      <span class="dot" style="background:${esc(c.color)}"></span>
      <div class="row-main"><span class="row-title">${esc(c.nombre)}</span></div>
      <div class="row-actions">
        <button type="button" class="link danger" data-action="del-categoria-servidor" data-id="${c.id}">Eliminar</button>
      </div>
    </li>`
    )
    .join('');
}

function renderTareasServidor() {
  const render = (ulId, tareas, vacio) => {
    const ul = document.getElementById(ulId);
    ul.innerHTML = tareas.length ? tareas.map(tareaServidorHtml).join('') : `<li class="empty">${vacio}</li>`;
  };
  render('lista-tareas-bugs', state.tareasServidor.filter((t) => t.tipo === 'bug'), 'Sin bugs abiertos.');
  render(
    'lista-tareas-actualizaciones',
    state.tareasServidor.filter((t) => t.tipo !== 'bug'),
    'Sin actualizaciones pendientes.'
  );
}

function tareaServidorHtml(t) {
  const meta = [t.categoria_nombre, `prioridad ${t.prioridad}`, t.descripcion].filter(Boolean).map(esc).join(' · ');
  return `
    <li class="row">
      <span class="dot" style="background:${esc(t.categoria_color)}"></span>
      <div class="row-main">
        <span class="row-title">${esc(t.titulo)}</span>
        <span class="row-meta">${meta}</span>
      </div>
      <div class="row-actions">
        <button type="button" class="link" data-action="edit-tarea-servidor" data-id="${t.id}">Editar</button>
        <button type="button" class="link danger" data-action="del-tarea-servidor" data-id="${t.id}">Eliminar</button>
      </div>
    </li>`;
}

function startEditTareaServidor(tarea) {
  const form = document.getElementById('form-tarea-servidor');
  form.elements['id'].value = tarea.id;
  form.elements['tipo'].value = tarea.tipo;
  form.elements['categoria_id'].value = tarea.categoria_id;
  form.elements['titulo'].value = tarea.titulo;
  form.elements['descripcion'].value = tarea.descripcion || '';
  form.elements['prioridad'].value = tarea.prioridad;
  document.getElementById('btn-tarea-servidor-submit').textContent = 'Guardar cambios';
  document.getElementById('btn-tarea-servidor-cancelar').hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelEditTareaServidor() {
  const form = document.getElementById('form-tarea-servidor');
  form.reset();
  form.elements['id'].value = '';
  document.getElementById('btn-tarea-servidor-submit').textContent = 'Añadir tarea';
  document.getElementById('btn-tarea-servidor-cancelar').hidden = true;
}

/* ---------- Dashboard ---------- */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function renderCalendario() {
  const el = document.getElementById('dashboard-calendario');
  const { y, m } = state.calMes;
  const hoy = new Date();
  const primerDia = (new Date(y, m, 1).getDay() + 6) % 7; // lunes = 0
  const diasMes = new Date(y, m + 1, 0).getDate();

  const porDia = {};
  for (const e of state.examenes) {
    const d = new Date(e.fecha);
    if (d.getFullYear() === y && d.getMonth() === m) (porDia[d.getDate()] ||= []).push(e);
  }

  const tareasPorDia = {};
  for (const t of state.tareas) {
    if (t.estado === 'hecha' || !t.fecha_limite) continue;
    const d = new Date(t.fecha_limite);
    if (d.getFullYear() === y && d.getMonth() === m) (tareasPorDia[d.getDate()] ||= []).push(t);
  }

  let celdas = '';
  for (let i = 0; i < primerDia; i++) celdas += '<span class="cal-day empty"></span>';
  for (let d = 1; d <= diasMes; d++) {
    const exs = porDia[d] || [];
    const tars = tareasPorDia[d] || [];
    const esHoy = d === hoy.getDate() && m === hoy.getMonth() && y === hoy.getFullYear();
    const ses = horariosEnDia(new Date(y, m, d));
    const dots =
      exs.map((e) => `<i style="background:${esc(e.asignatura_color)}"></i>`).join('') +
      tars.map((t) => `<i class="sq" style="background:${esc(t.asignatura_color)}"></i>`).join('') +
      ses.map((h) => `<i class="st" style="background:${esc(h.asignatura_color)}"></i>`).join('');
    const title = [
      ...exs.map((e) => `Examen: ${e.asignatura_nombre}`),
      ...tars.map((t) => `Entrega: ${t.titulo} (${t.asignatura_nombre})`),
      ...ses.map((h) => `Estudio: ${h.asignatura_nombre} ${h.hora}–${hhmm(minutos(h.hora) + h.duracion_min)}`),
    ].join('\n');
    celdas += `<span class="cal-day${esHoy ? ' today' : ''}${exs.length || tars.length || ses.length ? ' has-event' : ''}" ${title ? `title="${esc(title)}"` : ''}>
      <b>${d}</b><span class="cal-dots">${dots}</span></span>`;
  }

  el.innerHTML = `
    <div class="cal-head">
      <button type="button" data-action="cal-prev" aria-label="Mes anterior">‹</button>
      <strong>${MESES[m]} ${y}</strong>
      <button type="button" data-action="cal-next" aria-label="Mes siguiente">›</button>
    </div>
    <div class="cal-grid">
      ${DIAS.map((d) => `<span class="cal-dow">${d}</span>`).join('')}
      ${celdas}
    </div>
    <p class="cal-legend"><i></i> Examen <i class="sq"></i> Entrega <i class="st"></i> Estudio</p>`;
}

function resumenDashboard(data) {
  const entrega = data.tareasEstudios[0];
  if (entrega) {
    const dias = diasHasta(entrega.fecha_limite);
    const prefijo = dias < 0 ? 'Entrega vencida' : 'Próxima entrega';
    return `${prefijo}: ${entrega.titulo} (${entrega.asignatura_nombre}), ${textoPlazo(dias)}.`;
  }
  const examen = data.examenes[0];
  if (examen) return `Próximo examen: ${examen.asignatura_nombre}, ${textoPlazo(diasHasta(examen.fecha))}.`;
  return 'No tienes entregas ni exámenes pendientes.';
}

async function renderDashboard() {
  renderCalendario();
  const data = await api('/api/dashboard');
  document.getElementById('dashboard-resumen').textContent = resumenDashboard(data);

  document.getElementById('dashboard-examenes').innerHTML =
    data.examenes.length === 0
      ? '<li class="empty">Sin exámenes próximos.</li>'
      : data.examenes
          .map(
            (e) => `
    <li class="row clickable" data-goto-app="estudios" data-goto-tab="examenes">
      <span class="dot" style="background:${esc(e.asignatura_color)}"></span>
      <div class="row-main">
        <span class="row-title">${esc(e.asignatura_nombre)}</span>
        <span class="row-meta">${fmtFecha(e.fecha)}</span>
      </div>
      ${plazoHtml(e.fecha)}
    </li>`
          )
          .join('');

  document.getElementById('dashboard-tareas-estudios').innerHTML =
    data.tareasEstudios.length === 0
      ? '<li class="empty">Sin entregas pendientes.</li>'
      : data.tareasEstudios
          .map(
            (t) => `
    <li class="row clickable" data-goto-app="estudios" data-goto-tab="tareas">
      <span class="dot" style="background:${esc(t.asignatura_color)}"></span>
      <div class="row-main">
        <span class="row-title">${esc(t.titulo)}</span>
        <span class="row-meta">${esc(t.asignatura_nombre)} · ${fmtFecha(t.fecha_limite)}</span>
      </div>
      ${plazoHtml(t.fecha_limite)}
    </li>`
          )
          .join('');

  document.getElementById('dashboard-tareas-servidor').innerHTML =
    data.tareasServidor.length === 0
      ? '<li class="empty">Nada pendiente en el servidor.</li>'
      : data.tareasServidor
          .map(
            (t) => `
    <li class="row clickable" data-goto-app="servidor" data-goto-tab="servidor-tareas">
      <span class="dot" style="background:${esc(t.categoria_color)}"></span>
      <div class="row-main">
        <span class="row-title">${esc(t.titulo)}</span>
        <span class="row-meta">${esc(t.categoria_nombre)} · ${t.tipo === 'bug' ? 'bug' : 'actualización'}</span>
      </div>
    </li>`
          )
          .join('');
}

/* ---------- Carga ---------- */

// Un fallo de carga se dice dentro de cada bloque, con la última carga buena y un botón para reintentar.
function renderErrorCarga() {
  const hora = state.ultimaCarga ? ` Última carga correcta: ${pad2(state.ultimaCarga.getHours())}:${pad2(state.ultimaCarga.getMinutes())}.` : '';
  const aviso = `<li class="empty error">No se pudieron cargar los datos.${hora} <button type="button" class="link" data-action="reintentar">Reintentar</button></li>`;
  document
    .querySelectorAll('#dashboard-examenes, #dashboard-tareas-estudios, #dashboard-tareas-servidor, #lista-tareas-obligatorias, #lista-tareas-opcionales, #lista-asignaturas, #lista-examenes, #horario-franjas, #lista-tareas-bugs, #lista-tareas-actualizaciones, #lista-categorias-servidor')
    .forEach((ul) => {
      ul.innerHTML = aviso;
    });
}

async function loadAll() {
  try {
    const [asignaturas, examenes, tareas, temas, subtemas, horarios, categoriasServidor, tareasServidor] = await Promise.all([
      api('/api/asignaturas'),
      api('/api/examenes'),
      api('/api/tareas'),
      api('/api/temas'),
      api('/api/subtemas'),
      api('/api/horarios'),
      api('/api/categorias-servidor'),
      api('/api/tareas-servidor'),
    ]);
    state.asignaturas = asignaturas;
    state.examenes = examenes;
    state.tareas = tareas;
    state.temas = temas;
    state.subtemas = subtemas;
    state.horarios = horarios;
    state.categoriasServidor = categoriasServidor;
    state.tareasServidor = tareasServidor;
    fillAsignaturaSelects();
    fillCategoriaServidorSelects();
    renderAsignaturas();
    renderExamenes();
    renderTareas();
    renderHorario();
    renderCategoriasServidor();
    renderTareasServidor();
    await renderDashboard();
    state.ultimaCarga = new Date();
  } catch (err) {
    console.error(err);
    renderErrorCarga();
  }
}

/* ---------- Formularios ---------- */

function initForms() {
  document.getElementById('form-asignatura').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/api/asignaturas', {
      method: 'POST',
      body: JSON.stringify({ nombre: fd.get('nombre'), color: fd.get('color') }),
    });
    e.target.reset();
    await loadAll();
  });

  document.getElementById('form-examen').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/api/examenes', {
      method: 'POST',
      body: JSON.stringify({
        asignatura_id: Number(fd.get('asignatura_id')),
        fecha: new Date(fd.get('fecha')).toISOString(),
        notas: fd.get('notas'),
      }),
    });
    e.target.reset();
    await loadAll();
  });

  const formHorario = document.getElementById('form-horario');
  formHorario.elements['fecha_desde'].value = ymd(new Date());
  formHorario.addEventListener('submit', async (e) => {
    e.preventDefault();
    const aviso = document.getElementById('horario-error');
    aviso.hidden = true;
    const fd = new FormData(e.target);
    const dias = fd.getAll('dias').map(Number);
    if (dias.length === 0) {
      aviso.textContent = 'Elige al menos un día de la semana.';
      aviso.hidden = false;
      return;
    }
    try {
      await api('/api/horarios', {
        method: 'POST',
        body: JSON.stringify({
          asignatura_id: Number(fd.get('asignatura_id')),
          dias_semana: dias,
          fecha_desde: fd.get('fecha_desde'),
          fecha_hasta: fd.get('fecha_hasta'),
          hora: fd.get('hora') || '16:00',
          duracion_min: Number(fd.get('duracion_min')),
        }),
      });
    } catch (err) {
      aviso.textContent = err.message;
      aviso.hidden = false;
      return;
    }
    e.target.reset();
    e.target.elements['fecha_desde'].value = ymd(new Date());
    await loadAll();
  });

  document.getElementById('form-tarea').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const id = fd.get('id');
    const payload = {
      asignatura_id: Number(fd.get('asignatura_id')),
      tema_id: fd.get('tema_id') ? Number(fd.get('tema_id')) : null,
      titulo: fd.get('titulo'),
      fecha_limite: fd.get('fecha_limite')
        ? new Date(`${fd.get('fecha_limite')}T${fd.get('hora_limite') || '00:00'}`).toISOString()
        : null,
      prioridad: fd.get('prioridad'),
      opcional: fd.get('opcional') === '1',
    };
    if (id) {
      await api(`/api/tareas/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/tareas', { method: 'POST', body: JSON.stringify(payload) });
    }
    cancelEditTarea();
    await loadAll();
  });

  // Al cambiar de asignatura, el selector de tema pasa a mostrar los temas de la nueva.
  document.querySelector('#form-tarea select[name="asignatura_id"]').addEventListener('change', () => fillTemaSelect(''));

  // Las obligatorias nacen con prioridad alta; las opcionales con media (solo al crear).
  document.querySelector('#form-tarea select[name="opcional"]').addEventListener('change', (e) => {
    const form = e.target.form;
    if (!form.elements['id'].value) form.elements['prioridad'].value = e.target.value === '1' ? 'media' : 'alta';
  });

  // Los bugs nacen con prioridad alta; las actualizaciones con media (solo al crear).
  document.querySelector('#form-tarea-servidor select[name="tipo"]').addEventListener('change', (e) => {
    const form = e.target.form;
    if (!form.elements['id'].value) form.elements['prioridad'].value = e.target.value === 'bug' ? 'alta' : 'media';
  });

  document.getElementById('lista-asignaturas').addEventListener('submit', async (e) => {
    const form = e.target;
    if (!form.classList.contains('form-apartado')) return;
    e.preventDefault();
    const fd = new FormData(form);
    await api('/api/subtemas', {
      method: 'POST',
      body: JSON.stringify({ tema_id: Number(fd.get('tema_id')), titulo: fd.get('titulo') }),
    });
    await loadAll();
  });

  document.getElementById('form-categoria-servidor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/api/categorias-servidor', {
      method: 'POST',
      body: JSON.stringify({ nombre: fd.get('nombre'), color: fd.get('color') }),
    });
    e.target.reset();
    await loadAll();
  });

  document.getElementById('form-tarea-servidor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const id = fd.get('id');
    const payload = {
      tipo: fd.get('tipo'),
      categoria_id: Number(fd.get('categoria_id')),
      titulo: fd.get('titulo'),
      descripcion: fd.get('descripcion'),
      prioridad: fd.get('prioridad'),
    };
    if (id) {
      await api(`/api/tareas-servidor/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/tareas-servidor', { method: 'POST', body: JSON.stringify(payload) });
    }
    cancelEditTareaServidor();
    await loadAll();
  });
}

/* ---------- Acciones de lista ---------- */

function initListActions() {
  document.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'del-asignatura') {
      const asig = state.asignaturas.find((a) => a.id === Number(id));
      if (!confirm(`¿Eliminar "${asig?.nombre ?? 'la asignatura'}" con sus exámenes, tareas y temas?`)) return;
      await api(`/api/asignaturas/${id}`, { method: 'DELETE' });
      await loadAll();
    } else if (action === 'cal-prev' || action === 'cal-next') {
      const d = new Date(state.calMes.y, state.calMes.m + (action === 'cal-next' ? 1 : -1), 1);
      state.calMes = { y: d.getFullYear(), m: d.getMonth() };
      renderCalendario();
    } else if (action === 'sem-prev' || action === 'sem-next' || action === 'sem-hoy') {
      if (action === 'sem-hoy') {
        state.semanaInicio = lunesDe(new Date());
      } else {
        const d = new Date(state.semanaInicio);
        d.setDate(d.getDate() + (action === 'sem-next' ? 7 : -7));
        state.semanaInicio = d;
      }
      renderHorario();
    } else if (action === 'add-tema') {
      // El servidor le pone el nombre: "Tema 1" si no hay ninguno, o el siguiente número.
      await api('/api/temas', { method: 'POST', body: JSON.stringify({ asignatura_id: Number(id) }) });
      state.abiertas.add(Number(id));
      await loadAll();
    } else if (action === 'del-horario') {
      await api(`/api/horarios/${id}`, { method: 'DELETE' });
      await loadAll();
    } else if (action === 'reintentar') {
      await loadAll();
    } else if (action === 'del-tema') {
      const tema = state.temas.find((t) => t.id === Number(id));
      if (!confirm(`¿Eliminar el tema "${tema?.titulo ?? ''}" y sus apartados? Las tareas enlazadas se conservan, sin tema.`)) return;
      await api(`/api/temas/${id}`, { method: 'DELETE' });
      await loadAll();
    } else if (action === 'del-subtema') {
      await api(`/api/subtemas/${id}`, { method: 'DELETE' });
      await loadAll();
    } else if (action === 'reabrir-tarea') {
      await api(`/api/tareas/${id}`, { method: 'PUT', body: JSON.stringify({ estado: 'pendiente' }) });
      await loadAll();
    } else if (action === 'del-examen') {
      await api(`/api/examenes/${id}`, { method: 'DELETE' });
      await loadAll();
    } else if (action === 'del-tarea') {
      await api(`/api/tareas/${id}`, { method: 'DELETE' });
      await loadAll();
    } else if (action === 'edit-tarea') {
      const tarea = state.tareas.find((t) => t.id === Number(id));
      if (tarea) startEditTarea(tarea);
    } else if (action === 'cancelar-tarea') {
      cancelEditTarea();
    } else if (action === 'del-categoria-servidor') {
      if (!confirm('¿Eliminar categoría y sus tareas asociadas?')) return;
      await api(`/api/categorias-servidor/${id}`, { method: 'DELETE' });
      await loadAll();
    } else if (action === 'del-tarea-servidor') {
      await api(`/api/tareas-servidor/${id}`, { method: 'DELETE' });
      await loadAll();
    } else if (action === 'edit-tarea-servidor') {
      const tarea = state.tareasServidor.find((t) => t.id === Number(id));
      if (tarea) startEditTareaServidor(tarea);
    } else if (action === 'cancelar-tarea-servidor') {
      cancelEditTareaServidor();
    }
  });

  document.body.addEventListener(
    'toggle',
    (e) => {
      const id = Number(e.target.dataset?.asignatura);
      if (!id) return;
      if (e.target.open) state.abiertas.add(id);
      else state.abiertas.delete(id);
    },
    true
  );

  document.body.addEventListener('change', async (e) => {
    const check = e.target.closest('input[data-action]');
    if (check) {
      const { action, tipo, id } = check.dataset;
      if (action === 'toggle-tema') {
        await api(`/api/temas/${id}`, { method: 'PUT', body: JSON.stringify({ completado: check.checked }) });
      } else if (action === 'toggle-hijo' && tipo === 'tarea') {
        // Misma fuente de verdad que la pestaña Tareas: marcar aquí es marcar allí.
        await api(`/api/tareas/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ estado: check.checked ? 'hecha' : 'pendiente' }),
        });
      } else if (action === 'toggle-hijo') {
        await api(`/api/subtemas/${id}`, { method: 'PUT', body: JSON.stringify({ completado: check.checked }) });
      }
      await loadAll();
      return;
    }
    const horas = e.target.closest('select[data-action="horas-hijo"]');
    if (horas) {
      const recurso = horas.dataset.tipo === 'tarea' ? 'tareas' : 'subtemas';
      await api(`/api/${recurso}/${horas.dataset.id}`, { method: 'PUT', body: JSON.stringify({ horas: Number(horas.value) }) });
      await loadAll();
      return;
    }
    const select = e.target.closest('select[data-action="estado-tarea"]');
    if (!select) return;
    await api(`/api/tareas/${select.dataset.id}`, {
      method: 'PUT',
      body: JSON.stringify({ estado: select.value }),
    });
    await loadAll();
  });
}

function initIcsHint() {
  const url = `${location.origin}/calendar.ics`;
  document.getElementById('ics-url').textContent = url;
  document.getElementById('copy-ics').addEventListener('click', async () => {
    await navigator.clipboard.writeText(url);
    const btn = document.getElementById('copy-ics');
    btn.textContent = 'Copiado';
    setTimeout(() => (btn.textContent = 'Copiar'), 1500);
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

initTabs();
initAppSwitch();
initDashboardLinks();
initForms();
initListActions();
initIcsHint();
loadAll();
