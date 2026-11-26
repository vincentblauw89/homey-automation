/**
 * ============================================================
 * CENTRALE VERLICHTING V11.4
 * ============================================================
 *
 * FUNCTIES
 * --------
 * - Centrale Hue-regeling Beneden / Hal / Buiten
 * - Daglichtregeling
 * - Koken
 * - Slapen
 * - Killswitch / oppasmodus
 * - Vakantie
 * - Persistente state
 * - 30 minuten recovery synchronisatie
 * - Timeline logging
 * - 1,5 seconde debounce voor vrijwel gelijktijdige triggers
 *
 * DEBOUNCE
 * --------
 * HomeyScript ondersteunt geen setTimeout().
 * Daarom gebruiken we _.delay().
 *
 * V11.4
 * -----
 * - Thuiskomst via het Nuki-slot (argument "arrival"): wordt de
 *   voordeur ontgrendeld terwijl Homey nog denkt dat niemand thuis
 *   is, dan gaat de verlichting meteen naar de normale stand.
 *   Smart Presence (wifi) ziet je vaak pas 30 s tot enkele minuten
 *   later. De aangenomen aanwezigheid geldt maximaal 10 minuten,
 *   of tot Homey je echt als thuis ziet. Komt die bevestiging niet,
 *   dan gaat de volgende run terug naar de afwezigheidsstand.
 * - Bij Vakantie of als er al iemand thuis is doet "arrival" niets
 *   extra's; weggaan (ontgrendelen terwijl je nog thuis bent)
 *   verandert dus niets.
 *
 * V11.3
 * -----
 * - Killswitch werkt nu ook als niemand thuis is: de normale
 *   binnenregeling draait dan alsof er iemand thuis is
 *   (voorheen bleef de verlichting in de afwezigheidsstand hangen).
 * - Logtijden in Nederlandse tijd (voorheen UTC).
 *
 * ARGUMENTEN
 * ----------
 * geen argument  -> evaluate
 * evaluate
 * arrival       -> voordeur ontgrendeld (Nuki)
 * vacation_on
 * vacation_off
 * status
 * dryrun
 */



// ============================================================
// CONFIG
// ============================================================


const CONFIG = {


  VERSION: 11.4,


  DEBUG: true,


  DEFAULT_DRY_RUN: false,


  DEBOUNCE_MS:
    1500,


  FORCE_REFRESH_AFTER_MS:
    30 * 60 * 1000,


  /*
   * Thuiskomst via het slot: zo lang geldt het huis als bewoond
   * totdat Homey-aanwezigheid het bevestigt.
   */
  ARRIVAL_HOLD_MINUTES:
    10,


  STATE_VARIABLE_ID:
    'dffa4c35-a6b4-4f4a-a34c-296231b27731',


  VACATION_VARIABLE_NAME:
    'Vakantie',


  TIMELINE: {


    ENABLED: true,


    URI:
      'homey:manager:notifications',


    ID:
      'homey:manager:notifications:create_notification',


    MAX_LENGTH:
      500
  },


  devices: {


    killswitch:
      '8289ad2c-ac79-45be-ac3d-76f2c4e8df7e',


    livingLuxSensor:
      '1ceab678-c32d-466c-bf53-b42c1cb95c60',


    hallLuxSensor:
      '634cc6c3-84c7-47dd-8ba5-1d3d6411aa9f'
  },


  variables: {


    lightingNeeded:
      '45549971-2ff2-42ce-875d-5a656cb39959',


    hallLightingNeeded:
      '9368efef-e1ae-48d8-a003-12442419fb52',


    daylight:
      '2b3a7478-fb6a-4c2f-a798-5a216544b5e0',


    sleeping:
      '87545b27-39b9-4f0f-b048-1a02c25771e6',


    cooking:
      '4339508d-1880-4c78-b36a-b14130774c48'
  },


  hue: {


    bridgeId:
      'ecb5fafffe131fa6',


    groups: {


      downstairs: {
        id: '3',
        name: 'Beneden'
      },


      livingRoom: {
        id: '1',
        name: 'Woonkamer'
      },


      diningRoom: {
        id: '4',
        name: 'Eetkamer'
      },


      hall: {
        id: '83',
        name: 'Hal'
      },


      outside: {
        id: '12',
        name: 'Buiten'
      },


      frontDoorOutside: {
        id: '16',
        name: 'Buiten voordeur'
      }
    },


    scenes: {


      atmosphere: {
        id: 'ezFCHu1VmnZAHF8',
        name: 'Sfeer scène'
      },


      cooking: {
        id: 'DKmFXUwVgokP9bk',
        name: 'Gezellig koken'
      },

      kitchenDimmed: {
        id: 'kR7JdG9nLkroQij',
        name: 'Gedimd keuken'
      },


      hallNormal: {
        id: '2sBANmfPJ-9721sO',
        name: 'Hal normaal'
      },


      hallNight: {
        id: 'debe4b67-cfdd-40a5-87b1-409f6667cbd1',
        name: 'Hal nacht'
      },


      gardenStandard: {
        id: 'SRTLfH-GakKgLai',
        name: 'Standaard achtertuin'
      },


      frontDoorDimmed: {
        id: 'gHeXqAFg-w1KoSB',
        name: 'Gedimd voordeur'
      }
    }
  }
};



// ============================================================
// MODI
// ============================================================


const DOWNSTAIRS_MODE = {


  OFF:
    'OFF',


  ATMOSPHERE:
    'ATMOSPHERE',


  COOKING:
    'COOKING',


  COOKING_DAYLIGHT:
    'COOKING_DAYLIGHT',

  AWAY:
    'AWAY'
};



const HALL_MODE = {


  OFF:
    'OFF',


  NORMAL:
    'NORMAL',


  NIGHT:
    'NIGHT'
};



const OUTSIDE_MODE = {


  OFF:
    'OFF',


  ON:
    'ON'
};



const VACATION_LIGHTING = {


  OFF:
    'OFF',


  ON:
    'ON'
};



// ============================================================
// RUNTIME
// ============================================================


const STARTED_AT =
  Date.now();


const changes = [];
const holds = [];
const warnings = [];
const errors = [];


const timelineItems = [];


const executedActions =
  new Set();


let eventName =
  'evaluate';


let dryRun =
  CONFIG.DEFAULT_DRY_RUN;


let stateWasInvalid =
  false;


let stateWasMigrated =
  false;


let debounceSuperseded =
  false;


let scriptState =
  createEmptyState();



// ============================================================
// BASISFUNCTIES
// ============================================================


