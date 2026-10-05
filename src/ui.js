import { DRAGONS } from './config.js';

const HOTBAR_ITEMS = [
  { id: 'farmhouse', label: 'House', inv: 'farmhouses', color: '#c4a574', key: '1' },
  { id: 'farmPlot', label: 'Plot', inv: 'farmPlots', color: '#6b4423', key: '2' },
  { id: 'dragonPen', label: 'Pen', inv: 'dragonPens', color: '#8b7355', key: '3' },
  { id: 'seeds', label: 'Seeds', inv: 'seeds', color: '#7cb342', key: '4' },
  { id: 'maleDragon', label: '♂ Dragon', inv: 'maleDragons', color: '#c62828', key: '5' },
  { id: 'femaleDragon', label: '♀ Dragon', inv: 'femaleDragons', color: '#e53955', key: '6' },
  { id: 'dragonfruit', label: 'Fruit', inv: 'dragonfruit', color: '#e91e8c', key: '7' },
];

export class UI {
  constructor(root) {
    this.root = root;
    this.selected = null;
    this.onSelect = null;
    this.onNewGame = null;
    this.onToggleCreative = null;
    this.onToggleHelp = null;

    root.innerHTML = `
      <div class="hud-top">
        <div class="panel day-indicator" id="day-ind">
          <div id="day-label">Day 1 · Morning</div>
          <div class="bar"><i id="day-bar"></i></div>
        </div>
        <div class="panel help-panel" id="help-panel">
          <h3>Controls</h3>
          <div><kbd>WASD</kbd> / arrows move · <kbd>Q</kbd>/<kbd>E</kbd> rotate cam · scroll zoom</div>
          <div>RMB drag orbit · <kbd>1-7</kbd> hotbar · <kbd>R</kbd> rotate build · <kbd>Esc</kbd> cancel</div>
          <div><kbd>F</kbd> / click interact · plant, harvest, place, feed</div>
          <div style="margin-top:6px" class="btn-row">
            <button class="ui-btn" id="btn-help-hide">Hide help</button>
            <button class="ui-btn" id="btn-creative">Creative</button>
            <button class="ui-btn danger" id="btn-new">New game</button>
          </div>
        </div>
      </div>
      <div class="panel inventory-strip" id="inv-strip"></div>
      <div class="hotbar" id="hotbar"></div>
      <div class="prompt" id="prompt"></div>
      <div class="tooltip" id="tooltip"></div>
      <div class="toast" id="toast"></div>
    `;

    this.hotbarEl = root.querySelector('#hotbar');
    this.promptEl = root.querySelector('#prompt');
    this.tooltipEl = root.querySelector('#tooltip');
    this.toastEl = root.querySelector('#toast');
    this.dayLabel = root.querySelector('#day-label');
    this.dayBar = root.querySelector('#day-bar');
    this.invStrip = root.querySelector('#inv-strip');
    this.helpPanel = root.querySelector('#help-panel');

    this._buildHotbar();

    root.querySelector('#btn-new').addEventListener('click', () => {
      if (confirm('Start a new game? Current progress will be erased.')) {
        this.onNewGame?.();
      }
    });
    root.querySelector('#btn-creative').addEventListener('click', (e) => {
      this.onToggleCreative?.();
      e.currentTarget.classList.toggle('active');
    });
    root.querySelector('#btn-help-hide').addEventListener('click', () => {
      this.helpPanel.style.display = this.helpPanel.style.display === 'none' ? '' : 'none';
    });
  }

  _buildHotbar() {
    this.hotbarEl.innerHTML = '';
    this.slots = {};
    for (const item of HOTBAR_ITEMS) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.id = item.id;
      el.innerHTML = `
        <span class="count" data-count>0</span>
        <div class="icon" style="background:${item.color}"></div>
        <div class="label">${item.label}</div>
        <span class="keyhint">${item.key}</span>
      `;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.select(item.id === this.selected ? null : item.id);
      });
      this.hotbarEl.appendChild(el);
      this.slots[item.id] = { el, item };
    }
  }

  select(id) {
    this.selected = id;
    for (const s of Object.values(this.slots)) {
      s.el.classList.toggle('selected', s.item.id === id);
    }
    this.onSelect?.(id);
  }

  updateInventory(inv) {
    for (const s of Object.values(this.slots)) {
      const n = inv[s.item.inv] ?? 0;
      s.el.querySelector('[data-count]').textContent = n > 99 ? '99+' : String(n);
      s.el.style.opacity = n <= 0 ? '0.45' : '1';
    }
    this.invStrip.innerHTML = `
      <div class="row"><span class="dot" style="background:#7cb342"></span> Seeds: <b>${inv.seeds}</b></div>
      <div class="row"><span class="dot" style="background:#e91e8c"></span> Dragonfruit: <b>${inv.dragonfruit}</b></div>
      <div class="row"><span class="dot" style="background:#c62828"></span> ♂ Dragons: <b>${inv.maleDragons}</b></div>
      <div class="row"><span class="dot" style="background:#e53955"></span> ♀ Dragons: <b>${inv.femaleDragons}</b></div>
    `;
  }

  setPrompt(text) {
    if (!text) {
      this.promptEl.classList.remove('visible');
      this.promptEl.textContent = '';
      return;
    }
    this.promptEl.textContent = text;
    this.promptEl.classList.add('visible');
  }

  setTooltip(text, clientX, clientY) {
    if (!text) {
      this.tooltipEl.classList.remove('visible');
      return;
    }
    this.tooltipEl.textContent = text;
    this.tooltipEl.style.left = `${clientX + 14}px`;
    this.tooltipEl.style.top = `${clientY + 14}px`;
    this.tooltipEl.classList.add('visible');
  }

  toast(msg, ms = 2200) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('visible');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.remove('visible'), ms);
  }

  updateDay(gameTime, dayLengthMs) {
    const t = ((gameTime % dayLengthMs) + dayLengthMs) % dayLengthMs;
    const frac = t / dayLengthMs;
    const dayNum = Math.floor(gameTime / dayLengthMs) + 1;
    let phase = 'Night';
    if (frac > 0.22 && frac < 0.35) phase = 'Morning';
    else if (frac >= 0.35 && frac < 0.55) phase = 'Noon';
    else if (frac >= 0.55 && frac < 0.72) phase = 'Afternoon';
    else if (frac >= 0.72 && frac < 0.85) phase = 'Evening';
    this.dayLabel.textContent = `Day ${dayNum} · ${phase}`;
    this.dayBar.style.width = `${(frac * 100).toFixed(1)}%`;
  }

  dragonTooltip(dragon) {
    const stage = DRAGONS.stages[dragon.stage]?.name || '?';
    const sex = dragon.sex === 'male' ? 'Male ♂' : 'Female ♀';
    return `Red Dragon — ${sex}\nStage: ${stage}`;
  }

  get hotbarItems() {
    return HOTBAR_ITEMS;
  }
}
