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


    // --- MAIN INITIALIZATION LOGIC (DEBUGGING VERSION) ---
    function initialize() {
        // Change the status message element to allow for HTML content
        const statusMessage = document.getElementById('status-message');

        const hash = window.location.hash.substring(1);
        if (hash) {
            let base64 = '';
            let correctedBase64 = '';
            let decodedJson = '';
            try {
                // The decoding process remains the same
                base64 = hash.replace(/-/g, '+').replace(/_/g, '/');
                const padding = '='.repeat((4 - base64.length % 4) % 4);
                correctedBase64 = base64 + padding;
                decodedJson = atob(correctedBase64);
                gameState = JSON.parse(decodedJson);
                renderBoard(); // This will only be reached on success
            } catch (e) {
                // --- THIS IS THE NEW DEBUGGING BLOCK ---
                // If any part of the 'try' block fails, this code will run.
                // It prints a detailed report directly onto the game screen.
                console.error("CRITICAL DECODING FAILURE:", e);
                statusMessage.innerHTML = `
                    <div style="text-align: left; padding: 10px; font-family: monospace; font-size: 10px; word-wrap: break-word; background-color: #333; border-radius: 5px;">
                        <p style="color: #ff6b6b;"><strong>DEBUGGING REPORT: DATA PARSING FAILED</strong></p>
                        <hr>
                        <p><strong>Error Message:</strong> <span style="color: #ffb8b8;">${e.message}</span></p>
                        <hr>
                        <p><strong><u>DATA PIPELINE:</u></strong></p>
                        <p><strong>1. Raw Hash from URL:</strong></p>
                        <p style="color: #f9ca24;">${hash}</p>
                        <p><strong>2. After URL-Safe Replace:</strong></p>
                        <p style="color: #f9ca24;">${base64}</p>
                        <p><strong>3. After Padding Added (Input to 'atob'):</strong></p>
                        <p style="color: #f9ca24;">${correctedBase64}</p>
                        <p><strong>4. After 'atob' (Input to 'JSON.parse'):</strong></p>
                        <p style="color: #f9ca24;">${decodedJson ? new TextEncoder().encode(decodedJson).slice(0, 300) + '...' : 'Error in atob'}</p>
                        <hr>
                        <p style="color: #ff6b6b;"><strong>ACTION: Please screenshot this entire report and provide it.</strong></p>
                    </div>
                `;
            }
        } else {
            statusMessage.textContent = "DEBUGGING: No game data (#) was found in the URL.";
            console.error("URL hash is missing. Cannot initialize game.");
        }
    }
