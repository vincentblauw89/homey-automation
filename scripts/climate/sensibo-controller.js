/*
 * MHI KLIMAATREGELING VIA SENSIBO CLOUD
 * V14.1 - PREDICTIVE CONTROL MET COMFORT BOOST
 *
 * Homey Flow: iedere 1 minuut uitvoeren.
 * Predictive sample en Insights: iedere 5 minuten.
 *
 * V14.1 wijziging:
 * - aparte verwarmingsfanregeling relatief aan de effectieve comforttemperatuur
 * - bij dagcomfort 20,7 C: MEDIUM t/m 20,5 C, LOW rond 20,6 C, QUIET vanaf 20,7 C
 * - Comfort Boost en nachtprofiel schuiven de grenzen automatisch mee
 * - koel-, presence-, vakantie-, schuifpui-, predictie- en anti-schimmellogica ongewijzigd
 */

/* =========================================================
 * 1. CONFIGURATIE
 * ========================================================= */

const POD = "h2NqwP3a";
const API = "https://home.sensibo.com/api/v2";

const DEV = {
  vincent: "7ffbfc29-0fd4-4196-9f91-08895f893634",
  roos: "06efb0f9-8d62-4d20-bb75-73b485ffe971",
  presenceOverride: "8289ad2c-ac79-45be-ac3d-76f2c4e8df7e",
  slidingDoor: "75b6132a-f1b8-43a7-9af4-365ea1ad75c6",
  weather: "aab30832-1c4b-41b9-be81-90f3f888f627",
  mhiOutdoor: "10781343-431a-4727-b5c1-083728622575",
  climateAnalysis: "7e23e8e7-fc95-4634-be6b-a2d04e88b0a9"
};

const LOGIC = {
  vacation: "483cdd68-67a3-4adb-b4ea-2427e726172f",
  sleeping: "87545b27-39b9-4f0f-b048-1a02c25771e6",
  climateState: "550ab119-b434-4dc6-912e-7285430827f8",
  sensiboApiKeyName: "Sensibo API key"
};

const INSIGHTS = {
  enabled: true,
  capabilities: {
    actual: "measure_devicecapabilities_number.number1",
    predicted: "measure_devicecapabilities_number.number2",
    comfort: "measure_devicecapabilities_number.number3",
    heatStart: "devicecapabilities_number.number4",
    coolStart: "measure_devicecapabilities_number.number5",
    outdoor: "measure_devicecapabilities_number.number6",
    trend: "devicecapabilities_number.number7"
  }
};

const CFG = {
  dryRun: false,
  timeZone: "Europe/Amsterdam",

  comfortBoost: {
    enabled: true,
    variableName: "Comfort boost",
    temperatureIncrease: 0.5
  },

  day: {
    start: "05:00",
    end: "22:30",
    wakeProtectionMinutes: 60,
    comfort: 20.7,
    heatStart: 20.5,
    heatStop: 21.0,
    heatTarget: 22,
    coolStart: 24.0,
    coolStop: 22.5,
    coolTarget: 22
  },

  night: {
    comfort: 18.0,
    heatStart: 17.5,
    heatStop: 18.5,
    heatTarget: 18,
    coolStart: 25.0,
    coolStop: 23.0,
    coolTarget: 23
  },

  outdoor: {
    coolingMinimum: 18,
    minimumPlausible: -30,
    maximumPlausible: 55,
    mhiCapability: "measure_temperature.outdoor"
  },

  roomTemperature: {
    minimumPlausible: 5,
    maximumPlausible: 40
  },

  airflow: {
    heat: {
      swing: "fixedBottom",
      horizontalSwing: "fixedCenter"
    },
    manageCooling: false
  },

  doorMinutes: 5,

  awayHeating: {
    enabled: true,
    coldOutdoorThreshold: 5,
    frostOutdoorThreshold: 0,
    absoluteIndoorStart: 15.5,
    cold: { heatStart: 16.5, heatStop: 17.5, heatTarget: 18, fan: "quiet" },
    frost: { heatStart: 17.0, heatStop: 18.0, heatTarget: 18, fan: "quiet" },
    absolute: { heatStart: 15.5, heatStop: 16.5, heatTarget: 18, fan: "quiet" }
  },

  vacationHeating: {
    enabled: true,
    frostOutdoorThreshold: 0,
    absoluteIndoorStart: 14.5,
    frost: { heatStart: 15.0, heatStop: 16.0, heatTarget: 18, fan: "quiet" },
    absolute: { heatStart: 14.5, heatStop: 15.5, heatTarget: 18, fan: "quiet" }
  },

  fan: {
    /* Algemene fanregeling voor koelen, ongewijzigd. */
    mediumDelta: 1.0,
    lowDelta: 0.4,

    /*
     * Verwarmingsfan relatief aan effectieve comforttemperatuur.
     * Dag 20,7 C: medium t/m 20,5; low rond 20,6; quiet vanaf 20,7.
     */
    heating: {
      mediumDelta: 0.2,
      lowDelta: 0.1
    },

    reduceDelayMinutes: 15,
    heatingTrendBoostThreshold: -0.4,
    heatingTrendBoostMinimumDeficit: 0.3
  },

  cooling: { maximumSessionMinutes: 180 },

  antiMold: {
    enabled: true,
    minimumCoolingMinutes: 10,
    fanMinutes: 15,
    fanLevel: "quiet"
  },

  prediction: {
    enabled: true,
    sampleIntervalMinutes: 5,
    historyMinutes: 25,
    maximumHistoryAgeMinutes: 45,
    minimumSamples: 3,
    minimumSpanMinutes: 10,
    forecastMinutes: 20,
    emaAlpha: 0.25,
    trendDeadbandPerHour: 0.12,
    maxPredictionDrop: 0.50,
    maxPredictionRise: 0.70,
    minimumHeatingTrendPerHour: 0.3,
    minimumCoolingTrendPerHour: 0.3,
    heatEarlyStartMargin: 0.5,
    coolEarlyStartMargin: 0.5,
    maximumAbsoluteRawTrendPerHour: 3.0,
    maximumSamples: 20
  }
};

/* =========================================================
 * 2. ALGEMEEN
 * ========================================================= */

