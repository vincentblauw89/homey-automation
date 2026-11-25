/*
 * EUROM CONVECTOREN - WERKKAMER BOVEN EN BENEDEN
 * V1.3 - TIJDPROPORTIONELE PI-REGELING OP EXTERNE SENSOR (SONOFF SNZB-02P)
 *        MET FAILSAFE OM 17:00 EN 21:00, OCHTENDVERWARMING BOVEN EN
 *        INFRAROOD-BOOSTER BENEDEN
 *
 * Homey Flow: iedere minuut uitvoeren (één flow voor beide kamers).
 *
 * WERKING
 * - Handmatig starten: zet de convector aan (knop, app of Homey).
 *   Alleen zolang de convector AAN staat, regelt dit script.
 *   Zet je hem uit, dan stopt de regeling en krijgt de convector zijn
 *   oude setpoint terug.
 * - Het script schakelt de convector nooit aan of uit. Het stuurt alleen
 *   het setpoint van de interne thermostaat:
 *     warmen  = comfort + offset (boven de kamertemperatuur)
 *     pauze   = laag setpoint (element uit, convector blijft "aan")
 * - Een PI-regelaar met trenddemping berekent de warmtevraag (0-100 %).
 *   Die wordt verdeeld over een vaste cyclus van 10 minuten. Zo brandt
 *   het element kort en regelmatig, in plaats van lang aan en lang uit
 *   op de ruime hysterese van de interne thermostaat.
 * - Valt de sensor weg (geen update), dan regelt de convector zelf op
 *   het comfortsetpoint (FALLBACK).
 * - Vangnet: valt Homey uit tijdens een warmfase, dan stopt de interne
 *   thermostaat op comfort + offset.
 *
 * FAILSAFE (V1.1)
 * - Om 17:00 en 21:00 Nederlandse tijd (Europe/Amsterdam, zomer- en
 *   wintertijd automatisch) gaan beide convectoren uit als ze aan staan.
 * - Elk moment werkt één keer per dag, binnen een venster van 15 minuten
 *   (zo wordt een gemiste run opgevangen). Zet je een convector daarna
 *   zelf weer aan, dan blijft hij aan tot het volgende failsafe-moment.
 *
 * OCHTENDVERWARMING (V1.2, alleen werkkamer boven - sporten)
 * - Om 04:00 eenmalig controleren: kamer onder 12 °C en convector uit?
 *   Dan zet het script de convector aan met doel 19 °C.
 * - Om 05:50 gaat hij weer uit (alleen als het script hem aanzette).
 * - Zet je hem tussendoor zelf uit, dan stopt de ochtendverwarming.
 * - Gemiste run: venster van 15 minuten, net als de failsafe.
 *
 * INFRAROOD-BOOSTER (V1.3, alleen werkkamer beneden)
 * - Het infraroodpaneel (Eurom Mon Soleil DSP 770) helpt alleen bij het
 *   opwarmen, en alleen zolang de convector aan staat en het script regelt.
 * - Aan bij ≥ 1,5 °C tekort, uit bij ≤ 0,5 °C tekort. Daarna houdt de
 *   convector de temperatuur vast.
 * - Het script zet het paneel alleen uit als het script het zelf aanzette.
 *   Zet je het paneel tijdens een booster zelf uit, dan blijft het uit tot
 *   de convector weer uit gaat.
 * - Failsafe 17:00/21:00 zet ook het paneel uit.
 *
 * COMFORTTEMPERATUUR
 * - Standaard uit ROOMS[].comfort.
 * - Optioneel per kamer een getal-variabele (bijv. "Werkkamer boven doel");
 *   bestaat die, dan gaat die voor.
 */

/* =========================================================
 * 1. CONFIGURATIE
 * ========================================================= */

