import { Router } from "express";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
  searchUsersSchema,
  updateProfileSchema,
  userIdParamSchema,
} from "./users.validation.js";
import * as usersController from "./users.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/search", validate({ query: searchUsersSchema }), usersController.searchUsers);
router.patch("/me", validate({ body: updateProfileSchema }), usersController.updateProfile);
router.get("/:id", validate({ params: userIdParamSchema }), usersController.getUser);

export default router;
