import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { CorivoLogo } from '../../components/ui/CorivoLogo.tsx';
import { Button, Card, DevelopmentModeNotice, FieldLabel, Input } from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiError } from '../../lib/api.ts';
import type { AuthSessionPayload } from '../../shared/types.ts';

interface DemoAccount {
  email: string;
  displayName: string;
  role: string;
  organisationName: string;
  status: string;
  devPassword: string;
}

function getPasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 10) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/[a-z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  const label = score <= 2 ? 'Weak' : score <= 4 ? 'Moderate' : 'Strong';
  return { score, label };
}

export function LoginPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const { notify } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);

  useEffect(() => {
    apiFetch<{ accounts: DemoAccount[] }>('/api/auth/demo-accounts')
      .then((res) => setDemoAccounts(res.accounts))
      .catch(() => {});
  }, []);

  const redirectAfterAuth = (session: AuthSessionPayload) => {
    if (session.user.isPlatformAdmin) {
      navigate('/platform');
    } else if (session.organisation && !session.organisation.onboardingComplete && session.membership?.roleKey === 'OWNER') {
      navigate('/onboarding/organisation');
    } else {
      navigate('/app/mail/inbox');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter both your business email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ session: AuthSessionPayload }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, rememberMe }),
      });
      await refreshSession();
      notify(`Signed in as ${res.session.user.displayName}`, 'success');
      redirectAfterAuth(res.session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (acc: DemoAccount) => {
    setEmail(acc.email);
    setPassword(acc.devPassword);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto">
        <div className="flex justify-center mb-6">
          <Link to="/">
            <CorivoLogo />
          </Link>
        </div>

        <Card className="p-6 sm:p-8">
          <h1 className="font-display text-xl font-bold text-[#14243A]">Sign in to Corivo Mail</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Access your business webmail workspace or organisation console.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-[#DC2626]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <FieldLabel htmlFor="login-email">Business Email</FieldLabel>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="razeen@corivotech.example"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="text-sm font-medium text-[#172033]">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs font-medium text-[#2563EB] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#64748B] hover:text-[#172033]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#64748B] cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 text-[#2563EB]"
              />
              <span>Keep me signed in for 14 days</span>
            </label>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-[#64748B]">
            New to Corivo Mail?{' '}
            <Link to="/signup" className="font-medium text-[#2563EB] hover:underline">
              Create an organisation account
            </Link>
          </p>
        </Card>

        {demoAccounts.length > 0 && (
          <Card className="mt-5 p-5">
            <DevelopmentModeNotice
              label="Development Demo Accounts"
              detail="Select any seeded persona below to populate credentials for local testing."
            />
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-[#2563EB] hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#172033] truncate">{acc.displayName}</p>
                    <p className="text-[11px] font-mono text-[#64748B] truncate">{acc.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-medium text-[#2563EB] block">{acc.role.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-[#94A3B8]">{acc.status === 'SUSPENDED' ? 'Suspended test' : acc.organisationName}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const { notify } = useToast();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    organisationName: '',
    country: 'India',
    acceptTerms: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = getPasswordStrength(form.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.acceptTerms) {
      setError('You must accept the Terms of Service and Privacy Policy.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      await refreshSession();
      notify('Organisation account created. Let us configure your domain.', 'success');
      navigate('/onboarding/organisation');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="max-w-lg w-full mx-auto">
        <div className="flex justify-center mb-6">
          <Link to="/">
            <CorivoLogo />
          </Link>
        </div>

        <Card className="p-6 sm:p-8">
          <h1 className="font-display text-xl font-bold text-[#14243A]">Create your Corivo Mail organisation</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Set up your owner account and onboard your business domain in a few steps.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-[#DC2626]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="reg-name">Full Name</FieldLabel>
                <Input
                  id="reg-name"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Razeen Iqbal"
                />
              </div>
              <div>
                <FieldLabel htmlFor="reg-org">Organisation Name</FieldLabel>
                <Input
                  id="reg-org"
                  value={form.organisationName}
                  onChange={(e) => setForm({ ...form, organisationName: e.target.value })}
                  placeholder="Corivo Technologies"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="reg-email">Business Email</FieldLabel>
                <Input
                  id="reg-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="owner@company.example"
                />
              </div>
              <div>
                <FieldLabel htmlFor="reg-country">Country</FieldLabel>
                <Input
                  id="reg-country"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="reg-pw" hint={form.password ? `Strength: ${strength.label}` : undefined}>
                Password
              </FieldLabel>
              <Input
                id="reg-pw"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 10 chars, upper, lower, number, symbol"
              />
            </div>

            <div>
              <FieldLabel htmlFor="reg-cpw">Confirm Password</FieldLabel>
              <Input
                id="reg-cpw"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              />
            </div>

            <label className="flex items-start gap-2.5 text-xs text-[#64748B] cursor-pointer">
              <input
                type="checkbox"
                checked={form.acceptTerms}
                onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-[#2563EB]"
              />
              <span>
                I accept the Corivo Mail Terms of Service, Acceptable Use Policy, and Privacy Policy.
              </span>
            </label>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Creating Organisation...' : 'Create Account & Continue'}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-[#64748B]">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-[#2563EB] hover:underline">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [responseMsg, setResponseMsg] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string; devResetToken?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setResponseMsg(res.message);
      if (res.devResetToken) setDevToken(res.devResetToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to process request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto">
        <div className="flex justify-center mb-6">
          <Link to="/"><CorivoLogo /></Link>
        </div>
        <Card className="p-6 sm:p-8">
          <KeyRound className="w-6 h-6 text-[#2563EB] mb-3" />
          <h1 className="font-display text-xl font-bold text-[#14243A]">Reset your password</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Enter your business email address to receive a password recovery link.
          </p>

          {error && <p className="mt-4 text-xs text-[#DC2626] bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

          {responseMsg ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
                {responseMsg}
              </div>
              {devToken && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                  <p className="font-semibold">Development Reset Link:</p>
                  <Link
                    to={`/reset-password?token=${devToken}`}
                    className="text-[#2563EB] underline font-mono break-all mt-1 block"
                  >
                    /reset-password?token={devToken}
                  </Link>
                </div>
              )}
              <Link to="/login" className="block">
                <Button variant="outline" className="w-full">Back to Sign In</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <FieldLabel htmlFor="fp-email">Business Email</FieldLabel>
                <Input
                  id="fp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="razeen@corivotech.example"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send Reset Link'}
              </Button>
              <Link to="/login" className="block text-center text-xs text-[#64748B] hover:text-[#172033]">
                Return to Sign In
              </Link>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError('Missing or expired password reset token.');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      notify('Password updated successfully. Sign in with your new password.', 'success');
      navigate('/login');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto">
        <div className="flex justify-center mb-6">
          <Link to="/"><CorivoLogo /></Link>
        </div>
        <Card className="p-6 sm:p-8">
          <ShieldCheck className="w-6 h-6 text-[#2563EB] mb-3" />
          <h1 className="font-display text-xl font-bold text-[#14243A]">Choose a new password</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Must be at least 10 characters with uppercase, lowercase, number, and symbol.
          </p>

          {!token && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-[#DC2626]">
              Reset token is missing or invalid. Request a new password reset link.
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-[#DC2626]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <FieldLabel htmlFor="rp-pw" hint={password ? `Strength: ${strength.label}` : undefined}>
                New Password
              </FieldLabel>
              <Input id="rp-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="rp-cpw">Confirm Password</FieldLabel>
              <Input id="rp-cpw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting || !token}>
              {submitting ? 'Updating Password...' : 'Reset Password'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
