import { Router } from "express";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { authLimiter, lookupLimiter } from "../../middleware/rateLimit.js";
import { registerSchema, loginSchema, checkUsernameSchema } from "./auth.validation.js";
import * as authController from "./auth.controller.js";

const router = Router();

router.get(
  "/check-username",
  lookupLimiter,
  validate({ query: checkUsernameSchema }),
  authController.checkUsername,
);
router.post("/register", authLimiter, validate({ body: registerSchema }), authController.register);
router.post("/login", authLimiter, validate({ body: loginSchema }), authController.login);
router.post("/refresh", authLimiter, authController.refresh);
router.post("/logout", authController.logout);
router.post("/logout-all", requireAuth, authController.logoutAll);
router.get("/me", requireAuth, authController.me);

export default router;
