const state = {
  asignaturas: [],
  examenes: [],
  tareas: [],
  temas: [],
  categoriasServidor: [],
  tareasServidor: [],
  abiertas: new Set(),
  calMes: { y: new Date().getFullYear(), m: new Date().getMonth() },
};

const fmtDate = (iso) =>
  new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const toDatetimeLocalValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

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

const APP_TITLES = {
  dashboard: '🏠 Dashboard',
  estudios: '📚 Seguimiento Estudios',
  servidor: '🖥️ Tareas del Servidor',
};

function switchApp(app) {
  document.querySelectorAll('.app-btn').forEach((b) => b.classList.toggle('active', b.dataset.app === app));
  document.querySelectorAll('[data-app-tabs]').forEach((nav) => {
    nav.hidden = nav.dataset.appTabs !== app;
  });
  document.querySelectorAll('[data-app-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.appPanel !== app;
  });
  document.getElementById('app-title').textContent = APP_TITLES[app];
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

function fillAsignaturaSelects() {
  document.querySelectorAll('select[name="asignatura_id"]').forEach((select) => {
    select.innerHTML = state.asignaturas
      .map((a) => `<option value="${a.id}">${a.nombre}</option>`)
      .join('');
  });
}

function fillCategoriaServidorSelects() {
  document.querySelectorAll('select[name="categoria_id"]').forEach((select) => {
    select.innerHTML = state.categoriasServidor
      .map((c) => `<option value="${c.id}">${c.nombre}</option>`)
      .join('');
  });
}

function renderAsignaturas() {
  const ul = document.getElementById('lista-asignaturas');
  if (state.asignaturas.length === 0) {
    ul.innerHTML = '<li class="empty-hint">No hay asignaturas todavía.</li>';
    return;
  }
  ul.innerHTML = state.asignaturas
    .map((a) => {
      const temas = state.temas.filter((t) => t.asignatura_id === a.id);
      const hechos = temas.filter((t) => t.completado).length;
      const completadas = state.tareas.filter((t) => t.asignatura_id === a.id && t.estado === 'hecha');
      const temasHtml = temas.length
        ? temas
            .map(
              (t) => `
          <li class="tema ${t.completado ? 'done' : ''}">
            <label>
              <input type="checkbox" data-action="toggle-tema" data-id="${t.id}" ${t.completado ? 'checked' : ''} />
              <span>${t.titulo}</span>
            </label>
            <button class="action-danger" data-action="del-tema" data-id="${t.id}">✕</button>
          </li>`
            )
            .join('')
        : '<li class="empty-hint">Sin temas todavía.</li>';
      const completadasHtml = completadas.length
        ? completadas
            .map(
              (t) => `
          <li class="tema done">
            <span>✔ ${t.titulo}${t.opcional ? ' <em>(opcional)</em>' : ''}</span>
            <button class="action-secondary" data-action="reabrir-tarea" data-id="${t.id}">Reabrir</button>
          </li>`
            )
            .join('')
        : '<li class="empty-hint">Ninguna tarea completada.</li>';
      return `
    <li class="asignatura-item" style="border-left-color:${a.color}">
      <details data-asignatura="${a.id}" ${state.abiertas.has(a.id) ? 'open' : ''}>
        <summary>
          <span class="tag" style="background:${a.color}">${a.nombre}</span>
          <span class="item-meta">${hechos}/${temas.length} temas · ${completadas.length} tareas completadas</span>
          <button class="action-danger" data-action="del-asignatura" data-id="${a.id}">Eliminar</button>
        </summary>
        <div class="asignatura-detalle">
          <h4>Temas</h4>
          <form class="inline-form form-tema" data-asignatura-id="${a.id}">
            <input type="text" name="titulo" placeholder="Nuevo tema" required />
            <button type="submit">Añadir tema</button>
          </form>
          <ul class="sub-list">${temasHtml}</ul>
          <h4>Tareas completadas</h4>
          <ul class="sub-list">${completadasHtml}</ul>
        </div>
      </details>
    </li>`;
    })
    .join('');
}

function renderExamenes() {
  const ul = document.getElementById('lista-examenes');
  if (state.examenes.length === 0) {
    ul.innerHTML = '<li class="empty-hint">No hay exámenes todavía.</li>';
    return;
  }
  ul.innerHTML = state.examenes
    .map(
      (e) => `
    <li style="border-left-color:${e.asignatura_color}">
      <div class="item-main">
        <span class="item-title">${e.asignatura_nombre}</span>
        <span class="item-meta">${fmtDate(e.fecha)}${e.notas ? ' · ' + e.notas : ''}</span>
      </div>
      <div class="item-actions">
        <button class="action-danger" data-action="del-examen" data-id="${e.id}">Eliminar</button>
      </div>
    </li>`
    )
    .join('');
}

