import { Game } from './game.js';
import { initAuth, getCurrentUser, login, register, logout, isAdmin, isTester, isOwner, getUsersList, updateUserRole, deleteUser } from './auth.js';
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
    const btnClearLeaderboard = document.getElementById('btnClearLeaderboard');
    const btnToggleManageLeaderboard = document.getElementById('btnToggleManageLeaderboard');
    const userAdminSubtitle = document.getElementById('userAdminSubtitle');
    const userListContainer = document.getElementById('userListContainer');
    const leaderboardManageContainer = document.getElementById('leaderboardManageContainer');
    const leaderboardManageTableBody = document.getElementById('leaderboardManageTableBody');

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

    let isManagingLeaderboard = false;

    function resetAdminPanelTabs() {
        isManagingLeaderboard = false;
        if (userAdminSubtitle) userAdminSubtitle.textContent = 'ZAREJESTROWANI PILOCI';
        if (userListContainer) userListContainer.style.display = 'block';
        if (leaderboardManageContainer) leaderboardManageContainer.style.display = 'none';
        if (btnToggleManageLeaderboard) btnToggleManageLeaderboard.textContent = 'ZARZADZAJ WYNIKAMI';
    }

    // Aktualizacja widoku statusu zalogowanego użytkownika
    function updateAuthUI() {
        const user = getCurrentUser();
        if (user) {
            userStatusText.textContent = user.username.toUpperCase();
            
            // Kolor statusu pilota na obudowie w zależności od roli
            if (user.role === 'owner') {
                userStatusText.className = 'pink';
            } else if (user.role === 'admin') {
                userStatusText.className = 'green';
            } else if (user.role === 'tester') {
                userStatusText.className = 'yellow';
            } else {
                userStatusText.className = 'cyan';
            }
            
            btnAuthAction.textContent = 'WYLOGUJ';
            
            // Przycisk PANEL ADMINA na obudowie widoczny dla admina i ownera
            if (isAdmin()) {
                btnUserAdminPanel.style.display = 'inline-block';
            } else {
                btnUserAdminPanel.style.display = 'none';
            }
            
            // Przycisk ZARZADZAJ WYNIKAMI widoczny tylko dla wlasciciela (owner)
            if (isOwner()) {
                if (btnToggleManageLeaderboard) btnToggleManageLeaderboard.style.display = 'inline-block';
            } else {
                if (btnToggleManageLeaderboard) btnToggleManageLeaderboard.style.display = 'none';
            }
            
            // Tryb debugowania w grze dostępny dla testera, admina i ownera
            if (isTester()) {
                if (btnPauseDebugPanel) btnPauseDebugPanel.style.display = 'block';
            } else {
                if (btnPauseDebugPanel) btnPauseDebugPanel.style.display = 'none';
            }
        } else {
            userStatusText.textContent = 'GOSC';
            userStatusText.className = 'cyan';
            btnAuthAction.textContent = 'LOGOWANIE';
            btnUserAdminPanel.style.display = 'none';
            if (btnToggleManageLeaderboard) btnToggleManageLeaderboard.style.display = 'none';
            if (btnPauseDebugPanel) btnPauseDebugPanel.style.display = 'none';
            
            resetAdminPanelTabs();
            
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
            if (val > 999) val = 999;
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
        btnAuthAction.addEventListener('click', async () => {
            const user = getCurrentUser();
            if (user) {
                await logout();
                updateAuthUI();
                if (game) {
                    game.updateLeaderboardUI();
                }
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
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userVal = document.getElementById('loginUser').value.trim();
            const passVal = document.getElementById('loginPass').value;

            authMessage.textContent = 'Logowanie...';
            authMessage.className = 'auth-message info';

            const res = await login(userVal, passVal);
            if (res.success) {
                authMessage.textContent = res.message;
                authMessage.className = 'auth-message success';
                setTimeout(() => {
                    updateAuthUI();
                    if (game) game.updateLeaderboardUI();
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
        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userVal = document.getElementById('regUser').value.trim();
            const passVal = document.getElementById('regPass').value;
            const pass2Val = document.getElementById('regPass2').value;

            if (passVal !== pass2Val) {
                authMessage.textContent = 'Hasla nie sa identyczne!';
                authMessage.className = 'auth-message error';
                return;
            }

            authMessage.textContent = 'Tworzenie konta...';
            authMessage.className = 'auth-message info';

            const res = await register(userVal, passVal);
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
        btnUserAdminPanel.addEventListener('click', async () => {
            if (isAdmin()) {
                await renderUserTable();
                game.showScreen('userAdminScreen');
            }
        });
    }

    if (btnBackFromUserAdmin) {
        btnBackFromUserAdmin.addEventListener('click', () => {
            resetAdminPanelTabs();
            game.showScreen('menuStartScreen');
        });
    }

    if (btnToggleManageLeaderboard) {
        btnToggleManageLeaderboard.addEventListener('click', async () => {
            if (!isOwner()) return;
            
            isManagingLeaderboard = !isManagingLeaderboard;
            if (isManagingLeaderboard) {
                userAdminSubtitle.textContent = 'EDYCJA TABELI LIDEROW';
                userListContainer.style.display = 'none';
                leaderboardManageContainer.style.display = 'block';
                btnToggleManageLeaderboard.textContent = 'ZARZADZAJ PILOTAMI';
                await renderLeaderboardManageTable();
            } else {
                userAdminSubtitle.textContent = 'ZAREJESTROWANI PILOCI';
                userListContainer.style.display = 'block';
                leaderboardManageContainer.style.display = 'none';
                btnToggleManageLeaderboard.textContent = 'ZARZADZAJ WYNIKAMI';
                await renderUserTable();
            }
        });
    }

    if (btnClearLeaderboard) {
        btnClearLeaderboard.addEventListener('click', async () => {
            if (confirm("Czy na pewno chcesz wyczyscic cala tabele liderow w chmurze? Ta operacja jest nieodwracalna!")) {
                btnClearLeaderboard.disabled = true;
                const res = await game.clearLeaderboard();
                if (res.success) {
                    alert("Tabela liderow zostala wyczyszczona!");
                    if (isManagingLeaderboard) {
                        await renderLeaderboardManageTable();
                    }
                } else {
                    alert("Blad: " + res.message);
                }
                btnClearLeaderboard.disabled = false;
            }
        });
    }

    async function renderUserTable() {
        userTableBody.innerHTML = '<tr><td colspan="3" style="color: var(--neon-cyan); padding: 10px 0;">Pobieranie kont z chmury...</td></tr>';
        
        const accounts = await getUsersList();
        const currentUser = getCurrentUser();
        userTableBody.innerHTML = '';
        
        if (accounts.length === 0) {
            userTableBody.innerHTML = '<tr><td colspan="3" style="color: var(--neon-pink); padding: 10px 0;">Brak kont w chmurze</td></tr>';
            return;
        }
        
        accounts.forEach(acc => {
            const tr = document.createElement('tr');
            
            const tdUser = document.createElement('td');
            tdUser.textContent = acc.username;
            
            const tdRole = document.createElement('td');
            tdRole.textContent = acc.role.toUpperCase();
            if (acc.role === 'owner') {
                tdRole.className = 'pink';
            } else if (acc.role === 'admin') {
                tdRole.className = 'green';
            } else if (acc.role === 'tester') {
                tdRole.className = 'yellow';
            } else {
                tdRole.className = 'cyan';
            }
            
            const tdActions = document.createElement('td');
            
            if (acc.username.toLowerCase() !== currentUser.username.toLowerCase()) {
                // Zabezpieczenie: nikt nie może dotykać konta ownera (głównego właściciela)
                if (acc.role === 'owner') {
                    tdActions.textContent = '(GLOWNY WLASCICIEL)';
                    tdActions.style.color = 'var(--neon-pink)';
                } 
                // Zabezpieczenie: admin nie może modyfikować ani usuwać innych adminów
                else if (currentUser.role === 'admin' && acc.role === 'admin') {
                    tdActions.textContent = '(ADMIN)';
                    tdActions.style.color = 'var(--neon-green)';
                } 
                else {
                    const actionWrapper = document.createElement('div');
                    actionWrapper.className = 'table-actions';
                    
                    const btnPromote = document.createElement('button');
                    btnPromote.className = 'bezel-btn btn-auth-small glow-cyan';
                    
                    const btnDemote = document.createElement('button');
                    btnDemote.className = 'bezel-btn btn-auth-small glow-pink';
                    
                    if (acc.role === 'user') {
                        btnPromote.textContent = 'AWANS';
                        btnPromote.addEventListener('click', async () => {
                            btnPromote.disabled = true;
                            const res = await updateUserRole(acc.username, 'tester');
                            if (res.success) {
                                await renderUserTable();
                                updateAuthUI();
                            } else {
                                alert("Blad: " + res.message);
                                btnPromote.disabled = false;
                            }
                        });
                        actionWrapper.appendChild(btnPromote);
                    } else if (acc.role === 'tester') {
                        btnDemote.textContent = 'DEGRADUJ';
                        btnDemote.addEventListener('click', async () => {
                            btnDemote.disabled = true;
                            const res = await updateUserRole(acc.username, 'user');
                            if (res.success) {
                                await renderUserTable();
                                updateAuthUI();
                            } else {
                                alert("Blad: " + res.message);
                                btnDemote.disabled = false;
                            }
                        });
                        
                        // Tylko owner może promować do roli admina
                        if (currentUser.role === 'owner') {
                            btnPromote.textContent = 'AWANS';
                            btnPromote.addEventListener('click', async () => {
                                btnPromote.disabled = true;
                                const res = await updateUserRole(acc.username, 'admin');
                                if (res.success) {
                                    await renderUserTable();
                                    updateAuthUI();
                                } else {
                                    alert("Blad: " + res.message);
                                    btnPromote.disabled = false;
                                }
                            });
                            actionWrapper.appendChild(btnPromote);
                        }
                        
                        actionWrapper.appendChild(btnDemote);
                    } else if (acc.role === 'admin') {
                        // Tylko owner może degradować adminów
                        if (currentUser.role === 'owner') {
                            btnDemote.textContent = 'DEGRADUJ';
                            btnDemote.addEventListener('click', async () => {
                                btnDemote.disabled = true;
                                const res = await updateUserRole(acc.username, 'tester');
                                if (res.success) {
                                    await renderUserTable();
                                    updateAuthUI();
                                } else {
                                    alert("Blad: " + res.message);
                                    btnDemote.disabled = false;
                                }
                            });
                            actionWrapper.appendChild(btnDemote);
                        }
                    }
                    
                    const btnDelete = document.createElement('button');
                    btnDelete.className = 'bezel-btn btn-auth-small glow-pink';
                    btnDelete.textContent = 'USUN';
                    btnDelete.addEventListener('click', async () => {
                        if (confirm(`Czy na pewno chcesz usunac konto ${acc.username}?`)) {
                            btnDelete.disabled = true;
                            const res = await deleteUser(acc.username);
                            if (res.success) {
                                await renderUserTable();
                            } else {
                                alert("Blad: " + res.message);
                                btnDelete.disabled = false;
                            }
                        }
                    });
                    actionWrapper.appendChild(btnDelete);
                    tdActions.appendChild(actionWrapper);
                }
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

    // Pomocnicza funkcja zwracająca punkty za kosmitów dla danej fali
    function getBaseInvaderPointsForWave(w) {
        if (w === 1) return 550;
        if (w === 2) return 660;
        if (w === 3) return 770;
        if (w === 4) return 880;
        if (w === 5) return 990;
        if (w === 6) return 1210;
        if (w === 7) return 1320;
        if (w === 8) return 1430;
        if (w === 9) return 1540;
        if (w === 10) return 1650;
        if (w === 11) return 1760;
        if (w === 12) return 1870;
        if (w === 13) return 1980;
        if (w === 14) return 2090;
        return 2200; // 15+
    }

    // Oblicza min/max score dla fali
    function getScoreRangeForWave(wave) {
        let completedBase = 0;
        for (let i = 1; i < wave; i++) {
            completedBase += getBaseInvaderPointsForWave(i);
        }
        
        const minScore = completedBase;
        const currentWaveMaxEnemies = getBaseInvaderPointsForWave(wave) - 10;
        const maxTimeBonus = (wave - 1) * 450;
        const maxScore = completedBase + maxTimeBonus + currentWaveMaxEnemies;
        
        return { min: minScore, max: maxScore };
    }

    async function renderLeaderboardManageTable() {
        leaderboardManageTableBody.innerHTML = '<tr><td colspan="4" style="color: var(--neon-cyan); padding: 10px 0;">Pobieranie wynikow...</td></tr>';
        
        const list = await game.getLeaderboardList();
        leaderboardManageTableBody.innerHTML = '';
        
        if (list.length === 0) {
            leaderboardManageTableBody.innerHTML = '<tr><td colspan="4" style="color: var(--neon-pink); padding: 10px 0;">Brak wynikow w bazie danych</td></tr>';
            return;
        }
        
        list.forEach(entry => {
            const tr = document.createElement('tr');
            
            const tdPilot = document.createElement('td');
            tdPilot.textContent = entry.username;
            
            const tdWave = document.createElement('td');
            tdWave.textContent = entry.wave;
            
            const tdScore = document.createElement('td');
            tdScore.textContent = entry.score;
            tdScore.className = 'yellow';
            
            const tdActions = document.createElement('td');
            
            const actionWrapper = document.createElement('div');
            actionWrapper.className = 'table-actions';
            
            const btnEdit = document.createElement('button');
            btnEdit.className = 'btn-leaderboard-action glow-cyan';
            btnEdit.textContent = 'EDYTUJ';
            btnEdit.addEventListener('click', async () => {
                const waveStr = prompt(`Podaj nowa fale dla ${entry.username}:`, entry.wave);
                if (waveStr === null) return;
                const newWave = parseInt(waveStr);
                if (isNaN(newWave) || newWave < 1) {
                    alert("Nieprawidlowa fala!");
                    return;
                }
                
                const scoreStr = prompt(`Podaj nowy wynik dla ${entry.username}:`, entry.score);
                if (scoreStr === null) return;
                let newScore = parseInt(scoreStr);
                if (isNaN(newScore) || newScore < 0) {
                    alert("Nieprawidlowy wynik!");
                    return;
                }
                
                // Walidacja / Przelicznik
                const range = getScoreRangeForWave(newWave);
                if (newScore < range.min) {
                    newScore = range.min;
                    alert(`Wynik za niski dla fali ${newWave}. Skorygowano do minimum: ${newScore} pkt.`);
                } else if (newScore > range.max) {
                    newScore = range.max;
                    alert(`Wynik za wysoki dla fali ${newWave}. Skorygowano do maksimum: ${newScore} pkt.`);
                }
                
                btnEdit.disabled = true;
                const res = await game.updateLeaderboardEntry(entry.id, newWave, newScore);
                if (res.success) {
                    await renderLeaderboardManageTable();
                    if (game) game.updateLeaderboardUI();
                } else {
                    alert("Blad: " + res.message);
                }
                btnEdit.disabled = false;
            });
            
            const btnDelete = document.createElement('button');
            btnDelete.className = 'btn-leaderboard-action glow-pink';
            btnDelete.textContent = 'USUN';
            btnDelete.addEventListener('click', async () => {
                if (confirm(`Czy na pewno chcesz usunac wynik gracza ${entry.username}?`)) {
                    btnDelete.disabled = true;
                    const res = await game.deleteLeaderboardEntry(entry.id);
                    if (res.success) {
                        await renderLeaderboardManageTable();
                        if (game) game.updateLeaderboardUI();
                    } else {
                        alert("Blad: " + res.message);
                    }
                    btnDelete.disabled = false;
                }
            });
            
            actionWrapper.appendChild(btnEdit);
            actionWrapper.appendChild(btnDelete);
            tdActions.appendChild(actionWrapper);
            
            tr.appendChild(tdPilot);
            tr.appendChild(tdWave);
            tr.appendChild(tdScore);
            tr.appendChild(tdActions);
            leaderboardManageTableBody.appendChild(tr);
        });
    }

    // --- PANEL DEBUGOWANIA (TRYB DEBUG - W MENU PAUZY) ---
    if (btnPauseDebugPanel) {
        btnPauseDebugPanel.addEventListener('click', () => {
            if (isTester()) {
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
                if (waveVal > 999) waveVal = 999;
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
