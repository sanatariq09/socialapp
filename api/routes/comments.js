import express from "express";
import { getComments, addComment } from "../controllers/comment.js"; // comment.js (singular)

const router = express.Router();

router.get("/", getComments);
router.post("/", addComment);

export default router;