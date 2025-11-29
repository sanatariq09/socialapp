import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cookieParser from "cookie-parser";
import mysql from "mysql2";
import jwt from "jsonwebtoken";

// Import routes
import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";
import userRoutes from "./routes/users.js";
import likeRoutes from "./routes/likes.js";
import relationshipRoutes from "./routes/relationships.js";
import storyRoutes from "./routes/stories.js";
import commentRoutes from "./routes/comments.js";
import uploadRoutes from "./routes/upload.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Database connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "socialappdb",
  charset: "utf8mb4",
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error("MySQL Connection Failed:", err);
    process.exit(1);
  }
  console.log("Connected to MySQL Database: socialappdb");
});

// ADD AUTHENTICATE MIDDLEWARE HERE
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Access token required",
      });
    }

    const decoded = jwt.verify(token, "your_jwt_secret"); // Use same secret as in auth routes
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token",
    });
  }
};

// Middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Make db available to all routes
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Uploads directory
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("Created uploads directory:", uploadsDir);
} else {
  console.log("Uploads directory exists:", uploadsDir);
}

// Static file serving
app.use("/uploads", express.static(uploadsDir));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/users", userRoutes);
app.use("/api/likes", likeRoutes);
app.use("/api/relationships", relationshipRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/upload", uploadRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    message: "API Server is running!",
    database: "MySQL - socialappdb",
    timestamp: new Date().toISOString(),
  });
});

// TEST ROUTE FOR PROFILE IMAGES
app.get("/api/test-profile-images", (req, res) => {
  console.log("🔍 Checking profile images...");

  const q = "SELECT id, name, profilePic, coverPic FROM users LIMIT 10";

  db.query(q, (err, results) => {
    if (err) {
      console.log("Database error:", err);
      return res.status(500).json({ error: err.message });
    }

    console.log(`👥 Found ${results.length} users in database`);

    const usersWithFileCheck = results.map((user) => {
      const profilePath = user.profilePic
        ? path.join(uploadsDir, user.profilePic)
        : null;
      const coverPath = user.coverPic
        ? path.join(uploadsDir, user.coverPic)
        : null;

      const profileExists = user.profilePic
        ? fs.existsSync(profilePath)
        : false;
      const coverExists = user.coverPic ? fs.existsSync(coverPath) : false;

      console.log(`👤 User ${user.id}: ${user.name}`);
      console.log(
        `   📸 Profile: ${user.profilePic} - Exists: ${profileExists}`
      );
      console.log(`   🖼️ Cover: ${user.coverPic} - Exists: ${coverExists}`);

      return {
        id: user.id,
        name: user.name,
        profilePic: user.profilePic,
        coverPic: user.coverPic,
        profileExists: profileExists,
        coverExists: coverExists,
        profileUrl: user.profilePic
          ? `http://localhost:8800/uploads/${user.profilePic}`
          : null,
        coverUrl: user.coverPic
          ? `http://localhost:8800/uploads/${user.coverPic}`
          : null,
      };
    });

    res.json({
      message: "Users with image verification",
      uploadsDirectory: uploadsDir,
      totalUsers: results.length,
      users: usersWithFileCheck,
    });
  });
});

// Direct image test route
app.get("/api/test-image/:filename", (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join(uploadsDir, filename);

  console.log("🔍 Testing image access:", filename);
  console.log("📁 Full path:", imagePath);

  if (fs.existsSync(imagePath)) {
    console.log(" Image exists, sending file...");
    res.sendFile(imagePath);
  } else {
    console.log("Image not found at path:", imagePath);
    res.status(404).json({
      error: "Image not found",
      filename: filename,
      searchedPath: imagePath,
      availableFiles: fs.readdirSync(uploadsDir),
    });
  }
});

//Get user's inbox messages
app.get("/api/messages/inbox", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
            SELECT m.*, u.username as sender_name, u.profilePic as sender_profile_pic
            FROM messages m 
            JOIN users u ON m.sender_id = u.id 
            WHERE m.receiver_id = ? 
            ORDER BY m.created_at DESC
        `;

    db.query(query, [userId], (err, results) => {
      if (err) {
        console.error("Error fetching inbox:", err);
        return res.status(500).json({
          success: false,
          error: "Internal server error",
        });
      }

      res.json({
        success: true,
        data: results,
      });
    });
  } catch (error) {
    console.error("Error fetching inbox:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// Send new message
app.post("/api/messages/send", authenticate, async (req, res) => {
  try {
    const { receiver_username, message_text, subject = "" } = req.body;
    const sender_id = req.user.id;

    // Validation
    if (!receiver_username || !message_text) {
      return res.status(400).json({
        success: false,
        error: "Receiver username and message text are required",
      });
    }

    // First get receiver ID from username
    const getReceiverQuery = "SELECT id FROM users WHERE username = ?";

    db.query(getReceiverQuery, [receiver_username], (err, receiverResults) => {
      if (err) {
        console.error("Error finding receiver:", err);
        return res.status(500).json({
          success: false,
          error: "Database error",
        });
      }

      if (receiverResults.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const receiver_id = receiverResults[0].id;

      const insertQuery = `
                INSERT INTO messages (sender_id, receiver_id, subject, message_text) 
                VALUES (?, ?, ?, ?)
            `;

      db.query(
        insertQuery,
        [sender_id, receiver_id, subject, message_text],
        (err, result) => {
          if (err) {
            console.error("Error sending message:", err);
            return res.status(500).json({
              success: false,
              error: "Failed to send message",
            });
          }

          res.json({
            success: true,
            message: "Message sent successfully!",
            messageId: result.insertId,
          });
        }
      );
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send message",
    });
  }
});

//Get unread message count (notification ke liye)
app.get("/api/messages/unread-count", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `SELECT COUNT(*) as unread_count FROM messages WHERE receiver_id = ? AND is_read = FALSE`;

    db.query(query, [userId], (err, results) => {
      if (err) {
        console.error("Error fetching unread count:", err);
        return res.status(500).json({
          success: false,
          error: "Failed to get unread count",
        });
      }

      res.json({
        success: true,
        unreadCount: results[0].unread_count,
      });
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get unread count",
    });
  }
});

// Mark message as read
app.put("/api/messages/:messageId/read", authenticate, async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const userId = req.user.id;

    const query = `UPDATE messages SET is_read = TRUE WHERE id = ? AND receiver_id = ?`;

    db.query(query, [messageId, userId], (err, result) => {
      if (err) {
        console.error("Error marking message as read:", err);
        return res.status(500).json({
          success: false,
          error: "Failed to mark message as read",
        });
      }

      res.json({
        success: true,
        message: "Message marked as read",
      });
    });
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark message as read",
    });
  }
});

const PORT = 8800;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
