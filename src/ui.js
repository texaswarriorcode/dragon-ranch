import { DRAGONS, RARITY, PLAYER } from './config.js';
import { rarityCss } from './rarity.js';

const HOTBAR_ITEMS = [
  { id: 'farmhouse', label: 'House', inv: 'farmhouses', color: '#c4a574', key: '1' },
  { id: 'farmPlot', label: 'Plot', inv: 'farmPlots', color: '#6b4423', key: '2' },
  { id: 'dragonPen', label: 'Pen', inv: 'dragonPens', color: '#8b7355', key: '3' },
  { id: 'breedingPen', label: 'Breed', inv: 'breedingPens', color: '#9b59b6', key: '4' },
  { id: 'seeds', label: 'Seeds', inv: 'seeds', color: '#7cb342', key: '5' },
  { id: 'dragons', label: 'Dragons', inv: 'dragons', color: '#c62828', key: '6' },
  { id: 'dragonfruit', label: 'Fruit', inv: 'dragonfruit', color: '#e91e8c', key: '7' },
];

export class UI {
  constructor(root) {
    this.root = root;
    this.selected = null;
    this.selectedDragonId = null;
    this.dragonPanelOpen = false;
    this.onSelect = null;
    this.onNewGame = null;
    this.onToggleCreative = null;
    this.onSelectDragon = null;
    this.onCreativeSpawn = null;

    root.innerHTML = `
      <div class="hud-top">
        <div class="panel day-indicator" id="day-ind">
          <div id="day-label">Day 1 · Morning</div>
          <div class="bar"><i id="day-bar"></i></div>
          <div class="energy-row">Energy <div class="ebar"><i id="energy-bar"></i></div></div>
        </div>
        <div class="panel help-panel" id="help-panel">
          <h3>Controls</h3>
          <div><kbd>WASD</kbd> move · <kbd>Q</kbd>/<kbd>E</kbd> cam · scroll zoom · RMB orbit</div>
          <div><kbd>1-7</kbd> hotbar · <kbd>R</kbd> rotate · <kbd>Esc</kbd> cancel · <kbd>F</kbd>/click interact</div>
          <div><kbd>I</kbd> / <kbd>Tab</kbd> dragon inventory · rest at farmhouse door</div>
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
      <div class="fade-overlay" id="fade"></div>
      <div class="breed-hud" id="breed-hud"></div>
      <div class="dragon-panel hidden" id="dragon-panel">
        <div class="dragon-panel-header">
          <h3>Dragon Inventory</h3>
          <button class="ui-btn" id="btn-dragon-close">Close</button>
        </div>
        <div class="dragon-list" id="dragon-list"></div>
        <div class="creative-spawn hidden" id="creative-spawn">
          <h4>Creative spawn</h4>
          <div class="btn-row" id="spawn-row"></div>
        </div>
      </div>
    `;

    this.hotbarEl = root.querySelector('#hotbar');
    this.promptEl = root.querySelector('#prompt');
    this.tooltipEl = root.querySelector('#tooltip');
    this.toastEl = root.querySelector('#toast');
    this.dayLabel = root.querySelector('#day-label');
    this.dayBar = root.querySelector('#day-bar');
    this.energyBar = root.querySelector('#energy-bar');
    this.invStrip = root.querySelector('#inv-strip');
    this.helpPanel = root.querySelector('#help-panel');
    this.fadeEl = root.querySelector('#fade');
    this.breedHud = root.querySelector('#breed-hud');
    this.dragonPanel = root.querySelector('#dragon-panel');
    this.dragonList = root.querySelector('#dragon-list');
    this.creativeSpawn = root.querySelector('#creative-spawn');
    this.spawnRow = root.querySelector('#spawn-row');

    this._buildHotbar();
    this._buildCreativeSpawn();

    root.querySelector('#btn-new').addEventListener('click', () => {
      if (confirm('Start a new game? Current progress will be erased.')) this.onNewGame?.();
    });
    root.querySelector('#btn-creative').addEventListener('click', (e) => {
      this.onToggleCreative?.();
      e.currentTarget.classList.toggle('active');
    });
    root.querySelector('#btn-help-hide').addEventListener('click', () => {
      this.helpPanel.style.display = this.helpPanel.style.display === 'none' ? '' : 'none';
    });
    root.querySelector('#btn-dragon-close').addEventListener('click', () => this.setDragonPanel(false));
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
        if (item.id === 'dragons') {
          this.setDragonPanel(!this.dragonPanelOpen);
          this.select('dragons');
          return;
        }
        this.select(item.id === this.selected ? null : item.id);
      });
      this.hotbarEl.appendChild(el);
      this.slots[item.id] = { el, item };
    }
  }

  _buildCreativeSpawn() {
    this.spawnRow.innerHTML = '';
    for (const tier of RARITY.tiers) {
      for (const sex of ['male', 'female']) {
        for (const stage of [0, 2]) {
          const btn = document.createElement('button');
          btn.className = 'ui-btn spawn-btn';
          btn.style.borderColor = rarityCss(tier);
          const age = stage === 2 ? 'Adult' : 'Baby';
          btn.textContent = `${sex === 'male' ? '♂' : '♀'} ${age} ${tier}`;
          btn.addEventListener('click', () => {
            this.onCreativeSpawn?.({ sex, stage, rarity: tier });
          });
          this.spawnRow.appendChild(btn);
        }
      }
    }
  }

  setCreativeVisible(on) {
    this.creativeSpawn.classList.toggle('hidden', !on);
  }

  select(id) {
    this.selected = id;
    for (const s of Object.values(this.slots)) {
      s.el.classList.toggle('selected', s.item.id === id);
    }
    this.onSelect?.(id);
  }

  setDragonPanel(open) {
    this.dragonPanelOpen = open;
    this.dragonPanel.classList.toggle('hidden', !open);
  }

  updateDragonList(dragons, selectedId) {
    this.selectedDragonId = selectedId;
    this.dragonList.innerHTML = '';
    if (!dragons.length) {
      this.dragonList.innerHTML = '<div class="empty">No dragons in inventory</div>';
      return;
    }
    for (const d of dragons) {
      const el = document.createElement('button');
      el.className = 'dragon-item' + (d.id === selectedId ? ' selected' : '');
      const stage = DRAGONS.stages[d.stage]?.name || 'baby';
      el.innerHTML = `
        <span class="rarity-pip" style="background:${rarityCss(d.rarity)}"></span>
        <span class="di-main">${d.sex === 'male' ? '♂' : '♀'} ${stage}</span>
        <span class="di-rarity" style="color:${rarityCss(d.rarity)}">${d.rarity}</span>
      `;
      el.addEventListener('click', () => {
        this.selectedDragonId = d.id;
        this.onSelectDragon?.(d.id);
        this.updateDragonList(dragons, d.id);
        this.select('dragons');
      });
      this.dragonList.appendChild(el);
    }
  }

  updateInventory(inv, selectedDragonId = null) {
    for (const s of Object.values(this.slots)) {
      let n = 0;
      if (s.item.inv === 'dragons') n = inv.dragons?.length || 0;
      else n = inv[s.item.inv] ?? 0;
      s.el.querySelector('[data-count]').textContent = n > 99 ? '99+' : String(n);
      s.el.style.opacity = n <= 0 && s.item.id !== 'dragons' ? '0.45' : '1';
    }
    const males = (inv.dragons || []).filter((d) => d.sex === 'male').length;
    const females = (inv.dragons || []).filter((d) => d.sex === 'female').length;
    this.invStrip.innerHTML = `
      <div class="row"><span class="dot" style="background:#7cb342"></span> Seeds: <b>${inv.seeds}</b></div>
      <div class="row"><span class="dot" style="background:#e91e8c"></span> Dragonfruit: <b>${inv.dragonfruit}</b></div>
      <div class="row"><span class="dot" style="background:#c62828"></span> Dragons: <b>${inv.dragons?.length || 0}</b> (♂${males} ♀${females})</div>
    `;
    if (this.dragonPanelOpen) this.updateDragonList(inv.dragons || [], selectedDragonId);
  }

  updateEnergy(energy) {
    const pct = Math.max(0, Math.min(100, (energy / PLAYER.energyMax) * 100));
    this.energyBar.style.width = `${pct}%`;
    this.energyBar.classList.toggle('low', pct < PLAYER.lowEnergyThreshold);
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
    this.tooltipEl.innerHTML = text.replace(/\n/g, '<br>');
    this.tooltipEl.style.left = `${clientX + 14}px`;
    this.tooltipEl.style.top = `${clientY + 14}px`;
    this.tooltipEl.classList.add('visible');
  }

  toast(msg, ms = 2200, flair = false) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.toggle('flair', !!flair);
    this.toastEl.classList.add('visible');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => {
      this.toastEl.classList.remove('visible', 'flair');
    }, ms);
  }

  async fadeRest(fadeMs, during) {
    this.fadeEl.classList.add('active');
    await new Promise((r) => setTimeout(r, fadeMs));
    await during?.();
    this.fadeEl.classList.remove('active');
    await new Promise((r) => setTimeout(r, fadeMs));
  }

  setBreedHud(text) {
    if (!text) {
      this.breedHud.classList.remove('visible');
      this.breedHud.textContent = '';
      return;
    }
    this.breedHud.innerHTML = text;
    this.breedHud.classList.add('visible');
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
    const rarity = dragon.rarity || 'Common';
    const col = rarityCss(rarity);
    return `<b>Red Dragon</b> — ${sex}<br>Stage: ${stage}<br><span style="color:${col}">★ ${rarity}</span>`;
  }

  get hotbarItems() {
    return HOTBAR_ITEMS;
  }
}
