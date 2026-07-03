import {
  Card, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow,
  Text, Title3,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { AuditEntry } from "../../types";
import { fmtDateTime } from "../../utils";

export function AuditTab({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => { api.projectAudit(projectId).then(setEntries); }, [projectId]);

  return (
    <Card style={{ padding: 20 }}>
      <Title3>{t("audit.title")}</Title3>
      <div style={{ overflowX: "auto" }}>
        <Table size="small" style={{ minWidth: 640 }}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell style={{ width: 160 }}>{t("audit.when")}</TableHeaderCell>
              <TableHeaderCell style={{ width: 220 }}>{t("audit.user")}</TableHeaderCell>
              <TableHeaderCell style={{ width: 160 }}>{t("audit.action")}</TableHeaderCell>
              <TableHeaderCell>{t("audit.details")}</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{fmtDateTime(e.created_at)}</TableCell>
                <TableCell>{e.user_email}</TableCell>
                <TableCell><Text font="monospace" size={200}>{e.action}</Text></TableCell>
                <TableCell>
                  <Text font="monospace" size={200} style={{ wordBreak: "break-all" }}>
                    {JSON.stringify(e.details)}
                  </Text>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
