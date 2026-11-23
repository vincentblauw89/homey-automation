# Homey Automation

Version-controlled production automation for Homey Pro.

## Production controllers

| Controller | Version | Status |
|---|---:|---|
| Sensibo Climate Controller | 14.1.0 | Production |
| Airzone Controller | 2.2.0 | Production |
| Central Lighting Controller | 11.2.0 | Production |

## Repository structure

- `scripts/climate/` - Climate automation
- `scripts/lighting/` - Lighting automation
- `docs/` - Documentation

## Versioning

Individual controllers use Semantic Versioning (`MAJOR.MINOR.PATCH`).

The `main` branch represents the approved production version.

## Security

API keys, passwords, tokens and other secrets must never be committed to this repository.

The Sensibo API key is stored as a Homey Logic variable and retrieved at runtime.
