import {
  Badge, Spinner, Tab, TabList, Title2,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";

import { api } from "../api";
import type { Meta, Project, User } from "../types";
import { AuditTab } from "./tabs/AuditTab";
import { DocumentsTab } from "./tabs/DocumentsTab";
import { EstimationTab } from "./tabs/EstimationTab";
import { SessionsTab } from "./tabs/SessionsTab";
import { SharingTab } from "./tabs/SharingTab";

export function ProjectPage({ meta, user }: { meta: Meta; user: User }) {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const tab = searchParams.get("tab") ?? "estimation";
  const setTab = (value: string) => setSearchParams({ tab: value }, { replace: true });

  useEffect(() => { api.project(id).then(setProject); }, [id]);

  if (!project) return <Spinner size="large" style={{ marginTop: 80 }} />;

  const canEdit = project.my_role === "owner" || project.my_role === "editor";
  const isOwner = project.my_role === "owner";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Title2>{project.name}</Title2>
        {project.client && <Badge appearance="outline">{project.client}</Badge>}
        {project.my_role && <Badge appearance="tint">{t(`sharing.${project.my_role}`)}</Badge>}
      </div>
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as string)}
               style={{ marginBottom: 16 }}>
        <Tab value="estimation">{t("tabs.estimation")}</Tab>
        <Tab value="sessions">{t("tabs.sessions")}</Tab>
        <Tab value="documents">{t("tabs.documents")}</Tab>
        <Tab value="sharing">{t("tabs.sharing")}</Tab>
        <Tab value="audit">{t("tabs.audit")}</Tab>
      </TabList>

      {tab === "estimation" && (
        <EstimationTab project={project} setProject={setProject} meta={meta} canEdit={canEdit} />
      )}
      {tab === "sessions" && <SessionsTab project={project} meta={meta} canEdit={canEdit} isOwner={isOwner} />}
      {tab === "documents" && <DocumentsTab project={project} setProject={setProject} canEdit={canEdit} />}
      {tab === "sharing" && <SharingTab project={project} isOwner={isOwner} user={user} />}
      {tab === "audit" && <AuditTab projectId={project.id} />}
    </div>
  );
}
