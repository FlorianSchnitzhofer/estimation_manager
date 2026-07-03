import {
  Avatar, Button, Text, Tooltip,
} from "@fluentui/react-components";
import {
  DataTrendingRegular, FolderRegular, SettingsRegular, LocalLanguageRegular,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { setLanguage } from "../i18n";
import type { User } from "../types";

export function Layout({ user, children }: { user: User; children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();

  const navItems = [
    { to: "/", icon: <FolderRegular />, label: t("app.projects"), active: !location.pathname.startsWith("/admin") },
    ...(user.is_admin
      ? [{ to: "/admin", icon: <SettingsRegular />, label: t("app.admin"), active: location.pathname.startsWith("/admin") }]
      : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header style={{
        display: "flex", alignItems: "center", gap: 16, padding: "0 20px", height: 48,
        background: "#0b0b0b", color: "#fff", position: "sticky", top: 0, zIndex: 100,
      }}>
        <DataTrendingRegular fontSize={22} />
        <Text weight="semibold" size={400} style={{ color: "#fff" }}>{t("app.title")}</Text>
        <div style={{ flex: 1 }} />
        <Tooltip content={i18n.language === "de" ? "Switch to English" : "Auf Deutsch wechseln"} relationship="label">
          <Button appearance="transparent" icon={<LocalLanguageRegular style={{ color: "#fff" }} />}
                  style={{ color: "#fff", minWidth: 0 }}
                  onClick={() => setLanguage(i18n.language === "de" ? "en" : "de")}>
            {i18n.language.toUpperCase()}
          </Button>
        </Tooltip>
        <Tooltip content={`${user.name} (${user.email})${user.is_admin ? " — Admin" : ""}`} relationship="label">
          <Avatar name={user.name || user.email} size={28} color="neutral" />
        </Tooltip>
      </header>
      <div style={{ display: "flex", flex: 1 }}>
        <nav style={{
          width: 200, background: "#fff", borderRight: "1px solid #e1e0d9",
          padding: "16px 8px", display: "flex", flexDirection: "column", gap: 4,
        }}>
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} style={{ textDecoration: "none" }}>
              <Button appearance={item.active ? "primary" : "subtle"} icon={item.icon}
                      style={{ width: "100%", justifyContent: "flex-start" }}>
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>
        <main style={{ flex: 1, padding: 24, maxWidth: 1400, minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}
