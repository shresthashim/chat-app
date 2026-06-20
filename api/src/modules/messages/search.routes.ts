import { Router } from "express";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { searchMessagesSchema } from "./messages.validation.js";
import * as controller from "./messages.controller.js";

const router = Router();

// GET /api/messages/search?q=...
router.get("/search", requireAuth, validate({ query: searchMessagesSchema }), controller.search);

export default router;
