# Changelog

All notable changes to the Homey production automation are documented here.

## Central Lighting Controller - 11.4.0 - 2026-11-26

### Added

- Thuiskomst via het Nuki-slot: nieuw scriptargument `arrival`. Wordt de
  voordeur ontgrendeld terwijl Homey nog denkt dat niemand thuis is, dan gaat
  de verlichting direct naar de normale stand in plaats van te wachten op
  Smart Presence (wifi), die vaak 30 s tot enkele minuten later reageert.
- De aangenomen aanwezigheid geldt maximaal 10 minuten of tot Homey-aanwezigheid
  het bevestigt; zonder bevestiging gaat de volgende run terug naar afwezig.
- Bij Vakantie of als er al iemand thuis is doet `arrival` niets extra's.
- Timeline-item "🔑 Thuiskomst (slot)".

### Requires

- Flow: Nuki Smart Lock ontgrendeld → HomeyScript centrale verlichting met
  argument `arrival`, plus na 11 minuten nog een gewone run (`evaluate`).

## Airzone Controller - 2.4.0 - 2026-11-26

### Added

- Override ook 's avonds en 's nachts, tijdens het programma van een zone.
  Verander je het doel van een zone die aan staat met minstens 0,5 °C, of zet
  je een zone aan die het script uit liet, dan blijft het script van die zone
  af. Zo kun je 's nachts warmer zetten zonder dat het script de zone bij
  17,2 °C uitzet of het doel terugzet naar 17 °C.

### Changed

- Een override loopt nu tot het eerstvolgende schakelmoment van de zone:
  Master 18:00/06:00, Abel en Hugo 18:00/07:30, Badkamer 18:00/21:30/06:00/07:30.
  Overdag gedraagt het zich dus als in 2.3 (tot 18:00, badkamer 's nachts tot
  06:00).
- Timeline-melding noemt het nieuwe doel en de eindtijd, bijvoorbeeld
  "Abel handmatig op 19.0 °C gezet (was 17.0 °C); override tot 07:30".
- Lopende overrides uit 2.3 worden automatisch overgenomen.

## Eurom Werkkamers Controller - 1.3.1 - 2026-11-25

### Fixed

- Convectoren gingen na uitzetten steeds vanzelf weer aan: na handmatig uit,
  na de failsafe om 17:00/21:00 en na het einde van de ochtendverwarming (05:50).
  Oorzaak: het script zette direct na het uitzetten het oude setpoint terug, en
  een setpoint-wijziging zet de Eurom weer aan. De volgende run zag een
  convector die aan stond en startte een nieuwe sessie (ook het
  infraroodpaneel ging dan weer aan).
- Het script schrijft nooit meer een setpoint naar een convector die uit staat.
- Zet het script de convector zelf uit (failsafe, einde ochtend), dan eerst het
  oude setpoint terug terwijl hij nog aan staat, daarna pas uit.
- Zet je hem zelf uit, dan wordt het oude setpoint onthouden en bij de
  volgende start als "oud setpoint" gebruikt; de convector blijft onaangeroerd.

## Eurom Werkkamers Controller - 1.3.0 - 2026-11-25

### Added

- Infrarood-booster werkkamer beneden: het Eurom Mon Soleil DSP 770-paneel
  (770 W) helpt bij het opwarmen naast de convector van 1500 W, alleen zolang
  de convector aan staat. Aan bij ≥ 1,5 °C tekort, uit bij ≤ 0,5 °C.
- Het script zet het paneel alleen uit als het script het aanzette; zelf
  uitzetten tijdens een booster blijft gerespecteerd tot de convector uit gaat.
- Failsafe 17:00/21:00, convector uit en sensoruitval zetten de booster uit.

## Eurom Werkkamers Controller - 1.2.0 - 2026-11-25

### Added

- Ochtendverwarming werkkamer boven (sporten): om 04:00 lokale tijd eenmalig
  controleren; kamer < 12 °C en convector uit → convector aan met doel 19 °C.
  Om 05:50 weer uit, alleen als het script hem aanzette. Zelf uitzetten stopt
  de ochtendverwarming. Venster van 15 minuten voor gemiste runs.

## Eurom Werkkamers Controller - 1.1.0 - 2026-11-25

### Added

- Failsafe om 17:00 en 21:00 lokale tijd (Europe/Amsterdam; zomer- en
  wintertijd automatisch): beide convectoren uit als ze aan staan, oude
  setpoint terug, één timeline-melding per kamer.
- Elk moment één keer per dag binnen een venster van 15 minuten (vangt een
  gemiste run op). Na de failsafe weer handmatig aanzetten blijft gerespecteerd
  tot het volgende moment. Mislukt het uitzetten, dan volgende minuut opnieuw.

## Eurom Werkkamers Controller - 1.0.0 - 2026-11-25

### Added

- Slimme regeling voor de Eurom-convectoren in de werkkamer boven en beneden,
  op basis van de Sonoff SNZB-02P-sensoren in die kamers.
