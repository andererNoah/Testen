import { Building2, CalendarClock, FileUp, Gauge, History, LogOut, Moon, Scale, Search, Settings, Sun, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { RouterProvider } from "react-aria-components";
import { NavLink, Navigate, Outlet, useHref, useLocation, useNavigate } from "react-router";
import { useMe } from "../api/queries";
import { clearSession, getToken } from "../auth/session";
import { Button, ErrorNotice, IconButton, Spinner } from "../ui/components";
import { CommandPalette } from "./CommandPalette";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  permission?: string;
  end?: boolean;
}

export const NAV: NavItem[] = [
  { to: "/", label: "Start", icon: <Gauge size={18} aria-hidden="true" />, end: true },
  { to: "/objekte", label: "Objekte", icon: <Building2 size={18} aria-hidden="true" />, permission: "masterdata.read" },
  { to: "/personen", label: "Personen", icon: <Users size={18} aria-hidden="true" />, permission: "persons.read" },
  { to: "/fristen", label: "Fristen", icon: <CalendarClock size={18} aria-hidden="true" />, permission: "deadlines.read" },
  { to: "/import", label: "Import", icon: <FileUp size={18} aria-hidden="true" />, permission: "import.run" },
  { to: "/regeln", label: "Regeln & Recht", icon: <Scale size={18} aria-hidden="true" />, permission: "rules.read" },
  { to: "/audit", label: "Audit-Log", icon: <History size={18} aria-hidden="true" />, permission: "audit.read" },
  { to: "/einstellungen", label: "Einstellungen", icon: <Settings size={18} aria-hidden="true" />, permission: "tenant.admin" },
];

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem("hv.theme") ?? "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("hv.theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const dark = theme === "dark" || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  return [dark ? "dark" : "light", () => setTheme(dark ? "light" : "dark")];
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (!getToken()) return <Navigate to={`/anmelden?weiter=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}

export function AppShell() {
  const navigate = useNavigate();
  const me = useMe();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (me.isPending) return <div className="content"><Spinner /></div>;
  if (me.isError) return <div className="content"><ErrorNotice error={me.error} /></div>;
  const perms = new Set(me.data.permissions);
  const nav = NAV.filter((n) => !n.permission || perms.has(n.permission));

  return (
    <RouterProvider navigate={(to) => navigate(to)} useHref={useHref}>
      <a className="skip-link" href="#main">
        Zum Inhalt springen
      </a>
      <div className="shell">
        <aside className="sidebar" aria-label="Hauptnavigation">
          <div className="brand">
            <img src="/favicon.svg" alt="" width={28} height={28} />
            <div>
              [PRODUKTNAME]
              <small>{me.data.tenant.name}</small>
            </div>
          </div>
          <nav className="nav">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.icon}
                {n.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="main">
          <header className="topbar">
            {/* Visible text is the accessible name (WCAG 2.5.3 Label in Name). */}
            <Button onPress={() => setPaletteOpen(true)} aria-keyshortcuts="Control+K">
              <Search size={16} aria-hidden="true" />
              Suchen oder springen …
              <kbd>Strg K</kbd>
            </Button>
            <div className="row">
              <IconButton label={theme === "dark" ? "Helles Design" : "Dunkles Design"} onPress={toggleTheme}>
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </IconButton>
              <div className="small" style={{ textAlign: "right" }}>
                <strong>{me.data.user.displayName}</strong>
                <div className="muted">{me.data.assignments.map((a) => a.roleName).filter((v, i, arr) => arr.indexOf(v) === i).join(", ")}</div>
              </div>
              <IconButton
                label="Abmelden"
                onPress={() => {
                  clearSession();
                  navigate("/anmelden");
                }}
              >
                <LogOut size={18} />
              </IconButton>
            </div>
          </header>
          <main id="main" className="content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette isOpen={paletteOpen} onOpenChange={setPaletteOpen} nav={nav} />
    </RouterProvider>
  );
}
