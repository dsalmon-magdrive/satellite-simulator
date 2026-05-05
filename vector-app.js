    // Vector Satellite Simulator (HTML5 Canvas)
// Left textarea accepts impulses in CSV-like lines: time,angle,magnitude

const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const width = canvas.width;
const height = canvas.height;

// Load satellite image
const satelliteImg = new Image();
satelliteImg.src = 'satellite.png';

// UI elements
const textarea = document.getElementById('impulses');
const massInput = document.getElementById('massInput');
const runBtn = document.getElementById('runBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const helpBtn = document.getElementById('helpBtn');
const closeHelp = document.getElementById('closeHelp');
const helpModal = document.getElementById('helpModal');
const onboardingModal = document.getElementById('onboardingModal');
const gotItBtn = document.getElementById('gotItBtn');
const dontShowAgain = document.getElementById('dontShowAgain');
const simTimeSpan = document.getElementById('simTime');
const velocitySpan = document.getElementById('velocity');
const targetStatusSpan = document.getElementById('targetStatus');
const targetXInput = document.getElementById('targetXInput');
const targetYInput = document.getElementById('targetYInput');
const targetRadiusInput = document.getElementById('targetRadiusInput');
const consoleDiv = document.getElementById('console');

function logToScreen(message) {
    consoleDiv.textContent += message + '\n';
    consoleDiv.scrollTop = consoleDiv.scrollHeight; // Auto-scroll to bottom
}

// Physics settings
let mass = 0.1; // kg
const DT = 0.01; // physics timestep (s)

// Satellite state
class Satellite {
    constructor(mass = 1.0, velocity_magnitude = 0.0, velocity_angle = 0.0) {
        if (mass <= 0) throw new Error("mass must be greater than zero");
        this.mass = mass;
        this.velocity_magnitude = velocity_magnitude;
        this.velocity_angle = velocity_angle;
    }

    velocity_components() {
        const vx = this.velocity_magnitude * Math.cos(this.velocity_angle);
        const vy = this.velocity_magnitude * Math.sin(this.velocity_angle);
        return {vx, vy};
    }

    update_velocity(impulse_magnitude = 0.0, impulse_angle = 0.0) {
        const dvx = (impulse_magnitude / this.mass) * Math.cos(impulse_angle);
        const dvy = (impulse_magnitude / this.mass) * Math.sin(impulse_angle);

        const {vx, vy} = this.velocity_components();
        let new_vx = vx + dvx;
        let new_vy = vy + dvy;

        // Round small values to prevent floating-point precision issues
        new_vx = this._round_small(new_vx);
        new_vy = this._round_small(new_vy);

        this.velocity_magnitude = Math.hypot(new_vx, new_vy);
        this.velocity_angle = this.velocity_magnitude !== 0 ? Math.atan2(new_vy, new_vx) : 0.0;

        return {magnitude: this.velocity_magnitude, angle: this.velocity_angle};
    }

    _round_small(value, threshold = 1e-10) {
        return Math.abs(value) < threshold ? 0.0 : value;
    }
}
let x = width/2, y = height/2;
let sat = new Satellite(mass);

const target = {
    x: width * 0.75,
    y: height * 0.25,
    radius: 30,
    achieved: false,
};

// Impulses
let impulses = []; // array of {t, angle, mag}
let impulseIndex = 0;

let simTime = 0.0;
let running = false;

let lastFrameTime = null;
let accumulator = 0.0;

// Load default example text into textarea
textarea.value = `# time,angle,magnitude
0.5,0,1.0
1.5,180,1.0`;

function parseImpulsesFromText(text) {
    const lines = text.split(/\r?\n/);
    const parsed = [];
    for (let raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith('#')) continue;
        // Allow both CSV and space/tab separated
        const parts = line.split(/,|\s+/).map(s => s.trim()).filter(Boolean);
        if (parts.length < 3) continue;
        try {
            const t = parseFloat(parts[0]);
            const angle = parseFloat(parts[1]);
            const mag = parseFloat(parts[2]);
            parsed.push({t, angle, mag});
        } catch (e) {
            console.warn('Skipping invalid line:', line);
        }
    }
    parsed.sort((a, b) => a.t - b.t);
    return parsed;
}

