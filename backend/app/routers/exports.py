import re

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..estimation import compute_estimate
from ..exports.scope_doc import build_scope_data, render_docx, render_pdf
from ..exports.spec_yaml import build_spec
from ..models import User
from ..services import audit, get_config, require_project

router = APIRouter(prefix="/api/projects/{project_id}/export", tags=["exports"])


def _slug(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "-", name).strip("-") or "project"


def _results_for(db: Session, project):
    """Use the frozen results of the latest session; fall back to a live
    calculation with the current config when no session exists yet."""
    sessions = project.sessions
    if sessions:
        return sessions[-1].results, sessions
    config = get_config(db)
    return compute_estimate(project.params or {}, config, project.vaf_enabled, project.gsc), []


@router.get("/scope.pdf")
def scope_pdf(project_id: str, lang: str = Query("de", pattern="^(de|en)$"),
              db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = require_project(db, project_id, user, "viewer")
    results, sessions = _results_for(db, project)
    pdf = render_pdf(build_scope_data(project, sessions, results, lang))
    audit(db, user, "export.scope_pdf", project.id, {"lang": lang})
    return Response(pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="scope_{_slug(project.name)}.pdf"',
    })


@router.get("/scope.docx")
def scope_docx(project_id: str, lang: str = Query("de", pattern="^(de|en)$"),
               db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = require_project(db, project_id, user, "viewer")
    results, sessions = _results_for(db, project)
    docx = render_docx(build_scope_data(project, sessions, results, lang))
    audit(db, user, "export.scope_docx", project.id, {"lang": lang})
    return Response(
        docx,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="scope_{_slug(project.name)}.docx"'},
    )


@router.get("/spec.yaml")
def spec_yaml(project_id: str, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    project = require_project(db, project_id, user, "viewer")
    session = project.sessions[-1] if project.sessions else None
    spec = build_spec(project, session)
    audit(db, user, "export.spec_yaml", project.id, {})
    return Response(spec, media_type="application/yaml", headers={
        "Content-Disposition": f'attachment; filename="spec_{_slug(project.name)}.yaml"',
    })
