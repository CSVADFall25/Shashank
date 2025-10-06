// Hello World Portrait
// created by Jennifer Jacobs September 26 2019. Inspired by Casey Reas' and Ben Fry's draw a face assignment.
// Converted to p5.js


function setup() {
  createCanvas(600, 600);
  background(220, 240, 255);

  // Head (big circle)
  fill(255, 220, 180);
  stroke(0); strokeWeight(3);
  circle(300, 300, 300);

  // Hair (black triangles)
  fill(0);
  stroke(0); strokeWeight(1);
  triangle(200, 150, 230, 80, 260, 150);
  triangle(260, 150, 290, 70, 320, 150);
  triangle(340, 150, 370, 80, 400, 150);

  // Eyes (white ellipses)
  fill(255);
  stroke(0); strokeWeight(2);
  ellipse(250, 270, 80, 50);
  ellipse(350, 270, 80, 50);

  // Pupils (black circles)
  fill(0);
  circle(250, 270, 20);
  circle(350, 270, 20);

  // Angry eyebrows (black rectangles angled "angry" by placement)
  fill(0);
  rect(210, 230, 80, 10);
  rect(310, 230, 80, 10);

  // Nose (triangle)
  fill(240, 200, 160);
  stroke(100);
  triangle(300, 280, 290, 330, 310, 330);

  // Mouth (red rectangle)
  fill(200, 0, 0);
  stroke(80); strokeWeight(2);
  rect(240, 380, 120, 50);

  // Tongue (pink rectangle inside mouth)
  fill(255, 100, 150);
  stroke(150, 50, 80); strokeWeight(1);
  rect(270, 400, 60, 30);

  // Ears (side circles)
  fill(255, 220, 180);
  stroke(0);
  circle(150, 300, 60);
  circle(450, 300, 60);
}


