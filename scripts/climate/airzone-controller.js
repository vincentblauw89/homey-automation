/**
 * ============================================================
 * AIRZONE BOVEN V2.4
 * FAST-PATH CONTROLLER MET EUROPE/AMSTERDAM TIMEZONE
 * ============================================================
 *
 * Uitvoeren:
 * - iedere 5 minuten
 * - eventueel ook bij wijziging van modus of vakantie
 *
 * TIMEZONE:
 * - Alle beslissingen gebruiken Europe/Amsterdam
 * - Automatische ondersteuning voor CET en CEST
 * - Nooit afhankelijk van de runtime-timezone
 *
 * WINTER
 *
 * Master:
 * - Venster 18:00 tot 06:00 Nederlandse tijd
 * - Start onder 15,0 °C
 * - Verwarm tot 17,0 °C
 * - Om 06:00 altijd uit
 *
 * Abel en Hugo:
 * - Venster 18:00 tot 07:30 Nederlandse tijd
 * - Start onder 16,7 °C
 * - Stop vanaf 17,2 °C
 * - Doel 17,0 °C
 *
 * Badkamer:
 * - Avondcomfort 18:00 tot 21:30 Nederlandse tijd
 * - Daarna hard uit tijdens de nacht
 * - Voorspellende voorverwarming richting 06:00
 * - Ochtendcomfort 06:00 tot 07:30
 * - Doel 21,0 °C
 * - Verwarmingssnelheid afhankelijk van buitentemperatuur
 *
 * ZOMER
 *
 * - Cooling
 * - Master 19,0 °C
 * - Abel 20,0 °C
 * - Hugo 20,0 °C
 * - Badkamer 21,0 °C
 *
 * VAKANTIE
 *
 * - Overrulet winter en zomer
 * - Alle zones 24/7
 * - Start onder 12,0 °C
 * - Verwarm tot 12,5 °C
 * - Uit vanaf 12,5 °C
 *
 * MELDINGEN
 *
 * - 18:00-push via Airzone Push bericht
 * - Timeline via Airzone Timeline bericht
 * - Alleen betekenisvolle acties
 *
 * HANDMATIGE OVERRIDE (V2.4, alleen winter, dag en nacht)
 *
 * - Zet je een zone zelf aan (thermostaat of Airzone-app),
 *   of verander je het doel van een zone die aan staat met
 *   minstens 0,5 °C, dan laat het script die zone volledig
 *   met rust tot het eerstvolgende schakelmoment:
 * - Master: 18:00 of 06:00
 * - Abel en Hugo: 18:00 of 07:30
 * - Badkamer: 18:00, 21:30, 06:00 of 07:30
 * - Voorbeeld: om 02:00 Abel op 19 °C gezet -> tot 07:30
 * - Zet je de zone zelf weer uit, dan stopt de override direct
 * - Vakantie en zomer beëindigen alle overrides
 * - Vereist tekstvariabele "Airzone override state"
 *   (mag leeg zijn); zonder die variabele is de override uit
 *
 * FAST PATH
 *
 * - Geen writes als alles goed staat
 * - Geen wachttijd zonder echte write
 * - Maximaal 3 pogingen per write
 * ============================================================
 */


/* ============================================================
 * 1. CONFIGURATIE
 * ============================================================
 */

const CONFIG = {

    version:
        '2.4',

    timezone:
        'Europe/Amsterdam',

    devices: {

        master:
            '748dc15f-8ce0-48af-a658-f679acc7e8f4',

        abel:
            'a10c5a80-b5ca-461a-a9ce-2640f0a52a30',

        hugo:
            'e2c377d5-a86e-4d65-9d66-16898a41a03e',

        badkamer:
            '137c8071-ef8d-492e-b99a-25bb26619fa6'
    },

    logic: {

        vacation:
            'Vakantie',

        mode:
            'Airzone modus',

        pushDate:
            'Airzone Push datum',

        pushMessage:
            'Airzone Push bericht',

        timelineMessage:
            'Airzone Timeline bericht',

        winterActive:
            'Airzone Winter actief',

        masterCycle:
            'Airzone Master verwarmcyclus',

        outsideTemperature:
            'Actuele temp. buiten'
    },

    winter: {

        master: {

            activeFrom:
                '18:00',

            activeUntil:
                '06:00',

            startBelow:
                15.0,

            stopAt:
                17.0,

            target:
                17.0
        },

        bedrooms: {

            activeFrom:
                '18:00',

            activeUntil:
                '07:30'
        },

        abel: {

            startBelow:
                16.7,

            stopAt:
                17.2,

            target:
                17.0
        },

        hugo: {

            startBelow:
                16.7,

            stopAt:
                17.2,

            target:
                17.0
        },

        bathroom: {

            eveningFrom:
                '18:00',

            eveningUntil:
                '21:30',

            morningTargetTime:
                '06:00',

            morningUntil:
                '07:30',

            /*
             * Normale comfortregeling in avond en ochtend.
             */
            startBelow:
                20.2,

            stopAt:
                20.7,

            target:
                20.5,

            /*
             * Na het bereiken van 21,2 °C in de predictieve fase
             * niet opnieuw starten, tenzij de badkamer onder 20,5 °C zakt.
             */
            predictiveRestartBelow:
                20.0,

            /*
             * Buitentemperatuurmodel:
             * <=10 °C buiten: 1,0 °C per uur
             * 10-20 °C buiten: lineair 1,0 -> 1,6 °C per uur
             * >=20 °C buiten: 1,6 °C per uur
             */
            heatingRateCold:
                0.8,

            heatingRateWarm:
                1.3,

            heatingRateColdUntil:
                10.0,

            heatingRateWarmFrom:
                20.0,

            fallbackHeatingRate:
                0.8,

            predictiveSafetyMinutes:
                15,

            predictiveMaxPreheatMinutes:
                300,

            predictiveMinGap:
                0.1
        }
    },

    summer: {

        master:
            19.0,

        abel:
            20.0,

        hugo:
            20.0,

        badkamer:
            21.0
    },

    vacation: {

        startBelow:
            12.0,

        stopAt:
            12.5,

        target:
            12.5
    },

    push: {

        enabled:
            true,

        start:
            '18:00',

        end:
            '18:15',

        suppressDuringVacation:
            true,

        includeTemperatures:
            true,

        includeTargets:
            true
    },

    timeline: {

        enabled:
            true,

        aggregateActions:
            true
    },

    override: {

        enabled:
            true,

        /*
         * Tekstvariabele waarin het script per zone onthoudt
         * of het de zone zelf aan of uit heeft gelaten.
         */
        stateVariable:
            'Airzone override state',

        /*
         * Vangnet: een override duurt nooit langer dan dit.
         */
        maxHours:
            24
    },

    timing: {

        afterMode:
            1500,

        afterInitialOn:
            2000,

        afterTarget:
            1500,

        afterOff:
            1500,

        afterRealChange:
            750,

        betweenChangedZones:
            1000,

        retryDelay:
            3000
    },

    retries:
        3,

    targetTolerance:
        0.1,

    validTemperature: {

        min:
            5,

        max:
            40
    }
};


