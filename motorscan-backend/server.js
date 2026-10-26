import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import diagnosticRoutes from "./src/routes/diagnostic.js";
import telemetryRoutes from "./src/routes/telemetry.js";

dotenv.config();

const app = express();
const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:8000,http://127.0.0.1:8000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origen no permitido por CORS."));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "10kb" }));
app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Intenta más tarde." }
}));

app.get("/api/health", (_request, response) => {
  response.status(200).json({ status: "MotorScan Backend Operativo", secure: true });
});
app.use("/api/diagnostico", diagnosticRoutes);
app.use("/api/telemetria", telemetryRoutes);
app.use((_request, response) => response.status(404).json({ error: "Endpoint no válido." }));
app.use((error, _request, response, _next) => {
  if (error.message === "Origen no permitido por CORS.") {
    response.status(403).json({ error: "Origen no permitido." });
    return;
  }
  console.error(error);
  response.status(500).json({ error: "Error interno del servidor." });
});

app.listen(PORT, () => {
  console.log(`Backend MotorScan escuchando en http://localhost:${PORT}`);
});
