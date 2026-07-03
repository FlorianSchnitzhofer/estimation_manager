"""Default configuration: estimation parameters, IFPUG mapping, GSC catalog,
productivity/cost defaults and their admin slider bounds.

All values are seeded into the database on first start and are afterwards
maintained by admins. Scope sessions freeze the config valid at snapshot time.
"""

# ---------------------------------------------------------------------------
# The seven ReqPOOL estimation parameters.
# "counted_from_second" implements the ReqPOOL counting rule that the first
# language / role is part of the base system and only additional ones add
# functional size.
# ---------------------------------------------------------------------------
PARAMETERS = [
    {
        "key": "screens",
        "ifpug_type": "EI",
        "counted_from_second": False,
        "label": {"de": "Masken", "en": "Screens"},
        "definition": {
            "de": "Anzahl fachlich unterscheidbarer Bildschirmmasken (Formulare, Listen, "
                  "Detailansichten, Dialoge). Gezählt wird je fachlichem Zweck, nicht je "
                  "Layout-Variante; responsive Varianten derselben Maske zählen einmal.",
            "en": "Number of functionally distinct screens (forms, lists, detail views, "
                  "dialogs). Count per business purpose, not per layout variant; responsive "
                  "variants of the same screen count once.",
        },
    },
    {
        "key": "use_cases",
        "ifpug_type": "EO",
        "counted_from_second": False,
        "label": {"de": "Anwendungsfälle", "en": "Use cases"},
        "definition": {
            "de": "Anzahl der Anwendungsfälle im Sinne abgeschlossener fachlicher Abläufe "
                  "mit erkennbarem Ergebnis für einen Akteur (z. B. 'Angebot freigeben'). "
                  "CRUD-Standardoperationen eines Geschäftsobjekts zählen als ein Anwendungsfall.",
            "en": "Number of use cases: complete business flows with an observable result "
                  "for an actor (e.g. 'approve offer'). Standard CRUD operations of one "
                  "business object count as a single use case.",
        },
    },
    {
        "key": "business_objects",
        "ifpug_type": "ILF",
        "counted_from_second": False,
        "label": {"de": "Geschäftsobjekte", "en": "Business objects"},
        "definition": {
            "de": "Anzahl der fachlichen Entitäten, die vom System dauerhaft verwaltet werden "
                  "(z. B. Kunde, Auftrag, Rechnung). Reine Zuordnungs-/Historientabellen zählen "
                  "nicht separat, sondern gehören zum führenden Objekt.",
            "en": "Number of business entities the system persistently maintains (e.g. "
                  "customer, order, invoice). Pure link/history tables are counted with "
                  "their leading object, not separately.",
        },
    },
    {
        "key": "interfaces",
        "ifpug_type": "EIF",
        "counted_from_second": False,
        "label": {"de": "Schnittstellen", "en": "Interfaces"},
        "definition": {
            "de": "Anzahl der Schnittstellen zu externen Systemen (eingehend oder ausgehend, "
                  "synchron oder asynchron). Jede fachlich eigenständige Integration zählt "
                  "einmal, unabhängig von der Anzahl technischer Endpunkte.",
            "en": "Number of interfaces to external systems (inbound or outbound, sync or "
                  "async). Each functionally distinct integration counts once, regardless "
                  "of the number of technical endpoints.",
        },
    },
    {
        "key": "batches",
        "ifpug_type": "EO",
        "counted_from_second": False,
        "label": {"de": "Zeitgesteuerte Abläufe", "en": "Scheduled processes"},
        "definition": {
            "de": "Anzahl zeitgesteuerter Abläufe (Batches, Jobs, Reports), die ohne "
                  "Benutzerinteraktion regelmäßig ausgeführt werden (z. B. nächtlicher "
                  "Import, Monatsabrechnung, Erinnerungs-Mails).",
            "en": "Number of scheduled processes (batches, jobs, reports) that run "
                  "periodically without user interaction (e.g. nightly import, monthly "
                  "billing, reminder mails).",
        },
    },
    {
        "key": "languages",
        "ifpug_type": "EQ",
        "counted_from_second": True,
        "label": {"de": "Sprachen", "en": "Languages"},
        "definition": {
            "de": "Anzahl der Oberflächensprachen. Die erste Sprache ist Teil des "
                  "Basissystems; jede weitere Sprache erhöht den funktionalen Umfang "
                  "(Übersetzungsverwaltung, sprachabhängige Ausgaben).",
            "en": "Number of UI languages. The first language is part of the base system; "
                  "each additional language adds functional size (translation management, "
                  "language-dependent output).",
        },
    },
    {
        "key": "roles",
        "ifpug_type": "EQ",
        "counted_from_second": True,
        "label": {"de": "Rollen", "en": "Roles"},
        "definition": {
            "de": "Anzahl der Benutzerrollen mit unterschiedlichen Rechten oder Sichten. "
                  "Die erste Rolle ist Teil des Basissystems; jede weitere Rolle erhöht "
                  "den Umfang (Rechteprüfung, rollenspezifische Sichten).",
            "en": "Number of user roles with distinct permissions or views. The first role "
                  "is part of the base system; each additional role adds size (permission "
                  "checks, role-specific views).",
        },
    },
]

