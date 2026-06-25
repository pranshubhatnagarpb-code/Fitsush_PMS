import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Leaf } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill all fields'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setIsLoading(true);
    try {
      const { error } = await login(email, password);
      if (error) {
        if (error.message.includes('Load failed') || error.message.includes('fetch') || error.message.includes('network')) {
          toast.error('Network error', { description: 'Could not connect. Check your internet and try again.' });
        } else if (error.message.includes('Invalid login credentials')) {
          toast.error('Login failed', { description: 'Invalid email or password.' });
        } else {
          toast.error('Login failed', { description: error.message });
        }
      } else {
        toast.success('Welcome back!');
        navigate('/dashboard');
      }
    } catch {
      toast.error('Network error', { description: 'Could not connect to the server.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--sidebar-background))] flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10"
        style={{ background: 'hsl(var(--sidebar-background))' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/20 ring-1 ring-primary/30">
            <img src="/MKR Logo.webp" alt="MKR" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-wide">MKR CLINIC</p>
            <p className="text-[10px] text-[hsl(var(--sidebar-foreground))]">Practice Management</p>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Leaf className="h-4 w-4 text-[hsl(var(--primary))] opacity-80" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--sidebar-foreground)/0.5)]">Nutrition Practice</span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-3">
            Manage your<br />nutrition clinic<br />with clarity.
          </h2>
          <p className="text-sm text-[hsl(var(--sidebar-foreground))] leading-relaxed">
            Track clients, diet plans, appointments, blood reports, and more — all in one place.
          </p>
        </div>

        <p className="text-[11px] text-[hsl(var(--sidebar-foreground)/0.4)]">
          © 2026 Dr. Malika Kabra Rathi
        </p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <img src="/MKR Logo.webp" alt="MKR" className="w-10 h-6 object-contain" />
            <div>
              <p className="text-base font-bold text-foreground">MKR CLINIC</p>
              <p className="text-xs text-muted-foreground">Practice Management</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter your credentials to access the dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mkrclinic.in"
                className="h-10 bg-white border-border/80 focus-visible:ring-primary/30"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 pr-10 bg-white border-border/80 focus-visible:ring-primary/30"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 gradient-primary text-white font-semibold shadow-card hover:shadow-card-hover transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
