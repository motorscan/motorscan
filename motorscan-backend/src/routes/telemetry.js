import { Router } from "express";
import { supabase } from "../config/supabase.js";

const router = Router();

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateEvent(body) {
  const errors = [];
  if (!isRecord(body) || typeof body.tipo_evento !== "string" ||
      body.tipo_evento.length < 1 || body.tipo_evento.length > 100) {
    errors.push("tipo_evento debe ser un texto de 1 a 100 caracteres.");
  }
  if (!isRecord(body?.datos)) errors.push("datos debe ser un objeto.");
  if (typeof body?.session_id !== "string" ||
      body.session_id.length < 1 || body.session_id.length > 128) {
    errors.push("session_id debe ser un texto de 1 a 128 caracteres.");
  }
  return errors;
}

function validateError(body) {
  const errors = [];
  if (!isRecord(body) || typeof body.mensaje_error !== "string" ||
      body.mensaje_error.length < 1 || body.mensaje_error.length > 2000) {
    errors.push("mensaje_error debe ser un texto de 1 a 2000 caracteres.");
  }
  if (!isRecord(body?.contexto)) errors.push("contexto debe ser un objeto.");
  if (typeof body?.origen !== "string" ||
      body.origen.length < 1 || body.origen.length > 100) {
    errors.push("origen debe ser un texto de 1 a 100 caracteres.");
  }
  return errors;
}

router.post("/evento", async (request, response) => {
  const errors = validateEvent(request.body);
  if (errors.length > 0) {
    response.status(400).json({ error: "Solicitud inválida.", detalles: errors });
    return;
  }
  try {
    const { error } = await supabase.from("eventos_telemetria").insert({
      tipo_evento: request.body.tipo_evento,
      datos: request.body.datos,
      session_id: request.body.session_id
    });
    if (error) throw error;
  } catch (error) {
    console.error("Error insertando evento de telemetría:", error.message);
    response.status(500).json({ error: "No se pudo registrar el evento." });
    return;
  }
  response.status(201).json({ registrado: true });
});

router.post("/error", async (request, response) => {
  const errors = validateError(request.body);
  if (errors.length > 0) {
    response.status(400).json({ error: "Solicitud inválida.", detalles: errors });
    return;
  }
  try {
    const { error } = await supabase.from("errores_app").insert({
      mensaje_error: request.body.mensaje_error,
      contexto: request.body.contexto,
      origen: request.body.origen
    });
    if (error) throw error;
  } catch (error) {
    console.error("Error insertando error de aplicación:", error.message);
    response.status(500).json({ error: "No se pudo registrar el error." });
    return;
  }
  response.status(201).json({ registrado: true });
});

export default router;
