export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouseNdc = { x: 0, y: 0 };
    this.mouseDown = false;
    this.leftClick = false;
    this.canvas = canvas;

    const isFormField = (t) =>
      t && (t.tagName === 'SELECT' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      // Let dropdowns / inputs handle their own keys (arrows, letters) — only Esc reaches the game.
      if (isFormField(e.target) && k !== 'escape') return;
      this.keys.add(k);
      this.justPressed.add(k);
      // prevent scrolling with arrows/space when focused
      if (['arrowup','arrowdown','arrowleft','arrowright',' ','tab'].includes(k)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    // Releasing keys when the window loses focus (alt-tab, devtools) avoids "stuck" movement.
    const releaseAll = () => {
      this.keys.clear();
      this.mouseDown = false;
    };
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) releaseAll();
    });

    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.clientX = e.clientX;
      this.clientY = e.clientY;
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0 && !e.shiftKey) {
        this.mouseDown = true;
        this.leftClick = true;
      }
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
  }

  endFrame() {
    this.justPressed.clear();
    this.leftClick = false;
  }

  get forward() { return this.keys.has('w') || this.keys.has('arrowup'); }
  get back() { return this.keys.has('s') || this.keys.has('arrowdown'); }
  get left() { return this.keys.has('a') || this.keys.has('arrowleft'); }
  get right() { return this.keys.has('d') || this.keys.has('arrowright'); }
  get rotLeft() { return this.keys.has('q'); }
  // Q/E (hold) rotate the camera. E is camera-only: it used to double as "interact", so
  // tapping E to turn could rest at the farmhouse or drop the selected building.
  get rotRight() { return this.keys.has('e'); }
  get interact() { return this.justPressed.has('f') || this.leftClick; }
  get interactKey() { return this.justPressed.has('f') || this.leftClick; }
  get rotateBuild() { return this.justPressed.has('r'); }
  get cancel() { return this.justPressed.has('escape'); }
  pressed(k) { return this.justPressed.has(k); }
  held(k) { return this.keys.has(k); }
}