function resetSimulation() {
    x = width/2;
    y = height/2;
    sat = new Satellite(mass);
    impulseIndex = 0;
    target.achieved = false;
    simTime = 0.0;
    accumulator = 0.0;
    running = false;
    updateStatus();
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function updateTargetFromInputs() {
    const xValue = parseFloat(targetXInput.value);
    const yValue = parseFloat(targetYInput.value);
    const radiusValue = parseFloat(targetRadiusInput.value);

    if (Number.isFinite(xValue)) {
        target.x = clamp(xValue, 0, width);
    }
    if (Number.isFinite(yValue)) {
        target.y = clamp(yValue, 0, height);
    }
    if (Number.isFinite(radiusValue)) {
        target.radius = clamp(radiusValue, 5, Math.min(width, height) / 2);
    }

    targetXInput.value = target.x.toFixed(0);
    targetYInput.value = target.y.toFixed(0);
    targetRadiusInput.value = target.radius.toFixed(0);
}

function updateStatus() {
    simTimeSpan.textContent = simTime.toFixed(2);
    velocitySpan.textContent = sat.velocity_magnitude.toFixed(2);
    const distance = Math.hypot(x - target.x, y - target.y);
    targetStatusSpan.textContent = target.achieved ? 'Target reached!' : `Target distance: ${distance.toFixed(1)} px`;
}

function drawTarget() {
    ctx.save();
    ctx.fillStyle = target.achieved ? 'rgba(0,255,0,0.18)' : 'rgba(255,255,0,0.12)';
    ctx.strokeStyle = target.achieved ? '#0f0' : '#ff0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(target.x, target.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = target.achieved ? '#0f0' : '#ff0';
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.fillText('Target', target.x + target.radius + 8, target.y - 8);
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    drawTarget();

    // Draw satellite
    if (satelliteImg.complete && satelliteImg.naturalHeight !== 0) {
        ctx.drawImage(satelliteImg, x - 40, y - 40, 80, 80);
    } else {
        // Fallback to green square if image not loaded
        ctx.fillStyle = '#0f0';
        ctx.fillRect(x - 7.5, y - 7.5, 15, 15);
    }

    // Draw velocity vector with arrowhead
    const {vx, vy} = sat.velocity_components();
    if (sat.velocity_magnitude > 0) {
        const scale = 10;
        const endX = x + vx * scale;
        const endY = y + vy * scale;
        
        // Draw line
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        // Draw arrowhead
        const angle = Math.atan2(vy, vx);
        const arrowLength = 8;
        const arrowAngle = Math.PI / 6; // 30 degrees
        
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowLength * Math.cos(angle - arrowAngle), endY - arrowLength * Math.sin(angle - arrowAngle));
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowLength * Math.cos(angle + arrowAngle), endY - arrowLength * Math.sin(angle + arrowAngle));
        ctx.stroke();
    }
}

function updatePhysics(dt) {
    // Apply impulses
    while (impulseIndex < impulses.length && simTime >= impulses[impulseIndex].t) {
        const imp = impulses[impulseIndex];
        // Add 90 degrees to convert from "0 degrees = up" to standard math angles
        const angleInRadians = (imp.angle - 90) * Math.PI / 180;
        sat.update_velocity(imp.mag, angleInRadians);
        logToScreen(`Applied impulse at ${imp.t.toFixed(2)}s: angle=${imp.angle}°, mag=${imp.mag}, new velocity: ${sat.velocity_magnitude.toFixed(2)} m/s, new angle: ${(((sat.velocity_angle * 180 / Math.PI + 450)) % 360).toFixed(2)}°`);
        impulseIndex++;
    }

    // Update position
    const {vx, vy} = sat.velocity_components();
    x += vx * dt;
    y += vy * dt;

    // Wrap around edges
    x = ((x % width) + width) % width;
    y = ((y % height) + height) % height;

    checkRendezvous();
}

function checkRendezvous() {
    if (target.achieved) return;

    const distance = Math.hypot(x - target.x, y - target.y);
    if (distance <= target.radius && sat.velocity_magnitude < 0.05) {
        target.achieved = true;
        running = false;
        logToScreen(`Target reached! Distance=${distance.toFixed(2)} px, speed=${sat.velocity_magnitude.toFixed(2)}. Simulation stopped.`);
    }
}

function gameLoop(currentTime) {
    if (!running) return;

    if (lastFrameTime === null) lastFrameTime = currentTime;
    const deltaTime = (currentTime - lastFrameTime) / 1000; // in seconds
    lastFrameTime = currentTime;

    accumulator += deltaTime;
    while (accumulator >= DT) {
        updatePhysics(DT);
        simTime += DT;
        accumulator -= DT;
    }

    updateStatus();
    draw();

    requestAnimationFrame(gameLoop);
}

// Event listeners
runBtn.addEventListener('click', () => {
    updateTargetFromInputs();
    // Auto-load impulses if not already loaded
    impulses = parseImpulsesFromText(textarea.value);
    impulseIndex = 0;
    target.achieved = false;
    logToScreen('Run clicked, loaded impulses: ' + impulses.length + ' impulses');
    if (!running) {
        running = true;
        lastFrameTime = null;
        requestAnimationFrame(gameLoop);
    }
});

stopBtn.addEventListener('click', () => {
    running = false;
    logToScreen('Simulation stopped');
});

resetBtn.addEventListener('click', () => {
    resetSimulation();
    consoleDiv.textContent = ''; // Clear console
    logToScreen('Simulation reset');
});

helpBtn.addEventListener('click', () => {
    helpModal.style.display = 'block';
});

closeHelp.addEventListener('click', () => {
    helpModal.style.display = 'none';
});

// Onboarding modal logic
if (!localStorage.getItem('onboardingDismissed')) {
    onboardingModal.style.display = 'block';
}

gotItBtn.addEventListener('click', () => {
    onboardingModal.style.display = 'none';
    if (dontShowAgain.checked) {
        localStorage.setItem('onboardingDismissed', 'true');
    }
});

// Mass input change
massInput.addEventListener('input', () => {
    const newMass = parseFloat(massInput.value);
    if (newMass > 0) {
        mass = newMass;
        sat.mass = newMass;
        logToScreen('Mass updated to ' + newMass + ' kg');
    } else {
        logToScreen('Mass must be greater than 0');
    }
});

targetXInput.addEventListener('input', updateTargetFromInputs);
targetYInput.addEventListener('input', updateTargetFromInputs);
targetRadiusInput.addEventListener('input', updateTargetFromInputs);

// ESC key to close modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        helpModal.style.display = 'none';
        onboardingModal.style.display = 'none';
    }
});

// Initial draw
draw();
updateStatus();