const ROOMS = [
  {
    key: "boven",
    label: "Werkkamer boven",
    heater: "e5d708e4-c33b-4a01-ab3a-87fae3dd5785",   // Werkkamer boven convector
    sensor: "7da65d15-111d-4107-817c-fadc87925fd3",   // Thermometer werkkamer boven (SNZB-02P)
    comfort: 20.5,
    comfortVariable: "Werkkamer boven doel",          // optioneel (getal)
    morning: {                                        // ochtendverwarming (sporten)
      check: "04:00",
      end: "05:50",
      belowTemperature: 12,
      comfort: 19
    }
  },
  {
    key: "beneden",
    label: "Werkkamer beneden",
    heater: "c34266e0-2296-4a34-adfc-292ffad68848",   // Werkkamer beneden convector
    sensor: "fecf88b8-8ae2-46bc-942a-26b7a9408f91",   // Thermometer werkkamer beneden (SNZB-02P)
    comfort: 20.5,
    comfortVariable: "Werkkamer beneden doel",        // optioneel (getal)
    booster: {                                        // infraroodpaneel bij opwarmen
      device: "7742cb88-8991-4c47-8cfb-fd8193233dd9", // Infraroodpaneel (Eurom Mon Soleil DSP 770)
      onDeficit: 1.5,
      offDeficit: 0.5,
      setpoint: 25                                    // eigen thermostaat paneel ruim boven comfort
    }
  }
];

const CFG = {
  version: "1.3",
  dryRun: false,
  timeZone: "Europe/Amsterdam",
  stateKeyPrefix: "eurom-werkkamer-",   // HomeyScript global storage

  comfortMin: 15,
  comfortMax: 24,

  setpoint: {
    heatOffset: 4,        // warmen: comfort + 4 °C (afgerond), vangnet bij uitval
    heatMax: 28,
    idle: 5,              // pauze: element uit
    tolerance: 0.5
  },

  pi: {
    kp: 0.5,              // 1 °C tekort → 50 % warmtevraag
    integralMinutes: 40,
    integralMin: 0,
    integralMax: 0.7,
    integrateBand: 1.0,   // alleen integreren binnen ±1 °C van comfort
    kdPerTrend: 0.3,      // +1 °C/u stijging → 30 % minder vraag
    maxDerivative: 0.3,
    maxDtMinutes: 5,
    warmStartIntegral: 0.25  // startwaarde I-deel bij inschakelen
  },

  cycle: {
    minutes: 10,
    minOnMinutes: 2,
    minOffMinutes: 2,
    overshootCutoff: 0.3,      // direct pauze vanaf comfort + 0,3 °C
    fastRestartDeficit: 0.6    // tijdens pauze direct nieuwe cyclus bij ≥ 0,6 °C tekort
  },

  sensor: {
    staleMinutes: 45,
    minimumPlausible: 3,
    maximumPlausible: 40
  },

  trend: {
    sampleIntervalMinutes: 2,
    historyMinutes: 20,
    minimumSamples: 5,
    minimumSpanMinutes: 8,
    emaAlpha: 0.3,
    maxAbsPerHour: 8,
    maximumSamples: 15
  },

  failsafe: {
    enabled: true,
    times: ["17:00", "21:00"],   // lokale tijd Europe/Amsterdam
    windowMinutes: 15,
    stateKey: "eurom-werkkamer-failsafe"
  },

  timeline: true
};

/* =========================================================
 * 2. ALGEMEEN
 * ========================================================= */

