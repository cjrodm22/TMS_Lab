import "dotenv/config";
import express from "express";
import cors from "cors";
import configRoutes from "./routes/config.routes.js";
import tmsRoutes from "./routes/tms.routes.js";
import cybersourceRestClient from "cybersource-rest-client";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "CYBS TMS Lab API running",
  });
});

app.use("/api/config", configRoutes);
app.use("/api/tms", tmsRoutes);

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
