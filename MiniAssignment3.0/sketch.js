// Mirrored Cube — Brightness Forming + Duotone Filter 
// Make the real frame feeding into the camera through varied brightness

let video;
const W = 480, H = 480;

let cubeCount = 12;
let useTransforms = true;  // per-tile rotate/flip like original mirrored-cube
const MIRROR = true;       // selfie-style horizontal mirror

// --- Contour styling (you can tweak these) ---
const CONTOUR_LAYERS = 5;   // number of rings (inner ones are "deeper")
const CONTOUR_STEP   = 14;  // brightness step per deeper layer
const CONTOUR_ALPHA  = 220; // base alpha before Mix scaling (0..255)
const MIN_STROKE     = 1.5; // outermost line width
const MAX_STROKE     = 5.0; // innermost line width

// UI elements (from HTML)
let ui = {};

function setup() {
  const c = createCanvas(W, H);
  c.parent("sketch-holder");
  pixelDensity(1);
  rectMode(CENTER);
  noCursor();

  // Webcam
  video = createCapture({ video: { width: W, height: H }, audio: false }, () => {
    console.log("capture ready");
  });
  video.elt.setAttribute("playsinline", "");
  video.size(W, H);
  video.hide();

  // Hook UI
  ui.cubeCountSlider = select("#cubeCountSlider");
  ui.transformToggle = select("#transformToggle");
  ui.formStrength    = select("#formStrength");
  ui.inColor         = select("#inColor");
  ui.outColor        = select("#outColor");
  ui.duoStrength     = select("#duoStrength");
  ui.duoThresh       = select("#duoThresh");
  ui.filterMix       = select("#filterMix");
  ui.contourToggle   = select("#contourToggle");
  ui.saveBtn         = select("#saveBtn");

  ui.cubeCountSlider.input(() => cubeCount = int(ui.cubeCountSlider.elt.value));
  ui.transformToggle.changed(() => useTransforms = ui.transformToggle.elt.checked);
  ui.saveBtn.mousePressed(() => saveCanvas("MirroredCube", "png"));
  window.addEventListener("keydown", (e) => {
    if (e.key === "s" || e.key === "S") saveCanvas("MirroredCube", "png");
    if (e.key === "t" || e.key === "T") {
      useTransforms = !useTransforms;
      ui.transformToggle.elt.checked = useTransforms;
    }
  });
}

function draw() {
  background(20);

  if (!video || video.width === 0 || video.height === 0) {
    drawWaiting();
    return;
  }

  const cellSize = width / cubeCount;

  // Grab webcam pixels once
  video.loadPixels();
  if (video.pixels.length === 0) return;

  // 1) Average brightness per cell (0..255)
  const cellB = avgBrightnessGrid(video, cubeCount);

  // 2) Binary mask for "inside" vs "outside" based on threshold
  const thresh = int(ui.duoThresh.elt.value);
  const mask = buildMask(cellB, thresh);

  // 3) Draw tiles
  const formStrength = ui.formStrength.elt.value / 100;  // 0..1
  const duoStrength  = ui.duoStrength.elt.value / 100;   // 0..1
  const mix          = ui.filterMix.elt.value / 100;     // 0..1 (master blend)
  const inRGB        = hexToRgb(ui.inColor.elt.value);
  const outRGB       = hexToRgb(ui.outColor.elt.value);

  for (let gy = 0; gy < cubeCount; gy++) {
    for (let gx = 0; gx < cubeCount; gx++) {
      const cx = gx * cellSize + cellSize / 2;
      const cy = gy * cellSize + cellSize / 2;

      push();
      translate(cx, cy);

      // A) Clear webcam detail per tile (with optional transforms)
      if (useTransforms) {
        const mode = (gx + gy) % 4;
        if (mode === 1) scale(-1, 1);
        else if (mode === 2) scale(1, -1);
        else if (mode === 3) rotate(HALF_PI);
      }
      image(video, -cellSize / 2, -cellSize / 2, cellSize, cellSize);

      // B) Brightness forming (push each tile toward average brightness)
      if (formStrength > 0) {
        const b = cellB[gy][gx];
        const mid = 128;
        const delta = b - mid;
        const a = constrain(map(Math.abs(delta), 0, 128, 0, 180) * formStrength, 0, 180);
        if (delta < 0) {
          blendMode(MULTIPLY);
          noStroke(); fill(0, a);
          rect(0, 0, cellSize, cellSize);
        } else if (delta > 0) {
          blendMode(SCREEN);
          noStroke(); fill(255, a);
          rect(0, 0, cellSize, cellSize);
        }
        blendMode(BLEND);
      }

      // C) Two-color filter (duotone) with master Filter Mix
      if (duoStrength > 0 && mix > 0) {
        const inside = mask[gy][gx];
        const rgb = inside ? inRGB : outRGB;
        blendMode(MULTIPLY);
        noStroke();
        const a = 180 * duoStrength * mix;  // filtered alpha scales with mix
        fill(rgb[0], rgb[1], rgb[2], a);
        rect(0, 0, cellSize, cellSize);
        blendMode(BLEND);
      }

      // D) Cube edges (visual)
      noFill();
      stroke(200, 220);
      strokeWeight(2);
      rect(0, 0, cellSize, cellSize);
      stroke(255, 60);
      line(-cellSize/2, 0, cellSize/2, 0);
      line(0, -cellSize/2, 0, cellSize/2);

      pop();
    }
  }

  // 4) Stylized multi-layer contours at the flip boundary (respects Mix)
  if (ui.contourToggle.elt.checked && mix > 0) {
    drawContourLayers(cellB, cellSize, thresh, CONTOUR_LAYERS, CONTOUR_STEP, mix);
  }

  // 5) Light grid lines
  drawGridLines(cellSize);

  // HUD
  drawHud();
}

