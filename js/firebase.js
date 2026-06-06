import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBp7GrqwVdooIOuh2l2WFtPtY-nbuHCiys",
    authDomain: "space-invaders-roguelite.firebaseapp.com",
    projectId: "space-invaders-roguelite",
    storageBucket: "space-invaders-roguelite.firebasestorage.app",
    messagingSenderId: "840536369675",
    appId: "1:840536369675:web:cacc8ce76ca80d390df50e",
    measurementId: "G-JEKC7TLVTQ"
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
