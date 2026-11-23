
  ============================================================
  AIRZONE BOVEN V2.2
  FAST-PATH CONTROLLER MET EUROPEAMSTERDAM TIMEZONE
  ============================================================
 
  Uitvoeren
  - iedere 5 minuten
  - eventueel ook bij wijziging van modus of vakantie
 
  TIMEZONE
  - Alle beslissingen gebruiken EuropeAmsterdam
  - Automatische ondersteuning voor CET en CEST
  - Nooit afhankelijk van de runtime-timezone
 
  WINTER
 
  Master
  - Venster 1800 tot 0600 Nederlandse tijd
  - Start onder 15,0 °C
  - Verwarm tot 17,0 °C
  - Om 0600 altijd uit
 
  Abel en Hugo
  - Venster 1800 tot 0730 Nederlandse tijd
  - Start onder 16,7 °C
  - Stop vanaf 17,2 °C
  - Doel 17,0 °C
 
  Badkamer
  - Avondcomfort 1800 tot 2130 Nederlandse tijd
  - Daarna hard uit tijdens de nacht
  - Voorspellende voorverwarming richting 0600
  - Ochtendcomfort 0600 tot 0730
  - Doel 21,0 °C
  - Verwarmingssnelheid afhankelijk van buitentemperatuur
 
  ZOMER
 
  - Cooling
  - Master 19,0 °C
  - Abel 20,0 °C
  - Hugo 20,0 °C
  - Badkamer 21,0 °C
 
  VAKANTIE
 
  - Overrulet winter en zomer
  - Alle zones 247
  - Start onder 12,0 °C
  - Verwarm tot 12,5 °C
  - Uit vanaf 12,5 °C
 
  MELDINGEN
 
  - 1800-push via Airzone Push bericht
  - Timeline via Airzone Timeline bericht
  - Alleen betekenisvolle acties
 
  FAST PATH
 
  - Geen writes als alles goed staat
  - Geen wachttijd zonder echte write
  - Maximaal 3 pogingen per write
  ============================================================
 


 ============================================================
  1. CONFIGURATIE
  ============================================================
 

const CONFIG = {

    version
        '2.2',

    timezone
        'EuropeAmsterdam',

    devices {

        master
            '748dc15f-8ce0-48af-a658-f679acc7e8f4',

        abel
            'a10c5a80-b5ca-461a-a9ce-2640f0a52a30',

        hugo
            'e2c377d5-a86e-4d65-9d66-16898a41a03e',

        badkamer
            '137c8071-ef8d-492e-b99a-25bb26619fa6'
    },

    logic {

        vacation
            'Vakantie',

        mode
            'Airzone modus',

        pushDate
            'Airzone Push datum',

        pushMessage
            'Airzone Push bericht',

        timelineMessage
            'Airzone Timeline bericht',

        winterActive
            'Airzone Winter actief',

        masterCycle
            'Airzone Master verwarmcyclus',

        outsideTemperature
            'Actuele temp. buiten'
    },

    winter {

        master {

            activeFrom
                '1800',

            activeUntil
                '0600',

            startBelow
                15.0,

            stopAt
                17.0,

            target
                17.0
        },

        bedrooms {

            activeFrom
                '1800',

            activeUntil
                '0730'
        },

        abel {

            startBelow
                16.7,

            stopAt
                17.2,

            target
                17.0
        },

        hugo {

            startBelow
                16.7,

            stopAt
                17.2,

            target
                17.0
        },

        bathroom {

            eveningFrom
                '1800',

            eveningUntil
                '2130',

            morningTargetTime
                '0600',

            morningUntil
                '0730',

            
              Normale comfortregeling in avond en ochtend.
             
            startBelow
                20.2,

            stopAt
                20.7,

            target
                20.5,

            
              Na het bereiken van 21,2 °C in de predictieve fase
              niet opnieuw starten, tenzij de badkamer onder 20,5 °C zakt.
             
            predictiveRestartBelow
                20.0,

            
              Buitentemperatuurmodel
              =10 °C buiten 1,0 °C per uur
              10-20 °C buiten lineair 1,0 - 1,6 °C per uur
              =20 °C buiten 1,6 °C per uur
             
            heatingRateCold
                0.8,

            heatingRateWarm
                1.3,

            heatingRateColdUntil
                10.0,

            heatingRateWarmFrom
                20.0,

            fallbackHeatingRate
                0.8,

            predictiveSafetyMinutes
                15,

            predictiveMaxPreheatMinutes
                300,

            predictiveMinGap
                0.1
        }
    },

    summer {

        master
            19.0,

        abel
            20.0,

        hugo
            20.0,

        badkamer
            21.0
    },

    vacation {

        startBelow
            12.0,

        stopAt
            12.5,

        target
            12.5
    },

    push {

        enabled
            true,

        start
            '1800',

        end
            '1815',

        suppressDuringVacation
            true,

        includeTemperatures
            true,

        includeTargets
            true
    },

    timeline {

        enabled
            true,

        aggregateActions
            true
    },

    timing {

        afterMode
            1500,

        afterInitialOn
            2000,

        afterTarget
            1500,

        afterOff
            1500,

        afterRealChange
            750,

        betweenChangedZones
            1000,

        retryDelay
            3000
    },

    retries
        3,

    targetTolerance
        0.1,

    validTemperature {

        min
            5,

        max
            40
    }
};


 ============================================================
  2. RUNTIME
  ============================================================
 

let deviceCache = {};

let writesThisRun =
    0;

const timelineEvents = [];


 ============================================================
  3. ALGEMENE HELPERS
  ============================================================
 

function normalize(value) {

    return String(value  '')
        .trim()
        .toLowerCase()
        .replace(s+g, ' ');
}


function errorText(error) {

    if (!error) {
        return 'Onbekende fout';
    }

    return (
        error.message 
        String(error)
    );
}


function formatTemp(value) {

    return typeof value === 'number' &&
        Number.isFinite(value)
         `${value.toFixed(1)} °C`
         'onbekend';
}


function validTemperature(value) {

    return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value =
            CONFIG.validTemperature.min &&
        value =
            CONFIG.validTemperature.max
    );
}


