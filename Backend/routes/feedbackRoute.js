import express from "express";
import firebaseServices from '../firebase.js'
import { collection, addDoc, Timestamp } from "firebase/firestore";
import multer from "multer";

const {db} = firebaseServices;
const router = express.Router();

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Submit feedback route
router.post("/", upload.single("attachment"), async (req, res) => {
  try {
    const { subject, category, priority, message } = req.body;

    if (!subject || !category || !priority || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const feedbackData = {
      subject,
      category,
      priority,
      message,
      attachment: req.file ? req.file.buffer.toString("base64") : null, // Store file as base64 (optional)
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, "feedback"), feedbackData);

    res.status(201).json({ message: "Feedback submitted successfully", id: docRef.id });
  } catch (error) {
    res.status(500).json({ message: "Error submitting feedback", error: error.message });
  }
});

export default router;