function createEmptyState() {


  return {


    version:
      CONFIG.VERSION,


    updated:
      null,


    lastForce:
      null,


    vacationLighting:
      null,


    arrivalUntil:
      null,


    debounce: {


      token:
        null,


      requestedAt:
        null
    },


    targets: {


      downstairs:
        null,


      hall:
        null,


      outside:
        null,


      frontdoor:
        null
    }
  };
}



function timestamp() {


  return new Date()
    .toLocaleTimeString(
      'nl-NL',
      {
        hour12: false,
        timeZone: 'Europe/Amsterdam'
      }
    );
}



function log(
  level,
  message
) {


  console.log(
    `${timestamp()} | ${level} | ${message}`
  );
}



function info(message) {


  log(
    'INFO',
    message
  );
}



function debug(message) {


  if (
    CONFIG.DEBUG
  ) {


    log(
      'DEBUG',
      message
    );
  }
}



function hold(message) {


  holds.push(
    message
  );


  log(
    'HOLD',
    message
  );
}



function warn(message) {


  warnings.push(
    message
  );


  log(
    'WARN',
    message
  );
}



function fail(message) {


  errors.push(
    message
  );


  log(
    'ERROR',
    message
  );
}



// ============================================================
// HOMEYSCRIPT DELAY
// ============================================================


async function delay(ms) {


  /*
   * HomeyScript heeft geen setTimeout().
   *
   * _.delay() is wél beschikbaar.
   */


  return new Promise(
    resolve => {


      _.delay(
        resolve,
        ms
      );
    }
  );
}



function randomToken() {


  return (
    `${Date.now()}-` +
    `${Math.random()
      .toString(36)
      .substring(2, 12)}`
  );
}



// ============================================================
// ARGUMENT
// ============================================================


function readArgument() {


  if (
    typeof args === 'undefined' ||
    args === null
  ) {


    return 'evaluate';
  }



  let value =
    args;



  if (
    Array.isArray(args)
  ) {


    value =
      args[0];
  }



  if (
    value === undefined ||
    value === null
  ) {


    return 'evaluate';
  }



  value =
    String(value)
      .trim()
      .toLowerCase();



  return value ||
    'evaluate';
}



eventName =
  readArgument();



if (
  eventName === 'dryrun'
) {


  dryRun =
    true;


  eventName =
    'evaluate';
}



// ============================================================
// HOMEY DATA
// ============================================================


async function loadDevices() {


  return (
    await Homey.devices.getDevices()
  ) || {};
}



async function loadVariables() {


  return (
    await Homey.logic.getVariables()
  ) || {};
}



async function loadActions() {


  return (
    await Homey.flow.getFlowCardActions()
  ) || {};
}



// ============================================================
// DEVICES
// ============================================================


function getDevice(
  devices,
  id,
  description
) {


  const device =
    devices[id];



  if (!device) {


    warn(
      `Apparaat niet gevonden: ` +
      `${description} (${id})`
    );



    return null;
  }



  return device;
}



function capability(
  device,
  capabilityId,
  fallback = null
) {


  if (!device) {


    return fallback;
  }



  const object =
    device.capabilitiesObj?.[
      capabilityId
    ];



  if (
    object &&
    object.value !== undefined
  ) {


    return object.value;
  }



  return fallback;
}



// ============================================================
// LOGIC
// ============================================================


function variableValue(
  variables,
  id,
  description,
  fallback
) {


  const variable =
    variables[id];



  if (!variable) {


    warn(
      `Variabele ontbreekt: ` +
      `${description} (${id})`
    );



    return fallback;
  }



  return variable.value;
}



function findVariableByName(
  variables,
  name
) {


  const wanted =
    String(name)
      .trim()
      .toLowerCase();



  return (
    Object.values(
      variables ||
      {}
    )
      .find(
        variable =>


          String(
            variable.name ||
            ''
          )
            .trim()
            .toLowerCase() === wanted
      )


    ||


    null
  );
}



function toBoolean(
  value,
  fallback = false
) {


  if (
    value === true ||
    value === false
  ) {


    return value;
  }



  if (
    typeof value === 'number'
  ) {


    return value !== 0;
  }



  if (
    typeof value === 'string'
  ) {


    const normalized =
      value
        .trim()
        .toLowerCase();



    if (
      [
        'ja',
        'yes',
        'true',
        'aan',
        'on',
        '1'
      ].includes(
        normalized
      )
    ) {


      return true;
    }



    if (
      [
        'nee',
        'no',
        'false',
        'uit',
        'off',
        '0'
      ].includes(
        normalized
      )
    ) {


      return false;
    }
  }



  return fallback;
}



// ============================================================
// STATE
// ============================================================


function normalizeState(
  parsed
) {


  return {


    version:
      CONFIG.VERSION,


    updated:
      parsed?.updated ||
      null,


    lastForce:
      parsed?.lastForce ||
      null,


    vacationLighting:
      parsed?.vacationLighting ||
      null,


    arrivalUntil:
      parsed?.arrivalUntil ||
      null,


    debounce: {


      token:
        parsed?.debounce?.token ||
        null,


      requestedAt:
        parsed?.debounce?.requestedAt ||
        null
    },


    targets: {


      downstairs:
        parsed?.targets?.downstairs ??
        null,


      hall:
        parsed?.targets?.hall ??
        null,


      outside:
        parsed?.targets?.outside ??
        null,


      frontdoor:
        parsed?.targets?.frontdoor ??
        null
    }
  };
}



function parseStateValue(
  rawValue
) {


  const parsed =
    JSON.parse(
      rawValue
    );



  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {


    throw new Error(
      'State bevat geen JSON-object'
    );
  }



  return parsed;
}



async function loadState(
  variables
) {


  const variable =
    variables[
      CONFIG.STATE_VARIABLE_ID
    ];



  if (!variable) {


    warn(
      `Statevariabele niet gevonden: ` +
      `${CONFIG.STATE_VARIABLE_ID}`
    );



    stateWasInvalid =
      true;



    scriptState =
      createEmptyState();



    return;
  }



  try {


    const parsed =
      parseStateValue(
        variable.value
      );



    stateWasMigrated =
      parsed.version !==
      CONFIG.VERSION;



    scriptState =
      normalizeState(
        parsed
      );



    if (
      stateWasMigrated
    ) {


      info(
        `STATE MEMORY | gemigreerd naar V10 | ` +
        `${JSON.stringify(scriptState)}`
      );



    } else {


      info(
        `STATE MEMORY | geladen | ` +
        `vakantie=${scriptState.vacationLighting ?? 'onbekend'} | ` +
        `targets=${JSON.stringify(scriptState.targets)}`
      );
    }



    if (
      scriptState.updated
    ) {


      debug(
        `STATE MEMORY | laatst bijgewerkt ` +
        `${scriptState.updated}`
      );
    }



    if (
      scriptState.lastForce
    ) {


      debug(
        `STATE MEMORY | laatste force ` +
        `${scriptState.lastForce}`
      );
    }



  } catch (error) {


    info(
      'STATE MEMORY | ongeldige state -> opnieuw initialiseren'
    );



    debug(
      `STATE MEMORY | leesfout: ` +
      `${error?.message || String(error)}`
    );



    stateWasInvalid =
      true;



    scriptState =
      createEmptyState();
  }
}



