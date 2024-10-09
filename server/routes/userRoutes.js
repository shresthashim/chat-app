import express from "express";
import { register, login, setAvatar, getAllUsers, logOut } from "../controllers/usersController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/setavatar/:id", setAvatar);
router.get("/allusers/:id", getAllUsers);
router.get("/logout/:id", logOut);

export default router;
