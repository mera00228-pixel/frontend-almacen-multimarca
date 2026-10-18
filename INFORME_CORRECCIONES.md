# Informe de correcciones — Integración frontend ↔ backend (Railway)

**Fecha:** 17/10/2026
**Frontend:** `frontend-almacen-multimarca` (Express + EJS + fetch)
**Backend:** `backend-almacen-multimarca` (Express + MySQL, desplegado en Railway)

---

## 1. Diagnóstico

| # | Problema | Impacto |
|---|----------|---------|
| 1 | El código integrado (JS cliente, `npm start`, estilos) **no estaba commiteado ni pusheado**. El repo remoto solo contenía el esqueleto inicial. | Railway desplegaba una versión sin integración alguna: sin script de arranque y sin llamadas al backend. |
| 2 | `API_URL` usaba `http://localhost:3000/api` como valor por defecto. | En producción el navegador intentaba llamar a la máquina del usuario; el navegador bloquea la petición (mixed-content HTTP dentro de HTTPS). |
| 3 | La URL del backend documentada (`https://backend-almacen-multimarca-production-b0d5.up.railway.app`) **responde 404 en todas las rutas**. | La URL real en Railway cambió o el servicio fue redeployado con otro dominio. Hay que reemplazarla por la del dashboard. |
| 4 | El backend controla CORS con la variable `CLIENT_URL` (default `*`). | Funciona sin configurar, pero no está restringido al origen del frontend. |
| 5 | `api.js`: el mensaje de error de conexión hardcodeaba `http://localhost:3000`. | Mensajes confusos en producción. |
| 6 | `api.js`: el payload del JWT se decodificaba con `atob` sin adaptar **base64url** (guiones `_`/`-`). | `getUsuario()` podía fallar silenciosamente con ciertos tokens. |
| 7 | `api.js`: `fetch` sin timeout. | Con el cold start de Railway (servicio dormido) la petición podía quedar colgada indefinidamente. |
| 8 | `productos.js`: no validaba que la respuesta fuera un array y pintaba el HTML del backend sin escape. | Pantalla rota si `API_URL` apunta mal; vulnerabilidad XSS si un producto contiene HTML en sus campos. |
| 9 | El frontend no tenía `railway.json` ni ruta `/health`. | Sin healthcheck ni política de reinicio configuradas para el servicio de frontend. |

**Compatibilidad ya verificada (sin cambios necesarios):**

- Login: `POST /api/login` con body `{ "usuario", "contraseña" }` (con ñ) → respuesta `{ token }`. El frontend coincide.
- Productos: `GET /api/productos` devuelve **array directo**. El frontend lo itera correctamente.
- Campos en **snake_case** (`codigo_barras`, `precio_venta`, `marca_id`, …) en ambos lados.
- Auth: header `Authorization: Bearer <token>`; el payload del JWT contiene `{ id, usuario }`, que es lo que decodifica `getUsuario()`.

---

## 2. Correcciones implementadas

### 2.1 `app.js`
- `API_URL` por defecto ahora apunta al backend de Railway: `https://backend-almacen-multimarca-production-b0d5.up.railway.app/api` (sigue siendo posible sobreescribirla con la variable de entorno `API_URL`).
- Nueva ruta `GET /health` → `{ status, uptime }` para el healthcheck de Railway.
- `app.set('trust proxy', 1)` (correcto detrás del proxy de Railway).
- Se conserva `process.env.PORT` y el bind en `0.0.0.0`.

### 2.2 `public/js/api.js`
- Fallback de `window.__API_URL__` alineado con la URL de Railway.
- Mensaje de error de conexión dinámico: incluye la `API_URL` real usada.
- Timeout de 15 s con `AbortController`; mensaje específico cuando expira (típico del cold start de Railway).
- Decodificación del JWT corregida a **base64url** (`-`→`+`, `_`→`/`) antes de `atob`.

### 2.3 `public/js/productos.js`
- Validación `Array.isArray()` sobre la respuesta de `/api/productos` con mensaje claro (suele indicar una `API_URL` sin `/api`).
- Función `escapar()` aplicada a `nombre`, `descripcion` y `codigo_barras` al pintar la tabla (previene XSS).
- Null-safe: `stock_minimo ?? 5` y `Number(estado) === 1`.

### 2.4 `railway.json` (nuevo)
- Builder NIXPACKS, `startCommand: npm start`, `healthcheckPath: /health`, reinicio con reintento en fallo (mismo patrón que el backend).

### 2.5 `package.json` / `public/js/` / vistas / CSS (ya estaban en el working copy)
- `npm start` definido; vistas EJS inyectan `window.__API_URL__`; cliente fetch completo.

---

## 3. Configuración manual pendiente en Railway

### 3.1 Backend (servicio API)
1. **Variables → `CLIENT_URL`** = URL del frontend desplegado (por ejemplo `https://frontend-almacen-multimarca.up.railway.app`). Acepta varias URLs separadas por coma. Si se omite, el default es `*` (CORS abierto).
2. **Obtener la URL real del servicio**: en el dashboard de Railway → servicio backend → tab *Networking* / *Settings* → dominio `*.up.railway.app`. La documentada (`...b0d5...`) ya no responde.

### 3.2 Frontend (servicio web)
1. **Variables → `API_URL`** = `<URL_REAL_DEL_BACKEND>/api` (debe terminar en `/api`).
   - Aunque el default del código ya apunta al backend, se recomienda definirla explícitamente para no depender del código.
   - Si la URL real cambió respecto a la documentada, actualizar el default en `app.js` (línea del `API_URL`) o sobreescribirla con esta variable.
2. El servicio debe usar el **start command** `npm start` (NIXPACKS lo detecta; `railway.json` lo fija) y el healthcheck `/health` quedará activo.

### 3.3 Credenciales de prueba
- Usuario seed: `admin` / `1234` (creado por el backend en la primera migración).

---

## 4. Pasos de verificación

1. Abrir la URL del frontend → debe cargar el login.
2. `GET <frontend>/health` → `{"status":"ok",...}`.
3. `GET <backend>/health` → `{"status":"ok",...}`.
4. Iniciar sesión con `admin` / `1234` → redirige a `/productos` y lista el inventario (10 productos seed).
5. Crear, editar y eliminar un producto → la tabla se refresca.
6. Probar con el backend dormido: la primera petición puede tardar; con el timeout de 15 s el usuario ve un mensaje claro en lugar de una pantalla colgada.

---

## 5. Notas conocidas

- El token JWT expira a las 2 h; ante un 401 el frontend cierra sesión automáticamente.
- El rate limit del backend (20 intentos / 15 min) aplica solo a `/api/login` y `/api/register`.
- El formulario de producto no incluye `imagen_url` (campo opcional del backend); se puede agregar luego.
