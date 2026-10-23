import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setAccessToken } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get("/auth/me/")
      .then(({ data }) => {
        if (active) setUser(data);
      })
      .catch(() => {
        setAccessToken(null);
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const clearSession = () => {
      setAccessToken(null);
      setUser(null);
      setLoading(false);
    };
    window.addEventListener("vetcare:session-expired", clearSession);
    return () => {
      active = false;
      window.removeEventListener("vetcare:session-expired", clearSession);
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(credentials) {
        const { data } = await api.post("/auth/login/", credentials);
        setAccessToken(data.access);
        setUser(data.user);
      },
      async logout() {
        try {
          await api.post("/auth/logout/");
        } finally {
          setAccessToken(null);
          setUser(null);
        }
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
