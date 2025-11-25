import { db } from "../connect.js";
import moment from "moment";

// Get likes for a post
export const getLikes = (req, res) => {
  const { postId } = req.query;

  if (!postId) {
    return res.status(400).json({ message: "Post ID is required" });
  }

  const q = "SELECT userId FROM likes WHERE postId = ?";

  db.query(q, [postId], (err, data) => {
    if (err) {
      console.error("Get likes error:", err);
      return res.status(500).json(err);
    }
    return res.status(200).json(data.map(like => like.userId));
  });
};

// Add like
export const addLike = (req, res) => {
  const { userId, postId } = req.body;

  if (!userId || !postId) {
    return res.status(400).json({ message: "User ID and Post ID are required" });
  }

  // Pehle check karo if already liked
  const checkQ = "SELECT * FROM likes WHERE userId = ? AND postId = ?";
  
  db.query(checkQ, [userId, postId], (checkErr, checkData) => {
    if (checkErr) {
      console.error("Check like error:", checkErr);
      return res.status(500).json(checkErr);
    }

    if (checkData.length > 0) {
      return res.status(400).json({ message: "Post already liked" });
    }

    // Add like
    const insertQ = "INSERT INTO likes (`userId`, `postId`, `created_at`) VALUES (?)";
    const values = [
      userId,
      postId,
      moment(Date.now()).format("YYYY-MM-DD HH:mm:ss")
    ];

    db.query(insertQ, [values], (insertErr, insertData) => {
      if (insertErr) {
        console.error("Add like error:", insertErr);
        return res.status(500).json(insertErr);
      }
      
      return res.status(200).json("Post has been liked.");
    });
  });
};

// Remove like
export const deleteLike = (req, res) => {
  const { userId, postId } = req.query;

  if (!userId || !postId) {
    return res.status(400).json({ message: "User ID and Post ID are required" });
  }

  const q = "DELETE FROM likes WHERE userId = ? AND postId = ?";

  db.query(q, [userId, postId], (err, data) => {
    if (err) {
      console.error("Delete like error:", err);
      return res.status(500).json(err);
    }
    
    if (data.affectedRows === 0) {
      return res.status(404).json({ message: "Like not found" });
    }
    
    return res.status(200).json("Like has been removed.");
  });
};