"""Config store, audit trail and project access checks."""
import copy

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .defaults import DEFAULT_CONFIG
from .models import AppConfig, AuditLog, Project, ProjectMember, User

CONFIG_KEY = "estimation"

ROLE_RANK = {"viewer": 1, "editor": 2, "owner": 3}


def get_config(db: Session) -> dict:
    row = db.get(AppConfig, CONFIG_KEY)
    if row is None:
        row = AppConfig(key=CONFIG_KEY, value=copy.deepcopy(DEFAULT_CONFIG))
        db.add(row)
        db.commit()
    # Merge over defaults so newly added keys get their default value.
    merged = copy.deepcopy(DEFAULT_CONFIG)
    _deep_update(merged, row.value or {})
    return merged


def save_config(db: Session, value: dict) -> dict:
    merged = copy.deepcopy(DEFAULT_CONFIG)
    _deep_update(merged, value or {})
    phases = merged["phase_distribution"]
    total = sum(float(v) for v in phases.values())
    if abs(total - 100.0) > 0.01:
        raise HTTPException(status_code=422, detail=f"Phase distribution must sum to 100% (got {total}%)")
    row = db.get(AppConfig, CONFIG_KEY)
    if row is None:
        row = AppConfig(key=CONFIG_KEY, value=merged)
        db.add(row)
    else:
        row.value = merged
    db.commit()
    return merged


def _deep_update(base: dict, patch: dict) -> None:
    for k, v in patch.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _deep_update(base[k], v)
        else:
            base[k] = v


def audit(db: Session, user: User, action: str, project_id: str | None = None,
          details: dict | None = None) -> None:
    db.add(AuditLog(
        project_id=project_id,
        user_id=user.id,
        user_email=user.email,
        action=action,
        details=details or {},
    ))
    db.commit()


def get_project_role(db: Session, project: Project, user: User) -> str | None:
    member = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project.id, ProjectMember.user_id == user.id)
        .first()
    )
    return member.role if member else None


def require_project(db: Session, project_id: str, user: User, min_role: str = "viewer") -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    role = get_project_role(db, project, user)
    if role is None and user.is_admin:
        role = "owner"  # platform admins have full access
    if role is None or ROLE_RANK[role] < ROLE_RANK[min_role]:
        raise HTTPException(status_code=403, detail="Insufficient project permissions")
    return project
