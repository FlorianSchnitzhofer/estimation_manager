# ReqPOOL Estimation Manager

Webanwendung zur Aufwandsschätzung komplexer Softwareentwicklungsprojekte mit
minimalen Eingaben (7 Parameter), Dokumentation von Scope-Veränderungen über
die Projektlaufzeit und automatischer Generierung eines Scope-Dokuments sowie
einer Specification-as-Code für agentische Entwicklung.

## Kernfunktionen

- **Schätzung**: 7 Parameter (Masken, Anwendungsfälle, Geschäftsobjekte,
  Schnittstellen, zeitgesteuerte Abläufe, Sprachen, Rollen) mit
  Definitions-Tooltips → IFPUG-konforme Function Points (EI/EO/EQ/ILF/EIF,
  konfigurierbare Komplexitätsgewichtung, optionaler VAF mit 14 GSC-Fragen).
- **Drei Aufwandsvarianten** im Vergleich: klassisch (14 h/FP), agil (9 h/FP),
  agentisch (2 h/FP) — jeweils mit Best/Expected/Worst-Bandbreite.
- **Kosten-Drill-Down**: Kosten je Projektphase (Analyse, Konzeption,
  Umsetzung, Test, Rollout) bis auf Parameterebene; Betriebs- und
  Beratungsaufwand separat; optional KI-Token-Verbrauch (400k Tokens/FP,
  8 EUR/1M, konfigurierbar).
- **Scope Planning Sessions**: versionierte Snapshots inkl. eingefrorener
  Konfiguration (Reproduzierbarkeit), Baseline-Vergleich, FP-Burn-Up,
  Delta-Wasserfall.
- **Generierte Artefakte**: Scope-Dokument (Projektcharta, 10 Abschnitte) als
  PDF/DOCX; Specification as Code als YAML für Claude Code.
- **Kollaboration**: Entra ID (OIDC + PKCE), Rollen Owner/Editor/Viewer,
  Audit-Trail; Auto-Login für `florian@bingro.com` (Admin) via
  `AUTO_LOGIN_USER`-Bypass.
- **Admin-Bereich**: alle Produktivitäts- und Kostenparameter als Slider mit
  Live-Vorschau; Änderungen wirken nur auf neue Berechnungen.

## Architektur

| Komponente | Technologie |
|---|---|
| Frontend | React + TypeScript + Vite, Fluent UI v9 (Office-Look, Schwarz-Weiß), i18n DE/EN |
| API | FastAPI (Python), API-first — Schätzlogik als eigenständiger, DB-freier Service ([backend/app/estimation.py](backend/app/estimation.py)) |
| Datenbank | PostgreSQL (Azure Flexible Server), SQLite im lokalen Dev |
| Deployment | Azure Container Apps + Key Vault, Bicep ([infra/main.bicep](infra/main.bicep)), GitHub Actions |

## Lokal starten

**Ohne Docker (Entwicklung):**

```bash
# API (Port 8000) — nutzt SQLite + Auto-Login-Bypass
cd backend
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/uvicorn app.main:app --reload

# Frontend (Port 5173, proxied /api → 8000)
cd frontend
npm install
npm run dev
```

**Mit Docker Compose (Postgres + API + Web auf http://localhost:8080):**

```bash
docker compose up --build
```

**Tests:**

```bash
cd backend && .venv/Scripts/python -m pytest tests -q
```

## Konfiguration

Siehe [backend/.env.example](backend/.env.example). Wichtig:

- `AUTO_LOGIN_USER=florian@bingro.com` — Dev-/Demo-Bypass, meldet diesen
  Account ohne Login-Dialog als Admin an. Für Produktion leer setzen; dann
  greift ausschließlich Entra ID (Bearer-Token, App-Rollen `Admin`/`User`).
- `ENTRA_TENANT_ID` / `ENTRA_CLIENT_ID` — App Registration im ReqPOOL-Tenant.

## Azure-Deployment

GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))
baut beide Container, pusht nach GHCR und deployt per Bicep in

- Subscription `f677fc3d-7384-4018-b5c4-204292ecadf6`
- Resource Group `bg_estimation_manager` (Germany West Central)

Benötigte Repo-Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` (OIDC-Login des
Deploy-Service-Principals), `POSTGRES_ADMIN_PASSWORD`, `ENTRA_TENANT_ID`,
`ENTRA_CLIENT_ID`, `GHCR_PULL_TOKEN`.

## API-Überblick

| Endpunkt | Zweck |
|---|---|
| `GET /api/me` | Angemeldeter Benutzer |
| `GET /api/admin/meta` | Parameterdefinitionen, GSC-Katalog, Slider-Grenzen |
| `GET/PUT /api/admin/config` | Admin-Konfiguration (Raten, Phasen, Gewichte) |
| `POST /api/admin/preview` | Live-Vorschau mit Config-Override |
| `POST /api/projects` | Projekt anlegen |
| `POST /api/projects/{id}/estimate` | Live-Schätzung (persistiert nichts) |
| `POST /api/projects/{id}/sessions` | Scope-Session einfrieren |
| `GET /api/projects/{id}/sessions/compare` | Baseline-Vergleich |
| `PUT /api/projects/{id}/members` | Teilen (Owner/Editor/Viewer) |
| `GET /api/projects/{id}/export/scope.pdf\|scope.docx\|spec.yaml` | Artefakte |
| `GET /api/projects/{id}/audit` | Audit-Trail |
