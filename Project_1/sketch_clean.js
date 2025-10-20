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

// Music analysis for coordinated brush movement (based on reference image)
let musicCharacteristics = {
    tune: { frequency: 0, strength: 0, position: { x: 0, y: 0 } },
    rhythm: { tempo: 0, intensity: 0, position: { x: 0, y: 0 } },
    shape: { complexity: 0, form: 0, position: { x: 0, y: 0 } },
    direction: { flow: 0, movement: 0, position: { x: 0, y: 0 } },
    notes: { density: 0, pitch: 0, position: { x: 0, y: 0 } },
    colour: { warmth: 0, brightness: 0 }
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
let patternChangeInterval = 8000;

function setup() {
    // Ensure canvas container exists
    let container = select('#sketch-holder');
    if (!container) {
        console.error('Canvas container #sketch-holder not found!');
        // Create a fallback container
        container = createDiv('');
        container.id('sketch-holder');
        container.parent('body');
        container.style('width', '100%');
        container.style('height', '600px');
        container.style('background', '#f0f0f0');
        container.style('display', 'flex');
        container.style('justify-content', 'center');
        container.style('align-items', 'center');
    }
    
    cnv = createCanvas(W, H);
    cnv.parent('sketch-holder');
    cnv.style('display', 'block');
    cnv.style('border', '2px solid #ddd');
    cnv.style('border-radius', '8px');
    cnv.style('background', '#000');
    
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
    
    // Initialize auto draw position
    autoDrawPosition.x = width / 2;
    autoDrawPosition.y = height / 2;
}

function setupUI() {
    // Audio controls
    select('#startBtn')?.mousePressed(() => {
        userStartAudio();
        select('#startBtn').attribute('disabled', '');
    });

    select('#fileInput')?.changed(() => {
        const file = select('#fileInput').elt.files[0];
        if (!file) return;
        
        const url = URL.createObjectURL(file);
        loadSound(url, (s) => {
            if (sound) sound.stop();
            sound = s;
            select('#playBtn')?.removeAttribute('disabled');
            select('#pauseBtn')?.removeAttribute('disabled');
        });
    });

    select('#playBtn')?.mousePressed(() => sound?.play());
    select('#pauseBtn')?.mousePressed(() => sound?.pause());
    
    // Canvas mode switching
    select('#canvasMode')?.changed(() => {
        settings.canvasMode = select('#canvasMode').value();
        switchCanvasMode();
    });
    
    // Drawing controls
    select('#pattern')?.changed(() => {
        currentPattern = select('#pattern').value();
    });
    
    select('#brush')?.input(() => {
        settings.brushSize = select('#brush').value();
        select('#brushValue')?.html(settings.brushSize);
    });
    
    // Music mapping controls
    select('#beat')?.input(() => {
        settings.beatSensitivity = select('#beat').value();
        select('#beatValue')?.html(settings.beatSensitivity);
    });
    
    select('#textureMode')?.changed(() => {
        settings.textureMode = select('#textureMode').value();
        updateCanvasTexture();
    });
    
    select('#colorMode')?.changed(() => {
        settings.colorMode = select('#colorMode').value();
        toggleCustomColorSection();
    });
    
    // Custom color controls
    select('#customColor')?.input(() => {
        settings.customColor = select('#customColor').value();
    });
    
    select('#colorBrightness')?.input(() => {
        settings.colorBrightness = select('#colorBrightness').value();
        select('#brightnessValue')?.html(settings.colorBrightness);
    });
    
    // Performance effects
    select('#trailEffect')?.changed(() => {
        settings.trailEffect = select('#trailEffect').checked();
    });
    
    select('#beatFlash')?.changed(() => {
        settings.beatFlash = select('#beatFlash').checked();
    });
    
    select('#audioReactive')?.changed(() => {
        settings.audioReactive = select('#audioReactive').checked();
    });
    
    select('#rhythmTexture')?.changed(() => {
        settings.rhythmTexture = select('#rhythmTexture').checked();
    });
    
    // Auto movement controls
    select('#autoMovement')?.changed(() => {
        settings.autoMovement = select('#autoMovement').checked();
        const controls = select('#auto-movement-controls');
        if (controls) {
            controls.style('display', settings.autoMovement ? 'block' : 'none');
        }
        if (settings.autoMovement) {
            autoDrawPosition.x = width / 2;
            autoDrawPosition.y = height / 2;
        }
    });
    
    select('#movementSpeed')?.input(() => {
        settings.movementSpeed = select('#movementSpeed').value();
        select('#movementSpeedValue')?.html(settings.movementSpeed);
    });
    
    select('#movementFactor')?.changed(() => {
        settings.movementFactor = select('#movementFactor').value();
    });
    
    // Export controls
    select('#clearBtn')?.mousePressed(() => {
        pg.background(0);
        particles = [];
        drawingTrail = [];
        persistentStrokes = [];
    });
    
    select('#saveBtn')?.mousePressed(() => {
        const filename = 'MusicDanceDrawing_' + timestamp();
        saveCanvas(filename, 'png');
        setTimeout(() => {
            alert(`Drawing saved as ${filename}.png to your Downloads folder!`);
        }, 100);
    });
    
    select('#recordBtn')?.mousePressed(() => {
        toggleRecording();
    });
    
    // Timeline capture controls
    select('#timelineCaptureBtn')?.mousePressed(() => {
        timelineCapture.enabled = !timelineCapture.enabled;
        const btn = select('#timelineCaptureBtn');
        const addMarkerBtn = select('#addMarkerBtn');
        const compositeBtn = select('#createCompositeBtn');
        
        if (timelineCapture.enabled) {
            btn?.html('Disable Timeline Capture');
            btn?.style('background', 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)');
            addMarkerBtn?.removeAttribute('disabled');
            compositeBtn?.removeAttribute('disabled');
        } else {
            btn?.html('Enable Timeline Capture');
            btn?.style('background', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
            addMarkerBtn?.attribute('disabled', '');
            compositeBtn?.attribute('disabled', '');
        }
    });
    
    select('#addMarkerBtn')?.mousePressed(() => {
        addTimeMarker();
    });
    
    select('#createCompositeBtn')?.mousePressed(() => {
        createTimelineComposite();
    });
    
    // Setup timeline navigation
    setupTimelineNavigation();
    
    // Initialize custom color section visibility
    toggleCustomColorSection();
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

    // Drawing input handling with music-coordinated movement
    if (mouseIsPressed && mouseInCanvas()) {
        // Use music characteristics to influence drawing position
        const musicInfluencedX = mouseX + musicCharacteristics.direction.flow * 20;
        const musicInfluencedY = mouseY + sin(frameCount * 0.05) * musicCharacteristics.tune.strength * 30;
        drawPattern(musicInfluencedX, musicInfluencedY);
    }
    
    // Controller drawing with enhanced gamepad detection
    if (gamepadConnected && gamepadState.pressure > 0.1) {
        const drawX = map(gamepadState.x, -1, 1, 0, width);
        const drawY = map(gamepadState.y, -1, 1, 0, height);
        
        // Apply music characteristics to controller input too
        const musicDrawX = drawX + musicCharacteristics.rhythm.position.x * 0.1;
        const musicDrawY = drawY + musicCharacteristics.notes.position.y * 0.1;
        
        drawPattern(musicDrawX, musicDrawY, gamepadState.pressure);
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
    
    // Store frequency history for beat detection
    bassHistory.push(bass);
    midHistory.push(mid);
    highHistory.push(treble);
    
    if (bassHistory.length > 10) bassHistory.shift();
    if (midHistory.length > 10) midHistory.shift();
    if (highHistory.length > 10) highHistory.shift();
    
    // Extract music characteristics for coordinated brush movement
    extractMusicCharacteristics(spectrum, bass, mid, treble, level);
    detectBeats(bass, mid, treble);
    
    hueOffset += musicCharacteristics.tune.frequency * 0.1;
}

function extractMusicCharacteristics(spectrum, bass, mid, treble, level) {
    // TUNE: dominant frequency (top of hexagon in reference image)
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
    
    // RHYTHM: tempo and intensity (right side of hexagon)
    let rhythmicEnergy = (bass + mid) * 0.5;
    musicCharacteristics.rhythm.intensity = map(rhythmicEnergy, 0, 255, 0, 1);
    musicCharacteristics.rhythm.position.x = map(musicCharacteristics.rhythm.intensity, 0, 1, width * 0.65, width * 0.9);
    musicCharacteristics.rhythm.position.y = map(beatPulse, 0, 1, height * 0.25, height * 0.65);
    
    // SHAPE: harmonic complexity (left side of hexagon)
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
    
    // DIRECTION: spectral flow (bottom of hexagon)
    let spectralCentroid = 0, totalMagnitude = 0;
    for (let i = 0; i < spectrum.length; i++) {
        spectralCentroid += i * spectrum[i];
        totalMagnitude += spectrum[i];
    }
    if (totalMagnitude > 0) spectralCentroid /= totalMagnitude;
    
    musicCharacteristics.direction.flow = map(spectralCentroid, 0, spectrum.length, -1, 1);
    musicCharacteristics.direction.position.x = map(musicCharacteristics.direction.flow, -1, 1, width * 0.2, width * 0.8);
    musicCharacteristics.direction.position.y = map(level, 0, 1, height * 0.75, height * 0.9);
    
    // NOTES: density and pitch (center of hexagon)
    let noteActivity = 0;
    for (let i = int(spectrum.length * 0.3); i < spectrum.length; i++) noteActivity += spectrum[i];
    
    musicCharacteristics.notes.density = map(noteActivity, 0, spectrum.length * 0.7 * 255, 0, 1);
    musicCharacteristics.notes.pitch = (treble + mid * 0.5) / 255;
    musicCharacteristics.notes.position.x = map(musicCharacteristics.notes.density, 0, 1, width * 0.35, width * 0.65);
    musicCharacteristics.notes.position.y = map(musicCharacteristics.notes.pitch, 0, 1, height * 0.35, height * 0.65);
    
    // COLOUR: warmth and brightness (affects brush color)
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

function drawPattern(x, y, pressure = 1) {
    let size = settings.brushSize * (settings.audioReactive ? (1 + beatPulse) : 1) * pressure;
    const energy = {
        bass: fft.getEnergy('bass'),
        mid: fft.getEnergy('mid'),
        high: fft.getEnergy('treble')
    };
    
    // Color calculation based on settings AND music characteristics
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
    }
    
    // Apply music characteristics to color
    hue = (hue + musicCharacteristics.colour.warmth * 60) % 360;
    bri = bri * (0.5 + musicCharacteristics.colour.brightness * 0.5);
    
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

// Enhanced gamepad support with better detection
function setupGamepad() {
    window.addEventListener("gamepadconnected", (e) => {
        console.log("Gamepad connected:", e.gamepad.id);
        gamepadConnected = true;
        gamepadIndex = e.gamepad.index;
        updateGamepadStatus("Controller connected: " + e.gamepad.id);
    });
    
    window.addEventListener("gamepaddisconnected", (e) => {
        console.log("Gamepad disconnected");
        gamepadConnected = false;
        gamepadIndex = -1;
        updateGamepadStatus("No controller detected");
    });
    
    // Periodic check for gamepad connection
    setInterval(checkGamepadConnection, 1000);
}

function checkGamepadConnection() {
    const gamepads = navigator.getGamepads();
    let connected = false;
    
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            connected = true;
            if (!gamepadConnected) {
                gamepadConnected = true;
                gamepadIndex = i;
                updateGamepadStatus("Controller connected: " + gamepads[i].id);
            }
            break;
        }
    }
    
    if (!connected && gamepadConnected) {
        gamepadConnected = false;
        gamepadIndex = -1;
        updateGamepadStatus("No controller detected");
    }
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
        
        // Button handling with debouncing
        const aButton = gamepad.buttons[0];
        const bButton = gamepad.buttons[1];
        const xButton = gamepad.buttons[2];
        const yButton = gamepad.buttons[3];
        
        // A button - Cycle patterns
        if (aButton && aButton.pressed && !buttonStates.a) {
            cyclePatternManually();
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
    persistentStrokes = [];
}

function updatePatternUI() {
    const patternSelect = select('#pattern');
    if (patternSelect) patternSelect.value(currentPattern);
}

function updateGamepadStatus(status) {
    const statusElement = select('#gamepad-status');
    if (statusElement) {
        statusElement.html(status);
    }
    
    // Update controller instructions visibility
    const instructionsPanel = select('.controller-info');
    if (instructionsPanel) {
        instructionsPanel.style('background', gamepadConnected ? 
            'rgba(72, 187, 120, 0.1)' : 'rgba(102, 126, 234, 0.05)');
    }
}

// Auto movement system enhanced with music characteristics
function updateAutoMovement() {
    if (!settings.autoMovement || !sound?.isPlaying()) return;
    
    const speed = map(settings.movementSpeed, 0, 100, 0.5, 3);
    let movementX = 0;
    let movementY = 0;
    
    switch(settings.movementFactor) {
        case 'bass':
            movementX = musicCharacteristics.rhythm.position.x * 0.01;
            movementY = sin(frameCount * 0.02) * speed;
            break;
        case 'mid':
            movementX = cos(frameCount * 0.03) * speed;
            movementY = musicCharacteristics.notes.position.y * 0.01;
            break;
        case 'treble':
            movementX = musicCharacteristics.tune.position.x * 0.01;
            movementY = cos(frameCount * 0.04) * speed;
            break;
        case 'mixed':
            movementX = (musicCharacteristics.direction.flow + musicCharacteristics.tune.frequency) * speed;
            movementY = (musicCharacteristics.rhythm.intensity + musicCharacteristics.notes.density) * speed;
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
    const currentEnergy = (fft.getEnergy('bass') + fft.getEnergy('mid') + fft.getEnergy('treble')) / 3;
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

// Timeline and utility functions
function setupTimelineNavigation() {
    const seeker = select('#timelineSeeker');
    if (seeker) {
        seeker.input(() => {
            if (sound && sound.duration()) {
                let seekTime = map(seeker.value(), 0, 100, 0, sound.duration());
                sound.jump(seekTime);
                reconstructDrawingAtTime(seekTime);
            }
        });
    }
}

function updateTimelineUI() {
    if (sound && sound.isPlaying()) {
        performanceTimeline.currentTime = sound.currentTime();
        performanceTimeline.totalTime = sound.duration();
        
        const currentTimeDisplay = select('#currentTime');
        const totalTimeDisplay = select('#totalTime');
        const seeker = select('#timelineSeeker');
        
        if (currentTimeDisplay) currentTimeDisplay.html(formatTime(performanceTimeline.currentTime));
        if (totalTimeDisplay) totalTimeDisplay.html(formatTime(performanceTimeline.totalTime));
        if (seeker && performanceTimeline.totalTime > 0) {
            let progress = (performanceTimeline.currentTime / performanceTimeline.totalTime) * 100;
            seeker.value(progress);
        }
    }
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    let mins = Math.floor(seconds / 60);
    let secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function reconstructDrawingAtTime(targetTime) {
    pg.background(0);
    for (let stroke of persistentStrokes) {
        if (stroke.timestamp <= targetTime) {
            pg.fill(stroke.hue, stroke.sat, stroke.bri, 70);
            pg.noStroke();
            switch(stroke.pattern) {
                case 'circles': pg.circle(stroke.x, stroke.y, stroke.size); break;
                case 'stars': pg.circle(stroke.x, stroke.y, stroke.size * 0.8); break;
                default: pg.circle(stroke.x, stroke.y, stroke.size);
            }
        }
    }
}

function updatePerformanceTimeline() {
    if (sound && sound.isPlaying()) {
        performanceTimeline.isActive = true;
        performanceTimeline.currentTime = sound.currentTime();
        performanceTimeline.totalTime = sound.duration();
    } else {
        performanceTimeline.isActive = false;
    }
}

function updateAutoRecording() {
    // Auto-record performance data when music is playing
}

function drawPerformanceTimeline() {
    if (performanceTimeline.isActive && performanceTimeline.totalTime > 0) {
        push();
        fill(0, 0, 100, 20);
        rect(0, height - 5, width, 5);
        fill(frameCount % 360, 80, 100, 80);
        let progressWidth = map(performanceTimeline.currentTime, 0, performanceTimeline.totalTime, 0, width);
        rect(0, height - 5, progressWidth, 5);
        pop();
    }
}

function enhancedCanvasEffects() {
    if (settings.beatFlash && beatPulse > 0.5) {
        push();
        blendMode(SCREEN);
        fill(frameCount % 360, 50, 100, beatPulse * 20);
        rect(0, 0, width, height);
        pop();
    }
}

function autoPatternCycling() {
    if (isAutoPatternEnabled && sound && sound.isPlaying()) {
        if (millis() - lastPatternChange > patternChangeInterval) {
            const patterns = ['circles', 'stars', 'waves', 'grid', 'particles', 'ribbons'];
            const currentIndex = patterns.indexOf(currentPattern);
            const nextIndex = (currentIndex + 1) % patterns.length;
            currentPattern = patterns[nextIndex];
            lastPatternChange = millis();
            updatePatternUI();
        }
    }
}

function updateMusicSignals() {
    if (sound && sound.isPlaying()) {
        musicSignals.beats.push({
            x: musicCharacteristics.rhythm.position.x + random(-20, 20),
            y: musicCharacteristics.rhythm.position.y + random(-20, 20),
            life: 60,
            intensity: musicCharacteristics.rhythm.intensity
        });
        
        if (musicSignals.beats.length > 50) musicSignals.beats.shift();
        
        for (let i = musicSignals.beats.length - 1; i >= 0; i--) {
            musicSignals.beats[i].life--;
            if (musicSignals.beats[i].life <= 0) musicSignals.beats.splice(i, 1);
        }
    }
}

function drawMusicSignals() {
    push();
    blendMode(OVERLAY);
    for (let beat of musicSignals.beats) {
        let alpha = map(beat.life, 0, 60, 0, 100);
        fill(0, 80, 100, alpha * beat.intensity);
        noStroke();
        circle(beat.x, beat.y, beat.intensity * 30);
    }
    pop();
}

function applyTimelineEffects() {
    if (performanceTimeline.isActive) {
        let progress = performanceTimeline.currentTime / performanceTimeline.totalTime;
        tint(map(progress, 0, 1, 0, 360), 20, 100, 95);
    }
}

// Canvas mode switching
function switchCanvasMode() {
    // Implementation for switching between 2D and 3D modes
}

// Texture creation and management
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
}

function createBrushTextures() {
    brushTexture = createGraphics(100, 100);
    brushTexture.background(0, 0, 0, 0);
    brushTexture.noStroke();
}

function updateCanvasTexture() {
    if (settings.textureMode !== 'smooth') {
        pg.tint(255, 150);
        if (canvasTextures[settings.textureMode]) {
            pg.image(canvasTextures[settings.textureMode], 0, 0);
        }
        pg.noTint();
    }
}

// Custom color system
function toggleCustomColorSection() {
    const customSection = select('#custom-color-section');
    if (customSection) {
        customSection.style('display', settings.colorMode === 'custom' ? 'block' : 'none');
    }
}

function getCustomColor() {
    const hex = settings.customColor;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    const hue = (r + g + b) % 360;
    const sat = 80;
    const brightness = settings.colorBrightness;
    
    return { h: hue, s: sat, b: brightness };
}

// Timeline capture functions
function addTimeMarker() {
    if (!sound || !sound.isPlaying()) return;
    
    const currentTime = sound.currentTime();
    timelineCapture.timeMarkers.push({
        time: currentTime,
        canvasState: pg.canvas.toDataURL()
    });
    
    updateTimeMarkerUI();
}

function updateTimeMarkerUI() {
    const markersContainer = select('#timeMarkers');
    if (!markersContainer) return;
    
    markersContainer.html('');
    
    for (let i = 0; i < timelineCapture.timeMarkers.length; i++) {
        const marker = timelineCapture.timeMarkers[i];
        const markerElement = createDiv(`${formatTime(marker.time)} <button onclick="removeTimeMarker(${i})">×</button>`);
        markerElement.class('time-marker');
        markerElement.parent(markersContainer);
    }
}

function createTimelineComposite() {
    if (timelineCapture.timeMarkers.length === 0) return;
    
    // Save current canvas state as composite
    saveCanvas('TimelineComposite_' + timestamp(), 'png');
}

function captureTimelineState() {
    if (frameCount % 60 === 0) { // Every second
        const currentTime = sound.currentTime();
        timelineCapture.canvasStates.push({
            time: currentTime,
            state: pg.canvas.toDataURL()
        });
        
        if (timelineCapture.canvasStates.length > 300) {
            timelineCapture.canvasStates.shift();
        }
    }
}

function toggleRecording() {
    isRecording = !isRecording;
    const recordBtn = select('#recordBtn');
    
    if (recordBtn) {
        if (isRecording) {
            recordBtn.html('⏹️ Stop Recording');
            recordBtn.style('background', 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)');
            performanceData = [];
        } else {
            recordBtn.html('🔴 Record Performance');
            recordBtn.style('background', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
            
            if (performanceData.length > 0) {
                saveJSON(performanceData, 'Performance_' + timestamp() + '.json');
            }
        }
    }
}

function timestamp() {
    const now = new Date();
    return now.getFullYear() + 
           (now.getMonth() + 1).toString().padStart(2, '0') + 
           now.getDate().toString().padStart(2, '0') + '_' + 
           now.getHours().toString().padStart(2, '0') + 
           now.getMinutes().toString().padStart(2, '0') + 
           now.getSeconds().toString().padStart(2, '0');
}
