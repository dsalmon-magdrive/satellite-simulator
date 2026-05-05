# Vector Satellite Simulator

A simple HTML5 canvas-based simulator for visualizing a satellite's motion under the influence of vector impulses.

## Overview

This simulator models a satellite starting from the center of the canvas. You can apply impulses (thrusts) at specific times with given directions and magnitudes to change its velocity. The simulation runs in real-time, showing the satellite's position and current velocity.

## How to Use

1. **Input Impulses**: In the left sidebar, enter your impulses in the text area. Each line should follow the format: `time,angle,magnitude`
   - `time`: The simulation time (in seconds) when the impulse is applied.
   - `angle`: The direction of the impulse in degrees (0° = right, 90° = up, 180° = left, 270° = down).
   - `magnitude`: The strength of the impulse (arbitrary units).

   Example:
   ```
   1.0,0,1.0
   2.0,180,0.5
   ```

2. **Load Impulses**: Click the "Load impulses" button to parse and validate your input. Invalid lines will be skipped.

3. **Run Simulation**: Click "Run" to start the simulation. The satellite will move based on the impulses.

4. **Control Simulation**:
   - **Stop**: Pause the simulation.
   - **Reset**: Stop and reset the satellite to the starting position.

5. **Monitor Status**: The bottom shows current simulation time and velocity.

## Physics Notes

- The satellite has a mass of 0.1 kg.
- Impulses change velocity instantly (impulse = mass * delta velocity).
- Simulation uses a fixed timestep for physics calculations.
- Position is updated based on current velocity.

## Examples

- **Hover in place**: Apply equal and opposite impulses.
- **Circular orbit**: Periodic radial impulses.
- **Escape trajectory**: Strong initial impulse.

Try the default example loaded on startup!

## Technical Details

Built with HTML5 Canvas and vanilla JavaScript. No external dependencies. Runs entirely in the browser.