function log(message) {
  console.log(`${new Date().toLocaleTimeString("nl-NL", { timeZone: CFG.timeZone })} | ${message}`);
}
function value(device, capability) { return device?.capabilitiesObj?.[capability]?.value; }
function isTruthy(input) {
  if (input === true || input === 1) return true;
  if (typeof input !== "string") return false;
  return ["ja", "yes", "true", "aan", "on", "1"].includes(input.trim().toLowerCase());
}
function validTemperature(t, min, max) { return Number.isFinite(t) && t >= min && t <= max; }
function finiteTimestamp(input) {
  const n = Number(input);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function requireItem(item, name) { if (!item) throw new Error(`Vereist Homey-item ontbreekt: ${name}`); }
function requireCapability(device, deviceName, capability) {
  if (!device?.capabilitiesObj || !Object.prototype.hasOwnProperty.call(device.capabilitiesObj, capability)) {
    throw new Error(`Capability "${capability}" ontbreekt op ${deviceName}`);
  }
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* =========================================================
 * 3. TIJD EN PROFIEL
 * ========================================================= */

function clockMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
function localClock() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CFG.timeZone,
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date());
  const read = type => Number(parts.find(part => part.type === type)?.value);
  const hour = read("hour");
  const minute = read("minute");
  const second = read("second");
  if (![hour, minute, second].every(Number.isFinite)) {
    throw new Error(`Lokale tijd kon niet worden bepaald voor ${CFG.timeZone}`);
  }
  return {
    hour, minute, second,
    minutes: hour * 60 + minute,
    text: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`
  };
}
function isWithinWindow(current, start, end) {
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}
function determineProfile(sleeping) {
  const clock = localClock();
  const dayStart = clockMinutes(CFG.day.start);
  const dayEnd = clockMinutes(CFG.day.end);
  const withinDayWindow = isWithinWindow(clock.minutes, dayStart, dayEnd);
  const wakeProtectionActive = clock.minutes >= dayStart && clock.minutes < dayStart + CFG.day.wakeProtectionMinutes;
  let dayActive = withinDayWindow;
  let reason = withinDayWindow ? "dagvenster" : "tijdgestuurde nacht";
  if (withinDayWindow && sleeping && !wakeProtectionActive) {
    dayActive = false;
    reason = "Slapen=true";
  }
  if (wakeProtectionActive) {
    dayActive = true;
    reason = sleeping ? "gegarandeerde ochtendstart; Slapen genegeerd" : "gegarandeerde ochtendstart";
  }
  return {
    day: dayActive,
    profileKey: dayActive ? "DAY" : "NIGHT",
    period: dayActive ? "DAG" : "NACHT",
    profile: dayActive ? CFG.day : CFG.night,
    clock, reason, sleeping, wakeProtectionActive
  };
}

/* =========================================================
 * 4. PERSISTENTE STATE
 * ========================================================= */

function defaultClimateState() {
  return {
    version: 14.1,
    lastProfile: null,
    doorOpenSince: null,
    lastFanChange: null,
    coolingStarted: null,
    antiMoldUntil: null,
    temperatureHistory: [],
    smoothedTrendPerHour: null,
    comfortBoostActive: false,
    comfortBoostChangedAt: null
  };
}
function normalizeClimateState(input) {
  const state = defaultClimateState();
  if (!input || typeof input !== "object" || Array.isArray(input)) return state;
  state.lastProfile = ["DAY", "NIGHT"].includes(input.lastProfile) ? input.lastProfile : null;
  state.doorOpenSince = finiteTimestamp(input.doorOpenSince);
  state.lastFanChange = finiteTimestamp(input.lastFanChange);
  state.coolingStarted = finiteTimestamp(input.coolingStarted);
  state.antiMoldUntil = finiteTimestamp(input.antiMoldUntil);
  state.smoothedTrendPerHour = Number.isFinite(Number(input.smoothedTrendPerHour)) ? Number(input.smoothedTrendPerHour) : null;
  state.comfortBoostActive = input.comfortBoostActive === true;
  state.comfortBoostChangedAt = finiteTimestamp(input.comfortBoostChangedAt);
  const history = Array.isArray(input.temperatureHistory) ? input.temperatureHistory : [];
  state.temperatureHistory = history
    .filter(sample => Number.isFinite(Number(sample?.time)) && validTemperature(
      Number(sample?.temperature), CFG.roomTemperature.minimumPlausible, CFG.roomTemperature.maximumPlausible
    ))
    .map(sample => ({ time: Number(sample.time), temperature: Number(sample.temperature) }))
    .sort((a, b) => a.time - b.time);
  return state;
}
function loadClimateState(variable) {
  const raw = variable?.value;
  if (typeof raw !== "string" || raw.trim() === "") {
    log("CLIMATE STATE | Leeg; standaardstate gebruikt");
    return defaultClimateState();
  }
  try {
    const state = normalizeClimateState(JSON.parse(raw));
    log(`CLIMATE STATE | Geladen | ${state.temperatureHistory.length} metingen | profiel ${state.lastProfile || "onbekend"} | EMA ${state.smoothedTrendPerHour ?? "leeg"}`);
    return state;
  } catch {
    log("CLIMATE STATE | Ongeldige JSON; standaardstate gebruikt");
    return defaultClimateState();
  }
}
async function saveClimateState(variable, state, reason) {
  if (CFG.dryRun) { log(`[DRY RUN] CLIMATE STATE | ${reason}`); return; }
  const serialized = JSON.stringify(state);
  await Homey.logic.updateVariable({ id: variable.id, variable: { value: serialized } });
  variable.value = serialized;
  log(`CLIMATE STATE | Opgeslagen | ${reason} | ${state.temperatureHistory.length} metingen`);
}

/* =========================================================
 * 5. TIMELINE EN SENSIBO
 * ========================================================= */

async function timeline(text) {
  if (CFG.dryRun) { log(`[DRY RUN] Timeline: ${text}`); return; }
  try {
    const result = await Homey.flow.runFlowCardAction({
      uri: "homey:flowcardaction:homey:manager:notifications:create_notification",
      id: "homey:manager:notifications:create_notification",
      args: { text: `Airco woonkamer | ${text}` }
    });
    if (result?.error) log(`Timeline ERROR: ${result.error}`);
    else log(`Timeline verstuurd: ${text}`);
  } catch (error) { log(`Timeline ERROR: ${error.message}`); }
}
async function api(apiKey, path, method = "GET", body = null) {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${API}${path}${separator}apiKey=${encodeURIComponent(apiKey)}`;
  const options = { method, headers: { Accept: "application/json", "Content-Type": "application/json" } };
  if (body !== null) options.body = JSON.stringify(body);
  let response;
  try { response = await fetch(url, options); }
  catch (error) { throw new Error(`Sensibo API niet bereikbaar: ${error.message}`); }
  const responseText = await response.text();
  let data;
  try { data = responseText ? JSON.parse(responseText) : null; }
  catch { throw new Error(`Sensibo gaf ongeldige JSON terug: ${responseText.slice(0, 250)}`); }
  if (!response.ok || data?.status === "failed") {
    throw new Error(`Sensibo API ${response.status}: ${data?.message || data?.reason || "onbekende fout"}`);
  }
  return data?.result ?? data;
}
async function readSensibo(apiKey) {
  let pod = await api(apiKey, `/pods/${POD}?fields=*`);
  if (Array.isArray(pod)) pod = pod[0];
  if (!pod?.acState) throw new Error("Sensibo pod of acState ontbreekt");
  const temperature = Number(pod?.mainMeasurementsSensor?.measurements?.temperature);
  if (!validTemperature(temperature, CFG.roomTemperature.minimumPlausible, CFG.roomTemperature.maximumPlausible)) {
    throw new Error(`Ongeldige Sensibo-temperatuur: ${temperature}`);
  }
  const acState = pod.acState;
  const target = Number(acState.targetTemperature);
  return {
    temperature,
    ac: {
      power: acState.on === true,
      mode: String(acState.mode ?? "").toLowerCase(),
      target: Number.isFinite(target) ? target : null,
      fan: String(acState.fanLevel ?? "").toLowerCase(),
      swing: acState.swing ?? null,
      horizontalSwing: acState.horizontalSwing ?? null,
      light: acState.light ?? null
    }
  };
}
async function setSensibo(apiKey, current, desired) {
  let newState;
  if (!desired.power) newState = { on: false };
  else if (desired.mode === "fan") newState = { on: true, mode: "fan", fanLevel: desired.fan };
  else {
    newState = {
      on: true, mode: desired.mode, targetTemperature: desired.target,
      temperatureUnit: "C", fanLevel: desired.fan
    };
  }
  if (desired.power && desired.mode === "heat") {
    newState.swing = CFG.airflow.heat.swing;
    newState.horizontalSwing = CFG.airflow.heat.horizontalSwing;
  } else {
    if (current.swing !== null) newState.swing = current.swing;
    if (current.horizontalSwing !== null) newState.horizontalSwing = current.horizontalSwing;
  }
  if (current.light !== null) newState.light = current.light;
  log(`Sensibo POST: ${JSON.stringify(newState)}`);
  if (CFG.dryRun) return;
  await api(apiKey, `/pods/${POD}/acStates`, "POST", { acState: newState });
  log("Sensibo-state succesvol verstuurd");
}

/* =========================================================
 * 6. BUITENTEMPERATUUR EN KOUDBEVEILIGING
 * ========================================================= */

function readOutdoorTemperature(weatherDevice, mhiDevice) {
  const weatherTemperature = Number(value(weatherDevice, "measure_temperature"));
  if (validTemperature(weatherTemperature, CFG.outdoor.minimumPlausible, CFG.outdoor.maximumPlausible)) {
    return { valid: true, temperature: weatherTemperature, source: "OpenWeather" };
  }
  const mhiTemperature = Number(value(mhiDevice, CFG.outdoor.mhiCapability));
  if (validTemperature(mhiTemperature, CFG.outdoor.minimumPlausible, CFG.outdoor.maximumPlausible)) {
    log(`Buitentemperatuur fallback naar MHI: ${mhiTemperature} °C`);
    return { valid: true, temperature: mhiTemperature, source: "MHI Beneden" };
  }
  log("WAARSCHUWING | Geen geldige buitentemperatuur; koeling geblokkeerd");
  return { valid: false, temperature: null, source: "geen" };
}
function selectColdProtection(vacationActive, occupied, outdoor, roomTemperature) {
  if (vacationActive) {
    if (!CFG.vacationHeating.enabled) return { active: false, type: "VACATION_OFF", config: null };
    if (outdoor.valid && outdoor.temperature < CFG.vacationHeating.frostOutdoorThreshold) {
      return { active: true, type: "VACATION_FROST", config: CFG.vacationHeating.frost };
    }
    if (roomTemperature < CFG.vacationHeating.absoluteIndoorStart) {
      return { active: true, type: "VACATION_ABSOLUTE", config: CFG.vacationHeating.absolute };
    }
    return { active: false, type: "VACATION_OFF", config: null };
  }
  if (occupied) return { active: false, type: "OCCUPIED", config: null };
  if (!CFG.awayHeating.enabled) return { active: false, type: "AWAY_OFF", config: null };
  if (outdoor.valid && outdoor.temperature < CFG.awayHeating.frostOutdoorThreshold) {
    return { active: true, type: "AWAY_FROST", config: CFG.awayHeating.frost };
  }
  if (outdoor.valid && outdoor.temperature < CFG.awayHeating.coldOutdoorThreshold) {
    return { active: true, type: "AWAY_COLD", config: CFG.awayHeating.cold };
  }
  if (roomTemperature < CFG.awayHeating.absoluteIndoorStart) {
    return { active: true, type: "AWAY_ABSOLUTE", config: CFG.awayHeating.absolute };
  }
  return { active: false, type: "AWAY_OFF", config: null };
}
function coldProtectionDecision(protection, ac, roomTemperature, outdoor) {
  const config = protection.config;
  const heatingNow = ac.power && ac.mode === "heat";
  const shouldStart = roomTemperature < config.heatStart;
  const shouldContinue = heatingNow && roomTemperature < config.heatStop;
  const outsideText = outdoor.valid ? `${outdoor.temperature} C` : "onbekend";
  if (shouldStart || shouldContinue) {
    return {
      desired: { power: true, mode: "heat", target: config.heatTarget, fan: config.fan },
      heating: true,
      reason: `${protection.type}; binnen ${roomTemperature} C; buiten ${outsideText}; band ${config.heatStart}-${config.heatStop} C`
    };
  }
  return {
    desired: { power: false }, heating: false,
    reason: `${protection.type}; bescherming niet nodig; binnen ${roomTemperature} C; buiten ${outsideText}`
  };
}

/* =========================================================
 * 7. FANREGELING V14.1
 * ========================================================= */

function fanRank(fan) {
  return { quiet: 1, low: 2, medium: 3, medium_high: 4, high: 5, auto: 6, strong: 7 }[fan] || 0;
}

/* Algemene fanregeling voor koeling. */
function wantedFan(delta) {
  if (delta >= CFG.fan.mediumDelta) return "medium";
  if (delta >= CFG.fan.lowDelta) return "low";
  return "quiet";
}

/*
 * Verwarmingsregeling ten opzichte van effectieve comforttemperatuur.
 * Door een kleine epsilon blijven decimalen als 20,5 betrouwbaar op de grens.
 */
function wantedHeatingFan(roomTemperature, profile) {
  const deficit = Math.max(0, profile.comfort - roomTemperature);
  const epsilon = 0.0001;
  if (deficit + epsilon >= CFG.fan.heating.mediumDelta) return "medium";
  if (deficit + epsilon >= CFG.fan.heating.lowDelta) return "low";
  return "quiet";
}
function selectFan(state, current, wanted) {
  if (!current || current === wanted || fanRank(wanted) > fanRank(current)) return wanted;
  if (!["quiet", "low", "medium"].includes(current)) return wanted;
  const lastChange = finiteTimestamp(state.lastFanChange);
  if (lastChange === null) return wanted;
  const elapsedMinutes = (Date.now() - lastChange) / 60000;
  if (elapsedMinutes >= CFG.fan.reduceDelayMinutes) return wanted;
  log(`Fanreductie uitgesteld | ${elapsedMinutes.toFixed(1)} van ${CFG.fan.reduceDelayMinutes} min`);
  return current;
}
function applyHeatingTrendBoost(selectedFan, prediction, roomTemperature, profile) {
  if (!prediction.available) return selectedFan;
  const deficit = profile.comfort - roomTemperature;
  const boostNeeded = deficit >= CFG.fan.heatingTrendBoostMinimumDeficit &&
    prediction.smoothedTrendPerHour <= CFG.fan.heatingTrendBoostThreshold;
  if (!boostNeeded || fanRank(selectedFan) >= fanRank("medium")) return selectedFan;
  log(`FAN BOOST | EMA-trend ${prediction.smoothedTrendPerHour.toFixed(2)} °C/u | tekort ${deficit.toFixed(1)} °C | ${selectedFan} → medium`);
  return "medium";
}
function applyHeatingPredictionBoost(selectedFan, prediction, roomTemperature, profile) {
  if (!prediction.available) return selectedFan;
  const boostNeeded = roomTemperature < profile.comfort && prediction.predictedTemperature < profile.heatStart;
  if (!boostNeeded || fanRank(selectedFan) >= fanRank("low")) return selectedFan;
  log(`FAN PREDICTION BOOST | actual ${roomTemperature.toFixed(1)} °C | predicted ${prediction.predictedTemperature.toFixed(1)} °C | heatStart ${profile.heatStart.toFixed(1)} °C | ${selectedFan} → low`);
  return "low";
}
function determineHeatingFan(state, ac, prediction, roomTemperature, profile) {
  let fan = selectFan(state, ac.fan, wantedHeatingFan(roomTemperature, profile));
  fan = applyHeatingPredictionBoost(fan, prediction, roomTemperature, profile);
  fan = applyHeatingTrendBoost(fan, prediction, roomTemperature, profile);
  return fan;
}

/* =========================================================
 * 8. SCHUIFPUI
 * ========================================================= */

function updateDoorStatus(state, open) {
  let changed = false;
  if (!open) {
    if (state.doorOpenSince !== null) {
      state.doorOpenSince = null;
      changed = true;
      log("Schuifpui gesloten; timer gewist");
    }
    return { changed, status: { open: false, minutes: 0, stop: false } };
  }
  if (state.doorOpenSince === null) {
    state.doorOpenSince = Date.now();
    changed = true;
    log("Schuifpui geopend; timer gestart");
  }
  const minutes = (Date.now() - state.doorOpenSince) / 60000;
  return { changed, status: { open: true, minutes, stop: minutes >= CFG.doorMinutes } };
}

/* =========================================================
 * 9. HISTORIE EN TRENDS
 * ========================================================= */

function updateTemperatureHistory(state, temperature) {
  const now = Date.now();
  const cutoff = now - CFG.prediction.maximumHistoryAgeMinutes * 60000;
  const previousLength = state.temperatureHistory.length;
  state.temperatureHistory = state.temperatureHistory.filter(sample => sample.time >= cutoff && sample.time <= now);
  let changed = state.temperatureHistory.length !== previousLength;
  const history = state.temperatureHistory;
  const last = history.length ? history[history.length - 1] : null;
  const interval = CFG.prediction.sampleIntervalMinutes * 60000;
  const sampleAdded = !last || now - last.time >= interval;
  if (sampleAdded) {
    history.push({ time: now, temperature });
    changed = true;
    log(`Predictive sample opgeslagen: ${temperature} °C | ${history.length} meetpunt(en)`);
  } else {
    log(`Predictive history behouden | ${history.length} meetpunt(en) | laatste ${((now - last.time) / 60000).toFixed(1)} min geleden`);
  }
  if (history.length > CFG.prediction.maximumSamples) {
    state.temperatureHistory = history.slice(-CFG.prediction.maximumSamples);
    changed = true;
  }
  return { changed, sampleAdded, history: state.temperatureHistory };
}
function calculateRawRegressionTrend(history) {
  const now = Date.now();
  const cutoff = now - CFG.prediction.historyMinutes * 60000;
  const samples = history.filter(sample => sample.time >= cutoff && sample.time <= now);
  if (samples.length < CFG.prediction.minimumSamples) {
    return { available: false, samples, spanMinutes: 0, reason: `${samples.length} van ${CFG.prediction.minimumSamples} metingen` };
  }
  const firstTime = samples[0].time;
  const lastTime = samples[samples.length - 1].time;
  const spanMinutes = (lastTime - firstTime) / 60000;
  if (spanMinutes + 0.05 < CFG.prediction.minimumSpanMinutes) {
    return { available: false, samples, spanMinutes, reason: `meetperiode ${spanMinutes.toFixed(1)} min` };
  }
  const points = samples.map(sample => ({ x: (sample.time - firstTime) / 3600000, y: sample.temperature }));
  const count = points.length;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / count;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / count;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    const dx = point.x - meanX;
    numerator += dx * (point.y - meanY);
    denominator += dx * dx;
  }
  if (denominator === 0) return { available: false, samples, spanMinutes, reason: "geen tijdspreiding" };
  const rawTrend = numerator / denominator;
  if (!Number.isFinite(rawTrend) || Math.abs(rawTrend) > CFG.prediction.maximumAbsoluteRawTrendPerHour) {
    return { available: false, samples, spanMinutes, reason: `ongeldige raw trend ${rawTrend}` };
  }
  return { available: true, samples, spanMinutes, rawTrendPerHour: rawTrend, reason: "beschikbaar" };
}
function calculatePrediction(state, history, currentTemperature, sampleAdded) {
  const base = calculateRawRegressionTrend(history);
  const result = {
    available: false, rawTrendPerHour: null, smoothedTrendPerHour: null,
    effectiveTrendPerHour: null, predictedTemperature: null, predictionDelta: null,
    samples: base.samples?.length || 0, spanMinutes: base.spanMinutes || 0,
    reason: base.reason, stateChanged: false
  };
  if (!CFG.prediction.enabled) { result.reason = "uitgeschakeld"; return result; }
  if (!base.available) return result;
  const rawTrend = base.rawTrendPerHour;
  let smoothedTrend = state.smoothedTrendPerHour;
  if (sampleAdded || !Number.isFinite(smoothedTrend)) {
    smoothedTrend = Number.isFinite(smoothedTrend)
      ? CFG.prediction.emaAlpha * rawTrend + (1 - CFG.prediction.emaAlpha) * smoothedTrend
      : rawTrend;
    state.smoothedTrendPerHour = smoothedTrend;
    result.stateChanged = true;
  }
  const effectiveTrend = Math.abs(smoothedTrend) < CFG.prediction.trendDeadbandPerHour ? 0 : smoothedTrend;
  const unrestrictedDelta = effectiveTrend * (CFG.prediction.forecastMinutes / 60);
  const boundedDelta = clamp(unrestrictedDelta, -CFG.prediction.maxPredictionDrop, CFG.prediction.maxPredictionRise);
  Object.assign(result, {
    available: true,
    rawTrendPerHour: rawTrend,
    smoothedTrendPerHour: smoothedTrend,
    effectiveTrendPerHour: effectiveTrend,
    predictionDelta: boundedDelta,
    predictedTemperature: currentTemperature + boundedDelta,
    samples: base.samples.length,
    spanMinutes: base.spanMinutes,
    reason: "beschikbaar"
  });
  return result;
}
function predictiveHeatingNeeded(temperature, profile, prediction) {
  return prediction.available &&
    prediction.effectiveTrendPerHour <= -CFG.prediction.minimumHeatingTrendPerHour &&
    temperature >= profile.heatStart &&
    temperature <= profile.heatStart + CFG.prediction.heatEarlyStartMargin &&
    prediction.predictedTemperature < profile.heatStart;
}
function predictiveCoolingNeeded(temperature, profile, prediction, coolingAllowed) {
  return prediction.available && coolingAllowed &&
    prediction.effectiveTrendPerHour >= CFG.prediction.minimumCoolingTrendPerHour &&
    temperature <= profile.coolStart &&
    temperature >= profile.coolStart - CFG.prediction.coolEarlyStartMargin &&
    prediction.predictedTemperature > profile.coolStart;
}

