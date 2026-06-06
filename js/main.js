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

    // Pobranie elementów DOM dla autoryzacji i obudowy
    const userStatusText = document.getElementById('userStatusText');
    const btnAuthAction = document.getElementById('btnAuthAction');
    const btnUserAdminPanel = document.getElementById('btnUserAdminPanel');
    const authStatusBar = document.getElementById('authStatusBar');

    // Ekrany autoryzacji
    const authScreen = document.getElementById('authScreen');
    const formLogin = document.getElementById('formLogin');
    const formRegister = document.getElementById('formRegister');
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const authMessage = document.getElementById('authMessage');
    const btnBackToMenu = document.getElementById('btnBackToMenu');

    // Ekran zarządzania użytkownikami (nowy panel admina)
    const userAdminScreen = document.getElementById('userAdminScreen');
    const userTableBody = document.getElementById('userTableBody');
    const btnBackFromUserAdmin = document.getElementById('btnBackFromUserAdmin');

    // Ekran debugowania (otwierany z menu pauzy)
    const adminPanelScreen = document.getElementById('adminPanelScreen');
    const btnPauseDebugPanel = document.getElementById('btnPauseDebugPanel');
    const btnBackFromAdmin = document.getElementById('btnBackFromAdmin');
    const btnDbgMaxUpgrades = document.getElementById('btnDbgMaxUpgrades');
    const btnDbgJumpWave = document.getElementById('btnDbgJumpWave');

    // Kontrolki debugowania
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
                btnUserAdminPanel.style.display = 'inline-block';
                if (btnPauseDebugPanel) btnPauseDebugPanel.style.display = 'block';
            } else {
                btnUserAdminPanel.style.display = 'none';
                if (btnPauseDebugPanel) btnPauseDebugPanel.style.display = 'none';
            }
        } else {
            userStatusText.textContent = 'GOSC';
            userStatusText.className = 'cyan';
            btnAuthAction.textContent = 'LOGOWANIE';
            btnUserAdminPanel.style.display = 'none';
            if (btnPauseDebugPanel) btnPauseDebugPanel.style.display = 'none';
            
            // Wyłącz ulepszenia debugowania po wylogowaniu
            localStorage.removeItem('dbg_enabled');
            localStorage.setItem('dbg_god_mode', 'false');
            localStorage.setItem('dbg_inf_credits', 'false');
            localStorage.setItem('dbg_autofire', 'false');
            localStorage.setItem('dbg_start_wave', '1');
            if (dbgToggleGodMode) dbgToggleGodMode.checked = false;
            if (dbgToggleInfCredits) dbgToggleInfCredits.checked = false;
            if (dbgToggleAutofire) dbgToggleAutofire.checked = false;
            if (dbgStartWave) dbgStartWave.value = '1';
        }
    }

    // Inicjalne ładowanie stanu przycisków debugowania z localStorage
    function initDebugUI() {
        if (dbgStartWave) dbgStartWave.value = localStorage.getItem('dbg_start_wave') || '1';
        if (dbgToggleGodMode) dbgToggleGodMode.checked = localStorage.getItem('dbg_god_mode') === 'true';
        if (dbgToggleInfCredits) dbgToggleInfCredits.checked = localStorage.getItem('dbg_inf_credits') === 'true';
        if (dbgToggleAutofire) dbgToggleAutofire.checked = localStorage.getItem('dbg_autofire') === 'true';
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

    // --- PANEL ZARZĄDZANIA KONTAMI ---
    if (btnUserAdminPanel) {
        btnUserAdminPanel.addEventListener('click', () => {
            if (isAdmin()) {
                renderUserTable();
                game.showScreen('userAdminScreen');
            }
        });
    }

    if (btnBackFromUserAdmin) {
        btnBackFromUserAdmin.addEventListener('click', () => {
            game.showScreen('menuStartScreen');
        });
    }

    function renderUserTable() {
        const accounts = JSON.parse(localStorage.getItem('arcade_accounts')) || [];
        const currentUser = getCurrentUser();
        userTableBody.innerHTML = '';
        
        accounts.forEach(acc => {
            const tr = document.createElement('tr');
            
            const tdUser = document.createElement('td');
            tdUser.textContent = acc.username;
            
            const tdRole = document.createElement('td');
            tdRole.textContent = acc.role.toUpperCase();
            tdRole.className = acc.role === 'admin' ? 'green' : 'cyan';
            
            const tdActions = document.createElement('td');
            
            if (acc.username.toLowerCase() !== currentUser.username.toLowerCase()) {
                const btnToggleRole = document.createElement('button');
                btnToggleRole.className = 'bezel-btn btn-auth-small glow-cyan';
                btnToggleRole.textContent = acc.role === 'admin' ? 'DEGRADUJ' : 'PROMUJ';
                btnToggleRole.style.marginRight = '5px';
                btnToggleRole.addEventListener('click', () => {
                    acc.role = acc.role === 'admin' ? 'user' : 'admin';
                    localStorage.setItem('arcade_accounts', JSON.stringify(accounts));
                    renderUserTable();
                    updateAuthUI();
                });
                
                const btnDelete = document.createElement('button');
                btnDelete.className = 'bezel-btn btn-auth-small glow-pink';
                btnDelete.textContent = 'USUN';
                btnDelete.addEventListener('click', () => {
                    if (confirm(`Czy na pewno chcesz usunac konto ${acc.username}?`)) {
                        const updatedAccounts = accounts.filter(a => a.username.toLowerCase() !== acc.username.toLowerCase());
                        localStorage.setItem('arcade_accounts', JSON.stringify(updatedAccounts));
                        renderUserTable();
                    }
                });
                
                tdActions.appendChild(btnToggleRole);
                tdActions.appendChild(btnDelete);
            } else {
                tdActions.textContent = '(TY)';
                tdActions.style.color = '#558855';
            }
            
            tr.appendChild(tdUser);
            tr.appendChild(tdRole);
            tr.appendChild(tdActions);
            userTableBody.appendChild(tr);
        });
    }

    // --- PANEL DEBUGOWANIA (TRYB DEBUG - W MENU PAUZY) ---
    if (btnPauseDebugPanel) {
        btnPauseDebugPanel.addEventListener('click', () => {
            if (isAdmin()) {
                initDebugUI();
                game.currentState = game.states.ADMIN_PANEL;
                game.showScreen('adminPanelScreen');
            }
        });
    }

    // Powrót z trybu debugowania wraca do PAUZY
    if (btnBackFromAdmin) {
        btnBackFromAdmin.addEventListener('click', () => {
            game.currentState = game.states.PAUSED;
            game.showScreen('pauseScreen');
        });
    }

    // Obsługa teleportacji (Skok do wybranej fali)
    if (btnDbgJumpWave) {
        btnDbgJumpWave.addEventListener('click', () => {
            if (game) {
                let waveVal = parseInt(dbgStartWave.value);
                if (isNaN(waveVal) || waveVal < 1) waveVal = 1;
                if (waveVal > 20) waveVal = 20;
                game.currentWave = waveVal;
                
                audio.playLevelUp();
                game.initWaveGameplay(); // Uruchamia wybraną falę natychmiast
                game.currentState = game.states.PAUSED; // Wymuś stan PAUSED, aby gra nie ruszyła w tle!
                game.showScreen('pauseScreen'); // Pokazuje ekran pauzy
                
                const originalText = btnDbgJumpWave.textContent;
                btnDbgJumpWave.textContent = 'TELEPORT!';
                btnDbgJumpWave.disabled = true;
                setTimeout(() => {
                    btnDbgJumpWave.textContent = originalText;
                    btnDbgJumpWave.disabled = false;
                }, 1000);
            }
        });
    }

    // Uruchomienie maksymalnych ulepszeń w panelu debugowania
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

    // Inicjalizacja interfejsu autoryzacji i debugowania przy starcie
    updateAuthUI();
    initDebugUI();
});