async function pause(milliseconds) {

    if (
        typeof milliseconds !== 'number' 
        milliseconds = 0
    ) {
        return;
    }

    await wait(milliseconds);
}


 ============================================================
  4. TIMEZONE-SAFE CLOCK
  ============================================================
 


  Zet een Date expliciet om naar EuropeAmsterdam.
 
  Daardoor worden automatisch ondersteund
 
  - CET in de winter
  - CEST in de zomer
  - overgang naar zomertijd
  - overgang naar wintertijd
 
  Gebruik voor regelbeslissingen nooit direct
 
  - date.getHours()
  - date.getMinutes()
  - date.getFullYear()
  - date.getMonth()
  - date.getDate()
 

function getLocalClock(
    date = new Date()
) {

    const formatter =
        new Intl.DateTimeFormat(
            'en-GB',
            {
                timeZone
                    CONFIG.timezone,

                year
                    'numeric',

                month
                    '2-digit',

                day
                    '2-digit',

                hour
                    '2-digit',

                minute
                    '2-digit',

                second
                    '2-digit',

                hourCycle
                    'h23'
            }
        );

    const formattedParts =
        formatter.formatToParts(date);

    const parts = {};

    for (
        const part
        of formattedParts
    ) {

        if (
            part.type !== 'literal'
        ) {

            parts[part.type] =
                part.value;
        }
    }

    const hour =
        Number(parts.hour);

    const minute =
        Number(parts.minute);

    const second =
        Number(parts.second);

    return {

        year
            Number(parts.year),

        month
            Number(parts.month),

        day
            Number(parts.day),

        hour,

        minute,

        second,

        minutesSinceMidnight
            hour  60 +
            minute,

        secondsSinceMidnight
            hour  3600 +
            minute  60 +
            second,

        dateKey
            `${parts.year}-` +
            `${parts.month}-` +
            `${parts.day}`,

        displayDate
            `${parts.day}-` +
            `${parts.month}-` +
            `${parts.year}`,

        displayTime
            `${parts.hour}` +
            `${parts.minute}` +
            `${parts.second}`,

        shortTime
            `${parts.hour}` +
            `${parts.minute}`,

        timezone
            CONFIG.timezone
    };
}


function timestamp() {

    return getLocalClock()
        .displayTime;
}


function shortTimestamp() {

    return getLocalClock()
        .shortTime;
}


function localDateKey(
    date = new Date()
) {

    return getLocalClock(date)
        .dateKey;
}


function log(message) {

    console.log(
        `[${timestamp()}] ${message}`
    );
}


function timeToMinutes(value) {

    const match =
        String(value)
            .trim()
            .match(
                ^(d{1,2})(d{2})$
            );

    if (!match) {

        throw new Error(
            `Ongeldige tijdconfiguratie ${value}`
        );
    }

    const hour =
        Number(match[1]);

    const minute =
        Number(match[2]);

    if (
        hour  0 
        hour  23 
        minute  0 
        minute  59
    ) {

        throw new Error(
            `Ongeldige tijdconfiguratie ${value}`
        );
    }

    return (
        hour  60 +
        minute
    );
}



  Ondersteunt ook tijdvensters over middernacht.
 
  Voorbeelden
 
  1800 tot 0600
  1800 tot 0730
 
  Het eindtijdstip is exclusief
 
  0559 = actief
  0600 = niet actief
 

function isTimeWindowActive(
    from,
    until,
    date = new Date()
) {

    const clock =
        getLocalClock(date);

    const current =
        clock.minutesSinceMidnight;

    const start =
        timeToMinutes(from);

    const end =
        timeToMinutes(until);

    if (
        start === end
    ) {

        return true;
    }

    if (
        start  end
    ) {

        return (
            current = start &&
            current  end
        );
    }

    return (
        current = start 
        current  end
    );
}


 ============================================================
  5. TIMELINE
  ============================================================
 

function addTimelineEvent(message) {

    if (
        !CONFIG.timeline.enabled
    ) {
        return;
    }

    timelineEvents.push(message);

    log(
        `Timeline-event  ${message}`
    );
}


async function publishTimelineEvents(
    logic
) {

    if (
        !CONFIG.timeline.enabled 
        timelineEvents.length === 0
    ) {
        return;
    }

    const uniqueEvents = [
        ...new Set(timelineEvents)
    ];

    const text =
        `Airzone boven [${shortTimestamp()}]n` +
        uniqueEvents.join('n');

    await setLogicVariable(
        logic.timelineMessage,
        text
    );

    log(
        `Timeline voorbereid  ` +
        `${uniqueEvents.length} actie(s)`
    );
}


 ============================================================
  6. DEVICE-CACHE
  ============================================================
 

async function refreshAllDevices() {

    deviceCache =
        await Homey.devices.getDevices();

    return deviceCache;
}


function getCachedDevice(
    deviceId,
    label
) {

    const device =
        deviceCache[deviceId];

    if (!device) {

        throw new Error(
            `${label} niet gevonden met ID ${deviceId}`
        );
    }

    return device;
}


async function refreshDevice(
    deviceId,
    label
) {

    await refreshAllDevices();

    return getCachedDevice(
        deviceId,
        label
    );
}


function capabilityValue(
    device,
    capabilityId
) {

    return device
        .capabilitiesObj
        .[capabilityId]
        .value;
}


function validateDevice(
    device,
    label
) {

    const requiredCapabilities = [
        'onoff',
        'measure_temperature',
        'target_temperature',
        'thermostat_mode'
    ];

    const capabilities =
        Array.isArray(device.capabilities)
             device.capabilities
             [];

    const missingCapabilities =
        requiredCapabilities.filter(
            capabilityId =
                !capabilities.includes(
                    capabilityId
                )
        );

    if (
        missingCapabilities.length  0
    ) {

        throw new Error(
            `${label} mist capabilities ` +
            missingCapabilities.join(', ')
        );
    }
}


 ============================================================
  7. LOGIC-VARIABELEN
  ============================================================
 

async function getLogicVariables() {

    const variablesObject =
        await Homey.logic.getVariables();

    return Object.values(
        variablesObject
    );
}


function findLogicVariable(
    variables,
    variableName
) {

    return (
        variables.find(
            variable =
                normalize(variable.name) ===
                normalize(variableName)
        ) 
        null
    );
}