function renderTareas() {
  const ul = document.getElementById('lista-tareas');
  const pendientes = state.tareas.filter((t) => t.estado !== 'hecha');
  if (pendientes.length === 0) {
    ul.innerHTML = '<li class="empty-hint">No hay tareas pendientes.</li>';
    return;
  }
  ul.innerHTML = pendientes
    .map((t) => {
      const meta = [
        t.asignatura_nombre,
        t.fecha_limite ? fmtDate(t.fecha_limite) : 'sin fecha',
        `prioridad ${t.prioridad}`,
        t.opcional ? 'opcional' : 'obligatoria',
      ].join(' · ');
      return `
    <li style="border-left-color:${t.asignatura_color}">
      <div class="item-main">
        <span class="item-title">${t.titulo}</span>
        <span class="item-meta">${meta}</span>
      </div>
      <div class="item-actions">
        <select data-action="estado-tarea" data-id="${t.id}">
          <option value="pendiente" ${t.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
          <option value="en_progreso" ${t.estado === 'en_progreso' ? 'selected' : ''}>En progreso</option>
          <option value="hecha" ${t.estado === 'hecha' ? 'selected' : ''}>Hecha</option>
        </select>
        <button class="action-secondary" data-action="edit-tarea" data-id="${t.id}">Editar</button>
        <button class="action-danger" data-action="del-tarea" data-id="${t.id}">Eliminar</button>
      </div>
    </li>`;
    })
    .join('');
}

function startEditTarea(tarea) {
  const form = document.getElementById('form-tarea');
  form.elements['id'].value = tarea.id;
  form.elements['asignatura_id'].value = tarea.asignatura_id;
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
  document.getElementById('btn-tarea-submit').textContent = 'Añadir';
  document.getElementById('btn-tarea-cancelar').hidden = true;
}

function renderCategoriasServidor() {
  const ul = document.getElementById('lista-categorias-servidor');
  if (state.categoriasServidor.length === 0) {
    ul.innerHTML = '<li class="empty-hint">No hay categorías todavía.</li>';
    return;
  }
  ul.innerHTML = state.categoriasServidor
    .map(
      (c) => `
    <li>
      <div class="item-main">
        <span class="tag" style="background:${c.color}">${c.nombre}</span>
      </div>
      <div class="item-actions">
        <button class="action-danger" data-action="del-categoria-servidor" data-id="${c.id}">Eliminar</button>
      </div>
    </li>`
    )
    .join('');
}

function renderTareasServidor() {
  const ul = document.getElementById('lista-tareas-servidor');
  if (state.tareasServidor.length === 0) {
    ul.innerHTML = '<li class="empty-hint">No hay tareas todavía.</li>';
    return;
  }
  ul.innerHTML = state.tareasServidor
    .map(
      (t) => `
    <li style="border-left-color:${t.categoria_color}">
      <div class="item-main">
        <span class="item-title">${t.titulo}</span>
        <span class="item-meta">${t.categoria_nombre} · prioridad ${t.prioridad}${t.descripcion ? ' · ' + t.descripcion : ''}</span>
      </div>
      <div class="item-actions">
        <select data-action="estado-tarea-servidor" data-id="${t.id}">
          <option value="pendiente" ${t.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
          <option value="en_progreso" ${t.estado === 'en_progreso' ? 'selected' : ''}>En progreso</option>
          <option value="hecha" ${t.estado === 'hecha' ? 'selected' : ''}>Hecha</option>
        </select>
        <button class="action-secondary" data-action="edit-tarea-servidor" data-id="${t.id}">Editar</button>
        <button class="action-danger" data-action="del-tarea-servidor" data-id="${t.id}">Eliminar</button>
      </div>
    </li>`
    )
    .join('');
}

