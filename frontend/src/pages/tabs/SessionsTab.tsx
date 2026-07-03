import {
  Badge, Button, Card, Dialog, DialogActions, DialogBody, DialogContent,
  DialogSurface, DialogTitle, DialogTrigger, Dropdown, Field, Input, Option,
  Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text,
  Textarea, Title3,
} from "@fluentui/react-components";
import { AddRegular, DeleteRegular } from "@fluentui/react-icons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { Meta, Project, ScopeSession, SessionCompare } from "../../types";
import { fmtDate, fmtEur, fmtNum } from "../../utils";
import { BurnUp, Waterfall } from "../../viz/charts";
import { diverging, series, variantColor } from "../../viz/palette";

export function SessionsTab({ project, meta, canEdit, isOwner }: {
  project: Project; meta: Meta; canEdit: boolean; isOwner: boolean;
}) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language === "de" ? "de" : "en") as "de" | "en";
  const [sessions, setSessions] = useState<ScopeSession[]>([]);
  const [compare, setCompare] = useState<SessionCompare | null>(null);
  const [fromV, setFromV] = useState<number | null>(null);
  const [toV, setToV] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", note: "" });

  const paramLabel = (k: string) => meta.parameters.find((p) => p.key === k)?.label[lang] ?? k;

  const load = () => api.sessions(project.id).then((s) => {
    setSessions(s);
    if (s.length >= 2) {
      const f = fromV ?? s[0].version;
      const to = toV ?? s[s.length - 1].version;
      api.compare(project.id, f, to).then(setCompare).catch(() => setCompare(null));
    } else {
      setCompare(null);
    }
  });

  useEffect(() => { load(); }, [project.id, fromV, toV]);

  const create = async () => {
    await api.createSession(project.id, form.name, form.note);
    setOpen(false);
    setForm({ name: "", note: "" });
    load();
  };

  const remove = async (s: ScopeSession) => {
    if (!window.confirm(t("sessions.deleteConfirm"))) return;
    await api.deleteSession(project.id, s.id);
    load();
  };

  const burnPoints = useMemo(() => sessions.map((s) => ({
    label: `v${s.version}`,
    sub: `${s.name} · ${fmtDate(s.created_at)}`,
    value: s.results.function_points.adjusted,
  })), [sessions]);

  const waterfallSteps = useMemo(() => {
    if (!compare) return [];
    const a = sessions.find((s) => s.version === compare.from_version);
    const deltas = compare.param_deltas
      .filter((d) => d.delta !== 0)
      .map((d) => {
        // FP delta per parameter from the frozen component weights of the newer session.
        const b = sessions.find((s) => s.version === compare.to_version);
        const compB = b?.results.function_points.components.find((c) => c.param === d.param);
        const compA = a?.results.function_points.components.find((c) => c.param === d.param);
        return {
          key: d.param, label: paramLabel(d.param),
          value: (compB?.fp ?? 0) - (compA?.fp ?? 0), kind: "delta" as const,
        };
      })
      .filter((d) => d.value !== 0);
    return [
      { key: "from", label: `v${compare.from_version}`, value: compare.fp_from, kind: "total" as const },
      ...deltas,
      { key: "to", label: `v${compare.to_version}`, value: compare.fp_to, kind: "total" as const },
    ];
  }, [compare, sessions, lang]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Title3>{t("sessions.title")}</Title3>
        <div style={{ flex: 1 }} />
        {canEdit && (
          <Button appearance="primary" icon={<AddRegular />} onClick={() => setOpen(true)}>
            {t("sessions.create")}
          </Button>
        )}
      </div>

      {sessions.length === 0 && <Card style={{ padding: 24 }}><Text>{t("sessions.empty")}</Text></Card>}

      {sessions.length > 0 && (
        <Card style={{ padding: 20 }}>
          <div style={{ overflowX: "auto" }}>
            <Table size="small" style={{ minWidth: 720 }}>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>{t("common.version")}</TableHeaderCell>
                  <TableHeaderCell>{t("common.name")}</TableHeaderCell>
                  <TableHeaderCell>{t("common.date")}</TableHeaderCell>
                  {meta.parameters.map((p) => (
                    <TableHeaderCell key={p.key} style={{ overflowWrap: "anywhere" }}>
                      {p.label[lang]}
                    </TableHeaderCell>
                  ))}
                  <TableHeaderCell>FP</TableHeaderCell>
                  <TableHeaderCell />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      v{s.version} {s.is_baseline && <Badge appearance="tint" size="small">{t("sessions.baseline")}</Badge>}
                    </TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>{fmtDate(s.created_at)}</TableCell>
                    {meta.parameters.map((p) => (
                      <TableCell key={p.key}>{(s.params as Record<string, number>)[p.key] ?? 0}</TableCell>
                    ))}
                    <TableCell><b>{fmtNum(s.results.function_points.adjusted, 1)}</b></TableCell>
                    <TableCell>
                      {isOwner && !s.is_baseline && (
                        <Button appearance="subtle" size="small" icon={<DeleteRegular />}
                                onClick={() => remove(s)} aria-label="delete" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {sessions.length >= 1 && (
        <Card style={{ padding: 20 }}>
          <Title3>{t("sessions.burnup")}</Title3>
          <BurnUp points={burnPoints} color={series.s1} unit="FP" />
        </Card>
      )}

      {sessions.length >= 2 && compare && (
        <>
          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <Title3 style={{ marginRight: "auto" }}>{t("sessions.compareTitle")}</Title3>
              <Field label={t("sessions.from")}>
                <Dropdown value={`v${compare.from_version}`} selectedOptions={[String(compare.from_version)]}
                          style={{ minWidth: 90 }}
                          onOptionSelect={(_, d) => setFromV(Number(d.optionValue))}>
                  {sessions.map((s) => <Option key={s.id} value={String(s.version)}>{`v${s.version}`}</Option>)}
                </Dropdown>
              </Field>
              <Field label={t("sessions.to")}>
                <Dropdown value={`v${compare.to_version}`} selectedOptions={[String(compare.to_version)]}
                          style={{ minWidth: 90 }}
                          onOptionSelect={(_, d) => setToV(Number(d.optionValue))}>
                  {sessions.map((s) => <Option key={s.id} value={String(s.version)}>{`v${s.version}`}</Option>)}
                </Dropdown>
              </Field>
            </div>

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", margin: "12px 0" }}>
              <Text size={400}>
                <b>{t("sessions.fpDelta")}:</b>{" "}
                {compare.fp_delta >= 0 ? "+" : ""}{fmtNum(compare.fp_delta, 1)} FP
                ({fmtNum(compare.fp_from, 1)} → {fmtNum(compare.fp_to, 1)})
              </Text>
              {Object.entries(compare.cost_deltas).map(([k, v]) => (
                <Text key={k} size={400}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: variantColor[k], marginRight: 6 }} />
                  <b>{meta.variants.find((x) => x.key === k)?.[lang]}:</b> {v >= 0 ? "+" : ""}{fmtEur(v)}
                </Text>
              ))}
            </div>

            <Title3 style={{ marginTop: 8 }}>{t("sessions.waterfall")}</Title3>
            <Waterfall steps={waterfallSteps} colors={diverging} unit="FP" />

            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <Table size="small" style={{ minWidth: 480 }}>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>{t("estimation.parameter")}</TableHeaderCell>
                    <TableHeaderCell>v{compare.from_version}</TableHeaderCell>
                    <TableHeaderCell>v{compare.to_version}</TableHeaderCell>
                    <TableHeaderCell>Δ</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compare.param_deltas.map((d) => (
                    <TableRow key={d.param}>
                      <TableCell>{paramLabel(d.param)}</TableCell>
                      <TableCell>{d.from}</TableCell>
                      <TableCell>{d.to}</TableCell>
                      <TableCell style={{ fontWeight: 600, color: d.delta > 0 ? diverging.positive : d.delta < 0 ? diverging.negative : "#898781" }}>
                        {d.delta > 0 ? "+" : ""}{d.delta}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
      {sessions.length === 1 && <Text size={200} style={{ color: "#898781" }}>{t("sessions.needTwo")}</Text>}

      <Dialog open={open} onOpenChange={(_, d) => setOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t("sessions.create")}</DialogTitle>
            <DialogContent>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Field label={t("common.name")}>
                  <Input value={form.name} placeholder={`Session ${sessions.length + 1}`}
                         onChange={(_, d) => setForm({ ...form, name: d.value })} />
                </Field>
                <Field label={t("common.note")}>
                  <Textarea value={form.note} onChange={(_, d) => setForm({ ...form, note: d.value })} />
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">{t("common.cancel")}</Button>
              </DialogTrigger>
              <Button appearance="primary" onClick={create}>{t("common.create")}</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
