export function validarSolicitudDiagnostico(payload, matrix) {
  const errors = [];
  const validTypes = new Set(["combustion", "electrico", "hibrido"]);
  const symptomIds = new Set(matrix.sintomas.map(({ id }) => id));

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return ["El cuerpo debe ser un objeto JSON."];
  }
  if (!validTypes.has(payload.tipo_vehiculo)) {
    errors.push("tipo_vehiculo no es válido.");
  }
  if (!Array.isArray(payload.respuestas)) {
    errors.push("respuestas debe ser un array.");
  } else {
    const uniqueResponses = new Set(payload.respuestas);
    if (uniqueResponses.size !== payload.respuestas.length) {
      errors.push("respuestas no debe contener IDs duplicados.");
    }
    for (const symptomId of payload.respuestas) {
      if (typeof symptomId !== "string" || !symptomIds.has(symptomId)) {
        errors.push(`Síntoma no válido: ${String(symptomId)}.`);
      }
    }
  }
  return errors;
}
