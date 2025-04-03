import express from "express";
import { getUserDetailsByEmail } from "../email.js";

const router = express.Router();

// Fetch user profile by email
router.get("/", async (req, res) => {
    try {
        const { email } = req.query; // Get email from query parameters

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const user = await getUserDetailsByEmail(email);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ message: "User profile fetched successfully", user });
    } catch (error) {
        res.status(500).json({ message: "Error fetching user profile", error: error.message });
    }
});

export default router;
