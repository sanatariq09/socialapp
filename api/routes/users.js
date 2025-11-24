import express from "express";
import { 
  getUser, 
  updateUser, 
  getUsers, 
  searchUsers,
  uploadMiddleware
} from "../controllers/user.js";

const router = express.Router();

router.get("/", getUsers);

router.get("/search", searchUsers);

router.get("/find/:userId", getUser);

router.put("/:id", uploadMiddleware, updateUser);

export default router;