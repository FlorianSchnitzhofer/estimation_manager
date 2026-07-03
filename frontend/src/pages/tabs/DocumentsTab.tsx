import {
  Button, Card, Field, Text, Textarea, Title3,
} from "@fluentui/react-components";
import { ArrowDownloadRegular, SaveRegular } from "@fluentui/react-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { Project } from "../../types";

export function DocumentsTab({ project, setProject, canEdit }: {
  project: Project; setProject: (p: Project) => void; canEdit: boolean;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "de" ? "de" : "en";
  const [form, setForm] = useState({
    goal: project.goal, benefit: project.benefit,
    assumptions: project.assumptions, out_of_scope: project.out_of_scope,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try { setProject(await api.updateProject(project.id, form)); }
    finally { setBusy(false); }
  };

  const dl = (kind: "scope.pdf" | "scope.docx" | "spec.yaml") => {
    window.open(api.exportUrl(project.id, kind, lang), "_blank");
  };

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
      <Card style={{ flex: "1 1 380px", padding: 20 }}>
        <Title3>{t("documents.title")}</Title3>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 12 }}>
          <div>
            <Text weight="semibold">{t("documents.scopeDoc")}</Text>
            <p><Text size={200} style={{ color: "#52514e" }}>{t("documents.scopeDesc")}</Text></p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button icon={<ArrowDownloadRegular />} onClick={() => dl("scope.pdf")}>PDF</Button>
              <Button icon={<ArrowDownloadRegular />} onClick={() => dl("scope.docx")}>DOCX</Button>
            </div>
          </div>
          <div>
            <Text weight="semibold">{t("documents.spec")}</Text>
            <p><Text size={200} style={{ color: "#52514e" }}>{t("documents.specDesc")}</Text></p>
            <Button icon={<ArrowDownloadRegular />} onClick={() => dl("spec.yaml")}>YAML</Button>
          </div>
        </div>
      </Card>

      <Card style={{ flex: "1 1 420px", padding: 20 }}>
        <Title3>{t("projects.goal")} & Co.</Title3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
          <Field label={t("projects.goal")}>
            <Textarea disabled={!canEdit} value={form.goal}
                      onChange={(_, d) => setForm({ ...form, goal: d.value })} />
          </Field>
          <Field label={t("projects.benefit")}>
            <Textarea disabled={!canEdit} value={form.benefit}
                      onChange={(_, d) => setForm({ ...form, benefit: d.value })} />
          </Field>
          <Field label={t("projects.assumptions")}>
            <Textarea disabled={!canEdit} value={form.assumptions}
                      onChange={(_, d) => setForm({ ...form, assumptions: d.value })} />
          </Field>
          <Field label={t("projects.outOfScope")}>
            <Textarea disabled={!canEdit} value={form.out_of_scope}
                      onChange={(_, d) => setForm({ ...form, out_of_scope: d.value })} />
          </Field>
          {canEdit && (
            <Button appearance="primary" icon={<SaveRegular />} onClick={save}
                    disabled={busy} style={{ alignSelf: "flex-start" }}>
              {t("common.save")}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
