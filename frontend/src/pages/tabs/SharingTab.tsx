import {
  Avatar, Button, Card, Dropdown, Field, Input, Option, Table, TableBody,
  TableCell, TableHeader, TableHeaderCell, TableRow, Text, Title3,
} from "@fluentui/react-components";
import { DeleteRegular, PersonAddRegular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { Member, Project, User } from "../../types";

const ROLES = ["owner", "editor", "viewer"] as const;

export function SharingTab({ project, isOwner, user }: {
  project: Project; isOwner: boolean; user: User;
}) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("editor");
  const [error, setError] = useState("");

  const load = () => api.members(project.id).then(setMembers);
  useEffect(() => { load(); }, [project.id]);

  const add = async () => {
    setError("");
    try {
      setMembers(await api.upsertMember(project.id, email.trim(), role));
      setEmail("");
    } catch (e) { setError(String((e as Error).message)); }
  };

  const changeRole = async (m: Member, newRole: string) => {
    setError("");
    try { setMembers(await api.upsertMember(project.id, m.user.email, newRole)); }
    catch (e) { setError(String((e as Error).message)); }
  };

  const remove = async (m: Member) => {
    if (!window.confirm(t("sharing.removeConfirm"))) return;
    setError("");
    try { await api.removeMember(project.id, m.user.email); load(); }
    catch (e) { setError(String((e as Error).message)); }
  };

  return (
    <Card style={{ maxWidth: 720, padding: 20 }}>
      <Title3>{t("sharing.title")}</Title3>
      {isOwner && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", margin: "12px 0", flexWrap: "wrap" }}>
          <Field label={t("sharing.email")} style={{ flex: 1, minWidth: 220 }}>
            <Input type="email" value={email} onChange={(_, d) => setEmail(d.value)} />
          </Field>
          <Field label={t("common.role")}>
            <Dropdown value={t(`sharing.${role}`)} selectedOptions={[role]}
                      onOptionSelect={(_, d) => setRole(d.optionValue as string)} style={{ minWidth: 120 }}>
              {ROLES.map((r) => <Option key={r} value={r}>{t(`sharing.${r}`)}</Option>)}
            </Dropdown>
          </Field>
          <Button appearance="primary" icon={<PersonAddRegular />} onClick={add}
                  disabled={!email.includes("@")}>
            {t("sharing.add")}
          </Button>
        </div>
      )}
      {error && <Text style={{ color: "#d03b3b" }}>{error}</Text>}
      <Table size="small">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>{t("audit.user")}</TableHeaderCell>
            <TableHeaderCell>{t("common.role")}</TableHeaderCell>
            <TableHeaderCell />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.user.id}>
              <TableCell>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={m.user.name || m.user.email} size={24} />
                  <div>
                    <Text>{m.user.name || m.user.email}</Text>
                    <Text size={200} style={{ color: "#898781", display: "block" }}>{m.user.email}</Text>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {isOwner && m.user.id !== user.id ? (
                  <Dropdown value={t(`sharing.${m.role}`)} selectedOptions={[m.role]}
                            onOptionSelect={(_, d) => changeRole(m, d.optionValue as string)}
                            style={{ minWidth: 110 }}>
                    {ROLES.map((r) => <Option key={r} value={r}>{t(`sharing.${r}`)}</Option>)}
                  </Dropdown>
                ) : t(`sharing.${m.role}`)}
              </TableCell>
              <TableCell>
                {isOwner && m.user.id !== user.id && (
                  <Button appearance="subtle" icon={<DeleteRegular />} onClick={() => remove(m)}
                          aria-label="remove" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
