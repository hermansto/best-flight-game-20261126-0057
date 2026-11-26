// input.js — keyboard and mouse controls, one place for every binding.

export function createInput() {
  return {
    throttleUp: false, throttleDown: false,
    rollLeft: false, rollRight: false,
    pitchUp: false, pitchDown: false,
    yawLeft: false, yawRight: false,
    brake: false,
    mouseActive: false, mouseX: 0, mouseY: 0,
    soundOn: true,
  };
}

const KEYMAP = {
  KeyW: 'throttleUp', ArrowUp: 'pitchUp',
  KeyS: 'throttleDown', ArrowDown: 'pitchDown',
  ArrowLeft: 'rollLeft', ArrowRight: 'rollRight',
  KeyA: 'yawLeft', KeyD: 'yawRight',
  Space: 'brake',
};

export function bindInput(input, canvas, onKey) {
  const down = (event) => {
    const name = KEYMAP[event.code];
    if (name) {
      input[name] = true;
      event.preventDefault();
    }
    if (onKey) onKey(event.code, true);
  };
  const up = (event) => {
    const name = KEYMAP[event.code];
    if (name) {
      input[name] = false;
      event.preventDefault();
    }
    if (onKey) onKey(event.code, false);
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);

  // Mouse steer: hold the left button and the plane follows the pointer.
  canvas.addEventListener('mousedown', (event) => {
    input.mouseActive = true;
    updateMouse(input, canvas, event);
  });
  window.addEventListener('mouseup', () => {
    input.mouseActive = false;
    input.mouseX = 0;
    input.mouseY = 0;
  });
  window.addEventListener('mousemove', (event) => {
    if (input.mouseActive) updateMouse(input, canvas, event);
  });
  // Wheel trims the throttle without touching the keyboard.
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
  }, { passive: false });
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}

function updateMouse(input, canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  input.mouseX = Math.max(-1, Math.min(1, (event.clientX - cx) / (rect.width / 2)));
  input.mouseY = Math.max(-1, Math.min(1, (event.clientY - cy) / (rect.height / 2)));
}
