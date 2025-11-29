import { db } from "../connect.js";
import moment from "moment";

// Get comments for a post
export const getComments = (req, res) => {
  const { postId } = req.query;

  if (!postId) {
    return res.status(400).json({ message: "Post ID is required" });
  }

  const q = `
    SELECT c.*, u.id AS userId, u.name, u.profilePic 
    FROM comments AS c 
    JOIN users AS u ON (u.id = c.commentUserId)
    WHERE c.postId = ?
    ORDER BY c.created_at DESC
  `;

  db.query(q, [postId], (err, data) => {
    if (err) {
      console.error("Get comments error:", err);
      return res.status(500).json(err);
    }
    return res.status(200).json(data);
  });
};

// Add new comment
export const addComment = (req, res) => {
  const { commentText, userId, postId } = req.body;

  // Basic validation
  if (!commentText || !userId || !postId) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const q =
    "INSERT INTO comments(`commentText`, `created_at`, `commentUserId`, `postId`) VALUES (?)";
  const values = [
    commentText,
    moment(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
    userId,
    postId,
  ];

  db.query(q, [values], (err, data) => {
    if (err) {
      console.error("Add comment error:", err);
      return res.status(500).json(err);
    }

    return res.status(200).json("Comment has been created.");
  });
};
