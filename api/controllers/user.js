import { db } from "../connect.js";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utility Functions
const addImageUrls = (user) => {
  const { password, ...userWithoutPassword } = user;
  
  return {
    ...userWithoutPassword,
    profilePic: user.profilePic 
      ? `http://localhost:8800/uploads/${user.profilePic}` 
      : null,
    coverPic: user.coverPic 
      ? `http://localhost:8800/uploads/${user.coverPic}` 
      : null
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
const authenticateToken = (req, res, next) => {
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

// Authorization middleware
const authorizeUser = (req, res, next) => {
  const requestedUserId = parseInt(req.params.id);
  
  if (requestedUserId !== req.userInfo.id) {
    return res.status(403).json({ 
      message: "You can only update your own profile" 
    });
  }
  next();
};

// Get single user by ID
export const getUser = (req, res) => {
  const { userId } = req.params;

  if (!userId || isNaN(userId)) {
    return res.status(400).json({ message: "Valid user ID is required" });
  }

  const query = "SELECT * FROM users WHERE id = ?";

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ 
        message: "Internal server error"
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userWithUrls = addImageUrls(results[0]);
    res.status(200).json(userWithUrls);
  });
};

// Update user profile
export const updateUser = (req, res) => {
  const { name, city, website } = req.body;
  const userId = req.userInfo.id;

  // Handle file uploads
  const profilePic = req.files?.profilePic 
    ? req.files.profilePic[0].filename 
    : req.body.profilePic;
  
  const coverPic = req.files?.coverPic 
    ? req.files.coverPic[0].filename 
    : req.body.coverPic;

  const query = `
    UPDATE users 
    SET name = ?, city = ?, website = ?, profilePic = ?, coverPic = ? 
    WHERE id = ?
  `;

  const values = [name, city, website, profilePic, coverPic, userId];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error("Update error:", err);
      return res.status(500).json({ 
        message: "Failed to update profile"
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ 
      message: "Profile updated successfully",
      profilePic,
      coverPic
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

// Get current user profile
export const getCurrentUser = (req, res) => {
  const query = "SELECT * FROM users WHERE id = ?";

  db.query(query, [req.userInfo.id], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ 
        message: "Internal server error"
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userWithUrls = addImageUrls(results[0]);
    res.status(200).json(userWithUrls);
  });
};