async function writeRawState(
  state
) {


  await Homey.logic.updateVariable({


    id:
      CONFIG.STATE_VARIABLE_ID,


    variable: {


      value:
        JSON.stringify(
          state
        )
    }
  });
}



async function saveState() {


  if (
    dryRun
  ) {


    debug(
      'STATE MEMORY | dry-run -> niet opgeslagen'
    );



    return;
  }



  scriptState.debounce = {


    token:
      null,


    requestedAt:
      null
  };



  scriptState.version =
    CONFIG.VERSION;



  scriptState.updated =
    new Date()
      .toISOString();



  try {


    await writeRawState(
      scriptState
    );



    debug(
      `STATE MEMORY | opgeslagen | ` +
      `vakantie=${scriptState.vacationLighting ?? 'onbekend'} | ` +
      `targets=${JSON.stringify(scriptState.targets)}`
    );



  } catch (error) {


    warn(
      `State opslaan mislukt: ` +
      `${error?.message || String(error)}`
    );
  }
}



// ============================================================
// DEBOUNCE
// ============================================================


function shouldDebounce() {


  return (
    eventName ===
    'evaluate'


    &&


    !dryRun
  );
}



async function registerDebounceRequest() {


  const variables =
    await loadVariables();



  const stateVariable =
    variables[
      CONFIG.STATE_VARIABLE_ID
    ];



  if (!stateVariable) {


    warn(
      'Debounce overgeslagen: statevariabele ontbreekt'
    );



    return null;
  }



  let state;



  try {


    state =
      normalizeState(
        parseStateValue(
          stateVariable.value
        )
      );



  } catch (_) {


    state =
      createEmptyState();
  }



  const token =
    randomToken();



  state.debounce = {


    token,


    requestedAt:
      new Date()
        .toISOString()
  };



  try {


    await writeRawState(
      state
    );



    debug(
      `DEBOUNCE | geregistreerd | ` +
      `token=${token} | ` +
      `wacht=${CONFIG.DEBOUNCE_MS} ms`
    );



    return token;



  } catch (error) {


    warn(
      `Debounce registreren mislukt: ` +
      `${error?.message || String(error)}`
    );



    return null;
  }
}



async function debounceIsStillLatest(
  token
) {


  if (!token) {


    return true;
  }



  /*
   * BELANGRIJK:
   *
   * Geen setTimeout().
   * HomeyScript gebruikt _.delay().
   */


  await delay(
    CONFIG.DEBOUNCE_MS
  );



  const variables =
    await loadVariables();



  const stateVariable =
    variables[
      CONFIG.STATE_VARIABLE_ID
    ];



  if (!stateVariable) {


    warn(
      'Debouncecontrole overgeslagen: statevariabele ontbreekt'
    );



    return true;
  }



  try {


    const current =
      parseStateValue(
        stateVariable.value
      );



    const currentToken =
      current?.debounce?.token ||
      null;



    const latest =
      currentToken ===
      token;



    if (!latest) {


      debounceSuperseded =
        true;



      hold(
        'Debounce: nieuwere evaluate-run gevonden'
      );



      debug(
        `DEBOUNCE | gestopt | ` +
        `eigen=${token} | ` +
        `actueel=${currentToken}`
      );



      return false;
    }



    debug(
      `DEBOUNCE | laatste trigger bevestigd | ` +
      `token=${token}`
    );



    return true;



  } catch (error) {


    warn(
      `Debouncecontrole mislukt: ` +
      `${error?.message || String(error)}`
    );



    return true;
  }
}



// ============================================================
// FORCE REFRESH
// ============================================================


function shouldForceRefresh() {


  if (
    stateWasInvalid
  ) {


    return true;
  }



  if (
    !scriptState.lastForce
  ) {


    return true;
  }



  const lastForce =
    new Date(
      scriptState.lastForce
    )
      .getTime();



  if (
    !Number.isFinite(
      lastForce
    )
  ) {


    return true;
  }



  const elapsed =
    Date.now() -
    lastForce;



  debug(
    `FORCE | laatste volledige synchronisatie ` +
    `${Math.round(elapsed / 60000)} minuut/minuten geleden`
  );



  return (
    elapsed >=
    CONFIG.FORCE_REFRESH_AFTER_MS
  );
}



// ============================================================
// AANWEZIGHEID
// ============================================================


async function getPresence() {


  try {


    const users =
      await Homey.users.getUsers();



    const presentUsers =
      Object.values(
        users ||
        {}
      )
        .filter(
          user =>


            user.present === true


            ||


            user.athome === true


            ||


            user.isAtHome === true


            ||


            user.presence === 'home'
        );



    return {


      available:
        true,


      anyoneHome:
        presentUsers.length > 0,


      noOneHome:
        presentUsers.length === 0,


      count:
        presentUsers.length
    };



  } catch (error) {


    warn(
      `Aanwezigheid niet beschikbaar: ` +
      `${error?.message || String(error)}`
    );



    return {


      available:
        false,


      anyoneHome:
        true,


      noOneHome:
        false,


      count:
        null
    };
  }
}



// ============================================================
// FLOWCARD HELPERS
// ============================================================


function flowCardSearchText(
  key,
  card
) {


  return JSON.stringify({


    key,


    id:
      card?.id,


    uri:
      card?.uri,


    ownerUri:
      card?.ownerUri,


    title:
      card?.title,


    titleFormatted:
      card?.titleFormatted


  }).toLowerCase();
}



function normalizeCardId(
  value
) {


  if (
    !value ||
    typeof value !== 'string'
  ) {


    return null;
  }



  return value.replace(
    /^homey:flowcardaction:/,
    ''
  );
}



function determineAppUri(
  fullId
) {


  const match =
    fullId.match(
      /^(homey:app:[^:]+):/
    );



  if (!match) {


    throw new Error(
      `Geen app-URI gevonden in ${fullId}`
    );
  }



  return match[1];
}



