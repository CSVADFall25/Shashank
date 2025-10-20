// Canvas and graphics
let W = 980, H = 640;
let cnv, pg, backgroundTexture;
let is3D = false;

// Beat-locked drawing constraint state
const STATE = {
    beatLocked: true,
    beatDivide: 1,
    prevIsBeat: false,
    risingEdge: false,
    beatCount: 0,
    beatWindowFrames: 0, // small quantization window
    beatWindowMax: 2,
    // optional metronome:
    metroEnabled: true,
    metroBpm: 120,
    _metroLast: 0
};

// Audio system
let sound, fft, amp;
let beatHistory = [], beatPulse = 0;
let bassHistory = [], midHistory = [], highHistory = [];
let spectralCentroid = 0, spectralRolloff = 0;
let spectrum = [], waveform = [];
let pendingStamp = null;

// Drawing system
let currentPattern = 'circles';
let hueOffset = 0;
let lastDrawPos = { x: 0, y: 0 };
let drawingTrail = [];
let particles = [];
let brushTexture;
let persistentStrokes = []; // Store all drawing strokes permanently
let hue = 0, sat = 100, bri = 100; // Global color variables

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
let buttonStates = { lastAPress: 0 }; // Track button states to prevent continuous triggering

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
    movementFactor: 'bass',
    pickedColor: { h: 0, s: 100, b: 100 }
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

// Color picker system
let colorPicker = {
    canvas: null,
    ctx: null,
    isActive: false,
    selectedHue: 0,
    selectedSat: 100,
    selectedBright: 100,
    cursorX: 75,
    cursorY: 75,
    controllerMode: false
};

// Controller color picker navigation
let colorPickerController = {
    hue: 0,
    sat: 100,
    bright: 100,
    speed: 2
};