/* ============================================================
 * 2. RUNTIME
 * ============================================================
 */

let deviceCache = {};

let writesThisRun =
    0;

const timelineEvents = [];


/* ============================================================
 * 3. ALGEMENE HELPERS
 * ============================================================
 */

function normalize(value) {

    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}


function errorText(error) {

    if (!error) {
        return 'Onbekende fout';
    }

    return (
        error.message ||
        String(error)
    );
}


function formatTemp(value) {

    return typeof value === 'number' &&
        Number.isFinite(value)
        ? `${value.toFixed(1)} °C`
        : 'onbekend';
}


function validTemperature(value) {

    return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >=
            CONFIG.validTemperature.min &&
        value <=
            CONFIG.validTemperature.max
    );
}


async function pause(milliseconds) {

    if (
        typeof milliseconds !== 'number' ||
        milliseconds <= 0
    ) {
        return;
    }

    await wait(milliseconds);
}


/* ============================================================
 * 4. TIMEZONE-SAFE CLOCK
 * ============================================================
 */

/**
 * Zet een Date expliciet om naar Europe/Amsterdam.
 *
 * Daardoor worden automatisch ondersteund:
 *
 * - CET in de winter
 * - CEST in de zomer
 * - overgang naar zomertijd
 * - overgang naar wintertijd
 *
 * Gebruik voor regelbeslissingen nooit direct:
 *
 * - date.getHours()
 * - date.getMinutes()
 * - date.getFullYear()
 * - date.getMonth()
 * - date.getDate()
 */

function getLocalClock(
    date = new Date()
) {

    const formatter =
        new Intl.DateTimeFormat(
            'en-GB',
            {
                timeZone:
                    CONFIG.timezone,

                year:
                    'numeric',

                month:
                    '2-digit',

                day:
                    '2-digit',

                hour:
                    '2-digit',

                minute:
                    '2-digit',

                second:
                    '2-digit',

                hourCycle:
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

        year:
            Number(parts.year),

        month:
            Number(parts.month),

        day:
            Number(parts.day),

        hour,

        minute,

        second,

        minutesSinceMidnight:
            hour * 60 +
            minute,

        secondsSinceMidnight:
            hour * 3600 +
            minute * 60 +
            second,

        dateKey:
            `${parts.year}-` +
            `${parts.month}-` +
            `${parts.day}`,

        displayDate:
            `${parts.day}-` +
            `${parts.month}-` +
            `${parts.year}`,

        displayTime:
            `${parts.hour}:` +
            `${parts.minute}:` +
            `${parts.second}`,

        shortTime:
            `${parts.hour}:` +
            `${parts.minute}`,

        timezone:
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
                /^(\d{1,2}):(\d{2})$/
            );

    if (!match) {

        throw new Error(
            `Ongeldige tijdconfiguratie: ${value}`
        );
    }

    const hour =
        Number(match[1]);

    const minute =
        Number(match[2]);

    if (
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
    ) {

        throw new Error(
            `Ongeldige tijdconfiguratie: ${value}`
        );
    }

    return (
        hour * 60 +
        minute
    );
}


/**
 * Ondersteunt ook tijdvensters over middernacht.
 *
 * Voorbeelden:
 *
 * 18:00 tot 06:00
 * 18:00 tot 07:30
 *
 * Het eindtijdstip is exclusief:
 *
 * 05:59 = actief
 * 06:00 = niet actief
 */

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
        start < end
    ) {

        return (
            current >= start &&
            current < end
        );
    }

    return (
        current >= start ||
        current < end
    );
}


/* ============================================================
 * 5. TIMELINE
 * ============================================================
 */

function addTimelineEvent(message) {

    if (
        !CONFIG.timeline.enabled
    ) {
        return;
    }

    timelineEvents.push(message);

    log(
        `Timeline-event | ${message}`
    );
}