function findFlowCard(
  actions,
  matcher,
  description
) {


  const entry =
    Object.entries(
      actions ||
      {}
    )
      .find(
        ([key, card]) =>


          matcher(
            flowCardSearchText(
              key,
              card
            )
          )
      );



  if (!entry) {


    throw new Error(
      `FlowCard niet gevonden: ${description}`
    );
  }



  const [
    collectionKey,
    card
  ] = entry;



  const id =
    normalizeCardId(


      card?.id ||
      collectionKey
    );



  if (!id) {


    throw new Error(
      `Ongeldig FlowCard-ID: ${description}`
    );
  }



  const uri =
    determineAppUri(
      id
    );



  debug(
    `${description} gevonden | ` +
    `URI=${uri} | ID=${id}`
  );



  return {
    uri,
    id
  };
}



function findHueGroupOffCard(
  actions
) {


  return findFlowCard(


    actions,


    text =>


      text.includes(
        'nl.philips.hue'
      )


      &&


      (
        text.includes(
          'groupoff'
        )


        ||


        text.includes(
          'group_off'
        )
      ),


    'Philips Hue groep uit'
  );
}



function findHueSetSceneCard(
  actions
) {


  return findFlowCard(


    actions,


    text =>


      text.includes(
        'nl.philips.hue'
      )


      &&


      (
        text.includes(
          'setscene'
        )


        ||


        text.includes(
          'set_scene'
        )
      ),


    'Philips Hue scène'
  );
}



// ============================================================
// ACTIE DEDUP
// ============================================================


function mayExecute(
  actionKey
) {


  if (
    executedActions.has(
      actionKey
    )
  ) {


    debug(
      `Dubbele actie overgeslagen: ${actionKey}`
    );



    return false;
  }



  executedActions.add(
    actionKey
  );



  return true;
}



// ============================================================
// HUE GROUP OFF
// ============================================================


async function executeGroupOff(
  context,
  group,
  reason
) {


  const actionKey =
    `groupOff:${group.id}`;



  if (
    !mayExecute(
      actionKey
    )
  ) {


    return true;
  }



  if (
    dryRun
  ) {


    info(
      `[DRY RUN] ${reason}: ${group.name} uit`
    );



    changes.push(
      `${group.name} -> OFF`
    );



    return true;
  }



  try {


    const card =
      findHueGroupOffCard(
        context.actions
      );



    const hueArgs = {


      group: {


        id:
          group.id,


        name:
          group.name,


        bridge_id:
          CONFIG.hue.bridgeId
      }
    };



    debug(
      `RUN GROUP OFF | ` +
      `groep=${group.name} | ` +
      `uri=${card.uri} | ` +
      `id=${card.id}`
    );



    await Homey.flow.runFlowCardAction({


      uri:
        card.uri,


      id:
        card.id,


      args:
        hueArgs
    });



    info(
      `${reason}: ${group.name} uitgeschakeld`
    );



    changes.push(
      `${group.name} -> OFF`
    );



    return true;



  } catch (error) {


    fail(
      `${reason} ${group.name}: ` +
      `${error?.message || String(error)}`
    );



    return false;
  }
}



// ============================================================
// HUE SCENE
// ============================================================


async function executeScene(
  context,
  scene,
  reason
) {


  const actionKey =
    `scene:${scene.id}`;



  if (
    !mayExecute(
      actionKey
    )
  ) {


    return true;
  }



  if (
    dryRun
  ) {


    info(
      `[DRY RUN] ${reason}: ${scene.name}`
    );



    changes.push(
      `${reason}: ${scene.name}`
    );



    return true;
  }



  try {


    const card =
      findHueSetSceneCard(
        context.actions
      );



    const hueArgs = {


      scene: {


        id:
          scene.id,


        name:
          scene.name,


        bridge_id:
          CONFIG.hue.bridgeId
      }
    };



    debug(
      `RUN SCENE | ` +
      `scène=${scene.name} | ` +
      `uri=${card.uri} | ` +
      `id=${card.id}`
    );



    await Homey.flow.runFlowCardAction({


      uri:
        card.uri,


      id:
        card.id,


      args:
        hueArgs
    });



    info(
      `${reason}: ${scene.name} geactiveerd`
    );



    changes.push(
      `${reason}: ${scene.name}`
    );



    return true;



  } catch (error) {


    fail(
      `${reason} ${scene.name}: ` +
      `${error?.message || String(error)}`
    );



    return false;
  }
}



// ============================================================
// TIMELINE
// ============================================================


function addTimelineItem(
  text
) {


  if (
    !text ||
    timelineItems.includes(
      text
    )
  ) {


    return;
  }



  timelineItems.push(
    text
  );
}



function downstairsTimelineLabel(
  mode
) {


  switch (
    mode
  ) {


    case DOWNSTAIRS_MODE.OFF:


      return 'Beneden → uit';



    case DOWNSTAIRS_MODE.ATMOSPHERE:


      return 'Beneden → sfeer';



    case DOWNSTAIRS_MODE.COOKING:


      return 'Beneden → gezellig koken';



    case DOWNSTAIRS_MODE.COOKING_DAYLIGHT:


      return 'Koken met daglicht';

    case DOWNSTAIRS_MODE.AWAY:

      return 'Afwezig → gedimde keuken';



    default:


      return `Beneden → ${mode}`;
  }
}



function hallTimelineLabel(
  mode
) {


  switch (
    mode
  ) {


    case HALL_MODE.OFF:


      return 'Hal → uit';



    case HALL_MODE.NORMAL:


      return 'Hal → normaal';



    case HALL_MODE.NIGHT:


      return 'Hal → nacht';



    default:


      return `Hal → ${mode}`;
  }
}



function outsideTimelineLabel(
  zone,
  mode
) {


  const label =
    zone === 'frontdoor'
      ? 'Voordeur'
      : 'Buiten';



  return (
    mode ===
    OUTSIDE_MODE.OFF
  )
    ? `${label} → uit`
    : `${label} → aan`;
}



function determineTimelinePrefix(
  context
) {


  if (
    context.vacation
  ) {


    return '🏖️ Vakantie';
  }



  if (
    context.sleeping &&
    !context.killswitchOn
  ) {


    return '🌙 Verlichting';
  }



  if (
    context.cooking
  ) {


    return '🍳 Verlichting';
  }



  return '💡 Verlichting';
}



