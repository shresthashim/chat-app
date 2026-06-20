import { Router } from "express";
import { validate } from "../../middleware/validate.middleware.js";
import {
  listMessagesQuerySchema,
  sendMessageSchema,
  editMessageSchema,
  reactionSchema,
  messageIdParamSchema,
} from "./messages.validation.js";
import * as controller from "./messages.controller.js";

// mergeParams lets this nested router read :id (the conversation) from the parent.
const router = Router({ mergeParams: true });

router.get("/", validate({ query: listMessagesQuerySchema }), controller.list);
router.post("/", validate({ body: sendMessageSchema }), controller.send);
router.patch("/:messageId", validate({ params: messageIdParamSchema, body: editMessageSchema }), controller.edit);
router.delete("/:messageId", validate({ params: messageIdParamSchema }), controller.remove);
router.post("/:messageId/reactions", validate({ params: messageIdParamSchema, body: reactionSchema }), controller.react);

export default router;
