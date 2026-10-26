import test from "node:test";
import assert from "node:assert/strict";
import matrix from "../data/matrix.json" with { type: "json" };
import { DiagnosticEngine } from "./engine.js";

const engine = new DiagnosticEngine(matrix);

test("filtra fallas incompatibles con el tipo de vehículo", () => {
  const fallas = engine.filtrarFallas(matrix.fallas, "electrico");
  assert.equal(
    fallas.some((falla) => falla.id === "filtro_combustible_tapado"),
    false
  );
});

test("calcula el delta con síntomas contradictorios y propone un desempate", () => {
  const fallas = [
    {
      id: "falla_a",
      titulo: "Falla A",
      gravedad: { es_critica_seguridad: false },
      pesos_sintomas: { motor_no_arranca: 1, perdida_potencia: -1 }
    },
    {
      id: "falla_b",
      titulo: "Falla B",
      gravedad: { es_critica_seguridad: false },
      pesos_sintomas: { motor_no_arranca: -1, perdida_potencia: 1 }
    }
  ];
  const puntuadas = engine.calcularPuntajes(["motor_no_arranca"], fallas);
  const certeza = engine.evaluarCerteza(puntuadas);
  const pregunta = engine.obtenerSiguientePregunta(puntuadas, [
    "motor_no_arranca"
  ]);

  assert.equal(puntuadas[0].falla.id, "falla_a");
  assert.equal(certeza.delta, 2);
  assert.equal(typeof pregunta, "string");
  assert.equal(pregunta, "perdida_potencia");
});

test("levanta alerta crítica aunque la certeza general sea baja", () => {
  const fallas = engine.filtrarFallas(matrix.fallas, "electrico");
  const respuestas = ["pedal_freno_al_fondo"];
  const puntuadas = engine.calcularPuntajes(respuestas, fallas);
  const certeza = engine.evaluarCerteza(puntuadas);
  const seguridad = engine.verificarSeguridadCritica(puntuadas, respuestas);

  assert.ok(certeza.certeza <= 1);
  assert.equal(seguridad.alerta_critica, true);
  assert.equal(seguridad.fallas_criticas[0].id, "falla_sistema_frenos");
});