async function readLogicState() {

    const variables =
        await getLogicVariables();

    const result = {

        vacation
            findLogicVariable(
                variables,
                CONFIG.logic.vacation
            ),

        mode
            findLogicVariable(
                variables,
                CONFIG.logic.mode
            ),

        pushDate
            findLogicVariable(
                variables,
                CONFIG.logic.pushDate
            ),

        pushMessage
            findLogicVariable(
                variables,
                CONFIG.logic.pushMessage
            ),

        timelineMessage
            findLogicVariable(
                variables,
                CONFIG.logic.timelineMessage
            ),

        winterActive
            findLogicVariable(
                variables,
                CONFIG.logic.winterActive
            ),

        masterCycle
            findLogicVariable(
                variables,
                CONFIG.logic.masterCycle
            ),

        outsideTemperature
            findLogicVariable(
                variables,
                CONFIG.logic.outsideTemperature
            )
    };

    for (
        const [key, variable]
        of Object.entries(result)
    ) {

        if (!variable) {

            throw new Error(
                `Logic-variabele ontbreekt ` +
                `${CONFIG.logic[key]}`
            );
        }
    }

    if (
        typeof result.vacation.value !==
        'boolean'
    ) {

        throw new Error(
            `${CONFIG.logic.vacation} ` +
            `moet een JaNee-variabele zijn`
        );
    }

    if (
        typeof result.winterActive.value !==
        'boolean'
    ) {

        throw new Error(
            `${CONFIG.logic.winterActive} ` +
            `moet een JaNee-variabele zijn`
        );
    }

    if (
        typeof result.masterCycle.value !==
        'boolean'
    ) {

        throw new Error(
            `${CONFIG.logic.masterCycle} ` +
            `moet een JaNee-variabele zijn`
        );
    }

    if (
        typeof result.outsideTemperature.value !==
            'number' 
        !Number.isFinite(
            result.outsideTemperature.value
        )
    ) {

        throw new Error(
            `${CONFIG.logic.outsideTemperature} ` +
            `moet een numerieke variabele zijn`
        );
    }

    result.normalizedMode =
        normalize(
            result.mode.value
        );

    if (
        result.normalizedMode !==
            'winter' &&
        result.normalizedMode !==
            'zomer'
    ) {

        throw new Error(
            `${CONFIG.logic.mode} bevat ` +
            `${String(result.mode.value)}. ` +
            `Gebruik Winter of Zomer.`
        );
    }

    return result;
}


async function setLogicVariable(
    variable,
    newValue
) {

    if (
        variable.value ===
        newValue
    ) {

        log(
            `Logic  ${variable.name} al ` +
            `${String(newValue)}`
        );

        return {
            changed
                false
        };
    }

    log(
        `Logic  ${variable.name} ` +
        `${String(variable.value)} - ` +
        `${String(newValue)}`
    );

    await Homey.logic.updateVariable({
        id
            variable.id,

        variable {
            value
                newValue
        }
    });

    variable.value =
        newValue;

    return {
        changed
            true
    };
}


 ============================================================
  8. CAPABILITY-WRITES
  ============================================================
 

function valuesEqual(
    capabilityId,
    currentValue,
    desiredValue
) {

    if (
        capabilityId ===
        'target_temperature'
    ) {

        return (
            typeof currentValue ===
                'number' &&
            typeof desiredValue ===
                'number' &&
            Math.abs(
                currentValue -
                desiredValue
            ) =
                CONFIG.targetTolerance
        );
    }

    return (
        currentValue ===
        desiredValue
    );
}


async function setCapability(
    deviceId,
    label,
    capabilityId,
    desiredValue,
    waitAfter
) {

    let lastError =
        null;

    for (
        let attempt = 1;
        attempt = CONFIG.retries;
        attempt++
    ) {

        try {

            const device =
                getCachedDevice(
                    deviceId,
                    label
                );

            if (
                !device.capabilities.includes(
                    capabilityId
                )
            ) {

                throw new Error(
                    `${capabilityId} wordt niet ondersteund`
                );
            }

            const currentValue =
                capabilityValue(
                    device,
                    capabilityId
                );

            if (
                valuesEqual(
                    capabilityId,
                    currentValue,
                    desiredValue
                )
            ) {

                log(
                    `${label}  ${capabilityId} al ` +
                    `${String(desiredValue)}`
                );

                return {
                    success
                        true,

                    changed
                        false,

                    previousValue
                        currentValue,

                    value
                        currentValue
                };
            }

            log(
                `${label}  ${capabilityId} ` +
                `${String(currentValue)} - ` +
                `${String(desiredValue)}  ` +
                `poging ${attempt}${CONFIG.retries}`
            );

            await Homey.devices
                .setCapabilityValue({
                    deviceId,
                    capabilityId,
                    value
                        desiredValue
                });

            writesThisRun++;

            await pause(waitAfter);

            const checkedDevice =
                await refreshDevice(
                    deviceId,
                    label
                );

            const checkedValue =
                capabilityValue(
                    checkedDevice,
                    capabilityId
                );

            if (
                valuesEqual(
                    capabilityId,
                    checkedValue,
                    desiredValue
                )
            ) {

                log(
                    `${label}  bevestigd ` +
                    `${capabilityId}=` +
                    `${String(checkedValue)}`
                );

                return {
                    success
                        true,

                    changed
                        true,

                    previousValue
                        currentValue,

                    value
                        checkedValue
                };
            }

            throw new Error(
                `Niet bevestigd. Gevraagd=` +
                `${String(desiredValue)}, gelezen=` +
                `${String(checkedValue)}`
            );

        } catch (error) {

            lastError =
                error;

            log(
                `WAARSCHUWING  ${label}  ` +
                `${capabilityId}  ` +
                `${errorText(error)}`
            );

            if (
                attempt 
                CONFIG.retries
            ) {

                await pause(
                    CONFIG.timing.retryDelay
                );

                await refreshAllDevices();
            }
        }
    }

    throw new Error(
        `${label} ${capabilityId} mislukt. ` +
        `${errorText(lastError)}`
    );
}


 ============================================================
  9. BASISACTIES
  ============================================================
 

async function setMode(
    deviceId,
    label,
    mode
) {

    return await setCapability(
        deviceId,
        label,
        'thermostat_mode',
        mode,
        CONFIG.timing.afterMode
    );
}


async function setTarget(
    deviceId,
    label,
    target
) {

    return await setCapability(
        deviceId,
        label,
        'target_temperature',
        target,
        CONFIG.timing.afterTarget
    );
}


async function turnOff(
    deviceId,
    label
) {

    return await setCapability(
        deviceId,
        label,
        'onoff',
        false,
        CONFIG.timing.afterOff
    );
}


