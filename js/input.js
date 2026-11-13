// Keyboard (WASD or arrows) and gamepad.
const keys = new Set();
const pressed = new Set();
addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const padPrev = {};
export const input = {
  throttle: 0, brake: 0, steer: 0, handbrake: false,
  interact: false, radioNext: false, radioPrev: false, interactHeld: false, camera: false, pause: false, confirm: false, up: false, down: false, any: false,
  usingPad: false,
  update() {
    const k = (...c) => c.some((x) => keys.has(x));
    const p = (...c) => c.some((x) => pressed.has(x));
    let th = k('KeyW', 'ArrowUp') ? 1 : 0;
    let br = k('KeyS', 'ArrowDown') ? 1 : 0;
    let st = (k('KeyA', 'ArrowLeft') ? 1 : 0) - (k('KeyD', 'ArrowRight') ? 1 : 0);
    let hb = k('Space');
    let inter = p('KeyE'), held = k('KeyE'), cam = p('KeyC'), pause = p('Escape', 'KeyP');
    let rn = p('KeyR'), rp = p('KeyQ');
    let conf = p('Enter', 'NumpadEnter'), up = p('ArrowUp', 'KeyW'), down = p('ArrowDown', 'KeyS');
    let any = pressed.size > 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const g of pads) {
      if (!g) continue;
      const b = (i) => g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5);
      const bv = (i) => (g.buttons[i] ? g.buttons[i].value : 0);
      const edge = (i) => { const now = b(i); const was = padPrev[g.index + ':' + i]; padPrev[g.index + ':' + i] = now; return now && !was; };
      const ax = Math.abs(g.axes[0]) > 0.12 ? g.axes[0] : 0;
      if (ax || bv(7) > 0.05 || bv(6) > 0.05) this.usingPad = true;
      st = st || -ax * Math.abs(ax) ** 0.4;
      th = Math.max(th, bv(7));
      br = Math.max(br, bv(6));
      hb = hb || b(0);
      rn = rn || edge(5); rp = rp || edge(4);
      inter = inter || edge(2); held = held || b(2);
      cam = cam || edge(3);
      pause = pause || edge(9);
      conf = conf || edge(0);
      const up_ = edge(12), dn = edge(13);
      up = up || up_; down = down || dn;
      any = any || inter || cam || pause || conf;
    }
    Object.assign(this, { throttle: th, brake: br, steer: Math.max(-1, Math.min(1, st)), handbrake: hb, radioNext: rn, radioPrev: rp, interact: inter, interactHeld: held, camera: cam, pause, confirm: conf, up, down, any });
    pressed.clear();
  },
};
