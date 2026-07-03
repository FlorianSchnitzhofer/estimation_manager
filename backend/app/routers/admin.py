from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin
from ..database import get_db
from ..defaults import (DEFAULT_CONFIG, GSC_QUESTIONS, IFPUG_WEIGHTS,
                        PARAMETERS, PHASES, SLIDER_BOUNDS, VARIANTS)
from ..estimation import compute_estimate
from ..models import AuditLog, User
from ..schemas import AuditOut, EstimateIn
from ..services import audit, get_config, save_config

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/meta")
def meta(user: User = Depends(get_current_user)):
    """Static metadata: parameter definitions (tooltips), GSC catalog, phases,
    variants, IFPUG weight tables and slider bounds. Available to all users."""
    return {
        "parameters": PARAMETERS,
        "gsc_questions": GSC_QUESTIONS,
        "phases": PHASES,
        "variants": VARIANTS,
        "ifpug_weights": IFPUG_WEIGHTS,
        "slider_bounds": SLIDER_BOUNDS,
        "defaults": DEFAULT_CONFIG,
    }


@router.get("/config")
def read_config(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Current config — readable by all users (needed for transparency of results)."""
    return get_config(db)


@router.put("/config")
def write_config(value: dict, db: Session = Depends(get_db),
                 user: User = Depends(require_admin)):
    old = get_config(db)
    merged = save_config(db, value)
    changed = {k: {"from": old.get(k), "to": merged.get(k)}
               for k in merged if merged.get(k) != old.get(k)}
    if changed:
        audit(db, user, "config.updated", None, changed)
    return merged


@router.post("/config/reset")
def reset_config(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    merged = save_config(db, DEFAULT_CONFIG)
    audit(db, user, "config.reset", None, {})
    return merged


@router.post("/preview")
def preview(body: EstimateIn, db: Session = Depends(get_db),
            user: User = Depends(require_admin)):
    """Live preview for the admin sliders: estimate a sample project with a
    config override without persisting anything."""
    config = get_config(db)
    if body.config_override:
        from ..services import _deep_update
        _deep_update(config, body.config_override)
    return compute_estimate(body.params.model_dump(), config, body.vaf_enabled, body.gsc)


@router.get("/audit", response_model=list[AuditOut])
def global_audit(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    return db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(500).all()
