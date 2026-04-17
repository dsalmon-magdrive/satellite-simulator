    // Vector Satellite Simulator (HTML5 Canvas)
// Left textarea accepts impulses in CSV-like lines: time,angle,magnitude

const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const width = canvas.width;
const height = canvas.height;

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
    simTime = 0.0;
    accumulator = 0.0;
    running = false;
    updateStatus();
}

function updateStatus() {
    simTimeSpan.textContent = simTime.toFixed(2);
    velocitySpan.textContent = sat.velocity_magnitude.toFixed(2);
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // Draw satellite
    ctx.fillStyle = '#0f0';
    ctx.fillRect(x - 5, y - 5, 10, 10);

    // Draw velocity vector (optional)
    const {vx, vy} = sat.velocity_components();
    if (sat.velocity_magnitude > 0) {
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + vx * 10, y + vy * 10); // scale for visibility
        ctx.stroke();
    }
}

function updatePhysics(dt) {
    // Apply impulses
    while (impulseIndex < impulses.length && simTime >= impulses[impulseIndex].t) {
        const imp = impulses[impulseIndex];
        sat.update_velocity(imp.mag, imp.angle * Math.PI / 180);
        logToScreen(`Applied impulse at ${imp.t.toFixed(2)}s: angle=${imp.angle}°, mag=${imp.mag}, new velocity: ${sat.velocity_magnitude.toFixed(2)} m/s, new angle: ${(sat.velocity_angle * 180 / Math.PI).toFixed(2)}°`);
        impulseIndex++;
    }

    // Update position
    const {vx, vy} = sat.velocity_components();
    x += vx * dt;
    y += vy * dt;

    // Wrap around edges
    x = ((x % width) + width) % width;
    y = ((y % height) + height) % height;
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
    // Auto-load impulses if not already loaded
    impulses = parseImpulsesFromText(textarea.value);
    impulseIndex = 0;
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