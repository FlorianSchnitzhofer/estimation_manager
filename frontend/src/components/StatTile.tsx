import { Card, Text } from "@fluentui/react-components";

export function StatTile({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <Card style={{ minWidth: 170, flex: "1 1 170px", padding: "14px 18px", gap: 4 }}>
      <Text size={200} style={{ color: "#52514e" }}>{label}</Text>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        {accent && <span style={{ width: 10, height: 10, borderRadius: 2, background: accent }} />}
        <Text size={700} weight="semibold" style={{ color: "#0b0b0b" }}>{value}</Text>
      </div>
      {sub && <Text size={200} style={{ color: "#898781" }}>{sub}</Text>}
    </Card>
  );
}
