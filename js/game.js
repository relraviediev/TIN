import { audio } from './audio.js';
import { Player } from './player.js';
import { Bunker } from './bunker.js';
import { Invader } from './invader.js';
import { Particle } from './particle.js';
import { Projectile } from './projectile.js';
import { varColor } from './utils.js';
import { SPRITES, drawPixelSprite } from './sprites.js';
import { leaderboardService } from './leaderboardService.js';
import { getCampaignWaveConfig, generateInfiniteWaveConfig } from './waveConfig.js';

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
        this.activeModifier = 'NORMAL';
        this.ufo = null;
        this.bossSpawnMilestones = { 45: false, 30: false, 15: false };
        this.bossShieldMode = 'center';
        this.bossShieldTimer = 0;

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
                            this.player.shoot(this.projectiles, this.activeModifier);
                            this.spaceReleased = false;
                        }
                    }
                }
            }

            if (e.code === 'Escape') {
                e.preventDefault();
                this.togglePause();
            }

            // Klawisz K - natychmiastowe zniszczenie kosmitów (dostępny dla admina/testera)
            if (e.code === 'KeyK') {
                const sessionUser = JSON.parse(localStorage.getItem('arcade_current_user') || 'null');
                const hasDebug = sessionUser && (sessionUser.role === 'admin' || sessionUser.role === 'tester' || sessionUser.role === 'owner');
                if (hasDebug && this.currentState === this.states.PLAYING) {
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

        try {
            const topScores = await leaderboardService.fetchTopScores(5);
            tbody.innerHTML = '';

            const totalRows = 5;
            for (let i = 0; i < totalRows; i++) {
                const tr = document.createElement('tr');
                if (i < topScores.length) {
                    const entry = topScores[i];
                    let userClass = 'cyan';
                    if (i === 0) userClass = 'yellow';
                    else if (i === 1) userClass = 'green';
                    else if (i === 2) userClass = 'pink';

                    tr.innerHTML = `
                        <td>${i + 1}</td>
                        <td class="${userClass}">${entry.username.toUpperCase()}</td>
                        <td>${entry.wave}</td>
                        <td class="yellow">${String(entry.score).padStart(5, '0')}</td>
                    `;
                } else {
                    // Pusty wiersz (placeholder) zachowujący stałą estetykę i wysokość tabeli
                    tr.innerHTML = `
                        <td>${i + 1}</td>
                        <td style="color: #444466;">---</td>
                        <td style="color: #444466;">---</td>
                        <td style="color: #444466;">00000</td>
                    `;
                }
                tbody.appendChild(tr);
            }
        } catch (err) {
            console.error("Error loading leaderboard:", err);
            tbody.innerHTML = '';
            for (let i = 0; i < 5; i++) {
                const tr = document.createElement('tr');
                if (i === 2) {
                    tr.innerHTML = `
                        <td>3</td>
                        <td colspan="3" style="color: var(--neon-red); font-size: 1.1cqw;">BLAD POLACZENIA</td>
                    `;
                } else {
                    tr.innerHTML = `
                        <td>${i + 1}</td>
                        <td style="color: #444466;">---</td>
                        <td style="color: #444466;">---</td>
                        <td style="color: #444466;">00000</td>
                    `;
                }
                tbody.appendChild(tr);
            }
        }
    }

    async saveScoreToLeaderboard() {
        const user = JSON.parse(localStorage.getItem('arcade_current_user') || 'null');

        // Zapisz lokalny najlepszy wynik
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('arcade_highscore', this.highScore);
        }

        // Tylko zalogowani użytkownicy zapisują wyniki w tabeli liderów w chmurze
        if (!user) {
            await this.updateLeaderboardUI();
            return;
        }

        try {
            await leaderboardService.saveScore(user.username, this.currentWave, this.score);
            await this.updateLeaderboardUI();
        } catch (err) {
            console.error("Error saving score to leaderboard:", err);
        }
    }

    async clearLeaderboard() {
        try {
            await leaderboardService.clearAllScores();
            console.log("Leaderboard cleared successfully.");

            this.highScore = 0;
            localStorage.removeItem('arcade_highscore');

            await this.updateLeaderboardUI();
            return { success: true };
        } catch (err) {
            console.error("Error clearing leaderboard:", err);
            return { success: false, message: err.message };
        }
    }

    async getLeaderboardList() {
        try {
            return await leaderboardService.getAllScores();
        } catch (err) {
            console.error("Error fetching leaderboard list:", err);
            return [];
        }
    }

    async updateLeaderboardEntry(docId, wave, score) {
        try {
            await leaderboardService.updateScore(docId, wave, score);
            return { success: true };
        } catch (err) {
            console.error("Error updating leaderboard entry:", err);
            return { success: false, message: err.message };
        }
    }

    async deleteLeaderboardEntry(docId) {
        try {
            await leaderboardService.deleteScore(docId);
            return { success: true };
        } catch (err) {
            console.error("Error deleting leaderboard entry:", err);
            return { success: false, message: err.message };
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
        const spacing = 180;
        const startX = 94;
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

        if (this.gameMode === 'infinite') {
            const modifiers = ['NORMAL', 'FAST_INVADERS', 'MASSIVE_FIRE', 'UFO_STORM', 'SHIELD_FAIL', 'REVERSED_CONTROL'];
            this.activeModifier = modifiers[Math.floor(Math.random() * modifiers.length)];
        } else {
            this.activeModifier = 'NORMAL';
        }

        let modTitle = '';
        let modDesc = '';
        switch (this.activeModifier) {
            case 'NORMAL':
                modTitle = 'NORMALNA RUNDA';
                modDesc = 'Klasyczna walka w przestrzeni kosmicznej.';
                break;
            case 'FAST_INVADERS':
                modTitle = 'SZYBCY NAJEZDZCY';
                modDesc = 'Obcy poruszaja sie o 35% szybciej! +50% PKT i 2x MONETY!';
                break;
            case 'MASSIVE_FIRE':
                modTitle = 'ZMASOWANY OSTRZAL';
                modDesc = 'Czestotliwosc strzalow kosmitow wzrasta o 250%!';
                break;
            case 'UFO_STORM':
                modTitle = 'BURZA UFO';
                modDesc = 'Zwiekszona czestosc lotow szpiegowskich UFO! +50% monet z UFO!';
                break;
            case 'SHIELD_FAIL':
                modTitle = 'AWARIA TARCZ';
                modDesc = 'Bunkry sa uszkodzone o 50%! Skrocenie cooldownu lasera o 25%!';
                break;
            case 'REVERSED_CONTROL':
                modTitle = 'ODWRCONE STEROWANIE';
                modDesc = 'Kierunki poruszania sie zostaja odwrocone! PODWOJNE MONETY I PKT!';
                break;
        }

        if (this.gameMode === 'campaign') {
            const config = getCampaignWaveConfig(this.currentWave);
            if (this.currentWave === 20) {
                title.textContent = `FALA ${this.currentWave}: ${config.name}`;
                desc.innerHTML = config.desc ? `<span style="color: var(--neon-cyan);">${config.desc}</span>` : '';
                desc.style.display = 'block';
            } else {
                title.textContent = `FALA ${this.currentWave}`;
                desc.innerHTML = '';
                desc.style.display = 'none';
            }
        } else {
            title.textContent = `FALA ${this.currentWave}`;
            desc.innerHTML = `<span style="color: var(--neon-yellow);">${modTitle}</span><br><span style="font-size: 0.85em; color: #88a;">${modDesc}</span>`;
            desc.style.display = 'block';
        }

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

        let layoutType = 'standard';
        let rowsConfig = [];
        let descendOffset = 0;

        if (this.gameMode === 'campaign') {
            const config = getCampaignWaveConfig(this.currentWave);
            layoutType = config.layout;
            rowsConfig = config.rows;
            descendOffset = config.descend ? config.descend * 12 : 0;
        } else {
            const config = generateInfiniteWaveConfig(this.currentWave);
            layoutType = config.layout;
            rowsConfig = config.rows;
        }

        this.invaders = [];

        if (layoutType === 'boss') {
            this.bossSpawnMilestones = { 45: false, 30: false, 15: false };
            this.bossShieldMode = 'center';
            this.bossShieldTimer = 0;
            const bossX = 400 - 80;
            const bossY = 120;
            this.invaders.push(new Invader(bossX, bossY, 'boss', 0));
        } else {
            const startX = 60;
            const startY = 100 + Math.min(6, this.currentWave - 1) * 10 + descendOffset;
            const colSpacing = 52;
            const rowSpacing = 40;

            for (let row = 0; row < rowsConfig.length; row++) {
                const type = rowsConfig[row];
                for (let col = 0; col < 11; col++) {
                    let spawn = false;
                    switch (layoutType) {
                        case 'standard':
                            spawn = true;
                            break;
                        case 'wedge':
                            spawn = (Math.abs(5 - col) <= row);
                            break;
                        case 'v_shape':
                            spawn = (col === row || col === 10 - row || col === row + 1 || col === 9 - row);
                            break;
                        case 'split_column':
                            spawn = (col < 3 || col > 7);
                            break;
                        case 'checkerboard':
                            spawn = ((row + col) % 2 === 0);
                            break;
                        case 'staggered':
                            spawn = (row % 2 === 0 ? col % 2 === 0 : col % 2 !== 0);
                            break;
                        case 'columns':
                            spawn = (col % 3 !== 2);
                            break;
                        case 'crown':
                            if (row === 0) {
                                spawn = (col === 0 || col === 5 || col === 10);
                            } else if (row === 1) {
                                spawn = (col <= 1 || col === 4 || col === 5 || col === 6 || col >= 9);
                            } else {
                                spawn = true;
                            }
                            break;
                        default:
                            spawn = true;
                    }

                    if (spawn) {
                        const invX = startX + col * colSpacing;
                        const invY = startY + row * rowSpacing;
                        this.invaders.push(new Invader(invX, invY, type, row));
                    }
                }
            }
        }

        if (this.activeModifier === 'SHIELD_FAIL') {
            this.bunkers.forEach(b => b.damageRandomly(0.5));
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
            let timeBonus = Math.min(10, Math.floor(this.waveTimer / 4));
            let scoreBonus = this.waveTimer * 10;
            if (this.activeModifier === 'REVERSED_CONTROL') {
                timeBonus *= 2;
                scoreBonus *= 2;
            }
            this.credits += timeBonus;
            this.score += scoreBonus;
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
            },
            {
                key: 'phaseLaser',
                title: 'LASER FAZOWY',
                desc: 'Strzaly gracza przenikaja przez wlasne bunkry',
                max: 1,
                basePrice: 25,
                priceScale: 1.0,
                current: this.player.upgrades.phaseLaser || 0
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
                    this.player.upgrades[key] = (this.player.upgrades[key] || 0) + 1;
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
            btnAdmin.style.display = (user && (user.role === 'admin' || user.role === 'owner')) ? 'inline-block' : 'none';
        }

        this.ctx.clearRect(0, 0, this.virtualW, this.virtualH);
    }

    updatePhysics() {
        if (this.currentState !== this.states.PLAYING) return;

        // 1. Aktualizacja Gracza
        this.player.update(this.keys, this.virtualW, this.activeModifier);

        // Ciągły ogień (Autofire) jeśli ulepszenie jest odblokowane i klawisz spacji jest wciśnięty
        if (this.player.upgrades.autofire > 0 && this.keys['Space']) {
            this.player.shoot(this.projectiles, this.activeModifier);
        }

        // 2. Aktualizacja cząsteczek
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => p.alpha > 0);

        // 3. Aktualizacja pocisków
        this.projectiles.forEach(proj => {
            proj.update();
        });
        this.projectiles = this.projectiles.filter(proj => proj.active);

        // Statek UFO logic
        if (this.ufo === null) {
            let spawnChance = 0.0005;
            if (this.activeModifier === 'UFO_STORM') {
                spawnChance = 0.01;
            } else if (this.gameMode === 'campaign' && this.currentWave === 16) {
                spawnChance = 0.005;
            }

            if (Math.random() < spawnChance) {
                const dir = Math.random() < 0.5 ? 1 : -1;
                this.ufo = {
                    x: dir === 1 ? -50 : 850,
                    y: 35,
                    width: 48,
                    height: 24,
                    speed: 2.5,
                    direction: dir,
                    animFrame: 0,
                    animTimer: 0
                };
            }
        } else {
            this.ufo.x += this.ufo.speed * this.ufo.direction;
            this.ufo.animTimer++;
            if (this.ufo.animTimer >= 15) {
                this.ufo.animFrame = this.ufo.animFrame === 0 ? 1 : 0;
                this.ufo.animTimer = 0;
            }

            if ((this.ufo.direction === 1 && this.ufo.x > 850) || (this.ufo.direction === -1 && this.ufo.x < -50)) {
                this.ufo = null;
            }
        }

        // Boss tarcze logic
        const boss = this.invaders.find(inv => inv.isAlive && inv.type === 'boss');
        if (boss) {
            this.bossShieldTimer++;
            if (this.bossShieldTimer >= 210) {
                this.bossShieldTimer = 0;
                this.bossShieldMode = this.bossShieldMode === 'center' ? 'sides' : 'center';
            }
        }

        // 4. Detekcja uderzenia kosmitów w dół lub krawędź
        let reachedEdge = false;
        let alienMoveSpeed = this.getAlienSpeed();

        this.invaders.forEach(inv => {
            if (!inv.isAlive) return;

            inv.x += alienMoveSpeed * this.invadersDirection;

            if (inv.x < 15 || inv.x > this.virtualW - inv.width - 15) {
                reachedEdge = true;
            }

            if (inv.type !== 'boss' && inv.y + inv.height >= this.player.y) {
                this.gameOver();
            }
        });

        if (reachedEdge) {
            this.invadersDirection *= -1;
            this.invaders.forEach(inv => {
                if (inv.isAlive) {
                    if (inv.type !== 'boss') {
                        inv.y += 12;
                    }
                    inv.animFrame = inv.animFrame === 0 ? 1 : 0;
                }
            });
        }

        // 5. Obsługa rytmu ruchów kosmitów
        this.invaderStepCooldown++;
        const totalAlive = this.invaders.filter(inv => inv.isAlive).length;
        const startingSize = (this.gameMode === 'campaign' && this.currentWave === 20) ? 1 : 55;
        const stepRate = Math.max(3, Math.floor((totalAlive / startingSize) * 40));

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
        let waveBonus;
        if (this.gameMode === 'campaign') {
            waveBonus = Math.min(1.5, (this.currentWave - 1) * 0.08);
        } else {
            waveBonus = (this.currentWave - 1) * 0.09;
        }
        let baseSpeed = 0.4 + waveBonus;

        if (this.gameMode === 'infinite' && this.activeModifier === 'FAST_INVADERS') {
            baseSpeed *= 1.35;
        }

        const totalInvaders = this.invaders.length;
        const active = this.invaders.filter(inv => inv.isAlive).length;
        const destroyedCount = totalInvaders - active;

        return baseSpeed + destroyedCount * 0.025;
    }

    alienShootingLogic(totalAlive) {
        if (totalAlive === 0) return;

        const boss = this.invaders.find(inv => inv.isAlive && inv.type === 'boss');
        if (boss) {
            let shootChance = 0.04;
            if (this.activeModifier === 'MASSIVE_FIRE') shootChance *= 2.5;

            if (Math.random() < shootChance) {
                const alienBulletSpeed = 3.5;
                this.projectiles.push(new Projectile(
                    boss.x + boss.width / 2,
                    boss.y + boss.height,
                    alienBulletSpeed,
                    'alien'
                ));
                const pLeft = new Projectile(
                    boss.x + 20,
                    boss.y + boss.height,
                    alienBulletSpeed,
                    'alien'
                );
                pLeft.vx = -1.5;
                this.projectiles.push(pLeft);

                const pRight = new Projectile(
                    boss.x + boss.width - 20,
                    boss.y + boss.height,
                    alienBulletSpeed,
                    'alien'
                );
                pRight.vx = 1.5;
                this.projectiles.push(pRight);

                audio.playAlienLaser();
            }
        }

        const normalInvaders = this.invaders.filter(inv => inv.isAlive && inv.type !== 'boss');
        if (normalInvaders.length > 0) {
            let baseShootChance;
            if (this.gameMode === 'campaign') {
                baseShootChance = 0.0015 + Math.min(0.015, (this.currentWave - 1) * 0.001);
            } else {
                baseShootChance = 0.0015 + (this.currentWave - 1) * 0.0012;
            }

            if (this.activeModifier === 'MASSIVE_FIRE') {
                baseShootChance *= 2.5;
            }

            if (Math.random() < baseShootChance) {
                const columns = {};
                normalInvaders.forEach(inv => {
                    const col = Math.floor(inv.x / 50);
                    if (!columns[col]) columns[col] = [];
                    columns[col].push(inv);
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

                    let alienBulletSpeed;
                    if (this.gameMode === 'campaign') {
                        alienBulletSpeed = 2.0 + Math.min(1.5, (this.currentWave - 1) * 0.1);
                    } else {
                        alienBulletSpeed = 2.0 + (this.currentWave - 1) * 0.12;
                    }

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
    }

    handleCollisions() {
        this.projectiles.forEach(proj => {
            if (!proj.active) return;

            const playerLaserPhase = proj.owner === 'player' && this.player.upgrades.phaseLaser > 0;
            if (!playerLaserPhase) {
                this.bunkers.forEach(bunker => {
                    bunker.checkCollision(proj, this.particles);
                });
            }

            if (!proj.active) return;

            if (proj.owner === 'player' && this.ufo !== null) {
                const u = this.ufo;
                if (proj.x >= u.x && proj.x <= u.x + u.width &&
                    proj.y >= u.y && proj.y <= u.y + u.height) {

                    proj.active = false;
                    this.ufo = null;

                    const randomPoints = Math.floor(Math.random() * 201) + 100;
                    let randomCredits = Math.floor(Math.random() * 16) + 5;
                    if (this.activeModifier === 'UFO_STORM') {
                        randomCredits = Math.round(randomCredits * 1.5);
                    }

                    this.score += randomPoints;
                    this.credits += randomCredits;
                    this.updateHUD();

                    audio.playExplosion('alien');

                    const pColor = varColor('--neon-pink', '#ff007f');
                    for (let i = 0; i < 12; i++) {
                        this.particles.push(new Particle(proj.x, proj.y, pColor));
                    }
                }
            }

            if (!proj.active) return;

            if (proj.owner === 'player') {
                this.invaders.forEach(inv => {
                    if (!inv.isAlive || !proj.active) return;

                    if (proj.x >= inv.x && proj.x <= inv.x + inv.width &&
                        proj.y >= inv.y && proj.y <= inv.y + inv.height) {

                        if (inv.type === 'boss') {
                            const relX = proj.x - inv.x;
                            let isShielded = false;
                            if (this.bossShieldMode === 'center') {
                                if (relX >= 50 && relX <= 110) {
                                    isShielded = true;
                                }
                            } else if (this.bossShieldMode === 'sides') {
                                if (relX < 50 || relX > 110) {
                                    isShielded = true;
                                }
                            }

                            if (isShielded && Math.random() < 0.8) {
                                proj.active = false;
                                audio.playExplosion('hit');
                                const shieldColor = varColor('--neon-cyan', '#00f3ff');
                                for (let i = 0; i < 6; i++) {
                                    this.particles.push(new Particle(proj.x, proj.y, shieldColor));
                                }
                                return;
                            }
                        }

                        inv.hp--;
                        proj.active = false;

                        if (inv.hp > 0) {
                            audio.playExplosion('hit');
                            for (let i = 0; i < 4; i++) {
                                this.particles.push(new Particle(proj.x, proj.y, inv.getColor()));
                            }

                            if (inv.type === 'boss') {
                                const hp = inv.hp;
                                if ((hp === 45 && !this.bossSpawnMilestones[45]) ||
                                    (hp === 30 && !this.bossSpawnMilestones[30]) ||
                                    (hp === 15 && !this.bossSpawnMilestones[15])) {
                                    this.bossSpawnMilestones[hp] = true;
                                    this.spawnBossMinions();
                                }
                            }
                        } else {
                            inv.isAlive = false;
                            
                            let scoreGain = inv.points;
                            let creditsGain = 1;
                            if (this.gameMode === 'infinite') {
                                if (this.activeModifier === 'FAST_INVADERS') {
                                    scoreGain = Math.round(scoreGain * 1.5);
                                    creditsGain = 2;
                                } else if (this.activeModifier === 'REVERSED_CONTROL') {
                                    scoreGain = scoreGain * 2;
                                    creditsGain = creditsGain * 2;
                                }
                            }

                            this.score += scoreGain;
                            this.credits += creditsGain;
                            this.updateHUD();

                            audio.playExplosion('alien');

                            for (let i = 0; i < 10; i++) {
                                this.particles.push(new Particle(
                                    inv.x + inv.width / 2,
                                    inv.y + inv.height / 2,
                                    inv.getColor()
                                ));
                            }

                            if (proj.isExplosive) {
                                this.triggerExplosiveAmmo(inv, proj.blastRadius);
                            }
                        }
                    }
                });
            }

            if (!proj.active) return;

            if (proj.owner === 'alien' && this.player.isAlive) {
                if (proj.x >= this.player.x && proj.x <= this.player.x + this.player.width &&
                    proj.y >= this.player.y && proj.y <= this.player.y + this.player.height) {

                    proj.active = false;

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
                            this.player.x + this.player.width / 2,
                            this.player.y + this.player.height / 2,
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

    spawnBossMinions() {
        audio.playLevelUp();
        const minionTypes = ['squid', 'crab', 'octopus'];
        const type = minionTypes[Math.floor(Math.random() * minionTypes.length)];
        for (let i = 0; i < 6; i++) {
            const mX = 150 + i * 80;
            const mY = 180;
            const minion = new Invader(mX, mY, type, 2);
            this.invaders.push(minion);
        }
    }

    triggerExplosiveAmmo(centerInvader, blastLvl) {
        const radius = blastLvl === 1 ? 65 : 95;
        const color = varColor('--neon-cyan', '#00f3ff');
        const centerX = centerInvader.x + centerInvader.width / 2;
        const centerY = centerInvader.y + centerInvader.height / 2;

        for (let angle = 0; angle < Math.PI * 2; angle += 0.4) {
            const p = new Particle(centerX, centerY, color);
            p.vx = Math.cos(angle) * (blastLvl === 1 ? 3 : 5);
            p.vy = Math.sin(angle) * (blastLvl === 1 ? 3 : 5);
            this.particles.push(p);
        }

        this.invaders.forEach(inv => {
            if (!inv.isAlive) return;

            const invX = inv.x + inv.width / 2;
            const invY = inv.y + inv.height / 2;
            const dist = Math.sqrt(Math.pow(invX - centerX, 2) + Math.pow(invY - centerY, 2));

            if (dist <= radius) {
                inv.hp--;

                if (inv.hp > 0) {
                    for (let i = 0; i < 3; i++) {
                        this.particles.push(new Particle(invX, invY, inv.getColor()));
                    }
                } else {
                    inv.isAlive = false;
                    
                    let scoreGain = inv.points;
                    let creditsGain = 1;
                    if (this.gameMode === 'infinite') {
                        if (this.activeModifier === 'FAST_INVADERS') {
                            scoreGain = Math.round(scoreGain * 1.5);
                            creditsGain = 2;
                        } else if (this.activeModifier === 'REVERSED_CONTROL') {
                            scoreGain = scoreGain * 2;
                            creditsGain = creditsGain * 2;
                        }
                    }

                    this.score += scoreGain;
                    this.credits += creditsGain;
                    this.updateHUD();

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

            // Rysowanie UFO
            if (this.ufo !== null) {
                const u = this.ufo;
                const uColor = varColor('--neon-pink', '#ff007f');
                const sprite = SPRITES.ufo[u.animFrame];
                drawPixelSprite(this.ctx, sprite, u.x, u.y, u.width, u.height, uColor, true);
            }

            // Rysowanie tarczy Bossa i paska HP Bossa
            const boss = this.invaders.find(inv => inv.isAlive && inv.type === 'boss');
            if (boss) {
                // Tarcze sektorowe
                this.ctx.save();
                this.ctx.lineWidth = 3;
                this.ctx.shadowBlur = 8;
                const shieldColor = varColor('--neon-cyan', '#00f3ff');
                this.ctx.strokeStyle = shieldColor;
                this.ctx.shadowColor = shieldColor;

                const shieldY = boss.y + boss.height + 6;

                if (this.bossShieldMode === 'center') {
                    this.ctx.beginPath();
                    this.ctx.arc(boss.x + 80, shieldY - 20, 30, 0.2, Math.PI - 0.2);
                    this.ctx.stroke();
                } else if (this.bossShieldMode === 'sides') {
                    this.ctx.beginPath();
                    this.ctx.arc(boss.x + 25, shieldY - 20, 25, 0.3, Math.PI - 0.3);
                    this.ctx.stroke();

                    this.ctx.beginPath();
                    this.ctx.arc(boss.x + 135, shieldY - 20, 25, 0.3, Math.PI - 0.3);
                    this.ctx.stroke();
                }
                this.ctx.restore();

                // Pasek życia Bossa
                this.ctx.save();
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '10px "Courier New", monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText("STATEK MATKA - BOSS", 400, 85);

                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(200, 92, 400, 10);

                const hpPercent = boss.hp / boss.maxHp;
                const fillWidth = 400 * hpPercent;
                
                let hpColor = '#00f3ff';
                if (hpPercent < 0.3) {
                    hpColor = '#ff3333';
                    if (Math.floor(Date.now() / 150) % 2 === 0) {
                        hpColor = '#ff6666';
                    }
                } else if (hpPercent < 0.7) {
                    hpColor = '#ffdf00';
                }

                this.ctx.fillStyle = hpColor;
                this.ctx.shadowBlur = 8;
                this.ctx.shadowColor = hpColor;
                this.ctx.fillRect(200, 92, fillWidth, 10);
                this.ctx.restore();
            }

            // Rysowanie aktywnego modyfikatora
            if (this.gameMode === 'infinite' && this.activeModifier !== 'NORMAL') {
                this.ctx.save();
                this.ctx.font = '10px "Courier New", monospace';
                this.ctx.textAlign = 'left';
                
                let modText = '';
                let modColor = '#00f3ff';
                switch (this.activeModifier) {
                    case 'FAST_INVADERS':
                        modText = 'MOD: SZYBCY NAJEZDZCY';
                        modColor = '#ffdf00';
                        break;
                    case 'MASSIVE_FIRE':
                        modText = 'MOD: ZMASOWANY OSTRZAL';
                        modColor = '#ff3333';
                        break;
                    case 'UFO_STORM':
                        modText = 'MOD: BURZA UFO';
                        modColor = '#ff007f';
                        break;
                    case 'SHIELD_FAIL':
                        modText = 'MOD: AWARIA TARCZ (COOLDOWN -25%)';
                        modColor = '#39ff14';
                        break;
                    case 'REVERSED_CONTROL':
                        modText = 'MOD: ODWRCONE STEROWANIE (2x PKT/MONETY)';
                        modColor = '#00f3ff';
                        break;
                }
                
                this.ctx.fillStyle = modColor;
                this.ctx.shadowBlur = 6;
                this.ctx.shadowColor = modColor;
                this.ctx.fillText(modText, 15, 88);
                this.ctx.restore();
            }

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
