import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { CorivoLogo } from '../ui/CorivoLogo.tsx';
import { Button } from '../ui/Primitives.tsx';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
      isActive
        ? 'text-[#2563EB]'
        : 'text-[#64748B] hover:text-[#14243A]'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC] text-[#172033]">
      {/* Strict 3-zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <Link to="/" className="whitespace-nowrap shrink-0">
            <CorivoLogo />
          </Link>

          <nav className="hidden md:flex items-center gap-7" aria-label="Main navigation">
            <NavLink to="/" end className={navLinkClass}>
              Product
            </NavLink>
            <NavLink to="/features" className={navLinkClass}>
              Features
            </NavLink>
            <NavLink to="/security" className={navLinkClass}>
              Security
            </NavLink>
            <NavLink to="/pricing" className={navLinkClass}>
              Pricing
            </NavLink>
            <NavLink to="/support" className={navLinkClass}>
              Support
            </NavLink>
          </nav>

          <div className="hidden md:flex items-center gap-4 shrink-0">
            {session ? (
              <Link to={session.user.isPlatformAdmin ? '/platform' : '/app/mail/inbox'}>
                <Button size="sm">Open Workspace</Button>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-[#172033] hover:text-[#2563EB] transition-colors whitespace-nowrap shrink-0"
                >
                  Sign In
                </Link>
                <Link to="/signup">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-[#64748B] hover:text-[#14243A] hover:bg-slate-100"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3">
            <div className="flex flex-col space-y-2.5">
              <Link to="/" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-[#172033] py-1">Product</Link>
              <Link to="/features" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-[#172033] py-1">Features</Link>
              <Link to="/security" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-[#172033] py-1">Security</Link>
              <Link to="/pricing" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-[#172033] py-1">Pricing</Link>
              <Link to="/support" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-[#172033] py-1">Support</Link>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
              {session ? (
                <Link
                  to={session.user.isPlatformAdmin ? '/platform' : '/app/mail/inbox'}
                  onClick={() => setMobileOpen(false)}
                  className="w-full"
                >
                  <Button className="w-full">Open Workspace</Button>
                </Link>
              ) : (
                <>
                  <Link to="/login" className="flex-1">
                    <Button variant="outline" className="w-full">Sign In</Button>
                  </Link>
                  <Link to="/signup" className="flex-1">
                    <Button className="w-full">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-[#14243A] text-slate-300 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <CorivoLogo inverse />
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Professional Business Email, Simplified. Built by Corivo Tech for organisations across India and global teams.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/features" className="hover:text-white transition-colors">Webmail Workspace</Link></li>
                <li><Link to="/features" className="hover:text-white transition-colors">Domain &amp; DNS Setup</Link></li>
                <li><Link to="/security" className="hover:text-white transition-colors">Spam &amp; DKIM Controls</Link></li>
                <li><Link to="/pricing" className="hover:text-white transition-colors">Illustrative Plans</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Access</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/login" className="hover:text-white transition-colors">Workspace Sign In</Link></li>
                <li><Link to="/signup" className="hover:text-white transition-colors">Create Organisation</Link></li>
                <li><Link to="/support" className="hover:text-white transition-colors">Support &amp; DNS Guides</Link></li>
                <li><Link to="/forgot-password" className="hover:text-white transition-colors">Password Recovery</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Governance</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>Timezone Default: Asia/Kolkata</li>
                <li>Tenant-Isolated Architecture</li>
                <li>DPDP Act 2023 Ready Design</li>
                <li><Link to="/security" className="hover:text-white transition-colors">Security &amp; DPA Overview</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} Corivo Tech. Corivo Mail — Professional Business Email, Simplified.</p>
            <p>Pricing and local mail adapters are illustrative in development mode.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
