import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/hooks";
import AuthScreen from "@/components/AuthScreen";
import Dashboard from "@/components/Dashboard";

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">
        <div className="w-6 h-6 border-2 border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session?.user) {
    return <AuthScreen />;
  }

  return (
    <Dashboard
      userId={session.user.id}
      email={session.user.email}
      onSignOut={async () => {
        await supabase.auth.signOut();
      }}
    />
  );
}
