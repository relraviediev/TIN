import { audio } from './audio.js';
import { Player } from './player.js';
import { Bunker } from './bunker.js';
import { Invader } from './invader.js';
import { Particle } from './particle.js';
import { Projectile } from './projectile.js';
import { varColor } from './utils.js';
import { db } from './firebase.js';
import { 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    limit,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

// --- GŁÓWNA KLASA GRY ---
export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.virtualW = 800;
        this.virtualH = 600;

        this.player = new Player();
        this.invaders = [];
        this.projectiles = [];
        this.particles = [];
        this.bunkers = [];

        this.keys = {};
        this.setupInput();

        this.states = {
            MENU_START: 'menu_start',
            PLAYING: 'playing',
            SHOP: 'shop',
            LEVEL_TRANSITION: 'level_transition',
            PAUSED: 'paused',
            GAME_OVER: 'game_over',
            VICTORY: 'victory',
            AUTH: 'auth',
            ADMIN_PANEL: 'admin_panel'
        };
        this.currentState = this.states.MENU_START;

        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('arcade_highscore')) || 0;
        this.credits = 0;
        this.currentWave = 1;
        this.waveTimer = 45;
        this.timerInterval = null;
        this.gameMode = 'campaign';

        this.invadersDirection = 1;
        this.invadersStepDown = false;
        
        this.lastTime = 0;
        this.accumulatedTime = 0;
        this.fpsLimit = 60;
        this.timestep = 1000 / this.fpsLimit;

        this.invaderStepCooldown = 0;
        this.invaderStepIndex = 0;

        this.prePauseState = null;
        this.spaceReleased = true;
        this.updateLeaderboardUI();
        this.initUIEvents();
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            if (e.code === 'Space') {
                e.preventDefault();
                if (this.currentState === this.states.PLAYING) {
                    if (this.player.upgrades.autofire > 0) {
                        // Ciągły strzał obsługiwany w updatePhysics
                    } else {
                        if (this.spaceReleased) {
                            this.player.shoot(this.projectiles);
                            this.spaceReleased = false;
                        }
                    }
                }
            }

            if (e.code === 'Escape') {
                e.preventDefault();
                this.togglePause();
            }

            // Klawisz K - natychmiastowe zniszczenie kosmitów (dostępny dla admina)
            if (e.code === 'KeyK') {
                const sessionUser = JSON.parse(localStorage.getItem('arcade_current_user') || 'null');
                const isAdmin = sessionUser && sessionUser.role === 'admin';
                if (isAdmin && this.currentState === this.states.PLAYING) {
                    e.preventDefault();
                    this.invaders.forEach(inv => inv.isAlive = false);
                    audio.playExplosion('player');
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (e.code === 'Space') {
                this.spaceReleased = true;
            }
        });

        const btnLeft = document.getElementById('btnLeft');
        const btnRight = document.getElementById('btnRight');
        const btnFire = document.getElementById('btnFire');

        const addTouchEvents = (btn, key) => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.keys[key] = true;
            });
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.keys[key] = false;
            });
        };

        addTouchEvents(btnLeft, 'leftMobile');
        addTouchEvents(btnRight, 'rightMobile');

        btnFire.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.keys['fireMobile'] = true;
            if (this.currentState === this.states.PLAYING && this.player.upgrades.autofire === 0) {
                this.player.shoot(this.projectiles);
            }
        });
        btnFire.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.keys['fireMobile'] = false;
        });
    }

    initUIEvents() {
        document.getElementById('btnCampaign').addEventListener('click', () => {
            this.startGame('campaign');
        });
        document.getElementById('btnInfinite').addEventListener('click', () => {
            this.startGame('infinite');
        });

        document.getElementById('btnResume').addEventListener('click', () => {
            this.togglePause();
        });
        document.getElementById('btnExitToMenu').addEventListener('click', () => {
            this.exitToMenu();
        });
        document.getElementById('btnPauseBezel').addEventListener('click', () => {
            this.togglePause();
        });

        document.getElementById('btnMute').addEventListener('click', () => {
            audio.toggleMute();
        });

        document.getElementById('btnNextWave').addEventListener('click', () => {
            audio.playShopBuy();
            this.startNextWave();
        });

        document.getElementById('btnRestart').addEventListener('click', () => {
            this.restartGame();
        });
        document.getElementById('btnMenuFromOver').addEventListener('click', () => {
            this.exitToMenu();
        });

        document.getElementById('btnVictoryInfinite').addEventListener('click', () => {
            this.gameMode = 'infinite';
            this.currentState = this.states.SHOP;
            this.showScreen('shopScreen');
            this.renderShop();
        });
        document.getElementById('btnMenuFromVic').addEventListener('click', () => {
            this.exitToMenu();
        });
    }

    showScreen(screenId) {
        const screens = [
            'menuStartScreen', 'transitionScreen', 'shopScreen', 
            'pauseScreen', 'gameOverScreen', 'victoryScreen',
            'authScreen', 'adminPanelScreen', 'userAdminScreen'
        ];
        screens.forEach(id => {
            const el = document.getElementById(id);
            if (id === screenId) {
                el.style.display = 'flex';
                el.classList.add('active');
            } else {
                el.style.display = 'none';
                el.classList.remove('active');
            }
        });
    }

    hideAllScreens() {
        const screens = [
            'menuStartScreen', 'transitionScreen', 'shopScreen', 
            'pauseScreen', 'gameOverScreen', 'victoryScreen',
            'authScreen', 'adminPanelScreen', 'userAdminScreen'
        ];
        screens.forEach(id => {
            document.getElementById(id).style.display = 'none';
            document.getElementById(id).classList.remove('active');
        });
    }

    async updateLeaderboardUI() {
        const tbody = document.getElementById('leaderboardBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        try {
            // Pobieramy 5 najlepszych wyników z Firestore
            const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(5));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="4" style="color: var(--neon-pink); padding: 2cqw 0; font-size: 1.2cqw;">BRAK ZAPISANYCH WYNIKOW</td>`;
                tbody.appendChild(tr);
                return;
            }

            let idx = 0;
            querySnapshot.forEach((doc) => {
                const entry = doc.data();
                const tr = document.createElement('tr');
                
                // Kolorowanie pozycji liderów w stylu retro
                let userClass = 'cyan';
                if (idx === 0) userClass = 'yellow';
                else if (idx === 1) userClass = 'green';
                else if (idx === 2) userClass = 'pink';

                tr.innerHTML = `
                    <td>${idx + 1}</td>
                    <td class="${userClass}">${entry.username.toUpperCase()}</td>
                    <td>${entry.wave}</td>
                    <td class="yellow">${String(entry.score).padStart(5, '0')}</td>
                `;
                tbody.appendChild(tr);
                idx++;
            });
        } catch (err) {
            console.error("Error loading leaderboard:", err);
            tbody.innerHTML = `<tr><td colspan="4" style="color: var(--neon-pink); padding: 2cqw 0;">BLAD WCZYTYWANIA DANYCH</td></tr>`;
        }
    }

    async saveScoreToLeaderboard() {
        const user = JSON.parse(localStorage.getItem('arcade_current_user') || 'null');
        const name = user ? user.username : 'GOSC';
        const docId = name.toLowerCase();
        
        try {
            const leaderboardDocRef = doc(db, 'leaderboard', docId);
            
            // Sprawdzamy dotychczasowy najlepszy wynik dla tego pilota/goscia
            const docSnap = await getDoc(leaderboardDocRef);
            let shouldSave = true;
            
            if (docSnap.exists()) {
                const existingEntry = docSnap.data();
                // Zapisujemy tylko jeśli nowy wynik jest wyższy
                if (this.score <= existingEntry.score) {
                    shouldSave = false;
                }
            }
            
            if (shouldSave) {
                const entry = {
                    username: name,
                    wave: this.currentWave,
                    score: this.score,
                    date: Date.now()
                };
                
                await setDoc(leaderboardDocRef, entry);
                console.log(`Saved new high score for ${name}: ${this.score}`);
            } else {
                console.log(`Score ${this.score} is not higher than existing record for ${name}.`);
            }
            
            // Kompatybilność wsteczna z starym systemem high score (localStorage)
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('arcade_highscore', this.highScore);
            }
            
            await this.updateLeaderboardUI();
        } catch (err) {
            console.error("Error saving score to leaderboard:", err);
        }
    }

    startGame(mode) {
        audio.init();
        this.gameMode = mode;
        this.score = 0;
        
        // Resetowanie ułatwień debugowania przy starcie nowej rozgrywki
        localStorage.setItem('dbg_god_mode', 'false');
        localStorage.setItem('dbg_inf_credits', 'false');
        localStorage.setItem('dbg_autofire', 'false');
        localStorage.setItem('dbg_start_wave', '1');
        
        this.credits = 0;
        this.currentWave = 1;
        
        this.player = new Player();
        
        // Ukryj przyciski autoryzacji na obudowie w trakcie gry
        const btnAuth = document.getElementById('btnAuthAction');
        const btnAdmin = document.getElementById('btnUserAdminPanel');
        if (btnAuth) btnAuth.style.display = 'none';
        if (btnAdmin) btnAdmin.style.display = 'none';
        
        this.projectiles = [];
        this.particles = [];
        
        this.initBunkers();

        document.getElementById('hud').style.display = 'flex';
        this.updateHUD();

        this.startWaveTransition();
    }

    initBunkers() {
        this.bunkers = [];
        const spacing = 160;
        const startX = 90;
        for (let i = 0; i < 4; i++) {
            this.bunkers.push(new Bunker(startX + i * spacing, 430));
        }
    }

    startWaveTransition() {
        this.currentState = this.states.LEVEL_TRANSITION;
        this.showScreen('transitionScreen');
        
        const title = document.getElementById('transitionTitle');
        const desc = document.getElementById('transitionDesc');
        const bar = document.getElementById('transitionProgress');
        
        title.textContent = `FALA ${this.currentWave}`;
        desc.textContent = this.gameMode === 'campaign' ? `PRZYGOTOWANIE (${this.currentWave}/20)` : 'PRZYGOTOWANIE (BEZ KONCA)';
        
        audio.playLevelUp();

        bar.style.width = '0%';
        let progress = 0;
        const interval = setInterval(() => {
            if (this.currentState !== this.states.LEVEL_TRANSITION) {
                clearInterval(interval);
                return;
            }
            progress += 5;
            bar.style.width = `${progress}%`;
            
            if (progress >= 100) {
                clearInterval(interval);
                this.initWaveGameplay();
            }
        }, 100);
    }

    initWaveGameplay() {
        this.hideAllScreens();
        this.currentState = this.states.PLAYING;
        this.projectiles = [];
        
        this.player.resetPosition();

        this.invaders = [];
        const startX = 60;
        const startY = 65 + Math.min(6, this.currentWave - 1) * 10;

        const colSpacing = 52;
        const rowSpacing = 40;

        for (let row = 0; row < 5; row++) {
            let type = 'octopus'; // Domyślnie żółty (1 HP)
            
            // Logika ewolucji trudności kosmitów z każdą falą:
            if (this.currentWave === 1) {
                type = 'octopus'; // Fala 1: tylko żółte ośmiorniczki (1 HP)
            } else if (this.currentWave === 2) {
                type = (row === 0) ? 'crab' : 'octopus'; // Fala 2: 1 rząd różowych (2 HP) na górze
            } else if (this.currentWave === 3) {
                type = (row <= 1) ? 'crab' : 'octopus'; // Fala 3: 2 rzędy różowych
            } else if (this.currentWave === 4) {
                type = (row <= 2) ? 'crab' : 'octopus'; // Fala 4: 3 rzędy różowych
            } else if (this.currentWave === 5) {
                type = (row <= 3) ? 'crab' : 'octopus'; // Fala 5: 4 rzędy różowych
            } else if (this.currentWave === 6) {
                type = (row === 0) ? 'squid' : 'crab'; // Fala 6: 1 rząd błękitnych (3 HP) na górze, reszta różowe. ŻÓŁTE ZNIKAJĄ!
            } else if (this.currentWave === 7) {
                type = (row <= 1) ? 'squid' : 'crab'; // Fala 7: 2 rzędy błękitnych
            } else if (this.currentWave === 8) {
                type = (row <= 2) ? 'squid' : 'crab'; // Fala 8: 3 rzędy błękitnych
            } else if (this.currentWave === 9) {
                type = (row <= 3) ? 'squid' : 'crab'; // Fala 9: 4 rzędy błękitnych
            } else if (this.currentWave === 10) {
                type = 'squid'; // Fala 10: wszystkie 5 rzędów to błękitne statki Squid (3 HP)
            } else if (this.currentWave === 11) {
                type = (row === 0) ? 'red' : 'squid'; // Fala 11: 1 rząd czerwonych (4 HP) na górze
            } else if (this.currentWave === 12) {
                type = (row <= 1) ? 'red' : 'squid'; // Fala 12: 2 rzędy czerwonych
            } else if (this.currentWave === 13) {
                type = (row <= 2) ? 'red' : 'squid'; // Fala 13: 3 rzędy czerwonych
            } else if (this.currentWave === 14) {
                type = (row <= 3) ? 'red' : 'squid'; // Fala 14: 4 rzędy czerwonych
            } else {
                type = 'red'; // Fala 15+: wszystkie 5 rzędów to najsilniejsze czerwone statki (4 HP)!
            }

            for (let col = 0; col < 11; col++) {
                const invX = startX + col * colSpacing;
                const invY = startY + row * rowSpacing;
                this.invaders.push(new Invader(invX, invY, type, row));
            }
        }

        this.invadersDirection = 1;
        this.invadersStepDown = false;
        
        this.invaderStepCooldown = 0;
        this.invaderStepIndex = 0;

        this.waveTimer = 45;
        this.updateHUD();
        
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.currentState === this.states.PLAYING) {
                if (this.waveTimer > 0) {
                    this.waveTimer--;
                    this.updateHUD();
                }
            }
        }, 1000);
    }

    updateHUD() {
        document.getElementById('scoreVal').textContent = String(this.score).padStart(5, '0');
        
        const waveBox = document.getElementById('waveVal');
        if (this.gameMode === 'campaign') {
            waveBox.textContent = `${this.currentWave}/20`;
        } else {
            waveBox.textContent = `${this.currentWave}/∞`;
        }

        document.getElementById('timerVal').textContent = `${this.waveTimer}s`;
        document.getElementById('creditsVal').textContent = `${this.credits} $`;

        const container = document.getElementById('livesContainer');
        container.innerHTML = '';
        for (let i = 0; i < this.player.lives; i++) {
            const live = document.createElement('div');
            live.className = 'live-indicator';
            container.appendChild(live);
        }
    }

    togglePause() {
        if (this.currentState === this.states.PLAYING || this.currentState === this.states.SHOP) {
            // Zapisz stan przed zapauzowaniem
            this.prePauseState = this.currentState;
            this.currentState = this.states.PAUSED;
            this.showScreen('pauseScreen');
        } else if (this.currentState === this.states.PAUSED) {
            // Wznowienie - powrót do poprzedniego stanu (gra lub sklep)
            const targetState = this.prePauseState || this.states.PLAYING;
            this.currentState = targetState;
            
            if (this.currentState === this.states.SHOP) {
                this.showScreen('shopScreen');
                this.renderShop();
            } else {
                this.hideAllScreens();
            }
        } else if (this.currentState === this.states.ADMIN_PANEL) {
            // Powrót z trybu debugowania do pauzy
            this.currentState = this.states.PAUSED;
            this.showScreen('pauseScreen');
        }
    }

    endWave(timeOut = false) {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        // Zmniejszony bonus za pozostały czas (max +10 monet), by uregulować ekonomię
        if (!timeOut && this.waveTimer > 0) {
            const timeBonus = Math.min(10, Math.floor(this.waveTimer / 4));
            this.credits += timeBonus;
            this.score += this.waveTimer * 10;
        }

        if (this.gameMode === 'campaign' && this.currentWave === 20) {
            this.showVictoryScreen();
            return;
        }

        this.currentState = this.states.SHOP;
        this.showScreen('shopScreen');
        this.renderShop();
    }

    showVictoryScreen() {
        this.currentState = this.states.VICTORY;
        this.showScreen('victoryScreen');
        
        document.getElementById('vicScore').textContent = this.score;
        document.getElementById('vicAliens').textContent = "Wszystkich!";
        
        this.saveScoreToLeaderboard();
    }

    renderShop() {
        const infCredits = localStorage.getItem('dbg_inf_credits') === 'true';
        if (infCredits) {
            this.credits = 9999;
        }

        document.getElementById('shopCredits').textContent = `${this.credits} $`;
        const grid = document.getElementById('shopGrid');
        grid.innerHTML = '';

        // Skalowane ceny ulepszeń (droższa ekonomia uniemożliwiająca max-out na starcie)
        const upgradesConfig = [
            {
                key: 'fireRate',
                title: 'SZYBKOSTRZELNOSC',
                desc: 'Skraca czas ladowania lasera',
                max: 5,
                basePrice: 15,
                priceScale: 1.8,
                current: this.player.upgrades.fireRate
            },
            {
                key: 'speed',
                title: 'PREDKOSC STATKU',
                desc: 'Szybsze poruszanie sie lewo/prawo',
                max: 5,
                basePrice: 10,
                priceScale: 1.6,
                current: this.player.upgrades.speed
            },
            {
                key: 'bulletSpeed',
                title: 'PREDKOSC LASERA',
                desc: 'Pociski leca szybciej w gore',
                max: 5,
                basePrice: 10,
                priceScale: 1.6,
                current: this.player.upgrades.bulletSpeed
            },
            {
                key: 'multiShot',
                title: 'WIELOKROTNY STRZAL',
                desc: 'Odblokowuje podwojny i potrojny strzal',
                max: 2,
                basePrice: 40,
                priceScale: 2.5,
                current: this.player.upgrades.multiShot
            },
            {
                key: 'explosive',
                title: 'NEONOWE WYBUCHY',
                desc: 'Wybuch pocisku niszczy sasiadow',
                max: 2,
                basePrice: 40,
                priceScale: 2.5,
                current: this.player.upgrades.explosive
            },
            {
                key: 'autofire',
                title: 'AUTO-STRZAL',
                desc: 'Ciagly strzal przez trzymanie spacji',
                max: 1,
                basePrice: 30,
                priceScale: 1.0,
                current: this.player.upgrades.autofire || 0
            }
        ];

        upgradesConfig.forEach(upg => {
            const card = document.createElement('div');
            const isMaxed = upg.current >= upg.max;
            card.className = `shop-card ${isMaxed ? 'maxed' : ''}`;

            const currentPrice = isMaxed ? 0 : Math.floor(upg.basePrice * Math.pow(upg.priceScale, upg.current));

            let levelDots = '';
            for (let i = 1; i <= upg.max; i++) {
                const activeClass = i <= upg.current ? (isMaxed ? 'maxed' : 'active') : '';
                levelDots += `<div class="level-dot ${activeClass}"></div>`;
            }

            card.innerHTML = `
                <div class="shop-card-info">
                    <div class="shop-card-title ${isMaxed ? 'green' : 'yellow'}">${upg.title}</div>
                    <div class="shop-card-desc">${upg.desc}</div>
                    <div class="shop-card-levels">${levelDots}</div>
                </div>
                <div class="shop-card-action">
                    <span class="shop-card-price yellow">${isMaxed ? 'MAX' : `${currentPrice} $`}</span>
                    <button class="btn-buy" ${isMaxed || this.credits < currentPrice ? 'disabled' : ''} data-key="${upg.key}" data-price="${currentPrice}">
                        ${isMaxed ? 'KUPIONO' : 'KUP'}
                    </button>
                </div>
            `;

            const btn = card.querySelector('.btn-buy');
            if (btn && !isMaxed && this.credits >= currentPrice) {
                btn.addEventListener('click', (e) => {
                    const key = e.target.getAttribute('data-key');
                    const price = parseInt(e.target.getAttribute('data-price'));
                    
                    this.credits -= price;
                    this.player.upgrades[key]++;
                    
                    audio.playShopBuy();
                    this.renderShop();
                    this.updateHUD();
                });
            }

            grid.appendChild(card);
        });

        // Dostosowanie cen ulepszeń jednorazowych
        const bunkerRepairPrice = 15;
        const bunkerCard = document.createElement('div');
        bunkerCard.className = 'shop-card';
        bunkerCard.innerHTML = `
            <div class="shop-card-info">
                <div class="shop-card-title green">NAPRAWA BUNKROW</div>
                <div class="shop-card-desc">Przywraca 100% zniszczonych oslon</div>
                <div class="shop-card-levels"></div>
            </div>
            <div class="shop-card-action">
                <span class="shop-card-price yellow">${bunkerRepairPrice} $</span>
                <button class="btn-buy" ${this.credits < bunkerRepairPrice ? 'disabled' : ''} id="btnBuyBunkerRepair">KUP</button>
            </div>
        `;
        const btnBunker = bunkerCard.querySelector('#btnBuyBunkerRepair');
        if (btnBunker && this.credits >= bunkerRepairPrice) {
            btnBunker.addEventListener('click', () => {
                this.credits -= bunkerRepairPrice;
                this.bunkers.forEach(b => b.repair());
                audio.playShopBuy();
                this.renderShop();
                this.updateHUD();
            });
        }
        grid.appendChild(bunkerCard);

        const lifePrice = 25;
        const isLifeMaxed = this.player.lives >= this.player.maxLives;
        const lifeCard = document.createElement('div');
        lifeCard.className = 'shop-card';
        lifeCard.innerHTML = `
            <div class="shop-card-info">
                <div class="shop-card-title pink">DODATKOWE ZYCIE</div>
                <div class="shop-card-desc">Dodaje +1 serduszko (Maksymalnie 5)</div>
                <div class="shop-card-levels"></div>
            </div>
            <div class="shop-card-action">
                <span class="shop-card-price yellow">${isLifeMaxed ? 'MAX' : `${lifePrice} $`}</span>
                <button class="btn-buy" ${isLifeMaxed || this.credits < lifePrice ? 'disabled' : ''} id="btnBuyLife">
                    ${isLifeMaxed ? 'MAX' : 'KUP'}
                </button>
            </div>
        `;
        const btnLife = lifeCard.querySelector('#btnBuyLife');
        if (btnLife && !isLifeMaxed && this.credits >= lifePrice) {
            btnLife.addEventListener('click', () => {
                this.credits -= lifePrice;
                this.player.lives++;
                audio.playShopBuy();
                this.renderShop();
                this.updateHUD();
            });
        }
        grid.appendChild(lifeCard);
    }

    startNextWave() {
        this.currentWave++;
        this.startWaveTransition();
    }

    gameOver() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.currentState = this.states.GAME_OVER;
        this.showScreen('gameOverScreen');
        
        audio.playGameOver();

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalWaves').textContent = this.currentWave - 1;
        document.getElementById('finalCredits').textContent = `${this.credits} $`;

        const status = document.getElementById('gameOverStatus');
        if (this.player.lives <= 0) {
            status.textContent = "Twoj statek zostal doszczetnie zniszczony!";
        } else {
            status.textContent = "Kosmici dotarli do powierzchni Ziemie!";
        }

        this.saveScoreToLeaderboard();
    }

    restartGame() {
        this.startGame(this.gameMode);
    }

    exitToMenu() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.currentState = this.states.MENU_START;
        this.showScreen('menuStartScreen');
        document.getElementById('hud').style.display = 'none';
        
        // Przywróć przyciski autoryzacji na obudowie
        const btnAuth = document.getElementById('btnAuthAction');
        const btnAdmin = document.getElementById('btnUserAdminPanel');
        if (btnAuth) btnAuth.style.display = 'inline-block';
        
        const user = JSON.parse(localStorage.getItem('arcade_current_user') || 'null');
        if (btnAdmin) {
            btnAdmin.style.display = (user && user.role === 'admin') ? 'inline-block' : 'none';
        }
        
        this.ctx.clearRect(0, 0, this.virtualW, this.virtualH);
    }

    updatePhysics() {
        if (this.currentState !== this.states.PLAYING) return;

        // 1. Aktualizacja Gracza
        this.player.update(this.keys, this.virtualW);

        // Ciągły ogień (Autofire) jeśli ulepszenie jest odblokowane i klawisz spacji lub przycisk mobilny są wciśnięte
        if (this.player.upgrades.autofire > 0 && (this.keys['Space'] || this.keys['fireMobile'])) {
            this.player.shoot(this.projectiles);
        }

        // 2. Aktualizacja cząsteczek
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => p.alpha > 0);

        // 3. Aktualizacja pocisków
        this.projectiles.forEach(proj => {
            proj.update();
        });
        this.projectiles = this.projectiles.filter(proj => proj.active);

        // 4. Detekcja uderzenia kosmitów w dół lub krawędź
        let reachedEdge = false;
        const alienMoveSpeed = this.getAlienSpeed();
        
        this.invaders.forEach(inv => {
            if (!inv.isAlive) return;

            inv.x += alienMoveSpeed * this.invadersDirection;

            if (inv.x < 15 || inv.x > this.virtualW - inv.width - 15) {
                reachedEdge = true;
            }

            if (inv.y + inv.height >= this.player.y) {
                this.gameOver();
            }
        });

        if (reachedEdge) {
            this.invadersDirection *= -1;
            this.invaders.forEach(inv => {
                inv.y += 12;
                inv.animFrame = inv.animFrame === 0 ? 1 : 0;
            });
        }

        // 5. Obsługa rytmu ruchów kosmitów
        this.invaderStepCooldown++;
        const totalAlive = this.invaders.filter(inv => inv.isAlive).length;
        const stepRate = Math.max(3, Math.floor((totalAlive / 55) * 40));
        
        if (this.invaderStepCooldown >= stepRate) {
            this.invaderStepCooldown = 0;
            this.invaders.forEach(inv => {
                if (inv.isAlive) {
                    inv.animFrame = inv.animFrame === 0 ? 1 : 0;
                }
            });

            const pitches = [1.0, 0.9, 0.8, 0.7];
            audio.playInvaderStep(pitches[this.invaderStepIndex]);
            this.invaderStepIndex = (this.invaderStepIndex + 1) % 4;
        }

        // 6. Losowy ostrzał kosmitów w dół
        this.alienShootingLogic(totalAlive);

        // 7. Silnik Kolizji
        this.handleCollisions();

        // 8. Sprawdzenie wygranej fali
        if (totalAlive === 0) {
            this.endWave(false);
        }
    }

    getAlienSpeed() {
        const waveBonus = Math.min(1.5, (this.currentWave - 1) * 0.08);
        const baseSpeed = 0.4 + waveBonus;
        
        const active = this.invaders.filter(inv => inv.isAlive).length;
        const destroyedCount = 55 - active;
        
        return baseSpeed + destroyedCount * 0.025;
    }

    alienShootingLogic(totalAlive) {
        if (totalAlive === 0) return;

        const baseShootChance = 0.0015 + Math.min(0.015, (this.currentWave - 1) * 0.001);
        
        if (Math.random() < baseShootChance) {
            const columns = {};
            this.invaders.forEach(inv => {
                if (inv.isAlive) {
                    const col = Math.floor(inv.x / 50);
                    if (!columns[col]) columns[col] = [];
                    columns[col].push(inv);
                }
            });

            const colKeys = Object.keys(columns);
            if (colKeys.length > 0) {
                const randomColKey = colKeys[Math.floor(Math.random() * colKeys.length)];
                const colInvaders = columns[randomColKey];
                
                let lowestInvader = colInvaders[0];
                colInvaders.forEach(inv => {
                    if (inv.y > lowestInvader.y) {
                        lowestInvader = inv;
                    }
                });

                const alienBulletSpeed = 2.0 + Math.min(1.5, (this.currentWave - 1) * 0.1);
                
                this.projectiles.push(new Projectile(
                    lowestInvader.x + lowestInvader.width / 2,
                    lowestInvader.y + lowestInvader.height,
                    alienBulletSpeed,
                    'alien'
                ));
                audio.playAlienLaser();
            }
        }
    }

    handleCollisions() {
        this.projectiles.forEach(proj => {
            if (!proj.active) return;

            // 1. Kolizje z Bunkrami
            this.bunkers.forEach(bunker => {
                bunker.checkCollision(proj, this.particles);
            });

            if (!proj.active) return;

            // 2. Pociski Gracza vs Kosmici
            if (proj.owner === 'player') {
                this.invaders.forEach(inv => {
                    if (!inv.isAlive || !proj.active) return;

                    if (proj.x >= inv.x && proj.x <= inv.x + inv.width &&
                        proj.y >= inv.y && proj.y <= inv.y + inv.height) {

                        // Zadaj obrażenia (odjmij 1 HP wrogowi)
                        inv.hp--;
                        proj.active = false;

                        if (inv.hp > 0) {
                            // Kosmita wciąż żyje - odtwórz metaliczny dźwięk uderzenia i małe iskry
                            audio.playExplosion('hit');
                            for (let i = 0; i < 4; i++) {
                                this.particles.push(new Particle(proj.x, proj.y, inv.getColor()));
                            }
                        } else {
                            // Kosmita zostaje zniszczony!
                            inv.isAlive = false;
                            this.score += inv.points;
                            
                            // Gwarantowane 1 moneta za każdego zniszczonego przeciwnika
                            this.credits += 1;
                            this.updateHUD();

                            audio.playExplosion('alien');

                            for (let i = 0; i < 10; i++) {
                                this.particles.push(new Particle(
                                    inv.x + inv.width/2, 
                                    inv.y + inv.height/2, 
                                    inv.getColor()
                                ));
                            }

                            // Neonowy wybuch przenosi obrażenia na sąsiednie statki
                            if (proj.isExplosive) {
                                this.triggerExplosiveAmmo(inv, proj.blastRadius);
                            }
                        }
                    }
                });
            }

            // 3. Pociski Kosmitów vs Statek Gracza
            if (proj.owner === 'alien' && this.player.isAlive) {
                if (proj.x >= this.player.x && proj.x <= this.player.x + this.player.width &&
                    proj.y >= this.player.y && proj.y <= this.player.y + this.player.height) {

                    proj.active = false;
                    
                    // God Mode w trybie debugowania
                    const godMode = localStorage.getItem('dbg_god_mode') === 'true';
                    if (godMode) {
                        audio.playExplosion('hit');
                        for (let i = 0; i < 4; i++) {
                            this.particles.push(new Particle(proj.x, proj.y, varColor('--neon-pink', '#ff007f')));
                        }
                        return;
                    }

                    this.player.lives--;
                    this.updateHUD();
                    
                    audio.playExplosion('player');

                    const pColor = varColor('--neon-green', '#39ff14');
                    for (let i = 0; i < 15; i++) {
                        this.particles.push(new Particle(
                            this.player.x + this.player.width/2,
                            this.player.y + this.player.height/2,
                            pColor
                        ));
                    }

                    if (this.player.lives <= 0) {
                        this.player.isAlive = false;
                        setTimeout(() => this.gameOver(), 1000);
                    } else {
                        this.player.resetPosition();
                    }
                }
            }
        });
    }

    triggerExplosiveAmmo(centerInvader, blastLvl) {
        const radius = blastLvl === 1 ? 65 : 95;
        const color = varColor('--neon-cyan', '#00f3ff');
        const centerX = centerInvader.x + centerInvader.width/2;
        const centerY = centerInvader.y + centerInvader.height/2;

        for (let angle = 0; angle < Math.PI * 2; angle += 0.4) {
            const p = new Particle(centerX, centerY, color);
            p.vx = Math.cos(angle) * (blastLvl === 1 ? 3 : 5);
            p.vy = Math.sin(angle) * (blastLvl === 1 ? 3 : 5);
            this.particles.push(p);
        }

        this.invaders.forEach(inv => {
            if (!inv.isAlive) return;

            const invX = inv.x + inv.width/2;
            const invY = inv.y + inv.height/2;
            const dist = Math.sqrt(Math.pow(invX - centerX, 2) + Math.pow(invY - centerY, 2));

            if (dist <= radius) {
                // Wybuch zadaje 1 punkt obrażeń
                inv.hp--;

                if (inv.hp > 0) {
                    for (let i = 0; i < 3; i++) {
                        this.particles.push(new Particle(invX, invY, inv.getColor()));
                    }
                } else {
                    inv.isAlive = false;
                    this.score += inv.points;
                    
                    // Gwarantowane 1 moneta za każdego zniszczonego przeciwnika
                    this.credits += 1;
                    
                    for (let i = 0; i < 6; i++) {
                        this.particles.push(new Particle(invX, invY, inv.getColor()));
                    }
                }
            }
        });
    }

    render() {
        this.ctx.fillStyle = 'rgba(11, 15, 25, 0.25)';
        this.ctx.fillRect(0, 0, this.virtualW, this.virtualH);

        this.drawStars();

        if (this.currentState === this.states.PLAYING || this.currentState === this.states.PAUSED) {
            this.bunkers.forEach(b => b.draw(this.ctx));
            this.player.draw(this.ctx);
            this.invaders.forEach(inv => inv.draw(this.ctx));
            
            this.projectiles.forEach(proj => proj.draw(this.ctx));
            this.particles.forEach(p => p.draw(this.ctx));
        }
    }

    drawStars() {
        this.ctx.save();
        this.ctx.fillStyle = '#ffffff';
        
        const time = Date.now() * 0.0008;
        
        for (let i = 0; i < 40; i++) {
            const seedX = Math.sin(i * 1234.56) * 0.5 + 0.5;
            const seedY = Math.cos(i * 9876.54) * 0.5 + 0.5;
            const sizeSeed = Math.sin(i * 555.5) * 0.5 + 0.5;

            const x = Math.floor(seedX * this.virtualW);
            let y = Math.floor((seedY * this.virtualH + time * (10 + sizeSeed * 10)) % this.virtualH);
            
            const alpha = 0.2 + Math.abs(Math.sin(time + i)) * 0.6;
            
            this.ctx.globalAlpha = alpha;
            this.ctx.fillRect(x, y, sizeSeed * 2 + 1, sizeSeed * 2 + 1);
        }
        this.ctx.restore();
    }

    loop(currentTime) {
        if (!this.lastTime) this.lastTime = currentTime;
        
        const elapsed = currentTime - this.lastTime;
        this.lastTime = currentTime;

        this.accumulatedTime += elapsed;
        if (this.accumulatedTime > 250) this.accumulatedTime = 250;

        while (this.accumulatedTime >= this.timestep) {
            this.updatePhysics();
            this.accumulatedTime -= this.timestep;
        }

        this.render();

        requestAnimationFrame((time) => this.loop(time));
    }
}
