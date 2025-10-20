// Simple test version
let STATE = {
    beatLocked: true, // Stronger constraint - start with beat-locked ON
    beatDivide: 1,
    prevIsBeat: false,
    risingEdge: false,
    beatCount: 0,
    beatWindowFrames: 0,
    beatWindowMax: 3, // Shorter window for stronger constraint
    metroEnabled: true,
    metroBpm: 120,
    _metroLast: 0
};

let sound, fft, amp;
let cnv, pg;
let W = 980, H = 640;
let hue = 200, sat = 80, bri = 90; // Fixed starting color - don't auto-change
let currentPattern = 'circles';
let isColorPickerMode = false; // Track if Y button activates color selection

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
        // Fade previous drawing for trail effect - make more visible
        push();
        fill(0, 0, 0, 60); // Increased from 20 to 60 for better visibility
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
    
    // Mouse drawing - like previous method with music responsiveness
    if (mouseIsPressed && mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
        if (!STATE.beatLocked || isBeatFrame()) {
            // Get music analysis for brush behavior
            let brushSize = 20;
            let musicIntensity = 1.0;
            
            if (sound && fft) {
                let spectrum = fft.analyze();
                let bass = 0, mid = 0, high = 0;
                let bassRange = Math.floor(spectrum.length * 0.1);
                let midRange = Math.floor(spectrum.length * 0.5);
                
                for (let i = 0; i < bassRange; i++) bass += spectrum[i];
                for (let i = bassRange; i < midRange; i++) mid += spectrum[i];
                for (let i = midRange; i < spectrum.length; i++) high += spectrum[i];
                
                bass /= bassRange;
                mid /= (midRange - bassRange);
                high /= (spectrum.length - midRange);
                
                // Music affects brush size and intensity
                brushSize = 15 + (bass * 0.3) + (mid * 0.2);
                musicIntensity = (bass + mid + high) / 300;
            }
            
            // Use pattern-based drawing instead of simple circles
            drawShape(mouseX, mouseY, brushSize, musicIntensity);
            
            // Add cracker effect on beats
            if (STATE.risingEdge) {
                addSparkles(mouseX, mouseY, musicIntensity);
            }
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
            // Get music analysis for controller brush
            let musicIntensity = 1.0;
            let bassBrushSize = 15 + gamepadState.pressure * 25;
            
            if (sound && fft) {
                let spectrum = fft.analyze();
                let bass = 0, mid = 0, high = 0;
                let bassRange = Math.floor(spectrum.length * 0.1);
                let midRange = Math.floor(spectrum.length * 0.5);
                
                for (let i = 0; i < bassRange; i++) bass += spectrum[i];
                for (let i = bassRange; i < midRange; i++) mid += spectrum[i];
                for (let i = midRange; i < spectrum.length; i++) high += spectrum[i];
                
                bass /= bassRange;
                mid /= (midRange - bassRange);
                high /= (spectrum.length - midRange);
                
                // Music affects brush
                bassBrushSize *= (1 + bass * 0.01);
                musicIntensity = (bass + mid + high) / 300;
            }
            
            // Use pattern-based drawing for controller too
            drawShape(drawX, drawY, bassBrushSize, gamepadState.pressure * musicIntensity);
            
            // Add cracker effect on beats
            if (STATE.risingEdge) {
                addSparkles(drawX, drawY, gamepadState.pressure * musicIntensity);
            }
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
    
    // Current pattern indicator
    push();
    fill(255, 255, 255, 200);
    textAlign(RIGHT, TOP);
    textSize(12);
    text(`Pattern: ${currentPattern}`, width - 10, 120);
    text(`(Press A to change)`, width - 10, 135);
    pop();
    
    // Color picker interface
    drawColorPicker();
    
    // Beat HUD
    drawBeatHUD();
}

function isBeatFrame() {
    if (!STATE.beatLocked) return true;
    
    // Stronger constraint - only allow drawing on beat edge OR within short window
    if (STATE.risingEdge) {
        return true;
    }
    
    // Very short window after beat for stronger constraint
    if (STATE.beatWindowFrames > 0) {
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
        text(`• Y: Color picker mode`, 10, 310);
        text(`• D-Pad: Change color (when Y pressed)`, 10, 325);
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
    if (!showColorPicker || !isColorPickerMode) return;
    
    push();
    // Semi-transparent background
    fill(0, 0, 0, 220);
    stroke(255, 255, 255, 150);
    strokeWeight(2);
    rect(width - 270, 5, 250, 220);
    
    // Color wheel
    let centerX = width - 140;
    let centerY = 80;
    let radius = 50;
    
    // Draw hue wheel - make it more clickable
    for (let angle = 0; angle < 360; angle += 3) {
        stroke(angle, 100, 100);
        strokeWeight(6);
        let x1 = centerX + cos(radians(angle)) * (radius - 10);
        let y1 = centerY + sin(radians(angle)) * (radius - 10);
        let x2 = centerX + cos(radians(angle)) * (radius + 10);
        let y2 = centerY + sin(radians(angle)) * (radius + 10);
        line(x1, y1, x2, y2);
    }
    
    // Current hue indicator - bigger and more visible
    stroke(255);
    strokeWeight(4);
    noFill();
    let hueX = centerX + cos(radians(hue)) * radius;
    let hueY = centerY + sin(radians(hue)) * radius;
    circle(hueX, hueY, 15);
    
    // Saturation bar - bigger and more clickable
    fill(255);
    textAlign(CENTER);
    textSize(12);
    text("Saturation", width - 140, 135);
    
    for (let i = 0; i < 100; i++) {
        stroke(hue, i, 100);
        strokeWeight(3);
        line(width - 220, 140 + i * 0.5, width - 60, 140 + i * 0.5);
    }
    
    // Saturation indicator - more visible
    stroke(255);
    strokeWeight(4);
    let satY = 140 + sat * 0.5;
    line(width - 225, satY, width - 55, satY);
    
    // Current color preview - bigger and interactive
    fill(hue, sat, bri);
    noStroke();
    rect(width - 250, 160, 40, 40);
    stroke(255);
    strokeWeight(2);
    noFill();
    rect(width - 250, 160, 40, 40);
    
    // Brightness control indicators
    fill(255);
    textAlign(LEFT);
    textSize(11);
    text("Brightness: " + Math.round(bri), width - 200, 175);
    text("Click color preview:", width - 200, 185);
    textSize(9);
    text("• Top half: brighter", width - 200, 195);
    text("• Bottom half: darker", width - 200, 205);
    
    // Instructions
    fill(255);
    textAlign(CENTER);
    textSize(12);
    text("🎨 Color Picker", width - 140, 25);
    textSize(10);
    text("CLICK anywhere on:", width - 140, 40);
    text("• Color wheel = change hue", width - 140, 52);
    text("• Gray bar = change saturation", width - 140, 64);
    textSize(8);
    text("Arrow keys also work • Press Y to close", width - 140, 210);
    
    pop();
    
    // Handle mouse clicks in color picker - more responsive
    if (mouseIsPressed) {
        handleColorPickerClick();
    }
}

// Handle color picker mouse interactions
function handleColorPickerClick() {
    if (!showColorPicker || !isColorPickerMode) return false;
    
    let centerX = width - 140;
    let centerY = 80;
    let radius = 50;
    
    // Check if click is in color wheel (expanded area for easier clicking)
    let distFromCenter = dist(mouseX, mouseY, centerX, centerY);
    if (distFromCenter >= radius - 20 && distFromCenter <= radius + 20) {
        // Calculate angle from center to mouse
        let angle = atan2(mouseY - centerY, mouseX - centerX);
        hue = degrees(angle);
        if (hue < 0) hue += 360; // Normalize to 0-360
        console.log('Hue changed to:', Math.round(hue));
        return true;
    }
    
    // Check if click is in saturation bar (expanded area)
    if (mouseX >= width - 225 && mouseX <= width - 55 && 
        mouseY >= 135 && mouseY <= 195) {
        sat = constrain(map(mouseY, 140, 190, 0, 100), 0, 100);
        console.log('Saturation changed to:', Math.round(sat));
        return true;
    }
    
    // Check if click is in brightness area (color preview area)
    if (mouseX >= width - 250 && mouseX <= width - 210 && 
        mouseY >= 160 && mouseY <= 200) {
        // Click on upper half increases brightness, lower half decreases
        if (mouseY < 180) {
            bri = Math.min(100, bri + 10);
        } else {
            bri = Math.max(10, bri - 10);
        }
        console.log('Brightness changed to:', Math.round(bri));
        return true;
    }
    
    return false;
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
    
    // Y Button: Toggle color picker mode
    if (gamepad.buttons[3] && gamepad.buttons[3].pressed && now - buttonStates.lastYPress > 300) {
        buttonStates.lastYPress = now;
        isColorPickerMode = !isColorPickerMode;
        showColorPicker = isColorPickerMode;
        console.log('Color picker mode:', isColorPickerMode ? 'ON' : 'OFF');
    }
    
    // D-Pad controls - only work when in color picker mode
    if (isColorPickerMode) {
        // D-Pad Left (button 14): Decrease hue
        if (gamepad.buttons[14] && gamepad.buttons[14].pressed && now - buttonStates.lastDPadLeft > 50) {
            buttonStates.lastDPadLeft = now;
            hue = (hue - 5 + 360) % 360;
            console.log('Gamepad hue decreased to:', hue);
        }
        
        // D-Pad Right (button 15): Increase hue
        if (gamepad.buttons[15] && gamepad.buttons[15].pressed && now - buttonStates.lastDPadRight > 50) {
            buttonStates.lastDPadRight = now;
            hue = (hue + 5) % 360;
            console.log('Gamepad hue increased to:', hue);
        }
        
        // D-Pad Up (button 12): Increase saturation
        if (gamepad.buttons[12] && gamepad.buttons[12].pressed && now - buttonStates.lastDPadUp > 50) {
            buttonStates.lastDPadUp = now;
            sat = Math.min(100, sat + 5);
            console.log('Gamepad saturation increased to:', sat);
        }
        
        // D-Pad Down (button 13): Decrease saturation
        if (gamepad.buttons[13] && gamepad.buttons[13].pressed && now - buttonStates.lastDPadDown > 50) {
            buttonStates.lastDPadDown = now;
            sat = Math.max(0, sat - 5);
            console.log('Gamepad saturation decreased to:', sat);
        }
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
        case 'y':
            isColorPickerMode = !isColorPickerMode;
            showColorPicker = isColorPickerMode;
            console.log('Color picker mode:', isColorPickerMode ? 'ON' : 'OFF');
            break;
        case 'a':
            currentPatternIndex = (currentPatternIndex + 1) % patterns.length;
            currentPattern = patterns[currentPatternIndex];
            console.log('Pattern changed to:', currentPattern);
            break;
        case 'b':
            pg.background(0);
            sparkles = []; // Clear sparkles too
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
        case '+':
        case '=':
            if (isColorPickerMode) {
                bri = Math.min(100, bri + 5);
                console.log('Brightness increased to:', bri);
            }
            break;
        case '-':
        case '_':
            if (isColorPickerMode) {
                bri = Math.max(10, bri - 5);
                console.log('Brightness decreased to:', bri);
            }
            break;
    }
    
    // Arrow keys for color control - only work in color picker mode
    if (isColorPickerMode) {
        if (keyCode === LEFT_ARROW) {
            hue = (hue - 5 + 360) % 360;
            console.log('Hue:', hue);
        } else if (keyCode === RIGHT_ARROW) {
            hue = (hue + 5) % 360;
            console.log('Hue:', hue);
        } else if (keyCode === UP_ARROW) {
            sat = Math.min(100, sat + 5);
            console.log('Saturation:', sat);
        } else if (keyCode === DOWN_ARROW) {
            sat = Math.max(0, sat - 5);
            console.log('Saturation:', sat);
        }
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

// Mouse interaction handler
function mousePressed() {
    // Only handle color picker clicks when it's active
    if (showColorPicker && isColorPickerMode) {
        handleColorPickerClick();
        return false; // Prevent default behavior
    }
}