async function sendTimeline(
  context
) {


  if (
    !CONFIG.TIMELINE.ENABLED ||
    timelineItems.length === 0
  ) {


    return false;
  }



  const prefix =
    determineTimelinePrefix(
      context
    );



  let message =
    `${prefix} | ` +
    `${timelineItems.join(' | ')}`;



  if (
    message.length >
    CONFIG.TIMELINE.MAX_LENGTH
  ) {


    message =
      `${message.substring(
        0,
        CONFIG.TIMELINE.MAX_LENGTH -
        3
      )}...`;
  }



  if (
    dryRun
  ) {


    info(
      `[DRY RUN] TIMELINE | ${message}`
    );



    return true;
  }



  try {


    debug(
      `RUN TIMELINE | ` +
      `uri=${CONFIG.TIMELINE.URI} | ` +
      `id=${CONFIG.TIMELINE.ID} | ` +
      `text=${message}`
    );



    await Homey.flow.runFlowCardAction({


      uri:
        CONFIG.TIMELINE.URI,


      id:
        CONFIG.TIMELINE.ID,


      args: {


        text:
          message
      }
    });



    info(
      `TIMELINE | ${message}`
    );



    return true;



  } catch (error) {


    warn(
      `Timeline-melding mislukt: ` +
      `${error?.message || String(error)}`
    );



    return false;
  }
}



// ============================================================
// TARGET
// ============================================================


function getTargetTransition(
  zone,
  desired,
  force
) {


  const previous =
    scriptState.targets[
      zone
    ];



  const semanticChange =
    previous !==
    desired;



  if (
    !force &&
    !semanticChange
  ) {


    hold(
      `${zone} blijft ${desired}`
    );



    return {


      shouldExecute:
        false,


      semanticChange:
        false,


      previous,


      desired
    };
  }



  debug(
    `TARGET | ${zone}: ` +
    `${previous ?? 'onbekend'} -> ${desired}` +
    `${force ? ' | FORCE' : ''}`
  );



  return {


    shouldExecute:
      true,


    semanticChange,


    previous,


    desired
  };
}



function recordTarget(
  zone,
  desired
) {


  scriptState.targets[
    zone
  ] =
    desired;
}



// ============================================================
// BENEDEN
// ============================================================


async function applyDownstairsMode(
  context,
  desiredMode,
  reason,
  force = false
) {


  if (
    desiredMode === null
  ) {


    hold(
      reason
    );



    return false;
  }



  const transition =
    getTargetTransition(
      'downstairs',
      desiredMode,
      force
    );



  if (
    !transition.shouldExecute
  ) {


    return false;
  }



  let success =
    false;



  switch (
    desiredMode
  ) {



    case DOWNSTAIRS_MODE.OFF:


      success =
        await executeGroupOff(
          context,
          CONFIG.hue.groups.downstairs,
          reason
        );


      break;



    case DOWNSTAIRS_MODE.ATMOSPHERE:


      success =
        await executeScene(
          context,
          CONFIG.hue.scenes.atmosphere,
          reason
        );


      break;



    case DOWNSTAIRS_MODE.COOKING:


      success =
        await executeScene(
          context,
          CONFIG.hue.scenes.cooking,
          reason
        );


      break;



    case DOWNSTAIRS_MODE.COOKING_DAYLIGHT: {


      const sceneSuccess =
        await executeScene(
          context,
          CONFIG.hue.scenes.cooking,
          'Kookmodus herstellen'
        );



      const livingSuccess =
        await executeGroupOff(
          context,
          CONFIG.hue.groups.livingRoom,
          'Daglicht woonkamer'
        );



      const diningSuccess =
        await executeGroupOff(
          context,
          CONFIG.hue.groups.diningRoom,
          'Daglicht eetkamer'
        );



      success =
        sceneSuccess &&
        livingSuccess &&
        diningSuccess;



      if (
        success
      ) {


        info(
          'Koken met daglicht: keuken blijft actief'
        );
      }



      break;
    }

    case DOWNSTAIRS_MODE.AWAY: {
      /*
       * Gewone afwezigheid, los van Vakantie:
       * - eerst beneden uit zodat woonkamer/eetkamer niet blijven branden;
       * - daarna alleen de Hue-scène Gedimd keuken activeren.
       */
      const downstairsOff = await executeGroupOff(
        context,
        CONFIG.hue.groups.downstairs,
        'Afwezig: beneden reset'
      );

      const kitchenDimmed = await executeScene(
        context,
        CONFIG.hue.scenes.kitchenDimmed,
        'Afwezig: gedimde keuken'
      );

      success = downstairsOff && kitchenDimmed;
      break;
    }





    default:


      fail(
        `Onbekende benedenmodus: ${desiredMode}`
      );


      break;
  }



  if (
    success
  ) {


    recordTarget(
      'downstairs',
      desiredMode
    );



    if (
      transition.semanticChange
    ) {


      addTimelineItem(
        downstairsTimelineLabel(
          desiredMode
        )
      );



      if (
        desiredMode ===
        DOWNSTAIRS_MODE.COOKING_DAYLIGHT
      ) {


        addTimelineItem(
          'Woonkamer → uit'
        );



        addTimelineItem(
          'Eetkamer → uit'
        );
      }
    }
  }



  return success;
}



// ============================================================
// HAL
// ============================================================


async function applyHallMode(
  context,
  desiredMode,
  force = false
) {


  const transition =
    getTargetTransition(
      'hall',
      desiredMode,
      force
    );



  if (
    !transition.shouldExecute
  ) {


    return false;
  }



  let success =
    false;



  switch (
    desiredMode
  ) {



    case HALL_MODE.OFF:


      success =
        await executeGroupOff(
          context,
          CONFIG.hue.groups.hall,
          'Halregeling'
        );


      break;



    case HALL_MODE.NORMAL:


      success =
        await executeScene(
          context,
          CONFIG.hue.scenes.hallNormal,
          'Hal normaal'
        );


      break;



    case HALL_MODE.NIGHT:


      success =
        await executeScene(
          context,
          CONFIG.hue.scenes.hallNight,
          'Hal nacht'
        );


      break;



    default:


      fail(
        `Onbekende halmodus: ${desiredMode}`
      );


      break;
  }



  if (
    success
  ) {


    recordTarget(
      'hall',
      desiredMode
    );



    if (
      transition.semanticChange
    ) {


      addTimelineItem(
        hallTimelineLabel(
          desiredMode
        )
      );
    }
  }



  return success;
}



// ============================================================
// NORMALE BINNENREGELING
// ============================================================