/* =========================================================
 * 10. KOELING, ANTI-SCHIMMEL EN INSIGHTS
 * ========================================================= */

function coolingMinutes(state) {
  const started = finiteTimestamp(state.coolingStarted);
  if (started === null) return 0;
  return Math.max(0, Math.min((Date.now() - started) / 60000, CFG.cooling.maximumSessionMinutes));
}
function antiMoldStatus(state) {
  const until = finiteTimestamp(state.antiMoldUntil);
  if (until === null) return { active: false, expired: false, remaining: 0 };
  const remaining = until - Date.now();
  return { active: remaining > 0, expired: remaining <= 0, remaining: Math.max(0, remaining / 60000) };
}
async function setInsightValue(device, capability, numericValue) {
  if (!device || !Number.isFinite(numericValue)) return false;
  if (!Object.prototype.hasOwnProperty.call(device.capabilitiesObj || {}, capability)) {
    log(`INSIGHTS | Capability ontbreekt: ${capability}`);
    return false;
  }
  if (CFG.dryRun) return true;
  try {
    await Homey.devices.setCapabilityValue({ deviceId: device.id, capabilityId: capability, value: numericValue });
    return true;
  } catch (error) {
    log(`INSIGHTS ERROR | ${capability}: ${error.message}`);
    return false;
  }
}
async function writeInsights(device, roomTemperature, outdoor, profile, prediction) {
  if (!INSIGHTS.enabled || !device) return;
  const predicted = prediction.available ? prediction.predictedTemperature : roomTemperature;
  const trend = prediction.available ? prediction.effectiveTrendPerHour : 0;
  const measurements = [
    [INSIGHTS.capabilities.actual, roomTemperature],
    [INSIGHTS.capabilities.predicted, predicted],
    [INSIGHTS.capabilities.comfort, profile.comfort],
    [INSIGHTS.capabilities.heatStart, profile.heatStart],
    [INSIGHTS.capabilities.coolStart, profile.coolStart],
    [INSIGHTS.capabilities.outdoor, outdoor.valid ? outdoor.temperature : null],
    [INSIGHTS.capabilities.trend, trend]
  ];
  let success = 0;
  for (const [capability, numericValue] of measurements) {
    if (await setInsightValue(device, capability, numericValue)) success++;
  }
  log(`INSIGHTS | ${success}/7 | Actual ${roomTemperature.toFixed(1)} °C | Predictive ${predicted.toFixed(1)} °C | EMA/effectief ${trend >= 0 ? "+" : ""}${trend.toFixed(2)} °C/u`);
}

