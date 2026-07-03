import {
  Button, Card, Dropdown, Field, MessageBar, MessageBarBody, Option, Slider,
  Text, Title2, Title3, Toast, ToastTitle, Toaster, useId, useToastController,
} from "@fluentui/react-components";
import { ArrowResetRegular, SaveRegular } from "@fluentui/react-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../api";
import { StatTile } from "../components/StatTile";
import type { AppConfig, EstimateResult, Meta, Params, User } from "../types";
import { fmtCompact, fmtEur, fmtNum } from "../utils";
import { variantColor } from "../viz/palette";

const SAMPLE: Params = {
  screens: 10, use_cases: 8, business_objects: 5, interfaces: 3,
  batches: 2, languages: 2, roles: 3,
};

const COMPLEXITIES = ["low", "average", "high"] as const;

export function AdminPage({ meta, user }: { meta: Meta; user: User }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language === "de" ? "de" : "en") as "de" | "en";
  const toasterId = useId("admin-toaster");
  const { dispatchToast } = useToastController(toasterId);

  const [config, setConfig] = useState<AppConfig | null>(null);
  const [preview, setPreview] = useState<EstimateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number>();

  const bounds = meta.slider_bounds;

  const refreshPreview = useCallback((cfg: AppConfig) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      api.adminPreview(SAMPLE, cfg).then(setPreview).catch(() => {});
    }, 200);
  }, []);

  useEffect(() => {
    api.config().then((c) => { setConfig(c); refreshPreview(c); });
  }, [refreshPreview]);

  if (!user.is_admin) {
    return <MessageBar intent="warning"><MessageBarBody>{t("admin.notAdmin")}</MessageBarBody></MessageBar>;
  }
  if (!config) return null;

  const update = (patch: Partial<AppConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    refreshPreview(next);
  };

  const phaseSum = Object.values(config.phase_distribution).reduce((a, b) => a + b, 0);

  const save = async () => {
    setBusy(true);
    try {
      const saved = await api.saveConfig(config);
      setConfig(saved);
      dispatchToast(<Toast><ToastTitle>{t("common.saved")}</ToastTitle></Toast>, { intent: "success" });
    } catch (e) {
      dispatchToast(<Toast><ToastTitle>{String((e as Error).message)}</ToastTitle></Toast>, { intent: "error" });
    } finally { setBusy(false); }
  };

  const reset = async () => {
    setBusy(true);
    try {
      const c = await api.resetConfig();
      setConfig(c);
      refreshPreview(c);
    } finally { setBusy(false); }
  };

  const slider = (label: string, boundKey: string, value: number,
                  onChange: (v: number) => void, format?: (v: number) => string) => {
    const b = bounds[boundKey] ?? { min: 0, max: 100, step: 1 };
    return (
      <Field key={boundKey} label={`${label}: ${format ? format(value) : fmtNum(value, 2)}`}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Text size={200} style={{ color: "#898781", width: 44, textAlign: "right" }}>{fmtNum(b.min, 1)}</Text>
          <Slider style={{ flex: 1 }} min={b.min} max={b.max} step={b.step} value={value}
                  onChange={(_, d) => onChange(d.value)} />
          <Text size={200} style={{ color: "#898781", width: 60 }}>{fmtNum(b.max, 1)}</Text>
        </div>
      </Field>
    );
  };

  return (
    <div>
      <Toaster toasterId={toasterId} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Title2>{t("admin.title")}</Title2>
        <div style={{ flex: 1 }} />
        <Button icon={<ArrowResetRegular />} onClick={reset} disabled={busy}>{t("admin.resetConfig")}</Button>
        <Button appearance="primary" icon={<SaveRegular />} onClick={save}
                disabled={busy || Math.abs(phaseSum - 100) > 0.01}>
          {t("admin.saveConfig")}
        </Button>
      </div>
      <MessageBar intent="info" style={{ marginBottom: 16 }}>
        <MessageBarBody>{t("admin.savedNote")}</MessageBarBody>
      </MessageBar>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 480px", display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: 20, gap: 8 }}>
            <Title3>{t("admin.productivity")}</Title3>
            {slider(t("admin.classic"), "productivity.classic", config.productivity.classic,
              (v) => update({ productivity: { ...config.productivity, classic: v } }),
              (v) => `${fmtNum(v, 1)} h/FP`)}
            {slider(t("admin.agile"), "productivity.agile", config.productivity.agile,
              (v) => update({ productivity: { ...config.productivity, agile: v } }),
              (v) => `${fmtNum(v, 1)} h/FP`)}
            {slider(t("admin.agentic"), "productivity.agentic", config.productivity.agentic,
              (v) => update({ productivity: { ...config.productivity, agentic: v } }),
              (v) => `${fmtNum(v, 1)} h/FP`)}
          </Card>

          <Card style={{ padding: 20, gap: 8 }}>
            <Title3>{t("admin.rates")}</Title3>
            {slider(t("admin.blendedRate"), "blended_rate", config.blended_rate,
              (v) => update({ blended_rate: v }), (v) => fmtEur(v))}
          </Card>

          <Card style={{ padding: 20, gap: 8 }}>
            <Title3>{t("admin.phases")}</Title3>
            {meta.phases.map((ph) =>
              slider(ph[lang], `phase_distribution.${ph.key}`,
                config.phase_distribution[ph.key] ?? 0,
                (v) => update({ phase_distribution: { ...config.phase_distribution, [ph.key]: v } }),
                (v) => `${fmtNum(v)} %`))}
            <Text weight="semibold"
                  style={{ color: Math.abs(phaseSum - 100) > 0.01 ? "#d03b3b" : "#006300" }}>
              {t("admin.phaseSum")}: {fmtNum(phaseSum)} %
              {Math.abs(phaseSum - 100) > 0.01 ? ` — ${t("admin.phaseSumError")}` : ""}
            </Text>
          </Card>

          <Card style={{ padding: 20, gap: 8 }}>
            <Title3>{t("admin.opsConsulting")}</Title3>
            {slider(t("admin.operationsPct"), "operations_pct", config.operations_pct,
              (v) => update({ operations_pct: v }), (v) => `${fmtNum(v)} %`)}
            {slider(t("admin.consultingPct"), "consulting_pct", config.consulting_pct,
              (v) => update({ consulting_pct: v }), (v) => `${fmtNum(v)} %`)}
          </Card>

          <Card style={{ padding: 20, gap: 8 }}>
            <Title3>{t("admin.tokens")}</Title3>
            {slider(t("admin.tokensPerFp"), "tokens_per_fp", config.tokens_per_fp,
              (v) => update({ tokens_per_fp: v }), (v) => fmtCompact(v))}
            {slider(t("admin.tokenPrice"), "token_price_per_million", config.token_price_per_million,
              (v) => update({ token_price_per_million: v }), (v) => fmtEur(v))}
          </Card>

          <Card style={{ padding: 20, gap: 8 }}>
            <Title3>{t("admin.complexityTitle")}</Title3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {meta.parameters.map((p) => (
                <Field key={p.key}
                       label={`${p.label[lang]} (${p.ifpug_type}: ${COMPLEXITIES.map((c) => meta.ifpug_weights[p.ifpug_type][c]).join("/")})`}>
                  <Dropdown
                    value={t(`admin.complexity${(config.complexity[p.key] ?? "average")[0].toUpperCase()}${(config.complexity[p.key] ?? "average").slice(1)}`)}
                    selectedOptions={[config.complexity[p.key] ?? "average"]}
                    onOptionSelect={(_, d) =>
                      update({ complexity: { ...config.complexity, [p.key]: d.optionValue as string } })}>
                    {COMPLEXITIES.map((c) => (
                      <Option key={c} value={c}>
                        {t(`admin.complexity${c[0].toUpperCase()}${c.slice(1)}`)}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              ))}
            </div>
          </Card>
        </div>

        {/* live preview */}
        <Card style={{ width: 360, flexShrink: 0, padding: 20, position: "sticky", top: 64 }}>
          <Title3>{t("admin.preview")}</Title3>
          <Text size={200} style={{ color: "#898781" }}>
            {t("admin.previewHint")}{" "}
            ({Object.entries(SAMPLE).map(([k, v]) =>
              `${meta.parameters.find((p) => p.key === k)?.label[lang]}: ${v}`).join(", ")})
          </Text>
          {preview && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              <StatTile label={t("estimation.fpTotal")}
                        value={fmtNum(preview.function_points.adjusted, 1)} />
              {["classic", "agile", "agentic"].map((k) => (
                <StatTile key={k} accent={variantColor[k]}
                          label={meta.variants.find((v) => v.key === k)?.[lang] ?? k}
                          value={fmtEur(preview.variants[k].cost.expected)}
                          sub={`${fmtNum(preview.variants[k].hours.expected)} h`} />
              ))}
              <StatTile label={t("estimation.tokens")}
                        value={fmtCompact(preview.tokens.total_tokens)}
                        sub={`${t("estimation.tokenCost")}: ${fmtEur(preview.tokens.cost)}`} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
