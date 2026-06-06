import { auth, db } from './firebase.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    collection, 
    updateDoc, 
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

// --- SYSTEM AUTORYZACJI I ZARZĄDZANIA KONTAMI ---
const STORAGE_SESSION_KEY = 'arcade_current_user';

export function initAuth() {
    console.log("System autoryzacji Firebase online.");
}

/**
 * Rejestruje nowego użytkownika w Firebase Auth i Firestore.
 * @param {string} username Nazwa użytkownika
 * @param {string} password Hasło
 * @returns {Promise<{success: boolean, message: string}>} Wynik operacji
 */
export async function register(username, password) {
    if (!username || !password) {
        return { success: false, message: 'Nazwa uzytkownika i haslo sa wymagane!' };
    }
    if (password.length < 6) {
        return { success: false, message: 'Haslo musi miec co najmniej 6 znakow!' };
    }
    
    try {
        const userRef = doc(db, 'users', username.toLowerCase());
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            return { success: false, message: 'Ta nazwa uzytkownika jest juz zajeta!' };
        }
        
        // Firebase Auth wymaga emaila, więc generujemy unikalny e-mail na podstawie nazwy użytkownika
        const fakeEmail = `${username.toLowerCase()}@arcade.local`;
        const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
        
        const role = (username.toLowerCase() === 'admin') ? 'admin' : 'user';
        
        // Zapisujemy profil użytkownika w Firestore
        await setDoc(userRef, {
            username: username,
            role: role,
            uid: userCredential.user.uid,
            createdAt: new Date().toISOString()
        });
        
        return { success: true, message: 'Konto zostalo pomyslnie utworzone!' };
    } catch (err) {
        console.error("Registration error:", err);
        let msg = 'Wystapil blad podczas rejestracji!';
        if (err.code === 'auth/email-already-in-use') {
            msg = 'Ta nazwa uzytkownika jest juz zajeta!';
        } else if (err.code === 'auth/weak-password') {
            msg = 'Haslo jest zbyt slabe!';
        }
        return { success: false, message: msg };
    }
}

/**
 * Loguje użytkownika do systemu.
 * @param {string} username Nazwa użytkownika
 * @param {string} password Hasło
 * @returns {Promise<{success: boolean, user?: object, message: string}>} Wynik operacji
 */
export async function login(username, password) {
    if (!username || !password) {
        return { success: false, message: 'Wprowadz dane logowania!' };
    }
    
    try {
        const fakeEmail = `${username.toLowerCase()}@arcade.local`;
        const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
        
        // Pobieramy dane o roli z Firestore
        const userRef = doc(db, 'users', username.toLowerCase());
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const sessionUser = { username: userData.username, role: userData.role };
            localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionUser));
            return { success: true, user: sessionUser, message: 'Zalogowano pomyslnie!' };
        } else {
            // Rezerwowy fallback, jeśli dokument w bazie nie istnieje
            const role = (username.toLowerCase() === 'admin') ? 'admin' : 'user';
            const sessionUser = { username: username, role: role };
            await setDoc(userRef, {
                username: username,
                role: role,
                uid: userCredential.user.uid,
                createdAt: new Date().toISOString()
            });
            localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionUser));
            return { success: true, user: sessionUser, message: 'Zalogowano pomyslnie!' };
        }
    } catch (err) {
        console.error("Login error:", err);
        let msg = 'Bledny login lub haslo!';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            msg = 'Bledny login lub haslo!';
        }
        return { success: false, message: msg };
    }
}

/**
 * Wylogowuje aktualnego użytkownika.
 */
export async function logout() {
    try {
        await signOut(auth);
    } catch (err) {
        console.error("Sign out error:", err);
    }
    localStorage.removeItem(STORAGE_SESSION_KEY);
}

/**
 * Pobiera dane zalogowanego użytkownika (synchronicznie z localStorage).
 * @returns {object|null} Użytkownik lub null
 */
export function getCurrentUser() {
    return JSON.parse(localStorage.getItem(STORAGE_SESSION_KEY)) || null;
}

/**
 * Sprawdza, czy zalogowany użytkownik jest administratorem (synchronicznie).
 * @returns {boolean} True jeśli admin
 */
export function isAdmin() {
    const user = getCurrentUser();
    return user !== null && user.role === 'admin';
}

/**
 * Pobiera listę wszystkich kont użytkowników z Firestore.
 * @returns {Promise<Array>} Lista użytkowników
 */
export async function getUsersList() {
    try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const users = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            users.push({
                username: data.username,
                role: data.role,
                uid: data.uid
            });
        });
        return users;
    } catch (err) {
        console.error("Error fetching users list:", err);
        return [];
    }
}

/**
 * Aktualizuje rolę użytkownika w Firestore.
 * @param {string} username Nazwa użytkownika
 * @param {string} newRole Nowa rola ('user' | 'admin')
 * @returns {Promise<{success: boolean, message?: string}>} Wynik operacji
 */
export async function updateUserRole(username, newRole) {
    try {
        const userRef = doc(db, 'users', username.toLowerCase());
        await updateDoc(userRef, { role: newRole });
        return { success: true };
    } catch (err) {
        console.error("Error updating role:", err);
        return { success: false, message: err.message };
    }
}

/**
 * Usuwa użytkownika z Firestore.
 * @param {string} username Nazwa użytkownika
 * @returns {Promise<{success: boolean, message?: string}>} Wynik operacji
 */
export async function deleteUser(username) {
    try {
        const userRef = doc(db, 'users', username.toLowerCase());
        await deleteDoc(userRef);
        return { success: true };
    } catch (err) {
        console.error("Error deleting user:", err);
        return { success: false, message: err.message };
    }
}