- Handmatig starten: alleen actief zolang de convector aan staat. Uitzetten
  stopt de regeling en zet het oorspronkelijke setpoint terug.
- Tijdsproportionele PI-regeling (cyclus 10 min) via het setpoint van de
  interne thermostaat (warmen = comfort + 4 °C, pauze = 5 °C). Het script
  schakelt de convector nooit zelf aan of uit.
- Fallback op de eigen thermostaat (comfortsetpoint) bij een sensor zonder
  update > 45 min.
- Comfort per kamer 20,5 °C, optioneel via getal-variabele
  "Werkkamer boven doel" / "Werkkamer beneden doel".
- State in HomeyScript global storage; geen extra variabelen nodig.

## Sensibo Climate Controller - 14.3.0 - 2026-11-24

### Fixed

- Verwarmingsfan uit 14.2 schakelde te vroeg terug (quiet al bij 20,55 °C) en
  wachtte daarna 10 min voor hij weer omhoog mocht. Bij vorst (24 nov 05:30–10:00,
  buiten −1 tot −2 °C) schommelde de kamer daardoor in golven van ±35 min tussen
  19,8 en 20,55 °C (gem. 20,23 °C; 24 % van de tijd onder 20,0 °C).
- Nieuwe grenzen (dag, comfort 20,7): medium ≤ 20,5 (terug > 20,6), low ≤ 20,6
  (quiet pas > 20,8). Omhoog direct, omlaag pas na 15 min.
- Bij buiten < 0 °C geen quiet zolang de kamer onder comfort + 0,3 °C is.

Modulatie, minimale uit-tijd, afwezigheidsvertraging en rustige timeline uit 14.2
blijven ongewijzigd.

## Sensibo Climate Controller - 14.2.0 - 2026-11-23

### Changed (alleen verwarmen)

- Modulerend verwarmen: waar v14.1 overdag op 21,0 °C uitschakelde, zakt het
  setpoint nu stapsgewijs (22 → 21 → 20, minimaal 15 min per stap omlaag).
  Uitschakelen pas boven 21,5 °C (`day.heatStop` 21,0 → 21,5).
  's Nachts (setpoint 18 = comfort) verandert er niets.
- Minimale uit-tijd van 20 minuten na het bereiken van het verwarmingsdoel,
  tenzij de kamer onder heatStart − 0,5 °C komt.
- Verwarmingsfan: grenzen medium ≥ 0,4 °C / low ≥ 0,15 °C tekort (was 0,2 / 0,1),
  hysterese 0,1 °C en minimaal 10 minuten tussen wisselingen
  (direct omhoog bij ≥ 0,5 °C tekort).
- Afwezigheidsvertraging: pas na 20 minuten niemand thuis naar AWAY.
- Timeline alleen bij aan/uit- en moduswissels; setpoint- en fanbijsturing
  staan alleen in het log (`timelineQuietAdjustments`).

### Aanleiding

Timeline 21–23 nov: overdag uit op 21,1 °C en na 17–51 min weer aan;
69 fanwissels in twee dagen (19 binnen 10 min); airco 5 min uit bij kort weg.

## Central Lighting Controller - 11.3.0 - 2026-11-23

### Fixed

- Killswitch (oppasmodus) werkte niet als niemand thuis was. Het script ging
  dan altijd naar de afwezigheidsregeling, die bij een actieve Killswitch
  alleen "geblokkeerd" logde en niets deed. De verlichting bleef daardoor in
  de afwezigheidsstand (gedimde keuken, hal nacht) of uit. Nu draait met de
  Killswitch aan de normale binnenregeling, alsof er iemand thuis is.
- Logtijden staan nu in Nederlandse tijd in plaats van UTC (alleen weergave;
  de regeling zelf gebruikt geen kloktijd).

## Airzone Controller - 2.3.0 - 2026-11-23

### Added

- Handmatige override in de winterregeling voor Master, Abel, Hugo en Badkamer.
  Zet je een zone buiten zijn programma zelf aan (thermostaat of Airzone-app),
  dan laat het script die zone met rust.
- Override eindigt automatisch zodra het programma van de zone start
  (Master/Abel/Hugo 18:00; Badkamer 06:00 of 18:00), als de zone handmatig
  wordt uitgezet, na maximaal 24 uur, of bij vakantie/zomer.
- Timeline-meldingen bij start en einde van een override.

### Requires

- Homey Logic tekstvariabele `Airzone override state` (mag leeg zijn).
  Ontbreekt die, dan werkt het script als v2.2 zonder override.

## Production Baseline - 2026-11-23

### Sensibo Climate Controller - 14.1.0

- Initial production baseline
- Sensibo API key externalized to Homey Logic
- Predictive climate control
- Comfort Boost
- Presence-aware control
- Vacation protection
- Sliding-door protection
- Cold protection

### Airzone Controller - 2.2.0

- Initial production baseline

### Central Lighting Controller - 11.2.0

- Initial production baseline
