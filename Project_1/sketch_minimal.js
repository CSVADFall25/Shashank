// Simple test version
let STATE = {
    beatLocked: false, // Start with beat-locked OFF for better UX
    beatDivide: 1,
    prevIsBeat: false,
    risingEdge: false,
    beatCount: 0,
    beatWindowFrames: 0,
    beatWindowMax: 5, // Longer window for smoother drawing
    metroEnabled: true,
    metroBpm: 120,
    _metroLast: 0
};

let sound, fft, amp;
let cnv, pg;
let W = 980, H = 640;
let hue = 0, sat = 100, bri = 100;
let currentPattern = 'circles';

// Controller/Gamepad support
let gamepadConnected = false;
let gamepadIndex = -1;
let gamepadState = { x: 0, y: 0, pressure: 0 };
let buttonStates = { 
    lastAPress: 0, 
    lastBPress: 0, 
    lastXPress: 0, 
    lastYPress: 0,
    lastDPadLeft: 0,
    lastDPadRight: 0,
    lastDPadUp: 0,
    lastDPadDown: 0,
    lastLeftShoulder: 0
};
let patterns = ['circles', 'stars', 'waves', 'grid'];
let currentPatternIndex = 0;
let trailEffect = true;
let showColorPicker = false;
let sparkles = []; // For flicker/firecracker effects

function setup() {
    console.log('Setup starting...');
    
    cnv = createCanvas(W, H);
    cnv.parent('sketch-holder');
    
    pg = createGraphics(W, H);
    colorMode(HSB, 360, 100, 100, 100);
    pg.colorMode(HSB, 360, 100, 100, 100);
    pg.background(0);
    
    // Audio setup 
    fft = new p5.FFT(0.9, 512);
    amp = new p5.Amplitude();
    
    console.log('Setup complete - Canvas created');
    
    // Setup gamepad detection
    setupGamepad();
    
    // Add beat UI after delay
    setTimeout(ensureBeatUI, 500);
}

function draw() {
    // Trail effect or full clear
    if (trailEffect) {
        // Fade previous drawing for trail effect
        push();
        fill(0, 0, 0, 20);
        rect(0, 0, width, height);
        pop();
    } else {
        background(0);
    }
    
    // Reset rising edge at start of frame
    STATE.risingEdge = false;
    
    // Test circle to verify canvas works
    fill(255, 100, 100);
    circle(100, 100, 50);
    
    // Audio analysis for beat detection
    if (sound && fft) {
        let spectrum = fft.analyze();
        let bass = 0;
        let bassRange = Math.floor(spectrum.length * 0.1);
        
        for (let i = 0; i < bassRange; i++) {
            bass += spectrum[i];
        }
        bass /= bassRange;
        
        // Simple beat detection
        let currentIsBeat = bass > 40;
        STATE.risingEdge = !STATE.prevIsBeat && currentIsBeat;
        STATE.prevIsBeat = currentIsBeat;
        
        if (STATE.risingEdge) {
            STATE.beatCount++;
            STATE.beatWindowFrames = STATE.beatWindowMax;
        }
    }
    
    // Always countdown window frames
    if (STATE.beatWindowFrames > 0) {
        STATE.beatWindowFrames--;
    }
    
    // Metronome fallback - always active for testing
    let now = millis();
    let metroInterval = 60000 / STATE.metroBpm / STATE.beatDivide;
    if (now - STATE._metroLast >= metroInterval) {
        STATE._metroLast = now;
        STATE.risingEdge = true;
        STATE.beatCount++;
        STATE.beatWindowFrames = STATE.beatWindowMax;
    }
    
    // Update gamepad
    updateGamepad();
    
    // Update sparkles
    updateSparkles();
    
    // Mouse drawing - more responsive
    if (mouseIsPressed && mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
        if (!STATE.beatLocked || isBeatFrame()) {
            drawShape(mouseX, mouseY, 20, 1.0);
            // Add sparkles on beat or randomly
            if (STATE.risingEdge || random() < 0.3) {
                addSparkles(mouseX, mouseY, 1.0);
            }
            // Add color variation over time
            hue = (hue + 1) % 360;
        }
    }
    
    // Controller drawing - more responsive
    if (gamepadConnected && gamepadState.pressure > 0.05) {
        let drawX = map(gamepadState.x, -1, 1, 0, width);
        let drawY = map(gamepadState.y, -1, 1, 0, height);
        
        // Clamp to canvas bounds
        drawX = constrain(drawX, 0, width);
        drawY = constrain(drawY, 0, height);
        
        if (!STATE.beatLocked || isBeatFrame()) {
            let brushSize = 15 + gamepadState.pressure * 25; // Variable brush size
            drawShape(drawX, drawY, brushSize, gamepadState.pressure);
            
            // Add sparkles based on pressure and beat
            if (STATE.risingEdge || random() < gamepadState.pressure * 0.5) {
                addSparkles(drawX, drawY, gamepadState.pressure);
            }
            
            // Add color variation
            hue = (hue + 2) % 360;
        }
        
        // Show controller cursor even when not drawing
        push();
        stroke(255);
        strokeWeight(2);
        noFill();
        circle(drawX, drawY, 10);
        pop();
    }
    
    // Update and display sparkles
    updateSparkles();
    
    // Display graphics
    image(pg, 0, 0);
    
    // Visual beat indicator
    if (STATE.risingEdge) {
        push();
        fill(255, 255, 0, 150);
        noStroke();
        circle(width - 50, 50, 30);
        pop();
    }
    
    // Current color preview
    push();
    fill(hue, sat, bri);
    noStroke();
    rect(width - 80, 80, 30, 30);
    stroke(255);
    strokeWeight(1);
    noFill();
    rect(width - 80, 80, 30, 30);
    pop();
    
    // Color picker interface
    drawColorPicker();
    
    // Beat HUD
    drawBeatHUD();
}