function startEditTareaServidor(tarea) {
  const form = document.getElementById('form-tarea-servidor');
  form.elements['id'].value = tarea.id;
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
  document.getElementById('btn-tarea-servidor-submit').textContent = 'Añadir';
  document.getElementById('btn-tarea-servidor-cancelar').hidden = true;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
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

  let celdas = '';
  for (let i = 0; i < primerDia; i++) celdas += '<span class="cal-day empty"></span>';
  for (let d = 1; d <= diasMes; d++) {
    const exs = porDia[d] || [];
    const esHoy = d === hoy.getDate() && m === hoy.getMonth() && y === hoy.getFullYear();
    const dots = exs.map((e) => `<i style="background:${e.asignatura_color}"></i>`).join('');
    const title = exs.map((e) => e.asignatura_nombre).join(', ');
    celdas += `<span class="cal-day${esHoy ? ' today' : ''}${exs.length ? ' has-exam' : ''}" ${title ? `title="${title}"` : ''}>
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
    </div>`;
}

async function renderDashboard() {
  renderCalendario();
  const data = await api('/api/dashboard');
  const examenesUl = document.getElementById('dashboard-examenes');
  examenesUl.innerHTML =
    data.examenes.length === 0
      ? '<li class="empty-hint">Sin exámenes próximos.</li>'
      : data.examenes
          .map(
            (e) => `
    <li style="border-left-color:${e.asignatura_color}" data-goto-app="estudios" data-goto-tab="examenes">
      ${e.asignatura_nombre} · ${fmtDate(e.fecha)}
    </li>`
          )
          .join('');

  const tareasEstudiosUl = document.getElementById('dashboard-tareas-estudios');
  tareasEstudiosUl.innerHTML =
    data.tareasEstudios.length === 0
      ? '<li class="empty-hint">Sin tareas pendientes.</li>'
      : data.tareasEstudios
          .map(
            (t) => `
    <li style="border-left-color:${t.asignatura_color}" data-goto-app="estudios" data-goto-tab="tareas">
      ${t.titulo} · ${fmtDate(t.fecha_limite)}
    </li>`
          )
          .join('');

  const tareasServidorUl = document.getElementById('dashboard-tareas-servidor');
  tareasServidorUl.innerHTML =
    data.tareasServidor.length === 0
      ? '<li class="empty-hint">Sin tareas pendientes.</li>'
      : data.tareasServidor
          .map(
            (t) => `
    <li style="border-left-color:${t.categoria_color}" data-goto-app="servidor" data-goto-tab="servidor-tareas">
      ${t.titulo} · ${t.categoria_nombre}
    </li>`
          )
          .join('');
}

async function loadAll() {
  const [asignaturas, examenes, tareas, temas, categoriasServidor, tareasServidor] = await Promise.all([
    api('/api/asignaturas'),
    api('/api/examenes'),
    api('/api/tareas'),
    api('/api/temas'),
    api('/api/categorias-servidor'),
    api('/api/tareas-servidor'),
  ]);
  state.asignaturas = asignaturas;
  state.examenes = examenes;
  state.tareas = tareas;
  state.temas = temas;
  state.categoriasServidor = categoriasServidor;
  state.tareasServidor = tareasServidor;
  fillAsignaturaSelects();
  fillCategoriaServidorSelects();
  renderAsignaturas();
  renderExamenes();
  renderTareas();
  renderCategoriasServidor();
  renderTareasServidor();
  await renderDashboard();
}

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

  document.getElementById('form-tarea').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const id = fd.get('id');
    const payload = {
      asignatura_id: Number(fd.get('asignatura_id')),
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

  document.getElementById('lista-asignaturas').addEventListener('submit', async (e) => {
    const form = e.target.closest('.form-tema');
    if (!form) return;
    e.preventDefault();
    const fd = new FormData(form);
    await api('/api/temas', {
      method: 'POST',
      body: JSON.stringify({ asignatura_id: Number(form.dataset.asignaturaId), titulo: fd.get('titulo') }),
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

function initListActions() {
  document.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'del-asignatura') {
      e.preventDefault(); // el botón está dentro de <summary>: no desplegar/plegar
      if (!confirm('¿Eliminar asignatura y sus exámenes/tareas/temas asociados?')) return;
      await api(`/api/asignaturas/${id}`, { method: 'DELETE' });
      await loadAll();
    } else if (action === 'cal-prev' || action === 'cal-next') {
      const d = new Date(state.calMes.y, state.calMes.m + (action === 'cal-next' ? 1 : -1), 1);
      state.calMes = { y: d.getFullYear(), m: d.getMonth() };
      renderCalendario();
    } else if (action === 'del-tema') {
      await api(`/api/temas/${id}`, { method: 'DELETE' });
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
    } else if (action === 'del-categoria-servidor' && confirm('¿Eliminar categoría y sus tareas asociadas?')) {
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

  document.body.addEventListener('toggle', (e) => {
    const id = Number(e.target.dataset?.asignatura);
    if (!id) return;
    if (e.target.open) state.abiertas.add(id);
    else state.abiertas.delete(id);
  }, true);

  document.body.addEventListener('change', async (e) => {
    const check = e.target.closest('input[data-action="toggle-tema"]');
    if (check) {
      await api(`/api/temas/${check.dataset.id}`, {
        method: 'PUT',
        body: JSON.stringify({ completado: check.checked }),
      });
      await loadAll();
      return;
    }
    const select = e.target.closest('select[data-action="estado-tarea"], select[data-action="estado-tarea-servidor"]');
    if (!select) return;
    const endpoint = select.dataset.action === 'estado-tarea-servidor' ? 'tareas-servidor' : 'tareas';
    await api(`/api/${endpoint}/${select.dataset.id}`, {
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