async function publishTimelineEvents(
    logic
) {

    if (
        !CONFIG.timeline.enabled ||
        timelineEvents.length === 0
    ) {
        return;
    }

    const uniqueEvents = [
        ...new Set(timelineEvents)
    ];

    const text =
        `Airzone boven [${shortTimestamp()}]\n` +
        uniqueEvents.join('\n');

    await setLogicVariable(
        logic.timelineMessage,
        text
    );

    log(
        `Timeline voorbereid | ` +
        `${uniqueEvents.length} actie(s)`
    );
}


/* ============================================================
 * 6. DEVICE-CACHE
 * ============================================================
 */

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
        ?.capabilitiesObj
        ?.[capabilityId]
        ?.value;
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
            ? device.capabilities
            : [];

    const missingCapabilities =
        requiredCapabilities.filter(
            capabilityId =>
                !capabilities.includes(
                    capabilityId
                )
        );

    if (
        missingCapabilities.length > 0
    ) {

        throw new Error(
            `${label} mist capabilities: ` +
            missingCapabilities.join(', ')
        );
    }
}


/* ============================================================
 * 7. LOGIC-VARIABELEN
 * ============================================================
 */

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
            variable =>
                normalize(variable.name) ===
                normalize(variableName)
        ) ||
        null
    );
}


async function readLogicState() {

    const variables =
        await getLogicVariables();

    const result = {

        vacation:
            findLogicVariable(
                variables,
                CONFIG.logic.vacation
            ),

        mode:
            findLogicVariable(
                variables,
                CONFIG.logic.mode
            ),

        pushDate:
            findLogicVariable(
                variables,
                CONFIG.logic.pushDate
            ),

        pushMessage:
            findLogicVariable(
                variables,
                CONFIG.logic.pushMessage
            ),

        timelineMessage:
            findLogicVariable(
                variables,
                CONFIG.logic.timelineMessage
            ),

        winterActive:
            findLogicVariable(
                variables,
                CONFIG.logic.winterActive
            ),

        masterCycle:
            findLogicVariable(
                variables,
                CONFIG.logic.masterCycle
            ),

        outsideTemperature:
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
                `Logic-variabele ontbreekt: ` +
                `${CONFIG.logic[key]}`
            );
        }
    }

    if (
        typeof result.vacation.value !==
        'boolean'
    ) {

        throw new Error(
            `"${CONFIG.logic.vacation}" ` +
            `moet een Ja/Nee-variabele zijn`
        );
    }

    if (
        typeof result.winterActive.value !==
        'boolean'
    ) {

        throw new Error(
            `"${CONFIG.logic.winterActive}" ` +
            `moet een Ja/Nee-variabele zijn`
        );
    }

    if (
        typeof result.masterCycle.value !==
        'boolean'
    ) {

        throw new Error(
            `"${CONFIG.logic.masterCycle}" ` +
            `moet een Ja/Nee-variabele zijn`
        );
    }

    if (
        typeof result.outsideTemperature.value !==
            'number' ||
        !Number.isFinite(
            result.outsideTemperature.value
        )
    ) {

        throw new Error(
            `"${CONFIG.logic.outsideTemperature}" ` +
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
            `"${CONFIG.logic.mode}" bevat ` +
            `"${String(result.mode.value)}". ` +
            `Gebruik "Winter" of "Zomer".`
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
            `Logic | ${variable.name} al ` +
            `${String(newValue)}`
        );

        return {
            changed:
                false
        };
    }

    log(
        `Logic | ${variable.name}: ` +
        `${String(variable.value)} -> ` +
        `${String(newValue)}`
    );

    await Homey.logic.updateVariable({
        id:
            variable.id,

        variable: {
            value:
                newValue
        }
    });

    variable.value =
        newValue;

    return {
        changed:
            true
    };
}


/* ============================================================
 * 8. CAPABILITY-WRITES
 * ============================================================
 */

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
            ) <=
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
        attempt <= CONFIG.retries;
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
                    `${label} | ${capabilityId} al ` +
                    `${String(desiredValue)}`
                );

                return {
                    success:
                        true,

                    changed:
                        false,

                    previousValue:
                        currentValue,

                    value:
                        currentValue
                };
            }

            log(
                `${label} | ${capabilityId}: ` +
                `${String(currentValue)} -> ` +
                `${String(desiredValue)} | ` +
                `poging ${attempt}/${CONFIG.retries}`
            );

            await Homey.devices
                .setCapabilityValue({
                    deviceId,
                    capabilityId,
                    value:
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
                    `${label} | bevestigd: ` +
                    `${capabilityId}=` +
                    `${String(checkedValue)}`
                );

                return {
                    success:
                        true,

                    changed:
                        true,

                    previousValue:
                        currentValue,

                    value:
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
                `WAARSCHUWING | ${label} | ` +
                `${capabilityId} | ` +
                `${errorText(error)}`
            );

            if (
                attempt <
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
        `${label}: ${capabilityId} mislukt. ` +
        `${errorText(lastError)}`
    );
}


/* ============================================================
 * 9. BASISACTIES
 * ============================================================
 */

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
            `${label} | zone uit | inschakelen`
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
            changed ||
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
        changed ||
        targetResult.changed;

    return {
        changed,
        switchedOn,

        targetChanged:
            targetResult.changed
    };
}


