# MotorScan

MotorScan es una PWA de diagnóstico automotriz orientativo. El usuario selecciona el tipo de vehículo y responde preguntas sobre síntomas; un backend Node.js valida las respuestas, aplica la matriz de inferencia y devuelve la siguiente pregunta, el resultado más probable o una alerta crítica de seguridad.

> **Importante:** MotorScan entrega orientación preliminar. No reemplaza una inspección profesional ni debe usarse para decidir si un vehículo inseguro puede seguir circulando.

## Estado del MVP

### Implementado

- Interfaz web responsive con estética de escáner.
- PWA instalable con manifest y Service Worker.
- Flujo de diagnóstico remoto mediante API.
- Motor matemático puro en el backend.
- Filtrado duro por tipo de vehículo.
- Certeza basada en el margen entre las dos fallas líderes.
- Alertas críticas independientes del ranking.
- Validación de payloads en el servidor.
- IndexedDB para historial local.
- Endpoint BFF para telemetría y errores.
- Supabase preparado para persistencia server-side.
- Helmet, CORS restringido y rate limiting.
- Pruebas unitarias del motor.

### Pendiente antes de producción

- Configurar un proyecto Supabase real y ejecutar el SQL de [sql/001_telemetry_tables.sql](./motorscan-backend/sql/001_telemetry_tables.sql).
- Sustituir los placeholders del `.env` por secretos reales gestionados por el proveedor de despliegue.
- Servir frontend y backend exclusivamente sobre HTTPS.
- Servir el frontend y el backend bajo el mismo origen para usar `/api`, o definir `globalThis.MOTORSCAN_API_URL` antes de cargar [js/app.js](./js/app.js) cuando estén separados.
- Configurar dominios de producción en `ALLOWED_ORIGINS`.
- Revisar límites, retención y consentimiento de telemetría.
- Añadir pruebas de integración automatizadas para API, Supabase y Service Worker.
- Añadir autenticación si se requiere sincronizar historiales entre dispositivos.
- Generar iconos y capturas de instalación definitivos para las tiendas o catálogos PWA.

## Arquitectura

```text
Navegador / PWA
  ├─ motorscan.html + style.css
  ├─ js/app.js
  └─ js/history.js ── IndexedDB local
             │
             │ POST /api/diagnostico/*
             ▼
      Node.js + Express
  ├─ validación de payloads
  ├─ rate limiting, CORS y Helmet
  ├─ engine.js + matrix.json privados
  └─ rutas de telemetría
             │
             ▼
           Supabase
  ├─ eventos_telemetria
  ├─ errores_app
  └─ historial_diagnosticos
```

La matriz de conocimiento y el motor de inferencia del backend no se incluyen en el precache del frontend. La `SUPABASE_SERVICE_ROLE_KEY` solo debe existir en el servidor.

## Requisitos

- Node.js 20 LTS o superior.
- npm.
- Un navegador moderno con soporte para ES Modules, IndexedDB y Service Workers.
- Supabase para persistencia de telemetría en un entorno real.

## Instalación local

### 1. Clonar el repositorio

```powershell
git clone https://github.com/Bravo-Sama/Motorscan_v2.git
cd Motorscan_v2
```

### 2. Instalar dependencias del backend

```powershell
cd motorscan-backend
npm install
Copy-Item .env.example .env
```

Edita `.env` con valores locales. Nunca subas este archivo:

```env
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Supabase es opcional para el diagnóstico. Si faltan esas variables, el backend arranca y omite la telemetría; para persistencia real deben corresponder a un proyecto Supabase válido.

### 3. Crear las tablas de Supabase

Ejecuta [001_telemetry_tables.sql](./motorscan-backend/sql/001_telemetry_tables.sql) desde el SQL Editor de Supabase. Las tablas mantienen RLS habilitado y no crean políticas públicas. El backend usa la Service Role Key exclusivamente del lado servidor.

### 4. Iniciar el backend

En `motorscan-backend`:

```powershell
npm start
```

Comprobación:

```text
http://localhost:3000/api/health
```

### 5. Iniciar el frontend

Desde la raíz del proyecto, en otra terminal:

```powershell
npx --yes serve . -l 8000
```

Abre preferentemente:

```text
http://127.0.0.1:8000/motorscan.html
```

Los Service Workers no funcionan de forma fiable con `file://`. Si el navegador conserva un Service Worker antiguo, elimina los datos del sitio o usa otro origen local (`127.0.0.1` frente a `localhost`).

