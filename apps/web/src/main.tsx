import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { LoginPage } from "./auth/LoginPage";
import { AppShell, RequireAuth } from "./layout/AppShell";
import { AuditPage } from "./pages/AuditPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DeadlinesPage } from "./pages/DeadlinesPage";
import { ImportPage } from "./pages/ImportPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PersonPage } from "./pages/PersonPage";
import { PersonsPage } from "./pages/PersonsPage";
import { PropertiesPage } from "./pages/PropertiesPage";
import { PropertyPage } from "./pages/PropertyPage";
import { RulesPage } from "./pages/RulesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UnitPage } from "./pages/UnitPage";
import "./ui/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Client errors (4xx) are final; only transient failures are retried.
      retry: (count, error) => {
        const status = (error as unknown as { status?: number }).status;
        return count < 2 && !(status && status < 500);
      },
      staleTime: 10_000,
    },
  },
});

// Every record has its own URL (V32): deep links and the browser back button work everywhere.
const router = createBrowserRouter([
  { path: "/anmelden", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "objekte", element: <PropertiesPage /> },
      { path: "objekte/:id", element: <PropertyPage /> },
      { path: "einheiten/:id", element: <UnitPage /> },
      { path: "personen", element: <PersonsPage /> },
      { path: "personen/:id", element: <PersonPage /> },
      { path: "fristen", element: <DeadlinesPage /> },
      { path: "import", element: <ImportPage /> },
      { path: "regeln", element: <RulesPage /> },
      { path: "audit", element: <AuditPage /> },
      { path: "einstellungen", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
