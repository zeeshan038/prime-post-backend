//NPM Package
import express from "express";

//controllers
import { loginUser, logout, refreshToken, registerUser } from "../controller/user";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);


export default router;