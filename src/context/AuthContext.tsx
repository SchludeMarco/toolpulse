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
    await signInWithPopup(auth, googleProvider);
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
      value={{ user, loading, isDemoMode, signIn, signOutUser }}
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
