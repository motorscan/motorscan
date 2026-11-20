import { guardarDiagnostico, solicitarPersistencia } from "./history.js";

const configuredApiUrl = globalThis.MOTORSCAN_API_URL;
export const API_URL =
  typeof configuredApiUrl === "string" && configuredApiUrl.trim()
    ? configuredApiUrl.replace(/\/$/, "")
    : "/api";

const SELECTORS = {
  vehicleButtons: "[data-vehicle-type]",
  vehicleSelection: "#vehicleSelection",
  questionContainer: "#questionContainer",
  question: "[data-diagnostic-question]",
  options: "[data-diagnostic-options]",
  result: "[data-diagnostic-result]",
  gauge: "[data-diagnostic-gauge]",
  error: "[data-diagnostic-error]"
};

function createElement(root, tagName) {
  return (root.ownerDocument ?? root).createElement(tagName);
}

async function postJson(path, payload) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("El servidor devolvió una respuesta inválida.");
  }
  if (!response.ok) {
    throw new Error(data.error ?? "No se pudo completar la solicitud.");
  }
  return data;
}

async function enviarEvento(tipoEvento, datos, sessionId) {
  try {
    await postJson("/telemetria/evento", {
      tipo_evento: tipoEvento,
      datos,
      session_id: sessionId
    });
  } catch (error) {
    console.warn("No se pudo registrar la telemetría:", error);
  }
}

export function renderizarPregunta(pregunta, root = document) {
  const questionElement = root.querySelector(SELECTORS.question);
  const optionsElement = root.querySelector(SELECTORS.options);
  if (!pregunta || !questionElement || !optionsElement) {
    throw new Error("No se encontró la vista de pregunta requerida.");
  }

  questionElement.textContent = pregunta.titulo ?? pregunta.id ?? pregunta;
  optionsElement.replaceChildren();
  for (const [value, label] of [["si", "Sí"], ["no", "No"]]) {
    const button = createElement(root, "button");
    button.type = "button";
    button.dataset.answer = value;
    button.dataset.symptomId = pregunta.id ?? pregunta;
    button.textContent = label;
    optionsElement.append(button);
  }
  root.querySelector(SELECTORS.vehicleSelection)?.setAttribute("hidden", "");
  root.querySelector(SELECTORS.questionContainer)?.removeAttribute("hidden");
  root.querySelector(SELECTORS.result)?.setAttribute("hidden", "");
}

export function actualizarVelocimetro(porcentaje, root = document) {
  const gauge = root.querySelector(SELECTORS.gauge);
  if (!gauge) return;
  const bounded = Math.max(0, Math.min(100, porcentaje));
  gauge.style.setProperty("--diagnostic-progress", `${bounded}%`);
  gauge.setAttribute("aria-valuenow", String(bounded));
  gauge.textContent = `${Math.round(bounded)}%`;
}

export function renderizarResultado(fallaGanadora, alertaCritica, root = document) {
  const result = root.querySelector(SELECTORS.result);
  if (!result) throw new Error("No se encontró la vista de resultado requerida.");

  result.replaceChildren();
  const title = createElement(root, "h2");
  title.textContent = alertaCritica
    ? "Alerta de seguridad"
    : fallaGanadora?.titulo ?? "No se encontró una falla concluyente";
  result.append(title);

  if (alertaCritica) {
    result.dataset.severity = "critical";
    const message = createElement(root, "p");
    message.textContent =
      fallaGanadora?.gravedad?.mensaje_alerta_inmediata ??
      "No conduzca el vehículo y solicite asistencia profesional.";
    result.append(message);
  } else {
    delete result.dataset.severity;
  }
  result.hidden = false;
  root.querySelector(SELECTORS.questionContainer)?.setAttribute("hidden", "");
  root.querySelector(SELECTORS.vehicleSelection)?.setAttribute("hidden", "");
}

export function crearControlador(root = document) {
  const sessionId = crypto.randomUUID();
  const state = {
    tipoVehiculo: null,
    respuestas: [],
    sintomasRespondidos: [],
    ultimoResultado: null
  };

  const mostrarError = (error) => {
    const element = root.querySelector(SELECTORS.error);
    if (element) {
      element.textContent =
        error instanceof Error
          ? error.message
          : "No se pudo conectar con el servidor de diagnóstico.";
      element.hidden = false;
    }
  };

  const procesarRespuestaServidor = async (data) => {
    if (data.alerta_critica || data.falla_ganadora) {
      state.ultimoResultado = data.falla_ganadora;
      renderizarResultado(data.falla_ganadora, data.alerta_critica, root);
      actualizarVelocimetro(data.alerta_critica ? 100 : data.certeza * 100, root);
      await enviarEvento("Diagnostico Completado", {
        falla: data.falla_ganadora?.id ?? null,
        certeza: data.certeza,
        seguridad_critica: data.alerta_critica
      }, sessionId);
      await guardarDiagnostico({
        tipo_vehiculo: state.tipoVehiculo,
        respuestas: [...state.respuestas],
        falla: data.falla_ganadora?.id ?? null,
        alerta_critica: data.alerta_critica
      }, sessionId);
      return;
    }
    if (data.siguiente_pregunta) {
      renderizarPregunta(data.siguiente_pregunta, root);
      actualizarVelocimetro(data.certeza * 100, root);
      return;
    }
    throw new Error("El servidor no indicó el siguiente paso del diagnóstico.");
  };

  const iniciar = async (tipoVehiculo) => {
    state.tipoVehiculo = tipoVehiculo;
    state.respuestas = [];
    state.sintomasRespondidos = [];
    state.ultimoResultado = null;
    await enviarEvento("Vehiculo Seleccionado", { tipo: tipoVehiculo }, sessionId);
    const data = await postJson("/diagnostico/iniciar", {
      tipo_vehiculo: tipoVehiculo,
      respuestas: [],
      sintomas_respondidos: []
    });
    await procesarRespuestaServidor(data);
  };

  const procesarRespuesta = async (event) => {
    const button = event.target.closest("[data-answer][data-symptom-id]");
    if (!button) return;
    const symptomId = button.dataset.symptomId;
    if (!state.sintomasRespondidos.includes(symptomId)) {
      state.sintomasRespondidos.push(symptomId);
    }
    if (button.dataset.answer === "si" && !state.respuestas.includes(symptomId)) {
      state.respuestas.push(symptomId);
    }
    await enviarEvento("Pregunta Respondida", {
      sintoma: symptomId,
      respuesta: button.dataset.answer
    }, sessionId);
    const data = await postJson("/diagnostico/responder", {
      tipo_vehiculo: state.tipoVehiculo,
      respuestas: [...state.respuestas],
      sintomas_respondidos: [...state.sintomasRespondidos]
    });
    await procesarRespuestaServidor(data);
  };

  const iniciarEventos = () => {
    root.querySelectorAll(SELECTORS.vehicleButtons).forEach((button) => {
      button.addEventListener("click", () => {
        iniciar(button.dataset.vehicleType).catch(mostrarError);
      });
    });
    root.querySelector(SELECTORS.options)?.addEventListener(
      "click",
      (event) => procesarRespuesta(event).catch(mostrarError)
    );
    solicitarPersistencia().catch((error) =>
      console.warn("No se pudo solicitar persistencia:", error)
    );
  };

  return { state, iniciar, iniciarEventos, procesarRespuesta };
}

export function iniciarAplicacion(root = document) {
  const controller = crearControlador(root);
  controller.iniciarEventos();
  return controller;
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => iniciarAplicacion());
}
