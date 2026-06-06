// --- SYSTEM AUTORYZACJI I ZARZĄDZANIA KONTAMI ---

const STORAGE_ACCOUNTS_KEY = 'arcade_accounts';
const STORAGE_SESSION_KEY = 'arcade_current_user';

export function initAuth() {
    // Sprawdź, czy są już zarejestrowane konta
    let accounts = JSON.parse(localStorage.getItem(STORAGE_ACCOUNTS_KEY)) || [];
    
    // Jeśli nie ma żadnych kont, dodaj domyślnego admina
    const hasAdmin = accounts.some(acc => acc.username === 'admin');
    if (!hasAdmin) {
        accounts.push({
            username: 'admin',
            password: 'admin',
            role: 'admin'
        });
        localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
    }
}

/**
 * Rejestruje nowego użytkownika.
 * @param {string} username Nazwa użytkownika
 * @param {string} password Hasło
 * @param {string} role Rola ('user' lub 'admin')
 * @returns {{success: boolean, message: string}} Wynik operacji
 */
export function register(username, password, role = 'user') {
    if (!username || !password) {
        return { success: false, message: 'Nazwa uzytkownika i haslo sa wymagane!' };
    }
    
    const accounts = JSON.parse(localStorage.getItem(STORAGE_ACCOUNTS_KEY)) || [];
    const exists = accounts.some(acc => acc.username.toLowerCase() === username.toLowerCase());
    
    if (exists) {
        return { success: false, message: 'Ta nazwa uzytkownika jest juz zajeta!' };
    }
    
    accounts.push({ username, password, role });
    localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
    return { success: true, message: 'Konto zostalo pomyslnie utworzone!' };
}

/**
 * Loguje użytkownika do systemu.
 * @param {string} username Nazwa użytkownika
 * @param {string} password Hasło
 * @returns {{success: boolean, user?: object, message: string}} Wynik operacji
 */
export function login(username, password) {
    if (!username || !password) {
        return { success: false, message: 'Wprowadz dane logowania!' };
    }
    
    const accounts = JSON.parse(localStorage.getItem(STORAGE_ACCOUNTS_KEY)) || [];
    const user = accounts.find(acc => acc.username.toLowerCase() === username.toLowerCase() && acc.password === password);
    
    if (!user) {
        return { success: false, message: 'Bledny login lub haslo!' };
    }
    
    const sessionUser = { username: user.username, role: user.role };
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionUser));
    return { success: true, user: sessionUser, message: 'Zalogowano pomyslnie!' };
}

/**
 * Wylogowuje aktualnego użytkownika.
 */
export function logout() {
    localStorage.removeItem(STORAGE_SESSION_KEY);
}

/**
 * Pobiera dane zalogowanego użytkownika.
 * @returns {object|null} Użytkownik lub null
 */
export function getCurrentUser() {
    return JSON.parse(localStorage.getItem(STORAGE_SESSION_KEY)) || null;
}

/**
 * Sprawdza, czy zalogowany użytkownik jest administratorem.
 * @returns {boolean} True jeśli admin
 */
export function isAdmin() {
    const user = getCurrentUser();
    return user !== null && user.role === 'admin';
}
