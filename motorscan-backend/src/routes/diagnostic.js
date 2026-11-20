import { Router } from "express";
import matrix from "../core/matrix.json" with { type: "json" };
import { DiagnosticEngine } from "../core/engine.js";
import { validarSolicitudDiagnostico } from "../core/validator.js";

const router = Router();
const engine = new DiagnosticEngine(matrix);

function evaluar(payload) {
  const fallasCompatibles = engine.filtrarFallas(matrix.fallas, payload.tipo_vehiculo);
  const fallasPuntuadas = engine.calcularPuntajes(payload.respuestas, fallasCompatibles);
  const seguridad = engine.verificarSeguridadCritica(fallasPuntuadas, payload.respuestas);
  const certeza = engine.evaluarCerteza(fallasPuntuadas);
  const sintomasRespondidos = payload.sintomas_respondidos ?? payload.respuestas;
  const siguientePregunta = seguridad.alerta_critica
    ? null
    : engine.obtenerSiguientePregunta(fallasPuntuadas, sintomasRespondidos);
  const resultadoFinal = seguridad.alerta_critica
    ? seguridad.fallas_criticas[0] ?? certeza.lider
    : siguientePregunta
      ? null
      : certeza.lider;
  const siguientePreguntaDetalle = siguientePregunta
    ? matrix.sintomas.find(({ id }) => id === siguientePregunta)
    : null;
  return {
    siguiente_pregunta: siguientePreguntaDetalle,
    resultado: resultadoFinal,
    falla_ganadora: resultadoFinal,
    certeza: certeza.certeza,
    alerta_critica: seguridad.alerta_critica,
    fallas_criticas: seguridad.fallas_criticas.map(({ id, titulo, gravedad }) => ({ id, titulo, gravedad })),
    mensajes: seguridad.mensajes
  };
}

function handleDiagnostic(request, response) {
  const errors = validarSolicitudDiagnostico(request.body, matrix);
  if (errors.length > 0) {
    response.status(400).json({ error: "Solicitud inválida.", detalles: errors });
    return;
  }
  response.status(200).json(evaluar(request.body));
}

router.post("/iniciar", (request, response) => {
  handleDiagnostic(request, response);
});

router.post("/responder", (request, response) => {
  handleDiagnostic(request, response);
});

export default router;