async function turnOn(
    deviceId,
    label,
    target
) {

    const device =
        getCachedDevice(
            deviceId,
            label
        );

    const isOn =
        capabilityValue(
            device,
            'onoff'
        ) === true;

    let changed =
        false;

    let switchedOn =
        false;

    if (!isOn) {

        log(
            `${label}  zone uit  inschakelen`
        );

        const onResult =
            await setCapability(
                deviceId,
                label,
                'onoff',
                true,
                CONFIG.timing.afterInitialOn
            );

        changed =
            changed 
            onResult.changed;

        switchedOn =
            onResult.changed;

        if (
            onResult.changed
        ) {

            await pause(
                CONFIG.timing.afterRealChange
            );
        }
    }

    const targetResult =
        await setTarget(
            deviceId,
            label,
            target
        );

    changed =
        changed 
        targetResult.changed;

    return {
        changed,
        switchedOn,

        targetChanged
            targetResult.changed
    };
}


 ============================================================
  10. MASTER WINTER
  ============================================================
 

function isMasterWinterWindowActive() {

    return isTimeWindowActive(
        CONFIG.winter.master.activeFrom,
        CONFIG.winter.master.activeUntil
    );
}


async function controlWinterMaster(
    logic
) {

    const windowActive =
        isMasterWinterWindowActive();

    const device =
        getCachedDevice(
            CONFIG.devices.master,
            'Master'
        );

    const temperature =
        capabilityValue(
            device,
            'measure_temperature'
        );

    const isOn =
        capabilityValue(
            device,
            'onoff'
        ) === true;

    let cycleActive =
        logic.masterCycle.value ===
        true;

    if (
        !validTemperature(
            temperature
        )
    ) {

        throw new Error(
            'Mastertemperatuur is ongeldig'
        );
    }

    log(
        `Master  ${formatTemp(temperature)}  ` +
        `venster=${windowActive  'ACTIEF'  'UIT'}  ` +
        `AAN=${isOn}  cyclus=${cycleActive}`
    );

    
      Buiten 1800-0600 hard uitschakelen.
     

    if (!windowActive) {

        let changed =
            false;

        if (isOn) {

            const result =
                await turnOff(
                    CONFIG.devices.master,
                    'Master'
                );

            changed =
                changed 
                result.changed;

            if (
                result.changed
            ) {

                addTimelineEvent(
                    `⏰ Master uit, wintervenster beëindigd`
                );
            }
        }

        const cycleResult =
            await setLogicVariable(
                logic.masterCycle,
                false
            );

        changed =
            changed 
            cycleResult.changed;

        return {
            changed
        };
    }

    
      Stoppen vanaf 17,0 °C.
     

    if (
        temperature =
        CONFIG.winter.master.stopAt
    ) {

        let changed =
            false;

        if (isOn) {

            const result =
                await turnOff(
                    CONFIG.devices.master,
                    'Master'
                );

            changed =
                changed 
                result.changed;

            if (
                result.changed
            ) {

                addTimelineEvent(
                    `✅ Master failsafe gestopt, ` +
                    `${formatTemp(temperature)} bereikt`
                );
            }
        }

        const cycleResult =
            await setLogicVariable(
                logic.masterCycle,
                false
            );

        changed =
            changed 
            cycleResult.changed;

        return {
            changed
        };
    }

    
      Nieuwe cyclus starten onder 15,0 °C.
     

    if (
        temperature 
            CONFIG.winter.master.startBelow &&
        !cycleActive
    ) {

        const cycleResult =
            await setLogicVariable(
                logic.masterCycle,
                true
            );

        cycleActive =
            true;

        if (
            cycleResult.changed
        ) {

            addTimelineEvent(
                `🔥 Master failsafe gestart, ` +
                `${formatTemp(temperature)} - ` +
                `${formatTemp(CONFIG.winter.master.target)}`
            );
        }
    }

    
      Actieve cyclus doorzetten.
     

    if (cycleActive) {

        let changed =
            false;

        const modeResult =
            await setMode(
                CONFIG.devices.master,
                'Master',
                'heat'
            );

        changed =
            changed 
            modeResult.changed;

        if (
            modeResult.changed
        ) {

            await pause(
                CONFIG.timing.afterRealChange
            );
        }

        const onResult =
            await turnOn(
                CONFIG.devices.master,
                'Master',
                CONFIG.winter.master.target
            );

        changed =
            changed 
            onResult.changed;

        if (
            onResult.switchedOn &&
            !timelineEvents.some(
                event =
                    event.includes(
                        'Master failsafe gestart'
                    )
            )
        ) {

            addTimelineEvent(
                `🔥 Master verwarming ingeschakeld, ` +
                `${formatTemp(temperature)} - ` +
                `${formatTemp(CONFIG.winter.master.target)}`
            );
        }

        return {
            changed
        };
    }

    
      Binnen het tijdvenster, maar zonder cyclus.
     

    if (isOn) {

        const result =
            await turnOff(
                CONFIG.devices.master,
                'Master'
            );

        if (
            result.changed
        ) {

            addTimelineEvent(
                `✅ Master uit, geen actieve verwarmcyclus`
            );
        }

        return result;
    }

    return {
        changed
            false
    };
}


 ============================================================
  11. WINTER COMFORTZONE
  ============================================================
 

async function controlWinterComfortZone(
    deviceId,
    label,
    settings
) {

    const device =
        getCachedDevice(
            deviceId,
            label
        );

    const temperature =
        capabilityValue(
            device,
            'measure_temperature'
        );

    const isOn =
        capabilityValue(
            device,
            'onoff'
        ) === true;

    if (
        !validTemperature(
            temperature
        )
    ) {

        throw new Error(
            `${label} temperatuur is ongeldig`
        );
    }

    log(
        `${label}  ${formatTemp(temperature)}  ` +
        `AAN=${isOn}`
    );

    
      Stoppen vanaf bovengrens.
     

    if (
        temperature =
        settings.stopAt
    ) {

        if (isOn) {

            const result =
                await turnOff(
                    deviceId,
                    label
                );

            if (
                result.changed
            ) {

                addTimelineEvent(
                    `✅ ${label} uit, ` +
                    `${formatTemp(temperature)} bereikt`
                );
            }

            return result;
        }

        return {
            changed
                false
        };
    }

    
      Starten onder ondergrens.
     

    if (
        temperature 
        settings.startBelow
    ) {

        let changed =
            false;

        const modeResult =
            await setMode(
                deviceId,
                label,
                'heat'
            );

        changed =
            changed 
            modeResult.changed;

        if (
            modeResult.changed
        ) {

            await pause(
                CONFIG.timing.afterRealChange
            );
        }

        const onResult =
            await turnOn(
                deviceId,
                label,
                settings.target
            );

        changed =
            changed 
            onResult.changed;

        if (
            onResult.switchedOn
        ) {

            const icon =
                label === 'Badkamer'
                     '🚿'
                     '🔥';

            addTimelineEvent(
                `${icon} ${label} verwarming gestart, ` +
                `${formatTemp(temperature)} - ` +
                `${formatTemp(settings.target)}`
            );
        }

        return {
            changed
        };
    }

    
      Binnen hysterese huidige toestand behouden.
     

    if (isOn) {

        return await setTarget(
            deviceId,
            label,
            settings.target
        );
    }

    return {
        changed
            false
    };
}


 ============================================================
  12. SLAAPKAMERS
  ============================================================
 

