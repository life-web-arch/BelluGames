document.addEventListener('DOMContentLoaded', () => {
    // --- INITIALIZE TELEGRAM WEB APP ---
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    // --- DOM ELEMENTS ---
    const gameBoardSVG = document.getElementById('game-board-svg');
    const statusMessage = document.getElementById('status-message');
    const p1ScoreDisplay = document.getElementById('p1-score');
    const p2ScoreDisplay = document.getElementById('p2-score');

    // --- GLOBAL GAME STATE VARIABLE ---
    let gameState = {};

    // --- THEME COLORS ---
    document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#212121');
    document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#ffffff');
    const P1_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--player1-color');
    const P2_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--player2-color');

    // --- CORE FUNCTIONS ---
    function sendMoveToBot(lineIndex) {
        if (!gameState.room_code) {
            tg.showAlert('Error: Game session is invalid. Please relaunch from Telegram.');
            return;
        }
        const moveData = {
            action: "claim_line",
            index: lineIndex,
            room_code: gameState.room_code
        };
        tg.sendData(JSON.stringify(moveData));
    }

    function renderBoard() {
        if (!gameState || !gameState.game_data || !gameState.players) {
            statusMessage.textContent = "Error: Could not load game data.";
            console.error("Game state or game_data is missing:", gameState);
            return;
        }

        gameBoardSVG.innerHTML = ''; // Clear previous board state
        const { gridSize, lines, boxes, scores } = gameState.game_data;
        const padding = 10;
        const boardDim = 100 - 2 * padding;
        const step = boardDim / (gridSize - 1);
        
        const playerIds = Object.keys(gameState.players);
        const p1Id = playerIds[0]; // Player 1 is always the first key
        const myUserIdStr = String(tg.initDataUnsafe.user.id);
        const currentTurnIdStr = String(gameState.current_turn_id);

        // 1. Draw Dots
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot.setAttribute('cx', padding + c * step);
                dot.setAttribute('cy', padding + r * step);
                dot.setAttribute('r', 1.5);
                dot.setAttribute('fill', tg.themeParams.hint_color || '#999999');
                gameBoardSVG.appendChild(dot);
            }
        }

        // 2. Draw Boxes
        const cols = gridSize - 1;
        for (let i = 0; i < boxes.length; i++) {
            const ownerId = String(boxes[i]); // Ensure comparison is string-to-string
            if (ownerId !== '0') {
                const r = Math.floor(i / cols);
                const c = i % cols;
                const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                box.setAttribute('x', padding + c * step);
                box.setAttribute('y', padding + r * step);
                box.setAttribute('width', step);
                box.setAttribute('height', step);
                box.setAttribute('fill', ownerId === p1Id ? P1_COLOR : P2_COLOR);
                box.setAttribute('fill-opacity', 0.4);
                box.classList.add('box');
                gameBoardSVG.appendChild(box);
            }
        }

        // 3. Draw Lines
        let lineIndex = 0;
        // Horizontal lines
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize - 1; c++) {
                createLine(padding + c * step, padding + r * step, padding + (c + 1) * step, padding + r * step, lineIndex++);
            }
        }
        // Vertical lines
        for (let r = 0; r < gridSize - 1; r++) {
            for (let c = 0; c < gridSize; c++) {
                createLine(padding + c * step, padding + r * step, padding + c * step, padding + (r + 1) * step, lineIndex++);
            }
        }

        function createLine(x1, y1, x2, y2, index) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.classList.add('line');
            line.dataset.index = index;
            
            const ownerId = String(lines[index]); // Ensure comparison is string-to-string
            if (ownerId !== '0') {
                line.style.stroke = ownerId === p1Id ? P1_COLOR : P2_COLOR;
                line.style.strokeWidth = '5';
            } else {
                line.classList.add('available');
            }
            gameBoardSVG.appendChild(line);
        }

                // 4. Update UI Text
        if (playerIds.length === 2) {
            const p2Id = playerIds[1];
            p1ScoreDisplay.textContent = `${gameState.players[p1Id].name}: ${scores[p1Id]}`;
            p2ScoreDisplay.textContent = `${gameState.players[p2Id].name}: ${scores[p2Id]}`;
            
            // --- START OF MODIFICATION ---
            // This robust check prevents the script from crashing if the turn ID is invalid.
            if (gameState.players[currentTurnIdStr]) {
                const turnPlayerName = gameState.players[currentTurnIdStr].name;
                if (currentTurnIdStr === myUserIdStr) {
                    statusMessage.textContent = "Your Turn!";
                    statusMessage.style.color = tg.themeParams.link_color || '#8774e1';
                } else {
                    statusMessage.textContent = `Waiting for ${turnPlayerName}...`;
                    statusMessage.style.color = tg.themeParams.text_color || '#ffffff';
                }
            } else {
                // If the turn ID is not a valid player, display an error instead of crashing.
                statusMessage.textContent = "Error: Invalid turn data received.";
                console.error("Could not find player for turn ID:", currentTurnIdStr, "in players object:", gameState.players);
            }
            // --- END OF MODIFICATION ---
        }
        
        // 5. Add Event Listeners
        document.querySelectorAll('.line.available').forEach(line => {
            line.addEventListener('click', handleLineClick);
        });
    }

    function handleLineClick(event) {
        if (String(gameState.current_turn_id) !== String(tg.initDataUnsafe.user.id)) {
            tg.showAlert("It's not your turn!");
            return;
        }
        const lineIndex = parseInt(event.target.dataset.index);
        statusMessage.textContent = "Sending move...";
        sendMoveToBot(lineIndex);
        
        document.querySelectorAll('.line.available').forEach(line => {
            line.removeEventListener('click', handleLineClick);
            line.style.cursor = 'default';
        });
    }

    // --- MAIN INITIALIZATION LOGIC ---
    function initialize() {
        const hash = window.location.hash.substring(1);
        if (hash) {
            try {
                // Step 1: Replace the URL-safe characters ('-' and '_') back to their
                // standard Base64 equivalents ('+' and '/').
                let base64 = hash.replace(/-/g, '+').replace(/_/g, '/');
                
                // Step 2: The URL-safe encoding often removes padding characters ('=').
                // This calculates how much padding is needed to make the string length
                // a multiple of 4, which is required by the atob() function.
                const padding = '='.repeat((4 - base64.length % 4) % 4);
                const correctedBase64 = base64 + padding;

                // Step 3: Now that the string is in standard Base64 format, decode it.
                const decodedJson = atob(correctedBase64);
                
                // Step 4: Parse the resulting JSON string into our game state object.
                gameState = JSON.parse(decodedJson);
                
                // Step 5: With the game state successfully loaded, render the board.
                renderBoard();

            } catch (e) {
                // If any step fails, log the detailed error and show the user a generic message.
                console.error("Failed to parse game state from URL hash:", e);
                statusMessage.textContent = "Error: Invalid game data.";
            }
