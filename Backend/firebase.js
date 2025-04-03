import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCy2hOZJWTCdhl4OzHskyU6teOuN061a4Q",
  authDomain: "maji-ya-umma.firebaseapp.com",
  projectId: "maji-ya-umma",
  storageBucket: "maji-ya-umma.firebasestorage.app",
  messagingSenderId: "186912029349",
  appId: "1:186912029349:web:959c21a0859489fff82b4c"
};

const app = initializeApp(firebaseConfig); 
const db = getFirestore(app); 
const auth = getAuth(app); 

const firebaseServices = { auth, app, db };

export default firebaseServices;
