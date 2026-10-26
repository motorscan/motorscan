const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const addError = (errors, message) => errors.push(message);

export function validateMatrix(matrix) {
  const errors = [];

  if (!isRecord(matrix)) {
    return { valid: false, errors: ["La matriz debe ser un objeto JSON."] };
  }

  if (!Array.isArray(matrix.sintomas)) {
    addError(errors, "sintomas debe ser un array.");
  }
  if (!Array.isArray(matrix.fallas)) {
    addError(errors, "fallas debe ser un array.");
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const symptomIds = new Set();
  for (const [index, symptom] of matrix.sintomas.entries()) {
    if (!isRecord(symptom) || typeof symptom.id !== "string" || symptom.id.length === 0) {
      addError(errors, `sintomas[${index}] debe tener un id no vacío.`);
      continue;
    }
    if (symptomIds.has(symptom.id)) {
      addError(errors, `ID de síntoma duplicado: ${symptom.id}.`);
    }
    symptomIds.add(symptom.id);
  }

  const faultIds = new Set();
  for (const [index, fault] of matrix.fallas.entries()) {
    if (!isRecord(fault) || typeof fault.id !== "string" || fault.id.length === 0) {
      addError(errors, `fallas[${index}] debe tener un id no vacío.`);
      continue;
    }
    if (faultIds.has(fault.id)) {
      addError(errors, `ID de falla duplicado: ${fault.id}.`);
    }
    faultIds.add(fault.id);

    if (!isRecord(fault.pesos_sintomas)) {
      addError(errors, `La falla ${fault.id} debe tener pesos_sintomas.`);
      continue;
    }
    for (const [symptomId, weight] of Object.entries(fault.pesos_sintomas)) {
      if (!symptomIds.has(symptomId)) {
        addError(errors, `La falla ${fault.id} referencia un síntoma inexistente: ${symptomId}.`);
      }
      if (typeof weight !== "number" || !Number.isFinite(weight)) {
        addError(errors, `El peso de ${fault.id}/${symptomId} debe ser numérico.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function parseAndValidateMatrix(json) {
  let matrix;
  try {
    matrix = JSON.parse(json);
  } catch (error) {
    return {
      valid: false,
      errors: [`JSON inválido: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
  return validateMatrix(matrix);
}