# IFPUG complexity weight tables (low / average / high) per function type.
IFPUG_WEIGHTS = {
    "EI": {"low": 3, "average": 4, "high": 6},
    "EO": {"low": 4, "average": 5, "high": 7},
    "EQ": {"low": 3, "average": 4, "high": 6},
    "ILF": {"low": 7, "average": 10, "high": 15},
    "EIF": {"low": 5, "average": 7, "high": 10},
}

# The 14 IFPUG General System Characteristics for the optional VAF.
GSC_QUESTIONS = [
    {"key": "data_communications", "de": "Datenkommunikation", "en": "Data communications"},
    {"key": "distributed_processing", "de": "Verteilte Verarbeitung", "en": "Distributed data processing"},
    {"key": "performance", "de": "Performance-Anforderungen", "en": "Performance"},
    {"key": "heavily_used_configuration", "de": "Auslastung der Zielumgebung", "en": "Heavily used configuration"},
    {"key": "transaction_rate", "de": "Transaktionsrate", "en": "Transaction rate"},
    {"key": "online_data_entry", "de": "Online-Datenerfassung", "en": "On-line data entry"},
    {"key": "end_user_efficiency", "de": "Benutzerfreundlichkeit", "en": "End-user efficiency"},
    {"key": "online_update", "de": "Online-Aktualisierung", "en": "On-line update"},
    {"key": "complex_processing", "de": "Komplexe Verarbeitung", "en": "Complex processing"},
    {"key": "reusability", "de": "Wiederverwendbarkeit", "en": "Reusability"},
    {"key": "installation_ease", "de": "Einfache Installation", "en": "Installation ease"},
    {"key": "operational_ease", "de": "Einfacher Betrieb", "en": "Operational ease"},
    {"key": "multiple_sites", "de": "Mehrere Standorte", "en": "Multiple sites"},
    {"key": "facilitate_change", "de": "Änderbarkeit", "en": "Facilitate change"},
]

PHASES = [
    {"key": "analysis", "de": "Analyse", "en": "Analysis"},
    {"key": "design", "de": "Konzeption", "en": "Design"},
    {"key": "implementation", "de": "Umsetzung", "en": "Implementation"},
    {"key": "test", "de": "Test", "en": "Test"},
    {"key": "rollout", "de": "Rollout", "en": "Rollout"},
]

VARIANTS = [
    {"key": "classic", "de": "Klassisch (industriell)", "en": "Classic (industrial)"},
    {"key": "agile", "de": "Agil", "en": "Agile"},
    {"key": "agentic", "de": "Agentisch (KI-entwickelt)", "en": "Agentic (AI-developed)"},
]

# ---------------------------------------------------------------------------
# Admin-configurable values with defaults and slider bounds.
# ---------------------------------------------------------------------------
DEFAULT_CONFIG = {
    "productivity": {"classic": 14.0, "agile": 9.0, "agentic": 2.0},   # h per FP
    "blended_rate": 120.0,                                             # EUR per h
    "phase_distribution": {                                            # percent, sums to 100
        "analysis": 15, "design": 15, "implementation": 40, "test": 20, "rollout": 10,
    },
    "operations_pct": 15.0,          # % p.a. of implementation cost
    "consulting_pct": 10.0,          # % of implementation cost
    "tokens_per_fp": 400_000,
    "token_price_per_million": 8.0,  # EUR per 1M tokens (blended in/out)
    "uncertainty": {"best": 0.85, "worst": 1.35},  # factors on expected effort
    # Complexity level per parameter (low / average / high), admin-adjustable.
    "complexity": {p["key"]: "average" for p in PARAMETERS},
}

SLIDER_BOUNDS = {
    "productivity.classic": {"min": 8, "max": 24, "step": 0.5},
    "productivity.agile": {"min": 5, "max": 16, "step": 0.5},
    "productivity.agentic": {"min": 0.5, "max": 6, "step": 0.1},
    "blended_rate": {"min": 80, "max": 220, "step": 5},
    "phase_distribution.analysis": {"min": 0, "max": 100, "step": 1},
    "phase_distribution.design": {"min": 0, "max": 100, "step": 1},
    "phase_distribution.implementation": {"min": 0, "max": 100, "step": 1},
    "phase_distribution.test": {"min": 0, "max": 100, "step": 1},
    "phase_distribution.rollout": {"min": 0, "max": 100, "step": 1},
    "operations_pct": {"min": 5, "max": 30, "step": 1},
    "consulting_pct": {"min": 0, "max": 25, "step": 1},
    "tokens_per_fp": {"min": 100_000, "max": 2_000_000, "step": 50_000},
    "token_price_per_million": {"min": 1, "max": 30, "step": 0.5},
}
