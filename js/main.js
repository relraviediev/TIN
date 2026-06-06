import { Game } from './game.js';
import { initAuth, getCurrentUser, login, register, logout, isAdmin } from './auth.js';
import { audio } from './audio.js';

let game;

window.addEventListener('DOMContentLoaded', () => {
    // Inicjalizacja systemu kont
    initAuth();

    // Utworzenie i uruchomienie instancji gry
    game = new Game();
    requestAnimationFrame((time) => game.loop(time));

    // Pobranie elementów DOM dla autoryzacji i debugowania
    const userStatusText = document.getElementById('userStatusText');
    const btnAuthAction = document.getElementById('btnAuthAction');
    const btnAdminPanel = document.getElementById('btnAdminPanel');
    const authStatusBar = document.getElementById('authStatusBar');

    const authScreen = document.getElementById('authScreen');
    const formLogin = document.getElementById('formLogin');
    const formRegister = document.getElementById('formRegister');
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const authMessage = document.getElementById('authMessage');
    const btnBackToMenu = document.getElementById('btnBackToMenu');

    const adminPanelScreen = document.getElementById('adminPanelScreen');
    const btnBackFromAdmin = document.getElementById('btnBackFromAdmin');
    const btnDbgMaxUpgrades = document.getElementById('btnDbgMaxUpgrades');

    // Kontrolki debugowania
    const dbgToggleEnabled = document.getElementById('dbgToggleEnabled');
    const dbgStartWave = document.getElementById('dbgStartWave');
    const dbgToggleGodMode = document.getElementById('dbgToggleGodMode');
    const dbgToggleInfCredits = document.getElementById('dbgToggleInfCredits');
    const dbgToggleAutofire = document.getElementById('dbgToggleAutofire');

    // Aktualizacja widoku statusu zalogowanego użytkownika
    function updateAuthUI() {
        const user = getCurrentUser();
        if (user) {
            userStatusText.textContent = user.username.toUpperCase();
            userStatusText.className = user.role === 'admin' ? 'green' : 'cyan';
            btnAuthAction.textContent = 'WYLOGUJ';
            
            if (user.role === 'admin') {
                btnAdminPanel.style.display = 'inline-block';
            } else {
                btnAdminPanel.style.display = 'none';
            }
        } else {
            userStatusText.textContent = 'GOSC';
            userStatusText.className = 'cyan';
            btnAuthAction.textContent = 'LOGOWANIE';
            btnAdminPanel.style.display = 'none';
            
            // Wyłącz tryb debugowania po wylogowaniu
            localStorage.setItem('dbg_enabled', 'false');
            if (dbgToggleEnabled) dbgToggleEnabled.checked = false;
        }
    }

    // Inicjalne ładowanie stanu przycisków debugowania z localStorage
    function initDebugUI() {
        if (dbgToggleEnabled) dbgToggleEnabled.checked = localStorage.getItem('dbg_enabled') === 'true';
        if (dbgStartWave) dbgStartWave.value = localStorage.getItem('dbg_start_wave') || '1';
        if (dbgToggleGodMode) dbgToggleGodMode.checked = localStorage.getItem('dbg_god_mode') === 'true';
        if (dbgToggleInfCredits) dbgToggleInfCredits.checked = localStorage.getItem('dbg_inf_credits') === 'true';
        if (dbgToggleAutofire) dbgToggleAutofire.checked = localStorage.getItem('dbg_autofire') === 'true';
    }

    // Dodanie nasłuchiwania na zmiany kontrolek debugowania
    if (dbgToggleEnabled) {
        dbgToggleEnabled.addEventListener('change', (e) => {
            localStorage.setItem('dbg_enabled', e.target.checked);
        });
    }
    if (dbgStartWave) {
        dbgStartWave.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val) || val < 1) val = 1;
            if (val > 20) val = 20;
            e.target.value = val;
            localStorage.setItem('dbg_start_wave', val);
        });
    }
    if (dbgToggleGodMode) {
        dbgToggleGodMode.addEventListener('change', (e) => {
            localStorage.setItem('dbg_god_mode', e.target.checked);
        });
    }
    if (dbgToggleInfCredits) {
        dbgToggleInfCredits.addEventListener('change', (e) => {
            localStorage.setItem('dbg_inf_credits', e.target.checked);
        });
    }
    if (dbgToggleAutofire) {
        dbgToggleAutofire.addEventListener('change', (e) => {
            localStorage.setItem('dbg_autofire', e.target.checked);
        });
    }

    // Przycisk Autoryzacji (Logowanie / Wylogowanie)
    if (btnAuthAction) {
        btnAuthAction.addEventListener('click', () => {
            const user = getCurrentUser();
            if (user) {
                logout();
                updateAuthUI();
            } else {
                // Pokaż ekran logowania
                authMessage.textContent = '';
                authMessage.className = 'auth-message';
                formLogin.reset();
                formRegister.reset();
                switchToLoginTab();
                game.showScreen('authScreen');
            }
        });
    }

    // Przełączanie zakładek logowanie / rejestracja
    if (tabLogin) tabLogin.addEventListener('click', switchToLoginTab);
    if (tabRegister) tabRegister.addEventListener('click', switchToRegisterTab);

    function switchToLoginTab() {
        if (tabLogin) tabLogin.classList.add('active');
        if (tabRegister) tabRegister.classList.remove('active');
        if (formLogin) formLogin.style.display = 'flex';
        if (formRegister) formRegister.style.display = 'none';
        if (authMessage) authMessage.textContent = '';
    }

    function switchToRegisterTab() {
        if (tabRegister) tabRegister.classList.add('active');
        if (tabLogin) tabLogin.classList.remove('active');
        if (formRegister) formRegister.style.display = 'flex';
        if (formLogin) formLogin.style.display = 'none';
        if (authMessage) authMessage.textContent = '';
    }

    // Powrót z ekranu autoryzacji do menu głównego
    if (btnBackToMenu) {
        btnBackToMenu.addEventListener('click', () => {
            game.showScreen('menuStartScreen');
        });
    }

    // Obsługa wysłania formularza logowania
    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault();
            const userVal = document.getElementById('loginUser').value.trim();
            const passVal = document.getElementById('loginPass').value;

            const res = login(userVal, passVal);
            if (res.success) {
                authMessage.textContent = res.message;
                authMessage.className = 'auth-message success';
                setTimeout(() => {
                    updateAuthUI();
                    game.showScreen('menuStartScreen');
                }, 800);
            } else {
                authMessage.textContent = res.message;
                authMessage.className = 'auth-message error';
            }
        });
    }

    // Obsługa wysłania formularza rejestracji
    if (formRegister) {
        formRegister.addEventListener('submit', (e) => {
            e.preventDefault();
            const userVal = document.getElementById('regUser').value.trim();
            const passVal = document.getElementById('regPass').value;
            const pass2Val = document.getElementById('regPass2').value;

            if (passVal !== pass2Val) {
                authMessage.textContent = 'Hasla nie sa identyczne!';
                authMessage.className = 'auth-message error';
                return;
            }

            const res = register(userVal, passVal);
            if (res.success) {
                authMessage.textContent = res.message;
                authMessage.className = 'auth-message success';
                setTimeout(() => {
                    switchToLoginTab();
                    document.getElementById('loginUser').value = userVal;
                    document.getElementById('loginPass').value = passVal;
                }, 1000);
            } else {
                authMessage.textContent = res.message;
                authMessage.className = 'auth-message error';
            }
        });
    }

    // Otwarcie panelu administratora
    if (btnAdminPanel) {
        btnAdminPanel.addEventListener('click', () => {
            if (isAdmin()) {
                initDebugUI();
                game.showScreen('adminPanelScreen');
            }
        });
    }

    // Powrót z panelu administratora
    if (btnBackFromAdmin) {
        btnBackFromAdmin.addEventListener('click', () => {
            game.showScreen('menuStartScreen');
        });
    }

    // Uruchomienie maksymalnych ulepszeń w panelu admina
    if (btnDbgMaxUpgrades) {
        btnDbgMaxUpgrades.addEventListener('click', () => {
            if (game && game.player) {
                game.player.upgrades = {
                    fireRate: 5,
                    speed: 5,
                    bulletSpeed: 5,
                    multiShot: 2,
                    explosive: 2,
                    autofire: 1
                };
                audio.playLevelUp();
                
                const originalText = btnDbgMaxUpgrades.textContent;
                btnDbgMaxUpgrades.textContent = 'AKTYWOWANO!';
                btnDbgMaxUpgrades.disabled = true;
                setTimeout(() => {
                    btnDbgMaxUpgrades.textContent = originalText;
                    btnDbgMaxUpgrades.disabled = false;
                }, 1500);
            }
        });
    }

    // Zintegrowanie ukrywania i pokazywania paska logowania w zależności od stanu gry
    // Pasek powinien być widoczny w menu startowym, a ukrywany podczas samej rozgrywki
    const originalShowScreen = game.showScreen.bind(game);
    game.showScreen = function(screenId) {
        originalShowScreen(screenId);
        if (screenId === 'menuStartScreen') {
            if (authStatusBar) authStatusBar.style.display = 'flex';
        } else if (screenId !== 'authScreen' && screenId !== 'adminPanelScreen') {
            // Ukryj pasek statusu w czasie gry, pauzy, sklepu, game over i zwycięstwa
            if (authStatusBar) authStatusBar.style.display = 'none';
        }
    };

    // Inicjalizacja interfejsu autoryzacji i debugowania przy starcie
    updateAuthUI();
    initDebugUI();
});
