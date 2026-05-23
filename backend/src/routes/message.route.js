import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages } from "../controllers/message.controller.js";

const router = express.Router();

router.get("/:conversationId", protectRoute, getMessages);

export default router;
