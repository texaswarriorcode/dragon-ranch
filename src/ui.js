import { DRAGONS, RARITY, PLAYER } from './config.js';
import { rarityCss } from './rarity.js';
import { computeDragonStats, formatStatsLine, formatXpLine, xpProgress } from './stats.js';
import { MARKETPLACE_TABS, MARKETPLACE_CATALOG } from './marketplace/catalog.js';
import { tryPurchase } from './marketplace/marketplace.js';

const HOTBAR_ITEMS = [
  { id: 'farmhouse', label: 'House', inv: 'farmhouses', color: '#c4a574', key: '1' },
  { id: 'farmPlot', label: 'Plot', inv: 'farmPlots', color: '#6b4423', key: '2' },
  { id: 'dragonPen', label: 'Pen', inv: 'dragonPens', color: '#8b7355', key: '3' },
  { id: 'breedingPen', label: 'Breed', inv: 'breedingPens', color: '#9b59b6', key: '4' },
  { id: 'workerBunkhouse', label: 'Bunks', inv: 'workerBunkhouses', color: '#8d6e63', key: '5' },
  { id: 'dragonFieldTraining', label: 'Train', inv: 'fieldTrainings', color: '#78909c', key: '6' },
  { id: 'seeds', label: 'Seeds', inv: 'seeds', color: '#7cb342', key: '7' },
  { id: 'dragons', label: 'Dragons', inv: 'dragons', color: '#c62828', key: '8' },
  { id: 'dragonfruit', label: 'Fruit', inv: 'dragonfruit', color: '#e91e8c', key: '9' },
];

