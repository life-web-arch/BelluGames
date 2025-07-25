// --- INITIALIZE TELEGRAM WEB APP ---
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand(); // Make the web view full screen

// --- DOM ELEMENTS ---
const gameBoardSVG = document.getElementById('game-board-svg');
const statusMessage = document.getElementById('status-message');
const p1ScoreDisplay = document.getElementById('p1-score');
const p2ScoreDisplay = document.getElementById('p2-score');

// --- THEME COLORS ---
document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#212121');
document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#ffffff');
const P1_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--player1-color');
const P2_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--player2-color');

// --- MOCK GAME STATE (will be replaced by bot data) ---
let gameState = {
    gridSize: 5,
    lines: [],
    boxes: [],
    scores: {},
    current_turn_id: 0,
    players: {}
};

// --- CORE FUNCTIONS ---
function sendMoveToBot(lineIndex) {
    const moveData = {
        action: "claim_line",
        index: lineIndex
    };
    // This is the magic function that sends data back to your Python bot
    tg.sendData(JSON.stringify(moveData));
}

function renderBoard() {
    gameBoardSVG.innerHTML = ''; // Clear previous board state
    const size = gameState.gridSize;
    const padding = 10;
    const boardDim = 100 - 2 * padding;
    const step = boardDim / (size - 1);

    // 1. Draw Dots
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('cx', padding + c * step);
            dot.setAttribute('cy', padding + r * step);
            dot.setAttribute('r', 2);
            dot.setAttribute('fill', tg.themeParams.text_color || '#ccc');
            gameBoardSVG.appendChild(dot);
        }
    }

    // 2. Draw Boxes (underneath lines)
    const cols = size - 1;
    for (let i = 0; i < gameState.boxes.length; i++) {
        const ownerId = gameState.boxes[i];
        if (ownerId !== 0) {
            const r = Math.floor(i / cols);
            const c = i % cols;
            const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            box.setAttribute('x', padding + c * step);
            box.setAttribute('y', padding + r * step);
            box.setAttribute('width', step);
            box.setAttribute('height', step);
            box.setAttribute('fill', ownerId === Object.keys(gameState.players)[0] ? P1_COLOR : P2_COLOR);
            box.setAttribute('fill-opacity', 0.5);
            box.classList.add('box');
            gameBoardSVG.appendChild(box);
        }
    }

    // 3. Draw Lines
    let lineIndex = 0;
    // Horizontal lines
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size - 1; c++) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', padding + c * step);
            line.setAttribute('y1', padding + r * step);
            line.setAttribute('x2', padding + (c + 1) * step);
            line.setAttribute('y2', padding + r * step);
            line.classList.add('line');
            line.dataset.index = lineIndex;
            
            const ownerId = gameState.lines[lineIndex];
            if (ownerId !== 0) {
                line.style.stroke = ownerId == Object.keys(gameState.players)[0] ? P1_COLOR : P2_COLOR;
            } else {
                line.classList.add('available');
            }
            gameBoardSVG.appendChild(line);
            lineIndex++;
        }
    }
    // Vertical lines
    for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c < size; c++) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', padding + c * step);
            line.setAttribute('y1', padding + r * step);
            line.setAttribute('x2', padding + c * step);
            line.setAttribute('y2', padding + (r + 1) * step);
            line.classList.add('line');
            line.dataset.index = lineIndex;

            const ownerId = gameState.lines[lineIndex];
            if (ownerId !== 0) {
                line.style.stroke = ownerId == Object.keys(gameState.players)[0] ? P1_COLOR : P2_COLOR;
            } else {
                line.classList.add('available');
            }
            gameBoardSVG.appendChild(line);
            lineIndex++;
        }
    }

    // 4. Update UI Text
    const pids = Object.keys(gameState.players);
    if (pids.length === 2) {
        p1ScoreDisplay.textContent = `${gameState.players[pids[0]].name}: ${gameState.scores[pids[0]]}`;
        p2ScoreDisplay.textContent = `${gameState.players[pids[1]].name}: ${gameState.scores[pids[1]]}`;
        
        const turnPlayerName = gameState.players[gameState.current_turn_id].name;
        if (gameState.current_turn_id == tg.initDataUnsafe.user.id) {
            statusMessage.textContent = "Your Turn!";
        } else {
            statusMessage.textContent = `Waiting for ${turnPlayerName}...`;
        }
    }
    
    // 5. Add Event Listeners
    document.querySelectorAll('.line.available').forEach(line => {
        line.addEventListener('click', handleLineClick);
    });
}

function handleLineClick(event) {
    // Prevent moves if it's not our turn
    if (gameState.current_turn_id != tg.initDataUnsafe.user.id) {
        tg.showAlert("It's not your turn!");
        return;
    }
    const lineIndex = parseInt(event.target.dataset.index);
    sendMoveToBot(lineIndex);
    // Disable clicks until the bot sends back the new state.
    // In a real app, you would show a loading spinner.
    statusMessage.textContent = "Sending move...";
    document.querySelectorAll('.line.available').forEach(line => {
        line.removeEventListener('click', handleLineClick);
    });
}

// --- INITIALIZATION ---
// This is a placeholder. For a real multiplayer game, you would need
// to fetch the current game state from your bot when the web app loads.
// The simplest way is to have your bot send a message that re-opens the
// web app with the game state encoded in the URL.
// For now, we'll just draw an empty board.
// In a real scenario, you'd replace the mock `gameState` with data from your bot.
// The bot would send this data when the user clicks the "Launch Game" button.
// For now, we will render a default state.
renderBoard();
