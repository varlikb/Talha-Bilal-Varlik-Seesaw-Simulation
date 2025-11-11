## Seesaw Simulation (Pure JS, HTML, CSS)

A small interactive simulation of a playground seesaw. Click on the plank to drop a random-weight object (1–10 kg) at that position. The seesaw tilts smoothly based on torque from all placed objects. State persists to localStorage so your configuration survives refreshes.

### Demo (how to run locally)
- Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).
- Click anywhere on the plank to add new objects.
- Watch the seesaw rebalance with a smooth tilt.
- The “Reset” button clears all objects and returns to neutral.

### Core Rules Implemented
- Fixed plank length: 400px, pivot exactly in the center.
- Each click adds an object at the clicked position on the plank only.
- Random weight per object: 1–10 kg.
- Torque per side: `sum(weight × distanceFromCenterPx)`.
- Tilt angle computed from torque difference and clamped to ±30°:
  - `angle = clamp((rightTorque - leftTorque) / 10, -30, 30)`
- Smooth animation with requestAnimationFrame.
- State saved/restored from `localStorage`.
- UI shows total weight on left and right.
- Direction indicator arrow points toward the heavier side with live torque readout.

### Files
- `index.html` — Markup and UI shell: HUD, stage, seesaw elements.
- `styles.css` — Visual styling; plank, pivot, objects, layout.
- `main.js` — All logic: input, physics, animation, rendering, persistence.
- `EXPLANATIONS.txt` — A more detailed explanation of the reasoning and implementation choices.

### Key Design Decisions
- Use the plank’s local coordinate system for precise placement:
  - On click, compute vector from plank center to click point in screen coordinates.
  - Inverse-rotate by the current angle to convert into the plank’s local X axis.
  - Clamp within half the plank length.
  - This ensures clicks land correctly even while the plank is tilted.
- Increase perceived responsiveness by scaling torque more aggressively and enforcing a small minimum visible tilt whenever there is an imbalance. This makes subtle differences like 15 kg vs 16 kg noticeable.
- A direction indicator in the HUD shows which side is heavier, including approximate torque and weight deltas.
- Distances are measured in pixels for simplicity. In a toy sim, pixels are proportional to meters, and the proportionality is absorbed by the angle scaling factor.
- A simple critically-damped style lerp animates the current angle to the target angle each frame. This keeps motion smooth and responsive without overshoot.
- Objects are absolutely positioned within a dedicated `objects-layer` inside the plank so they rotate with the plank automatically via the parent transform.

### Trade-offs and Limitations
- Physics uses a simplified torque model (no angular acceleration, damping constants, or mass moment of inertia). The result is intuitive and visually clear but not a full rigid-body simulation.
- Distances are in pixels; the scale factor `(÷ 10)` in angle computation is empirical to achieve a good visual range.
- Objects placed exactly at the center contribute no torque and do not count toward a side in the side weight totals (by design).