function isBedroomWindowActive() {

    return isTimeWindowActive(
        CONFIG.winter.bedrooms.activeFrom,
        CONFIG.winter.bedrooms.activeUntil
    );
}


async function controlWinterBedroom(
    deviceId,
    label,
    settings
) {

    const windowActive =
        isBedroomWindowActive();

    const device =
        getCachedDevice(
            deviceId,
            label
        );

    const isOn =
        capabilityValue(
            device,
            'onoff'
        ) === true;

    log(
        `${label}  venster=` +
        `${windowActive  'ACTIEF'  'UIT'}`
    );

    if (!windowActive) {

        if (isOn) {

            const result =
                await turnOff(
                    deviceId,
                    label
                );

            if (
                result.changed
            ) {

                addTimelineEvent(
                    `⏰ ${label} uit, comfortvenster beëindigd`
                );
            }

            return result;
        }

        return {
            changed
                false
        };
    }

    return await controlWinterComfortZone(
        deviceId,
        label,
        settings
    );
}


 ============================================================
  13. BADKAMER
  ============================================================
 

function isBathroomEveningWindowActive() {

    return isTimeWindowActive(
        CONFIG.winter.bathroom.eveningFrom,
        CONFIG.winter.bathroom.eveningUntil
    );
}


function isBathroomMorningWindowActive() {

    return isTimeWindowActive(
        CONFIG.winter.bathroom.morningTargetTime,
        CONFIG.winter.bathroom.morningUntil
    );
}


function isBathroomWindowActive() {

    return (
        isBathroomEveningWindowActive() 
        isBathroomMorningWindowActive()
    );
}


function minutesUntilLocalTime(
    targetTime,
    date = new Date()
) {

    const current =
        getLocalClock(date)
            .minutesSinceMidnight;

    const target =
        timeToMinutes(targetTime);

    let difference =
        target - current;

    if (difference = 0) {
        difference +=
            24  60;
    }

    return difference;
}


function getBathroomHeatingRate(
    outsideTemperature
) {

    const settings =
        CONFIG.winter.bathroom;

    if (!validTemperature(outsideTemperature)) {

        return {
            rate
                settings.fallbackHeatingRate,

            source
                'fallback'
        };
    }

    if (
        outsideTemperature =
        settings.heatingRateColdUntil
    ) {

        return {
            rate
                settings.heatingRateCold,

            source
                'cold'
        };
    }

    if (
        outsideTemperature =
        settings.heatingRateWarmFrom
    ) {

        return {
            rate
                settings.heatingRateWarm,

            source
                'warm'
        };
    }

    const position =
        (
            outsideTemperature -
            settings.heatingRateColdUntil
        ) 
        (
            settings.heatingRateWarmFrom -
            settings.heatingRateColdUntil
        );

    return {
        rate
            settings.heatingRateCold +
            position 
            (
                settings.heatingRateWarm -
                settings.heatingRateCold
            ),

        source
            'interpolated'
    };
}


function getBathroomPrediction(
    temperature,
    outsideTemperature,
    date = new Date()
) {

    const settings =
        CONFIG.winter.bathroom;

    if (!validTemperature(temperature)) {

        return {
            valid
                false,

            shouldPreheat
                false,

            reason
                'ongeldige badkamertemperatuur'
        };
    }

    const rateResult =
        getBathroomHeatingRate(
            outsideTemperature
        );

    const minutesUntilTarget =
        minutesUntilLocalTime(
            settings.morningTargetTime,
            date
        );

    const gap =
        Math.max(
            0,
            settings.target -
            temperature
        );

    if (
        gap =
        settings.predictiveMinGap
    ) {

        return {
            valid
                true,

            shouldPreheat
                false,

            gap,

            heatingRate
                rateResult.rate,

            heatingRateSource
                rateResult.source,

            minutesUntilTarget,

            estimatedHeatingMinutes
                0,

            requiredMinutes
                0,

            reason
                'doeltemperatuur praktisch bereikt'
        };
    }

    const estimatedHeatingMinutes =
        gap 
        rateResult.rate 
        60;

    const requiredMinutes =
        Math.min(
            settings.predictiveMaxPreheatMinutes,
            Math.ceil(
                estimatedHeatingMinutes +
                settings.predictiveSafetyMinutes
            )
        );

    return {
        valid
            true,

        shouldPreheat
            minutesUntilTarget =
            requiredMinutes,

        gap,

        heatingRate
            rateResult.rate,

        heatingRateSource
            rateResult.source,

        minutesUntilTarget,

        estimatedHeatingMinutes
            Math.ceil(
                estimatedHeatingMinutes
            ),

        requiredMinutes,

        reason
            minutesUntilTarget =
            requiredMinutes
                 'voorspellende start nodig'
                 'nog te vroeg voor voorverwarming'
    };
}