function determineNormalDownstairsMode(
  context
) {


  if (
    context.sleeping &&
    context.killswitchOn
  ) {


    return {


      mode:
        null,


      reason:
        'Nachtmodus geblokkeerd door Killswitch'
    };
  }



  if (
    context.sleeping
  ) {


    return {


      mode:
        DOWNSTAIRS_MODE.OFF,


      reason:
        'Nachtmodus'
    };
  }



  if (
    context.lightingNeeded
  ) {


    if (
      !context.presence.anyoneHome &&
      !context.killswitchOn
    ) {


      return {


        mode:
          null,


        reason:
          'Verlichting nodig, maar niemand thuis'
      };
    }



    if (
      context.cooking
    ) {


      return {


        mode:
          DOWNSTAIRS_MODE.COOKING,


        reason:
          'Koken'
      };
    }



    return {


      mode:
        DOWNSTAIRS_MODE.ATMOSPHERE,


      reason:
        'Algemene verlichting'
    };
  }



  if (
    context.cooking
  ) {


    return {


      mode:
        DOWNSTAIRS_MODE.COOKING_DAYLIGHT,


      reason:
        'Koken met voldoende daglicht'
    };
  }



  return {


    mode:
      DOWNSTAIRS_MODE.OFF,


    reason:
      'Daglichtregeling'
  };
}



async function regulateNormalInside(
  context,
  force
) {


  const downstairsDecision =
    determineNormalDownstairsMode(
      context
    );



  let hallMode;



  if (
    !context.hallLightingNeeded
  ) {


    hallMode =
      HALL_MODE.OFF;



  } else if (
    context.sleeping &&
    !context.killswitchOn
  ) {


    hallMode =
      HALL_MODE.NIGHT;



  } else {


    hallMode =
      HALL_MODE.NORMAL;
  }



  info(
    `NORMAAL | ` +
    `beneden=${downstairsDecision.mode ?? 'BEHOUDEN'} | ` +
    `hal=${hallMode}`
  );



  await applyDownstairsMode(
    context,
    downstairsDecision.mode,
    downstairsDecision.reason,
    force
  );



  await applyHallMode(
    context,
    hallMode,
    force
  );
}



// ============================================================
// VAKANTIE
// ============================================================


function initializeVacationPhase(
  context
) {


  scriptState.vacationLighting =
    context.daylight
      ? VACATION_LIGHTING.OFF
      : VACATION_LIGHTING.ON;



  info(
    `VAKANTIE | fase geïnitialiseerd op ` +
    `${scriptState.vacationLighting} via Daglicht`
  );
}



async function regulateVacationInside(
  context,
  force
) {


  if (
    !scriptState.vacationLighting
  ) {


    initializeVacationPhase(
      context
    );



    force =
      true;
  }



  const vacationOn =
    scriptState.vacationLighting ===
    VACATION_LIGHTING.ON;



  const downstairsMode =
    vacationOn
      ? DOWNSTAIRS_MODE.ATMOSPHERE
      : DOWNSTAIRS_MODE.OFF;



  const hallMode =
    vacationOn
      ? HALL_MODE.NORMAL
      : HALL_MODE.OFF;



  info(
    `VAKANTIE | ` +
    `fase=${scriptState.vacationLighting} | ` +
    `beneden=${downstairsMode} | ` +
    `hal=${hallMode}`
  );



  await applyDownstairsMode(
    context,
    downstairsMode,
    vacationOn
      ? 'Vakantieverlichting aan'
      : 'Vakantieverlichting uit',
    force
  );



  await applyHallMode(
    context,
    hallMode,
    force
  );
}



async function regulateInside(
  context,
  force
) {


  if (
    context.vacation
  ) {


    await regulateVacationInside(
      context,
      force
    );



    return;
  }



  await regulateNormalInside(
    context,
    force
  );
}



function processVacationEvent(
  context
) {


  if (
    eventName !==
    'vacation_on'


    &&


    eventName !==
    'vacation_off'
  ) {


    return false;
  }



  if (
    !context.vacation
  ) {


    hold(
      `${eventName} genegeerd: ` +
      `Vakantie staat niet op Ja`
    );



    return false;
  }



  scriptState.vacationLighting =
    eventName ===
    'vacation_on'
      ? VACATION_LIGHTING.ON
      : VACATION_LIGHTING.OFF;



  info(
    `VAKANTIE EVENT | ${eventName} | ` +
    `fase=${scriptState.vacationLighting}`
  );



  return true;
}



// ============================================================
// BUITEN
// ============================================================


async function applyOutsideMode(
  context,
  zone,
  desiredMode,
  group,
  scene,
  reason,
  force = false
) {


  const transition =
    getTargetTransition(
      zone,
      desiredMode,
      force
    );



  if (
    !transition.shouldExecute
  ) {


    return false;
  }



  let success =
    false;



  if (
    desiredMode ===
    OUTSIDE_MODE.OFF
  ) {


    success =
      await executeGroupOff(
        context,
        group,
        reason
      );



  } else if (
    desiredMode ===
    OUTSIDE_MODE.ON
  ) {


    success =
      await executeScene(
        context,
        scene,
        reason
      );



  } else {


    fail(
      `Onbekende buitenmodus voor ` +
      `${zone}: ${desiredMode}`
    );
  }



  if (
    success
  ) {


    recordTarget(
      zone,
      desiredMode
    );



    if (
      transition.semanticChange
    ) {


      addTimelineItem(
        outsideTimelineLabel(
          zone,
          desiredMode
        )
      );
    }
  }



  return success;
}



async function regulateOutside(
  context,
  force
) {


  const desiredMode =
    context.daylight
      ? OUTSIDE_MODE.OFF
      : OUTSIDE_MODE.ON;



  info(
    `BUITEN | ` +
    `daglicht=${context.daylight} | ` +
    `gewenste modus=${desiredMode}`
  );



  await applyOutsideMode(
    context,
    'outside',
    desiredMode,
    CONFIG.hue.groups.outside,
    CONFIG.hue.scenes.gardenStandard,
    'Buitenverlichting',
    force
  );



  await applyOutsideMode(
    context,
    'frontdoor',
    desiredMode,
    CONFIG.hue.groups.frontDoorOutside,
    CONFIG.hue.scenes.frontDoorDimmed,
    'Voordeurverlichting',
    force
  );
}



// ============================================================
// AFWEZIG
// ============================================================


