import {
  Accordion, AccordionHeader, AccordionItem, AccordionPanel, Button, Card,
  Field, InfoLabel, MessageBar, MessageBarBody, Slider, SpinButton, Switch,
  Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text,
  Title3, Dropdown, Option, Toast, ToastTitle, Toaster, useToastController, useId,
} from "@fluentui/react-components";
import { CameraRegular, SaveRegular } from "@fluentui/react-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import { StatTile } from "../../components/StatTile";
import type { EstimateResult, Meta, ParamKey, Params, Project } from "../../types";
import { fmtCompact, fmtEur, fmtNum } from "../../utils";
import {
  BandBars, HBars, Legend, StackedBars,
} from "../../viz/charts";
import { phaseColor, series, variantColor } from "../../viz/palette";

const EMPTY: Params = {
  screens: 0, use_cases: 0, business_objects: 0, interfaces: 0,
  batches: 0, languages: 1, roles: 1,
};

export function EstimationTab({ project, setProject, meta, canEdit }: {
  project: Project;
  setProject: (p: Project) => void;
  meta: Meta;
  canEdit: boolean;
}) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language === "de" ? "de" : "en") as "de" | "en";
  const toasterId = useId("est-toaster");
  const { dispatchToast } = useToastController(toasterId);

  const [params, setParams] = useState<Params>({ ...EMPTY, ...project.params });
  const [vafEnabled, setVafEnabled] = useState(project.vaf_enabled);
  const [gsc, setGsc] = useState<Record<string, number>>(project.gsc || {});
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [drillVariant, setDrillVariant] = useState("agile");
  const [busy, setBusy] = useState(false);
  const timer = useRef<number>();

  // Live estimate with debounce.
  const recalc = useCallback((p: Params, vaf: boolean, g: Record<string, number>) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      api.estimate(project.id, p, vaf, g).then(setResult).catch(() => {});
    }, 250);
  }, [project.id]);

  useEffect(() => { recalc(params, vafEnabled, gsc); }, [params, vafEnabled, gsc, recalc]);

  const setParam = (key: ParamKey, value: number) =>
    setParams((prev) => ({ ...prev, [key]: Math.max(0, Math.round(value)) }));

  const save = async () => {
    setBusy(true);
    try {
      const updated = await api.updateProject(project.id, { params, vaf_enabled: vafEnabled, gsc });
      setProject(updated);
      dispatchToast(<Toast><ToastTitle>{t("common.saved")}</ToastTitle></Toast>, { intent: "success" });
    } finally { setBusy(false); }
  };

  const freeze = async () => {
    setBusy(true);
    try {
      await api.updateProject(project.id, { params, vaf_enabled: vafEnabled, gsc });
      const s = await api.createSession(project.id, "");
      const updated = await api.project(project.id);
      setProject(updated);
      dispatchToast(
        <Toast><ToastTitle>{`${t("sessions.title")}: v${s.version}`}</ToastTitle></Toast>,
        { intent: "success" },
      );
    } finally { setBusy(false); }
  };

  const variantLabel = (k: string) => meta.variants.find((v) => v.key === k)?.[lang] ?? k;
  const phaseLabel = (k: string) => meta.phases.find((p) => p.key === k)?.[lang] ?? k;
  const paramLabel = (k: string) => meta.parameters.find((p) => p.key === k)?.label[lang] ?? k;

  const fp = result?.function_points;
  const fpItems = useMemo(() => (fp?.components ?? [])
    .map((c) => ({
      key: c.param,
      label: paramLabel(c.param),
      value: c.fp,
      color: series.s1,
      tooltip: [
        paramLabel(c.param),
        `${c.ifpug_type} · ${t("estimation.counted")}: ${c.effective_count} × ${c.weight}`,
        `${fmtNum(c.fp, 1)} FP`,
      ],
    })), [fp, lang]);

  const variantItems = useMemo(() => (result ? ["classic", "agile", "agentic"].map((k) => {
    const v = result.variants[k];
    return {
      key: k, label: variantLabel(k), color: variantColor[k],
      best: v.hours.best, expected: v.hours.expected, worst: v.hours.worst,
      tooltip: [
        variantLabel(k),
        `${t("estimation.bandBest")}: ${fmtNum(v.hours.best)} h · ${fmtEur(v.cost.best)}`,
        `${t("estimation.bandExpected")}: ${fmtNum(v.hours.expected)} h · ${fmtEur(v.cost.expected)}`,
        `${t("estimation.bandWorst")}: ${fmtNum(v.hours.worst)} h · ${fmtEur(v.cost.worst)}`,
        `${v.hours_per_fp} ${t("estimation.perHour")}`,
      ],
    };
  }) : []), [result, lang]);

  const stackRows = useMemo(() => (result ? ["classic", "agile", "agentic"].map((k) => {
    const v = result.variants[k];
    return {
      key: k, label: variantLabel(k), total: v.cost.expected,
      segments: meta.phases.map((ph) => ({
        key: ph.key, label: phaseLabel(ph.key),
        value: v.phases[ph.key]?.cost ?? 0, color: phaseColor[ph.key],
      })),
    };
  }) : []), [result, lang]);

  const drill = result?.variants[drillVariant];

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
      <Toaster toasterId={toasterId} />
      {/* ------- left: parameter form ------- */}
      <Card style={{ width: 330, flexShrink: 0, padding: 20 }}>
        <Title3>{t("estimation.parameters")}</Title3>
        {!canEdit && (
          <MessageBar intent="info"><MessageBarBody>{t("estimation.readOnly")}</MessageBarBody></MessageBar>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {meta.parameters.map((p) => (
            <Field key={p.key}
              label={{
                children: (
                  <InfoLabel info={<div style={{ maxWidth: 320 }}>{p.definition[lang]}</div>}>
                    {p.label[lang]} <Text size={200} style={{ color: "#898781" }}>({p.ifpug_type})</Text>
                  </InfoLabel>
                ),
              }}>
              <SpinButton
                value={params[p.key]}
                min={0} max={999}
                disabled={!canEdit}
                onChange={(_, d) => {
                  const v = d.value ?? (d.displayValue ? parseInt(d.displayValue, 10) : 0);
                  if (v != null && !Number.isNaN(v)) setParam(p.key, v);
                }}
              />
            </Field>
          ))}
        </div>

        <Accordion collapsible style={{ marginTop: 12 }}>
          <AccordionItem value="vaf">
            <AccordionHeader>
              {t("estimation.vaf")}{fp?.vaf_enabled ? ` — ${fp.vaf.toFixed(2)}` : ""}
            </AccordionHeader>
            <AccordionPanel>
              <Switch checked={vafEnabled} disabled={!canEdit}
                      label={t("estimation.vafEnable")}
                      onChange={(_, d) => setVafEnabled(d.checked)} />
              {vafEnabled && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
                  {meta.gsc_questions.map((q) => (
                    <Field key={q.key} label={`${q[lang]} (${gsc[q.key] ?? 0})`} size="small">
                      <Slider min={0} max={5} step={1} disabled={!canEdit}
                              value={gsc[q.key] ?? 0}
                              onChange={(_, d) => setGsc({ ...gsc, [q.key]: d.value })} />
                    </Field>
                  ))}
                  <Text size={200} style={{ color: "#52514e" }}>
                    {t("estimation.tdi")}: {fp?.tdi ?? 0} → VAF {fp?.vaf.toFixed(2) ?? "1.00"}
                  </Text>
                </div>
              )}
            </AccordionPanel>
          </AccordionItem>
        </Accordion>

        {canEdit && (
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Button appearance="primary" icon={<SaveRegular />} onClick={save} disabled={busy}>
              {t("estimation.saveParams")}
            </Button>
            <Button icon={<CameraRegular />} onClick={freeze} disabled={busy}>
              {t("estimation.createSnapshot")}
            </Button>
          </div>
        )}
      </Card>

      {/* ------- right: results ------- */}
      <div style={{ flex: 1, minWidth: 480, display: "flex", flexDirection: "column", gap: 16 }}>
        {result && fp && (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <StatTile label={t("estimation.fpTotal")} value={fmtNum(fp.adjusted, 1)}
                        sub={`${t("estimation.fpUnadjusted")}: ${fmtNum(fp.unadjusted, 1)} · VAF ${fp.vaf.toFixed(2)}`} />
              {["classic", "agile", "agentic"].map((k) => (
                <StatTile key={k} accent={variantColor[k]}
                          label={`${variantLabel(k)} (${t("estimation.bandExpected")})`}
                          value={fmtEur(result.variants[k].cost.expected)}
                          sub={`${fmtNum(result.variants[k].hours.expected)} h · ${result.variants[k].hours_per_fp} ${t("estimation.perHour")}`} />
              ))}
            </div>

            <Card style={{ padding: 20 }}>
              <Title3>{t("estimation.fpBreakdown")}</Title3>
              <HBars items={fpItems} unit="FP" />
            </Card>

            <Card style={{ padding: 20 }}>
              <Title3>{t("estimation.variantComparison")}</Title3>
              <BandBars items={variantItems} unit="h" />
              <Text size={200} style={{ color: "#898781" }}>
                ⊢⊣ {t("estimation.bandBest")} – {t("estimation.bandWorst")}
              </Text>
            </Card>

            <Card style={{ padding: 20 }}>
              <Title3>{t("estimation.phaseCosts")}</Title3>
              <StackedBars rows={stackRows} formatValue={(v) => fmtEur(v)} />
              <Legend items={meta.phases.map((ph) => ({ label: phaseLabel(ph.key), color: phaseColor[ph.key] }))} />
            </Card>

            <Card style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Title3>{t("estimation.drilldown")}</Title3>
                <Dropdown value={variantLabel(drillVariant)} selectedOptions={[drillVariant]}
                          onOptionSelect={(_, d) => setDrillVariant(d.optionValue as string)}
                          style={{ minWidth: 160 }}>
                  {["classic", "agile", "agentic"].map((k) => (
                    <Option key={k} value={k}>{variantLabel(k)}</Option>
                  ))}
                </Dropdown>
              </div>
              {drill && (
                <div style={{ overflowX: "auto" }}>
                  <Table size="small" style={{ minWidth: 640 }}>
                    <TableHeader>
                      <TableRow>
                        <TableHeaderCell>{t("estimation.parameter")}</TableHeaderCell>
                        <TableHeaderCell>FP</TableHeaderCell>
                        <TableHeaderCell>{t("common.hours")}</TableHeaderCell>
                        {meta.phases.map((ph) => (
                          <TableHeaderCell key={ph.key}>{phaseLabel(ph.key)}</TableHeaderCell>
                        ))}
                        <TableHeaderCell>{t("common.cost")}</TableHeaderCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(drill.by_param).map(([pk, v]) => (
                        <TableRow key={pk}>
                          <TableCell style={{ overflowWrap: "anywhere", minWidth: 110 }}>{paramLabel(pk)}</TableCell>
                          <TableCell>{fmtNum(v.fp, 1)}</TableCell>
                          <TableCell>{fmtNum(v.hours)}</TableCell>
                          {meta.phases.map((ph) => (
                            <TableCell key={ph.key}>
                              {fmtEur(drill.phases[ph.key]?.by_param[pk] ?? 0)}
                            </TableCell>
                          ))}
                          <TableCell><b>{fmtEur(v.cost)}</b></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {drill && (
                <>
                  <StatTile label={`${t("estimation.operations")} (${variantLabel(drillVariant)}, ${t("estimation.perYear")})`}
                            value={fmtEur(drill.operations.annual_cost)}
                            sub={`${drill.operations.pct_pa}% ${t("estimation.ofImplementation")}`} />
                  <StatTile label={`${t("estimation.consulting")} (${variantLabel(drillVariant)})`}
                            value={fmtEur(drill.consulting.cost)}
                            sub={`${drill.consulting.pct}% ${t("estimation.ofImplementation")}`} />
                </>
              )}
              <StatTile label={t("estimation.tokens")}
                        value={fmtCompact(result.tokens.total_tokens)}
                        sub={`${t("estimation.tokenCost")}: ${fmtEur(result.tokens.cost)} · ${fmtNum(result.tokens.tokens_per_fp)}/FP × ${result.tokens.price_per_million_eur} €/1M`} />
            </div>

            <Card style={{ padding: 20 }}>
              <Title3>{t("estimation.ifpugTable")}</Title3>
              <div style={{ overflowX: "auto" }}>
                <Table size="small" style={{ minWidth: 560 }}>
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>{t("estimation.parameter")}</TableHeaderCell>
                      <TableHeaderCell>IFPUG</TableHeaderCell>
                      <TableHeaderCell>#</TableHeaderCell>
                      <TableHeaderCell>{t("estimation.counted")}</TableHeaderCell>
                      <TableHeaderCell>{t("estimation.complexity")}</TableHeaderCell>
                      <TableHeaderCell>{t("estimation.weight")}</TableHeaderCell>
                      <TableHeaderCell>FP</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fp.components.map((c) => (
                      <TableRow key={c.param}>
                        <TableCell>{paramLabel(c.param)}</TableCell>
                        <TableCell>{c.ifpug_type}</TableCell>
                        <TableCell>{c.count}</TableCell>
                        <TableCell>{c.effective_count}</TableCell>
                        <TableCell>{t(`admin.complexity${c.complexity[0].toUpperCase()}${c.complexity.slice(1)}`)}</TableCell>
                        <TableCell>{c.weight}</TableCell>
                        <TableCell><b>{fmtNum(c.fp, 1)}</b></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <Card style={{ padding: 20 }}>
              <Title3>{t("estimation.assumptionsTitle")}</Title3>
              <ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "#52514e", fontSize: 13, lineHeight: 1.7 }}>
                {result.assumptions.map((a, i) => <li key={i}>{a[lang]}</li>)}
              </ul>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
