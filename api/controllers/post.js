import { db } from "../connect.js";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Utility function for image URLs
const addPostImageUrls = (post) => {
  const defaultProfile = 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg';
  
  return {
    ...post,
    img: post.img ? `http://localhost:8800/uploads/${post.img}` : null,
    profilePic: post.profilePic ? `http://localhost:8800/uploads/${post.profilePic}` : defaultProfile
  };
};

// Get all posts with user info
export const getPosts = (req, res) => {
  console.log("🍪 Cookies received:", req.cookies);
  console.log("🔑 Headers:", req.headers);

  const q = `
    SELECT p.*, u.id AS userId, u.username, u.name, u.profilePic,
    (SELECT COUNT(*) FROM likes WHERE postId = p.id) AS likeCount,
    (SELECT COUNT(*) FROM comments WHERE postId = p.id) AS commentCount
    FROM posts p 
    JOIN users u ON p.userId = u.id 
    ORDER BY p.created_at DESC
    LIMIT 50
  `;

  db.query(q, (err, data) => {
    if (err) {
      console.error("❌ Database Error:", err);
      return res.status(500).json({ error: "Failed to fetch posts" });
    }
    
    console.log(`✅ Fetched ${data.length} posts`);

    // ✅ Use the utility function for image URLs
    const posts = data.map(post => addPostImageUrls(post));
    
    res.json(posts);
  });
};

// Add new post - FIXED VERSION
export const addPost = (req, res) => {
  console.log("📨 Add Post Request Received:");
  console.log("📁 File:", req.file);
  console.log("📝 Body:", req.body);
  console.log("🍪 Cookies:", req.cookies);

  // Get data from request - handle both file upload and direct image
  const { post_desc, img: imageData, userId } = req.body;
  
  let imgFilename = null;

  // Case 1: File upload via multer
  if (req.file) {
    imgFilename = req.file.filename;
    console.log("✅ Using uploaded file:", imgFilename);
  }
  // Case 2: Image filename already provided in body
  else if (imageData && typeof imageData === 'string') {
    // If it's a base64 string (data:image/...)
    if (imageData.startsWith('data:image')) {
      try {
        // Extract file extension from base64
        const matches = imageData.match(/^data:image\/([a-zA-Z+]+);base64,/);
        if (matches && matches.length > 1) {
          const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          imgFilename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.' + extension;
          
          // Save base64 as file
          const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const filePath = path.join(__dirname, '../uploads', imgFilename);
          
          fs.writeFileSync(filePath, buffer);
          console.log("✅ Base64 image saved as:", imgFilename);
        }
      } catch (error) {
        console.error("❌ Error saving base64 image:", error);
        return res.status(500).json({ error: "Failed to process image" });
      }
    } else {
      // If it's already a filename (like '1764001836501-797539664.jpg')
      imgFilename = imageData;
      console.log("✅ Using provided filename:", imgFilename);
    }
  }

  console.log("📋 Final Post Data:", { post_desc, imgFilename, userId });

  // Validation
  if (!post_desc && !imgFilename) {
    return res.status(400).json("Post description or image is required");
  }

  if (!userId) {
    return res.status(400).json("User ID is required");
  }

  const q = "INSERT INTO posts (post_desc, img, userId) VALUES (?, ?, ?)";
  
  db.query(q, [post_desc, imgFilename, userId], (err, data) => {
    if (err) {
      console.error("❌ Database Insert Error:", err);
      return res.status(500).json({ error: "Failed to create post in database" });
    }
    
    console.log("✅ Post inserted with ID:", data.insertId);

    // Return the new post with user details
    const getPostQuery = `
      SELECT p.*, u.username, u.name, u.profilePic 
      FROM posts p 
      JOIN users u ON p.userId = u.id 
      WHERE p.id = ?
    `;
    
    db.query(getPostQuery, [data.insertId], (err, postData) => {
      if (err) {
        console.error("❌ Error fetching created post:", err);
        return res.status(500).json(err);
      }
      
      if (postData.length === 0) {
        return res.status(404).json("Post not found after creation");
      }
      
      // ✅ Use the utility function for image URLs
      const post = addPostImageUrls(postData[0]);
      
      console.log("✅ Post created successfully:", post.id);
      res.status(201).json(post);
    });
  });
};

// Get user's posts
export const getUserPosts = (req, res) => {
  const userId = req.params.userId;
  
  const q = `
    SELECT p.*, u.username, u.name, u.profilePic,
    (SELECT COUNT(*) FROM likes WHERE postId = p.id) AS likeCount,
    (SELECT COUNT(*) FROM comments WHERE postId = p.id) AS commentCount
    FROM posts p 
    JOIN users u ON p.userId = u.id 
    WHERE p.userId = ?
    ORDER BY p.created_at DESC
  `;
  
  db.query(q, [userId], (err, data) => {
    if (err) {
      console.error("❌ Database Error:", err);
      return res.status(500).json(err);
    }
    
    // ✅ Use the utility function for image URLs
    const posts = data.map(post => addPostImageUrls(post));
    
    console.log(`✅ Fetched ${posts.length} posts for user ${userId}`);
    res.json(posts);
  });
};

// Delete post
export const deletePost = (req, res) => {
  const postId = req.params.id;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json("User ID is required");
  }

  // Check if post exists and belongs to user
  const checkQuery = "SELECT * FROM posts WHERE id = ? AND userId = ?";
  
  db.query(checkQuery, [postId, userId], (err, data) => {
    if (err) return res.status(500).json(err);
    
    if (data.length === 0) {
      return res.status(403).json("You can only delete your own posts");
    }

    const deleteQuery = "DELETE FROM posts WHERE id = ?";
    db.query(deleteQuery, [postId], (err, data) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Post deleted successfully" });
    });
  });
};

// Get single post
export const getPost = (req, res) => {
  const postId = req.params.id;
  
  const q = `
    SELECT p.*, u.username, u.name, u.profilePic 
    FROM posts p 
    JOIN users u ON p.userId = u.id 
    WHERE p.id = ?
  `;
  
  db.query(q, [postId], (err, data) => {
    if (err) return res.status(500).json(err);
    if (data.length === 0) return res.status(404).json({ message: "Post not found" });
    
    // ✅ Use the utility function for image URLs
    const post = addPostImageUrls(data[0]);
    
    res.json(post);
  });
};