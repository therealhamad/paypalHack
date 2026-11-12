import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getMe,
  login as loginRequest,
  logout as logoutRequest,
  type RaisinUser,
} from "@/lib/raisinpay-api";

export const DEMO_USERS = [
  { email: "alex@raisinpay.demo", password: "demo1234", label: "Alex Rivera — preparer" },
  { email: "dana@raisinpay.demo", password: "demo1234", label: "Dana Chen — approver" },
] as const;

type SessionContextValue = {
  user: RaisinUser | null;
  loading: boolean;
  setUser: (user: RaisinUser | null) => void;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<RaisinUser>;
  signOut: () => Promise<void>;
  switchUser: (email: string, password: string) => Promise<RaisinUser>;
};

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: false,
  setUser: () => {},
  refresh: async () => {},
  signIn: async () => {
    throw new Error("Session provider is not mounted");
  },
  signOut: async () => {},
  switchUser: async () => {
    throw new Error("Session provider is not mounted");
  },
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<RaisinUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await getMe());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const signedIn = await loginRequest(email, password);
    setUser(signedIn);
    return signedIn;
  }, []);

  const signOut = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const switchUser = useCallback(
    async (email: string, password: string) => {
      await logoutRequest();
      return signIn(email, password);
    },
    [signIn],
  );

  const value = useMemo(
    () => ({ user, loading, setUser, refresh, signIn, signOut, switchUser }),
    [user, loading, refresh, signIn, signOut, switchUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// Defaults keep components usable without a provider (tests, isolated renders).
export function useSession() {
  return useContext(SessionContext);
}
