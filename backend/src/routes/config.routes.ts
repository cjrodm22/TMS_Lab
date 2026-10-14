import { Router } from "express";
import { cybsConfig } from "../config/cybs.config.js";

const router = Router();

router.get("/cybs", (_req, res) => {
  res.json({
    success: true,
    data: {
      authenticationType: cybsConfig.authenticationType,
      merchantID: cybsConfig.merchantID,
      runEnvironment: cybsConfig.runEnvironment,
      keyAlias: cybsConfig.keyAlias,
      keyFileName: cybsConfig.keyFileName,
      keysDirectory: cybsConfig.keysDirectory,
      enableLog: cybsConfig.enableLog,
    },
  });
});

export default router;