/* ============================================================
 * 10. MASTER WINTER
 * ============================================================
 */

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
        `Master | ${formatTemp(temperature)} | ` +
        `venster=${windowActive ? 'ACTIEF' : 'UIT'} | ` +
        `AAN=${isOn} | cyclus=${cycleActive}`
    );

    /*
     * Buiten 18:00-06:00 hard uitschakelen.
     */

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
                changed ||
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
            changed ||
            cycleResult.changed;

        return {
            changed
        };
    }

    /*
     * Stoppen vanaf 17,0 °C.
     */

    if (
        temperature >=
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
                changed ||
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
            changed ||
            cycleResult.changed;

        return {
            changed
        };
    }

    /*
     * Nieuwe cyclus starten onder 15,0 °C.
     */

    if (
        temperature <
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
                `${formatTemp(temperature)} -> ` +
                `${formatTemp(CONFIG.winter.master.target)}`
            );
        }
    }

    /*
     * Actieve cyclus doorzetten.
     */

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
            changed ||
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
            changed ||
            onResult.changed;

        if (
            onResult.switchedOn &&
            !timelineEvents.some(
                event =>
                    event.includes(
                        'Master failsafe gestart'
                    )
            )
        ) {

            addTimelineEvent(
                `🔥 Master verwarming ingeschakeld, ` +
                `${formatTemp(temperature)} -> ` +
                `${formatTemp(CONFIG.winter.master.target)}`
            );
        }

        return {
            changed
        };
    }

    /*
     * Binnen het tijdvenster, maar zonder cyclus.
     */

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
        changed:
            false
    };
}


/* ============================================================
 * 11. WINTER COMFORTZONE
 * ============================================================
 */

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
            `${label}: temperatuur is ongeldig`
        );
    }

    log(
        `${label} | ${formatTemp(temperature)} | ` +
        `AAN=${isOn}`
    );

    /*
     * Stoppen vanaf bovengrens.
     */

    if (
        temperature >=
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
            changed:
                false
        };
    }

    /*
     * Starten onder ondergrens.
     */

    if (
        temperature <
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
            changed ||
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
            changed ||
            onResult.changed;

        if (
            onResult.switchedOn
        ) {

            const icon =
                label === 'Badkamer'
                    ? '🚿'
                    : '🔥';

            addTimelineEvent(
                `${icon} ${label} verwarming gestart, ` +
                `${formatTemp(temperature)} -> ` +
                `${formatTemp(settings.target)}`
            );
        }

        return {
            changed
        };
    }

    /*
     * Binnen hysterese huidige toestand behouden.
     */

    if (isOn) {

        return await setTarget(
            deviceId,
            label,
            settings.target
        );
    }

    return {
        changed:
            false
    };
}


/* ============================================================
 * 12. SLAAPKAMERS
 * ============================================================
 */

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
        `${label} | venster=` +
        `${windowActive ? 'ACTIEF' : 'UIT'}`
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
            changed:
                false
        };
    }

    return await controlWinterComfortZone(
        deviceId,
        label,
        settings
    );
}


/* ============================================================
 * 13. BADKAMER
 * ============================================================
 */

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
        isBathroomEveningWindowActive() ||
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

    if (difference <= 0) {
        difference +=
            24 * 60;
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
            rate:
                settings.fallbackHeatingRate,

            source:
                'fallback'
        };
    }

    if (
        outsideTemperature <=
        settings.heatingRateColdUntil
    ) {

        return {
            rate:
                settings.heatingRateCold,

            source:
                'cold'
        };
    }

    if (
        outsideTemperature >=
        settings.heatingRateWarmFrom
    ) {

        return {
            rate:
                settings.heatingRateWarm,

            source:
                'warm'
        };
    }

    const position =
        (
            outsideTemperature -
            settings.heatingRateColdUntil
        ) /
        (
            settings.heatingRateWarmFrom -
            settings.heatingRateColdUntil
        );

    return {
        rate:
            settings.heatingRateCold +
            position *
            (
                settings.heatingRateWarm -
                settings.heatingRateCold
            ),

        source:
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
            valid:
                false,

            shouldPreheat:
                false,

            reason:
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
        gap <=
        settings.predictiveMinGap
    ) {

        return {
            valid:
                true,

            shouldPreheat:
                false,

            gap,

            heatingRate:
                rateResult.rate,

            heatingRateSource:
                rateResult.source,

            minutesUntilTarget,

            estimatedHeatingMinutes:
                0,

            requiredMinutes:
                0,

            reason:
                'doeltemperatuur praktisch bereikt'
        };
    }

    const estimatedHeatingMinutes =
        gap /
        rateResult.rate *
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
        valid:
            true,

        shouldPreheat:
            minutesUntilTarget <=
            requiredMinutes,

        gap,

        heatingRate:
            rateResult.rate,

        heatingRateSource:
            rateResult.source,

        minutesUntilTarget,

        estimatedHeatingMinutes:
            Math.ceil(
                estimatedHeatingMinutes
            ),

        requiredMinutes,

        reason:
            minutesUntilTarget <=
            requiredMinutes
                ? 'voorspellende start nodig'
                : 'nog te vroeg voor voorverwarming'
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
            'Badkamer: temperatuur is ongeldig'
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
        `Badkamer | ${formatTemp(temperature)} | ` +
        `buiten=${formatTemp(outsideTemperature)} | ` +
        `tijd=${clock.shortTime} | ` +
        `avond=${eveningActive ? 'ACTIEF' : 'UIT'} | ` +
        `ochtend=${morningActive ? 'ACTIEF' : 'UIT'} | ` +
        `predictief=${predictiveNight ? 'ACTIEF' : 'UIT'} | ` +
        `snelheid=${prediction.heatingRate.toFixed(2)} °C/u | ` +
        `AAN=${isOn}`
    );

    /*
     * Regulier comfort tussen 18:00-21:30 en 06:00-07:30.
     */
    if (
        eveningActive ||
        morningActive
    ) {

        return await controlWinterComfortZone(
            CONFIG.devices.badkamer,
            'Badkamer',
            settings
        );
    }

    /*
     * Nacht vóór het predictieve startmoment: altijd uit.
     */
    if (!predictiveNight) {

        log(
            `Badkamer nacht | uit tot predictieve start | ` +
            `06:00 over ${prediction.minutesUntilTarget} min | ` +
            `geschat nodig=${prediction.requiredMinutes} min | ` +
            `model=${prediction.heatingRate.toFixed(2)} °C/u`
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
                    `predictieve verwarming richting 06:00`
                );
            }

            return result;
        }

        return {
            changed:
                false
        };
    }

    /*
     * Tijdens de predictieve fase stoppen op 21,2 °C.
     */
    if (
        temperature >=
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
            changed:
                false
        };
    }

    /*
     * Is de zone eerder tijdens de predictieve fase gestopt,
     * dan pas opnieuw starten onder 20,5 °C.
     */
    if (
        !isOn &&
        temperature >=
            settings.predictiveRestartBelow
    ) {

        log(
            `Badkamer predictief | uit blijven; ` +
            `${formatTemp(temperature)} >= ` +
            `herstartgrens ` +
            `${formatTemp(settings.predictiveRestartBelow)}`
        );

        return {
            changed:
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
        changed ||
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
        changed ||
        onResult.changed;

    if (onResult.switchedOn) {

        addTimelineEvent(
            `⏱️ Badkamer voorspellend gestart, ` +
            `${formatTemp(temperature)} -> ` +
            `${formatTemp(settings.target)} voor 06:00 | ` +
            `buiten ${formatTemp(outsideTemperature)} | ` +
            `${prediction.heatingRate.toFixed(2)} °C/u | ` +
            `${prediction.requiredMinutes} min nodig`
        );
    }

    return {
        changed
    };
}


/* ============================================================
 * 14. ZOMER
 * ============================================================
 */

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
        `${label} zomer | ` +
        `${formatTemp(temperature)} | ` +
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
        changed ||
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
        changed ||
        onResult.changed;

    if (
        !wasOn &&
        onResult.switchedOn
    ) {

        addTimelineEvent(
            `❄️ ${label} koeling gestart, ` +
            `${formatTemp(temperature)} -> ` +
            `${formatTemp(target)}`
        );
    }

    return {
        changed
    };
}


