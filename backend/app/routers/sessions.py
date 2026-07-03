from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..estimation import compare_sessions, compute_estimate
from ..models import ScopeSession, User
from ..schemas import SessionIn, SessionOut
from ..services import audit, get_config, require_project

router = APIRouter(prefix="/api/projects/{project_id}/sessions", tags=["sessions"])


@router.get("", response_model=list[SessionOut])
def list_sessions(project_id: str, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    project = require_project(db, project_id, user, "viewer")
    return project.sessions


@router.post("", response_model=SessionOut, status_code=201)
def create_session(project_id: str, body: SessionIn, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    """Freeze the project's current parameters, the active admin config and the
    computed results as a new versioned scope snapshot."""
    project = require_project(db, project_id, user, "editor")
    config = get_config(db)
    params = project.params or {}
    results = compute_estimate(params, config, project.vaf_enabled, project.gsc)
    version = (project.sessions[-1].version + 1) if project.sessions else 1
    session = ScopeSession(
        project_id=project.id,
        version=version,
        name=body.name or f"Session {version}",
        note=body.note,
        params=params,
        vaf_enabled=project.vaf_enabled,
        gsc=project.gsc or {},
        config_snapshot=config,
        results=results,
        is_baseline=(version == 1),
        created_by=user.id,
    )
    db.add(session)
    db.commit()
    audit(db, user, "session.created", project.id,
          {"version": version, "name": session.name, "params": params,
           "fp": results["function_points"]["adjusted"]})
    return session


@router.delete("/{session_id}", status_code=204)
def delete_session(project_id: str, session_id: str, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    project = require_project(db, project_id, user, "owner")
    session = db.get(ScopeSession, session_id)
    if session is None or session.project_id != project.id:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    audit(db, user, "session.deleted", project.id,
          {"version": session.version, "name": session.name})


@router.get("/compare")
def compare(project_id: str, from_version: int | None = None, to_version: int | None = None,
            db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Delta between two sessions; defaults to baseline vs. latest."""
    project = require_project(db, project_id, user, "viewer")
    sessions = project.sessions
    if len(sessions) < 2:
        raise HTTPException(status_code=422, detail="At least two sessions are required")
    by_version = {s.version: s for s in sessions}
    a = by_version.get(from_version or sessions[0].version)
    b = by_version.get(to_version or sessions[-1].version)
    if a is None or b is None:
        raise HTTPException(status_code=404, detail="Session version not found")
    return compare_sessions(
        {"version": a.version, "params": a.params, "results": a.results},
        {"version": b.version, "params": b.params, "results": b.results},
    )
