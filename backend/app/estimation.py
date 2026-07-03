"""Neutral, IFPUG-based estimation engine.

Maps the seven ReqPOOL parameters onto IFPUG function types (EI/EO/EQ/ILF/EIF)
with configurable complexity weighting, optionally applies the Value Adjustment
Factor (14 GSC questions), and derives effort, cost per phase, operations,
consulting and token consumption for three delivery variants.

Pure functions only — the engine never touches the database, so it can be
reused for live previews, session snapshots and (later) an MCP/export service.
"""
from .defaults import GSC_QUESTIONS, IFPUG_WEIGHTS, PARAMETERS, PHASES, VARIANTS

PARAM_KEYS = [p["key"] for p in PARAMETERS]
PHASE_KEYS = [p["key"] for p in PHASES]
VARIANT_KEYS = [v["key"] for v in VARIANTS]


def normalize_params(params: dict) -> dict[str, int]:
    """Coerce raw input to non-negative integers for all seven parameters."""
    out = {}
    for key in PARAM_KEYS:
        try:
            out[key] = max(0, int(params.get(key, 0) or 0))
        except (TypeError, ValueError):
            out[key] = 0
    return out


def compute_vaf(gsc: dict | None) -> tuple[float, int]:
    """VAF = 0.65 + 0.01 * TDI, TDI = sum of the 14 GSC scores (0-5 each)."""
    gsc = gsc or {}
    tdi = 0
    for q in GSC_QUESTIONS:
        try:
            score = int(gsc.get(q["key"], 0) or 0)
        except (TypeError, ValueError):
            score = 0
        tdi += min(5, max(0, score))
    return 0.65 + 0.01 * tdi, tdi


def compute_function_points(params: dict, config: dict, vaf_enabled: bool = False,
                            gsc: dict | None = None) -> dict:
    params = normalize_params(params)
    complexity_cfg = config.get("complexity", {})
    components = []
    unadjusted = 0.0

    for p in PARAMETERS:
        key = p["key"]
        count = params[key]
        effective = max(0, count - 1) if p["counted_from_second"] else count
        complexity = complexity_cfg.get(key, "average")
        weight = IFPUG_WEIGHTS[p["ifpug_type"]].get(complexity, IFPUG_WEIGHTS[p["ifpug_type"]]["average"])
        fp = effective * weight
        unadjusted += fp
        components.append({
            "param": key,
            "ifpug_type": p["ifpug_type"],
            "count": count,
            "effective_count": effective,
            "complexity": complexity,
            "weight": weight,
            "fp": fp,
        })

    vaf, tdi = compute_vaf(gsc) if vaf_enabled else (1.0, 0)
    adjusted = round(unadjusted * vaf, 2)

    return {
        "components": components,
        "unadjusted": round(unadjusted, 2),
        "vaf_enabled": vaf_enabled,
        "tdi": tdi,
        "vaf": round(vaf, 4),
        "adjusted": adjusted,
    }


def compute_estimate(params: dict, config: dict, vaf_enabled: bool = False,
                     gsc: dict | None = None) -> dict:
    """Full estimation result: FP, effort/cost per variant and phase,
    per-parameter drill-down, operations, consulting, tokens."""
    fp = compute_function_points(params, config, vaf_enabled, gsc)
    total_fp = fp["adjusted"]

    productivity = config["productivity"]
    rate = float(config["blended_rate"])
    phase_dist = config["phase_distribution"]
    uncertainty = config.get("uncertainty", {"best": 0.85, "worst": 1.35})
    ops_pct = float(config.get("operations_pct", 15.0))
    consulting_pct = float(config.get("consulting_pct", 10.0))
    tokens_per_fp = float(config.get("tokens_per_fp", 400_000))
    token_price = float(config.get("token_price_per_million", 8.0))

    # Per-parameter share of total FP for the drill-down.
    unadj = fp["unadjusted"] or 1.0
    param_shares = {c["param"]: c["fp"] / unadj for c in fp["components"]}

    variants = {}
    for vkey in VARIANT_KEYS:
        h_per_fp = float(productivity[vkey])
        expected_h = total_fp * h_per_fp
        hours = {
            "best": round(expected_h * float(uncertainty["best"]), 1),
            "expected": round(expected_h, 1),
            "worst": round(expected_h * float(uncertainty["worst"]), 1),
        }
        cost = {k: round(v * rate, 2) for k, v in hours.items()}

        phases = {}
        for phase in PHASE_KEYS:
            pct = float(phase_dist.get(phase, 0))
            phase_hours = expected_h * pct / 100.0
            phases[phase] = {
                "pct": pct,
                "hours": round(phase_hours, 1),
                "cost": round(phase_hours * rate, 2),
                # Drill-down: contribution of each parameter to this phase.
                "by_param": {
                    pk: round(phase_hours * share * rate, 2)
                    for pk, share in param_shares.items()
                },
            }

        implementation_cost = phases.get("implementation", {}).get("cost", 0.0)
        variants[vkey] = {
            "hours_per_fp": h_per_fp,
            "hours": hours,
            "cost": cost,
            "phases": phases,
            "operations": {
                "pct_pa": ops_pct,
                "annual_cost": round(implementation_cost * ops_pct / 100.0, 2),
            },
            "consulting": {
                "pct": consulting_pct,
                "cost": round(implementation_cost * consulting_pct / 100.0, 2),
            },
            "by_param": {
                pk: {
                    "fp": round(share * unadj, 2),
                    "hours": round(expected_h * share, 1),
                    "cost": round(expected_h * share * rate, 2),
                }
                for pk, share in param_shares.items()
            },
        }

    total_tokens = total_fp * tokens_per_fp
    tokens = {
        "tokens_per_fp": tokens_per_fp,
        "total_tokens": round(total_tokens),
        "price_per_million_eur": token_price,
        "cost": round(total_tokens / 1_000_000.0 * token_price, 2),
        "assumption": (
            f"{tokens_per_fp:,.0f} tokens/FP x {total_fp} FP at "
            f"{token_price} EUR per 1M tokens (blended input/output)"
        ),
    }

    return {
        "params": normalize_params(params),
        "function_points": fp,
        "blended_rate": rate,
        "variants": variants,
        "tokens": tokens,
        "assumptions": build_assumptions(fp, config),
    }


