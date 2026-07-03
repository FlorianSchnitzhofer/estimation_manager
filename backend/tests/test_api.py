import yaml
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _create_project(name="Testprojekt"):
    resp = client.post("/api/projects", json={
        "name": name, "client": "ReqPOOL GmbH",
        "goal": "Aufwände schätzen", "benefit": "Transparenz",
    })
    assert resp.status_code == 201, resp.text
    return resp.json()


PARAMS = {
    "screens": 10, "use_cases": 8, "business_objects": 5,
    "interfaces": 3, "batches": 2, "languages": 2, "roles": 3,
}


def test_health():
    assert client.get("/api/health").json()["status"] == "ok"


def test_auto_login_user_is_admin():
    me = client.get("/api/me").json()
    assert me["email"] == "florian@bingro.com"
    assert me["is_admin"] is True


def test_meta_contains_definitions_and_bounds():
    meta = client.get("/api/admin/meta").json()
    assert len(meta["parameters"]) == 7
    assert all("definition" in p for p in meta["parameters"])
    assert len(meta["gsc_questions"]) == 14
    assert meta["slider_bounds"]["productivity.classic"] == {"min": 8, "max": 24, "step": 0.5}


def test_project_estimate_and_sessions_flow():
    project = _create_project()
    pid = project["id"]

    # Save parameters on the project, then run a live estimate.
    resp = client.put(f"/api/projects/{pid}", json={"params": PARAMS})
    assert resp.status_code == 200

    est = client.post(f"/api/projects/{pid}/estimate", json={"params": PARAMS}).json()
    assert est["function_points"]["adjusted"] == 173
    assert est["variants"]["agentic"]["hours"]["expected"] == 346

    # Snapshot 1 (baseline), then scope change, snapshot 2.
    s1 = client.post(f"/api/projects/{pid}/sessions", json={"name": "Baseline"}).json()
    assert s1["version"] == 1 and s1["is_baseline"] is True

    client.put(f"/api/projects/{pid}", json={"params": {**PARAMS, "screens": 14}})
    s2 = client.post(f"/api/projects/{pid}/sessions", json={"name": "Q2 Review"}).json()
    assert s2["version"] == 2

    delta = client.get(f"/api/projects/{pid}/sessions/compare").json()
    assert delta["fp_delta"] == 16.0  # 4 screens x weight 4
    screens = next(d for d in delta["param_deltas"] if d["param"] == "screens")
    assert screens["delta"] == 4

    # Audit trail records the changes.
    audit = client.get(f"/api/projects/{pid}/audit").json()
    actions = {a["action"] for a in audit}
    assert {"project.created", "project.updated", "session.created"} <= actions


def test_sessions_frozen_when_config_changes():
    project = _create_project("Frozen Config")
    pid = project["id"]
    client.put(f"/api/projects/{pid}", json={"params": PARAMS})
    s1 = client.post(f"/api/projects/{pid}/sessions", json={"name": "Before"}).json()

    # Admin changes productivity — existing snapshot must stay frozen.
    config = client.get("/api/admin/config").json()
    config["productivity"]["classic"] = 20.0
    assert client.put("/api/admin/config", json=config).status_code == 200

    s1_after = client.get(f"/api/projects/{pid}/sessions").json()[0]
    assert s1_after["results"] == s1["results"]
    assert s1_after["config_snapshot"]["productivity"]["classic"] == 14.0

    # New estimates use the new value.
    est = client.post(f"/api/projects/{pid}/estimate", json={"params": PARAMS}).json()
    assert est["variants"]["classic"]["hours"]["expected"] == 173 * 20

    # Reset for other tests.
    client.post("/api/admin/config/reset")


def test_config_phase_distribution_must_sum_to_100():
    config = client.get("/api/admin/config").json()
    config["phase_distribution"]["analysis"] = 50
    resp = client.put("/api/admin/config", json=config)
    assert resp.status_code == 422


def test_members_roles():
    project = _create_project("Shared")
    pid = project["id"]
    resp = client.put(f"/api/projects/{pid}/members",
                      json={"email": "colleague@reqpool.com", "role": "editor"})
    assert resp.status_code == 200
    roles = {m["user"]["email"]: m["role"] for m in resp.json()}
    assert roles["colleague@reqpool.com"] == "editor"
    assert roles["florian@bingro.com"] == "owner"

    # The last owner cannot be removed.
    resp = client.delete(f"/api/projects/{pid}/members/florian@bingro.com")
    assert resp.status_code == 422


def test_exports():
    project = _create_project("Exportprojekt")
    pid = project["id"]
    client.put(f"/api/projects/{pid}", json={"params": PARAMS})
    client.post(f"/api/projects/{pid}/sessions", json={"name": "Baseline"})

    pdf = client.get(f"/api/projects/{pid}/export/scope.pdf?lang=de")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")

    docx = client.get(f"/api/projects/{pid}/export/scope.docx?lang=en")
    assert docx.status_code == 200 and docx.content[:2] == b"PK"

    spec_resp = client.get(f"/api/projects/{pid}/export/spec.yaml")
    assert spec_resp.status_code == 200
    spec = yaml.safe_load(spec_resp.text)
    assert spec["meta"]["target_agent"] == "claude-code"
    assert len(spec["screens"]) == 10
    assert len(spec["use_cases"]) == 8
    assert len(spec["business_objects"]) == 5
    assert len(spec["roles"]) == 3
    assert spec["non_functional"]["languages"] == ["de", "en"]
    assert spec["use_cases"][0]["acceptance_criteria"][0].keys() >= {"given", "when", "then"}
