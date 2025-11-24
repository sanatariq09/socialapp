import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { 
  getPosts, 
  addPost, 
  deletePost, 
  getPost, 
  getUserPosts 
} from "../controllers/post.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    console.log("📁 Upload path:", uploadPath);
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log("✅ Created uploads directory");
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    console.log("📄 File will be saved as:", uniqueName);
    cb(null, uniqueName);
  },
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Error handling for multer
const handleUploadError = (error, req, res, next) => {
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  next();
};

// Routes
router.get("/", getPosts);
router.get("/:id", getPost);
router.get("/profile/:userId", getUserPosts);

// POST route - accepts both file upload and direct image data
router.post("/", upload.single("file"), handleUploadError, (req, res, next) => {
  console.log("🔄 Posts Route - File:", req.file);
  console.log("🔄 Posts Route - Body:", req.body);
  next();
}, addPost);

// DELETE route
router.delete("/:id", deletePost);

export default router;