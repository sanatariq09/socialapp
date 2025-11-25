import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import mysql from 'mysql2';

// Import routes
import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import userRoutes from './routes/users.js';
import likeRoutes from './routes/likes.js';
import relationshipRoutes from './routes/relationships.js';
import storyRoutes from './routes/stories.js';
import commentRoutes from './routes/comments.js';
import uploadRoutes from './routes/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'socialappdb',
  charset: 'utf8mb4'
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('❌ MySQL Connection Failed:', err);
    process.exit(1);
  }
  console.log('✅ Connected to MySQL Database: socialappdb');
});

// Middleware
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Make db available to all routes
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory:', uploadsDir);
} else {
  console.log('📁 Uploads directory exists:', uploadsDir);
}

// ✅ FIXED: Static file serving - YAHAN CHANGE KARO
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    message: '✅ API Server is running!',
    database: 'MySQL - socialappdb',
    timestamp: new Date().toISOString()
  });
});

// ✅ TEST ROUTE FOR PROFILE IMAGES
app.get('/api/test-profile-images', (req, res) => {
  console.log("🔍 Checking profile images...");
  
  const q = "SELECT id, name, profilePic, coverPic FROM users LIMIT 10";
  
  db.query(q, (err, results) => {
    if (err) {
      console.log("❌ Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    
    console.log(`👥 Found ${results.length} users in database`);
    
    const usersWithFileCheck = results.map(user => {
      const profilePath = user.profilePic ? path.join(uploadsDir, user.profilePic) : null;
      const coverPath = user.coverPic ? path.join(uploadsDir, user.coverPic) : null;
      
      const profileExists = user.profilePic ? fs.existsSync(profilePath) : false;
      const coverExists = user.coverPic ? fs.existsSync(coverPath) : false;
      
      console.log(`👤 User ${user.id}: ${user.name}`);
      console.log(`   📸 Profile: ${user.profilePic} - Exists: ${profileExists}`);
      console.log(`   🖼️ Cover: ${user.coverPic} - Exists: ${coverExists}`);
      
      return {
        id: user.id,
        name: user.name,
        profilePic: user.profilePic,
        coverPic: user.coverPic,
        profileExists: profileExists,
        coverExists: coverExists,
        profileUrl: user.profilePic ? `http://localhost:8800/uploads/${user.profilePic}` : null,
        coverUrl: user.coverPic ? `http://localhost:8800/uploads/${user.coverPic}` : null
      };
    });
    
    res.json({
      message: "Users with image verification",
      uploadsDirectory: uploadsDir,
      totalUsers: results.length,
      users: usersWithFileCheck
    });
  });
});

// Direct image test route
app.get('/api/test-image/:filename', (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join(uploadsDir, filename);
  
  console.log("🔍 Testing image access:", filename);
  console.log("📁 Full path:", imagePath);
  
  if (fs.existsSync(imagePath)) {
    console.log("✅ Image exists, sending file...");
    res.sendFile(imagePath);
  } else {
    console.log("❌ Image not found at path:", imagePath);
    res.status(404).json({ 
      error: "Image not found", 
      filename: filename,
      searchedPath: imagePath,
      availableFiles: fs.readdirSync(uploadsDir)
    });
  }
});

const PORT = 8800;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});