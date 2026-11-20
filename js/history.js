const DATABASE_NAME = "MotorScanDB";
const DATABASE_VERSION = 1;
const STORE_NAME = "diagnosticos";

async function sincronizarHistorialRemoto(diagnostico, sessionId) {
  if (typeof sessionId !== "string" || sessionId.length === 0) return;

  const configuredApiUrl = globalThis.MOTORSCAN_API_URL;
  const apiUrl =
    typeof configuredApiUrl === "string" && configuredApiUrl.trim()
      ? configuredApiUrl.replace(/\/$/, "")
      : "/api";
  const falla = typeof diagnostico.falla === "string"
    ? diagnostico.falla.trim()
    : "";
  if (!falla) return;

  try {
    const response = await fetch(`${apiUrl}/telemetria/historial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        tipo_vehiculo: diagnostico.tipo_vehiculo,
        sintomas_reportados: diagnostico.respuestas ?? [],
        falla_resultante: falla,
        session_id: sessionId
      })
    });
    if (!response.ok) {
      throw new Error(`El servidor respondió con HTTP ${response.status}.`);
    }
  } catch (error) {
    console.warn(
      "[MotorScan] Historial guardado solo en local (sin conexión):",
      error instanceof Error ? error.message : error
    );
  }
}

function getIndexedDB() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB no está disponible en este entorno.");
  }
  return indexedDB;
}

function abrirBaseDeDatos() {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = getIndexedDB().open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      reject(error);
      return;
    }

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("No se pudo abrir MotorScanDB."));
  });
}

export async function solicitarPersistencia() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  return navigator.storage.persist();
}

export async function guardarDiagnostico(diagnostico, sessionId) {
  if (diagnostico === null || typeof diagnostico !== "object") {
    throw new TypeError("El diagnóstico debe ser un objeto.");
  }

  const database = await abrirBaseDeDatos();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).add({
      ...diagnostico,
      creado_en: diagnostico.creado_en ?? new Date().toISOString()
    });

    request.onsuccess = () => {
      void sincronizarHistorialRemoto(diagnostico, sessionId);
      resolve(request.result);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("No se pudo guardar el diagnóstico."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Se canceló el guardado del diagnóstico."));
    transaction.oncomplete = () => database.close();
  });
}

export async function obtenerHistorial() {
  const database = await abrirBaseDeDatos();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("No se pudo leer el historial."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Se canceló la lectura del historial."));
    transaction.oncomplete = () => database.close();
  });
}

export async function exportarHistorial() {
  const historial = await obtenerHistorial();
  const contenido = JSON.stringify(historial, null, 2);
  const blob = new Blob([contenido], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");

  try {
    enlace.href = url;
    enlace.download = "motorscan_historial.json";
    enlace.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
