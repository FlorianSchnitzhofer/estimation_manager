from datetime import datetime

from pydantic import BaseModel, Field


class ParamsIn(BaseModel):
    screens: int = Field(0, ge=0)
    use_cases: int = Field(0, ge=0)
    business_objects: int = Field(0, ge=0)
    interfaces: int = Field(0, ge=0)
    batches: int = Field(0, ge=0)
    languages: int = Field(0, ge=0)
    roles: int = Field(0, ge=0)


class ProjectIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    client: str = ""
    goal: str = ""
    benefit: str = ""
    assumptions: str = ""
    out_of_scope: str = ""


class ProjectUpdate(BaseModel):
    name: str | None = None
    client: str | None = None
    goal: str | None = None
    benefit: str | None = None
    assumptions: str | None = None
    out_of_scope: str | None = None
    params: ParamsIn | None = None
    vaf_enabled: bool | None = None
    gsc: dict[str, int] | None = None


class MemberIn(BaseModel):
    email: str
    role: str = Field(..., pattern="^(owner|editor|viewer)$")


class EstimateIn(BaseModel):
    params: ParamsIn
    vaf_enabled: bool = False
    gsc: dict[str, int] = {}
    # Optional overrides for live preview in the admin area.
    config_override: dict | None = None


class SessionIn(BaseModel):
    name: str = ""
    note: str = ""


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    is_admin: bool

    model_config = {"from_attributes": True}


class MemberOut(BaseModel):
    user: UserOut
    role: str


class SessionOut(BaseModel):
    id: str
    version: int
    name: str
    note: str
    params: dict
    vaf_enabled: bool
    gsc: dict
    config_snapshot: dict
    results: dict
    is_baseline: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectOut(BaseModel):
    id: str
    name: str
    client: str
    goal: str
    benefit: str
    assumptions: str
    out_of_scope: str
    params: dict
    vaf_enabled: bool
    gsc: dict
    created_at: datetime
    updated_at: datetime
    my_role: str | None = None
    session_count: int = 0

    model_config = {"from_attributes": True}


class AuditOut(BaseModel):
    id: str
    project_id: str | None
    user_email: str
    action: str
    details: dict
    created_at: datetime

    model_config = {"from_attributes": True}