async function controlWinterBathroom(
    logic
) {

    const settings =
        CONFIG.winter.bathroom;

    const clock =
        getLocalClock();

    const eveningActive =
        isBathroomEveningWindowActive();

    const morningActive =
        isBathroomMorningWindowActive();

    const device =
        getCachedDevice(
            CONFIG.devices.badkamer,
            'Badkamer'
        );

    const temperature =
        capabilityValue(
            device,
            'measure_temperature'
        );

    const outsideTemperature =
        logic.outsideTemperature.value;

    const isOn =
        capabilityValue(
            device,
            'onoff'
        ) === true;

    if (!validTemperature(temperature)) {
        throw new Error(
            'Badkamer temperatuur is ongeldig'
        );
    }

    const prediction =
        getBathroomPrediction(
            temperature,
            outsideTemperature
        );

    const predictiveNight =
        !eveningActive &&
        !morningActive &&
        prediction.shouldPreheat;

    log(
        `Badkamer  ${formatTemp(temperature)}  ` +
        `buiten=${formatTemp(outsideTemperature)}  ` +
        `tijd=${clock.shortTime}  ` +
        `avond=${eveningActive  'ACTIEF'  'UIT'}  ` +
        `ochtend=${morningActive  'ACTIEF'  'UIT'}  ` +
        `predictief=${predictiveNight  'ACTIEF'  'UIT'}  ` +
        `snelheid=${prediction.heatingRate.toFixed(2)} °Cu  ` +
        `AAN=${isOn}`
    );

    
      Regulier comfort tussen 1800-2130 en 0600-0730.
     
    if (
        eveningActive 
        morningActive
    ) {

        return await controlWinterComfortZone(
            CONFIG.devices.badkamer,
            'Badkamer',
            settings
        );
    }

    
      Nacht vóór het predictieve startmoment altijd uit.
     
    if (!predictiveNight) {

        log(
            `Badkamer nacht  uit tot predictieve start  ` +
            `0600 over ${prediction.minutesUntilTarget} min  ` +
            `geschat nodig=${prediction.requiredMinutes} min  ` +
            `model=${prediction.heatingRate.toFixed(2)} °Cu`
        );

        if (isOn) {

            const result =
                await turnOff(
                    CONFIG.devices.badkamer,
                    'Badkamer'
                );

            if (result.changed) {

                addTimelineEvent(
                    `🌙 Badkamer uit voor nacht; ` +
                    `predictieve verwarming richting 0600`
                );
            }

            return result;
        }

        return {
            changed
                false
        };
    }

    
      Tijdens de predictieve fase stoppen op 21,2 °C.
     
    if (
        temperature =
        settings.stopAt
    ) {

        if (isOn) {

            const result =
                await turnOff(
                    CONFIG.devices.badkamer,
                    'Badkamer'
                );

            if (result.changed) {

                addTimelineEvent(
                    `✅ Badkamer voorverwarming gestopt, ` +
                    `${formatTemp(temperature)} bereikt`
                );
            }

            return result;
        }

        return {
            changed
                false
        };
    }

    
      Is de zone eerder tijdens de predictieve fase gestopt,
      dan pas opnieuw starten onder 20,5 °C.
     
    if (
        !isOn &&
        temperature =
            settings.predictiveRestartBelow
    ) {

        log(
            `Badkamer predictief  uit blijven; ` +
            `${formatTemp(temperature)} = ` +
            `herstartgrens ` +
            `${formatTemp(settings.predictiveRestartBelow)}`
        );

        return {
            changed
                false
        };
    }

    let changed =
        false;

    const modeResult =
        await setMode(
            CONFIG.devices.badkamer,
            'Badkamer',
            'heat'
        );

    changed =
        changed 
        modeResult.changed;

    if (modeResult.changed) {

        await pause(
            CONFIG.timing.afterRealChange
        );
    }

    const onResult =
        await turnOn(
            CONFIG.devices.badkamer,
            'Badkamer',
            settings.target
        );

    changed =
        changed 
        onResult.changed;

    if (onResult.switchedOn) {

        addTimelineEvent(
            `⏱️ Badkamer voorspellend gestart, ` +
            `${formatTemp(temperature)} - ` +
            `${formatTemp(settings.target)} voor 0600  ` +
            `buiten ${formatTemp(outsideTemperature)}  ` +
            `${prediction.heatingRate.toFixed(2)} °Cu  ` +
            `${prediction.requiredMinutes} min nodig`
        );
    }

    return {
        changed
    };
}


 ============================================================
  14. ZOMER
  ============================================================
 

async function activateSummerZone(
    deviceId,
    label,
    target
) {

    const device =
        getCachedDevice(
            deviceId,
            label
        );

    const temperature =
        capabilityValue(
            device,
            'measure_temperature'
        );

    const wasOn =
        capabilityValue(
            device,
            'onoff'
        ) === true;

    log(
        `${label} zomer  ` +
        `${formatTemp(temperature)}  ` +
        `doel=${formatTemp(target)}`
    );

    let changed =
        false;

    const modeResult =
        await setMode(
            deviceId,
            label,
            'cool'
        );

    changed =
        changed 
        modeResult.changed;

    if (
        modeResult.changed
    ) {

        await pause(
            CONFIG.timing.afterRealChange
        );
    }

    const onResult =
        await turnOn(
            deviceId,
            label,
            target
        );

    changed =
        changed 
        onResult.changed;

    if (
        !wasOn &&
        onResult.switchedOn
    ) {

        addTimelineEvent(
            `❄️ ${label} koeling gestart, ` +
            `${formatTemp(temperature)} - ` +
            `${formatTemp(target)}`
        );
    }

    return {
        changed
    };
}


 ============================================================
  15. VAKANTIE
  ============================================================
 

async function controlVacationZone(
    deviceId,
    label
) {

    const device =
        getCachedDevice(
            deviceId,
            label
        );

    const temperature =
        capabilityValue(
            device,
            'measure_temperature'
        );

    const isOn =
        capabilityValue(
            device,
            'onoff'
        ) === true;

    if (
        !validTemperature(
            temperature
        )
    ) {

        throw new Error(
            `${label} temperatuur is ongeldig`
        );
    }

    log(
        `${label} vakantie  ` +
        `${formatTemp(temperature)}  ` +
        `AAN=${isOn}`
    );

    
      Vanaf 12,5 °C uitschakelen.
     

    if (
        temperature =
        CONFIG.vacation.stopAt
    ) {

        if (isOn) {

            const result =
                await turnOff(
                    deviceId,
                    label
                );

            if (
                result.changed
            ) {

                addTimelineEvent(
                    `✅ Vakantie-failsafe ${label} gestopt, ` +
                    `${formatTemp(temperature)} bereikt`
                );
            }

            return result;
        }

        return {
            changed
                false
        };
    }

    
      Onder 12,0 °C starten.
     

    if (
        temperature 
        CONFIG.vacation.startBelow
    ) {

        let changed =
            false;

        const modeResult =
            await setMode(
                deviceId,
                label,
                'heat'
            );

        changed =
            changed 
            modeResult.changed;

        if (
            modeResult.changed
        ) {

            await pause(
                CONFIG.timing.afterRealChange
            );
        }

        const onResult =
            await turnOn(
                deviceId,
                label,
                CONFIG.vacation.target
            );

        changed =
            changed 
            onResult.changed;

        if (
            onResult.switchedOn
        ) {

            addTimelineEvent(
                `🛡️ Vakantie-failsafe ${label} gestart, ` +
                `${formatTemp(temperature)} - ` +
                `${formatTemp(CONFIG.vacation.target)}`
            );
        }

        return {
            changed
        };
    }

    
      Tussen 12,0 en 12,5 °C huidige toestand behouden.
     

    if (isOn) {

        let changed =
            false;

        const modeResult =
            await setMode(
                deviceId,
                label,
                'heat'
            );

        changed =
            changed 
            modeResult.changed;

        if (
            modeResult.changed
        ) {

            await pause(
                CONFIG.timing.afterRealChange
            );
        }

        const onResult =
            await turnOn(
                deviceId,
                label,
                CONFIG.vacation.target
            );

        changed =
            changed 
            onResult.changed;

        return {
            changed
        };
    }

    return {
        changed
            false
    };
}


 ============================================================
  16. 1800 PUSH
  ============================================================
 