/* ============================================================
 * 15. VAKANTIE
 * ============================================================
 */

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
            `${label}: temperatuur is ongeldig`
        );
    }

    log(
        `${label} vakantie | ` +
        `${formatTemp(temperature)} | ` +
        `AAN=${isOn}`
    );

    /*
     * Vanaf 12,5 °C uitschakelen.
     */

    if (
        temperature >=
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
            changed:
                false
        };
    }

    /*
     * Onder 12,0 °C starten.
     */

    if (
        temperature <
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
            changed ||
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
            changed ||
            onResult.changed;

        if (
            onResult.switchedOn
        ) {

            addTimelineEvent(
                `🛡️ Vakantie-failsafe ${label} gestart, ` +
                `${formatTemp(temperature)} -> ` +
                `${formatTemp(CONFIG.vacation.target)}`
            );
        }

        return {
            changed
        };
    }

    /*
     * Tussen 12,0 en 12,5 °C huidige toestand behouden.
     */

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
            changed ||
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
            changed ||
            onResult.changed;

        return {
            changed
        };
    }

    return {
        changed:
            false
    };
}


/* ============================================================
 * 16. 18:00 PUSH
 * ============================================================
 */

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

    /*
     * 18:00 inclusief, 18:15 exclusief.
     *
     * Bij runs iedere vijf minuten zijn dus geldig:
     *
     * 18:00
     * 18:05
     * 18:10
     */

    return (
        current >= start &&
        current < end
    );
}


async function preparePushMessage(
    logic
) {

    if (
        !CONFIG.push.enabled ||
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
            '18:00 push overgeslagen wegens vakantie'
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
            '18:00 push is vandaag al voorbereid'
        );

        return;
    }

    await refreshAllDevices();

    const definitions = [

        {
            id:
                CONFIG.devices.master,

            label:
                'Master'
        },

        {
            id:
                CONFIG.devices.abel,

            label:
                'Abel'
        },

        {
            id:
                CONFIG.devices.hugo,

            label:
                'Hugo'
        },

        {
            id:
                CONFIG.devices.badkamer,

            label:
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

            label:
                zone.label,

            temperature:
                capabilityValue(
                    device,
                    'measure_temperature'
                ),

            target:
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
            '18:00 | geen actieve zones | geen push'
        );

        return;
    }

    const isWinter =
        logic.normalizedMode ===
        'winter';

    const icon =
        isWinter
            ? '🔥'
            : '❄️';

    const action =
        isWinter
            ? 'verwarming'
            : 'koeling';

    const zoneText =
        activeZones
            .map(
                zone => {

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
        `${icon} Airzone boven: ` +
        `${action} actief. ` +
        `Zones: ${zoneText}. ` +
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
        `18:00 push voorbereid | ${message}`
    );
}