async function regulateAway(
  context,
  force
) {


  if (
    context.vacation
  ) {


    hold(
      'Afwezigheidsactie genegeerd vanwege Vakantie'
    );



    return;
  }



  if (
    context.presence.anyoneHome
  ) {


    hold(
      'Afwezigheidsactie niet nodig: iemand thuis'
    );



    return;
  }



  if (
    !context.presence.available
  ) {


    hold(
      'Afwezigheidsactie geblokkeerd: presence onbekend'
    );



    return;
  }



  if (
    context.killswitchOn
  ) {


    hold(
      'Afwezigheidsactie geblokkeerd door Killswitch'
    );



    return;
  }

  if (context.lightingNeeded) {
    /*
     * Niemand thuis, geen Vakantie, donker genoeg:
     * keuken op Gedimd keuken en hal op Hal nacht.
     */
    await applyDownstairsMode(
      context,
      DOWNSTAIRS_MODE.AWAY,
      'Afwezig en verlichting nodig',
      force
    );

    await applyHallMode(
      context,
      HALL_MODE.NIGHT,
      force
    );

    /* V11.2: applyHallMode logt Hal nacht alleen bij een echte moduswijziging. */
    return;
  }

  /* Niemand thuis, maar voldoende daglicht: alles binnen uit. */
  await applyDownstairsMode(
    context,
    DOWNSTAIRS_MODE.OFF,
    'Afwezig en voldoende daglicht',
    force
  );

  await applyHallMode(
    context,
    HALL_MODE.OFF,
    force
  );
}




// ============================================================
// CONTEXT
// ============================================================


// ============================================================
// THUISKOMST (V11.4)
// ============================================================


function localTimeText(
  ms
) {


  return new Date(ms)
    .toLocaleTimeString(
      'nl-NL',
      {
        timeZone:
          'Europe/Amsterdam',

        hour:
          '2-digit',

        minute:
          '2-digit'
      }
    );
}



/**
 * Verwerkt het argument "arrival" en een eerder aangenomen
 * thuiskomst. Past context.presence aan zolang de thuiskomst
 * geldt. Geeft true als de aanwezigheid deze run is aangenomen.
 */
function applyArrival(
  context
) {


  const now =
    Date.now();


  const presence =
    context.presence;


  let until =
    Date.parse(
      scriptState.arrivalUntil || ''
    );


  if (
    !Number.isFinite(until)
  ) {

    until =
      null;
  }



  if (
    eventName === 'arrival'
  ) {


    if (
      context.vacation
    ) {

      hold(
        'ARRIVAL | Vakantie actief; vakantieregeling blijft leidend'
      );

      scriptState.arrivalUntil =
        null;

      return false;
    }


    if (
      presence.anyoneHome
    ) {

      info(
        'ARRIVAL | er is al iemand thuis; normale regeling'
      );

      scriptState.arrivalUntil =
        null;

      return false;
    }


    until =
      now +
      CONFIG.ARRIVAL_HOLD_MINUTES * 60000;


    scriptState.arrivalUntil =
      new Date(until)
        .toISOString();


    info(
      `ARRIVAL | voordeur ontgrendeld; aanwezigheid aangenomen ` +
      `tot ${localTimeText(until)}`
    );


    addTimelineItem(
      `🔑 Thuiskomst (slot)`
    );

  } else if (
    until !== null
  ) {


    if (
      presence.available &&
      presence.anyoneHome
    ) {

      info(
        'ARRIVAL | bevestigd door aanwezigheid'
      );

      scriptState.arrivalUntil =
        null;

      return false;
    }


    if (
      now >= until ||
      context.vacation
    ) {

      info(
        'ARRIVAL | verlopen zonder bevestiging; ' +
        'terug naar normale aanwezigheid'
      );

      scriptState.arrivalUntil =
        null;

      return false;
    }
  }



  if (
    until === null ||
    now >= until
  ) {

    return false;
  }



  context.presence = {

    ...presence,

    anyoneHome:
      true,

    noOneHome:
      false,

    assumedArrival:
      true
  };


  if (
    eventName !== 'arrival'
  ) {

    info(
      `ARRIVAL | aanwezigheid aangenomen tot ${localTimeText(until)}`
    );
  }


  return true;
}



async function buildContext() {


  const [


    devicesRaw,


    variables,


    actions,


    presence


  ] = await Promise.all([


    loadDevices(),


    loadVariables(),


    loadActions(),


    getPresence()
  ]);



  await loadState(
    variables
  );



  const vacationVariable =
    findVariableByName(
      variables,
      CONFIG.VACATION_VARIABLE_NAME
    );



  if (
    !vacationVariable
  ) {


    warn(
      `Variabele "${CONFIG.VACATION_VARIABLE_NAME}" ` +
      `niet gevonden; Vakantie wordt als Nee behandeld`
    );
  }



  const devices = {


    killswitch:


      getDevice(
        devicesRaw,
        CONFIG.devices.killswitch,
        'Killswitch'
      ),


    livingLuxSensor:


      getDevice(
        devicesRaw,
        CONFIG.devices.livingLuxSensor,
        'Lux woonkamer'
      ),


    hallLuxSensor:


      getDevice(
        devicesRaw,
        CONFIG.devices.hallLuxSensor,
        'Lux hal'
      )
  };



  return {


    actions,


    devices,


    presence,



    vacation:


      toBoolean(
        vacationVariable?.value,
        false
      ),



    lightingNeeded:


      toBoolean(
        variableValue(
          variables,
          CONFIG.variables.lightingNeeded,
          'Verlichting nodig',
          false
        ),
        false
      ),



    hallLightingNeeded:


      toBoolean(
        variableValue(
          variables,
          CONFIG.variables.hallLightingNeeded,
          'Verlichting hal nodig',
          false
        ),
        false
      ),



    daylight:


      toBoolean(
        variableValue(
          variables,
          CONFIG.variables.daylight,
          'Daglicht',
          true
        ),
        true
      ),



    sleeping:


      toBoolean(
        variableValue(
          variables,
          CONFIG.variables.sleeping,
          'Slapen',
          false
        ),
        false
      ),



    cooking:


      toBoolean(
        variableValue(
          variables,
          CONFIG.variables.cooking,
          'Koken',
          false
        ),
        false
      ),



    killswitchOn:


      capability(
        devices.killswitch,
        'onoff',
        false
      ) === true,



    livingLux:


      capability(
        devices.livingLuxSensor,
        'measure_luminance',
        null
      ),



    hallLux:


      capability(
        devices.hallLuxSensor,
        'measure_luminance',
        null
      )
  };
}



// ============================================================
// MAIN
// ============================================================


