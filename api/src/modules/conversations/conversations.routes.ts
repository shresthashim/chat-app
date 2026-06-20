import { Router } from "express";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import messagesRouter from "../messages/messages.routes.js";
import {
  conversationIdParamSchema,
  createDirectSchema,
  createGroupSchema,
  updateGroupSchema,
  membersSchema,
  memberParamSchema,
  markReadSchema,
} from "./conversations.validation.js";
import * as controller from "./conversations.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", controller.list);
router.post("/direct", validate({ body: createDirectSchema }), controller.createDirect);
router.post("/group", validate({ body: createGroupSchema }), controller.createGroup);

router.get("/:id", validate({ params: conversationIdParamSchema }), controller.getOne);
router.patch("/:id", validate({ params: conversationIdParamSchema, body: updateGroupSchema }), controller.updateGroup);
router.post("/:id/members", validate({ params: conversationIdParamSchema, body: membersSchema }), controller.addMembers);
router.delete("/:id/members/:memberId", validate({ params: memberParamSchema }), controller.removeMember);
router.post("/:id/read", validate({ params: conversationIdParamSchema, body: markReadSchema }), controller.markRead);

// Nested message routes: /conversations/:id/messages
router.use("/:id/messages", messagesRouter);

export default router;