/* =========================================================
 * 11. STATEVERSCHILLEN
 * ========================================================= */

function differences(current, desired) {
  const changes = [];
  if (current.power !== desired.power) changes.push(desired.power ? "UIT → AAN" : "AAN → UIT");
  if (!desired.power) return changes;
  if (current.mode !== desired.mode) changes.push(`modus ${current.mode || "onbekend"} → ${desired.mode}`);
  if (desired.mode !== "fan" && Number(current.target) !== Number(desired.target)) {
    changes.push(`setpoint ${current.target ?? "onbekend"} → ${desired.target} °C`);
  }
  if (current.fan !== desired.fan) changes.push(`fan ${current.fan || "onbekend"} → ${desired.fan}`);
  if (desired.power && desired.mode === "heat") {
    if (current.swing !== CFG.airflow.heat.swing) changes.push(`vertical airflow ${current.swing || "onbekend"} → ${CFG.airflow.heat.swing}`);
    if (current.horizontalSwing !== CFG.airflow.heat.horizontalSwing) changes.push(`horizontal airflow ${current.horizontalSwing || "onbekend"} → ${CFG.airflow.heat.horizontalSwing}`);
  }
  return changes;
}

/* =========================================================
 * 12. VALIDATIE EN ACTUELE STATUS
 * ========================================================= */