function isBeatFrame() {
    if (!STATE.beatLocked) return true;
    
    // Allow drawing on beat edge
    if (STATE.risingEdge) {
        return true;
    }
    
    // Allow drawing within window after beat
    if (STATE.beatWindowFrames > 0) {
        return true;
    }
    
    // Also allow if beat count matches division
    if (STATE.beatCount > 0 && (STATE.beatCount % STATE.beatDivide === 0)) {
        return true;
    }
    
    return false;
}

function drawBeatHUD() {
    if (!STATE.beatLocked) return;
    
    if (!isBeatFrame()) {
        push();
        fill(255, 255, 255, 100);
        textAlign(CENTER, CENTER);
        textSize(16);
        text("Waiting for beat...", width/2, 30);
        pop();
    }
    
    // Debug info
    push();
    fill(255, 255, 255, 80);
    textAlign(LEFT, TOP);
    textSize(12);
    text(`Beat Locked: ${STATE.beatLocked}`, 10, 10);
    text(`Beat Count: ${STATE.beatCount}`, 10, 25);
    text(`Beat Division: ${STATE.beatDivide}`, 10, 40);
    text(`Window Frames: ${STATE.beatWindowFrames}`, 10, 55);
    text(`Rising Edge: ${STATE.risingEdge}`, 10, 70);
    text(`Can Draw: ${isBeatFrame()}`, 10, 85);
    text(`Pattern: ${currentPattern}`, 10, 100);
    text(`Trail Effect: ${trailEffect ? 'ON' : 'OFF'}`, 10, 115);
    text(`Color Picker: ${showColorPicker ? 'ON' : 'OFF'}`, 10, 130);
    text(`Sparkles: ${sparkles.length}`, 10, 145);
    text(`Color - H:${Math.round(hue)} S:${Math.round(sat)} B:${Math.round(bri)}`, 10, 160);
    text(`Gamepad: ${gamepadConnected ? 'Connected' : 'Not Connected'}`, 10, 175);
    if (gamepadConnected) {
        text(`Left Stick: ${gamepadState.x.toFixed(2)}, ${gamepadState.y.toFixed(2)}`, 10, 190);
        text(`RT Pressure: ${gamepadState.pressure.toFixed(2)}`, 10, 205);
        text(`Controls:`, 10, 220);
        text(`• Left Stick: Move cursor`, 10, 235);
        text(`• RT: Draw pressure`, 10, 250);
        text(`• A: Cycle patterns`, 10, 265);
        text(`• B: Clear canvas`, 10, 280);
        text(`• X: Toggle trail`, 10, 295);
        text(`• Y: Save canvas`, 10, 310);
        text(`• LB: Toggle color picker`, 10, 325);
        text(`• D-Pad ←→: Change hue`, 10, 340);
        text(`• D-Pad ↑↓: Change saturation`, 10, 355);
    } else {
        text(`Connect controller and press any button`, 10, 190);
        text(`Mouse: Click and drag to draw`, 10, 205);
        text(`Press 'c' to toggle color picker`, 10, 220);
    }
    pop();
}

