import express from "express";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import firebaseServices from "../firebase.js";
import { getUserDetailsByEmail } from "../email.js";

const router = express.Router();
const { db } = firebaseServices;

router.post("/", async (req, res) => {
    try {
        const { email, address, city, zipCode } = req.body;
        
        const user = await getUserDetailsByEmail(email);
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        const requestAddress = address || user.address;
        const requestCity = city || user.city || "";
        const requestZipCode = zipCode || user.zipCode || "";

        // Creates request entry in Firestore
        const docRef = await addDoc(collection(db, "connectionRequests"), {
            firstName: user.firstName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            address: requestAddress,
            city: requestCity,
            zipCode: requestZipCode,
            status: "Pending",
            assignedTo: "Plumbing & Installation Unit",
            createdAt: serverTimestamp(),
        });
        
        res.status(201).json({ 
            message: "Request submitted successfully", 
            requestId: docRef.id,
            userRole: user.userRole // Return the userRole in the response
        });
    } catch (error) {
        res.status(500).json({ message: "Error submitting request", error: error.message });
    }
});

export default router;