## API de diagnóstico

### Health check

```http
GET /api/health
```

Respuesta:

```json
{
  "status": "MotorScan Backend Operativo",
  "secure": true
}
```

### Iniciar diagnóstico

```http
POST /api/diagnostico/iniciar
Content-Type: application/json
```

```json
{
  "tipo_vehiculo": "electrico",
  "respuestas": []
}
```

### Responder una pregunta

```http
POST /api/diagnostico/responder
Content-Type: application/json
```

```json
{
  "tipo_vehiculo": "electrico",
  "respuestas": ["motor_no_arranca"],
  "sintomas_respondidos": ["motor_no_arranca", "perdida_potencia"]
}
```

`respuestas` contiene solo síntomas contestados afirmativamente y se usa para puntuar. `sintomas_respondidos` contiene todos los síntomas ya contestados, incluidos los que recibieron una respuesta negativa, para evitar repetir preguntas.

Respuesta intermedia:

```json
{
  "siguiente_pregunta": {
    "id": "perdida_potencia",
    "titulo": "Pérdida de potencia"
  },
  "resultado": null,
  "falla_ganadora": null,
  "certeza": 0,
  "alerta_critica": false,
  "fallas_criticas": [],
  "mensajes": []
}
```

Una respuesta inválida recibe `400`. Los errores internos reciben `500` sin stack trace.

## API de telemetría

Estas rutas son llamadas por el frontend y escriben mediante la Service Role Key:

```http
POST /api/telemetria/evento
POST /api/telemetria/error
POST /api/telemetria/historial
```

`/api/telemetria/historial` recibe `tipo_vehiculo`, `sintomas_reportados`, `falla_resultante` y `session_id`. El frontend guarda primero en IndexedDB y luego intenta sincronizar en segundo plano. Si Supabase no está configurado, responde `202` y el registro permanece local.

No deben exponerse credenciales de Supabase al navegador. Si Supabase no está configurado correctamente, el diagnóstico principal debe seguir considerándose independiente de la telemetría.

## Pruebas y comprobaciones

Pruebas del motor frontend:

```powershell
npm test
```

Comprobación sintáctica del backend:

```powershell
cd motorscan-backend
npm run check
```

Prueba manual completa:

1. Inicia backend y frontend.
2. Abre `motorscan.html`.
3. Selecciona un tipo de vehículo.
4. Responde síntomas.
5. Comprueba que la pregunta cambia mediante datos del backend.
6. Prueba el síntoma `pedal_freno_al_fondo`.
7. Confirma la alerta crítica.
8. Revisa IndexedDB para verificar el historial local.

## Seguridad y privacidad

- No comitear `.env`, claves privadas ni `node_modules`.
- La Service Role Key nunca debe aparecer en HTML, JavaScript del navegador, logs o respuestas API.
- Mantener RLS habilitado en Supabase.
- Limitar `ALLOWED_ORIGINS` a dominios controlados.
- Mantener HTTPS en producción.
- Revisar el consentimiento legal antes de activar analítica.
- No guardar información personal innecesaria en `datos`, `contexto` o `session_id`.
- Establecer políticas de retención y borrado para telemetría.

## Estructura principal

```text
.
├── assets/
├── css/
├── data/
├── js/
│   ├── app.js
│   ├── engine.js
│   ├── engine.test.js
│   ├── history.js
│   ├── telemetry.js
│   └── validator.js
├── motorscan-backend/
│   ├── server.js
│   ├── sql/
│   └── src/
│       ├── config/
│       ├── core/
│       └── routes/
├── index.html
├── manifest.json
├── motorscan.html
└── sw.js
```

## Licencia

No se ha definido todavía una licencia de distribución. Antes de publicar el proyecto para terceros, añade una licencia explícita y revisa la titularidad de los datos, textos, iconos y matriz de conocimiento.