function ensureBeatUI() {
    if (select('#beatLocked')) return;
    
    let leftSidebar = select('.left-sidebar') || select('.sidebar');
    if (!leftSidebar) {
        console.warn('Left sidebar not found');
        return;
    }
    
    let beatSection = createDiv();
    beatSection.parent(leftSidebar);
    beatSection.class('control-group');
    
    let beatLabel = createDiv('Beat-Locked Drawing');
    beatLabel.parent(beatSection);
    beatLabel.class('control-label');
    
    let beatToggle = createCheckbox('', STATE.beatLocked);
    beatToggle.parent(beatSection);
    beatToggle.id('beatLocked');
    beatToggle.class('control-input');
    
    let divideLabel = createDiv('Beat Divide');
    divideLabel.parent(beatSection);
    divideLabel.class('control-label');
    
    let divideSelect = createSelect();
    divideSelect.parent(beatSection);
    divideSelect.id('beatDivide');
    divideSelect.class('control-input');
    divideSelect.option('1', 1);
    divideSelect.option('2', 2);
    divideSelect.option('4', 4);
    divideSelect.option('8', 8);
    divideSelect.selected(STATE.beatDivide.toString());
    
    beatToggle.changed(() => {
        STATE.beatLocked = beatToggle.checked();
    });
    
    divideSelect.changed(() => {
        STATE.beatDivide = parseInt(divideSelect.value());
    });
}

// Pattern drawing function
function drawShape(x, y, size, pressure) {
    pg.push();
    
    // Add flicker effect
    let flicker = random(0.7, 1.0);
    let alpha = (70 + pressure * 30) * flicker;
    
    pg.fill(hue, sat, bri, alpha);
    pg.stroke(hue, sat, bri + 20, 50 * flicker);
    pg.strokeWeight(1 + pressure);
    
    switch(currentPattern) {
        case 'circles':
            pg.circle(x, y, size * flicker);
            // Add inner glow circle
            pg.fill(hue, sat, 100, alpha * 0.3);
            pg.circle(x, y, size * 0.6 * flicker);
            break;
            
        case 'stars':
            pg.push();
            pg.translate(x, y);
            pg.rotate(frameCount * 0.02 + pressure);
            pg.noFill();
            pg.strokeWeight(2 + pressure);
            // Multiple star layers for firecracker effect
            for (let i = 0; i < 3; i++) {
                pg.stroke(hue + i * 20, sat, bri, alpha / (i + 1));
                drawStar(0, 0, (size/4) * flicker, (size/2) * flicker, 5);
                pg.rotate(radians(30));
            }
            pg.pop();
            break;
            
        case 'waves':
            pg.noFill();
            pg.strokeWeight(3 + pressure);
            // Multiple wave layers
            for (let layer = 0; layer < 3; layer++) {
                pg.stroke(hue + layer * 15, sat, bri, alpha / (layer + 1));
                pg.beginShape();
                for (let i = 0; i < 8; i++) {
                    let waveX = x + (i - 4) * size / 4;
                    let waveY = y + sin(frameCount * 0.1 + i + layer) * size / 3 * flicker;
                    pg.vertex(waveX, waveY);
                }
                pg.endShape();
            }
            break;
            
        case 'grid':
            pg.noFill();
            pg.strokeWeight(2 + pressure);
            let gridSize = size / 3;
            // Pulsing grid with flicker
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    let localFlicker = random(0.5, 1.0);
                    pg.stroke(hue, sat, bri, alpha * localFlicker);
                    let rectSize = gridSize * flicker * localFlicker;
                    pg.rect(x + i * gridSize - rectSize/2, y + j * gridSize - rectSize/2, rectSize, rectSize);
                }
            }
            break;
    }
    pg.pop();
}

// Helper function to draw a star
function drawStar(x, y, radius1, radius2, npoints) {
    let angle = TWO_PI / npoints;
    let halfAngle = angle / 2.0;
    pg.beginShape();
    for (let a = 0; a < TWO_PI; a += angle) {
        let sx = x + cos(a) * radius2;
        let sy = y + sin(a) * radius2;
        pg.vertex(sx, sy);
        sx = x + cos(a + halfAngle) * radius1;
        sy = y + sin(a + halfAngle) * radius1;
        pg.vertex(sx, sy);
    }
    pg.endShape(CLOSE);
}

