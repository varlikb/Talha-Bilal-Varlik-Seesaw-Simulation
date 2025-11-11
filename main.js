(() => {
  const PLANK_LENGTH_PX = 400; // matches CSS
  const MAX_ANGLE_DEG = 30;
  const ANGLE_SCALE = 6.5; // lower divisor => more visible tilt
  const MIN_VISIBLE_ANGLE = 1.4; // ensure slight tilt when unbalanced
  const OBJECT_RADIUS_PX = 11; // approximate visual radius of weight circle
  const STORAGE_KEY = 'seesaw-state-v1';

  const plank = document.getElementById('plank');
  const objectsLayer = document.getElementById('objectsLayer');
  const leftWeightEl = document.getElementById('leftWeight');
  const rightWeightEl = document.getElementById('rightWeight');
  const directionIndicator = document.getElementById('directionIndicator');
  const resetBtn = document.getElementById('resetBtn');
  const seesawRoot = document.getElementById('seesaw');

  /**
   * Simulation state
   * - items: { xFromCenterPx, weightKg }[]
   * - targetAngleDeg: computed from torque
   * - currentAngleDeg: animated toward target
   */
  const state = {
    items: [],
    targetAngleDeg: 0,
    currentAngleDeg: 0,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.items)) {
        state.items = parsed.items
          .map(it => ({
            xFromCenterPx: Number(it.xFromCenterPx) || 0,
            weightKg: clamp(Math.round(Number(it.weightKg) || 1), 1, 10),
          }))
          // keep only positions on-plank
          .filter(it => Math.abs(it.xFromCenterPx) <= PLANK_LENGTH_PX / 2);
      }
      state.currentAngleDeg = Number(parsed.currentAngleDeg) || 0;
      state.targetAngleDeg = Number(parsed.targetAngleDeg) || 0;
    } catch {
      // ignore parse errors
    }
  }

  function saveState() {
    const payload = {
      items: state.items,
      targetAngleDeg: state.targetAngleDeg,
      currentAngleDeg: state.currentAngleDeg,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota/storage errors
    }
  }

  function clearState() {
    state.items = [];
    state.targetAngleDeg = 0;
    // keep current angle animation to settle back to zero
    saveState();
    renderObjects();
    recomputePhysics();
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Convert a click event on the plank into local plank X coordinate
   * measured from the center of the plank (left negative, right positive).
   * Accounts for the current rotation of the plank.
   */
  function getLocalXFromClick(event) {
    const rect = plank.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const globalX = event.clientX;
    const globalY = event.clientY;

    // vector from center to click in screen space
    const dx = globalX - centerX;
    const dy = globalY - centerY;

    // inverse rotate by current angle to align with plank local axis
    const theta = (-state.currentAngleDeg * Math.PI) / 180;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const localX = dx * cosT - dy * sinT; // y not needed afterwards

    // clamp within plank length
    const half = PLANK_LENGTH_PX / 2;
    return clamp(localX, -half, half);
  }

  function addObjectAtLocalX(xFromCenterPx) {
    const weightKg = randomInt(1, 10);
    state.items.push({ xFromCenterPx, weightKg });
    renderObjects();
    recomputePhysics();
    saveState();
  }

  function renderObjects() {
    // Clear layer
    objectsLayer.innerHTML = '';
    // Create DOM for each object
    for (const item of state.items) {
      const el = document.createElement('div');
      el.className = 'object';
      el.style.left = `${PLANK_LENGTH_PX / 2 + item.xFromCenterPx}px`;
      el.title = `${item.weightKg} kg`;
      el.textContent = String(item.weightKg);
      objectsLayer.appendChild(el);
    }
  }

  /**
   * Compute torques and target angle based on all items.
   * torque = sum(weight * distance)
   */
  function recomputePhysics() {
    let leftTorque = 0;
    let rightTorque = 0;
    let leftWeight = 0;
    let rightWeight = 0;

    for (const item of state.items) {
      const x = item.xFromCenterPx;
      const absX = Math.abs(x);

      // If the object overlaps the pivot, distribute its weight proportionally
      // to the overlap on each side and approximate lever arms.
      if (absX < OBJECT_RADIUS_PX) {
        const r = OBJECT_RADIUS_PX;
        // Map x in [-r, r] to right proportion in [0,1]
        const proportionRight = (x + r) / (2 * r);
        const proportionLeft = 1 - proportionRight;

        const leftPartWeight = item.weightKg * proportionLeft;
        const rightPartWeight = item.weightKg * proportionRight;

        // Approximate lever arms:
        // - part of the object's mass lies on each side at ~proportion * r
        // - include offset only in the same-side direction
        const leftLever =
          (proportionLeft * r) + (x < 0 ? -x : 0);
        const rightLever =
          (proportionRight * r) + (x > 0 ? x : 0);

        leftTorque += leftPartWeight * leftLever;
        rightTorque += rightPartWeight * rightLever;
        leftWeight += leftPartWeight;
        rightWeight += rightPartWeight;
      } else {
        // Standard case: fully on one side
        const distance = absX; // pixels as proxy for meters
        const contribution = item.weightKg * distance;
        if (x < 0) {
          leftTorque += contribution;
          leftWeight += item.weightKg;
        } else if (x > 0) {
          rightTorque += contribution;
          rightWeight += item.weightKg;
        }
      }
    }

    leftWeightEl.textContent = `${leftWeight} kg`;
    rightWeightEl.textContent = `${rightWeight} kg`;

    const torqueDiff = rightTorque - leftTorque;
    const rawAngle = torqueDiff / ANGLE_SCALE;
    let targetAngle = clamp(rawAngle, -MAX_ANGLE_DEG, MAX_ANGLE_DEG);

    if (torqueDiff !== 0 && Math.abs(targetAngle) < MIN_VISIBLE_ANGLE) {
      targetAngle = clamp(
        MIN_VISIBLE_ANGLE * Math.sign(torqueDiff),
        -MAX_ANGLE_DEG,
        MAX_ANGLE_DEG,
      );
    }

    state.targetAngleDeg = targetAngle;
    updateDirectionIndicator(torqueDiff, leftWeight, rightWeight);
  }

  function updateDirectionIndicator(torqueDiff, leftWeight, rightWeight) {
    if (!directionIndicator) return;
    directionIndicator.classList.remove('to-left', 'to-right', 'neutral');

    const threshold = 0.5;
    if (Math.abs(torqueDiff) < threshold) {
      directionIndicator.classList.add('neutral');
      return;
    }

    const arrowClass = torqueDiff > 0 ? 'to-right' : 'to-left';
    directionIndicator.classList.add(arrowClass);
  }

  /**
   * Animate currentAngleDeg toward targetAngleDeg smoothly.
   * Uses critically damped like easing based on a simple lerp each frame.
   */
  function animate() {
    const stiffness = 0.12; // how fast to approach target
    const delta = state.targetAngleDeg - state.currentAngleDeg;
    state.currentAngleDeg += delta * stiffness;

    // Snap to target if very close to avoid micro jitter
    if (Math.abs(delta) < 0.01) {
      state.currentAngleDeg = state.targetAngleDeg;
    }

    // Apply transform
    plank.style.transform = `rotate(${state.currentAngleDeg}deg)`;

    // Persist occasionally (lightweight)
    saveState();

    requestAnimationFrame(animate);
  }

  function handlePlankClick(event) {
    // Limit clicks strictly to the plank bounding box; the element already handles rotation hit-testing
    const xLocal = getLocalXFromClick(event);
    addObjectAtLocalX(xLocal);
  }

  function init() {
    loadState();
    renderObjects();
    recomputePhysics();

    plank.addEventListener('click', handlePlankClick);
    resetBtn.addEventListener('click', clearState);

    // Start animation loop
    // Apply initial angle (if any) before loop
    plank.style.transform = `rotate(${state.currentAngleDeg}deg)`;
    requestAnimationFrame(animate);
  }

  // Prevent touch scrolling when interacting on mobile over the seesaw region
  seesawRoot.addEventListener('touchmove', e => {
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  window.addEventListener('DOMContentLoaded', init);
})();