function setup() {
    console.log('Setup starting...');
    
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
    } else {
        console.log('Canvas container found!');
    }
    
    cnv = createCanvas(W, H);
    cnv.parent('sketch-holder');
    cnv.style('display', 'block');
    cnv.style('border', '2px solid #ddd');
    cnv.style('border-radius', '8px');
    cnv.style('background', '#000');
    
    console.log('Canvas created:', W, 'x', H);
    
    pg = createGraphics(W, H);
    colorMode(HSB, 360, 100, 100, 100);
    pg.colorMode(HSB, 360, 100, 100, 100);
    pg.background(0);

    // Audio setup 
    fft = new p5.FFT(0.9, 512);
    amp = new p5.Amplitude();

    console.log('Setting up UI...');
    setupUI();
    console.log('Setting up gamepad...');
    setupGamepad();
    createBackgroundTextures();
    createBrushTextures();
    setupTimelineNavigation();
    setupColorPicker(); // Initialize color picker
    
    // Initialize auto draw position
    autoDrawPosition.x = width / 2;
    autoDrawPosition.y = height / 2;
    
    // Add beat UI
    setTimeout(() => {
        console.log('Adding beat UI...');
        ensureBeatUI();
    }, 100);
    
    console.log('Setup complete!');
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
        toggleColorPickerSection();
    });
    
    // Custom color controls
    select('#customColor')?.input(() => {
        settings.customColor = select('#customColor').value();
    });
    
    // Beat-locked drawing controls
    ensureBeatUI();
    
    select('#beatLocked')?.changed(() => {
        STATE.beatLocked = select('#beatLocked').checked();
        console.log('Beat-locked drawing:', STATE.beatLocked ? 'ON' : 'OFF');
    });
    
    select('#beatDivide')?.changed(() => {
        STATE.beatDivide = parseInt(select('#beatDivide').value());
        console.log('Beat divide:', STATE.beatDivide);
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
    
    // Color picker setup
    const useColorBtn = select('#usePickedColor');
    if (useColorBtn) {
        useColorBtn.mousePressed(usePickedColor);
    }
    
    // Setup timeline navigation
    setupTimelineNavigation();
    
    // Initialize custom color section visibility
    toggleCustomColorSection();
    
    // Initialize color picker
    setTimeout(setupColorPicker, 500); // Delay to ensure DOM is ready
}

// Create beat-locked drawing UI elements if they don't exist
function ensureBeatUI() {
    // Check if beat-locked UI already exists
    if (select('#beatLocked')) return;
    
    // Find the left sidebar to add controls
    let leftSidebar = select('.left-sidebar') || select('.sidebar') || select('#leftSidebar');
    if (!leftSidebar) {
        console.warn('Left sidebar not found, cannot add beat UI');
        return;
    }
    
    // Create beat controls section
    let beatSection = createDiv();
    beatSection.parent(leftSidebar);
    beatSection.class('control-group');
    
    // Beat-locked toggle
    let beatLabel = createDiv('Beat-Locked Drawing');
    beatLabel.parent(beatSection);
    beatLabel.class('control-label');
    
    let beatToggle = createCheckbox('', STATE.beatLocked);
    beatToggle.parent(beatSection);
    beatToggle.id('beatLocked');
    beatToggle.class('control-input');
    
    // Beat division selector
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
    
    // Event handlers
    beatToggle.changed(() => {
        STATE.beatLocked = beatToggle.checked();
    });
    
    divideSelect.changed(() => {
        STATE.beatDivide = parseInt(divideSelect.value());
    });
}

// Update draw function to handle beat-locked mode
function draw() {
    background(0);
    
    // Draw a simple test to verify canvas is working
    fill(255, 0, 0);
    circle(100, 100, 50);
    
    cleanAnalyzeAudio();
    updatePerformanceTimeline();
    updateAutoRecording();
    updateMusicSignals();
    updateAutoMovement();
    updateGamepadInput();
    updateColorPickerWithController(); // Handle controller input for color picker
    autoPatternCycling();
    checkAutoPatternReEnable(); // Check if we should re-enable auto pattern cycling

    // Process any pending drawing actions on beat
    processPendingDraw();
    
    // Display beat status when beat-locked
    if (STATE.beatLocked) {
        drawBeatHUD();
    }
    
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
    drawPatternIndicator(); // Show current pattern
    
    // Update timeline UI
    if (frameCount % 30 === 0) { // Update every half second
        updateTimelineUI();
    }
    
    // Enhanced canvas texture effects
    enhancedCanvasEffects();
    
    // Draw beat status HUD at the end
    drawBeatHUD();
}

// Check if drawing is allowed based on beat-locked mode
function canDraw() {
    if (!STATE.beatLocked) return true;
    
    // Allow drawing during beat window
    return STATE.beatWindowFrames > 0;
}

// Check if we should show "Waiting for beat..." message
function isWaitingForBeat() {
    return STATE.beatLocked && STATE.beatWindowFrames === 0;
}

// Process pending drawing actions when beat occurs
function processPendingDraw() {
    if (pendingStamp && STATE.risingEdge) {
        // Execute the pending drawing action
        executePendingStamp();
        pendingStamp = null;
    }
}

function executePendingStamp() {
    if (!pendingStamp) return;
    
    push();
    translate(pendingStamp.x, pendingStamp.y);
    stroke(pendingStamp.color);
    strokeWeight(pendingStamp.weight);
    fill(pendingStamp.color);
    
    switch(pendingStamp.type) {
        case 'circle':
            circle(0, 0, pendingStamp.size);
            break;
        case 'square':
            rectMode(CENTER);
            square(0, 0, pendingStamp.size);
            break;
        case 'triangle':
            let s = pendingStamp.size;
            triangle(-s/2, s/3, s/2, s/3, 0, -2*s/3);
            break;
        case 'line':
            line(-pendingStamp.size/2, 0, pendingStamp.size/2, 0);
            break;
    }
    pop();
}

// Enhanced paintStroke function with beat-locking
function paintStroke(x, y, size = 10) {
    // Check beat-locked drawing constraints
    if (!isBeatFrame()) return;
    
    if (fft) {
        spectrum = fft.analyze();
        waveform = fft.waveform();
    }
    
    // Store pending drawing action
    pendingStamp = { x, y, size, color: [hue, sat, bri], weight: size, type: currentPattern };
    
    // Draw based on current pattern
    switch(currentPattern) {
        case 'circles': 
            drawCircles(x, y, size, fft ? fft.getEnergy('bass') : 50); 
            break;
        case 'stars': 
            drawStars(x, y, size, fft ? fft.getEnergy('mid') : 50); 
            break;
        case 'waves': 
            drawWaves(x, y, size, fft ? fft.getEnergy('treble') : 50); 
            break;
        default:
            drawCircles(x, y, size, 50);
            break;
    }
}

// Placeholder for old analyzeAudio - using cleanAnalyzeAudio instead
function extractMusicCharacteristics(spectrum, bass, mid, treble, level) {
    // TUNE: dominant frequency (top of hexagon in reference image)
    let dominantFreq = 0, maxMagnitude = 0;
    for (let i = 0; i < spectrum.length; i++) {
        if (spectrum[i] > maxMagnitude) {
            maxMagnitude = spectrum[i];
            dominantFreq = i;
        }
    }
    bass /= bassRange;
    mid /= (midRange - bassRange);
    treble /= (spectrum.length - midRange);
    
    musicCharacteristics.tune.frequency = map(dominantFreq, 0, spectrum.length, 0, 1);
    musicCharacteristics.tune.strength = map(maxMagnitude, 0, 255, 0, 1);
    musicCharacteristics.tune.position.x = map(musicCharacteristics.tune.frequency, 0, 1, width * 0.3, width * 0.7);
    musicCharacteristics.tune.position.y = map(musicCharacteristics.tune.strength, 0, 1, height * 0.1, height * 0.25);
    // Update STATE for beat-locked drawing
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
    for (let i = int(spectrum.length * 0.3); i < spectrum.length; i++) {
        noteActivity += spectrum[i];
    }
    musicCharacteristics.notes.density = map(noteActivity, 0, spectrum.length * 0.7 * 255, 0, 1);
    musicCharacteristics.notes.pitch = (treble + mid * 0.5) / 255;
    musicCharacteristics.notes.position.x = map(musicCharacteristics.notes.density, 0, 1, width * 0.35, width * 0.65);
    musicCharacteristics.notes.position.y = map(musicCharacteristics.notes.pitch, 0, 1, height * 0.35, height * 0.65);
    musicCharacteristics.tune.strength = map(maxMagnitude, 0, 255, 0, 1);
    // COLOUR: warmth and brightness (affects brush color)
    musicCharacteristics.colour.warmth = constrain(bass / (treble + 1), 0, 1);
    musicCharacteristics.colour.brightness = constrain((treble + mid) / 255, 0, 1);
}   // RHYTHM: tempo and intensity (right side of hexagon)
    let rhythmicEnergy = (bass + mid) * 0.5;
function detectBeats(bass, mid, treble) {
    let currentEnergy = bass + mid + treble;
    beatHistory.push(currentEnergy);
    if (beatHistory.length > 5) beatHistory.shift();
    // SHAPE: harmonic complexity (left side of hexagon)
    if (beatHistory.length >= 5) {
        let avgEnergy = beatHistory.reduce((a, b) => a + b) / beatHistory.length;
        if (currentEnergy > avgEnergy * 1.3) {
            beatPulse = 1;
        } else {
            beatPulse *= 0.95;
        }
    }
}   
    musicCharacteristics.shape.complexity = map(harmonicComplexity, 0, bandCount, 0, 1);
function drawPattern(x, y, pressure = 1) {
    // Apply music characteristics to color
    hue = (hue + musicCharacteristics.colour.warmth * 60) % 360;
    bri = bri * (0.5 + musicCharacteristics.colour.brightness * 0.5);
    const energy = {
        bass: fft.getEnergy('bass'),
        mid: fft.getEnergy('mid'),
        high: fft.getEnergy('treble')
    };
    
    // Store persistent stroke data
    const strokeData = {
        x, y, size, hue, sat, bri,
        pattern: currentPattern,
        timestamp: sound?.isPlaying() ? performanceTimeline.currentTime : 0,
        energy: {...energy}
    };
    
    // Draw the pattern based on current selection
    // Add safety check for valid pattern
    const validPatterns = ['circles', 'stars', 'waves', 'grid', 'particles', 'ribbons'];
    if (!validPatterns.includes(currentPattern)) {
        console.warn('Invalid pattern detected in drawPattern:', currentPattern, 'resetting to circles');
        currentPattern = 'circles';
    }
    switch(currentPattern) {
        case 'circles': drawCircles(x, y, s, fft.getEnergy('bass')); break;
        case 'stars': drawStars(x, y, s, fft.getEnergy('mid')); break;
        case 'waves': drawWaves(x, y, s, fft.getEnergy('treble')); break;
    // Beat detection and edge detection
    let beatThreshold = 40;
    let currentIsBeat = bass > beatThreshold;
    // Update STATE for beat-locked drawing
    STATE.risingEdge = !STATE.prevIsBeat && currentIsBeat;
    STATE.prevIsBeat = currentIsBeat;
    if (STATE.risingEdge) {
        STATE.beatCount++;
        STATE.beatWindowFrames = STATE.beatWindowMax;
    } else {
        STATE.beatWindowFrames = max(0, STATE.beatWindowFrames - 1);
    }
    // Metronome fallback for beat detection when no audio
    if (STATE.metroEnabled && !song.isPlaying()) {
        let now = millis();
        let metroInterval = 60000 / STATE.metroBpm / STATE.beatDivide;
        if (now - STATE._metroLast >= metroInterval) {
            STATE._metroLast = now;
        }
    }
}

// Beat-locked drawing gate function
function isBeatFrame() {
    if (!STATE.beatLocked) return true;
    
    // Check if we're on a beat with the correct division
    if (STATE.risingEdge && (STATE.beatCount % STATE.beatDivide === 0)) {
        return true;
    }
    
    // Within quantization window after beat edge
    if (STATE.beatWindowFrames > 0) {
        STATE.beatWindowFrames--;
        return true;
    }
    
    return false;
}

// Clean analyzeAudio function with beat detection
function cleanAnalyzeAudio() {
    if (!sound || !fft) return;
    
    let spectrum = fft.analyze();
    let bass = 0, mid = 0, treble = 0;
    let bassRange = int(spectrum.length * 0.1);
    let midRange = int(spectrum.length * 0.5);
    
    // Calculate frequency ranges
    for (let i = 0; i < bassRange; i++) bass += spectrum[i];
    for (let i = bassRange; i < midRange; i++) mid += spectrum[i];
    for (let i = midRange; i < spectrum.length; i++) treble += spectrum[i];
    // Draw the pattern based on current selection
    bass /= bassRange;
    mid /= (midRange - bassRange);
    treble /= (spectrum.length - midRange);
    
    // Beat detection
    let beatThreshold = 40;
    let currentIsBeat = bass > beatThreshold;
    
    // Update STATE for beat-locked drawing
    STATE.risingEdge = !STATE.prevIsBeat && currentIsBeat;
    STATE.prevIsBeat = currentIsBeat;
    
    if (STATE.risingEdge) {
        STATE.beatCount++;
        STATE.beatWindowFrames = STATE.beatWindowMax;
    }
    
    // Metronome fallback when no audio
    if (STATE.metroEnabled && (!sound || !sound.isPlaying())) {
        let now = millis();
        let metroInterval = 60000 / STATE.metroBpm / STATE.beatDivide;
        if (now - STATE._metroLast >= metroInterval) {
            STATE._metroLast = now;
            STATE.risingEdge = true;
            STATE.beatCount++;
            STATE.beatWindowFrames = STATE.beatWindowMax;
        }
    }
}

// Missing functions for UI functionality
function switchCanvasMode() {
    const mode = settings.canvasMode;
    if (mode === '3D') {
        is3D = true;
    } else {
        is3D = false;
    }
}

function updateCanvasTexture() {
    // Update texture based on settings
}

function toggleCustomColorSection() {
    // Toggle custom color section visibility
}

function toggleColorPickerSection() {
    // Toggle color picker section visibility
}

// Stub functions to make the application work
function updatePerformanceTimeline() {}
function updateAutoRecording() {}
function updateMusicSignals() {}
function updateAutoMovement() {}
function updateGamepadInput() {}
function updateColorPickerWithController() {}
function autoPatternCycling() {}
function checkAutoPatternReEnable() {}
function processPendingDraw() {
    if (pendingStamp && STATE.risingEdge) {
        pendingStamp = null;
    }
}
function drawMusicSignals() {}
function applyTimelineEffects() {}

function drawPattern(x, y, pressure = 1) {
    // Check beat-locked drawing constraints
    if (!isBeatFrame()) return;
    
    paintStroke(x, y, settings.brushSize || 20);
}

function updateAllParticles() {}
function drawCursor() {}
function drawAutoMovementIndicator() {}
function drawAudioMeters() {}
function drawPerformanceTimeline() {}
function drawPatternIndicator() {}
function updateTimelineUI() {}
function enhancedCanvasEffects() {}

function createBackgroundTextures() {}
function createBrushTextures() {}
function setupTimelineNavigation() {}
function setupColorPicker() {}
function setupGamepad() {}

// Additional essential functions for beat-locked drawing
function userStartAudio() {
    if (getAudioContext().state !== 'running') {
        getAudioContext().resume();
    }
}

// Ensure beat-locked UI is accessible through the sidebar selector
function getLeftSidebar() {
    return select('.left-sidebar') || select('.sidebar') || select('#leftSidebar');
}

// Debugging HUD for beat-locked drawing
function drawBeatHUD() {
    if (!STATE.beatLocked) return;
    
    // Only show when waiting for a beat
    if (!isBeatFrame()) {
        push();
        fill(255, 255, 255, 100);
        textAlign(CENTER, CENTER);
        textSize(16);
        text("Waiting for beat...", width/2, 30);
        pop();
    }
    
    // Show beat status for debugging
    push();
    fill(255, 255, 255, 80);
    textAlign(LEFT, TOP);
    textSize(12);
    text(`Beat Locked: ${STATE.beatLocked}`, 10, 10);
    text(`Beat Count: ${STATE.beatCount}`, 10, 25);
    text(`Beat Division: ${STATE.beatDivide}`, 10, 40);
    text(`Window Frames: ${STATE.beatWindowFrames}`, 10, 55);
    pop();
}