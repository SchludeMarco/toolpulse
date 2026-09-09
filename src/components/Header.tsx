import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isDemoMode } from "../lib/firebase";

const navItems = [
  { to: "/", label: "Feed" },
  { to: "/vergleich", label: "Vergleich" },
  { to: "/merkliste", label: "Merkliste" },
  { to: "/digest", label: "Wochen-Digest" },
  { to: "/notizen", label: "Notizblock" },
  { to: "/einstellungen", label: "Einstellungen" },
];

export function Header() {
  const { user, signIn, signOutUser } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="pulse-dot absolute inline-flex h-full w-full rounded-full text-[var(--amber)]" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--amber)]" />
          </span>
          <span className="display text-lg font-semibold tracking-tight">
            ToolPulse
          </span>
        </div>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `focus-ring rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-[var(--surface-raised)] text-[var(--text)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {isDemoMode && (
            <span className="hidden rounded-full border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--text-muted)] sm:inline-block">
              Demo-Modus
            </span>
          )}
          {user ? (
            <button
              onClick={signOutUser}
              className="focus-ring rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              Abmelden
            </button>
          ) : (
            <button
              onClick={signIn}
              className="focus-ring rounded-md bg-[var(--surface-raised)] px-3.5 py-1.5 text-sm font-medium hover:bg-[var(--line)]"
            >
              Mit Google anmelden
            </button>
          )}
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-[var(--line)] px-5 py-2 md:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `focus-ring whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
                isActive
                  ? "bg-[var(--surface-raised)] text-[var(--text)]"
                  : "text-[var(--text-muted)]"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
