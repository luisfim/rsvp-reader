import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  getAuthRedirectUrl,
  isSupabaseConfigured,
  supabase,
} from "../lib/supabase";

interface AuthResult {
  error: string | null;
  needsEmailConfirmation?: boolean;
}

interface AuthContextValue {
  configured: boolean;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  deleteAccount: (confirmation: string) => Promise<AuthResult>;
  clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (!error) {
        setSession(data.session);
      }

      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);

      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      }

      if (event === "SIGNED_OUT") {
        setIsPasswordRecovery(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      isLoading,
      isPasswordRecovery,
      session,
      user: session?.user ?? null,

      async signIn(email, password) {
        if (!supabase) {
          return { error: "Authentication is not configured yet." };
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        return { error: error?.message ?? null };
      },

      async signUp(email, password) {
        if (!supabase) {
          return { error: "Authentication is not configured yet." };
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthRedirectUrl("/auth/confirmed"),
          },
        });

        return {
          error: error?.message ?? null,
          needsEmailConfirmation: !error && !data.session,
        };
      },

      async requestPasswordReset(email) {
        if (!supabase) {
          return { error: "Authentication is not configured yet." };
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getAuthRedirectUrl("/auth/reset"),
        });

        return { error: error?.message ?? null };
      },

      async updatePassword(password) {
        if (!supabase) {
          return { error: "Authentication is not configured yet." };
        }

        const { error } = await supabase.auth.updateUser({ password });

        if (!error) {
          setIsPasswordRecovery(false);
        }

        return { error: error?.message ?? null };
      },

      async signOut() {
        if (!supabase) {
          return { error: "Authentication is not configured yet." };
        }

        const { error } = await supabase.auth.signOut();

        return { error: error?.message ?? null };
      },

      async deleteAccount(confirmation) {
        if (!supabase) {
          return { error: "Authentication is not configured yet." };
        }

        const { data, error } = await supabase.functions.invoke<
          { success?: boolean; error?: string }
        >("delete-account", {
          body: { confirmation },
        });

        if (error) {
          return {
            error:
              "The account deletion service could not be reached. " +
              "Confirm that the delete-account Edge Function is deployed.",
          };
        }

        if (!data?.success) {
          return {
            error: data?.error ?? "The account could not be deleted.",
          };
        }

        await supabase.auth.signOut({ scope: "local" });
        setSession(null);
        setIsPasswordRecovery(false);

        return { error: null };
      },

      clearPasswordRecovery() {
        setIsPasswordRecovery(false);
      },
    }),
    [isLoading, isPasswordRecovery, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