function drawWaiting() {
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(16);
  text("Waiting for webcam…", width/2, height/2);
}

function drawGridLines(cellSize) {
  stroke(255, 40);
  strokeWeight(1);
  for (let i = 1; i < cubeCount; i++) line(i * cellSize, 0, i * cellSize, height);
  for (let j = 1; j < cubeCount; j++) line(0, j * cellSize, width, j * cellSize);
}

function drawHud() {
  noStroke(); fill(255); textSize(12); textAlign(LEFT, TOP);
  const s = `Cells: ${cubeCount}  |  Form: ${ui.formStrength.elt.value}%  |  Duo: ${ui.duoStrength.elt.value}%  |  Thresh: ${ui.duoThresh.elt.value}  |  Mix: ${ui.filterMix.elt.value}%  |  Transforms: ${useTransforms ? 'ON' : 'OFF'} (T)`;
  text(s, 8, 8);
}

// ----- Analysis helpers -----

// Average brightness per cell (0..255)
function avgBrightnessGrid(src, grid) {
  const out = new Array(grid);
  const srcW = src.width, srcH = src.height;

  // stride so each cell samples ~64 px (speed vs. quality)
  const targetSamples = 64;
  const strideX = Math.max(1, Math.floor((srcW / grid) / Math.sqrt(targetSamples)));
  const strideY = Math.max(1, Math.floor((srcH / grid) / Math.sqrt(targetSamples)));

  for (let gy = 0; gy < grid; gy++) {
    out[gy] = new Array(grid);
    const y0 = Math.floor(gy * (srcH / grid));
    const y1 = Math.floor((gy + 1) * (srcH / grid));
    for (let gx = 0; gx < grid; gx++) {
      const x0 = Math.floor(gx * (srcW / grid));
      const x1 = Math.floor((gx + 1) * (srcH / grid));

      let sum = 0, count = 0;
      for (let y = y0; y < y1; y += strideY) {
        const row = y * srcW;
        for (let x = x0; x < x1; x += strideX) {
          const sx = MIRROR ? (srcW - 1 - x) : x;
          const idx = ((row + sx) << 2);
          const r = video.pixels[idx], g = video.pixels[idx+1], b = video.pixels[idx+2];
          sum += (r + g + b) / 3;
          count++;
        }
      }
      out[gy][gx] = count ? (sum / count) : 0;
    }
  }
  return out;
}

// Binary mask from threshold
function buildMask(cellB, thresh) {
  const h = cellB.length, w = cellB[0].length;
  const m = new Array(h);
  for (let y = 0; y < h; y++) {
    m[y] = new Array(w);
    for (let x = 0; x < w; x++) m[y][x] = (cellB[y][x] >= thresh);
  }
  return m;
}

// --- Stylized multi-layer contours using marching squares on the brightness field ---
function drawContourLayers(field, cellSize, threshold, layers, step, mix) {
  // We'll generate contours at thresholds: t0=threshold, t1=threshold-step, ...
  // Each deeper layer gets thicker stroke and warmer color.
  push();
  strokeCap(ROUND);
  strokeJoin(ROUND);

  for (let k = 0; k < layers; k++) {
    const t = threshold - k * step;
    const segs = marchingSquaresSegments(field, t); // list of [ [x1,y1], [x2,y2] ] in grid coords

    // Layer color: cool (outer) → warm (inner)
    colorMode(HSB, 360, 100, 100, 255);
    const hue = map(k, 0, layers-1, 210, 20);  // blue → red
    const sat = 80;
    const bri = 95;
    const alpha = CONTOUR_ALPHA * mix;
    stroke(color(hue, sat, bri, alpha));
    strokeWeight(lerp(MIN_STROKE, MAX_STROKE, k/(layers-1)));

    // Draw all segments in canvas coords with sub-cell interpolation
    for (let s = 0; s < segs.length; s++) {
      const a = segs[s][0];
      const b = segs[s][1];
      line(a[0]*cellSize, a[1]*cellSize, b[0]*cellSize, b[1]*cellSize);
    }
  }
  pop();
}