function isPushWindow(
    date = new Date()
) {

    const clock =
        getLocalClock(date);

    const current =
        clock.minutesSinceMidnight;

    const start =
        timeToMinutes(
            CONFIG.push.start
        );

    const end =
        timeToMinutes(
            CONFIG.push.end
        );

    
      1800 inclusief, 1815 exclusief.
     
      Bij runs iedere vijf minuten zijn dus geldig
     
      1800
      1805
      1810
     

    return (
        current = start &&
        current  end
    );
}


async function preparePushMessage(
    logic
) {

    if (
        !CONFIG.push.enabled 
        !isPushWindow()
    ) {
        return;
    }

    if (
        logic.vacation.value ===
            true &&
        CONFIG.push
            .suppressDuringVacation
    ) {

        log(
            '1800 push overgeslagen wegens vakantie'
        );

        return;
    }

    const date =
        localDateKey();

    if (
        String(
            logic.pushDate.value
        ) === date
    ) {

        log(
            '1800 push is vandaag al voorbereid'
        );

        return;
    }

    await refreshAllDevices();

    const definitions = [

        {
            id
                CONFIG.devices.master,

            label
                'Master'
        },

        {
            id
                CONFIG.devices.abel,

            label
                'Abel'
        },

        {
            id
                CONFIG.devices.hugo,

            label
                'Hugo'
        },

        {
            id
                CONFIG.devices.badkamer,

            label
                'Badkamer'
        }
    ];

    const activeZones = [];

    for (
        const zone
        of definitions
    ) {

        const device =
            getCachedDevice(
                zone.id,
                zone.label
            );

        if (
            capabilityValue(
                device,
                'onoff'
            ) !== true
        ) {
            continue;
        }

        activeZones.push({

            label
                zone.label,

            temperature
                capabilityValue(
                    device,
                    'measure_temperature'
                ),

            target
                capabilityValue(
                    device,
                    'target_temperature'
                )
        });
    }

    if (
        activeZones.length === 0
    ) {

        log(
            '1800  geen actieve zones  geen push'
        );

        return;
    }

    const isWinter =
        logic.normalizedMode ===
        'winter';

    const icon =
        isWinter
             '🔥'
             '❄️';

    const action =
        isWinter
             'verwarming'
             'koeling';

    const zoneText =
        activeZones
            .map(
                zone = {

                    const parts = [
                        zone.label
                    ];

                    if (
                        CONFIG.push
                            .includeTemperatures &&
                        typeof zone.temperature ===
                            'number'
                    ) {

                        parts.push(
                            `${zone.temperature.toFixed(1)} °C`
                        );
                    }

                    if (
                        CONFIG.push
                            .includeTargets &&
                        typeof zone.target ===
                            'number'
                    ) {

                        parts.push(
                            `doel ${zone.target.toFixed(1)} °C`
                        );
                    }

                    return parts.join(' ');
                }
            )
            .join(', ');

    const message =
        `${icon} Airzone boven ` +
        `${action} actief. ` +
        `Zones ${zoneText}. ` +
        `[${date}]`;

    await setLogicVariable(
        logic.pushMessage,
        message
    );

    await setLogicVariable(
        logic.pushDate,
        date
    );

    log(
        `1800 push voorbereid  ${message}`
    );
}


 ============================================================
  17. VEILIGE UITVOERING
  ============================================================
 

async function runSafely(
    label,
    action
) {

    try {

        const result =
            await action();

        return (
            result 
            {
                changed
                    false
            }
        );

    } catch (error) {

        const message =
            `${label} ${errorText(error)}`;

        console.error(
            `FOUT  ${message}`
        );

        addTimelineEvent(
            `⚠️ Airzone-fout ${message}`
        );

        await refreshAllDevices();

        return {
            changed
                false,

            failed
                true
        };
    }
}


async function afterZone(result) {

    if (
        result &&
        result.changed
    ) {

        await pause(
            CONFIG.timing
                .betweenChangedZones
        );
    }
}


 ============================================================
  18. MAIN
  ============================================================
 

