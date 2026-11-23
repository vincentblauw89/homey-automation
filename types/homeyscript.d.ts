/*
 * Typedefinities voor HomeyScript (Homey Pro, Web API v3).
 *
 * Alleen voor IntelliSense in VS Code: autocomplete en uitleg bij het hoveren
 * over de globale objecten die HomeyScript beschikbaar stelt. Dit bestand
 * wordt nooit naar Homey gekopieerd.
 *
 * Bewust beknopt: alleen wat de scripts in deze repo gebruiken, aangevuld met
 * veelgebruikte methodes. Onbekende properties blijven toegestaan via
 * index-signatures, zodat er geen valse fouten ontstaan.
 */

declare namespace HomeyScript {
  interface CapabilityState {
    id: string;
    value: any;
    lastUpdated?: string | number;
    title?: string;
    units?: string;
    min?: number;
    max?: number;
    step?: number;
    getable?: boolean;
    setable?: boolean;
    [key: string]: any;
  }

  interface Device {
    id: string;
    name: string;
    zone: string;
    driverId?: string;
    class: string;
    available: boolean;
    capabilities: string[];
    capabilitiesObj: Record<string, CapabilityState>;
    settings?: Record<string, any>;
    setCapabilityValue(capabilityId: string, value: any): Promise<void>;
    [key: string]: any;
  }

  interface LogicVariable {
    id: string;
    name: string;
    type: "boolean" | "number" | "string";
    value: boolean | number | string;
  }

  interface FlowCardAction {
    id: string;
    uri: string;
    title?: string;
    args?: any[];
    [key: string]: any;
  }

  interface User {
    id: string;
    name: string;
    present?: boolean;
    asleep?: boolean;
    [key: string]: any;
  }

  interface Zone {
    id: string;
    name: string;
    parent: string | null;
    active?: boolean;
    [key: string]: any;
  }

  interface DevicesManager {
    getDevices(): Promise<Record<string, Device>>;
    getDevice(opts: { id: string }): Promise<Device>;
    setCapabilityValue(opts: { deviceId: string; capabilityId: string; value: any; opts?: Record<string, any> }): Promise<void>;
    [key: string]: any;
  }

  interface LogicManager {
    getVariables(): Promise<Record<string, LogicVariable>>;
    getVariable(opts: { id: string }): Promise<LogicVariable>;
    updateVariable(opts: { id: string; variable: { value: boolean | number | string } }): Promise<LogicVariable>;
    createVariable(opts: { variable: { name: string; type: LogicVariable["type"]; value: boolean | number | string } }): Promise<LogicVariable>;
    [key: string]: any;
  }

  interface FlowManager {
    getFlowCardActions(): Promise<Record<string, FlowCardAction>>;
    runFlowCardAction(opts: { uri: string; id: string; args?: Record<string, any>; droptoken?: string }): Promise<any>;
    getFlows(): Promise<Record<string, any>>;
    triggerFlow(opts: { id: string }): Promise<void>;
    [key: string]: any;
  }

  interface UsersManager {
    getUsers(): Promise<Record<string, User>>;
    [key: string]: any;
  }

  interface ZonesManager {
    getZones(): Promise<Record<string, Zone>>;
    [key: string]: any;
  }

  interface NotificationsManager {
    createNotification(opts: { excerpt: string }): Promise<void>;
    [key: string]: any;
  }

  interface HomeyAPI {
    devices: DevicesManager;
    logic: LogicManager;
    flow: FlowManager;
    users: UsersManager;
    zones: ZonesManager;
    notifications: NotificationsManager;
    insights: any;
    apps: any;
    geolocation: any;
    system: any;
    [manager: string]: any;
  }

  interface GlobalStore {
    /** Lees een waarde die tussen runs van alle scripts bewaard blijft. */
    get(key: string): any;
    /** Bewaar een waarde tussen runs (gedeeld door alle scripts). */
    set(key: string, value: any): void;
    /** Alle sleutels in de globale opslag. */
    keys(): string[];
  }
}

/** Homey Web API: devices, logic, flow, users, zones, ... */
declare const Homey: HomeyScript.HomeyAPI;

/** Argumenten die vanuit een Flow-kaart aan het script zijn meegegeven. */
declare const args: any[];

/** Persistente opslag, gedeeld tussen scripts en runs. */
declare const global: HomeyScript.GlobalStore;

/** Wacht het opgegeven aantal milliseconden. */
declare function wait(milliseconds: number): Promise<void>;

/** Laat Homey een tekst uitspreken. */
declare function say(text: string): Promise<void>;

/**
 * Maak of werk een tag bij die in Flows bruikbaar is.
 * Geef `null` als waarde om de tag te verwijderen.
 */
declare function tag(id: string, value: string | number | boolean | null): Promise<void>;

/** Lodash. */
declare const _: any;

/** Naam van het huidige script. */
declare const __filename__: string;
/** ID van het huidige script. */
declare const __script_id__: string;
/** Tijdstip van de vorige uitvoering. */
declare const __last_executed__: Date;
/** Milliseconden sinds de vorige uitvoering. */
declare const __ms_since_last_executed__: number;
