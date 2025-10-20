// Canvas and graphics
let W = 980, H = 640;
let cnv, pg, backgroundTexture;
let is3D = false;

// Audio system
let sound, fft, amp;
let beatHistory = [], beatPulse = 0;
let bassHistory = [], midHistory = [], highHistory = [];
let spectralCentroid = 0, spectralRolloff = 0;

// Drawing system
let currentPattern = 'circles';
let hueOffset = 0;
let lastDrawPos = { x: 0, y: 0 };
let drawingTrail = [];
let particles = [];
let brushTexture;
let persistentStrokes = []; // Store all drawing strokes permanently

// Music signal visualization
let musicSignals = {
    beats: [],
    melody: [],
    rhythm: []
};
let signalSpeed = 2;
let userPosition = { x: 0, y: 0 };

// Auto movement system
let autoDrawPosition = { x: 0, y: 0 };
let movementHistory = [];
let isAutoDrawing = false;

// Controller/Gamepad support
let gamepadConnected = false;
let gamepadIndex = -1;
let gamepadState = { x: 0, y: 0, pressure: 0 };
let buttonStates = {}; // Track button states to prevent continuous triggering

// Settings
let settings = {
    canvasMode: '2D',
    textureMode: 'smooth',  
    colorMode: 'spectrum',
    customColor: '#ff6b6b',
    colorBrightness: 80,
    trailEffect: true,
    beatFlash: true,
    audioReactive: true,
    rhythmTexture: true,
    brushSize: 50,
    beatSensitivity: 70,
    autoMovement: false,
    movementSpeed: 50,
    movementFactor: 'bass'
};

// Performance recording
let isRecording = false;
let recordedFrames = [];
let performanceData = [];
let autoRecording = true; // Continuous recording with music

// Timeline capture system
let timelineCapture = {
    enabled: false,
    timeMarkers: [], // User-defined time markers
    canvasStates: [], // Canvas state at each marker
    finalComposite: null
};

// Texture and visual effects
let noiseOffset = 0;
let rhythmIntensity = 0;
let canvasTextures = {};

// Timeline navigation system
let timelineNavigation = {
    isNavigating: false,
    currentPosition: 0,
    totalDuration: 0
};

// Music analysis variables for brush movement coordination based on reference image
let musicCharacteristics = {
    tune: { frequency: 0, strength: 0, position: { x: 0, y: 0 } },
    rhythm: { tempo: 0, intensity: 0, position: { x: 0, y: 0 } },
    shape: { complexity: 0, form: 0, position: { x: 0, y: 0 } },
    direction: { flow: 0, movement: 0, position: { x: 0, y: 0 } },
    notes: { density: 0, pitch: 0, position: { x: 0, y: 0 } },
    colour: { warmth: 0, brightness: 0 }
};

let performanceTimeline = { isActive: false, currentTime: 0, totalTime: 0 };
let isAutoPatternEnabled = true;
let lastPatternChange = 0;

function setup() {
    cnv = createCanvas(W, H);
    cnv.parent('sketch-holder');
    
    pg = createGraphics(W, H);
    colorMode(HSB, 360, 100, 100, 100);
    pg.colorMode(HSB, 360, 100, 100, 100);
    pg.background(0);

    // Audio setup 
    fft = new p5.FFT(0.9, 512);
    amp = new p5.Amplitude();

    setupUI();
    setupGamepad();
    createBackgroundTextures();
    createBrushTextures();
    setupTimelineNavigation();
}