def build_assumptions(fp: dict, config: dict) -> list[dict]:
    """Transparent list of the assumptions behind the calculation (de/en)."""
    prod = config["productivity"]
    unc = config.get("uncertainty", {"best": 0.85, "worst": 1.35})
    items = [
        {
            "de": "Function Points nach IFPUG: Mapping der 7 Parameter auf EI/EO/EQ/ILF/EIF "
                  "mit konfigurierter Komplexitätsgewichtung.",
            "en": "IFPUG function points: the 7 parameters are mapped to EI/EO/EQ/ILF/EIF "
                  "with the configured complexity weighting.",
        },
        {
            "de": f"Produktivität: klassisch {prod['classic']} h/FP, agil {prod['agile']} h/FP, "
                  f"agentisch {prod['agentic']} h/FP.",
            "en": f"Productivity: classic {prod['classic']} h/FP, agile {prod['agile']} h/FP, "
                  f"agentic {prod['agentic']} h/FP.",
        },
        {
            "de": f"Blended Rate: {config['blended_rate']} EUR/h; Unsicherheitsband "
                  f"{unc['best']}x (Best) bis {unc['worst']}x (Worst).",
            "en": f"Blended rate: {config['blended_rate']} EUR/h; uncertainty band "
                  f"{unc['best']}x (best) to {unc['worst']}x (worst).",
        },
        {
            "de": "Erste Sprache und erste Rolle sind Teil des Basissystems und werden "
                  "nicht gezählt.",
            "en": "The first language and the first role are part of the base system and "
                  "are not counted.",
        },
    ]
    if fp["vaf_enabled"]:
        items.append({
            "de": f"Value Adjustment Factor aktiv: TDI {fp['tdi']}, VAF {fp['vaf']}.",
            "en": f"Value adjustment factor active: TDI {fp['tdi']}, VAF {fp['vaf']}.",
        })
    else:
        items.append({
            "de": "Value Adjustment Factor deaktiviert (VAF = 1,0).",
            "en": "Value adjustment factor disabled (VAF = 1.0).",
        })
    return items


def compare_sessions(a: dict, b: dict) -> dict:
    """Delta between two session snapshots (a = older/baseline, b = newer)."""
    def fp_of(s):
        return s["results"]["function_points"]["adjusted"]

    def cost_of(s, variant="agile"):
        return s["results"]["variants"][variant]["cost"]["expected"]

    param_deltas = []
    for p in PARAMETERS:
        key = p["key"]
        va = int(a["params"].get(key, 0) or 0)
        vb = int(b["params"].get(key, 0) or 0)
        param_deltas.append({"param": key, "from": va, "to": vb, "delta": vb - va})

    cost_deltas = {
        v: round(cost_of(b, v) - cost_of(a, v), 2) for v in VARIANT_KEYS
    }
    return {
        "from_version": a["version"],
        "to_version": b["version"],
        "param_deltas": param_deltas,
        "fp_from": fp_of(a),
        "fp_to": fp_of(b),
        "fp_delta": round(fp_of(b) - fp_of(a), 2),
        "cost_deltas": cost_deltas,
    }
