import { SPRITES, drawPixelSprite } from './sprites.js';
import { varColor } from './utils.js';

// --- KLASA KOSMITY (Z WARSTWOWYMI PUNKTAMI ZDROWIA HP) ---
export class Invader {
    constructor(x, y, type, row) {
        this.x = x;
        this.y = y;
        this.width = 38;
        this.height = 28;
        this.type = type; // 'squid' (3 HP), 'crab' (2 HP), 'octopus' (1 HP)
        this.row = row;
        this.isAlive = true;
        this.animFrame = 0;
        
        // Zróżnicowane HP, punkty oraz poziomy obronne kosmitów
        if (type === 'red') {
            this.points = 40;
            this.maxHp = 4;
            this.hp = 4;
        } else if (type === 'squid') {
            this.points = 30;
            this.maxHp = 3;
            this.hp = 3;
        } else if (type === 'crab') {
            this.points = 20;
            this.maxHp = 2;
            this.hp = 2;
        } else {
            this.points = 10;
            this.maxHp = 1;
            this.hp = 1;
        }
    }

    // Dynamiczna zmiana koloru w zależności od pozostałego zdrowia kosmity (wizualna informacja dla gracza!)
    getColor() {
        if (this.type === 'red') {
            if (this.hp === 4) return varColor('--neon-red', '#ff3333'); // Jasna czerwień
            if (this.hp === 3) return '#cc2424'; // Średnia czerwień
            if (this.hp === 2) return '#991818'; // Ciemna czerwień
            return '#660f0f'; // Bardzo ciemna czerwień (uszkodzony)
        } else if (this.type === 'squid') {
            if (this.hp === 3) return varColor('--neon-cyan', '#00f3ff'); // Jasny błękit
            if (this.hp === 2) return '#00a8e8'; // Średni błękit
            return '#005f8f'; // Ciemny błękit (uszkodzony)
        } else if (this.type === 'crab') {
            if (this.hp === 2) return varColor('--neon-pink', '#ff007f'); // Jasny róż
            return '#a30052'; // Ciemny róż (uszkodzony)
        } else {
            return varColor('--neon-yellow', '#ffdf00'); // Żółty (zawsze 1 HP)
        }
    }

    draw(ctx) {
        if (!this.isAlive) return;
        const sprite = SPRITES[this.type][this.animFrame];
        drawPixelSprite(ctx, sprite, this.x, this.y, this.width, this.height, this.getColor(), false);
    }
}
