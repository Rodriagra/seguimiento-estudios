# Seguimiento Estudios

App de seguimiento de asignaturas, exámenes y tareas del curso, con feed de calendario ICS. Sustituye a Notion/TickTick para este uso.

- Backend: Node.js + Express + `node:sqlite` (base de datos SQLite nativa de Node, sin dependencias de compilación).
- Frontend: una sola página, vanilla JS, sin build.
- `/calendar.ics`: feed de calendario (exámenes + tareas pendientes, con aviso 24h antes) para suscribir en Google Calendar / Calendario de iOS.
- PWA instalable (icono en pantalla de inicio).

## 0. Publicar la imagen en GHCR (una vez)

1. Crea un repositorio **privado** en GitHub y sube este código:
   ```bash
   git init
   git add .
   git commit -m "Seguimiento Estudios"
   git branch -M main
   git remote add origin https://github.com/Rodriagra/seguimiento-estudios.git
   git push -u origin main
   ```
2. El workflow `.github/workflows/docker-publish.yml` se dispara solo en cada push a `main`: construye la imagen y la publica en `ghcr.io/rodriagra/seguimiento-estudios:latest`.
3. `docker-compose.yml` ya apunta a esa imagen.
4. Si el paquete queda privado en GHCR, en el NAS haz login antes de desplegar (con un [token de acceso personal](https://github.com/settings/tokens) con permiso `read:packages`):
   ```bash
   docker login ghcr.io -u Rodriagra
   ```

A partir de aquí, cada `git push` a `main` reconstruye la imagen y **Watchtower** la despliega sola en el NAS (misma label que ya usas en Sonarr/Radarr).

## Despliegue en Dockge / TrueNAS SCALE

1. Crea la carpeta de datos: `/mnt/tank/appdata/seguimiento-estudios`.
2. En Dockge, añade un nuevo stack pegando `docker-compose.yml`.
3. Ajusta el label de Traefik (`estudios.local`) a tu convención de hosts local.
4. Levanta el stack.

Sin GitHub montado todavía, puedes arrancar en local: comenta la línea `image:` y descomenta `build: .` en `docker-compose.yml`.

## Desarrollo local

```bash
npm install
npm run dev
```

Requiere Node **22.5+** (usa el módulo experimental `node:sqlite`, incluido de serie, sin instalar nada extra).

La app queda en `http://localhost:3000`.

## Acceso desde el móvil

- **En casa**: `http://estudios.local` (o la IP del NAS) a través de tu Traefik local.
- **Fuera de casa**: mismo acceso pero conectado a tu red **Tailscale** (igual que ya haces con Filebrowser). Traefik no está expuesto a internet, así que fuera de casa siempre pasa por Tailscale.

## Icono en la pantalla de inicio (PWA)

Desde el navegador del móvil, abre la app y usa "Añadir a pantalla de inicio" (Android: menú ⋮ → Añadir a pantalla de inicio; iOS: Compartir → Añadir a pantalla de inicio). Se instala como icono a pantalla completa.

## Calendario nativo con widget y notificaciones

Los widgets de pantalla de inicio son cosa de apps nativas, no de webs/PWAs. Para tener el calendario real con widget y notificaciones:

1. Abre `http://<tu-instancia>/calendar.ics` (hay un botón "Copiar" en el Dashboard de la propia app).
2. En Google Calendar: **Otros calendarios → Desde URL** → pega el enlace.
3. En Calendario de iOS: **Ajustes → Calendario → Cuentas → Añadir cuenta → Otra → Calendario con suscripción** → pega el enlace.

El feed se regenera en cada petición con los exámenes y tareas pendientes actuales, con recordatorio 24h antes de cada evento.

## Modelo de datos

- **Asignaturas**: nombre + color (las 8 del curso se precargan solas al primer arranque).
- **Exámenes**: asignatura, fecha/hora, notas.
- **Tareas**: asignatura, título, fecha límite, estado (pendiente / en progreso / hecha), prioridad (alta / media / baja).

## Notas de diseño

- El feed `/calendar.ics` no lleva autenticación (solo expone fechas de exámenes/tareas, sin datos sensibles, y el acceso ya está acotado por Traefik local + Tailscale). Si prefieres protegerlo con un token en la URL, es un cambio pequeño en `server/index.js`.
- Puerto por defecto `3000` y volumen `/mnt/tank/appdata/seguimiento-estudios`, ambos ajustables en `docker-compose.yml`.
