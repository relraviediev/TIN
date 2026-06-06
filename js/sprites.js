// --- MATRYCE PIKSELOWE RETRO-SPRITÓW ---
export const SPRITES = {
    red: [
        [
            "000111111000",
            "011111111110",
            "111001100111",
            "111111111111",
            "011100001110",
            "001111111100",
            "010100001010",
            "100011110001"
        ],
        [
            "000111111000",
            "011111111110",
            "111001100111",
            "111111111111",
            "011100001110",
            "001111111100",
            "001010010100",
            "011000000110"
        ]
    ],
    squid: [
        [
            "00011000",
            "00111100",
            "01111110",
            "11011011",
            "11111111",
            "00100100",
            "01011010",
            "10100101"
        ],
        [
            "00011000",
            "00111100",
            "01111110",
            "11011011",
            "11111111",
            "01011010",
            "10000001",
            "01000010"
        ]
    ],
    crab: [
        [
            "00100000100",
            "00010001000",
            "00111111100",
            "01101110110",
            "11111111111",
            "10111111101",
            "10100000101",
            "00011011000"
        ],
        [
            "00100000100",
            "10010001001",
            "10111111101",
            "11101110111",
            "11111111111",
            "00111111100",
            "00100000100",
            "11000000011"
        ]
    ],
    octopus: [
        [
            "000011110000",
            "011111111110",
            "111111111111",
            "111001100111",
            "111111111111",
            "000110011000",
            "001101101100",
            "110000000011"
        ],
        [
            "000011110000",
            "011111111110",
            "111111111111",
            "111001100111",
            "111111111111",
            "001110011100",
            "011001100110",
            "001100001100"
        ]
    ],
    player: [
        "0000001000000",
        "0000011100000",
        "0000011100000",
        "0111111111110",
        "1111111111111",
        "1111111111111",
        "1111111111111",
        "1111111111111"
    ]
};

/**
 * Rysuje retro duszek pikselowy na płótnie canvas.
 * @param {CanvasRenderingContext2D} ctx Kontekst płótna
 * @param {string[]} sprite Matryca pikselowa (tablica ciągów '0' i '1')
 * @param {number} x Pozycja X na płótnie
 * @param {number} y Pozycja Y na płótnie
 * @param {number} width Szerokość docelowa
 * @param {number} height Wysokość docelowa
 * @param {string} color Kolor wypełnienia
 * @param {boolean} glow Czy włączyć efekt poświaty neonowej
 */
export function drawPixelSprite(ctx, sprite, x, y, width, height, color, glow = false) {
    ctx.save();
    if (glow) {
        ctx.shadowBlur = 6;
        ctx.shadowColor = color;
    }
    ctx.fillStyle = color;
    
    const rows = sprite.length;
    const cols = sprite[0].length;
    const pixelW = width / cols;
    const pixelH = height / rows;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (sprite[r][c] === '1') {
                ctx.fillRect(
                    Math.floor(x + c * pixelW), 
                    Math.floor(y + r * pixelH), 
                    Math.ceil(pixelW), 
                    Math.ceil(pixelH)
                );
            }
        }
    }
    ctx.restore();
}