function now() { return Date.now(); }
function clock() {
  return new Date().toLocaleTimeString("nl-NL", { timeZone: CFG.timeZone, hour12: false });
}
function log(message) { console.log(`${clock()} | ${message}`); }
function localClock() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CFG.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date());
  const read = type => parts.find(part => part.type === type)?.value;
  const hour = Number(read("hour"));
  const minute = Number(read("minute"));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) throw new Error(`Lokale tijd onbekend voor ${CFG.timeZone}`);
  return { dateKey: `${read("year")}-${read("month")}-${read("day")}`, minutes: hour * 60 + minute, text: `${read("hour")}:${read("minute")}` };
}
function timeToMinutes(text) {
  const [h, m] = String(text).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) throw new Error(`Ongeldige failsafe-tijd: ${text}`);
  return h * 60 + m;
}
function value(device, capability) { return device?.capabilitiesObj?.[capability]?.value; }
function hasCapability(device, capability) {
  return Boolean(device?.capabilitiesObj && Object.prototype.hasOwnProperty.call(device.capabilitiesObj, capability));
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function fmt(v, digits = 1) { return Number.isFinite(v) ? v.toFixed(digits) : "?"; }
function pct(f) { return Number.isFinite(f) ? `${Math.round(f * 100)}%` : "?"; }
function signed(v, digits = 2) { return Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(digits)}` : "?"; }
function finiteTimestamp(input) {
  const n = Number(input);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function findVariableByName(logic, name) {
  if (!name) return null;
  const wanted = String(name).trim().toLowerCase();
  return Object.values(logic || {}).find(v => String(v?.name || "").trim().toLowerCase() === wanted) || null;
}

async function timeline(label, text) {
  if (!CFG.timeline) return;
  if (CFG.dryRun) { log(`[DRY RUN] Timeline: ${label} | ${text}`); return; }
  try {
    await Homey.flow.runFlowCardAction({
      uri: "homey:flowcardaction:homey:manager:notifications:create_notification",
      id: "homey:manager:notifications:create_notification",
      args: { text: `${label} | ${text}` }
    });
  } catch (error) { log(`Timeline ERROR: ${error.message}`); }
}

async function setCapability(device, capabilityId, newValue) {
  log(`WRITE | ${device.name} | ${capabilityId}: ${String(value(device, capabilityId))} → ${String(newValue)}`);
  if (CFG.dryRun) return;
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await Homey.devices.setCapabilityValue({ deviceId: device.id, capabilityId, value: newValue });
      if (device.capabilitiesObj?.[capabilityId]) device.capabilitiesObj[capabilityId].value = newValue;
      return;
    } catch (error) {
      lastError = error;
      log(`WAARSCHUWING | ${capabilityId} poging ${attempt}/2: ${error.message}`);
      if (attempt < 2) await wait(2000);
    }
  }
  throw new Error(`${device.name}: ${capabilityId} mislukt: ${lastError?.message}`);
}

/* =========================================================
 * 3. STATE (HomeyScript global storage, per kamer)
 * ========================================================= */

function defaultState() {
  return {
    version: CFG.version,
    active: false,
    activatedAt: null,
    userSetpoint: null,
    lastRun: null,
    integral: 0,
    cycle: null,                 // { startedAt, onMinutes, demand }
    temperatureHistory: [],
    smoothedTrendPerHour: null,
    fallbackActive: false,
    boosterOn: false,
    boosterSuppressed: false
  };
}
function loadState(room) {
  const raw = global.get(CFG.stateKeyPrefix + room.key);
  const state = defaultState();
  if (!raw || typeof raw !== "object") return state;
  state.active = raw.active === true;
  state.activatedAt = finiteTimestamp(raw.activatedAt);
  state.userSetpoint = Number.isFinite(Number(raw.userSetpoint)) ? Number(raw.userSetpoint) : null;
  state.lastRun = finiteTimestamp(raw.lastRun);
  state.integral = Number.isFinite(Number(raw.integral)) ? clamp(Number(raw.integral), CFG.pi.integralMin, CFG.pi.integralMax) : 0;
  const c = raw.cycle;
  if (c && finiteTimestamp(c.startedAt) && Number.isFinite(Number(c.onMinutes))) {
    state.cycle = { startedAt: Number(c.startedAt), onMinutes: Number(c.onMinutes), demand: Number(c.demand) || 0 };
  }
  state.smoothedTrendPerHour = Number.isFinite(Number(raw.smoothedTrendPerHour)) ? Number(raw.smoothedTrendPerHour) : null;
  state.fallbackActive = raw.fallbackActive === true;
  state.boosterOn = raw.boosterOn === true;
  state.boosterSuppressed = raw.boosterSuppressed === true;
  state.temperatureHistory = (Array.isArray(raw.temperatureHistory) ? raw.temperatureHistory : [])
    .filter(s => Number.isFinite(Number(s?.time)) && Number.isFinite(Number(s?.temperature)))
    .map(s => ({ time: Number(s.time), temperature: Number(s.temperature) }))
    .sort((a, b) => a.time - b.time);
  return state;
}
function saveState(room, state) {
  if (CFG.dryRun) { log(`[DRY RUN] ${room.label} | state niet opgeslagen`); return; }
  global.set(CFG.stateKeyPrefix + room.key, state);
}

/* =========================================================
 * 4. SENSOR EN TREND
 * ========================================================= */

function readSensor(sensor) {
  const t = Number(value(sensor, "measure_temperature"));
  const updatedRaw = sensor?.capabilitiesObj?.measure_temperature?.lastUpdated;
  const updated = updatedRaw ? new Date(updatedRaw).getTime() : NaN;
  const ageMinutes = Number.isFinite(updated) ? (now() - updated) / 60000 : null;
  if (!Number.isFinite(t) || t < CFG.sensor.minimumPlausible || t > CFG.sensor.maximumPlausible) {
    return { valid: false, temperature: null, ageMinutes, reason: `ongeldige waarde ${t}` };
  }
  if (ageMinutes !== null && ageMinutes > CFG.sensor.staleMinutes) {
    return { valid: false, temperature: t, ageMinutes, reason: `${Math.round(ageMinutes)} min geen update` };
  }
  return { valid: true, temperature: t, ageMinutes, reason: "ok" };
}

function updateTrend(state, temperature) {
  const t = CFG.trend;
  const time = now();
  state.temperatureHistory = state.temperatureHistory.filter(s => s.time >= time - t.historyMinutes * 120000 && s.time <= time);
  const last = state.temperatureHistory[state.temperatureHistory.length - 1];
  const sampleAdded = !last || time - last.time >= t.sampleIntervalMinutes * 60000 - 5000;
  if (sampleAdded) state.temperatureHistory.push({ time, temperature });
  if (state.temperatureHistory.length > t.maximumSamples) state.temperatureHistory = state.temperatureHistory.slice(-t.maximumSamples);

  const samples = state.temperatureHistory.filter(s => s.time >= time - t.historyMinutes * 60000);
  if (samples.length < t.minimumSamples) return { available: false, reason: `${samples.length}/${t.minimumSamples} samples` };
  const first = samples[0].time;
  const span = (samples[samples.length - 1].time - first) / 60000;
  if (span < t.minimumSpanMinutes) return { available: false, reason: `span ${fmt(span)} min` };
  const pts = samples.map(s => ({ x: (s.time - first) / 3600000, y: s.temperature }));
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  if (den === 0) return { available: false, reason: "geen tijdspreiding" };
  const raw = num / den;
  if (!Number.isFinite(raw) || Math.abs(raw) > t.maxAbsPerHour) return { available: false, reason: `raw ${fmt(raw, 2)}` };
  if (sampleAdded || !Number.isFinite(state.smoothedTrendPerHour)) {
    state.smoothedTrendPerHour = Number.isFinite(state.smoothedTrendPerHour)
      ? t.emaAlpha * raw + (1 - t.emaAlpha) * state.smoothedTrendPerHour
      : raw;
  }
  return { available: true, raw, ema: state.smoothedTrendPerHour, samples: samples.length };
}

/* =========================================================
 * 5. PI-REGELAAR EN CYCLUS
 * ========================================================= */

function computeDemand(state, target, temperature, trend) {
  const pi = CFG.pi;
  const dt = state.lastRun ? clamp((now() - state.lastRun) / 60000, 0, pi.maxDtMinutes) : 1;
  const error = target - temperature;
  const p = pi.kp * error;
  const d = trend.available ? clamp(-pi.kdPerTrend * trend.ema, -pi.maxDerivative, pi.maxDerivative) : 0;
  const unclamped = p + state.integral + d;
  const saturatedHigh = unclamped >= 1 && error > 0;
  const saturatedLow = unclamped <= 0 && error < 0;
  if (Math.abs(error) <= pi.integrateBand && !saturatedHigh && !saturatedLow) {
    state.integral += pi.kp * error * dt / pi.integralMinutes;
  }
  state.integral = clamp(state.integral, pi.integralMin, pi.integralMax);
  return { demand: clamp(p + state.integral + d, 0, 1), error, p, i: state.integral, d, dt };
}

function planOnMinutes(demand) {
  const c = CFG.cycle;
  if (demand <= 0) return 0;
  let onMinutes = Math.round(demand * c.minutes);
  if (onMinutes > 0 && onMinutes < c.minOnMinutes) onMinutes = demand * c.minutes >= c.minOnMinutes / 2 ? c.minOnMinutes : 0;
  if (onMinutes < c.minutes && c.minutes - onMinutes < c.minOffMinutes) onMinutes = c.minutes;
  return onMinutes;
}

function heatSetpoint(comfort) {
  return clamp(Math.round(comfort + CFG.setpoint.heatOffset), CFG.setpoint.idle + 1, CFG.setpoint.heatMax);
}

/* =========================================================
 * 6. REGELING PER KAMER
 * ========================================================= */

/* =========================================================
 * 5B. FAILSAFE
 * ========================================================= */

function dueFailsafe() {
  const f = CFG.failsafe;
  if (!f.enabled) return null;
  const local = localClock();
  const stored = global.get(f.stateKey);
  const done = stored && stored.dateKey === local.dateKey && Array.isArray(stored.done) ? stored.done : [];
  for (const time of f.times) {
    const start = timeToMinutes(time);
    if (local.minutes >= start && local.minutes < start + f.windowMinutes && !done.includes(time)) {
      return { time, local, done };
    }
  }
  return null;
}
function markFailsafeDone(due) {
  if (CFG.dryRun) return;
  global.set(CFG.failsafe.stateKey, { dateKey: due.local.dateKey, done: [...due.done, due.time] });
}

/* =========================================================
 * 5C. OCHTENDVERWARMING
 * ========================================================= */

function inWindow(local, time) {
  const start = timeToMinutes(time);
  return local.minutes >= start && local.minutes < start + CFG.failsafe.windowMinutes;
}
function loadMorning(room, local) {
  const raw = global.get(`${CFG.stateKeyPrefix}${room.key}-morning`);
  if (raw && raw.dateKey === local.dateKey) return { dateKey: local.dateKey, checked: raw.checked === true, active: raw.active === true };
  /* Nieuwe dag: een actieve ochtend van gisteren loopt niet door */
  return { dateKey: local.dateKey, checked: false, active: false, carriedOver: raw?.active === true };
}
function saveMorning(room, morning) {
  if (CFG.dryRun) return;
  global.set(`${CFG.stateKeyPrefix}${room.key}-morning`, { dateKey: morning.dateKey, checked: morning.checked, active: morning.active });
}
async function handleMorning(room, heater, sensor) {
  const m = room.morning;
  const local = localClock();
  const morning = loadMorning(room, local);
  let heaterOn = value(heater, "onoff") === true;

  /* Zelf uitgezet tijdens de ochtend → klaar */
  if (morning.active && !heaterOn) {
    morning.active = false;
    log(`${room.label} | OCHTEND | convector handmatig uit; ochtendverwarming gestopt`);
  }

  /* Controlemoment (m.check): eenmalig */
  if (!morning.checked && inWindow(local, m.check)) {
    morning.checked = true;
    const reading = readSensor(sensor);
    if (heaterOn) {
      log(`${room.label} | OCHTEND ${m.check} | convector staat al aan; niets doen`);
    } else if (!reading.valid) {
      log(`${room.label} | OCHTEND ${m.check} | sensor ${reading.reason}; niet aanzetten`);
      await timeline(room.label, `⚠️ ochtendcontrole ${m.check}: sensor ${reading.reason}; convector niet aangezet`);
    } else if (reading.temperature < m.belowTemperature) {
      log(`${room.label} | OCHTEND ${m.check} | kamer ${fmt(reading.temperature)} °C < ${m.belowTemperature} °C → convector aan, doel ${m.comfort} °C tot ${m.end}`);
      await setCapability(heater, "onoff", true);
      heaterOn = true;
      morning.active = true;
      await timeline(room.label, `🌅 ochtendverwarming: ${fmt(reading.temperature)} °C; aan tot ${m.end}, doel ${m.comfort} °C`);
    } else {
      log(`${room.label} | OCHTEND ${m.check} | kamer ${fmt(reading.temperature)} °C ≥ ${m.belowTemperature} °C; niet nodig`);
    }
  }

  /* Eindmoment (m.end): uit, alleen als het script hem aanzette */
  if (morning.active && (inWindow(local, m.end) || local.minutes >= timeToMinutes(m.end) + CFG.failsafe.windowMinutes)) {
    if (heaterOn) {
      log(`${room.label} | OCHTEND ${m.end} | einde ochtendverwarming → convector uit`);
      await setCapability(heater, "onoff", false);
      heaterOn = false;
    }
    morning.active = false;
    morning.endedNow = true;
  }

  saveMorning(room, morning);
  return morning;
}

/* =========================================================
 * 5D. INFRAROOD-BOOSTER
 * ========================================================= */

async function boosterOff(room, panel, state, reason) {
  if (!panel) return;
  if (value(panel, "onoff") === true) {
    log(`${room.label} | BOOSTER | ${panel.name} uit (${reason})`);
    await setCapability(panel, "onoff", false);
  }
  state.boosterOn = false;
}
async function updateBooster(room, panel, state, deficit) {
  const b = room.booster;
  if (!panel) return "geen paneel";
  const panelOn = value(panel, "onoff") === true;
  if (state.boosterOn && !panelOn) {
    state.boosterOn = false;
    state.boosterSuppressed = true;
    log(`${room.label} | BOOSTER | paneel handmatig uitgezet; blijft uit tot de convector uit gaat`);
    return "handmatig uit";
  }
  if (!state.boosterOn && !state.boosterSuppressed && !panelOn && deficit >= b.onDeficit) {
    log(`${room.label} | BOOSTER | tekort ${fmt(deficit)} °C ≥ ${b.onDeficit} → ${panel.name} aan`);
    if (hasCapability(panel, "target_temperature") && Number(value(panel, "target_temperature")) < b.setpoint) {
      await setCapability(panel, "target_temperature", b.setpoint);
    }
    await setCapability(panel, "onoff", true);
    state.boosterOn = true;
    return "aan";
  }
  if (state.boosterOn && deficit <= b.offDeficit) {
    await boosterOff(room, panel, state, `tekort ${fmt(deficit)} °C ≤ ${b.offDeficit}`);
    return "uit";
  }
  return state.boosterOn ? "aan" : (panelOn ? "handmatig aan" : "uit");
}

async function controlRoom(room, devices, logic, failsafe) {
  const heater = devices[room.heater];
  const sensor = devices[room.sensor];
  if (!heater) throw new Error(`${room.label}: convector niet gevonden (${room.heater})`);
  if (!sensor) throw new Error(`${room.label}: sensor niet gevonden (${room.sensor})`);
  for (const cap of ["onoff", "target_temperature"]) {
    if (!hasCapability(heater, cap)) throw new Error(`${room.label}: convector mist capability ${cap}`);
  }

  const state = loadState(room);
  const panel = room.booster ? devices[room.booster.device] || null : null;
  if (room.booster && !panel) log(`${room.label} | WAARSCHUWING | infraroodpaneel niet gevonden; booster overgeslagen`);
  const morning = room.morning ? await handleMorning(room, heater, sensor) : null;
  let heaterOn = value(heater, "onoff") === true;
  let failsafeOff = false;

  /* --- Failsafe: ook het infraroodpaneel uit --- */
  if (failsafe && panel && value(panel, "onoff") === true) {
    log(`${room.label} | FAILSAFE ${failsafe.time} → ${panel.name} uit`);
    await setCapability(panel, "onoff", false);
    state.boosterOn = false;
  }

  /* --- Failsafe: om 17:00 / 21:00 uitschakelen --- */
  if (failsafe && heaterOn) {
    log(`${room.label} | FAILSAFE ${failsafe.time} (lokaal ${failsafe.local.text}) → convector uit`);
    await setCapability(heater, "onoff", false);
    heaterOn = false;
    failsafeOff = true;
    if (!state.active) await timeline(room.label, `🕔 failsafe ${failsafe.time}; convector uitgezet`);
  }
  const currentSetpoint = Number(value(heater, "target_temperature"));

  /* --- Uit: regeling stoppen en oud setpoint terugzetten --- */
  if (!heaterOn) {
    if (state.active) {
      if (state.boosterOn) {
        try { await boosterOff(room, panel, state, "convector uit"); }
        catch (error) { log(`${room.label} | booster uitzetten mislukt: ${error.message}`); }
      }
      const restore = Number.isFinite(state.userSetpoint) ? state.userSetpoint : null;
      log(`${room.label} | convector UIT → regeling gestopt${restore !== null ? `; setpoint terug naar ${restore} °C` : ""}`);
      if (restore !== null && Math.abs(currentSetpoint - restore) > CFG.setpoint.tolerance) {
        try { await setCapability(heater, "target_temperature", restore); }
        catch (error) { log(`${room.label} | herstel setpoint mislukt: ${error.message}`); }
      }
      saveState(room, defaultState());
      await timeline(room.label, failsafeOff
        ? `🕔 failsafe ${failsafe.time}; convector uitgezet, regeling gestopt`
        : morning?.endedNow
          ? `🌅 ochtendverwarming klaar (${room.morning.end}); convector uit`
          : "⏹️ convector uit; slimme regeling gestopt");
      return `${room.label}: gestopt`;
    }
    return `${room.label}: uit`;
  }

  /* --- Comforttemperatuur --- */
  const variable = findVariableByName(logic, room.comfortVariable);
  const variableValue = Number(variable?.value);
  const baseComfort = variable && Number.isFinite(variableValue) && variableValue > 0
    ? clamp(variableValue, CFG.comfortMin, CFG.comfortMax)
    : room.comfort;
  const comfort = morning?.active ? room.morning.comfort : baseComfort;

  /* --- Aan: activeren bij eerste run --- */
  if (!state.active) {
    Object.assign(state, defaultState(), {
      active: true,
      activatedAt: now(),
      userSetpoint: Number.isFinite(currentSetpoint) ? currentSetpoint : null,
      integral: CFG.pi.warmStartIntegral
    });
    log(`${room.label} | convector AAN → slimme regeling actief | doel ${fmt(comfort)} °C | oud setpoint ${fmt(currentSetpoint, 0)} °C`);
    if (!morning?.active) await timeline(room.label, `🔥 slimme regeling actief; doel ${fmt(comfort)} °C`);
  }

  const room_ = readSensor(sensor);
  const internal = Number(value(heater, "measure_temperature"));
  let desiredSetpoint;
  let result;
  let detail;
  let control = null;
  let trend = { available: false, reason: "-" };

  if (!room_.valid) {
    desiredSetpoint = clamp(Math.round(comfort), CFG.setpoint.idle, CFG.setpoint.heatMax);
    result = "FALLBACK";
    detail = `sensor ${room_.reason}; convector regelt zelf op ${desiredSetpoint} °C`;
    state.cycle = null;
    if (state.boosterOn) await boosterOff(room, panel, state, "sensor weg");
    if (!state.fallbackActive) {
      state.fallbackActive = true;
      await timeline(room.label, `⚠️ sensor ${room_.reason}; convector regelt tijdelijk zelf op ${desiredSetpoint} °C`);
    }
  } else {
    if (state.fallbackActive) {
      state.fallbackActive = false;
      await timeline(room.label, "✅ sensor weer actief; slimme regeling hervat");
    }
    const temperature = room_.temperature;
    trend = updateTrend(state, temperature);
    control = computeDemand(state, comfort, temperature, trend);

    const c = CFG.cycle;
    const time = now();
    let cycle = state.cycle;
    let elapsed = cycle ? (time - cycle.startedAt) / 60000 : Infinity;
    let reasonCycle = "";

    if (cycle && elapsed < cycle.onMinutes && temperature >= comfort + c.overshootCutoff) {
      cycle.onMinutes = Math.floor(elapsed);
      reasonCycle = `≥ ${fmt(comfort + c.overshootCutoff)} °C; warmfase afgebroken`;
    }
    if (cycle && elapsed >= cycle.onMinutes && elapsed < c.minutes && control.error >= c.fastRestartDeficit) {
      cycle = null;
      reasonCycle = `tekort ${fmt(control.error)} °C; nieuwe cyclus`;
    }
    if (!cycle || elapsed >= c.minutes || elapsed < 0) {
      cycle = { startedAt: time, onMinutes: planOnMinutes(control.demand), demand: control.demand };
      elapsed = 0;
      reasonCycle = reasonCycle || "nieuwe cyclus";
      log(`${room.label} | CYCLUS | vraag ${pct(control.demand)} | ${cycle.onMinutes}/${c.minutes} min warmen`);
    }
    state.cycle = cycle;

    const heatNow = elapsed < cycle.onMinutes - 0.25;
    desiredSetpoint = heatNow ? heatSetpoint(comfort) : CFG.setpoint.idle;
    result = heatNow ? "HEATING" : "IDLE";
    detail = `${reasonCycle ? `${reasonCycle} | ` : ""}min ${fmt(elapsed)}/${c.minutes} | warmen t/m ${cycle.onMinutes} min`;

    if (room.booster) {
      const boosterStatus = await updateBooster(room, panel, state, control.error);
      detail += ` | booster ${boosterStatus}`;
    }
    log(`${room.label} | PI | fout ${signed(control.error)} °C | P ${signed(control.p)} | I ${signed(control.i)} | D ${signed(control.d)} | vraag ${pct(control.demand)}`);
    log(`${room.label} | ${trend.available ? `TREND | EMA ${signed(trend.ema)} °C/u | ${trend.samples} samples` : `TREND | niet beschikbaar: ${trend.reason}`}`);
  }
  state.lastRun = now();

  let writes = 0;
  if (!(Number.isFinite(currentSetpoint) && Math.abs(currentSetpoint - desiredSetpoint) <= CFG.setpoint.tolerance)) {
    try {
      await setCapability(heater, "target_temperature", desiredSetpoint);
      writes++;
    } catch (error) {
      saveState(room, state);
      await timeline(room.label, `⚠️ aansturing mislukt: ${error.message}`);
      throw error;
    }
  }
  saveState(room, state);

  const summary = `${room.label}: ${result} | kamer ${fmt(room_.temperature)} °C | doel ${fmt(comfort)} °C | intern ${fmt(internal, 0)} °C | setpoint ${desiredSetpoint} °C${control ? ` | vraag ${pct(control.demand)}` : ""} | ${detail} | ${writes} write(s)`;
  log(summary);
  return summary;
}

/* =========================================================
 * 7. START
 * ========================================================= */

const devices = await Homey.devices.getDevices();
const logic = await Homey.logic.getVariables();
const failsafe = dueFailsafe();
if (failsafe) log(`FAILSAFE | ${failsafe.time} actief (lokale tijd ${failsafe.local.text}, ${CFG.timeZone})`);
const results = [];
let failsafeErrors = 0;
for (const room of ROOMS) {
  try {
    results.push(await controlRoom(room, devices, logic, failsafe));
  } catch (error) {
    log(`FOUT | ${error.message}`);
    results.push(`${room.label}: FOUT ${error.message}`);
    if (failsafe) failsafeErrors++;
  }
}
/* Alleen afvinken als het uitzetten overal lukte; anders volgende minuut opnieuw. */
if (failsafe && failsafeErrors === 0) markFailsafeDone(failsafe);
return results.join("\n");