if (!API || !API.startsWith("https://")) throw new Error("Ongeldige Sensibo API-basis-URL");

const devices = await Homey.devices.getDevices();
const logic = await Homey.logic.getVariables();

const sensiboApiKeyVariable = Object.values(logic).find(variable =>
  String(variable?.name || "").trim().toLowerCase() === LOGIC.sensiboApiKeyName.toLowerCase()
) || null;
requireItem(sensiboApiKeyVariable, LOGIC.sensiboApiKeyName);
if (sensiboApiKeyVariable.type !== "string") {
  throw new Error(`${LOGIC.sensiboApiKeyName} moet een tekstvariabele zijn; gevonden: ${sensiboApiKeyVariable.type}`);
}
const sensiboApiKey = String(sensiboApiKeyVariable.value || "").trim();
if (!sensiboApiKey) throw new Error(`${LOGIC.sensiboApiKeyName} is leeg`);
const vincent = devices[DEV.vincent];
const roos = devices[DEV.roos];
const presenceOverride = devices[DEV.presenceOverride];
const doorDevice = devices[DEV.slidingDoor];
const weatherDevice = devices[DEV.weather];
const mhiOutdoorDevice = devices[DEV.mhiOutdoor];
const climateAnalysisDevice = devices[DEV.climateAnalysis];
const vacationVariable = logic[LOGIC.vacation];
const sleepingVariable = logic[LOGIC.sleeping];
const climateStateVariable = logic[LOGIC.climateState];
const comfortBoostVariable = Object.values(logic).find(variable =>
  String(variable?.name || "").trim().toLowerCase() === CFG.comfortBoost.variableName.toLowerCase()
) || null;

