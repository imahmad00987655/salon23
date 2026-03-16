import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Scissors, Eye, EyeOff, Mail, Lock, Sparkles } from "lucide-react";

const LoginPage = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    setLoading(true);
    try {
      const err = await login(trimmedEmail, password);
      if (err) setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.15),transparent)]" />
      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-primary/5 to-transparent" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Card */}
        <div className="bg-card/95 backdrop-blur-sm border border-border/80 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden">
          {/* Top accent */}
          <div className="h-1.5 bg-gradient-to-r from-primary via-primary to-primary/80" />

          <div className="p-8 sm:p-10">
            {/* Branding */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center rounded-2xl p-1.5 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-inner mb-5">
                <img
                  src="/brand.jpeg"
                  alt="Sheeza saloon"
                  className="h-20 w-20 rounded-xl object-cover"
                />
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-primary text-primary-foreground shadow-md">
                  <Scissors className="h-4 w-4" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-foreground">
                  Sheeza saloon
                </h1>
              </div>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary/70" />
                Sign in to your account
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div
                  className="bg-destructive/10 text-destructive text-sm rounded-xl px-4 py-3 font-medium border border-destructive/20 flex items-center gap-2"
                  role="alert"
                >
                  <span className="flex-1">{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-medium text-foreground block">
                  Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-background/50 text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder="you@stillwater.salon"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="login-password" className="text-sm font-medium text-foreground block">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    className="w-full pl-10 pr-11 py-3 rounded-xl border border-input bg-background/50 text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/25 hover:shadow-primary/30 hover:bg-primary/95 active:scale-[0.99] transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none disabled:scale-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3.5 w-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground/80">
              Secure access for staff and management
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
