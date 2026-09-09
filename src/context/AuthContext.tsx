import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider, isDemoMode } from "../lib/firebase";

interface AuthState {
  user: User | { uid: string; displayName: string; photoURL: string | null } | null;
  loading: boolean;
  isDemoMode: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const DEMO_USER = {
  uid: "demo-user",
  displayName: "Demo-Nutzer",
  photoURL: null as string | null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState["user"]>(null);
  const [loading, setLoading] = useState(!isDemoMode);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode || !auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async () => {
    if (isDemoMode || !auth || !googleProvider) {
      setUser(DEMO_USER);
      return;
    }
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Google-Anmeldung fehlgeschlagen:", e);
      const code = (e as { code?: string })?.code;
      setAuthError(
        code === "auth/unauthorized-domain"
          ? "Diese Domain ist in Firebase noch nicht als autorisierte Domain für die Anmeldung eingetragen (Authentication → Einstellungen → Autorisierte Domains)."
          : code === "auth/popup-blocked"
            ? "Der Anmelde-Popup wurde vom Browser blockiert. Bitte Popups für diese Seite erlauben und erneut versuchen."
            : code === "auth/popup-closed-by-user"
              ? null
              : `Anmeldung fehlgeschlagen (${code ?? "unbekannter Fehler"}).`
      );
    }
  };

  const signOutUser = async () => {
    if (isDemoMode || !auth) {
      setUser(null);
      return;
    }
    await fbSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, isDemoMode, authError, signIn, signOutUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von AuthProvider stehen");
  return ctx;
}
