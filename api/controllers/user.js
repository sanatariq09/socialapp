import { db } from "../connect.js";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ FIXED: Utility Function - CASE SENSITIVE FIX
const addImageUrls = (user) => {
  const { password, profilepic, ...userWithoutPassword } = user;
  
  // ✅ FIX: Handle both profilePic and profilepic
  const actualProfilePic = user.profilePic || user.profilepic;
  
  const defaultProfile = 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg';
  const defaultCover = 'https://images.pexels.com/photos/325185/pexels-photo-325185.jpeg';
  
  return {
    ...userWithoutPassword,
    profilePic: actualProfilePic 
      ? `http://localhost:8800/uploads/${actualProfilePic}` 
      : defaultProfile,
    coverPic: user.coverPic 
      ? `http://localhost:8800/uploads/${user.coverPic}` 
      : defaultCover
  };
};

const ensureUploadsDirectory = () => {
  const uploadPath = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
  return uploadPath;
};

// Multer Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = ensureUploadsDirectory();
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Middleware for handling file uploads
export const uploadMiddleware = upload.fields([
  { name: 'profilePic', maxCount: 1 },
  { name: 'coverPic', maxCount: 1 }
]);

// Error handling middleware for Multer
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'File too large. Maximum size is 10MB.' 
      });
    }
    return res.status(400).json({ 
      message: 'File upload error',
      error: err.message 
    });
  } else if (err) {
    return res.status(400).json({ 
      message: err.message 
    });
  }
  next();
};

// Authentication middleware
export const verifyToken = (req, res, next) => {
  const token = req.cookies.accessToken;
  
  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  jwt.verify(token, "secretkey", (err, userInfo) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
    req.userInfo = userInfo;
    next();
  });
};

// Get single user by ID - CASE SENSITIVE FIX
export const getUser = (req, res) => {
  const { userId } = req.params;

  console.log("🔍 getUser called for userId:", userId);

  if (!userId || isNaN(userId)) {
    return res.status(400).json({ message: "Valid user ID is required" });
  }

  const query = "SELECT * FROM users WHERE id = ?";

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("❌ Database error:", err);
      return res.status(500).json({ 
        message: "Internal server error"
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = results[0];
    console.log("📊 All user fields:", Object.keys(user));
    console.log("📸 ProfilePic fields:", {
      profilePic: user.profilePic,
      profilepic: user.profilepic,
      hasProfilePic: !!user.profilePic,
      hasProfilepic: !!user.profilepic
    });

    // ✅ FIX: Use the updated utility function
    const userWithUrls = addImageUrls(user);

    console.log("✅ Final user data:", userWithUrls);
    res.status(200).json(userWithUrls);
  });
};

// ✅ FIXED: Update user profile - FIXED VERSION
export const updateUser = (req, res) => {
  const { name, city, website } = req.body;
  
  // ✅ FIX: Get userId from params instead of userInfo
  const userId = req.params.id;
  
  console.log("🔄 Update User Request:");
  console.log("📝 Body:", req.body);
  console.log("👤 User ID from params:", userId);
  console.log("👤 User Info from token:", req.userInfo);
  console.log("📁 Files:", req.files);

  // Validate user ID
  if (!userId || isNaN(userId)) {
    return res.status(400).json({ message: "Valid user ID is required" });
  }

  // ✅ FIX: Check if the authenticated user is updating their own profile
  if (parseInt(userId) !== req.userInfo?.id) {
    return res.status(403).json({ 
      message: "You can only update your own profile" 
    });
  }

  // Handle file uploads
  const profilePic = req.files?.profilePic 
    ? req.files.profilePic[0].filename 
    : req.body.profilePic;
  
  const coverPic = req.files?.coverPic 
    ? req.files.coverPic[0].filename 
    : req.body.coverPic;

  console.log("🖼️ Profile Pic:", profilePic);
  console.log("🖼️ Cover Pic:", coverPic);

  // Build dynamic query based on provided fields
  let query = "UPDATE users SET ";
  const values = [];
  const updates = [];

  if (name !== undefined) {
    updates.push("name = ?");
    values.push(name);
  }
  if (city !== undefined) {
    updates.push("city = ?");
    values.push(city);
  }
  if (website !== undefined) {
    updates.push("website = ?");
    values.push(website);
  }
  if (profilePic !== undefined) {
    updates.push("profilePic = ?");
    values.push(profilePic);
  }
  if (coverPic !== undefined) {
    updates.push("coverPic = ?");
    values.push(coverPic);
  }

  // Check if there are any fields to update
  if (updates.length === 0) {
    return res.status(400).json({ message: "No fields to update" });
  }

  query += updates.join(", ") + " WHERE id = ?";
  values.push(userId);

  console.log("📋 Final Query:", query);
  console.log("📦 Values:", values);

  db.query(query, values, (err, result) => {
    if (err) {
      console.error("❌ Update error:", err);
      return res.status(500).json({ 
        message: "Failed to update profile",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("✅ Profile updated successfully. Affected rows:", result.affectedRows);
    
    res.status(200).json({ 
      message: "Profile updated successfully",
      profilePic: profilePic || undefined,
      coverPic: coverPic || undefined
    });
  });
};

// Get all users (without passwords)
export const getUsers = (req, res) => {
  const query = `
    SELECT id, username, name, profilePic, coverPic, city, website, created_at 
    FROM users 
    ORDER BY created_at DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ 
        message: "Failed to fetch users"
      });
    }

    const usersWithUrls = results.map(user => addImageUrls(user));
    res.status(200).json(usersWithUrls);
  });
};

// Search users by username or name
export const searchUsers = (req, res) => {
  const { query } = req.query;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ message: "Search query is required" });
  }

  const searchQuery = `
    SELECT id, username, name, profilePic, coverPic, city, website 
    FROM users 
    WHERE username LIKE ? OR name LIKE ? 
    ORDER BY 
      CASE 
        WHEN username = ? THEN 1
        WHEN name = ? THEN 2
        ELSE 3
      END
    LIMIT 20
  `;

  const searchTerm = `%${query}%`;
  const values = [searchTerm, searchTerm, query, query];

  db.query(searchQuery, values, (err, results) => {
    if (err) {
      console.error("Search error:", err);
      return res.status(500).json({ 
        message: "Search failed"
      });
    }

    const usersWithUrls = results.map(user => addImageUrls(user));
    res.status(200).json(usersWithUrls);
  });
};

// users.js - Backend route
export const updateProfilePic = (req, res) => {
  const userId = req.body.userId;
  const profilePic = req.file ? req.file.filename : null;

  const q = "UPDATE users SET profilePic = ?, profilepic = ? WHERE id = ?";
  
  db.query(q, [profilePic, profilePic, userId], (err, data) => {
    if (err) return res.status(500).json(err);
    
    // Updated user data return karein
    const selectQ = "SELECT * FROM users WHERE id = ?";
    db.query(selectQ, [userId], (err, userData) => {
      if (err) return res.status(500).json(err);
      return res.status(200).json(userData[0]);
    });
  });
};