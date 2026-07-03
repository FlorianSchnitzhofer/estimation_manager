"""Specification as Code: YAML for an agentic development run with Claude Code.

The generated file is a complete working skeleton: every counted screen, use
case, business object, interface, batch and role becomes an entry with
placeholders that the project team (or the agent itself) refines iteratively.
"""
from datetime import date

import yaml

from ..estimation import normalize_params


def build_spec(project, session=None) -> str:
    params = normalize_params((session.params if session else project.params) or {})
    version = f"{session.version}.0" if session else "0.1"
    baseline = (session.created_at.date() if session else date.today()).isoformat()

    languages = ["de", "en", "fr", "it", "es", "pt", "nl", "pl"][: max(1, params["languages"])]
    role_names = [f"role_{i}" for i in range(1, max(1, params["roles"]) + 1)]
    if role_names:
        role_names[0] = "standard_user"

    spec = {
        "meta": {
            "project": project.name,
            "client": project.client or "TBD",
            "version": version,
            "baseline_date": baseline,
            "generated_by": "ReqPOOL Estimation Manager",
            "target_agent": "claude-code",
            "goal": project.goal or "TBD",
        },
        "screens": [
            {
                "id": f"SCR-{i:03d}",
                "name": f"Screen {i}",
                "purpose": "TBD: describe the business purpose of this screen",
                "status": "draft",
            }
            for i in range(1, params["screens"] + 1)
        ],
        "use_cases": [
            {
                "id": f"UC-{i:03d}",
                "name": f"Use case {i}",
                "actor": "TBD",
                "acceptance_criteria": [
                    {
                        "given": "TBD: initial context",
                        "when": "TBD: action performed by the actor",
                        "then": "TBD: observable result",
                    }
                ],
                "status": "draft",
            }
            for i in range(1, params["use_cases"] + 1)
        ],
        "business_objects": [
            {
                "id": f"BO-{i:03d}",
                "name": f"BusinessObject{i}",
                "attributes": [
                    {"name": "id", "type": "uuid", "required": True},
                    {"name": "TBD_attribute", "type": "string", "required": False},
                ],
                "status": "draft",
            }
            for i in range(1, params["business_objects"] + 1)
        ],
        "interfaces": [
            {
                "id": f"IF-{i:03d}",
                "name": f"Interface {i}",
                "direction": "TBD: inbound | outbound",
                "protocol": "TBD: REST | file | queue | ...",
                "external_system": "TBD",
                "status": "draft",
            }
            for i in range(1, params["interfaces"] + 1)
        ],
        "batches": [
            {
                "id": f"BAT-{i:03d}",
                "name": f"Scheduled process {i}",
                "schedule": "TBD: cron expression",
                "purpose": "TBD",
                "status": "draft",
            }
            for i in range(1, params["batches"] + 1)
        ],
        "roles": [
            {
                "name": name,
                "description": "TBD",
                "permissions": {
                    "screens": "TBD: list screen ids or 'all'",
                    "create": "TBD",
                    "read": "TBD",
                    "update": "TBD",
                    "delete": "TBD",
                },
            }
            for name in role_names
        ],
        "non_functional": {
            "languages": languages,
            "auth": {
                "provider": "Microsoft Entra ID",
                "flow": "OIDC authorization code with PKCE",
                "app_roles": ["Admin", "User"],
            },
            "hosting": {
                "cloud": "Microsoft Azure",
                "compute": "Azure Container Apps",
                "database": "Azure Database for PostgreSQL Flexible Server",
                "secrets": "Azure Key Vault",
                "region": "Germany West Central",
                "data_residency": "EU (GDPR)",
            },
        },
    }
    return yaml.safe_dump(spec, sort_keys=False, allow_unicode=True, width=100)
