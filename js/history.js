const DATABASE_NAME = "MotorScanDB";
const DATABASE_VERSION = 1;
const STORE_NAME = "diagnosticos";

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

export async function guardarDiagnostico(diagnostico) {
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

    request.onsuccess = () => resolve(request.result);
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