// --- Marching Squares (segments only) on scalar field (tile brightness) ---
// field: 2D array [gy][gx] with scalar values (0..255)
// threshold: iso-value
// returns array of segments [ [x1,y1], [x2,y2] ] in GRID space (not pixels)
function marchingSquaresSegments(field, threshold) {
  const h = field.length;
  const w = field[0].length;
  const segs = [];

  // helper: interpolate position along an edge between two grid points
  function interp(ax, ay, av, bx, by, bv) {
    const denom = (bv - av);
    const t = (Math.abs(denom) < 1e-6) ? 0.5 : (threshold - av) / denom;
    const x = ax + t * (bx - ax);
    const y = ay + t * (by - ay);
    return [x, y];
  }

  // For each cell square between (x,y) and (x+1,y+1)
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      // Corners values
      const vTL = field[y][x];
      const vTR = field[y][x+1];
      const vBR = field[y+1][x+1];
      const vBL = field[y+1][x];

      // Inside if value >= threshold (match your mask convention)
      const bTL = vTL >= threshold ? 1 : 0;
      const bTR = vTR >= threshold ? 1 : 0;
      const bBR = vBR >= threshold ? 1 : 0;
      const bBL = vBL >= threshold ? 1 : 0;

      // Case index (TL, TR, BR, BL)
      const idx = (bTL<<3) | (bTR<<2) | (bBR<<1) | (bBL<<0);
      if (idx === 0 || idx === 15) continue; // no crossings

      // Compute edge crossings (edges in grid coords):
      // top:    (x,y)   -> (x+1,y)
      // right:  (x+1,y) -> (x+1,y+1)
      // bottom: (x,y+1) -> (x+1,y+1)
      // left:   (x,y)   -> (x,y+1)
      let top, right, bottom, left;

      if ((bTL !== bTR))    top    = interp(x, y, vTL, x+1, y, vTR);
      if ((bTR !== bBR))    right  = interp(x+1, y, vTR, x+1, y+1, vBR);
      if ((bBL !== bBR))    bottom = interp(x, y+1, vBL, x+1, y+1, vBR);
      if ((bTL !== bBL))    left   = interp(x, y, vTL, x, y+1, vBL);

      // Based on the 16 MS cases, add up to 2 segments per cell
      // We'll resolve ambig (cases 5 & 10) by connecting top-bottom and left-right based on average
      switch (idx) {
        case 1:  // 0001 (only BL in)
          segs.push([left, bottom]); break;
        case 2:  // 0010 (only BR in)
          segs.push([bottom, right]); break;
        case 3:  // 0011 (BL,BR in)
          segs.push([left, right]); break;
        case 4:  // 0100 (only TR in)
          segs.push([top, right]); break;
        case 5:  // 0101 (TR,BL in) ambiguous
          // heuristic: connect top-left and right-bottom
          segs.push([top, left]); segs.push([right, bottom]); break;
        case 6:  // 0110 (TR,BR in)
          segs.push([top, bottom]); break;
        case 7:  // 0111 (TL out)
          segs.push([top, left]); break;
        case 8:  // 1000 (only TL in)
          segs.push([left, top]); break;
        case 9:  // 1001 (TL,BL in)
          segs.push([bottom, top]); break;
        case 10: // 1010 (TL,BR in) ambiguous
          // heuristic: connect left-bottom and top-right
          segs.push([left, bottom]); segs.push([top, right]); break;
        case 11: // 1011 (TR out)
          segs.push([right, top]); break;
        case 12: // 1100 (TL,TR in)
          segs.push([right, left]); break;
        case 13: // 1101 (BR out)
          segs.push([right, bottom]); break;
        case 14: // 1110 (BL out)
          segs.push([bottom, left]); break;
      }
    }
  }

  // Filter out any undefined points (can happen on flat cells)
  const clean = [];
  for (let i = 0; i < segs.length; i++) {
    const a = segs[i][0], b = segs[i][1];
    if (!a || !b || isNaN(a[0]) || isNaN(a[1]) || isNaN(b[0]) || isNaN(b[1])) continue;
    clean.push([a, b]);
  }
  return clean;
}

// Utility
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [255, 255, 255];
  return [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)];
}