/* ============================================================
 * 16A. HANDMATIGE OVERRIDE
 * ============================================================
 *
 * Werking:
 *
 * - Na iedere run onthoudt het script per zone of die aan of
 *   uit stond (lastOn) en welk doel er stond (lastTarget).
 * - Staat een zone nu aan terwijl het script hem de vorige run
 *   uit liet, dan heeft iemand hem handmatig aangezet: override.
 * - Staat een zone aan en is het doel sinds de vorige run met
 *   minstens een halve graad veranderd, dan heeft iemand de
 *   temperatuur aangepast: ook override. Zo kun je 's avonds en
 *   's nachts warmer zetten zonder dat het script hem uitzet.
 * - Tijdens een override slaat het script de zone volledig over.
 * - De override stopt op het eerstvolgende schakelmoment van de
 *   zone (zie OVERRIDE_BOUNDARIES), als de zone weer uit staat
 *   of als de maximale duur is bereikt.
 */

const OVERRIDE_ZONES = [
    'Master',
    'Abel',
    'Hugo',
    'Badkamer'
];


/*
 * Minimale wijziging van het doel die als handmatige
 * aanpassing telt. Airzone stapt per 0,5 °C.
 */
const OVERRIDE_TARGET_DELTA =
    0.4;


/**
 * Schakelmomenten per zone. Een override loopt tot het
 * eerstvolgende moment na de start.
 *
 * Master:   18:00 (start), 06:00 (einde)
 * Abel/Hugo: 18:00 (start), 07:30 (einde)
 * Badkamer: 18:00, 21:30 (nacht), 06:00 (ochtend), 07:30 (einde)
 */
function overrideBoundaries(label) {

    const winter =
        CONFIG.winter;

    switch (label) {

        case 'Master':
            return [
                winter.master.activeFrom,
                winter.master.activeUntil
            ];

        case 'Abel':
        case 'Hugo':
            return [
                winter.bedrooms.activeFrom,
                winter.bedrooms.activeUntil
            ];

        case 'Badkamer':
            return [
                winter.bathroom.eveningFrom,
                winter.bathroom.eveningUntil,
                winter.bathroom.morningTargetTime,
                winter.bathroom.morningUntil
            ];

        default:
            return [
                '18:00'
            ];
    }
}


/**
 * Eerstvolgend schakelmoment na `date`, als tijdstip (ms)
 * en als tekst (HH:MM, Nederlandse tijd).
 */
function nextOverrideEnd(
    label,
    date = new Date()
) {

    const clock =
        getLocalClock(date);

    let best =
        null;

    for (const time of overrideBoundaries(label)) {

        const minutes =
            minutesUntilLocalTime(
                time,
                date
            );

        if (
            !best ||
            minutes < best.minutes
        ) {
            best = {
                minutes,
                time
            };
        }
    }

    return {
        endsAt:
            date.getTime() +
            best.minutes * 60000 -
            clock.second * 1000,

        endText:
            best.time
    };
}


function emptyOverrideZone() {

    return {
        lastOn:
            null,

        lastTarget:
            null,

        override:
            null
    };
}


function parseOverrideData(raw) {

    const data = {
        zones: {}
    };

    let parsed = null;

    if (
        typeof raw === 'string' &&
        raw.trim() !== ''
    ) {

        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            log(
                'Override | state ongeldig; opnieuw begonnen'
            );
        }
    }

    for (const label of OVERRIDE_ZONES) {

        const input =
            parsed?.zones?.[label];

        const zone =
            emptyOverrideZone();

        if (
            typeof input?.lastOn === 'boolean'
        ) {
            zone.lastOn = input.lastOn;
        }

        if (
            validTemperature(input?.lastTarget)
        ) {
            zone.lastTarget = Number(input.lastTarget);
        }

        const startedAt =
            Number(input?.override?.startedAt);

        if (
            Number.isFinite(startedAt) &&
            startedAt > 0
        ) {

            let endsAt =
                Number(input.override.endsAt);

            let endText =
                input.override.endText;

            /*
             * Overrides uit V2.3 hebben nog geen eindtijd:
             * eindtijd afleiden van het startmoment.
             */
            if (
                !Number.isFinite(endsAt) ||
                endsAt <= 0 ||
                typeof endText !== 'string'
            ) {
                const end =
                    nextOverrideEnd(
                        label,
                        new Date(startedAt)
                    );

                endsAt = end.endsAt;
                endText = end.endText;
            }

            zone.override = {
                startedAt,
                endsAt,
                endText,
                reason:
                    typeof input.override.reason === 'string'
                        ? input.override.reason
                        : 'aangezet'
            };
        }

        data.zones[label] = zone;
    }

    return data;
}


async function loadOverrideState() {

    if (!CONFIG.override.enabled) {

        return {
            enabled:
                false
        };
    }

    const variable =
        findLogicVariable(
            await getLogicVariables(),
            CONFIG.override.stateVariable
        );

    if (!variable) {

        log(
            `WAARSCHUWING | Override uit: maak tekstvariabele ` +
            `"${CONFIG.override.stateVariable}" aan`
        );

        return {
            enabled:
                false
        };
    }

    if (variable.type !== 'string') {

        log(
            `WAARSCHUWING | Override uit: ` +
            `"${CONFIG.override.stateVariable}" moet een ` +
            `tekstvariabele zijn`
        );

        return {
            enabled:
                false
        };
    }

    return {
        enabled:
            true,

        variable,

        data:
            parseOverrideData(variable.value)
    };
}


async function saveOverrideState(state) {

    if (!state.enabled) {
        return;
    }

    await setLogicVariable(
        state.variable,
        JSON.stringify(state.data)
    );
}


