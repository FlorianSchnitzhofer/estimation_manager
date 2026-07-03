from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..estimation import compute_estimate
from ..models import AuditLog, Project, ProjectMember, User
from ..schemas import (AuditOut, EstimateIn, MemberIn, MemberOut, ProjectIn,
                       ProjectOut, ProjectUpdate)
from ..services import audit, get_config, get_project_role, require_project

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _to_out(db: Session, project: Project, user: User) -> ProjectOut:
    out = ProjectOut.model_validate(project)
    role = get_project_role(db, project, user)
    out.my_role = role or ("owner" if user.is_admin else None)
    out.session_count = len(project.sessions)
    return out


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.is_admin:
        projects = db.query(Project).order_by(Project.updated_at.desc()).all()
    else:
        projects = (
            db.query(Project)
            .join(ProjectMember)
            .filter(ProjectMember.user_id == user.id)
            .order_by(Project.updated_at.desc())
            .all()
        )
    return [_to_out(db, p, user) for p in projects]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectIn, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    project = Project(**body.model_dump(), created_by=user.id, params={})
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.id, user_id=user.id, role="owner"))
    db.commit()
    audit(db, user, "project.created", project.id, {"name": project.name})
    return _to_out(db, project, user)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    project = require_project(db, project_id, user, "viewer")
    return _to_out(db, project, user)


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, body: ProjectUpdate, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    project = require_project(db, project_id, user, "editor")
    changes = {}
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "params" and value is not None:
            old = project.params or {}
            if old != value:
                changes["params"] = {"from": old, "to": value}
            project.params = value
        elif value is not None:
            if getattr(project, field) != value:
                changes[field] = {"from": getattr(project, field), "to": value}
            setattr(project, field, value)
    db.commit()
    if changes:
        audit(db, user, "project.updated", project.id, changes)
    return _to_out(db, project, user)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    project = require_project(db, project_id, user, "owner")
    name = project.name
    db.query(AuditLog).filter(AuditLog.project_id == project.id).delete()
    db.delete(project)
    db.commit()
    audit(db, user, "project.deleted", None, {"name": name})


@router.post("/{project_id}/estimate")
def estimate(project_id: str, body: EstimateIn, db: Session = Depends(get_db),
             user: User = Depends(get_current_user)):
    """Live calculation — does not persist anything."""
    require_project(db, project_id, user, "viewer")
    config = get_config(db)
    if body.config_override:
        from ..services import _deep_update
        _deep_update(config, body.config_override)
    return compute_estimate(body.params.model_dump(), config, body.vaf_enabled, body.gsc)


# --- members -----------------------------------------------------------------

@router.get("/{project_id}/members", response_model=list[MemberOut])
def list_members(project_id: str, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    project = require_project(db, project_id, user, "viewer")
    return [MemberOut(user=m.user, role=m.role) for m in project.members]


@router.put("/{project_id}/members", response_model=list[MemberOut])
def upsert_member(project_id: str, body: MemberIn, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    project = require_project(db, project_id, user, "owner")
    target = db.query(User).filter(User.email == body.email.lower()).first()
    if target is None:
        target = User(email=body.email.lower(), name=body.email.split("@")[0])
        db.add(target)
        db.flush()
    member = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project.id, ProjectMember.user_id == target.id)
        .first()
    )
    if member:
        member.role = body.role
    else:
        db.add(ProjectMember(project_id=project.id, user_id=target.id, role=body.role))
    db.commit()
    audit(db, user, "member.upserted", project.id, {"email": body.email, "role": body.role})
    db.refresh(project)
    return [MemberOut(user=m.user, role=m.role) for m in project.members]


@router.delete("/{project_id}/members/{email}", status_code=204)
def remove_member(project_id: str, email: str, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    project = require_project(db, project_id, user, "owner")
    target = db.query(User).filter(User.email == email.lower()).first()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    owners = [m for m in project.members if m.role == "owner"]
    member = next((m for m in project.members if m.user_id == target.id), None)
    if member is None:
        raise HTTPException(status_code=404, detail="Not a member")
    if member.role == "owner" and len(owners) == 1:
        raise HTTPException(status_code=422, detail="Cannot remove the last owner")
    db.delete(member)
    db.commit()
    audit(db, user, "member.removed", project.id, {"email": email})


@router.get("/{project_id}/audit", response_model=list[AuditOut])
def project_audit(project_id: str, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    require_project(db, project_id, user, "viewer")
    return (
        db.query(AuditLog)
        .filter(AuditLog.project_id == project_id)
        .order_by(AuditLog.created_at.desc())
        .limit(200)
        .all()
    )