function setupUI() {
    // Audio controls
    select('#startBtn').mousePressed(() => {
        userStartAudio();
        select('#startBtn').attribute('disabled', '');
    });

    select('#fileInput').changed(() => {
        const file = select('#fileInput').elt.files[0];
        if (!file) return;
        
        const url = URL.createObjectURL(file);
        loadSound(url, (s) => {
            if (sound) sound.stop();
            sound = s;
            select('#playBtn').removeAttribute('disabled');
            select('#pauseBtn').removeAttribute('disabled');
        });
    });

    select('#playBtn').mousePressed(() => sound?.play());
    select('#pauseBtn').mousePressed(() => sound?.pause());
    
    // Canvas mode switching
    select('#canvasMode').changed(() => {
        settings.canvasMode = select('#canvasMode').value();
        switchCanvasMode();
    });
    
    // Drawing controls
    select('#pattern').changed(() => {
        currentPattern = select('#pattern').value();
    });
    
    select('#brush').input(() => {
        settings.brushSize = select('#brush').value();
        select('#brushValue').html(settings.brushSize);
    });
    
    // Music mapping controls
    select('#beat').input(() => {
        settings.beatSensitivity = select('#beat').value();
        select('#beatValue').html(settings.beatSensitivity);
    });
    
    select('#textureMode').changed(() => {
        settings.textureMode = select('#textureMode').value();
        updateCanvasTexture();
    });
    
    select('#colorMode').changed(() => {
        settings.colorMode = select('#colorMode').value();
        toggleCustomColorSection();
    });
    
    // Custom color controls
    select('#customColor').input(() => {
        settings.customColor = select('#customColor').value();
    });
    
    select('#colorBrightness').input(() => {
        settings.colorBrightness = select('#colorBrightness').value();
        select('#brightnessValue').html(settings.colorBrightness);
    });
    
    // Performance effects
    select('#trailEffect').changed(() => {
        settings.trailEffect = select('#trailEffect').checked();
    });
    
    select('#beatFlash').changed(() => {
        settings.beatFlash = select('#beatFlash').checked();
    });
    
    select('#audioReactive').changed(() => {
        settings.audioReactive = select('#audioReactive').checked();
    });
    
    select('#rhythmTexture').changed(() => {
        settings.rhythmTexture = select('#rhythmTexture').checked();
    });
    
    // Auto movement controls
    select('#autoMovement').changed(() => {
        settings.autoMovement = select('#autoMovement').checked();
        if (settings.autoMovement) {
            autoDrawPosition.x = width / 2;
            autoDrawPosition.y = height / 2;
        }
    });
    
    select('#movementSpeed').input(() => {
        settings.movementSpeed = select('#movementSpeed').value();
        select('#movementSpeedValue').html(settings.movementSpeed);
    });
    
    select('#movementFactor').changed(() => {
        settings.movementFactor = select('#movementFactor').value();
    });
    
    // Export controls
    select('#clearBtn').mousePressed(() => {
        pg.background(0);
        particles = [];
        drawingTrail = [];
        persistentStrokes = [];
    });
    
    select('#saveBtn').mousePressed(() => {
        // Create a filename with timestamp
        const filename = 'MusicDanceDrawing_' + timestamp();
        saveCanvas(filename, 'png');
        
        // Show notification
        setTimeout(() => {
            alert(`Drawing saved as ${filename}.png to your Downloads folder!`);
        }, 100);
    });
    
    select('#recordBtn').mousePressed(() => {
        toggleRecording();
    });
    
    // Timeline capture controls
    select('#timelineCaptureBtn').mousePressed(() => {
        timelineCapture.enabled = !timelineCapture.enabled;
        const btn = select('#timelineCaptureBtn');
        const addMarkerBtn = select('#addMarkerBtn');
        const compositeBtn = select('#createCompositeBtn');
        
        if (timelineCapture.enabled) {
            btn.html('Disable Timeline Capture');
            btn.style('background', 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)');
            addMarkerBtn.removeAttribute('disabled');
            compositeBtn.removeAttribute('disabled');
        } else {
            btn.html('Enable Timeline Capture');
            btn.style('background', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
            addMarkerBtn.attribute('disabled', '');
            compositeBtn.attribute('disabled', '');
        }
    });
    
    select('#addMarkerBtn').mousePressed(() => {
        addTimeMarker();
    });
    
    select('#createCompositeBtn').mousePressed(() => {
        createTimelineComposite();
    });
    
    // Setup timeline navigation
    setupTimelineNavigation();
}

function draw() {
    background(0);
    analyzeAudio();
    updatePerformanceTimeline();
    updateAutoRecording();
    updateMusicSignals();
    updateAutoMovement();
    updateGamepadInput();
    autoPatternCycling();

    // Draw immersive music signals in background
    drawMusicSignals();

    // Apply timeline-based visual effects
    push();
    applyTimelineEffects();

    // Drawing input handling
    if (mouseIsPressed && mouseInCanvas()) {
        drawPattern(mouseX, mouseY);
    }
    
    // Controller drawing
    if (gamepadConnected && gamepadState.pressure > 0.1) {
        const drawX = map(gamepadState.x, -1, 1, 0, width);
        const drawY = map(gamepadState.y, -1, 1, 0, height);
        drawPattern(drawX, drawY, gamepadState.pressure);
    }

    // IMPORTANT: Never clear or modify pg background after initial setup
    // Just draw the persistent graphics layer
    image(pg, 0, 0);
    pop();
    
    // Update and draw all particles (including sparkles)
    updateAllParticles();
    
    drawCursor();
    drawAutoMovementIndicator();
    drawAudioMeters();
    drawPerformanceTimeline();
    
    // Update timeline UI
    if (frameCount % 30 === 0) { // Update every half second
        updateTimelineUI();
    }
    
    // Enhanced canvas texture effects
    enhancedCanvasEffects();
}

function analyzeAudio() {
    analyzeAudioAdvanced();
}

function drawPattern(x, y, pressure = 1) {
    let size = settings.brushSize * (settings.audioReactive ? (1 + beatPulse) : 1) * pressure;
    const energy = {
        bass: fft.getEnergy('bass'),
        mid: fft.getEnergy('mid'),
        high: fft.getEnergy('treble')
    };
    
    // Color calculation based on settings
    let hue, sat, bri;
    switch(settings.colorMode) {
        case 'spectrum':
            hue = (frameCount % 360 + hueOffset) % 360;
            sat = 80 + map(energy.mid, 0, 255, 0, 20);
            bri = 90;
            break;
        case 'warm':
            hue = map(energy.bass, 0, 255, 0, 60);
            sat = 85;
            bri = 90;
            break;
        case 'cool':
            hue = map(energy.high, 0, 255, 180, 280);
            sat = 80;
            bri = 85;
            break;
        case 'monochrome':
            hue = 0;
            sat = 0;
            bri = map(energy.mid, 0, 255, 60, 100);
            break;
        case 'custom':
            const customColor = getCustomColor();
            hue = customColor.h;
            sat = customColor.s;
            bri = customColor.b;
            break;
            bri = customColor.b;
            break;
    }
    
    pg.noStroke();
    pg.fill(hue, sat, bri, 70);

    // Store persistent stroke data
    const strokeData = {
        x, y, size, hue, sat, bri,
        pattern: currentPattern,
        timestamp: sound?.isPlaying() ? performanceTimeline.currentTime : 0,
        energy: {...energy}
    };
    persistentStrokes.push(strokeData);

    // Draw permanent connecting lines between strokes
    if (settings.trailEffect && persistentStrokes.length > 1) {
        const lastStroke = persistentStrokes[persistentStrokes.length - 2];
        pg.stroke(hue, sat, bri, 50);
        pg.strokeWeight(size * 0.2);
        pg.line(lastStroke.x, lastStroke.y, x, y);
        pg.noStroke();
    }

    // Draw the main pattern (this stays permanent on pg)
    switch(currentPattern) {
        case 'circles': drawCircles(x, y, size, energy.bass); break;
        case 'stars': drawStars(x, y, size, energy.mid); break;
        case 'waves': drawWaves(x, y, size, energy.high); break;
        case 'grid': drawGrid(x, y, size, energy.bass); break;
        case 'particles': drawParticles(x, y, size, energy); break;
        case 'ribbons': drawRibbons(x, y, size, energy); break;
    }
    
    // Update canvas texture based on rhythm
    if (settings.rhythmTexture && beatPulse > 0.3) {
        updateCanvasTexture();
    }
    
    // Record performance data
    if (isRecording) {
        performanceData.push({
            x, y, size, pattern: currentPattern,
            energy, timestamp: millis()
        });
    }
    
    // Capture timeline state if enabled
    if (timelineCapture.enabled && sound?.isPlaying()) {
        captureTimelineState();
    }
}

function drawCircles(x, y, size, bass) {
    const rings = 3 + int(bass/50);
    for(let i = 0; i < rings; i++) {
        pg.circle(x, y, size * (1 + i*0.5*beatPulse));
    }
}

function drawStars(x, y, size, mid) {
    pg.push();
    pg.translate(x, y);
    pg.rotate(frameCount * 0.1);
    
    const points = 5 + int(mid/50);
    pg.beginShape();
    for(let i = 0; i < points*2; i++) {
        const r = i % 2 === 0 ? size : size * 0.4;
        const angle = TWO_PI * i / (points*2);
        pg.vertex(cos(angle)*r, sin(angle)*r);
    }
    pg.endShape(CLOSE);
    pg.pop();
}

function drawWaves(x, y, size, high) {
    const points = 12;
    const amp = size * (0.3 + high/255);
    pg.beginShape();
    for(let i = 0; i <= points; i++) {
        const px = x + map(i, 0, points, -size, size);
        const py = y + sin(i*0.5 + frameCount*0.1) * amp;
        pg.vertex(px, py);
    }
    pg.endShape();
}

function drawGrid(x, y, size, bass) {
    const cells = 2 + int(bass/85);
    const cellSize = size/cells;
    
    pg.push();
    pg.translate(x, y);
    pg.rotate(frameCount * 0.05);
    for(let i = 0; i < cells; i++) {
        for(let j = 0; j < cells; j++) {
            const px = (i - cells/2) * cellSize;
            const py = (j - cells/2) * cellSize;
            pg.rect(px, py, cellSize*0.8, cellSize*0.8);
        }
    }
    pg.pop();
}

function drawParticles(x, y, size, energy) {
    // Create new particles
    for(let i = 0; i < 3; i++) {
        particles.push({
            x: x + random(-size/2, size/2),
            y: y + random(-size/2, size/2),
            vx: random(-2, 2),
            vy: random(-2, 2),
            life: 60,
            size: random(2, 8),
            hue: (frameCount % 360 + hueOffset) % 360,
            type: 'normal'
        });
    }
}

function updateAllParticles() {
    // Update and draw all particles (both normal and sparkle)
    for(let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        
        if(p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        
        const alpha = map(p.life, 0, 60, 0, 100);
        
        if (p.type === 'sparkle') {
            // Sparkle particles are drawn on main canvas, not pg
            push();
            fill(p.hue, 80, 100, alpha);
            noStroke();
            star(p.x, p.y, p.size/2, p.size, 5);
            pop();
        } else {
            // Normal particles are drawn on pg
            pg.fill(p.hue, 80, 90, alpha);
            pg.circle(p.x, p.y, p.size);
        }
    }
}

// Helper function to draw star shapes for sparkles
function star(x, y, radius1, radius2, npoints) {
    let angle = TWO_PI / npoints;
    let halfAngle = angle / 2.0;
    beginShape();
    for (let a = 0; a < TWO_PI; a += angle) {
        let sx = x + cos(a) * radius2;
        let sy = y + sin(a) * radius2;
        vertex(sx, sy);
        sx = x + cos(a + halfAngle) * radius1;
        sy = y + sin(a + halfAngle) * radius1;
        vertex(sx, sy);
    }
    endShape(CLOSE);
}

function drawRibbons(x, y, size, energy) {
    const ribbonLength = 8;
    const ribbonWidth = size * 0.2;
    
    pg.stroke(pg._state.fill._array[0], pg._state.fill._array[1], pg._state.fill._array[2], 60);
    pg.strokeWeight(ribbonWidth);
    
    for(let i = 0; i < 3; i++) {
        const angle = TWO_PI * i / 3 + frameCount * 0.1;
        const endX = x + cos(angle) * size;
        const endY = y + sin(angle) * size;
        
        // Draw curved ribbon
        pg.noFill();
        pg.beginShape();
        for(let t = 0; t <= 1; t += 0.1) {
            const px = lerp(x, endX, t);
            const py = lerp(y, endY, t) + sin(t * PI + frameCount * 0.1) * ribbonWidth;
            pg.vertex(px, py);
        }
        pg.endShape();
    }
    
    pg.noStroke();
}

function drawCursor() {
    noFill();
    stroke(frameCount % 360, 80, 100, 80);
    strokeWeight(2);
    circle(mouseX, mouseY, 20 + 10*beatPulse);
}

function drawAudioMeters() {
    push();
    noStroke();
    fill(0, 0, 100, 30);
    const h = 15;
    rect(10, 10, 200, h);
    if (sound?.isPlaying()) {
        const level = amp.getLevel();
        fill(frameCount % 360, 80, 100);
        rect(10, 10, 200 * level, h);
    }
    pop();
}

function mouseInCanvas() {
    return mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height;
}

// Gamepad support functions
function setupGamepad() {
    window.addEventListener("gamepadconnected", (e) => {
        gamepadConnected = true;
        gamepadIndex = e.gamepad.index;
        updateGamepadStatus("Controller connected: " + e.gamepad.id);
    });
    
    window.addEventListener("gamepaddisconnected", (e) => {
        gamepadConnected = false;
        gamepadIndex = -1;
        updateGamepadStatus("No controller detected");
    });
}

function updateGamepadInput() {
    if (!gamepadConnected) return;
    
    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[gamepadIndex];
    
    if (gamepad) {
        // Left stick for drawing position
        gamepadState.x = gamepad.axes[0];
        gamepadState.y = gamepad.axes[1];
        
        // Right trigger for pressure/brush size
        gamepadState.pressure = gamepad.buttons[7] ? gamepad.buttons[7].value : 0;
        
        // Map gamepad input to canvas coordinates
        const drawX = map(gamepadState.x, -1, 1, 0, width);
        const drawY = map(gamepadState.y, -1, 1, 0, height);
        
        // Draw if pressure is being applied (fixed color issue)
        if (gamepadState.pressure > 0.1) {
            drawPattern(drawX, drawY, gamepadState.pressure);
        }
        
        // Safe
        const aButton = gamepad.buttons[0];
        const bButton = gamepad.buttons[1];
        const xButton = gamepad.buttons[2];
        const yButton = gamepad.buttons[3];
        
        // A button - Manual pattern cycling (with auto-pattern toggle)
        if (aButton && aButton.pressed && !buttonStates.a) {
            isAutoPatternEnabled = !isAutoPatternEnabled;
            updateAutoPatternStatus();
            if (!isAutoPatternEnabled) {
                cyclePatternManually();
            }
            buttonStates.a = true;
        } else if (!aButton || !aButton.pressed) {
            buttonStates.a = false;
        }
        
        // B button - Clear canvas
        if (bButton && bButton.pressed && !buttonStates.b) {
            clearCanvas();
            buttonStates.b = true;
        } else if (!bButton || !bButton.pressed) {
            buttonStates.b = false;
        }
        
        // X button - Toggle trail effect
        if (xButton && xButton.pressed && !buttonStates.x) {
            settings.trailEffect = !settings.trailEffect;
            const trailCheckbox = select('#trailEffect');
            if (trailCheckbox) trailCheckbox.checked(settings.trailEffect);
            buttonStates.x = true;
        } else if (!xButton || !xButton.pressed) {
            buttonStates.x = false;
        }
        
        // Y button - Save canvas
        if (yButton && yButton.pressed && !buttonStates.y) {
            saveCanvas('MusicDanceDrawing_' + timestamp(), 'png');
            buttonStates.y = true;
        } else if (!yButton || !yButton.pressed) {
            buttonStates.y = false;
        }
    }
}

function cyclePatternManually() {
    const patterns = ['circles', 'stars', 'waves', 'grid', 'particles', 'ribbons'];
    const currentIndex = patterns.indexOf(currentPattern);
    const nextIndex = (currentIndex + 1) % patterns.length;
    currentPattern = patterns[nextIndex];
    updatePatternUI();
}

function clearCanvas() {
    pg.background(0);
    particles = [];
    drawingTrail = [];
    persistentStrokes = []; // Clear all stored strokes
}

// Function to update auto-pattern status in UI
function updateAutoPatternStatus() {
    const indicator = document.getElementById('auto-pattern-indicator');
    if (indicator) {
        if (isAutoPatternEnabled) {
            indicator.innerHTML = '<span class="status-dot active"></span>Auto-Pattern: ON';
        } else {
            indicator.innerHTML = '<span class="status-dot inactive"></span>Manual Pattern Control';
        }
    }
}

function updateGamepadStatus(status) {
    const statusElement = document.getElementById('gamepad-status');
    if (statusElement) {
        statusElement.textContent = status;
    }
    
    // Update controller instructions visibility
    const instructionsPanel = document.getElementById('controller-instructions');
    if (instructionsPanel) {
        instructionsPanel.style.display = gamepadConnected ? 'block' : 'none';
    }
}

// Canvas mode switching
function switchCanvasMode() {
    const mode = settings.canvasMode;
    
    if (mode === '3D' && !is3D) {
        // Switch to 3D mode
        cnv.remove();
        cnv = createCanvas(W, H, WEBGL);
        cnv.parent('sketch-holder');
        is3D = true;
        
        // Recreate graphics layer for 3D
        pg = createGraphics(W, H);
        pg.colorMode(HSB, 360, 100, 100, 100);
        pg.background(0);
        
    } else if (mode === '2D' && is3D) {
        // Switch to 2D mode
        cnv.remove();
        cnv = createCanvas(W, H);
        cnv.parent('sketch-holder');
        is3D = false;
        
        // Recreate graphics layer for 2D
        pg = createGraphics(W, H);
        pg.colorMode(HSB, 360, 100, 100, 100);
        pg.background(0);
    }
}

// Texture creation functions
function createBackgroundTextures() {
    canvasTextures.smooth = createGraphics(W, H);
    canvasTextures.smooth.background(0);
    
    canvasTextures.rough = createGraphics(W, H);
    canvasTextures.rough.loadPixels();
    for (let i = 0; i < canvasTextures.rough.pixels.length; i += 4) {
        const noise = random(0, 30);
        canvasTextures.rough.pixels[i] = noise;
        canvasTextures.rough.pixels[i + 1] = noise;
        canvasTextures.rough.pixels[i + 2] = noise;
        canvasTextures.rough.pixels[i + 3] = 255;
    }
    canvasTextures.rough.updatePixels();
    
    canvasTextures.paper = createGraphics(W, H);
    canvasTextures.paper.background(15, 10, 95);
    canvasTextures.paper.noStroke();
    for (let i = 0; i < 1000; i++) {
        canvasTextures.paper.fill(0, 0, random(85, 100), random(5, 15));
        canvasTextures.paper.circle(random(W), random(H), random(1, 3));
    }
    
    canvasTextures.canvas = createGraphics(W, H);
    canvasTextures.canvas.background(25, 15, 90);
    for (let x = 0; x < W; x += 4) {
        for (let y = 0; y < H; y += 4) {
            canvasTextures.canvas.stroke(25, 15, random(85, 95), random(10, 30));
            canvasTextures.canvas.point(x + random(-1, 1), y + random(-1, 1));
        }
    }
}

function createBrushTextures() {
    brushTexture = createGraphics(100, 100);
    brushTexture.background(0, 0, 0, 0);
    brushTexture.noStroke();
    
    // Create soft brush texture
    for (let r = 50; r > 0; r -= 2) {
        brushTexture.fill(0, 0, 100, map(r, 0, 50, 100, 0));
        brushTexture.circle(50, 50, r);
    }
}

function updateCanvasTexture() {
    if (settings.textureMode !== 'smooth') {
        pg.tint(255, 150);
        pg.image(canvasTextures[settings.textureMode], 0, 0);
        pg.noTint();
    }
}

// Custom color system
function toggleCustomColorSection() {
    const customSection = document.getElementById('custom-color-section');
    if (customSection) {
        customSection.style.display = settings.colorMode === 'custom' ? 'block' : 'none';
    }
}

function getCustomColor() {
    const hex = settings.customColor;
    // Simple conversion from hex to HSB values for p5.js
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    // Convert RGB to HSB approximation
    const hue = (r + g + b) % 360;
    const sat = 80;
    const brightness = settings.colorBrightness;
    
    return { h: hue, s: sat, b: brightness };
}

// Auto movement system
function updateAutoMovement() {
    if (!settings.autoMovement || !sound?.isPlaying()) return;
    
    const bass = fft.getEnergy('bass');
    const mid = fft.getEnergy('mid');
    const treble = fft.getEnergy('treble');
    const speed = map(settings.movementSpeed, 0, 100, 0.5, 3);
    
    let movementX = 0;
    let movementY = 0;
    
    switch(settings.movementFactor) {
        case 'bass':
            movementX = map(bass, 0, 255, -speed, speed);
            movementY = sin(frameCount * 0.02) * speed;
            break;
        case 'mid':
            movementX = cos(frameCount * 0.03) * speed;
            movementY = map(mid, 0, 255, -speed, speed);
            break;
        case 'treble':
            movementX = sin(frameCount * 0.05) * speed;
            movementY = cos(frameCount * 0.04) * speed;
            break;
        case 'mixed':
            movementX = (sin(frameCount * 0.02) * bass + cos(frameCount * 0.03) * mid) * 0.005;
            movementY = (cos(frameCount * 0.025) * treble + sin(frameCount * 0.035) * bass) * 0.005;
            break;
        case 'beat':
            if (beatPulse > 0.3) {
                movementX = random(-speed * 2, speed * 2);
                movementY = random(-speed * 2, speed * 2);
            }
            break;
    }
    
    // Update auto draw position
    autoDrawPosition.x += movementX;
    autoDrawPosition.y += movementY;
    
    // Keep within canvas bounds
    autoDrawPosition.x = constrain(autoDrawPosition.x, 50, width - 50);
    autoDrawPosition.y = constrain(autoDrawPosition.y, 50, height - 50);
    
    // Auto draw when there's significant audio energy
    const currentEnergy = (bass + mid + treble) / 3;
    if (currentEnergy > 60) {
        isAutoDrawing = true;
        drawPattern(autoDrawPosition.x, autoDrawPosition.y, map(currentEnergy, 60, 255, 0.3, 1));
    } else {
        isAutoDrawing = false;
    }
}

function drawAutoMovementIndicator() {
    if (!settings.autoMovement) return;
    
    push();
    // Draw current auto position indicator
    if (isAutoDrawing) {
        fill(0, 80, 100, 80);
        stroke(0, 80, 100);
        strokeWeight(3);
    } else {
        fill(120, 60, 80, 60);
        stroke(120, 60, 80);
        strokeWeight(2);
    }
    circle(autoDrawPosition.x, autoDrawPosition.y, 25 + beatPulse * 10);
    
    // Direction indicator
    noFill();
    for (let i = 0; i < 4; i++) {
        const angle = frameCount * 0.05 + i * PI/2;
        const x = autoDrawPosition.x + cos(angle) * 15;
        const y = autoDrawPosition.y + sin(angle) * 15;
        point(x, y);
    }
    pop();
}

// Music analysis for coordinated brush movement (based on reference image)
let musicCharacteristics = {
    tune: { frequency: 0, strength: 0, position: { x: 0, y: 0 } },
    rhythm: { tempo: 0, intensity: 0, position: { x: 0, y: 0 } },
    shape: { complexity: 0, form: 0, position: { x: 0, y: 0 } },
    direction: { flow: 0, movement: 0, position: { x: 0, y: 0 } },
    notes: { density: 0, pitch: 0, position: { x: 0, y: 0 } },
    colour: { warmth: 0, brightness: 0 }
};
 based on reference image
let performanceTimeline = { isActive: false, currentTime: 0, totalTime: 0 };
let isAutoPatternEnabled = true;
let lastPatternChange = 0;

function analyzeAudioAdvanced() {
    if (!sound || !sound.isPlaying()) {
        beatPulse = 0;
        return;
    }

    let spectrum = fft.analyze();
    let level = amp.getLevel();
    let bass = fft.getEnergy('bass');
    let mid = fft.getEnergy('mid'); 
    let treble = fft.getEnergy('treble');
    
    bassHistory.push(bass);
    midHistory.push(mid);
    highHistory.push(treble);
    
    if (bassHistory.length > 10) bassHistory.shift();
    if (midHistory.length > 10) midHistory.shift();
    if (highHistory.length > 10) highHistory.shift();
    
    extractMusicCharacteristics(spectrum, bass, mid, treble, level);
    detectBeats(bass, mid, treble);
    hueOffset += musicCharacteristics.tune.frequency * 0.1;
}

function extractMusicCharacteristics(spectrum, bass, mid, treble, level) {
    // TUNE: dominant frequency (top of hexagon)
    let dominantFreq = 0, maxMagnitude = 0;
    for (let i = 0; i < spectrum.length; i++) {
        if (spectrum[i] > maxMagnitude) {
            maxMagnitude = spectrum[i];
            dominantFreq = i;
        }
    }
    musicCharacteristics.tune.frequency = map(dominantFreq, 0, spectrum.length, 0, 1);
    musicCharacteristics.tune.strength = map(maxMagnitude, 0, 255, 0, 1);
    musicCharacteristics.tune.position.x = map(musicCharacteristics.tune.frequency, 0, 1, width * 0.3, width * 0.7);
    musicCharacteristics.tune.position.y = map(musicCharacteristics.tune.strength, 0, 1, height * 0.1, height * 0.25);
    
    // RHYTHM: tempo and intensity (right side)
    let rhythmicEnergy = (bass + mid) * 0.5;
    musicCharacteristics.rhythm.intensity = map(rhythmicEnergy, 0, 255, 0, 1);
    musicCharacteristics.rhythm.position.x = map(musicCharacteristics.rhythm.intensity, 0, 1, width * 0.65, width * 0.9);
    musicCharacteristics.rhythm.position.y = map(beatPulse, 0, 1, height * 0.25, height * 0.65);
    
    // SHAPE: harmonic complexity (left side)
    let harmonicComplexity = 0, bandCount = 8, bandSize = spectrum.length / bandCount;
    for (let i = 0; i < bandCount; i++) {
        let bandEnergy = 0;
        for (let j = int(i * bandSize); j < int((i + 1) * bandSize); j++) {
            bandEnergy += spectrum[j];
        }
        if (bandEnergy > 50) harmonicComplexity++;
    }
    musicCharacteristics.shape.complexity = map(harmonicComplexity, 0, bandCount, 0, 1);
    musicCharacteristics.shape.position.x = map(musicCharacteristics.shape.complexity, 0, 1, width * 0.1, width * 0.35);
    musicCharacteristics.shape.position.y = map((mid + treble)/510, 0, 1, height * 0.25, height * 0.65);
    
    // DIRECTION: spectral flow (bottom)
    let spectralCentroid = 0, totalMagnitude = 0;
    for (let i = 0; i < spectrum.length; i++) {
        spectralCentroid += i * spectrum[i];
        totalMagnitude += spectrum[i];
    }
    if (totalMagnitude > 0) spectralCentroid /= totalMagnitude;
    musicCharacteristics.direction.flow = map(spectralCentroid, 0, spectrum.length, -1, 1);
    musicCharacteristics.direction.position.x = map(musicCharacteristics.direction.flow, -1, 1, width * 0.2, width * 0.8);
    musicCharacteristics.direction.position.y = map(level, 0, 1, height * 0.75, height * 0.9);
    
    // NOTES: density and pitch (center)
    let noteActivity = 0;
    for (let i = int(spectrum.length * 0.3); i < spectrum.length; i++) noteActivity += spectrum[i];
    musicCharacteristics.notes.density = map(noteActivity, 0, spectrum.length * 0.7 * 255, 0, 1);
    musicCharacteristics.notes.pitch = (treble + mid * 0.5) / 255;
    musicCharacteristics.notes.position.x = map(musicCharacteristics.notes.density, 0, 1, width * 0.35, width * 0.65);
    musicCharacteristics.notes.position.y = map(musicCharacteristics.notes.pitch, 0, 1, height * 0.35, height * 0.65);
    
    // COLOUR: warmth and brightness
    musicCharacteristics.colour.warmth = constrain(bass / (treble + 1), 0, 1);
    musicCharacteristics.colour.brightness = constrain((treble + mid) / 255, 0, 1);
}

function detectBeats(bass, mid, treble) {
    let currentEnergy = bass + mid + treble;
    beatHistory.push(currentEnergy);
    if (beatHistory.length > 5) beatHistory.shift();
    
    if (beatHistory.length >= 5) {
        let avgEnergy = beatHistory.reduce((a, b) => a + b) / beatHistory.length;
        if (currentEnergy > avgEnergy * 1.3) {
            beatPulse = 1;
        } else {
            beatPulse *= 0.95;
        }
    }
}



































































































































































































































































































































































































































































































































































































































































































































































































































































        const px = x + map(i, 0,    for(let i = 0; i <= points; i++) {    pg.beginShape();    const amp = size * (0.3 + high/255);    const points = 12;function drawWaves(x, y, size, high) {}    pg.pop();    pg.endShape(CLOSE);    }        pg.vertex(cos(angle)*r, sin(angle)*r);        const angle = TWO_PI * i / (points*2);        const r = i % 2 === 0 ? size : size * 0.4;    for(let i = 0; i < points*2; i++) {    pg.beginShape();    const points = 5 + int(mid/50);        pg.rotate(frameCount * 0.1);    pg.translate(x, y);    pg.push();function drawStars(x, y, size, mid) {}    }        pg.circle(x, y, size * (1 + i*0.5*beatPulse));    for(let i = 0; i < rings; i++) {    const rings = 3 + int(bass/50);function drawCircles(x, y, size, bass) {}    }        captureTimelineState();    if (timelineCapture.enabled && sound?.isPlaying()) {    // Capture timeline state if enabled        }        });            energy, timestamp: millis()            x, y, size, pattern: currentPattern,        performanceData.push({    if (isRecording) {    // Record performance data        }        updateCanvasTexture();    if (settings.rhythmTexture && beatPulse > 0.3) {    // Update canvas texture based on rhythm        }        case 'ribbons': drawRibbons(x, y, size, energy); break;        case 'particles': drawParticles(x, y, size, energy); break;        case 'grid': drawGrid(x, y, size, energy.bass); break;        case 'waves': drawWaves(x, y, size, energy.high); break;        case 'stars': drawStars(x, y, size, energy.mid); break;        case 'circles': drawCircles(x, y, size, energy.bass); break;    switch(currentPattern) {    // Draw the main pattern (this stays permanent on pg)    }        pg.noStroke();        pg.line(lastStroke.x, lastStroke.y, x, y);        pg.strokeWeight(size * 0.2);        pg.stroke(hue, sat, bri, 50);        const lastStroke = persistentStrokes[persistentStrokes.length - 2];    if (settings.trailEffect && persistentStrokes.length > 1) {    // Draw permanent connecting lines between strokes    persistentStrokes.push(strokeData);    };        energy: {...energy}        timestamp: sound?.isPlaying() ? performanceTimeline.currentTime : 0,        pattern: currentPattern,        x, y, size, hue, sat, bri,    const strokeData = {    // Store persistent stroke data    pg.fill(hue, sat, bri, 70);    pg.noStroke();        }            break;            bri = customColor.b;            break;            bri = customColor.b;            sat = customColor.s;            hue = customColor.h;            const customColor = getCustomColor();        case 'custom':            break;            bri = map(energy.mid, 0, 255, 60, 100);            sat = 0;            hue = 0;        case 'monochrome':            break;            bri = 85;            sat = 80;            hue = map(energy.high, 0, 255, 180, 280);        case 'cool':            break;            bri = 90;            sat = 85;            hue = map(energy.bass, 0, 255, 0, 60);        case 'warm':            break;            bri = 90;            sat = 80 + map(energy.mid, 0, 255, 0, 20);            hue = (frameCount % 360 + hueOffset) % 360;        case 'spectrum':    switch(settings.colorMode) {    let hue, sat, bri;    // Color calculation based on settings        };        high: fft.getEnergy('treble')        mid: fft.getEnergy('mid'),        bass: fft.getEnergy('bass'),    const energy = {    let size = settings.brushSize * (settings.audioReactive ? (1 + beatPulse) : 1) * pressure;function drawPattern(x, y, pressure = 1) {}    analyzeAudioAdvanced();function analyzeAudio() {}    enhancedCanvasEffects();    // Enhanced canvas texture effects        }        updateTimelineUI();    if (frameCount % 30 === 0) { // Update every half second    // Update timeline UI        drawPerformanceTimeline();    drawAudioMeters();    drawAutoMovementIndicator();    drawCursor();        updateAllParticles();    // Update and draw all particles (including sparkles)        pop();    image(pg, 0, 0);    // Just draw the persistent graphics layer    // IMPORTANT: Never clear or modify pg background after initial setup    }        drawPattern(drawX, drawY, gamepadState.pressure);        const drawY = map(gamepadState.y, -1, 1, 0, height);        const drawX = map(gamepadState.x, -1, 1, 0, width);    if (gamepadConnected && gamepadState.pressure > 0.1) {    // Controller drawing        }        drawPattern(mouseX, mouseY);    if (mouseIsPressed && mouseInCanvas()) {    // Drawing input handling    applyTimelineEffects();    push();    // Apply timeline-based visual effects    drawMusicSignals();    // Draw immersive music signals in background    autoPatternCycling();    updateGamepadInput();    updateAutoMovement();    updateMusicSignals();    updateAutoRecording();    updatePerformanceTimeline();    analyzeAudio();    background(0);function draw() {}    setupTimelineNavigation();    // Setup timeline navigation        });        createTimelineComposite();    select('#createCompositeBtn').mousePressed(() => {        });        addTimeMarker();    select('#addMarkerBtn').mousePressed(() => {        });        }            compositeBtn.attribute('disabled', '');            addMarkerBtn.attribute('disabled', '');            btn.style('background', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');            btn.html('Enable Timeline Capture');        } else {            compositeBtn.removeAttribute('disabled');            addMarkerBtn.removeAttribute('disabled');            btn.style('background', 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)');            btn.html('Disable Timeline Capture');        if (timelineCapture.enabled) {                const compositeBtn = select('#createCompositeBtn');        const addMarkerBtn = select('#addMarkerBtn');        const btn = select('#timelineCaptureBtn');        timelineCapture.enabled = !timelineCapture.enabled;    select('#timelineCaptureBtn').mousePressed(() => {    // Timeline capture controls        });        toggleRecording();    select('#recordBtn').mousePressed(() => {        });        }, 100);            alert(`Drawing saved as ${filename}.png to your Downloads folder!`);        setTimeout(() => {        // Show notification                saveCanvas(filename, 'png');        const filename = 'MusicDanceDrawing_' + timestamp();        // Create a filename with timestamp    select('#saveBtn').mousePressed(() => {        });        persistentStrokes = [];        drawingTrail = [];        particles = [];        pg.background(0);    select('#clearBtn').mousePressed(() => {    // Export controls        });        settings.movementFactor = select('#movementFactor').value();    select('#movementFactor').changed(() => {        });        select('#movementSpeedValue').html(settings.movementSpeed);        settings.movementSpeed = select('#movementSpeed').value();    select('#movementSpeed').input(() => {        });        }            autoDrawPosition.y = height / 2;            autoDrawPosition.x = width / 2;        if (settings.autoMovement) {        settings.autoMovement = select('#autoMovement').checked();    select('#autoMovement').changed(() => {    // Auto movement controls        });        settings.rhythmTexture = select('#rhythmTexture').checked();    select('#rhythmTexture').changed(() => {        });        settings.audioReactive = select('#audioReactive').checked();    select('#audioReactive').changed(() => {        });        settings.beatFlash = select('#beatFlash').checked();    select('#beatFlash').changed(() => {        });        settings.trailEffect = select('#trailEffect').checked();    select('#trailEffect').changed(() => {    // Performance effects        });        select('#brightnessValue').html(settings.colorBrightness);        settings.colorBrightness = select('#colorBrightness').value();    select('#colorBrightness').input(() => {        });        settings.customColor = select('#customColor').value();    select('#customColor').input(() => {    // Custom color controls        });        toggleCustomColorSection();        settings.colorMode = select('#colorMode').value();    select('#colorMode').changed(() => {        });        updateCanvasTexture();        settings.textureMode = select('#textureMode').value();    select('#textureMode').changed(() => {        });        select('#beatValue').html(settings.beatSensitivity);        settings.beatSensitivity = select('#beat').value();    select('#beat').input(() => {    // Music mapping controls        });        select('#brushValue').html(settings.brushSize);        settings.brushSize = select('#brush').value();    select('#brush').input(() => {        });        currentPattern = select('#pattern').value();    select('#pattern').changed(() => {    // Drawing controls        });        switchCanvasMode();        settings.canvasMode = select('#canvasMode').value();    select('#canvasMode').changed(() => {    // Canvas mode switching        select('#pauseBtn').mousePressed(() => sound?.pause());    select('#playBtn').mousePressed(() => sound?.play());    });        });            select('#pauseBtn').removeAttribute('disabled');            select('#playBtn').removeAttribute('disabled');            sound = s;            if (sound) sound.stop();        loadSound(url, (s) => {        const url = URL.createObjectURL(file);                if (!file) return;        const file = select('#fileInput').elt.files[0];    select('#fileInput').changed(() => {    });        select('#startBtn').attribute('disabled', '');        userStartAudio();    select('#startBtn').mousePressed(() => {    // Audio controlsfunction setupUI() {}    setupTimelineNavigation();    createBrushTextures();    createBackgroundTextures();    setupGamepad();    setupUI();    amp = new p5.Amplitude();    fft = new p5.FFT(0.9, 512);    // Audio setup     pg.background(0);    pg.colorMode(HSB, 360, 100, 100, 100);    colorMode(HSB, 360, 100, 100, 100);    pg = createGraphics(W, H);        cnv.parent('sketch-holder');    cnv = createCanvas(W, H);function setup() {let patternChangeInterval = 8000;let lastPatternChange = 0;let isAutoPatternEnabled = true;// Auto pattern cycling};    markers: []    totalTime: 0,    currentTime: 0,    isActive: false,let performanceTimeline = {// Performance timeline};    colour: { warmth: 0, brightness: 0, position: { x: 0, y: 0 } }    notes: { density: 0, pitch: 0, position: { x: 0, y: 0 } },    direction: { flow: 0, movement: 0, position: { x: 0, y: 0 } },    shape: { complexity: 0, form: 0, position: { x: 0, y: 0 } },    rhythm: { tempo: 0, intensity: 0, position: { x: 0, y: 0 } },    tune: { frequency: 0, strength: 0, position: { x: 0, y: 0 } },let musicCharacteristics = {// Music analysis variables for brush movement coordination based on reference image}    pop();    }        point(x, y);        const y = autoDrawPosition.y + sin(angle) * 15;        const x = autoDrawPosition.x + cos(angle) * 15;        const angle = frameCount * 0.05 + i * PI/2;    for (let i = 0; i < 4; i++) {    noFill();    // Direction indicator        circle(autoDrawPosition.x, autoDrawPosition.y, 25 + beatPulse * 10);    }        strokeWeight(2);        stroke(120, 60, 80);        fill(120, 60, 80, 60);    } else {        strokeWeight(3);        stroke(0, 80, 100);        fill(0, 80, 100, 80);    if (isAutoDrawing) {    // Draw current auto position indicator    push();        if (!settings.autoMovement) return;function drawAutoMovementIndicator() {}    }        isAutoDrawing = false;    } else {        drawPattern(autoDrawPosition.x, autoDrawPosition.y, map(currentEnergy, 60, 255, 0.3, 1));        isAutoDrawing = true;    if (currentEnergy > 60) {    const currentEnergy = (bass + mid + treble) / 3;    // Auto draw when there's significant audio energy        autoDrawPosition.y = constrain(autoDrawPosition.y, 50, height - 50);    autoDrawPosition.x = constrain(autoDrawPosition.x, 50, width - 50);    // Keep within canvas bounds        autoDrawPosition.y += movementY;    autoDrawPosition.x += movementX;    // Update auto draw position        }            break;            }                movementY = random(-speed * 2, speed * 2);                movementX = random(-speed * 2, speed * 2);            if (beatPulse > 0.3) {        case 'beat':            break;            movementY = (cos(frameCount * 0.025) * treble + sin(frameCount * 0.035) * bass) * 0.005;            movementX = (sin(frameCount * 0.02) * bass + cos(frameCount * 0.03) * mid) * 0.005;        case 'mixed':            break;            movementY = cos(frameCount * 0.04) * speed;            movementX = sin(frameCount * 0.05) * speed;        case 'treble':            break;            movementY = map(mid, 0, 255, -speed, speed);            movementX = cos(frameCount * 0.03) * speed;        case 'mid':            break;            movementY = sin(frameCount * 0.02) * speed;            movementX = map(bass, 0, 255, -speed, speed);        case 'bass':    switch(settings.movementFactor) {        let movementY = 0;    let movementX = 0;        const speed = map(settings.movementSpeed, 0, 100, 0.5, 3);    const treble = fft.getEnergy('treble');    const mid = fft.getEnergy('mid');    const bass = fft.getEnergy('bass');        if (!settings.autoMovement || !sound?.isPlaying()) return;function updateAutoMovement() {// Auto movement system}    return { h: hue, s: sat, b: brightness };        const brightness = settings.colorBrightness;    const sat = 80;    const hue = (r + g + b) % 360;    // Convert RGB to HSB approximation        const b = parseInt(hex.slice(5, 7), 16);    const g = parseInt(hex.slice(3, 5), 16);    const r = parseInt(hex.slice(1, 3), 16);    // Simple conversion from hex to HSB values for p5.js    const hex = settings.customColor;function getCustomColor() {}    }        customSection.style.display = settings.colorMode === 'custom' ? 'block' : 'none';    if (customSection) {    const customSection = document.getElementById('custom-color-section');function toggleCustomColorSection() {// Custom color system}    }        pg.noTint();        pg.image(canvasTextures[settings.textureMode], 0, 0);        pg.tint(255, 150);    if (settings.textureMode !== 'smooth') {function updateCanvasTexture() {}    }        brushTexture.circle(50, 50, r);        brushTexture.fill(0, 0, 100, map(r, 0, 50, 100, 0));    for (let r = 50; r > 0; r -= 2) {    // Create soft brush texture        brushTexture.noStroke();    brushTexture.background(0, 0, 0, 0);    brushTexture = createGraphics(100, 100);function createBrushTextures() {}    }        }            canvasTextures.canvas.point(x + random(-1, 1), y + random(-1, 1));            canvasTextures.canvas.stroke(25, 15, random(85, 95), random(10, 30));        for (let y = 0; y < H; y += 4) {    for (let x = 0; x < W; x += 4) {    canvasTextures.canvas.background(25, 15, 90);    canvasTextures.canvas = createGraphics(W, H);        }        canvasTextures.paper.circle(random(W), random(H), random(1, 3));        canvasTextures.paper.fill(0, 0, random(85, 100), random(5, 15));    for (let i = 0; i < 1000; i++) {    canvasTextures.paper.noStroke();    canvasTextures.paper.background(15, 10, 95);    canvasTextures.paper = createGraphics(W, H);        canvasTextures.rough.updatePixels();    }        canvasTextures.rough.pixels[i + 3] = 255;        canvasTextures.rough.pixels[i + 2] = noise;        canvasTextures.rough.pixels[i + 1] = noise;        canvasTextures.rough.pixels[i] = noise;        const noise = random(0, 30);    for (let i = 0; i < canvasTextures.rough.pixels.length; i += 4) {    canvasTextures.rough.loadPixels();    canvasTextures.rough = createGraphics(W, H);        canvasTextures.smooth.background(0);    canvasTextures.smooth = createGraphics(W, H);function createBackgroundTextures() {// Texture creation functions}    }        pg.background(0);        pg.colorMode(HSB, 360, 100, 100, 100);        pg = createGraphics(W, H);        // Recreate graphics layer for 2D                is3D = false;        cnv.parent('sketch-holder');        cnv = createCanvas(W, H);        cnv.remove();        // Switch to 2D mode    } else if (mode === '2D' && is3D) {                pg.background(0);        pg.colorMode(HSB, 360, 100, 100, 100);        pg = createGraphics(W, H);        // Recreate graphics layer for 3D                is3D = true;        cnv.parent('sketch-holder');        cnv = createCanvas(W, H, WEBGL);        cnv.remove();        // Switch to 3D mode    if (mode === '3D' && !is3D) {        const mode = settings.canvasMode;function switchCanvasMode() {// Canvas mode switching}    }        instructionsPanel.style.display = gamepadConnected ? 'block' : 'none';    if (instructionsPanel) {    const instructionsPanel = document.getElementById('controller-instructions');    // Update controller instructions visibility        }        statusElement.textContent = status;    if (statusElement) {    const statusElement = document.getElementById('gamepad-status');function updateGamepadStatus(status) {}    }        }            indicator.innerHTML = '<span class="status-dot inactive"></span>Manual Pattern Control';        } else {            indicator.innerHTML = '<span class="status-dot active"></span>Auto-Pattern: ON';        if (isAutoPatternEnabled) {    if (indicator) {    const indicator = document.getElementById('auto-pattern-indicator');function updateAutoPatternStatus() {// Function to update auto-pattern status in UI}    persistentStrokes = []; // Clear all stored strokes    drawingTrail = [];    particles = [];    pg.background(0);function clearCanvas() {}    updatePatternUI();    currentPattern = patterns[nextIndex];    const nextIndex = (currentIndex + 1) % patterns.length;    const currentIndex = patterns.indexOf(currentPattern);    const patterns = ['circles', 'stars', 'waves', 'grid', 'particles', 'ribbons'];function cyclePatternManually() {}    }        }            buttonStates.y = false;        } else if (!yButton || !yButton.pressed) {            buttonStates.y = true;            saveCanvas('MusicDanceDrawing_' + timestamp(), 'png');        if (yButton && yButton.pressed && !buttonStates.y) {        // Y button - Save canvas                }            buttonStates.x = false;        } else if (!xButton || !xButton.pressed) {            buttonStates.x = true;            if (trailCheckbox) trailCheckbox.checked(settings.trailEffect);            const trailCheckbox = select('#trailEffect');            settings.trailEffect = !settings.trailEffect;        if (xButton && xButton.pressed && !buttonStates.x) {        // X button - Toggle trail effect                }            buttonStates.b = false;        } else if (!bButton || !bButton.pressed) {            buttonStates.b = true;            clearCanvas();        if (bButton && bButton.pressed && !buttonStates.b) {        // B button - Clear canvas                }            buttonStates.a = false;        } else if (!aButton || !aButton.pressed) {            buttonStates.a = true;            }                cyclePatternManually();            if (!isAutoPatternEnabled) {            updateAutoPatternStatus();            isAutoPatternEnabled = !isAutoPatternEnabled;        if (aButton && aButton.pressed && !buttonStates.a) {        // A button - Manual pattern cycling (with auto-pattern toggle)                const yButton = gamepad.buttons[3];        const xButton = gamepad.buttons[2];        const bButton = gamepad.buttons[1];        const aButton = gamepad.buttons[0];        // Safe                }            drawPattern(drawX, drawY, gamepadState.pressure);        if (gamepadState.pressure > 0.1) {        // Draw if pressure is being applied (fixed color issue)                const drawY = map(gamepadState.y, -1, 1, 0, height);        const drawX = map(gamepadState.x, -1, 1, 0, width);        // Map gamepad input to canvas coordinates                gamepadState.pressure = gamepad.buttons[7] ? gamepad.buttons[7].value : 0;        // Right trigger for pressure/brush size                gamepadState.y = gamepad.axes[1];        gamepadState.x = gamepad.axes[0];        // Left stick for drawing position    if (gamepad) {        const gamepad = gamepads[gamepadIndex];    const gamepads = navigator.getGamepads();        if (!gamepadConnected) return;function updateGamepadInput() {}    });        updateGamepadStatus("No controller detected");        gamepadIndex = -1;        gamepadConnected = false;    window.addEventListener("gamepaddisconnected", (e) => {        });        updateGamepadStatus("Controller connected: " + e.gamepad.id);        gamepadIndex = e.gamepad.index;        gamepadConnected = true;    window.addEventListener("gamepadconnected", (e) => {function setupGamepad() {// Gamepad support functions}    return mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height;function mouseInCanvas() {}    pop();    }        rect(10, 10, 200 * level, h);        fill(frameCount % 360, 80, 100);        const level = amp.getLevel();    if (sound?.isPlaying()) {    rect(10, 10, 200, h);    const h = 15;    fill(0, 0, 100, 30);    noStroke();    push();function drawAudioMeters() {}    circle(mouseX, mouseY, 20 + 10*beatPulse);    strokeWeight(2);    stroke(frameCount % 360, 80, 100, 80);    noFill();function drawCursor() {}    pg.noStroke();        }        pg.endShape();        }            pg.vertex(px, py);            const py = lerp(y, endY, t) + sin(t * PI + frameCount * 0.1) * ribbonWidth;            const px = lerp(x, endX, t);        for(let t = 0; t <= 1; t += 0.1) {        pg.beginShape();        pg.noFill();        // Draw curved ribbon                const endY = y + sin(angle) * size;        const endX = x + cos(angle) * size;        const angle = TWO_PI * i / 3 + frameCount * 0.1;    for(let i = 0; i < 3; i++) {        pg.strokeWeight(ribbonWidth);    pg.stroke(pg._state.fill._array[0], pg._state.fill._array[1], pg._state.fill._array[2], 60);        const ribbonWidth = size * 0.2;    const ribbonLength = 8;function drawRibbons(x, y, size, energy) {}    endShape(CLOSE);    }        vertex(sx, sy);        sy = y + sin(a + halfAngle) * radius1;        sx = x + cos(a + halfAngle) * radius1;        vertex(sx, sy);        let sy = y + sin(a) * radius2;        let sx = x + cos(a) * radius2;    for (let a = 0; a < TWO_PI; a += angle) {    beginShape();    let halfAngle = angle / 2.0;    let angle = TWO_PI / npoints;function star(x, y, radius1, radius2, npoints) {// Helper function to draw star shapes for sparkles}    }        }            pg.circle(p.x, p.y, p.size);            pg.fill(p.hue, 80, 90, alpha);            // Normal particles are drawn on pg        } else {            pop();            star(p.x, p.y, p.size/2, p.size, 5);            noStroke();            fill(p.hue, 80, 100, alpha);            push();            // Sparkle particles are drawn on main canvas, not pg        if (p.type === 'sparkle') {                const alpha = map(p.life, 0, 60, 0, 100);                }            continue;            particles.splice(i, 1);        if(p.life <= 0) {                p.life--;        p.y += p.vy;        p.x += p.vx;        let p = particles[i];    for(let i = particles.length - 1; i >= 0; i--) {    // Update and draw all particles (both normal and sparkle)function updateAllParticles() {}    }        });            type: 'normal'            hue: (frameCount % 360 + hueOffset) % 360,            size: random(2, 8),            life: 60,            vy: random(-2, 2),            vx: random(-2, 2),            y: y + random(-size/2, size/2),            x: x + random(-size/2, size/2),        particles.push({    for(let i = 0; i < 3; i++) {    // Create new particlesfunction drawParticles(x, y, size, energy) {}    pg.pop();    }        }            pg.rect(px, py, cellSize*0.8, cellSize*0.8);            const py = (j - cells/2) * cellSize;            const px = (i - cells/2) * cellSize;        for(let j = 0; j < cells; j++) {    for(let i = 0; i < cells; i++) {    pg.rotate(frameCount * 0.05);    pg.translate(x, y);    pg.push();        const cellSize = size/cells;    const cells = 2 + int(bass/85);function drawGrid(x, y, size, bass) {}    pg.endShape();    }        pg.vertex(px, py);        const py = y + sin(i*0.5 + frameCount*0.1) * amp;        const px = x + map(i, 0, points, -size, size);    for(let i = 0; i <= points; i++) {    pg.beginShape();    const amp = size * (0.3 + high/255);    const points = 12;function drawWaves(x, y, size, high) {}    pg.pop();    pg.endShape(CLOSE);    }        pg.vertex(cos(angle)*r, sin(angle)*r);        const angle = TWO_PI * i / (points*2);        const r = i % 2 === 0 ? size : size * 0.4;    for(let i = 0; i < points*2; i++) {    for(let i = 0; i < points*2; i++) {
        const r = i % 2 === 0 ? size : size * 0.4;
        const angle = TWO_PI * i / (points*2);
        pg.vertex(cos(angle)*r, sin(angle)*r);
    }
    pg.endShape(CLOSE);
    pg.pop();
}

function drawWaves(x, y, size, high) {
    const points = 12;
    const amp = size * (0.3 + high/255);
    pg.beginShape();
    for(let i = 0; i <= points; i++) {
        const px = x + map(i, 0, points, -size, size);
        const py = y + sin(i*0.5 + frameCount*0.1) * amp;
        pg.vertex(px, py);
    }
    pg.endShape();
}

function drawGrid(x, y, size, bass) {
    const cells = 2 + int(bass/85);
    const cellSize = size/cells;
    
    pg.push();
    pg.translate(x, y);
    pg.rotate(frameCount * 0.05);
    for(let i = 0; i < cells; i++) {
        for(let j = 0; j < cells; j++) {
            const px = (i - cells/2) * cellSize;
            const py = (j - cells/2) * cellSize;
            pg.rect(px, py, cellSize*0.8, cellSize*0.8);
        }
    }
    pg.pop();
}

function drawParticles(x, y, size, energy) {
    // Create new particles
    for(let i = 0; i < 3; i++) {
        particles.push({
            x: x + random(-size/2, size/2),
            y: y + random(-size/2, size/2),
            vx: random(-2, 2),
            vy: random(-2, 2),
            life: 60,
            size: random(2, 8),
            hue: (frameCount % 360 + hueOffset) % 360,
            type: 'normal'
        });
    }
}

function updateAllParticles() {
    // Update and draw all particles (both normal and sparkle)
    for(let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        
        if(p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        
        const alpha = map(p.life, 0, 60, 0, 100);
        
        if (p.type === 'sparkle') {
            // Sparkle particles are drawn on main canvas, not pg
            push();
            fill(p.hue, 80, 100, alpha);
            noStroke();
            star(p.x, p.y, p.size/2, p.size, 5);
            pop();
        } else {
            // Normal particles are drawn on pg
            pg.fill(p.hue, 80, 90, alpha);
            pg.circle(p.x, p.y, p.size);
        }
    }
}

// Helper function to draw star shapes for sparkles
function star(x, y, radius1, radius2, npoints) {
    let angle = TWO_PI / npoints;
    let halfAngle = angle / 2.0;
    beginShape();
    for (let a = 0; a < TWO_PI; a += angle) {
        let sx = x + cos(a) * radius2;
        let sy = y + sin(a) * radius2;
        vertex(sx, sy);
        sx = x + cos(a + halfAngle) * radius1;
        sy = y + sin(a + halfAngle) * radius1;
        vertex(sx, sy);
    }
    endShape(CLOSE);
}

function drawRibbons(x, y, size, energy) {
    const ribbonLength = 8;
    const ribbonWidth = size * 0.2;
    
    pg.stroke(pg._state.fill._array[0], pg._state.fill._array[1], pg._state.fill._array[2], 60);
    pg.strokeWeight(ribbonWidth);
    
    for(let i = 0; i < 3; i++) {
        const angle = TWO_PI * i / 3 + frameCount * 0.1;
        const endX = x + cos(angle) * size;
        const endY = y + sin(angle) * size;
        
        // Draw curved ribbon
        pg.noFill();
        pg.beginShape();
        for(let t = 0; t <= 1; t += 0.1) {
            const px = lerp(x, endX, t);
            const py = lerp(y, endY, t) + sin(t * PI + frameCount * 0.1) * ribbonWidth;
            pg.vertex(px, py);
        }
        pg.endShape();
    }
    
    pg.noStroke();
}

function drawCursor() {
    noFill();
    stroke(frameCount % 360, 80, 100, 80);
    strokeWeight(2);
    circle(mouseX, mouseY, 20 + 10*beatPulse);
}

function drawAudioMeters() {
    push();
    noStroke();
    fill(0, 0, 100, 30);
    const h = 15;
    rect(10, 10, 200, h);
    if (sound?.isPlaying()) {
        const level = amp.getLevel();
        fill(frameCount % 360, 80, 100);
        rect(10, 10, 200 * level, h);
    }
    pop();
}

function mouseInCanvas() {
    return mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height;
}

// Gamepad support functions
function setupGamepad() {
    window.addEventListener("gamepadconnected", (e) => {
        gamepadConnected = true;
        gamepadIndex = e.gamepad.index;
        updateGamepadStatus("Controller connected: " + e.gamepad.id);
    });
    
    window.addEventListener("gamepaddisconnected", (e) => {
        gamepadConnected = false;
        gamepadIndex = -1;
        updateGamepadStatus("No controller detected");
    });
}

function updateGamepadInput() {
    if (!gamepadConnected) return;
    
    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[gamepadIndex];
    
    if (gamepad) {
        // Left stick for drawing position
        gamepadState.x = gamepad.axes[0];
        gamepadState.y = gamepad.axes[1];
        
        // Right trigger for pressure/brush size
        gamepadState.pressure = gamepad.buttons[7] ? gamepad.buttons[7].value : 0;
        
        // Map gamepad input to canvas coordinates
        const drawX = map(gamepadState.x, -1, 1, 0, width);
        const drawY = map(gamepadState.y, -1, 1, 0, height);
        
        // Draw if pressure is being applied (fixed color issue)
        if (gamepadState.pressure > 0.1) {
            drawPattern(drawX, drawY, gamepadState.pressure);
        }
        
        // Safe
        const aButton = gamepad.buttons[0];
        const bButton = gamepad.buttons[1];
        const xButton = gamepad.buttons[2];
        const yButton = gamepad.buttons[3];
        
        // A button - Manual pattern cycling (with auto-pattern toggle)
        if (aButton && aButton.pressed && !buttonStates.a) {
            isAutoPatternEnabled = !isAutoPatternEnabled;
            updateAutoPatternStatus();
            if (!isAutoPatternEnabled) {
                cyclePatternManually();
            }
            buttonStates.a = true;
        } else if (!aButton || !aButton.pressed) {
            buttonStates.a = false;
        }
        
        // B button - Clear canvas
        if (bButton && bButton.pressed && !buttonStates.b) {
            clearCanvas();
            buttonStates.b = true;
        } else if (!bButton || !bButton.pressed) {
            buttonStates.b = false;
        }
        
        // X button - Toggle trail effect
        if (xButton && xButton.pressed && !buttonStates.x) {
            settings.trailEffect = !settings.trailEffect;
            const trailCheckbox = select('#trailEffect');
            if (trailCheckbox) trailCheckbox.checked(settings.trailEffect);
            buttonStates.x = true;
        } else if (!xButton || !xButton.pressed) {
            buttonStates.x = false;
        }
        
        // Y button - Save canvas
        if (yButton && yButton.pressed && !buttonStates.y) {
            saveCanvas('MusicDanceDrawing_' + timestamp(), 'png');
            buttonStates.y = true;
        } else if (!yButton || !yButton.pressed) {
            buttonStates.y = false;
        }
    }
}

function cyclePatternManually() {
    const patterns = ['circles', 'stars', 'waves', 'grid', 'particles', 'ribbons'];
    const currentIndex = patterns.indexOf(currentPattern);
    const nextIndex = (currentIndex + 1) % patterns.length;
    currentPattern = patterns[nextIndex];
    updatePatternUI();
}

function clearCanvas() {
    pg.background(0);
    particles = [];
    drawingTrail = [];
    persistentStrokes = []; // Clear all stored strokes
}

// Function to update auto-pattern status in UI
function updateAutoPatternStatus() {
    const indicator = document.getElementById('auto-pattern-indicator');
    if (indicator) {
        if (isAutoPatternEnabled) {
            indicator.innerHTML = '<span class="status-dot active"></span>Auto-Pattern: ON';
        } else {
            indicator.innerHTML = '<span class="status-dot inactive"></span>Manual Pattern Control';
        }
    }
}

function updateGamepadStatus(status) {
    const statusElement = document.getElementById('gamepad-status');
    if (statusElement) {
        statusElement.textContent = status;
    }
    
    // Update controller instructions visibility
    const instructionsPanel = document.getElementById('controller-instructions');
    if (instructionsPanel) {
        instructionsPanel.style.display = gamepadConnected ? 'block' : 'none';
    }
}

// Canvas mode switching
function switchCanvasMode() {
    const mode = settings.canvasMode;
    
    if (mode === '3D' && !is3D) {
        // Switch to 3D mode
        cnv.remove();
        cnv = createCanvas(W, H, WEBGL);
        cnv.parent('sketch-holder');
        is3D = true;
        
        // Recreate graphics layer for 3D
        pg = createGraphics(W, H);
        pg.colorMode(HSB, 360, 100, 100, 100);
        pg.background(0);
        
    } else if (mode === '2D' && is3D) {
        // Switch to 2D mode
        cnv.remove();
        cnv = createCanvas(W, H);
        cnv.parent('sketch-holder');
        is3D = false;
        
        // Recreate graphics layer for 2D
        pg = createGraphics(W, H);
        pg.colorMode(HSB, 360, 100, 100, 100);
        pg.background(0);
    }
}

// Texture creation functions
function createBackgroundTextures() {
    canvasTextures.smooth = createGraphics(W, H);
    canvasTextures.smooth.background(0);
    
    canvasTextures.rough = createGraphics(W, H);
    canvasTextures.rough.loadPixels();
    for (let i = 0; i < canvasTextures.rough.pixels.length; i += 4) {
        const noise = random(0, 30);
        canvasTextures.rough.pixels[i] = noise;
        canvasTextures.rough.pixels[i + 1] = noise;
        canvasTextures.rough.pixels[i + 2] = noise;
        canvasTextures.rough.pixels[i + 3] = 255;
    }
    canvasTextures.rough.updatePixels();
    
    canvasTextures.paper = createGraphics(W, H);
    canvasTextures.paper.background(15, 10, 95);
    canvasTextures.paper.noStroke();
    for (let i = 0; i < 1000; i++) {
        canvasTextures.paper.fill(0, 0, random(85, 100), random(5, 15));
        canvasTextures.paper.circle(random(W), random(H), random(1, 3));
    }
    
    canvasTextures.canvas = createGraphics(W, H);
    canvasTextures.canvas.background(25, 15, 90);
    for (let x = 0; x < W; x += 4) {
        for (let y = 0; y < H; y += 4) {
            canvasTextures.canvas.stroke(25, 15, random(85, 95), random(10, 30));
            canvasTextures.canvas.point(x + random(-1, 1), y + random(-1, 1));
        }
    }
}

function createBrushTextures() {
    brushTexture = createGraphics(100, 100);
    brushTexture.background(0, 0, 0, 0);
    brushTexture.noStroke();
    
    // Create soft brush texture
    for (let r = 50; r > 0; r -= 2) {
        brushTexture.fill(0, 0, 100, map(r, 0, 50, 100, 0));
        brushTexture.circle(50, 50, r);
    }
}

function updateCanvasTexture() {
    if (settings.textureMode !== 'smooth') {
        pg.tint(255, 150);
        pg.image(canvasTextures[settings.textureMode], 0, 0);
        pg.noTint();
    }
}

// Custom color system
function toggleCustomColorSection() {
    const customSection = document.getElementById('custom-color-section');
    if (customSection) {
        customSection.style.display = settings.colorMode === 'custom' ? 'block' : 'none';
    }
}

function getCustomColor() {
    const hex = settings.customColor;
    // Simple conversion from hex to HSB values for p5.js
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    // Convert RGB to HSB approximation
    const hue = (r + g + b) % 360;
    const sat = 80;
    const brightness = settings.colorBrightness;
    
    return { h: hue, s: sat, b: brightness };
}

// Auto movement system
function updateAutoMovement() {
    if (!settings.autoMovement || !sound?.isPlaying()) return;
    
    const bass = fft.getEnergy('bass');
    const mid = fft.getEnergy('mid');
    const treble = fft.getEnergy('treble');
    const speed = map(settings.movementSpeed, 0, 100, 0.5, 3);
    
    let movementX = 0;
    let movementY = 0;
    
    switch(settings.movementFactor) {
        case 'bass':
            movementX = map(bass, 0, 255, -speed, speed);
            movementY = sin(frameCount * 0.02) * speed;
            break;
        case 'mid':
            movementX = cos(frameCount * 0.03) * speed;
            movementY = map(mid, 0, 255, -speed, speed);
            break;
        case 'treble':
            movementX = sin(frameCount * 0.05) * speed;
            movementY = cos(frameCount * 0.04) * speed;
            break;
        case 'mixed':
            movementX = (sin(frameCount * 0.02) * bass + cos(frameCount * 0.03) * mid) * 0.005;
            movementY = (cos(frameCount * 0.025) * treble + sin(frameCount * 0.035) * bass) * 0.005;
            break;
        case 'beat':
            if (beatPulse > 0.3) {
                movementX = random(-speed * 2, speed * 2);
                movementY = random(-speed * 2, speed * 2);
            }
            break;
    }
    
    // Update auto draw position
    autoDrawPosition.x += movementX;
    autoDrawPosition.y += movementY;
    
    // Keep within canvas bounds
    autoDrawPosition.x = constrain(autoDrawPosition.x, 50, width - 50);
    autoDrawPosition.y = constrain(autoDrawPosition.y, 50, height - 50);
    
    // Auto draw when there's significant audio energy
    const currentEnergy = (bass + mid + treble) / 3;
    if (currentEnergy > 60) {
        isAutoDrawing = true;
        drawPattern(autoDrawPosition.x, autoDrawPosition.y, map(currentEnergy, 60, 255, 0.3, 1));
    } else {
        isAutoDrawing = false;
    }
}

function drawAutoMovementIndicator() {
    if (!settings.autoMovement) return;
    
    push();
    // Draw current auto position indicator
    if (isAutoDrawing) {
        fill(0, 80, 100, 80);
        stroke(0, 80, 100);
        strokeWeight(3);
    } else {
        fill(120, 60, 80, 60);
        stroke(120, 60, 80);
        strokeWeight(2);
    }
    circle(autoDrawPosition.x, autoDrawPosition.y, 25 + beatPulse * 10);
    
    // Direction indicator
    noFill();
    for (let i = 0; i < 4; i++) {
        const angle = frameCount * 0.05 + i * PI/2;
        const x = autoDrawPosition.x + cos(angle) * 15;
        const y = autoDrawPosition.y + sin(angle) * 15;
        point(x, y);
    }
    pop();
}

// Music analysis variables for brush movement coordination
let musicCharacteristics = {
    tune: { frequency: 0, strength: 0, position: { x: 0, y: 0 } },
    rhythm: { tempo: 0, intensity: 0, position: { x: 0, y: 0 } },
    shape: { complexity: 0, form: 0, position: { x: 0, y: 0 } },
    direction: { flow: 0, movement: 0, position: { x: 0, y: 0 } },
    notes: { density: 0, pitch: 0, position: { x: 0, y: 0 } },
    colour: { warmth: 0, brightness: 0, position: { x: 0, y: 0 } }
};

// Performance timeline
let performanceTimeline = {
    isActive: false,
    currentTime: 0,
    totalTime: 0,
    markers: []
};

// Auto pattern cycling
let isAutoPatternEnabled = true;
let lastPatternChange = 0;
let patternChangeInterval = 8000; // 8 seconds

function setup() {
    cnv = createCanvas(W, H);
    cnv.parent('sketch-holder');
    
    pg = createGraphics(W, H);
    colorMode(HSB, 360, 100, 100, 100);
    pg.colorMode(HSB, 360, 100, 100, 100);
    pg.background(0);

    // Audio setup 
    fft = new p5.FFT(0.9, 512);
    amp = new p5.Amplitude();

    setupUI();
    setupGamepad();
    createBackgroundTextures();
    createBrushTextures();
    setupTimelineNavigation();
}

function setupUI() {
    // Audio controls
    select('#startBtn').mousePressed(() => {
        userStartAudio();
        select('#startBtn').attribute('disabled', '');
    });

    select('#fileInput').changed(() => {
        const file = select('#fileInput').elt.files[0];
        if (!file) return;
        
        const url = URL.createObjectURL(file);
        loadSound(url, (s) => {
            if (sound) sound.stop();
            sound = s;
            select('#playBtn').removeAttribute('disabled');
            select('#pauseBtn').removeAttribute('disabled');
        });
    });

    select('#playBtn').mousePressed(() => sound?.play());
    select('#pauseBtn').mousePressed(() => sound?.pause());
    
    // Canvas mode switching
    select('#canvasMode').changed(() => {
        settings.canvasMode = select('#canvasMode').value();
        switchCanvasMode();
    });
    
    // Drawing controls
    select('#pattern').changed(() => {
        currentPattern = select('#pattern').value();
    });
    
    select('#brush').input(() => {
        settings.brushSize = select('#brush').value();
        select('#brushValue').html(settings.brushSize);
    });
    
    // Music mapping controls
    select('#beat').input(() => {
        settings.beatSensitivity = select('#beat').value();
        select('#beatValue').html(settings.beatSensitivity);
    });
    
    select('#textureMode').changed(() => {
        settings.textureMode = select('#textureMode').value();
        updateCanvasTexture();
    });
    
    select('#colorMode').changed(() => {
        settings.colorMode = select('#colorMode').value();
        toggleCustomColorSection();
    });
    
    // Custom color controls
    select('#customColor').input(() => {
        settings.customColor = select('#customColor').value();
    });
    
    select('#colorBrightness').input(() => {
        settings.colorBrightness = select('#colorBrightness').value();
        select('#brightnessValue').html(settings.colorBrightness);
    });
    
    // Performance effects
    select('#trailEffect').changed(() => {
        settings.trailEffect = select('#trailEffect').checked();
    });
    
    select('#beatFlash').changed(() => {
        settings.beatFlash = select('#beatFlash').checked();
    });
    
    select('#audioReactive').changed(() => {
        settings.audioReactive = select('#audioReactive').checked();
    });
    
    select('#rhythmTexture').changed(() => {
        settings.rhythmTexture = select('#rhythmTexture').checked();
    });
    
    // Auto movement controls
    select('#autoMovement').changed(() => {
        settings.autoMovement = select('#autoMovement').checked();
        if (settings.autoMovement) {
            autoDrawPosition.x = width / 2;
            autoDrawPosition.y = height / 2;
        }
    });
    
    select('#movementSpeed').input(() => {
        settings.movementSpeed = select('#movementSpeed').value();
        select('#movementSpeedValue').html(settings.movementSpeed);
    });
    
    select('#movementFactor').changed(() => {
        settings.movementFactor = select('#movementFactor').value();
    });
    
    // Export controls
    select('#clearBtn').mousePressed(() => {
        pg.background(0);
        particles = [];
        drawingTrail = [];
        persistentStrokes = [];
    });
    
    select('#saveBtn').mousePressed(() => {
        // Create a filename with timestamp
        const filename = 'MusicDanceDrawing_' + timestamp();
        saveCanvas(filename, 'png');
        
        // Show notification
        setTimeout(() => {
            alert(`Drawing saved as ${filename}.png to your Downloads folder!`);
        }, 100);
    });
    
    select('#recordBtn').mousePressed(() => {
        toggleRecording();
    });
    
    // Timeline capture controls
    select('#timelineCaptureBtn').mousePressed(() => {
        timelineCapture.enabled = !timelineCapture.enabled;
        const btn = select('#timelineCaptureBtn');
        const addMarkerBtn = select('#addMarkerBtn');
        const compositeBtn = select('#createCompositeBtn');
        
        if (timelineCapture.enabled) {
            btn.html('Disable Timeline Capture');
            btn.style('background', 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)');
            addMarkerBtn.removeAttribute('disabled');
            compositeBtn.removeAttribute('disabled');
        } else {
            btn.html('Enable Timeline Capture');
            btn.style('background', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
            addMarkerBtn.attribute('disabled', '');
            compositeBtn.attribute('disabled', '');
        }
    });
    
    select('#addMarkerBtn').mousePressed(() => {
        addTimeMarker();
    });
    
    select('#createCompositeBtn').mousePressed(() => {
        createTimelineComposite();
    });
    
    // Setup timeline navigation
    setupTimelineNavigation();
}

function draw() {
    background(0);
    analyzeAudio();
    updatePerformanceTimeline();
    updateAutoRecording();
    updateMusicSignals();
    updateAutoMovement();
    updateGamepadInput();
    autoPatternCycling();

    // Draw immersive music signals in background
    drawMusicSignals();

    // Apply timeline-based visual effects
    push();
    applyTimelineEffects();

    // Drawing input handling
    if (mouseIsPressed && mouseInCanvas()) {
        drawPattern(mouseX, mouseY);
    }
    
    // Controller drawing
    if (gamepadConnected && gamepadState.pressure > 0.1) {
        const drawX = map(gamepadState.x, -1, 1, 0, width);
        const drawY = map(gamepadState.y, -1, 1, 0, height);
        drawPattern(drawX, drawY, gamepadState.pressure);
    }

    // IMPORTANT: Never clear or modify pg background after initial setup
    // Just draw the persistent graphics layer
    image(pg, 0, 0);
    pop();
    
    // Update and draw all particles (including sparkles)
    updateAllParticles();
    
    drawCursor();
    drawAutoMovementIndicator();
    drawAudioMeters();
    drawPerformanceTimeline();
    
    // Update timeline UI
    if (frameCount % 30 === 0) { // Update every half second
        updateTimelineUI();
    }
    
    // Enhanced canvas texture effects
    enhancedCanvasEffects();
}

function analyzeAudio() {
    analyzeAudioAdvanced();
}

function drawPattern(x, y, pressure = 1) {
    let size = settings.brushSize * (settings.audioReactive ? (1 + beatPulse) : 1) * pressure;
    const energy = {
        bass: fft.getEnergy('bass'),
        mid: fft.getEnergy('mid'),
        high: fft.getEnergy('treble')
    };
    
    // Color calculation based on settings
    let hue, sat, bri;
    switch(settings.colorMode) {
        case 'spectrum':
            hue = (frameCount % 360 + hueOffset) % 360;
            sat = 80 + map(energy.mid, 0, 255, 0, 20);
            bri = 90;
            break;
        case 'warm':
            hue = map(energy.bass, 0, 255, 0, 60);
            sat = 85;
            bri = 90;
            break;
        case 'cool':
            hue = map(energy.high, 0, 255, 180, 280);
            sat = 80;
            bri = 85;
            break;
        case 'monochrome':
            hue = 0;
            sat = 0;
            bri = map(energy.mid, 0, 255, 60, 100);
            break;
        case 'custom':
            const customColor = getCustomColor();
            hue = customColor.h;
            sat = customColor.s;
            bri = customColor.b;
            break;
            bri = customColor.b;
            break;
    }
    
    pg.noStroke();
    pg.fill(hue, sat, bri, 70);

    // Store persistent stroke data
    const strokeData = {
        x, y, size, hue, sat, bri,
        pattern: currentPattern,
        timestamp: sound?.isPlaying() ? performanceTimeline.currentTime : 0,
        energy: {...energy}
    };
    persistentStrokes.push(strokeData);

    // Draw permanent connecting lines between strokes
    if (settings.trailEffect && persistentStrokes.length > 1) {
        const lastStroke = persistentStrokes[persistentStrokes.length - 2];
        pg.stroke(hue, sat, bri, 50);
        pg.strokeWeight(size * 0.2);
        pg.line(lastStroke.x, lastStroke.y, x, y);
        pg.noStroke();
    }

    // Draw the main pattern (this stays permanent on pg)
    switch(currentPattern) {
        case 'circles': drawCircles(x, y, size, energy.bass); break;
        case 'stars': drawStars(x, y, size, energy.mid); break;
        case 'waves': drawWaves(x, y, size, energy.high); break;
        case 'grid': drawGrid(x, y, size, energy.bass); break;
        case 'particles': drawParticles(x, y, size, energy); break;
        case 'ribbons': drawRibbons(x, y, size, energy); break;
    }
    
    // Update canvas texture based on rhythm
    if (settings.rhythmTexture && beatPulse > 0.3) {
        updateCanvasTexture();
    }
    
    // Record performance data
    if (isRecording) {
        performanceData.push({
            x, y, size, pattern: currentPattern,
            energy, timestamp: millis()
        });
    }
    
    // Capture timeline state if enabled
    if (timelineCapture.enabled && sound?.isPlaying()) {
        captureTimelineState();
    }
}

function drawCircles(x, y, size, bass) {
    const rings = 3 + int(bass/50);
    for(let i = 0; i < rings; i++) {
        pg.circle(x, y, size * (1 + i*0.5*beatPulse));
    }
}

function drawStars(x, y, size, mid) {
    pg.push();
    pg.translate(x, y);
    pg.rotate(frameCount * 0.1);
    
    const points = 5 + int(mid/50);
    pg.beginShape();
    for(let i = 0; i < points*2; i++) {
        const r = i % 2 === 0 ? size : size * 0.4;
        const angle = TWO_PI * i / (points*2);
        pg.vertex(cos(angle)*r, sin(angle)*r);
    }
    pg.endShape(CLOSE);
    pg.pop();
}

function drawWaves(x, y, size, high) {
    const points = 12;
    const amp = size * (0.3 + high/255);
    pg.beginShape();
    for(let i = 0; i <= points; i++) {
        const px = x + map(i,