requireItem(vincent, "Vincent");
requireItem(roos, "Roos");
requireItem(presenceOverride, "Presence override");
requireItem(doorDevice, "Schuifpui");
requireItem(mhiOutdoorDevice, "MHI Beneden");
requireItem(vacationVariable, "Vakantie");
requireItem(sleepingVariable, "Slapen");
requireItem(climateStateVariable, "MHI Climate state");
requireItem(comfortBoostVariable, CFG.comfortBoost.variableName);
if (sleepingVariable.type !== "boolean") throw new Error(`Slapen moet boolean zijn; gevonden: ${sleepingVariable.type}`);
if (climateStateVariable.type !== "string") throw new Error(`MHI Climate state moet string zijn; gevonden: ${climateStateVariable.type}`);
if (comfortBoostVariable.type !== "boolean") throw new Error(`${CFG.comfortBoost.variableName} moet boolean zijn; gevonden: ${comfortBoostVariable.type}`);
requireCapability(vincent, "Vincent", "presence");
requireCapability(roos, "Roos", "presence");
requireCapability(presenceOverride, "Presence override", "onoff");
requireCapability(doorDevice, "Schuifpui", "alarm_contact");
requireCapability(mhiOutdoorDevice, "MHI Beneden", CFG.outdoor.mhiCapability);
if (!climateAnalysisDevice) log("WAARSCHUWING | Klimaat Analyse woonkamer ontbreekt; Insights overgeslagen");

const sensibo = await readSensibo(sensiboApiKey);
const ac = sensibo.ac;
const roomTemperature = sensibo.temperature;
const state = loadClimateState(climateStateVariable);
let stateChanged = false;
const vincentHome = Boolean(value(vincent, "presence"));
const roosHome = Boolean(value(roos, "presence"));
const overrideActive = Boolean(value(presenceOverride, "onoff"));
const occupied = vincentHome || roosHome || overrideActive;
const vacationActive = isTruthy(vacationVariable.value);
const sleeping = sleepingVariable.value === true;
const profileSelection = determineProfile(sleeping);
const baseProfile = profileSelection.profile;
const comfortBoostActive = CFG.comfortBoost.enabled && comfortBoostVariable.value === true;
const boostIncrease = comfortBoostActive ? CFG.comfortBoost.temperatureIncrease : 0;
const profile = {
  ...baseProfile,
  comfort: baseProfile.comfort + boostIncrease,
  heatStart: baseProfile.heatStart + boostIncrease,
  heatStop: baseProfile.heatStop + boostIncrease
};
const period = profileSelection.period;

let comfortBoostTransition = null;
if (state.comfortBoostActive !== comfortBoostActive) {
  comfortBoostTransition = comfortBoostActive ? "STARTED" : "ENDED";
  state.comfortBoostActive = comfortBoostActive;
  state.comfortBoostChangedAt = Date.now();
  stateChanged = true;
  log(`COMFORT BOOST | status=${comfortBoostTransition} | basis=${baseProfile.comfort.toFixed(1)} °C | effectief=${profile.comfort.toFixed(1)} °C | heatStart=${profile.heatStart.toFixed(1)} °C | heatStop=${profile.heatStop.toFixed(1)} °C`);
}
if (state.lastProfile !== profileSelection.profileKey) {
  const previousProfile = state.lastProfile || "onbekend";
  state.lastProfile = profileSelection.profileKey;
  state.temperatureHistory = [];
  state.smoothedTrendPerHour = null;
  stateChanged = true;
  log(`PROFIELWISSEL | ${previousProfile} → ${profileSelection.profileKey} | historie en EMA gereset`);
}
log(`PROFIEL | ${period} | lokale tijd ${profileSelection.clock.text} | Slapen=${sleeping} | reden=${profileSelection.reason} | comfort ${profile.comfort.toFixed(1)} °C | heatStart ${profile.heatStart.toFixed(1)} °C | heatStop ${profile.heatStop.toFixed(1)} °C | target ${profile.heatTarget} °C | ComfortBoost=${comfortBoostActive} | boost=${boostIncrease.toFixed(1)} °C`);