// Color picker functions
function drawColorPicker() {
    if (!showColorPicker) return;
    
    push();
    // Semi-transparent background
    fill(0, 0, 0, 150);
    rect(width - 250, 20, 220, 180);
    
    // Color wheel
    let centerX = width - 140;
    let centerY = 110;
    let radius = 60;
    
    // Draw hue wheel
    for (let angle = 0; angle < 360; angle += 2) {
        stroke(angle, 100, 100);
        strokeWeight(8);
        let x1 = centerX + cos(radians(angle)) * (radius - 15);
        let y1 = centerY + sin(radians(angle)) * (radius - 15);
        let x2 = centerX + cos(radians(angle)) * (radius + 5);
        let y2 = centerY + sin(radians(angle)) * (radius + 5);
        line(x1, y1, x2, y2);
    }
    
    // Current hue indicator
    stroke(255);
    strokeWeight(3);
    let hueX = centerX + cos(radians(hue)) * radius;
    let hueY = centerY + sin(radians(hue)) * radius;
    circle(hueX, hueY, 10);
    
    // Saturation bar
    for (let i = 0; i < 100; i++) {
        stroke(hue, i, 100);
        line(width - 230, 150 + i, width - 210, 150 + i);
    }
    
    // Saturation indicator
    stroke(255);
    strokeWeight(2);
    line(width - 235, 150 + sat, width - 205, 150 + sat);
    
    // Current color preview
    fill(hue, sat, bri);
    noStroke();
    rect(width - 200, 150, 30, 30);
    stroke(255);
    strokeWeight(1);
    noFill();
    rect(width - 200, 150, 30, 30);
    
    // Instructions
    fill(255);
    textAlign(LEFT);
    textSize(10);
    text("Color Picker", width - 240, 35);
    text("D-Pad ←→: Hue", width - 240, 190);
    text("D-Pad ↑↓: Saturation", width - 240, 200);
    
    pop();
}

// Sparkle/firecracker effect
function addSparkles(x, y, intensity) {
    for (let i = 0; i < intensity * 3; i++) {
        sparkles.push({
            x: x + random(-20, 20),
            y: y + random(-20, 20),
            vx: random(-3, 3),
            vy: random(-3, 3),
            life: random(30, 60),
            maxLife: random(30, 60),
            size: random(2, 8),
            hue: hue + random(-30, 30),
            sat: sat,
            bri: bri
        });
    }
}

function updateSparkles() {
    for (let i = sparkles.length - 1; i >= 0; i--) {
        let sparkle = sparkles[i];
        
        sparkle.x += sparkle.vx;
        sparkle.y += sparkle.vy;
        sparkle.life--;
        sparkle.vy += 0.1; // gravity
        
        let alpha = map(sparkle.life, 0, sparkle.maxLife, 0, 255);
        
        push();
        fill(sparkle.hue, sparkle.sat, sparkle.bri, alpha);
        noStroke();
        circle(sparkle.x, sparkle.y, sparkle.size);
        pop();
        
        if (sparkle.life <= 0) {
            sparkles.splice(i, 1);
        }
    }
}

// Gamepad support functions
function setupGamepad() {
    console.log('Setting up gamepad detection...');
    
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
        // Check for already connected gamepads
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                console.log('Found existing gamepad:', gamepads[i].id);
                gamepadConnected = true;
                gamepadIndex = i;
                break;
            }
        }
        
        window.addEventListener('gamepadconnected', (e) => {
            console.log('Gamepad connected:', e.gamepad.id);
            gamepadConnected = true;
            gamepadIndex = e.gamepad.index;
        });
        
        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('Gamepad disconnected');
            gamepadConnected = false;
            gamepadIndex = -1;
        });
        
        // Also poll for gamepad connections
        setInterval(checkGamepads, 1000);
    } else {
        console.log('Gamepad API not supported');
    }
}

function checkGamepads() {
    if (gamepadConnected) return;
    
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && !gamepadConnected) {
            console.log('Detected gamepad via polling:', gamepads[i].id);
            gamepadConnected = true;
            gamepadIndex = i;
            break;
        }
    }
}

