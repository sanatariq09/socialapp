import { db } from "../connect.js";

export const getStories = (req, res) => {
  console.log("📸 Fetching stories grouped by user...");
  
  // ✅ Get only the latest story from each user for the circle display
  const q = `
    SELECT 
      s.*, 
      u.username, 
      u.name, 
      u.profilePic,
      (SELECT COUNT(*) FROM stories s2 WHERE s2.storyUserId = s.storyUserId) as totalStories
    FROM stories s 
    JOIN users u ON s.storyUserId = u.id 
    WHERE s.id IN (
      SELECT MAX(id) FROM stories GROUP BY storyUserId
    )
    ORDER BY s.created_at DESC
  `;

  db.query(q, (err, data) => {
    if (err) {
      console.error("❌ Database Error:", err);
      return res.status(500).json({ error: "Failed to fetch stories" });
    }
    
    console.log(`✅ Fetched ${data.length} users with stories`);
    
    const stories = data.map(story => ({
      ...story,
      img: story.img ? `/uploads/${story.img}` : null,
      profilePic: story.profilePic ? `/uploads/${story.profilePic}` : null,
      hasMultipleStories: story.totalStories > 1 // ✅ Flag for multiple stories
    }));
    
    res.json(stories);
  });
};

// ✅ NEW: Get all stories for a specific user
export const getUserStories = (req, res) => {
  const userId = req.params.userId;
  console.log(`📸 Fetching all stories for user: ${userId}`);
  
  const q = `
    SELECT s.*, u.username, u.name, u.profilePic 
    FROM stories s 
    JOIN users u ON s.storyUserId = u.id 
    WHERE s.storyUserId = ? 
    ORDER BY s.created_at ASC
  `;

  db.query(q, [userId], (err, data) => {
    if (err) {
      console.error("❌ Database Error:", err);
      return res.status(500).json({ error: "Failed to fetch user stories" });
    }
    
    console.log(`✅ Fetched ${data.length} stories for user ${userId}`);
    
    const stories = data.map(story => ({
      ...story,
      img: story.img ? `/uploads/${story.img}` : null,
      profilePic: story.profilePic ? `/uploads/${story.profilePic}` : null
    }));
    
    res.json(stories);
  });
};

export const addStory = (req, res) => {
  console.log("🎯 ADD STORY CALLED");

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const userId = req.body.userId;
  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const img = req.file.filename;
  console.log("📋 Adding story for user:", userId);

  const q = "INSERT INTO stories (img, storyUserId) VALUES (?, ?)";
  
  db.query(q, [img, userId], (err, data) => {
    if (err) {
      console.error("❌ DATABASE ERROR:", err);
      return res.status(500).json({ 
        error: "Database error",
        details: err.sqlMessage 
      });
    }
    
    console.log("✅ Story added successfully, ID:", data.insertId);
    
    res.status(201).json({
      success: true,
      message: "Story added successfully",
      id: data.insertId,
      img: `/uploads/${img}`,
      userId: userId
    });
  });
};

export const deleteStory = (req, res) => {
  const storyId = req.params.id;
  
  const deleteQuery = "DELETE FROM stories WHERE id = ?";
  db.query(deleteQuery, [storyId], (err, data) => {
    if (err) {
      console.error("❌ Delete error:", err);
      return res.status(500).json({ error: "Failed to delete story" });
    }
    res.json({ message: "Story deleted successfully" });
  });
};