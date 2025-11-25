import { db } from "../connect.js";
import jwt from "jsonwebtoken";

export const getRelationships = (req, res) => {
  const q = "SELECT followerUserId FROM relationships WHERE followedUserId = ?";

  db.query(q, [req.query.followedUserId], (err, data) => {
    if (err) {
      console.error("❌ Database error in getRelationships:", err);
      return res.status(500).json(err);
    }
    console.log("✅ Relationships data:", data);
    return res.status(200).json(data.map(relationship => relationship.followerUserId));
  });
};

export const addRelationship = (req, res) => {
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).json("Not logged in!");

  console.log("🔐 Adding relationship, token:", token);
  console.log("📝 Request body:", req.body);

  jwt.verify(token, "secretkey", (err, userInfo) => {
    if (err) {
      console.error("❌ Token verification error:", err);
      return res.status(403).json("Token is not valid!");
    }

    console.log("✅ User info from token:", userInfo);

    const q = "INSERT INTO relationships (`followerUserId`, `followedUserId`) VALUES (?, ?)";
    const values = [userInfo.id, req.body.userId];

    console.log("🗄️ Executing query:", q);
    console.log("📊 Values:", values);

    db.query(q, values, (err, data) => {
      if (err) {
        console.error("❌ Database error in addRelationship:", err);
        console.error("❌ Error details:", err.sqlMessage);
        return res.status(500).json({ 
          message: "Database error", 
          error: err.sqlMessage 
        });
      }
      console.log("✅ Relationship added successfully:", data);
      return res.status(200).json("Following");
    });
  });
};

export const deleteRelationship = (req, res) => {
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).json("Not logged in!");

  jwt.verify(token, "secretkey", (err, userInfo) => {
    if (err) {
      console.error("❌ Token verification error:", err);
      return res.status(403).json("Token is not valid!");
    }

    const q = "DELETE FROM relationships WHERE `followerUserId` = ? AND `followedUserId` = ?";
    const values = [userInfo.id, req.query.userId];

    console.log("🗄️ Executing delete query:", q);
    console.log("📊 Values:", values);

    db.query(q, values, (err, data) => {
      if (err) {
        console.error("❌ Database error in deleteRelationship:", err);
        console.error("❌ Error details:", err.sqlMessage);
        return res.status(500).json({ 
          message: "Database error", 
          error: err.sqlMessage 
        });
      }
      console.log("✅ Relationship deleted successfully:", data);
      return res.status(200).json("Unfollow");
    });
  });
};