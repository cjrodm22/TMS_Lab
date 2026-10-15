import { Router } from "express";
import { cybsConfig } from "../config/cybs.config.js";
import paymentsRoutes, {
  paymentOperationsRouter,
} from "../modules/payments/payments.routes.js";
import tmsRoutes from "../modules/tms/tms.routes.js";

const router = Router();

router.get("/config/cybs", (_req, res) => {
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

router.use("/tms/payments", paymentsRoutes);
router.use("/payments", paymentOperationsRouter);
router.use("/tms", tmsRoutes);

export default router;
