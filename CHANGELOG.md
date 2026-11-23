# Changelog

All notable changes to the Homey production automation are documented here.

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