function endOverride(
    label,
    zone,
    reason
) {

    zone.override =
        null;

    addTimelineEvent(
        `↩️ ${label} override beëindigd, ${reason}`
    );
}


function startOverride(
    label,
    zone,
    reason,
    detail
) {

    const end =
        nextOverrideEnd(label);

    zone.override = {
        startedAt:
            Date.now(),

        endsAt:
            end.endsAt,

        endText:
            end.endText,

        reason
    };

    addTimelineEvent(
        `✋ ${label} handmatig ${detail}; ` +
        `override tot ${end.endText}`
    );
}


/**
 * Geeft true als de zone deze run overgeslagen moet worden.
 */
function checkOverride(
    label,
    deviceId,
    state
) {

    if (!state.enabled) {
        return false;
    }

    const zone =
        state.data.zones[label];

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

    const target =
        capabilityValue(
            device,
            'target_temperature'
        );

    if (zone.override) {

        const hours =
            (Date.now() - zone.override.startedAt) /
            3600000;

        if (Date.now() >= zone.override.endsAt) {

            endOverride(
                label,
                zone,
                `${zone.override.endText} bereikt; programma neemt het over`
            );

            return false;
        }

        if (!isOn) {

            endOverride(
                label,
                zone,
                'zone handmatig uitgezet'
            );

            return false;
        }

        if (hours >= CONFIG.override.maxHours) {

            endOverride(
                label,
                zone,
                `maximale duur van ${CONFIG.override.maxHours} uur bereikt`
            );

            return false;
        }

        log(
            `${label} | OVERRIDE actief sinds ` +
            `${hours.toFixed(1)} uur | ` +
            `${formatTemp(capabilityValue(device, 'measure_temperature'))} | ` +
            `doel=${formatTemp(target)} | ` +
            `script blijft eraf tot ${zone.override.endText}`
        );

        return true;
    }

    if (!isOn) {
        return false;
    }

    if (zone.lastOn === false) {

        startOverride(
            label,
            zone,
            'aangezet',
            `aangezet (doel ${formatTemp(target)})`
        );

        return true;
    }

    if (
        zone.lastOn === true &&
        validTemperature(target) &&
        validTemperature(zone.lastTarget) &&
        Math.abs(target - zone.lastTarget) >=
            OVERRIDE_TARGET_DELTA
    ) {

        startOverride(
            label,
            zone,
            'doel aangepast',
            `op ${formatTemp(target)} gezet ` +
            `(was ${formatTemp(zone.lastTarget)})`
        );

        return true;
    }

    return false;
}


function recordZoneState(
    label,
    deviceId,
    state
) {

    if (!state.enabled) {
        return;
    }

    const device =
        deviceCache[deviceId];

    if (!device) {
        return;
    }

    state.data.zones[label].lastOn =
        capabilityValue(
            device,
            'onoff'
        ) === true;

    const target =
        capabilityValue(
            device,
            'target_temperature'
        );

    state.data.zones[label].lastTarget =
        validTemperature(target)
            ? Number(target)
            : null;
}


/**
 * Buiten de winterregeling geen overrides en geen
 * detectie: lastOn wordt gewist zodat de eerste winterrun
 * na zomer of vakantie niets ten onrechte als override ziet.
 */
function resetOverrides(
    state,
    reason
) {

    if (!state.enabled) {
        return;
    }

    for (const label of OVERRIDE_ZONES) {

        const zone =
            state.data.zones[label];

        if (zone.override) {

            endOverride(
                label,
                zone,
                reason
            );
        }

        zone.lastOn =
            null;

        zone.lastTarget =
            null;
    }
}


async function runWinterZone(
    label,
    deviceId,
    state,
    action
) {

    let skip =
        false;

    try {

        skip =
            checkOverride(
                label,
                deviceId,
                state
            );

    } catch (error) {

        log(
            `WAARSCHUWING | ${label} | override-check mislukt: ` +
            `${errorText(error)}`
        );
    }

    const result =
        skip
            ? {
                changed:
                    false
            }
            : await runSafely(
                label,
                action
            );

    recordZoneState(
        label,
        deviceId,
        state
    );

    return result;
}


function activeOverrides(state) {

    if (!state.enabled) {
        return [];
    }

    return OVERRIDE_ZONES.filter(
        label =>
            state.data.zones[label].override !== null
    );
}


/* ============================================================
 * 17. VEILIGE UITVOERING
 * ============================================================
 */