function updateGamepad() {
    if (!gamepadConnected || typeof navigator === 'undefined') return;
    
    const gamepads = navigator.getGamepads();
    if (!gamepads || !gamepads[gamepadIndex] || !gamepads[gamepadIndex].connected) {
        gamepadConnected = false;
        return;
    }
    
    const gamepad = gamepads[gamepadIndex];
    
    // Left stick for movement
    gamepadState.x = gamepad.axes[0] || 0;
    gamepadState.y = gamepad.axes[1] || 0;
    
    // Right trigger for drawing pressure
    gamepadState.pressure = gamepad.buttons[7] ? gamepad.buttons[7].value : 0;
    
    // Button handling with debouncing
    const now = millis();
    
    // A Button: Cycle patterns
    if (gamepad.buttons[0] && gamepad.buttons[0].pressed && now - buttonStates.lastAPress > 300) {
        buttonStates.lastAPress = now;
        currentPatternIndex = (currentPatternIndex + 1) % patterns.length;
        currentPattern = patterns[currentPatternIndex];
        console.log('Pattern changed to:', currentPattern);
    }
    
    // B Button: Clear canvas
    if (gamepad.buttons[1] && gamepad.buttons[1].pressed && now - buttonStates.lastBPress > 500) {
        buttonStates.lastBPress = now;
        pg.background(0);
        console.log('Canvas cleared');
    }
    
    // X Button: Toggle trail effect
    if (gamepad.buttons[2] && gamepad.buttons[2].pressed && now - buttonStates.lastXPress > 300) {
        buttonStates.lastXPress = now;
        trailEffect = !trailEffect;
        console.log('Trail effect:', trailEffect ? 'ON' : 'OFF');
    }
    
    // Y Button: Save canvas
    if (gamepad.buttons[3] && gamepad.buttons[3].pressed && now - buttonStates.lastYPress > 500) {
        buttonStates.lastYPress = now;
        saveCanvas(cnv, 'music-drawing', 'png');
        console.log('Canvas saved');
    }
    
    // D-Pad controls for color picker
    // D-Pad Left (button 14): Decrease hue
    if (gamepad.buttons[14] && gamepad.buttons[14].pressed && now - buttonStates.lastDPadLeft > 100) {
        buttonStates.lastDPadLeft = now;
        hue = (hue - 5 + 360) % 360;
    }
    
    // D-Pad Right (button 15): Increase hue
    if (gamepad.buttons[15] && gamepad.buttons[15].pressed && now - buttonStates.lastDPadRight > 100) {
        buttonStates.lastDPadRight = now;
        hue = (hue + 5) % 360;
    }
    
    // D-Pad Up (button 12): Increase saturation
    if (gamepad.buttons[12] && gamepad.buttons[12].pressed && now - buttonStates.lastDPadUp > 100) {
        buttonStates.lastDPadUp = now;
        sat = Math.min(100, sat + 5);
    }
    
    // D-Pad Down (button 13): Decrease saturation
    if (gamepad.buttons[13] && gamepad.buttons[13].pressed && now - buttonStates.lastDPadDown > 100) {
        buttonStates.lastDPadDown = now;
        sat = Math.max(0, sat - 5);
    }
    
    // Left Shoulder (LB): Toggle color picker
    if (gamepad.buttons[4] && gamepad.buttons[4].pressed && now - buttonStates.lastLeftShoulder > 300) {
        buttonStates.lastLeftShoulder = now;
        showColorPicker = !showColorPicker;
        console.log('Color picker:', showColorPicker ? 'ON' : 'OFF');
    }
}

// Keyboard controls
function keyPressed() {
    switch(key.toLowerCase()) {
        case 'c':
            showColorPicker = !showColorPicker;
            console.log('Color picker:', showColorPicker ? 'ON' : 'OFF');
            break;
        case 'a':
            currentPatternIndex = (currentPatternIndex + 1) % patterns.length;
            currentPattern = patterns[currentPatternIndex];
            console.log('Pattern changed to:', currentPattern);
            break;
        case 'b':
            pg.background(0);
            console.log('Canvas cleared');
            break;
        case 'x':
            trailEffect = !trailEffect;
            console.log('Trail effect:', trailEffect ? 'ON' : 'OFF');
            break;
        case 's':
            saveCanvas(cnv, 'music-drawing', 'png');
            console.log('Canvas saved');
            break;
    }
    
    // Arrow keys for color control
    if (keyCode === LEFT_ARROW) {
        hue = (hue - 5 + 360) % 360;
    } else if (keyCode === RIGHT_ARROW) {
        hue = (hue + 5) % 360;
    } else if (keyCode === UP_ARROW) {
        sat = Math.min(100, sat + 5);
    } else if (keyCode === DOWN_ARROW) {
        sat = Math.max(0, sat - 5);
    }
}

// Audio controls
function userStartAudio() {
    if (getAudioContext().state !== 'running') {
        getAudioContext().resume();
    }
}

// File input handler
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        const startBtn = document.getElementById('startBtn');
        const fileInput = document.getElementById('fileInput');
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                userStartAudio();
                startBtn.disabled = true;
            });
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const url = URL.createObjectURL(file);
                loadSound(url, (s) => {
                    if (sound) sound.stop();
                    sound = s;
                    fft.setInput(sound);
                    amp.setInput(sound);
                    if (playBtn) playBtn.disabled = false;
                    if (pauseBtn) pauseBtn.disabled = false;
                });
            });
        }
        
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                if (sound) sound.play();
            });
        }
        
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                if (sound) sound.pause();
            });
        }
    });
}