const doorResult = updateDoorStatus(state, Boolean(value(doorDevice, "alarm_contact")));
const door = doorResult.status;
stateChanged = stateChanged || doorResult.changed;
const outdoor = readOutdoorTemperature(weatherDevice, mhiOutdoorDevice);
const coolingAllowed = outdoor.valid && outdoor.temperature >= CFG.outdoor.coolingMinimum;
const coldProtection = selectColdProtection(vacationActive, occupied, outdoor, roomTemperature);
log(`KOUDBEVEILIGING | type=${coldProtection.type} | actief=${coldProtection.active} | binnen=${roomTemperature} C | buiten=${outdoor.valid ? `${outdoor.temperature} C` : "onbekend"}`);
const sampleResult = updateTemperatureHistory(state, roomTemperature);
stateChanged = stateChanged || sampleResult.changed;
const prediction = calculatePrediction(state, sampleResult.history, roomTemperature, sampleResult.sampleAdded);
stateChanged = stateChanged || prediction.stateChanged;
const predictiveHeat = !ac.power && predictiveHeatingNeeded(roomTemperature, profile, prediction);
const predictiveCool = !ac.power && predictiveCoolingNeeded(roomTemperature, profile, prediction, coolingAllowed);
if (ac.power && ac.mode === "cool" && state.coolingStarted === null) {
  state.coolingStarted = Date.now();
  stateChanged = true;
  log("Actieve koeling gedetecteerd; cooling-timer gestart");
}
if (stateChanged) await saveClimateState(climateStateVariable, state, "status, profiel, historie, EMA en comfort boost");
if (comfortBoostTransition === "STARTED") {
  await timeline(`🔥 Comfort boost actief | comfort ${baseProfile.comfort.toFixed(1)} → ${profile.comfort.toFixed(1)} °C | Flow schakelt de boost na 60 minuten uit`);
} else if (comfortBoostTransition === "ENDED") {
  await timeline(`✅ Comfort boost beëindigd | comfort terug naar ${baseProfile.comfort.toFixed(1)} °C`);
}
if (sampleResult.sampleAdded && climateAnalysisDevice) {
  await writeInsights(climateAnalysisDevice, roomTemperature, outdoor, profile, prediction);
}
const cooledMinutes = coolingMinutes(state);
const mold = antiMoldStatus(state);
log(`Aanwezig Vincent=${vincentHome} | Roos=${roosHome} | Override=${overrideActive} | Vakantie=${vacationActive}`);
log(`Schuifpui open=${door.open} | open ${door.minutes.toFixed(1)} min | stop=${door.stop}`);
log(`Kamer ${roomTemperature}°C | buiten ${outdoor.valid ? `${outdoor.temperature}°C via ${outdoor.source}` : "onbekend"} | koeling toegestaan=${coolingAllowed} | Sensibo ${ac.power ? "AAN" : "UIT"} ${ac.mode}/${ac.target}°C/${ac.fan}`);
if (prediction.available) {
  log(`V14.1 TREND | ${prediction.samples} samples / ${prediction.spanMinutes.toFixed(1)} min | raw ${prediction.rawTrendPerHour >= 0 ? "+" : ""}${prediction.rawTrendPerHour.toFixed(2)} | EMA ${prediction.smoothedTrendPerHour >= 0 ? "+" : ""}${prediction.smoothedTrendPerHour.toFixed(2)} | effectief ${prediction.effectiveTrendPerHour >= 0 ? "+" : ""}${prediction.effectiveTrendPerHour.toFixed(2)} °C/u | delta ${prediction.predictionDelta >= 0 ? "+" : ""}${prediction.predictionDelta.toFixed(2)} °C | +${CFG.prediction.forecastMinutes}m ${prediction.predictedTemperature.toFixed(1)} °C | startHeat=${predictiveHeat} | startCool=${predictiveCool}`);
} else log(`V14.1 TREND | niet beschikbaar: ${prediction.reason}`);

/* =========================================================
 * 13. BESLISLOGICA
 * ========================================================= */

let desired = null;
let reason = "";
let result = "HOLD";
const effects = { clearCooling: false, startCooling: false, cancelMold: false, startMold: false, completeMold: false };

if (door.stop) {
  desired = { power: false };
  reason = `schuifpui ${door.minutes.toFixed(1)} min open`;
  result = "DOOR_OPEN";
  effects.clearCooling = true;
  effects.cancelMold = true;
} else if (vacationActive) {
  if (coldProtection.active) {
    const decision = coldProtectionDecision(coldProtection, ac, roomTemperature, outdoor);
    desired = decision.desired;
    reason = decision.reason;
    result = decision.heating ? "VACATION_HEATING" : "VACATION_PROTECTED";
  } else {
    desired = { power: false };
    reason = "vakantie actief; koudbeveiliging niet nodig";
    result = "VACATION";
  }
  effects.clearCooling = true;
  effects.cancelMold = true;
} else if (!occupied) {
  if (coldProtection.active) {
    const decision = coldProtectionDecision(coldProtection, ac, roomTemperature, outdoor);
    desired = decision.desired;
    reason = decision.reason;
    result = decision.heating ? "AWAY_HEATING" : "AWAY_PROTECTED";
  } else {
    desired = { power: false };
    reason = "niemand thuis; koudbeveiliging niet nodig";
    result = "AWAY";
  }
  effects.clearCooling = true;
  effects.cancelMold = true;
} else if (roomTemperature < profile.heatStart || predictiveHeat) {
  const fan = determineHeatingFan(state, ac, prediction, roomTemperature, profile);
  desired = { power: true, mode: "heat", target: profile.heatTarget, fan };
  if (predictiveHeat) {
    reason = `voorspellend verwarmen; ${roomTemperature} °C; EMA ${prediction.smoothedTrendPerHour.toFixed(2)} °C/u; verwacht ${prediction.predictedTemperature.toFixed(1)} °C`;
    result = "PREDICTIVE_HEATING";
  } else {
    reason = `verwarmen; kamer ${roomTemperature} °C`;
    result = "HEATING";
  }
  effects.clearCooling = true;
  effects.cancelMold = true;
} else if ((roomTemperature > profile.coolStart || predictiveCool) && coolingAllowed) {
  const excess = Math.max(0, roomTemperature - profile.comfort);
  const fan = selectFan(state, ac.fan, wantedFan(excess));
  desired = { power: true, mode: "cool", target: profile.coolTarget, fan };
  if (predictiveCool) {
    reason = `voorspellend koelen; ${roomTemperature} °C; EMA +${prediction.smoothedTrendPerHour.toFixed(2)} °C/u; verwacht ${prediction.predictedTemperature.toFixed(1)} °C`;
    result = "PREDICTIVE_COOLING";
  } else {
    reason = `koelen; kamer ${roomTemperature} °C`;
    result = "COOLING";
  }
  effects.startCooling = true;
  effects.cancelMold = true;
} else if (mold.active) {
  desired = { power: true, mode: "fan", target: null, fan: CFG.antiMold.fanLevel };
  reason = `anti-schimmel; nog ${mold.remaining.toFixed(1)} min`;
  result = "ANTI_MOLD";
} else if (mold.expired) {
  desired = { power: false };
  reason = "anti-schimmel afgerond";
  result = "ANTI_MOLD_COMPLETE";
  effects.completeMold = true;
} else if (ac.power && ac.mode === "heat" && roomTemperature <= profile.heatStop) {
  const fan = determineHeatingFan(state, ac, prediction, roomTemperature, profile);
  desired = { power: true, mode: "heat", target: profile.heatTarget, fan };
  reason = `verwarming actief; ${roomTemperature} °C`;
  result = "HEATING";
  effects.clearCooling = true;
  effects.cancelMold = true;
} else if (ac.power && ac.mode === "heat" && roomTemperature > profile.heatStop) {
  desired = { power: false };
  reason = `verwarmingsdoel bereikt; ${roomTemperature} °C`;
  result = "HEATING_STOP";
  effects.clearCooling = true;
} else if (ac.power && ac.mode === "cool" && roomTemperature >= profile.coolStop && coolingAllowed) {
  const excess = Math.max(0, roomTemperature - profile.comfort);
  const fan = selectFan(state, ac.fan, wantedFan(excess));
  desired = { power: true, mode: "cool", target: profile.coolTarget, fan };
  reason = `koeling actief; ${roomTemperature} °C`;
  result = "COOLING";
  effects.startCooling = true;
} else if (ac.power && ac.mode === "cool") {
  if (CFG.antiMold.enabled && cooledMinutes >= CFG.antiMold.minimumCoolingMinutes) {
    desired = { power: true, mode: "fan", target: null, fan: CFG.antiMold.fanLevel };
    reason = `anti-schimmel gestart na ${cooledMinutes.toFixed(1)} min koelen`;
    result = "ANTI_MOLD_START";
    effects.startMold = true;
  } else {
    desired = { power: false };
    reason = coolingAllowed
      ? `koeling gestopt na ${cooledMinutes.toFixed(1)} min`
      : `koeling gestopt; buitentemperatuur ${outdoor.valid ? `${outdoor.temperature} °C` : "onbekend"}`;
    result = "COOLING_STOP";
    effects.clearCooling = true;
  }
} else if (ac.power && !["heat", "cool"].includes(ac.mode)) {
  if (roomTemperature <= profile.comfort) {
    const fan = determineHeatingFan(state, ac, prediction, roomTemperature, profile);
    desired = { power: true, mode: "heat", target: profile.heatTarget, fan };
    reason = `onbeheerde modus gecorrigeerd; ${roomTemperature} °C`;
    result = "MODE_CORRECTED_TO_HEAT";
    effects.clearCooling = true;
    effects.cancelMold = true;
  } else {
    desired = { power: false };
    reason = `onbeheerde modus gestopt; ${roomTemperature} °C`;
    result = "UNMANAGED_MODE_STOP";
    effects.clearCooling = true;
    effects.cancelMold = true;
  }
} else {
  desired = null;
  reason = `comfortzone; ${roomTemperature} °C`;
  result = "HOLD";
}

