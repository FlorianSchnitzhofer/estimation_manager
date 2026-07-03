import {
  Badge, Button, Card, CardHeader, Dialog, DialogActions, DialogBody,
  DialogContent, DialogSurface, DialogTitle, DialogTrigger, Field, Input,
  Text, Textarea, Title2,
} from "@fluentui/react-components";
import { AddRegular, DeleteRegular, OpenRegular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import type { Project } from "../types";
import { fmtDate } from "../utils";

export function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", client: "", goal: "", benefit: "" });
  const [busy, setBusy] = useState(false);

  const load = () => api.projects().then(setProjects);
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const p = await api.createProject(form);
      setOpen(false);
      navigate(`/projects/${p.id}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Project) => {
    if (!window.confirm(t("projects.deleteConfirm"))) return;
    await api.deleteProject(p.id);
    load();
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <Title2>{t("app.projects")}</Title2>
        <div style={{ flex: 1 }} />
        <Button appearance="primary" icon={<AddRegular />} onClick={() => setOpen(true)}>
          {t("projects.newProject")}
        </Button>
      </div>

      {projects.length === 0 && (
        <Card style={{ padding: 32 }}><Text>{t("projects.empty")}</Text></Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {projects.map((p) => (
          <Card key={p.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/projects/${p.id}`)}>
            <CardHeader
              header={<Text weight="semibold" size={400}>{p.name}</Text>}
              description={<Text size={200} style={{ color: "#52514e" }}>{p.client || "—"}</Text>}
              action={
                <div style={{ display: "flex", gap: 4 }}>
                  <Button appearance="subtle" icon={<OpenRegular />} aria-label="open"
                          onClick={(e) => { e.stopPropagation(); navigate(`/projects/${p.id}`); }} />
                  {p.my_role === "owner" && (
                    <Button appearance="subtle" icon={<DeleteRegular />} aria-label="delete"
                            onClick={(e) => { e.stopPropagation(); remove(p); }} />
                  )}
                </div>
              }
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 4px 4px" }}>
              <Badge appearance="outline">{t("projects.sessionCount")}: {p.session_count}</Badge>
              {p.my_role && <Badge appearance="outline">{t(`sharing.${p.my_role}`)}</Badge>}
              <Text size={200} style={{ color: "#898781", marginLeft: "auto" }}>
                {t("projects.updated")}: {fmtDate(p.updated_at)}
              </Text>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(_, d) => setOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t("projects.newProject")}</DialogTitle>
            <DialogContent>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Field label={t("common.name")} required>
                  <Input value={form.name} onChange={(_, d) => setForm({ ...form, name: d.value })} />
                </Field>
                <Field label={t("projects.client")}>
                  <Input value={form.client} onChange={(_, d) => setForm({ ...form, client: d.value })} />
                </Field>
                <Field label={t("projects.goal")}>
                  <Textarea value={form.goal} onChange={(_, d) => setForm({ ...form, goal: d.value })} />
                </Field>
                <Field label={t("projects.benefit")}>
                  <Textarea value={form.benefit} onChange={(_, d) => setForm({ ...form, benefit: d.value })} />
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">{t("common.cancel")}</Button>
              </DialogTrigger>
              <Button appearance="primary" onClick={create} disabled={busy || !form.name.trim()}>
                {t("common.create")}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
