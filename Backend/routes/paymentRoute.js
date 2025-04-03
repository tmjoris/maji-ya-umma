import express from "express";
import firebaseServices from '../firebase.js';
import { collection, addDoc, Timestamp } from "firebase/firestore";

const { db } = firebaseServices;
const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const {email, customAmount, paymentMethod, paymentDetails } = req.body;
    
        if (!customAmount || !paymentMethod) {
          return res.status(400).json({ message: "Amount and payment method are required" });
        }
    
        const paymentData = {
          email,
          customAmount,
          paymentMethod,
          paymentDetails: paymentDetails || null, // Ensure paymentDetails is not undefined
          paymentDate: Timestamp.now(),
          billingPeriod: `${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`,
        };

    const docRef = await addDoc(collection(db, "payments"), paymentData);

    res.status(201).json({ message: "Payment recorded successfully", id: docRef.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
