# Homey Automation

Version-controlled production automation for Homey Pro.

## Production controllers

| Controller | Version | Status |
|---|---:|---|
| Sensibo Climate Controller | 14.3.0 | Production |
| Airzone Controller | 2.3.0 | Production |
| Eurom Werkkamers Controller | 1.3.1 | Production |
| Central Lighting Controller | 11.3.0 | Production |

## Repository structure

- `scripts/climate/` - Climate automation
- `scripts/lighting/` - Lighting automation
- `docs/` - Documentation
- `types/` - HomeyScript type definitions (VS Code IntelliSense only)
- `tools/` - Development tools

## Werken in VS Code

1. Open de repo-map in VS Code en installeer de aanbevolen extensies als VS Code daarom vraagt.
2. Autocomplete werkt voor `Homey.devices`, `Homey.logic`, `Homey.flow`, `args`, `wait`, `tag` enzovoort (zie `types/homeyscript.d.ts`).
3. Druk op **Ctrl+Shift+B** voor een syntaxcontrole van alle scripts, precies zoals HomeyScript ze uitvoert
   (top-level `await` en `return` zijn toegestaan). Of via de terminal: `node tools/check-scripts.js`.
4. Kopieer een script daarna naar HomeyScript op de Homey.

De ingebouwde JavaScript-validatie van VS Code staat uit, omdat die top-level `await`/`return` ten onrechte als fout markeert.

## Versioning

Individual controllers use Semantic Versioning (`MAJOR.MINOR.PATCH`).

The `main` branch represents the approved production version.

## Security

API keys, passwords, tokens and other secrets must never be committed to this repository.

The Sensibo API key is stored as a Homey Logic variable and retrieved at runtime.
