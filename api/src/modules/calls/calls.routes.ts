import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import * as controller from "./calls.controller.js";

const router = Router();

// Authenticated so TURN credentials are only minted for real users.
router.get("/ice-servers", requireAuth, controller.getIceServers);

export default router;
