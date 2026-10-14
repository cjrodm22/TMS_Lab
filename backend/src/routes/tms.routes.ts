import { Router } from "express";
import { createInstrumentIdentifierController } from "../controllers/tms.controller.js";

const router = Router();

router.post("/instrument-identifiers", createInstrumentIdentifierController);

export default router;
