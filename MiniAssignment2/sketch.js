// MiniAssignment2
// AnalogousColor 
//Following changes made:
// 1. controls:  mouseX=hue, mouseY=sat, UP/DOWN=brightness
// 2. modes: W=warm, C=cool, P=pastel, N=normal
// 3. grouping: [ / ] to change analogous gap

let outerRadius = 200;
let innerRadius = 100; // hole size
let steps = 360/15; // resolution

// added:
let mode = 'normal';     // normal | warm | cool | pastel
let sat = 100;           // controlled by mouseY
let bri = 100;           // arrows adjust
let gap = 30;            // analogous step (use [ and ] to change)

function setup() {
  createCanvas(800, 800);
  colorMode(HSB, 360, 100, 100);
  noStroke();
}

function draw() {
  background(100);
  drawRing();

  // base hue (range depends on mode)
  let hStart = 0, hEnd = 360;
  if (mode === 'warm') { hStart = 330; hEnd = 420; }     // wraps through reds/oranges
  if (mode === 'cool') { hStart = 120; hEnd = 260; }     // greens->blues
  // map X into that hue band, then wrap
  let baseHue = map(mouseX, 0, width, hStart, hEnd);
  baseHue = ((baseHue % 360) + 360) % 360;

  // selection changes: mouseY -> saturation
  sat = map(mouseY, 0, height, 100, 40); // less sat as you go down
  sat = constrain(sat, 0, 100);

  // pastel mode nudges sat/bright
  let localSat = sat;
  let localBri = bri;
  if (mode === 'pastel') {
    localSat = min(localSat, 55);
    localBri = max(localBri, 85);
  }

  let squareWidth = 200;

  // group changed: gap is adjustable (default 30)
  // Square 1
  fill((baseHue + 0*gap) % 360, localSat, localBri);
  rect(0, 0, squareWidth, height/4);
  drawColorPosition(baseHue + 0*gap);

  // Square 2
  fill((baseHue + 1*gap) % 360, localSat, localBri);
  rect(squareWidth, 0, squareWidth, height/4);
  drawColorPosition(baseHue + 1*gap);

  // Square 3
  fill((baseHue + 2*gap) % 360, localSat, localBri);
  rect(squareWidth * 2, 0, squareWidth, height/4);
  drawColorPosition(baseHue + 2*gap);

  // Square 4
  fill((baseHue + 3*gap) % 360, localSat, localBri);
  rect(squareWidth * 3, 0, squareWidth, height/4);
  drawColorPosition(baseHue + 3*gap);

  // tiny hint
  fill(0, 0, 100);
  text('W/C/P/N modes • [ / ] gap=' + gap + '° • mouseY=sat • ↑/↓ brightness=' + nf(localBri,1,0), 12, height-12);
}

function keyPressed(){
  if (key==='W'||key==='w') mode='warm';
  if (key==='C'||key==='c') mode='cool';
  if (key==='P'||key==='p') mode='pastel';
  if (key==='N'||key==='n') mode='normal';
  if (key==='[') gap = max(10, gap-5);
  if (key===']') gap = min(90, gap+5);
  if (keyCode === UP_ARROW)   bri = constrain(bri+5, 0, 100);
  if (keyCode === DOWN_ARROW) bri = constrain(bri-5, 0, 100);
}

function drawColorPosition(hue){
  push();
  translate(width / 2, height / 2); 
  let x1 = cos(radians(hue)) * (innerRadius+(outerRadius-innerRadius)/2);
  let y1 = sin(radians(hue)) * (innerRadius+(outerRadius-innerRadius)/2);
  fill(0, 0, 100);
  ellipse(x1, y1, 20,20);
  pop();
}

function drawRing(){
  push();
  translate(width / 2, height / 2);
  for (let angle = 0; angle < 360; angle+=steps) {
    let nextAngle = angle + steps;

    // Outer edge points
    let x1 = cos(radians(angle)) * outerRadius;
    let y1 = sin(radians(angle)) * outerRadius;
    let x2 = cos(radians(nextAngle)) * outerRadius;
    let y2 = sin(radians(nextAngle)) * outerRadius;

    // Inner edge points
    let x3 = cos(radians(nextAngle)) * innerRadius;
    let y3 = sin(radians(nextAngle)) * innerRadius;
    let x4 = cos(radians(angle)) * innerRadius;
    let y4 = sin(radians(angle)) * innerRadius;

    fill(angle, 100, 100);
    quad(x1, y1, x2, y2, x3, y3, x4, y4);
  }
  pop();
}
