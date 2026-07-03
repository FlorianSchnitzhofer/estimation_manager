import { Spinner, Text } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";

import { api } from "./api";
import { Layout } from "./components/Layout";
import { AdminPage } from "./pages/AdminPage";
import { ProjectPage } from "./pages/ProjectPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import type { Meta, User } from "./types";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Auto-login: the API signs in AUTO_LOGIN_USER (silent SSO / dev bypass)
    // when no bearer token is present.
    Promise.all([api.me(), api.meta()])
      .then(([u, m]) => { setUser(u); setMeta(m); })
      .catch((e) => setError(String(e.message || e)));
  }, []);

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <Text size={500} weight="semibold">Anmeldung fehlgeschlagen / sign-in failed</Text>
        <p><Text>{error}</Text></p>
      </div>
    );
  }
  if (!user || !meta) {
    return <div style={{ display: "grid", placeItems: "center", height: "100vh" }}><Spinner size="large" /></div>;
  }

  return (
    <Layout user={user}>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/projects/:id/*" element={<ProjectPage meta={meta} user={user} />} />
        <Route path="/admin" element={<AdminPage meta={meta} user={user} />} />
      </Routes>
    </Layout>
  );
}
