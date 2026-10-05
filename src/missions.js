import { MISSIONS } from './config.js';

let _missionId = 1;

export function getMissionDef(key) {
  return MISSIONS.defs[key] || null;
}

export function missionsForBuildingType(type) {
  const keys = MISSIONS.buildings[type] || [];
  return keys.map((k) => MISSIONS.defs[k]).filter(Boolean);
}

/**
 * Active mission + rest-cooldown tracker.
 * Timings use Date.now() so they survive save/load.
 */
export class MissionManager {
  constructor() {
    /** @type {object[]} */
    this.active = [];
  }

  serialize() {
    return this.active.map((m) => ({
      id: m.id,
      missionKey: m.missionKey,
      workerId: m.workerId,
      buildingId: m.buildingId,
      dragon: { ...m.dragon },
      startedAt: m.startedAt,
      endsAt: m.endsAt,
    }));
  }

  deserialize(list) {
    this.active = [];
    for (const raw of list || []) {
      this.active.push({
        id: raw.id,
        missionKey: raw.missionKey,
        workerId: raw.workerId,
        buildingId: raw.buildingId,
        dragon: { ...raw.dragon },
        startedAt: raw.startedAt,
        endsAt: raw.endsAt,
      });
      _missionId = Math.max(_missionId, (raw.id || 0) + 1);
    }
  }

  isWorkerBusy(workerId) {
    return this.active.some((m) => m.workerId === workerId);
  }

  isDragonOnMission(dragonId) {
    return this.active.some((m) => m.dragon?.id === dragonId);
  }

  dragonRestRemaining(dragon, now = Date.now()) {
    const until = dragon?.missionRestUntil || 0;
    return Math.max(0, until - now);
  }

  isDragonResting(dragon, now = Date.now()) {
    return this.dragonRestRemaining(dragon, now) > 0;
  }

  /**
   * @returns {{ ok: boolean, message?: string, mission?: object }}
   */
  start({ workerId, buildingId, buildingType, dragon, missionKey, now = Date.now() }) {
    const def = getMissionDef(missionKey);
    if (!def) return { ok: false, message: 'Unknown mission' };
    if (def.buildingType && buildingType && def.buildingType !== buildingType) {
      return { ok: false, message: 'Mission not available at this structure' };
    }
    if (this.isWorkerBusy(workerId)) {
      return { ok: false, message: 'That handler is already on a mission' };
    }
    if (this.isDragonOnMission(dragon.id)) {
      return { ok: false, message: 'Dragon is already on a mission' };
    }
    if ((dragon.stage ?? 0) < 2) {
      return { ok: false, message: 'Only adult dragons can go on missions' };
    }
    if (this.isDragonResting(dragon, now)) {
      const sec = Math.ceil(this.dragonRestRemaining(dragon, now) / 1000);
      return { ok: false, message: `Dragon must rest (${sec}s left)` };
    }

    const mission = {
      id: _missionId++,
      missionKey,
      workerId,
      buildingId,
      dragon: {
        id: dragon.id,
        sex: dragon.sex,
        stage: dragon.stage,
        rarity: dragon.rarity || 'Common',
        level: dragon.level ?? 1,
        xp: dragon.xp ?? 0,
        missionRestUntil: dragon.missionRestUntil || 0,
      },
      startedAt: now,
      endsAt: now + def.durationMs,
    };
    this.active.push(mission);
    return { ok: true, mission, def };
  }

  /** Progress 0..1 and ms remaining for UI. */
  progress(mission, now = Date.now()) {
    const total = Math.max(1, mission.endsAt - mission.startedAt);
    const left = Math.max(0, mission.endsAt - now);
    return {
      ratio: Math.min(1, 1 - left / total),
      remainingMs: left,
      done: left <= 0,
    };
  }

  /**
   * Complete finished missions.
   * @param {(mission, def) => void} onComplete
   */
  tick(now = Date.now(), onComplete) {
    const done = [];
    for (const m of this.active) {
      if (now >= m.endsAt) done.push(m);
    }
    for (const m of done) {
      this.active = this.active.filter((x) => x.id !== m.id);
      const def = getMissionDef(m.missionKey);
      onComplete?.(m, def);
    }
    return done.length;
  }

  formatRemaining(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`;
  }
}
