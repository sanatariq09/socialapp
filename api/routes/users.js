// routes/user.js
import express from "express";
import { 
  getUser, 
  updateUser, 
  getUsers, 
  searchUsers,
  uploadMiddleware,
  handleUploadError,
  verifyToken
} from "../controllers/user.js";

const router = express.Router();

router.get("/", getUsers);
router.get("/search", searchUsers);
router.get("/find/:userId", getUser);

router.put("/:id", verifyToken, uploadMiddleware, handleUploadError, updateUser);

export default router;