async function runSafely(
    label,
    action
) {

    try {

        const result =
            await action();

        return (
            result ||
            {
                changed:
                    false
            }
        );

    } catch (error) {

        const message =
            `${label}: ${errorText(error)}`;

        console.error(
            `FOUT | ${message}`
        );

        addTimelineEvent(
            `⚠️ Airzone-fout: ${message}`
        );

        await refreshAllDevices();

        return {
            changed:
                false,

            failed:
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


/* ============================================================
 * 18. MAIN
 * ============================================================
 */

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
        `${localClock.displayTime} | ` +
        `timezone=${localClock.timezone} | ` +
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
        `Devices OK | ` +
        `${master.name}, ` +
        `${abel.name}, ` +
        `${hugo.name}, ` +
        `${badkamer.name}`
    );

    const logic =
        await readLogicState();

    const overrideState =
        await loadOverrideState();

    const mode =
        logic.normalizedMode;

    const vacation =
        logic.vacation.value ===
        true;

    log(
        `Modus=${mode.toUpperCase()} | ` +
        `Vakantie=${vacation ? 'JA' : 'NEE'}`
    );

    log(
        `Buitentemperatuur=` +
        `${formatTemp(logic.outsideTemperature.value)}`
    );

    log(
        `Vensters | Master=` +
        `${isMasterWinterWindowActive()
            ? 'ACTIEF'
            : 'UIT'
        } | ` +
        `Slaapkamers=` +
        `${isBedroomWindowActive()
            ? 'ACTIEF'
            : 'UIT'
        } | ` +
        `Badkamer=` +
        `${isBathroomWindowActive()
            ? 'ACTIEF'
            : 'UIT'
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
                ? '🔥 Winterregeling geactiveerd'
                : '⏹️ Winterregeling gedeactiveerd'
        );
    }

    if (
        mode !== 'winter' ||
        vacation
    ) {

        await setLogicVariable(
            logic.masterCycle,
            false
        );
    }


    /* ========================================================
     * VAKANTIE
     * ========================================================
     */

    if (vacation) {

        log(
            'VAKANTIEFAILSAFE ACTIEF'
        );

        resetOverrides(
            overrideState,
            'vakantie actief'
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
                id:
                    CONFIG.devices.master,

                label:
                    'Master'
            },

            {
                id:
                    CONFIG.devices.abel,

                label:
                    'Abel'
            },

            {
                id:
                    CONFIG.devices.hugo,

                label:
                    'Hugo'
            },

            {
                id:
                    CONFIG.devices.badkamer,

                label:
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
                    async () =>
                        await controlVacationZone(
                            zone.id,
                            zone.label
                        )
                );

            await afterZone(result);
        }
    }


    /* ========================================================
     * WINTER
     * ========================================================
     */

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
            await runWinterZone(
                'Master',
                CONFIG.devices.master,
                overrideState,
                async () =>
                    await controlWinterMaster(
                        logic
                    )
            );

        await afterZone(
            masterResult
        );

        const abelResult =
            await runWinterZone(
                'Abel',
                CONFIG.devices.abel,
                overrideState,
                async () =>
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
            await runWinterZone(
                'Hugo',
                CONFIG.devices.hugo,
                overrideState,
                async () =>
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
            await runWinterZone(
                'Badkamer',
                CONFIG.devices.badkamer,
                overrideState,
                async () =>
                    await controlWinterBathroom(
                        logic
                    )
            );

        await afterZone(
            bathroomResult
        );
    }


    /* ========================================================
     * ZOMER
     * ========================================================
     */

    else {

        log(
            'NORMALE ZOMERREGELING'
        );

        resetOverrides(
            overrideState,
            'zomerregeling actief'
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

        /*
         * De bestaande zomerwerking is bewust 24/7 zolang
         * Airzone modus op Zomer staat.
         */

        const zones = [

            {
                id:
                    CONFIG.devices.master,

                label:
                    'Master',

                target:
                    CONFIG.summer.master
            },

            {
                id:
                    CONFIG.devices.abel,

                label:
                    'Abel',

                target:
                    CONFIG.summer.abel
            },

            {
                id:
                    CONFIG.devices.hugo,

                label:
                    'Hugo',

                target:
                    CONFIG.summer.hugo
            },

            {
                id:
                    CONFIG.devices.badkamer,

                label:
                    'Badkamer',

                target:
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
                    async () =>
                        await activateSummerZone(
                            zone.id,
                            zone.label,
                            zone.target
                        )
                );

            await afterZone(result);
        }
    }


    /* ========================================================
     * PUSH EN TIMELINE
     * ========================================================
     */

    try {

        await saveOverrideState(
            overrideState
        );

    } catch (error) {

        log(
            `WAARSCHUWING | Override-state niet opgeslagen: ` +
            `${errorText(error)}`
        );
    }

    await preparePushMessage(
        logic
    );

    await publishTimelineEvents(
        logic
    );


    /* ========================================================
     * RESULTAAT
     * ========================================================
     */

    const runtimeMs =
        Date.now() -
        startedAt;

    const finishClock =
        getLocalClock();

    log(
        '=============================================='
    );

    log(
        `KLAAR | ${mode.toUpperCase()} | ` +
        `${vacation ? 'VAKANTIE' : 'NORMAAL'} | ` +
        `writes=${writesThisRun} | ` +
        `timeline=${timelineEvents.length} | ` +
        `overrides=${activeOverrides(overrideState).join(', ') || 'geen'} | ` +
        `runtime=${runtimeMs} ms`
    );

    log(
        '=============================================='
    );

    return {

        success:
            true,

        version:
            CONFIG.version,

        timezone:
            CONFIG.timezone,

        localDate:
            finishClock.dateKey,

        localTime:
            finishClock.displayTime,

        utcTime:
            new Date().toISOString(),

        mode,

        vacation,

        windows: {

            master:
                isMasterWinterWindowActive(),

            bedrooms:
                isBedroomWindowActive(),

            bathroom:
                isBathroomWindowActive(),

            push:
                isPushWindow()
        },

        writes:
            writesThisRun,

        overrides:
            activeOverrides(overrideState),

        timelineEvents:
            [...timelineEvents],

        runtimeMs
    };
}


/* ============================================================
 * 19. START
 * ============================================================
 */

try {

    return await main();

} catch (error) {

    console.error(
        `AIRZONE CONTROLLER MISLUKT | ` +
        `${errorText(error)}`
    );

    return {

        success:
            false,

        timezone:
            CONFIG.timezone,

        localTime:
            getLocalClock()
                .displayTime,

        utcTime:
            new Date()
                .toISOString(),

        error:
            errorText(error)
    };
}
