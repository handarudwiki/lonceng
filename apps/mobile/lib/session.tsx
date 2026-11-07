import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, clearTokens, getRefreshToken, onSessionLost, restoreTokens, setSchool, storeTokens } from "./api";
import { registerForPush, unregisterPush } from "./push";

export type School = { id: string; name: string; timezone: string; roleLabels: string[]; isGuardian: boolean; isStaff: boolean; isCounselor: boolean };
export type Child = { id: string; name: string; identifier: string | null; schoolId: string; classGroup: string | null };
export type Profile = { user: { id: string; name: string; email: string | null; phone: string | null }; schools: School[]; children: Child[] };
export type Mode = "teacher" | "guardian";

type Session = {
  loading: boolean;
  profile: Profile | null;
  school: School | null;
  mode: Mode | null;
  child: Child | null;
  children: Child[];
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectSchool: (id: string) => void;
  selectChild: (child: Child) => void;
  setMode: (mode: Mode) => void;
  reload: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);
const SCHOOL_KEY = "lonceng.school";

export function SessionProvider({ children: tree }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [mode, setModeState] = useState<Mode | null>(null);

  const applySchool = useCallback((p: Profile, wanted: string | null) => {
    const school = p.schools.find((s) => s.id === wanted) ?? p.schools[0] ?? null;
    setSchoolId(school?.id ?? null);
    setSchool(school?.id ?? null);
    setModeState(school ? (school.isStaff ? "teacher" : "guardian") : null);
    setChildId(p.children.find((c) => c.schoolId === school?.id)?.id ?? null);
  }, []);

  const reload = useCallback(async () => {
    const p = await api<Profile>("/me");
    setProfile(p);
    return p;
  }, []);

  useEffect(() => {
    onSessionLost(() => setProfile(null));
    (async () => {
      try {
        if (await restoreTokens()) {
          const p = await api<Profile>("/me");
          setProfile(p);
          applySchool(p, await AsyncStorage.getItem(SCHOOL_KEY));
          void registerForPush();
        }
      } catch {
        // Offline at launch: fall through to the login screen.
      } finally {
        setLoading(false);
      }
    })();
  }, [applySchool]);

  const value = useMemo<Session>(() => {
    const school = profile?.schools.find((s) => s.id === schoolId) ?? null;
    const kids = profile?.children.filter((c) => c.schoolId === schoolId) ?? [];
    return {
      loading,
      profile,
      school,
      mode,
      children: profile?.children ?? [],
      child: kids.find((c) => c.id === childId) ?? kids[0] ?? null,
      signIn: async (identifier, password) => {
        const res = await api<{ accessToken: string; refreshToken: string; profile: Profile }>("/auth/login", { body: { identifier, password } });
        await storeTokens(res.accessToken, res.refreshToken);
        setProfile(res.profile);
        applySchool(res.profile, await AsyncStorage.getItem(SCHOOL_KEY));
        void registerForPush();
      },
      signOut: async () => {
        const pushToken = await unregisterPush();
        const refreshToken = getRefreshToken();
        if (refreshToken) await api("/auth/logout", { body: { refreshToken, pushToken } }).catch(() => undefined);
        await clearTokens();
        setProfile(null);
      },
      selectSchool: (id) => {
        void AsyncStorage.setItem(SCHOOL_KEY, id);
        if (profile) applySchool(profile, id);
      },
      // MW-02: a child can sit at a different school, so picking one follows it there.
      selectChild: (child) => {
        if (child.schoolId !== schoolId) {
          setSchoolId(child.schoolId);
          setSchool(child.schoolId);
        }
        setChildId(child.id);
        setModeState("guardian");
      },
      setMode: setModeState,
      reload: async () => {
        await reload();
      },
    };
  }, [loading, profile, schoolId, childId, mode, applySchool, reload]);

  return <SessionContext.Provider value={value}>{tree}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession di luar SessionProvider");
  return value;
}
