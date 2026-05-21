import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  acceptFriendRequest,
  getFriendRequests,
  getMyFriends,
  getOutgoingFriendReqs,
  getRecommendedUsers,
  lookupUserByEmail,
  removeFriend,
  sendFriendRequest,
  sendFriendRequestByEmail,
  updateProfile,
} from "../controllers/user.controller.js";

const router = express.Router();

// apply auth middleware to all routes
router.use(protectRoute);

router.get("/", getRecommendedUsers);
router.get("/friends", getMyFriends);
router.get("/lookup", lookupUserByEmail);          // GET /api/users/lookup?email=...

router.post("/friend-request/by-email", sendFriendRequestByEmail);
router.post("/friend-request/:id", sendFriendRequest);
router.put("/friend-request/:id/accept", acceptFriendRequest);

router.delete("/friend/:id", removeFriend);        // DELETE /api/users/friend/:id

router.get("/friend-requests", getFriendRequests);
router.get("/outgoing-friend-requests", getOutgoingFriendReqs);

router.put("/profile", updateProfile);

export default router;