async function main() {


  info(
    `Scriptargument: ${eventName}`
  );



  info(
    `Dry-run: ${dryRun ? 'JA' : 'NEE'}`
  );



  // ----------------------------------------------------------
  // DEBOUNCE
  // ----------------------------------------------------------


  if (
    shouldDebounce()
  ) {


    const token =
      await registerDebounceRequest();



    const latest =
      await debounceIsStillLatest(
        token
      );



    if (
      !latest
    ) {


      const result = {


        success:
          true,


        version:
          CONFIG.VERSION,


        event:
          eventName,


        debounce: {


          enabled:
            true,


          superseded:
            true,


          waitMs:
            CONFIG.DEBOUNCE_MS
        },


        changes:
          [],


        holds,


        warnings,


        errors:
          []
      };



      info(
        'RESULT | DEBOUNCE | Nieuwere run neemt regeling over'
      );



      return JSON.stringify(
        result
      );
    }
  }



  // ----------------------------------------------------------
  // ACTUELE STATE NA DEBOUNCE
  // ----------------------------------------------------------


  const context =
    await buildContext();



  info(
    `STATE | ` +
    `Vakantie=${context.vacation} | ` +
    `Vakantiefase=${scriptState.vacationLighting ?? 'onbekend'} | ` +
    `Verlichting nodig=${context.lightingNeeded} | ` +
    `Hal nodig=${context.hallLightingNeeded} | ` +
    `Daglicht=${context.daylight} | ` +
    `Slapen=${context.sleeping} | ` +
    `Koken=${context.cooking} | ` +
    `Killswitch=${context.killswitchOn}`
  );



  info(
    `SENSORS | ` +
    `Woonkamer=${context.livingLux ?? 'onbekend'} lx | ` +
    `Hal=${context.hallLux ?? 'onbekend'} lx`
  );



  const arrivalAssumed =
    applyArrival(
      context
    );



  info(
    `PRESENCE | ` +
    `Iemand thuis=${context.presence.anyoneHome} | ` +
    `Aantal=${context.presence.count ?? 'onbekend'} | ` +
    `Bron beschikbaar=${context.presence.available} | ` +
    `Thuiskomst aangenomen=${arrivalAssumed}`
  );



  const vacationEventProcessed =
    processVacationEvent(
      context
    );



  const force =
    shouldForceRefresh();



  info(
    `CONTROL | ` +
    `Debounce=${shouldDebounce()} | ` +
    `State memory=true | ` +
    `Force refresh=${force} | ` +
    `Migrated=${stateWasMigrated} | ` +
    `Vacation event=${vacationEventProcessed}`
  );



  if (
    force
  ) {


    scriptState.lastForce =
      new Date()
        .toISOString();
  }



  // ----------------------------------------------------------
  // ROUTING
  // ----------------------------------------------------------


  switch (
    eventName
  ) {



    case 'vacation_on':


    case 'vacation_off':


      if (
        vacationEventProcessed
      ) {


        await regulateVacationInside(
          context,
          true
        );
      }



      await regulateOutside(
        context,
        false
      );



      break;



    case 'status':


      hold(
        'Alleen status opgevraagd'
      );



      break;



    case 'evaluate':


    default:


      /*
       * V11.2: gewone afwezigheid wordt exclusief afgehandeld.
       * Zo draait de normale binnenregeling niet eerst en voorkomen we
       * bijvoorbeeld NIGHT -> NORMAL -> NIGHT voor de hal.
       * Vakantie blijft los en behoudt de bestaande vakantieprioriteit.
       *
       * V11.3: met de Killswitch aan (oppas thuis) geldt het huis als
       * bewoond en draait de normale binnenregeling.
       */
      if (
        context.presence.noOneHome &&
        !context.vacation &&
        !context.killswitchOn
      ) {


        await regulateAway(
          context,
          force
        );


      } else {


        await regulateInside(
          context,
          force
        );
      }



      await regulateOutside(
        context,
        force
      );



      break;
  }



  // ----------------------------------------------------------
  // STATE OPSLAAN
  // ----------------------------------------------------------


  await saveState();



  // ----------------------------------------------------------
  // TIMELINE
  // ----------------------------------------------------------


  const timelineSent =
    await sendTimeline(
      context
    );



  // ----------------------------------------------------------
  // RESULT
  // ----------------------------------------------------------


  const result = {


    success:
      errors.length === 0,


    version:
      CONFIG.VERSION,


    event:
      eventName,


    dryRun,



    durationMs:
      Date.now() -
      STARTED_AT,



    debounce: {


      enabled:
        shouldDebounce(),


      waitMs:
        shouldDebounce()
          ? CONFIG.DEBOUNCE_MS
          : 0,


      superseded:
        debounceSuperseded
    },



    state: {


      vacation:
        context.vacation,


      vacationLighting:
        scriptState.vacationLighting,


      lightingNeeded:
        context.lightingNeeded,


      hallLightingNeeded:
        context.hallLightingNeeded,


      daylight:
        context.daylight,


      sleeping:
        context.sleeping,


      cooking:
        context.cooking,


      killswitchOn:
        context.killswitchOn,


      anyoneHome:
        context.presence.anyoneHome,


      arrivalAssumed,


      arrivalUntil:
        scriptState.arrivalUntil,


      personsHome:
        context.presence.count,


      livingLux:
        context.livingLux,


      hallLux:
        context.hallLux
    },



    control: {


      forceRefresh:
        force,


      stateWasMigrated,


      stateWasInvalid,


      vacationEventProcessed,


      targets:
        scriptState.targets
    },



    timeline: {


      enabled:
        CONFIG.TIMELINE.ENABLED,


      sent:
        timelineSent,


      items:
        timelineItems
    },



    changes,


    holds,


    warnings,


    errors
  };



  if (
    changes.length === 0 &&
    errors.length === 0
  ) {


    info(
      `RESULT | HOLD | ` +
      `Geen wijziging nodig | ` +
      `${holds.length} hold(s)`
    );



  } else {


    info(
      `RESULT | ${JSON.stringify(result)}`
    );
  }



  return JSON.stringify(
    result
  );
}



// ============================================================
// START
// ============================================================


try {


  return await main();



} catch (error) {


  const message =
    error?.message ||
    String(error);



  fail(
    `Onverwachte scriptfout: ${message}`
  );



  if (
    error?.stack
  ) {


    debug(
      error.stack
    );
  }



  return JSON.stringify({


    success:
      false,


    version:
      CONFIG.VERSION,


    event:
      eventName,


    dryRun,


    error:
      message,


    debounceSuperseded,


    timelineItems,


    changes,


    holds,


    warnings,


    errors
  });
}
