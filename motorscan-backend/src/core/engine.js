export class DiagnosticEngine {
  constructor(matrix) {
    this.matrix = matrix;
  }

  filtrarFallas(fallas, tipoVehiculo) {
    return fallas.filter((falla) =>
      falla.aplica_a?.v_tipo_vehiculo?.includes(tipoVehiculo)
    );
  }

  calcularPuntajes(respuestasUsuario, fallas = this.matrix.fallas) {
    const respuestas = new Set(respuestasUsuario);
    return fallas
      .map((falla) => {
        const matchedSymptoms = Object.keys(falla.pesos_sintomas)
          .filter((symptomId) => respuestas.has(symptomId));
        const score = matchedSymptoms.reduce(
          (total, symptomId) => total + falla.pesos_sintomas[symptomId], 0
        );
        const maximum = Object.values(falla.pesos_sintomas)
          .filter((weight) => weight > 0)
          .reduce((total, weight) => total + weight, 0);
        return {
          falla,
          score,
          normalizedScore: maximum > 0 ? Math.max(0, score) / maximum : 0,
          matchedSymptoms
        };
      })
      .sort((left, right) => right.score - left.score);
  }

  evaluarCerteza(fallasPuntuadas) {
    const [top, second] = fallasPuntuadas;
    if (!top || top.score <= 0) return { certeza: 0, delta: 0, lider: top?.falla ?? null };
    const delta = top.score - (second?.score ?? 0);
    return {
      certeza: Math.max(0, Math.min(1, delta / Math.max(Math.abs(top.score), 1))),
      delta,
      lider: top.falla
    };
  }

  verificarSeguridadCritica(fallasPuntuadas, respuestasUsuario) {
    const respuestas = new Set(respuestasUsuario);
    const fallasCriticas = fallasPuntuadas
      .filter(({ falla, score }) =>
        score > 0 &&
        falla.gravedad?.es_critica_seguridad === true &&
        Object.keys(falla.pesos_sintomas).some((id) => respuestas.has(id))
      )
      .map(({ falla }) => falla);
    return {
      alerta_critica: fallasCriticas.length > 0,
      fallas_criticas: fallasCriticas,
      mensajes: fallasCriticas.map((falla) => falla.gravedad.mensaje_alerta_inmediata).filter(Boolean)
    };
  }

  obtenerSiguientePregunta(fallasCandidatas, sintomasYaRespondidos) {
    if (fallasCandidatas.length === 0) return null;
    const responded = new Set(sintomasYaRespondidos);
    return this.matrix.sintomas
      .map(({ id }) => id)
      .filter((id) => !responded.has(id))
      .map((symptomId) => {
        const present = fallasCandidatas.filter(({ falla }) =>
          (falla.pesos_sintomas[symptomId] ?? 0) > 0
        ).length;
        return { symptomId, informationGain: Math.min(present, fallasCandidatas.length - present) };
      })
      .sort((left, right) =>
        right.informationGain - left.informationGain ||
        left.symptomId.localeCompare(right.symptomId)
      )[0]?.symptomId ?? null;
  }
}