async function main() {

    const startedAt =
        Date.now();

    const localClock =
        getLocalClock();

    log(
        '=============================================='
    );

    log(
        `AIRZONE FAST CONTROLLER V${CONFIG.version} GESTART`
    );

    log(
        `Lokale tijd=` +
        `${localClock.displayDate} ` +
        `${localClock.displayTime}  ` +
        `timezone=${localClock.timezone}  ` +
        `UTC=${new Date().toISOString()}`
    );

    log(
        '=============================================='
    );

    await refreshAllDevices();

    const master =
        getCachedDevice(
            CONFIG.devices.master,
            'Master'
        );

    const abel =
        getCachedDevice(
            CONFIG.devices.abel,
            'Abel'
        );

    const hugo =
        getCachedDevice(
            CONFIG.devices.hugo,
            'Hugo'
        );

    const badkamer =
        getCachedDevice(
            CONFIG.devices.badkamer,
            'Badkamer'
        );

    validateDevice(
        master,
        'Master'
    );

    validateDevice(
        abel,
        'Abel'
    );

    validateDevice(
        hugo,
        'Hugo'
    );

    validateDevice(
        badkamer,
        'Badkamer'
    );

    log(
        `Devices OK  ` +
        `${master.name}, ` +
        `${abel.name}, ` +
        `${hugo.name}, ` +
        `${badkamer.name}`
    );

    const logic =
        await readLogicState();

    const mode =
        logic.normalizedMode;

    const vacation =
        logic.vacation.value ===
        true;

    log(
        `Modus=${mode.toUpperCase()}  ` +
        `Vakantie=${vacation  'JA'  'NEE'}`
    );

    log(
        `Buitentemperatuur=` +
        `${formatTemp(logic.outsideTemperature.value)}`
    );

    log(
        `Vensters  Master=` +
        `${isMasterWinterWindowActive()
             'ACTIEF'
             'UIT'
        }  ` +
        `Slaapkamers=` +
        `${isBedroomWindowActive()
             'ACTIEF'
             'UIT'
        }  ` +
        `Badkamer=` +
        `${isBathroomWindowActive()
             'ACTIEF'
             'UIT'
        }`
    );

    const winterStateResult =
        await setLogicVariable(
            logic.winterActive,
            mode === 'winter' &&
            !vacation
        );

    if (
        winterStateResult.changed
    ) {

        addTimelineEvent(
            mode === 'winter' &&
            !vacation
                 '🔥 Winterregeling geactiveerd'
                 '⏹️ Winterregeling gedeactiveerd'
        );
    }

    if (
        mode !== 'winter' 
        vacation
    ) {

        await setLogicVariable(
            logic.masterCycle,
            false
        );
    }


     ========================================================
      VAKANTIE
      ========================================================
     

    if (vacation) {

        log(
            'VAKANTIEFAILSAFE ACTIEF'
        );

        const centralResult =
            await setMode(
                CONFIG.devices.master,
                'Centrale Airzone',
                'heat'
            );

        if (
            centralResult.changed
        ) {

            await pause(
                CONFIG.timing.afterRealChange
            );
        }

        const zones = [

            {
                id
                    CONFIG.devices.master,

                label
                    'Master'
            },

            {
                id
                    CONFIG.devices.abel,

                label
                    'Abel'
            },

            {
                id
                    CONFIG.devices.hugo,

                label
                    'Hugo'
            },

            {
                id
                    CONFIG.devices.badkamer,

                label
                    'Badkamer'
            }
        ];

        for (
            const zone
            of zones
        ) {

            const result =
                await runSafely(
                    zone.label,
                    async () =
                        await controlVacationZone(
                            zone.id,
                            zone.label
                        )
                );

            await afterZone(result);
        }
    }


     ========================================================
      WINTER
      ========================================================
     

    else if (
        mode === 'winter'
    ) {

        log(
            'NORMALE WINTERREGELING'
        );

        const centralResult =
            await setMode(
                CONFIG.devices.master,
                'Centrale Airzone',
                'heat'
            );

        if (
            centralResult.changed
        ) {

            await pause(
                CONFIG.timing.afterRealChange
            );
        }

        const masterResult =
            await runSafely(
                'Master',
                async () =
                    await controlWinterMaster(
                        logic
                    )
            );

        await afterZone(
            masterResult
        );

        const abelResult =
            await runSafely(
                'Abel',
                async () =
                    await controlWinterBedroom(
                        CONFIG.devices.abel,
                        'Abel',
                        CONFIG.winter.abel
                    )
            );

        await afterZone(
            abelResult
        );

        const hugoResult =
            await runSafely(
                'Hugo',
                async () =
                    await controlWinterBedroom(
                        CONFIG.devices.hugo,
                        'Hugo',
                        CONFIG.winter.hugo
                    )
            );

        await afterZone(
            hugoResult
        );

        const bathroomResult =
            await runSafely(
                'Badkamer',
                async () =
                    await controlWinterBathroom(
                        logic
                    )
            );

        await afterZone(
            bathroomResult
        );
    }


     ========================================================
      ZOMER
      ========================================================
     

    else {

        log(
            'NORMALE ZOMERREGELING'
        );

        const centralResult =
            await setMode(
                CONFIG.devices.master,
                'Centrale Airzone',
                'cool'
            );

        if (
            centralResult.changed
        ) {

            addTimelineEvent(
                '❄️ Airzone ingesteld op Cooling'
            );

            await pause(
                CONFIG.timing.afterRealChange
            );
        }

        
          De bestaande zomerwerking is bewust 247 zolang
          Airzone modus op Zomer staat.
         

        const zones = [

            {
                id
                    CONFIG.devices.master,

                label
                    'Master',

                target
                    CONFIG.summer.master
            },

            {
                id
                    CONFIG.devices.abel,

                label
                    'Abel',

                target
                    CONFIG.summer.abel
            },

            {
                id
                    CONFIG.devices.hugo,

                label
                    'Hugo',

                target
                    CONFIG.summer.hugo
            },

            {
                id
                    CONFIG.devices.badkamer,

                label
                    'Badkamer',

                target
                    CONFIG.summer.badkamer
            }
        ];

        for (
            const zone
            of zones
        ) {

            const result =
                await runSafely(
                    zone.label,
                    async () =
                        await activateSummerZone(
                            zone.id,
                            zone.label,
                            zone.target
                        )
                );

            await afterZone(result);
        }
    }


     ========================================================
      PUSH EN TIMELINE
      ========================================================
     

    await preparePushMessage(
        logic
    );

    await publishTimelineEvents(
        logic
    );


     ========================================================
      RESULTAAT
      ========================================================
     

    const runtimeMs =
        Date.now() -
        startedAt;

    const finishClock =
        getLocalClock();

    log(
        '=============================================='
    );

    log(
        `KLAAR  ${mode.toUpperCase()}  ` +
        `${vacation  'VAKANTIE'  'NORMAAL'}  ` +
        `writes=${writesThisRun}  ` +
        `timeline=${timelineEvents.length}  ` +
        `runtime=${runtimeMs} ms`
    );

    log(
        '=============================================='
    );

    return {

        success
            true,

        version
            CONFIG.version,

        timezone
            CONFIG.timezone,

        localDate
            finishClock.dateKey,

        localTime
            finishClock.displayTime,

        utcTime
            new Date().toISOString(),

        mode,

        vacation,

        windows {

            master
                isMasterWinterWindowActive(),

            bedrooms
                isBedroomWindowActive(),

            bathroom
                isBathroomWindowActive(),

            push
                isPushWindow()
        },

        writes
            writesThisRun,

        timelineEvents
            [...timelineEvents],

        runtimeMs
    };
}


 ============================================================
  19. START
  ============================================================
 

try {

    return await main();

} catch (error) {

    console.error(
        `AIRZONE CONTROLLER MISLUKT  ` +
        `${errorText(error)}`
    );

    return {

        success
            false,

        timezone
            CONFIG.timezone,

        localTime
            getLocalClock()
                .displayTime,

        utcTime
            new Date()
                .toISOString(),

        error
            errorText(error)
    };
}
