import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getStreamToken, getChannelKey } from "../controllers/chat.controller.js";

const router = express.Router();

router.get("/token", protectRoute, getStreamToken);
router.get("/channel-key/:channelId", protectRoute, getChannelKey);

export default router;