export class UI {
  constructor(root) {
    this.root = root;
    this.selected = null;
    this.selectedDragonId = null;
    this.dragonPanelOpen = false;
    this.marketplaceOpen = false;
    this.missionsOpen = false;
    this.marketplaceTab = MARKETPLACE_TABS[0].id;
    this.coins = 0;
    this.onSelect = null;
    this.onNewGame = null;
    this.onToggleCreative = null;
    this.onSelectDragon = null;
    this.onCreativeSpawn = null;
    this.onPurchase = null; // (listing) => result from game
    this.onStartMission = null; // (payload) => result
    this.onGetMissionOptions = null; // () => options snapshot
    this.missionSel = { workerId: '', dragonId: '', buildingId: '', missionKey: '' };

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
          <div><kbd>1-9</kbd> hotbar · <kbd>R</kbd> rotate · <kbd>Esc</kbd> cancel · <kbd>F</kbd>/click interact</div>
          <div><kbd>I</kbd>/<kbd>Tab</kbd> dragons · <kbd>M</kbd> market · <kbd>N</kbd> missions · rest at door</div>
          <div style="margin-top:6px" class="btn-row">
            <button class="ui-btn" id="btn-help-hide">Hide help</button>
            <button class="ui-btn" id="btn-market">Marketplace</button>
            <button class="ui-btn" id="btn-missions">Missions</button>
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
      <div class="market-panel hidden" id="market-panel">
        <div class="market-header">
          <div class="market-title-row">
            <h3>Marketplace</h3>
            <div class="coins-display" id="coins-display">Coins: <b>0</b></div>
          </div>
          <button class="ui-btn" id="btn-market-close">Close</button>
        </div>
        <div class="market-tabs" id="market-tabs"></div>
        <div class="market-body" id="market-body"></div>
      </div>
      <div class="mission-panel hidden" id="mission-panel">
        <div class="mission-header">
          <h3>Field Missions</h3>
          <button class="ui-btn" id="btn-mission-close">Close</button>
        </div>
        <div class="mission-steps" id="mission-steps"></div>
        <div class="mission-active" id="mission-active"></div>
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
    this.marketPanel = root.querySelector('#market-panel');
    this.marketTabs = root.querySelector('#market-tabs');
    this.marketBody = root.querySelector('#market-body');
    this.coinsDisplay = root.querySelector('#coins-display');
    this.missionPanel = root.querySelector('#mission-panel');
    this.missionSteps = root.querySelector('#mission-steps');
    this.missionActive = root.querySelector('#mission-active');

    this._buildHotbar();
    this._buildCreativeSpawn();
    this._buildMarketTabs();
    this._renderMarketBody();

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
    root.querySelector('#btn-market').addEventListener('click', () => this.setMarketplace(!this.marketplaceOpen));
    root.querySelector('#btn-market-close').addEventListener('click', () => this.setMarketplace(false));
    root.querySelector('#btn-missions').addEventListener('click', () => this.setMissions(!this.missionsOpen));
    root.querySelector('#btn-mission-close').addEventListener('click', () => this.setMissions(false));
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
    this.creativeLevel = this.creativeLevel || 1;
    this.spawnRow.innerHTML = '';
    const lvlRow = document.createElement('div');
    lvlRow.className = 'btn-row';
    lvlRow.style.marginBottom = '6px';
    lvlRow.innerHTML = '<span style="font-size:11px;opacity:0.8;margin-right:6px">Spawn level:</span>';
    for (const lv of [1, 10, 25, 50]) {
      const b = document.createElement('button');
      b.className = 'ui-btn spawn-btn' + (this.creativeLevel === lv ? ' active' : '');
      b.textContent = `L${lv}`;
      b.addEventListener('click', () => {
        this.creativeLevel = lv;
        this._buildCreativeSpawn();
      });
      lvlRow.appendChild(b);
    }
    this.spawnRow.appendChild(lvlRow);
    for (const tier of RARITY.tiers) {
      for (const sex of ['male', 'female']) {
        for (const stage of [0, 2]) {
          const btn = document.createElement('button');
          btn.className = 'ui-btn spawn-btn';
          btn.style.borderColor = rarityCss(tier);
          const age = stage === 2 ? 'Adult' : 'Baby';
          btn.textContent = `${sex === 'male' ? '♂' : '♀'} ${age} ${tier}`;
          btn.addEventListener('click', () => {
            this.onCreativeSpawn?.({ sex, stage, rarity: tier, level: this.creativeLevel || 1 });
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
    if (open) {
      this.setMarketplace(false);
      this.setMissions(false);
    }
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
      const stats = computeDragonStats(d.rarity || 'Common', d.level ?? 1);
      const xp = xpProgress(d);
      const xpPct = Math.floor(xp.ratio * 100);
      const away = d._away ? '<span class="di-stats" style="color:#ffcc80">Away on mission</span>' : '';
      const rest = d._restLabel ? `<span class="di-stats" style="color:#90caf9">${d._restLabel}</span>` : '';
      el.innerHTML = `
        <span class="rarity-pip" style="background:${rarityCss(d.rarity)}"></span>
        <span class="di-main">${d.sex === 'male' ? '♂' : '♀'} ${stage}
          <span class="di-stats">${formatStatsLine(stats)}</span>
          <span class="xp-bar"><i style="width:${xpPct}%"></i></span>
          <span class="di-stats">${formatXpLine(d)}</span>
          ${away}${rest}
        </span>
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
    const workers = inv._workersLabel || 'Workers: —';
    this.invStrip.innerHTML = `
      <div class="row"><span class="dot" style="background:#7cb342"></span> Seeds: <b>${inv.seeds}</b></div>
      <div class="row"><span class="dot" style="background:#e91e8c"></span> Dragonfruit: <b>${inv.dragonfruit}</b></div>
      <div class="row"><span class="dot" style="background:#c62828"></span> Dragons: <b>${inv.dragons?.length || 0}</b> (♂${males} ♀${females})</div>
      <div class="row"><span class="dot" style="background:#5c6bc0"></span> ${workers}</div>
      <div class="row"><span class="dot" style="background:#ffe082"></span> Coins: <b>${inv._coins ?? 0}</b></div>
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
    const stats = computeDragonStats(rarity, dragon.level ?? 1);
    const xp = formatXpLine(dragon);
    const prog = xpProgress(dragon);
    const bar = `<span class="xp-bar tip"><i style="width:${Math.floor(prog.ratio * 100)}%"></i></span>`;
    return `<b>Red Dragon</b> — ${sex}<br>Stage: ${stage}<br><span style="color:${col}">★ ${rarity}</span><br>${formatStatsLine(stats)}<br>${xp}${bar}`;
  }


  _buildMarketTabs() {
    this.marketTabs.innerHTML = '';
    for (const tab of MARKETPLACE_TABS) {
      const btn = document.createElement('button');
      btn.className = 'market-tab' + (tab.id === this.marketplaceTab ? ' active' : '');
      btn.textContent = tab.label;
      btn.dataset.id = tab.id;
      btn.addEventListener('click', () => {
        this.marketplaceTab = tab.id;
        this._buildMarketTabs();
        this._renderMarketBody();
      });
      this.marketTabs.appendChild(btn);
    }
  }

  _renderMarketBody() {
    const cat = this.marketplaceTab;
    const listings = MARKETPLACE_CATALOG[cat] || [];
    const real = listings.filter((l) => !l.comingSoon);
    const stubs = listings.filter((l) => l.comingSoon);

    let html = '';
    if (real.length === 0) {
      html += `<div class="market-empty">No listings yet — assets coming soon</div>`;
    }
    html += '<div class="market-grid">';
    const show = real.length ? real : stubs;
    for (const listing of show) {
      const soon = !!listing.comingSoon;
      html += `
        <div class="market-card${soon ? ' soon' : ''}" data-id="${listing.id}">
          <div class="market-sil"></div>
          <div class="market-card-name">${listing.name}</div>
          <div class="market-card-desc">${listing.description || ''}</div>
          <div class="market-card-footer">
            <span class="market-price">${soon ? '—' : listing.price + ' 🪙'}</span>
            <button class="ui-btn market-buy" data-id="${listing.id}" ${soon ? 'disabled' : ''}>
              ${soon ? 'Coming soon' : 'Buy'}
            </button>
          </div>
        </div>`;
    }
    // If we have real items, still show stubs grayed below for layout hint? Spec says optionally 2-3 grayed cards when empty. When real exist, just show real.
    if (real.length === 0 && stubs.length === 0) {
      // nothing
    }
    html += '</div>';
    this.marketBody.innerHTML = html;

    this.marketBody.querySelectorAll('.market-buy').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const listing = (MARKETPLACE_CATALOG[cat] || []).find((l) => l.id === id);
        const result = this.onPurchase
          ? this.onPurchase(listing)
          : tryPurchase(listing, { coins: this.coins });
        this.toast(result.message || 'Not for sale yet', result.ok ? 2200 : 2500, !!result.ok && listing?.grant?.kind === 'worker');
        if (result.ok) {
          if (result.coins != null) this.updateCoins(result.coins);
          this._renderMarketBody();
        }
      });
    });
  }

  setMarketplace(open) {
    this.marketplaceOpen = open;
    this.marketPanel.classList.toggle('hidden', !open);
    if (open) {
      this.setDragonPanel(false);
      this.setMissions(false);
      this.updateCoins(this.coins);
      this._buildMarketTabs();
      this._renderMarketBody();
    }
  }

  setMissions(open, opts = {}) {
    this.missionsOpen = open;
    this.missionPanel.classList.toggle('hidden', !open);
    if (open) {
      this.setDragonPanel(false);
      this.setMarketplace(false);
      if (opts.workerId != null) this.missionSel.workerId = String(opts.workerId);
      this.renderMissions();
    }
  }

  renderMissions() {
    const data = this.onGetMissionOptions?.() || {
      workers: [],
      dragons: [],
      buildings: [],
      missions: [],
      active: [],
    };
    const sel = this.missionSel;

    // Validate cascading selections
    if (sel.workerId && !data.workers.some((w) => String(w.id) === String(sel.workerId))) {
      sel.workerId = '';
    }
    if (!sel.workerId) {
      sel.dragonId = '';
      sel.buildingId = '';
      sel.missionKey = '';
    }
    const dragons = sel.workerId ? data.dragons : [];
    if (sel.dragonId && !dragons.some((d) => String(d.id) === String(sel.dragonId))) {
      sel.dragonId = '';
    }
    if (!sel.dragonId) {
      sel.buildingId = '';
      sel.missionKey = '';
    }
    const buildings = sel.dragonId ? data.buildings : [];
    if (sel.buildingId && !buildings.some((b) => String(b.id) === String(sel.buildingId))) {
      sel.buildingId = '';
    }
    if (!sel.buildingId) sel.missionKey = '';
    const missions = sel.buildingId
      ? (data.missionsByBuilding?.[sel.buildingId] || data.missions || [])
      : [];
    if (sel.missionKey && !missions.some((m) => m.id === sel.missionKey)) {
      sel.missionKey = '';
    }

    const mkOpts = (list, value, labelFn, placeholder) => {
      let html = `<option value="">${placeholder}</option>`;
      for (const item of list) {
        const v = String(item.id);
        const selected = String(value) === v ? ' selected' : '';
        html += `<option value="${v}"${selected}>${labelFn(item)}</option>`;
      }
      return html;
    };

    const step = !sel.workerId ? 1 : !sel.dragonId ? 2 : !sel.buildingId ? 3 : 4;
    let html = `<div class="mission-step-label">Step ${step} of 4</div>`;

    html += `<label class="mission-field">1. Dragon Handler
      <select id="ms-worker">${mkOpts(data.workers, sel.workerId, (w) => w.label, 'Select handler…')}</select>
    </label>`;

    html += `<label class="mission-field${sel.workerId ? '' : ' dim'}">2. Adult dragon
      <select id="ms-dragon" ${sel.workerId ? '' : 'disabled'}>${mkOpts(dragons, sel.dragonId, (d) => d.label, sel.workerId ? 'Select dragon…' : 'Pick a handler first')}</select>
    </label>`;

    html += `<label class="mission-field${sel.dragonId ? '' : ' dim'}">3. Training structure
      <select id="ms-building" ${sel.dragonId ? '' : 'disabled'}>${mkOpts(buildings, sel.buildingId, (b) => b.label, sel.dragonId ? 'Select Field Training…' : 'Pick a dragon first')}</select>
    </label>`;

    html += `<label class="mission-field${sel.buildingId ? '' : ' dim'}">4. Mission
      <select id="ms-mission" ${sel.buildingId ? '' : 'disabled'}>${mkOpts(missions, sel.missionKey, (m) => m.label, sel.buildingId ? 'Select mission…' : 'Pick a structure first')}</select>
    </label>`;

    const canStart = sel.workerId && sel.dragonId && sel.buildingId && sel.missionKey;
    const picked = missions.find((m) => m.id === sel.missionKey);
    if (picked) {
      html += `<div class="mission-desc">${picked.description || ''}<br><span class="mission-meta">${picked.meta || ''}</span></div>`;
    }
    html += `<button class="ui-btn mission-start" id="ms-start" ${canStart ? '' : 'disabled'}>Start mission</button>`;

    this.missionSteps.innerHTML = html;

    const bind = (id, key) => {
      const el = this.missionSteps.querySelector(id);
      el?.addEventListener('change', () => {
        this.missionSel[key] = el.value;
        // reset downstream
        if (key === 'workerId') {
          this.missionSel.dragonId = '';
          this.missionSel.buildingId = '';
          this.missionSel.missionKey = '';
        } else if (key === 'dragonId') {
          this.missionSel.buildingId = '';
          this.missionSel.missionKey = '';
        } else if (key === 'buildingId') {
          this.missionSel.missionKey = '';
        }
        this.renderMissions();
      });
    };
    bind('#ms-worker', 'workerId');
    bind('#ms-dragon', 'dragonId');
    bind('#ms-building', 'buildingId');
    bind('#ms-mission', 'missionKey');
    this.missionSteps.querySelector('#ms-start')?.addEventListener('click', () => {
      const result = this.onStartMission?.({ ...this.missionSel });
      if (result?.message) this.toast(result.message, result.ok ? 2800 : 2500, !!result.ok);
      if (result?.ok) {
        this.missionSel.dragonId = '';
        this.missionSel.missionKey = '';
        this.renderMissions();
      }
    });

    // Active missions list
    let act = '<h4>Active / Away</h4>';
    if (!data.active?.length) {
      act += '<div class="empty">No dragons on mission</div>';
    } else {
      for (const a of data.active) {
        const pct = Math.floor((a.ratio || 0) * 100);
        act += `<div class="mission-row">
          <div><b>${a.title}</b><br><span class="di-stats">${a.subtitle || ''}</span></div>
          <div class="mission-eta">${a.eta}</div>
          <div class="xp-bar" style="max-width:100%"><i style="width:${pct}%"></i></div>
        </div>`;
      }
    }
    if (data.resting?.length) {
      act += '<h4>Resting</h4>';
      for (const r of data.resting) {
        act += `<div class="mission-row"><div>${r.label}</div><div class="mission-eta">${r.eta}</div></div>`;
      }
    }
    this.missionActive.innerHTML = act;
  }

  updateCoins(n) {
    this.coins = n ?? 0;
    if (this.coinsDisplay) {
      this.coinsDisplay.innerHTML = `Coins: <b>${this.coins}</b>`;
    }
  }

  /** Close topmost modal panel. Returns true if something was closed. */
  closeTopPanel() {
    if (this.missionsOpen) {
      this.setMissions(false);
      return true;
    }
    if (this.marketplaceOpen) {
      this.setMarketplace(false);
      return true;
    }
    if (this.dragonPanelOpen) {
      this.setDragonPanel(false);
      return true;
    }
    return false;
  }

  get hotbarItems() {
    return HOTBAR_ITEMS;
  }
}
