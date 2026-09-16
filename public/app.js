const state = { asignaturas: [], examenes: [], tareas: [], categoriasServidor: [], tareasServidor: [] };

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

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nav = btn.closest('nav');
      nav.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById(`tab-${btn.dataset.tab}`);
      panel.parentElement.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      panel.classList.add('active');
    });
  });
}

const APP_TITLES = {
  estudios: '📚 Seguimiento Estudios',
  servidor: '🖥️ Tareas del Servidor',
};

function initAppSwitch() {
  document.querySelectorAll('.app-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const app = btn.dataset.app;
      document.querySelectorAll('.app-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('[data-app-tabs]').forEach((nav) => {
        nav.hidden = nav.dataset.appTabs !== app;
      });
      document.querySelectorAll('[data-app-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.appPanel !== app;
      });
      document.getElementById('app-title').textContent = APP_TITLES[app];
    });
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
    .map(
      (a) => `
    <li>
      <div class="item-main">
        <span class="tag" style="background:${a.color}">${a.nombre}</span>
      </div>
      <div class="item-actions">
        <button class="action-danger" data-action="del-asignatura" data-id="${a.id}">Eliminar</button>
      </div>
    </li>`
    )
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
  if (state.tareas.length === 0) {
    ul.innerHTML = '<li class="empty-hint">No hay tareas todavía.</li>';
    return;
  }
  ul.innerHTML = state.tareas
    .map(
      (t) => `
    <li style="border-left-color:${t.asignatura_color}">
      <div class="item-main">
        <span class="item-title">${t.titulo}</span>
        <span class="item-meta">${t.asignatura_nombre} · ${fmtDate(t.fecha_limite)} · prioridad ${t.prioridad}</span>
      </div>
      <div class="item-actions">
        <select data-action="estado-tarea" data-id="${t.id}">
          <option value="pendiente" ${t.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
          <option value="en_progreso" ${t.estado === 'en_progreso' ? 'selected' : ''}>En progreso</option>
          <option value="hecha" ${t.estado === 'hecha' ? 'selected' : ''}>Hecha</option>
        </select>
        <button class="action-danger" data-action="del-tarea" data-id="${t.id}">Eliminar</button>
      </div>
    </li>`
    )
    .join('');
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
    .map((t) => {
      const meta = [
        t.categoria_nombre,
        `prioridad ${t.prioridad}`,
        t.opcional ? 'opcional' : 'obligatoria',
        t.fecha_limite ? fmtDate(t.fecha_limite) : 'sin fecha',
        t.descripcion || null,
      ]
        .filter(Boolean)
        .join(' · ');
      return `
    <li style="border-left-color:${t.categoria_color}">
      <div class="item-main">
        <span class="item-title">${t.titulo}</span>
        <span class="item-meta">${meta}</span>
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
    </li>`;
    })
    .join('');
}

function startEditTareaServidor(tarea) {
  const form = document.getElementById('form-tarea-servidor');
  form.elements['id'].value = tarea.id;
  form.elements['categoria_id'].value = tarea.categoria_id;
  form.elements['titulo'].value = tarea.titulo;
  form.elements['descripcion'].value = tarea.descripcion || '';
  form.elements['fecha_limite'].value = toDatetimeLocalValue(tarea.fecha_limite);
  form.elements['prioridad'].value = tarea.prioridad;
  form.elements['opcional'].value = tarea.opcional ? '1' : '0';
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

async function renderDashboard() {
  const data = await api('/api/dashboard');
  const examenesUl = document.getElementById('dashboard-examenes');
  examenesUl.innerHTML =
    data.examenes.length === 0
      ? '<li class="empty-hint">Sin exámenes próximos.</li>'
      : data.examenes
          .map(
            (e) => `<li style="border-left-color:${e.asignatura_color}">${e.asignatura_nombre} · ${fmtDate(e.fecha)}</li>`
          )
          .join('');

  const tareasUl = document.getElementById('dashboard-tareas');
  tareasUl.innerHTML =
    data.tareas.length === 0
      ? '<li class="empty-hint">Sin tareas pendientes.</li>'
      : data.tareas
          .map(
            (t) => `<li style="border-left-color:${t.asignatura_color}">${t.titulo} · ${fmtDate(t.fecha_limite)}</li>`
          )
          .join('');
}

async function loadAll() {
  const [asignaturas, examenes, tareas, categoriasServidor, tareasServidor] = await Promise.all([
    api('/api/asignaturas'),
    api('/api/examenes'),
    api('/api/tareas'),
    api('/api/categorias-servidor'),
    api('/api/tareas-servidor'),
  ]);
  state.asignaturas = asignaturas;
  state.examenes = examenes;
  state.tareas = tareas;
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
    await api('/api/tareas', {
      method: 'POST',
      body: JSON.stringify({
        asignatura_id: Number(fd.get('asignatura_id')),
        titulo: fd.get('titulo'),
        fecha_limite: new Date(fd.get('fecha_limite')).toISOString(),
        prioridad: fd.get('prioridad'),
      }),
    });
    e.target.reset();
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
      opcional: fd.get('opcional') === '1',
      fecha_limite: fd.get('fecha_limite') ? new Date(fd.get('fecha_limite')).toISOString() : null,
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
    if (action === 'del-asignatura' && confirm('¿Eliminar asignatura y sus exámenes/tareas asociadas?')) {
      await api(`/api/asignaturas/${id}`, { method: 'DELETE' });
      await loadAll();
    } else if (action === 'del-examen') {
      await api(`/api/examenes/${id}`, { method: 'DELETE' });
      await loadAll();
    } else if (action === 'del-tarea') {
      await api(`/api/tareas/${id}`, { method: 'DELETE' });
      await loadAll();
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

  document.body.addEventListener('change', async (e) => {
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
initForms();
initListActions();
initIcsHint();
loadAll();