/* =========================================================
 * 14. UITVOEREN, STATE-EFFECTEN EN RESULTAAT
 * ========================================================= */

let changes = [];
let actionSucceeded = true;
if (desired) {
  changes = differences(ac, desired);
  log(`Gewenst: ${JSON.stringify(desired)}`);
  log(`Verschillen: ${changes.length ? changes.join(" | ") : "geen"}`);
  if (changes.length) {
    try { await setSensibo(sensiboApiKey, ac, desired); }
    catch (error) {
      actionSucceeded = false;
      log(`Sensibo-opdracht mislukt: ${error.message}`);
      throw error;
    }
  }
}
if (actionSucceeded) {
  let effectStateChanged = false;
  if (effects.cancelMold && state.antiMoldUntil !== null) { state.antiMoldUntil = null; effectStateChanged = true; }
  if (effects.completeMold && state.antiMoldUntil !== null) { state.antiMoldUntil = null; effectStateChanged = true; }
  if (effects.clearCooling && state.coolingStarted !== null) { state.coolingStarted = null; effectStateChanged = true; }
  if (effects.startCooling && state.coolingStarted === null) {
    state.coolingStarted = Date.now();
    effectStateChanged = true;
    log("Cooling-timer geregistreerd");
  }
  if (effects.startMold) {
    state.antiMoldUntil = Date.now() + CFG.antiMold.fanMinutes * 60000;
    state.coolingStarted = null;
    effectStateChanged = true;
    log(`Anti-schimmeltimer gestart voor ${CFG.antiMold.fanMinutes} minuten`);
  }
  if (changes.length && desired?.power && desired?.fan && desired.fan !== ac.fan) {
    state.lastFanChange = Date.now();
    effectStateChanged = true;
  }
  if (effectStateChanged) await saveClimateState(climateStateVariable, state, "klimaateffecten");
}
if (actionSucceeded && changes.length) {
  let icon = "⚙️";
  if (["HEATING", "PREDICTIVE_HEATING", "MODE_CORRECTED_TO_HEAT", "AWAY_HEATING", "VACATION_HEATING"].includes(result)) icon = "🔥";
  else if (["COOLING", "PREDICTIVE_COOLING"].includes(result)) icon = "❄️";
  else if (["ANTI_MOLD", "ANTI_MOLD_START"].includes(result)) icon = "💨";
  else if (result === "ANTI_MOLD_COMPLETE") icon = "✅";
  else if (result === "DOOR_OPEN") icon = "🚪";
  else if (["VACATION", "VACATION_PROTECTED"].includes(result)) icon = "🏖️";
  else if (["AWAY", "AWAY_PROTECTED"].includes(result)) icon = "🏠";
  else if (["HEATING_STOP", "COOLING_STOP", "UNMANAGED_MODE_STOP"].includes(result)) icon = "⏹️";
  await timeline(`${icon} ${reason} | ${changes.join(" | ")}`);
}
const outsideText = outdoor.valid ? `${outdoor.temperature}°C via ${outdoor.source}` : "onbekend";
const predictionText = prediction.available
  ? `${prediction.samples} samples | EMA ${prediction.smoothedTrendPerHour >= 0 ? "+" : ""}${prediction.smoothedTrendPerHour.toFixed(2)}°C/u | effectief ${prediction.effectiveTrendPerHour >= 0 ? "+" : ""}${prediction.effectiveTrendPerHour.toFixed(2)}°C/u → ${prediction.predictedTemperature.toFixed(1)}°C`
  : prediction.reason;
log(`${period} | ${profileSelection.clock.text} | Slapen=${sleeping} | ComfortBoost=${comfortBoostActive} | comfort=${profile.comfort.toFixed(1)}°C | binnen ${roomTemperature}°C | buiten ${outsideText} | V14.1 bescherming=${coldProtection.type} | ${predictionText} | Insights ${sampleResult.sampleAdded ? "UPDATE" : "-"} | Sensibo ${ac.power ? "AAN" : "UIT"} ${ac.mode}/${ac.target}°C/${ac.fan} | ${result} | wijzigingen ${changes.length}`);
return `${period} | ${profileSelection.clock.text} | Slapen=${sleeping} | ComfortBoost=${comfortBoostActive} | comfort=${profile.comfort.toFixed(1)}°C | ${roomTemperature}°C | buiten ${outsideText} | V14.1 bescherming=${coldProtection.type} | ${predictionText} | Insights ${sampleResult.sampleAdded ? "UPDATE" : "-"} | ${result} | ${changes.length} wijziging(en)`;
