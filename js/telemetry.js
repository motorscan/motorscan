const CONFIG = {
  posthogKey: "YOUR_POSTHOG_API_KEY",
  posthogHost: "https://us.i.posthog.com",
  sentryDsn: "YOUR_SENTRY_DSN",
  web3FormsAccessKey: "YOUR_WEB3FORMS_ACCESS_KEY"
};

const state = {
  posthog: null,
  sentry: null,
  initialized: false
};

function isConfigured(value) {
  return typeof value === "string" && value.length > 0 && !value.startsWith("YOUR_");
}

function loadScript(src) {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("La telemetría requiere un navegador."));
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}.`));
    document.head.append(script);
  });
}

export async function inicializarTelemetria(config = CONFIG) {
  if (state.initialized) return state;
  state.initialized = true;
  const tasks = [];

  if (isConfigured(config.posthogKey)) {
    tasks.push(
      loadScript("https://cdn.jsdelivr.net/npm/posthog-js@1/dist/index.umd.min.js")
        .then(() => {
          if (!globalThis.posthog?.init) {
            throw new Error("El SDK de PostHog no expuso la API esperada.");
          }
          globalThis.posthog.init(config.posthogKey, {
            api_host: config.posthogHost,
            ip: false,
            autocapture: false,
            capture_pageview: false,
            persistence: "memory"
          });
          state.posthog = globalThis.posthog;
        })
    );
  }

  if (isConfigured(config.sentryDsn)) {
    tasks.push(
      loadScript("https://browser.sentry-cdn.com/8.55.0/bundle.min.js")
        .then(() => {
          if (!globalThis.Sentry?.init) {
            throw new Error("El SDK de Sentry no expuso la API esperada.");
          }
          globalThis.Sentry.init({
            dsn: config.sentryDsn,
            sendDefaultPii: false,
            integrations: (integrations) =>
              integrations.filter(({ name }) => name !== "Breadcrumbs")
          });
          state.sentry = globalThis.Sentry;
          window.addEventListener("error", (event) => {
            reportarErrorSilencioso(event.error ?? new Error(event.message), {
              origen: "window.error"
            });
          });
          window.addEventListener("unhandledrejection", (event) => {
            reportarErrorSilencioso(event.reason, {
              origen: "unhandledrejection"
            });
          });
        })
    );
  }

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("Telemetría no disponible:", result.reason);
    }
  }
  return state;
}

export function registrarEvento(nombreEvento, propiedades = {}) {
  if (state.posthog?.capture) {
    state.posthog.capture(nombreEvento, propiedades);
  }
}

export function reportarErrorSilencioso(error, contexto = {}) {
  if (state.sentry?.captureException) {
    state.sentry.captureException(error, { extra: contexto });
  } else {
    console.error("MotorScan:", error, contexto);
  }
}

export async function enviarFeedback(tipo, datos = {}, config = CONFIG) {
  if (!isConfigured(config.web3FormsAccessKey)) {
    throw new Error("Feedback no configurado: falta el Access Key de Web3Forms.");
  }
  const response = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      access_key: config.web3FormsAccessKey,
      subject: `MotorScan - ${tipo}`,
      from_name: "MotorScan",
      botcheck: "",
      tipo,
      ...datos
    })
  });
  if (!response.ok) {
    throw new Error(`Web3Forms respondió con HTTP ${response.status}.`);
  }
  const result = await response.json();
  if (result.success !== true) {
    throw new Error(result.message || "Web3Forms rechazó el feedback.");
  }
  registrarEvento("Feedback Enviado", { tipo });
  return result;
}
