import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  UserCog,
  Utensils,
  ChefHat,
  Ruler,
  FlaskConical,
  CalendarDays,
  Database,
  ShoppingBag,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from './DashboardLayout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    ],
  },
  {
    label: 'Clients',
    items: [
      { title: 'Clients', icon: Users, path: '/clients' },
      { title: 'Appointments', icon: CalendarDays, path: '/appointments' },
      { title: 'Blood Reports', icon: FlaskConical, path: '/blood-reports' },
      { title: 'Body Measurements', icon: Ruler, path: '/body-measurements' },
    ],
  },
  {
    label: 'Diet & Nutrition',
    items: [
      { title: 'Diet Section', icon: Utensils, path: '/diet-section' },
      { title: 'Diet Chart Templates', icon: FileText, path: '/templates' },
      { title: 'AI Recipes', icon: ChefHat, path: '/recipes' },
      { title: 'Meal Recipes', icon: Database, path: '/meal-recipes-import' },
    ],
  },
  {
    label: 'Business',
    items: [
      { title: 'Affiliate Products', icon: ShoppingBag, path: '/affiliate-products' },
      { title: 'Employee', icon: UserCog, path: '/employees' },
    ],
  },
];

export const AppSidebar = () => {
  const { logout, user } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'FS';

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden bg-white shadow-card"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Desktop menu button (shown when sidebar is closed) */}
      {!isSidebarOpen && (
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 left-4 z-50 hidden lg:flex shadow-card"
          onClick={() => setIsSidebarOpen(true)}
          title="Open Sidebar"
        >
          <Menu className="h-4 w-4" />
        </Button>
      )}

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 transition-transform duration-300 flex flex-col shadow-sidebar",
          "bg-[hsl(var(--sidebar-background))]",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          isSidebarOpen ? "lg:translate-x-0" : "lg:-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--sidebar-border))]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[hsl(var(--primary)/0.2)] ring-1 ring-[hsl(var(--primary)/0.3)]">
              <img
                src="/fitsush-logo.webp"
                alt="Fitsush"
                className="w-5 h-5 object-contain"
              />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white tracking-wide leading-none">FITSUSH</p>
              <p className="text-[10px] text-[hsl(var(--sidebar-foreground))] mt-0.5 leading-none">Practice Management</p>
            </div>
          </div>
          <button
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md text-[hsl(var(--sidebar-foreground))] hover:text-white hover:bg-[hsl(var(--sidebar-accent))] transition-colors"
            onClick={() => setIsSidebarOpen(false)}
            title="Close Sidebar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--sidebar-foreground)/0.5)]">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 relative group",
                        isActive
                          ? "bg-[hsl(var(--sidebar-accent))] text-white"
                          : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent)/0.6)] hover:text-[hsl(var(--sidebar-accent-foreground))]"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[hsl(var(--sidebar-primary))] rounded-r-full" />
                      )}
                      <item.icon className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive ? "text-[hsl(var(--sidebar-primary))]" : "text-[hsl(var(--sidebar-foreground)/0.7)] group-hover:text-[hsl(var(--sidebar-accent-foreground))]"
                      )} />
                      <span>{item.title}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User & Logout */}
        <div className="px-2.5 py-3 border-t border-[hsl(var(--sidebar-border))]">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(30,92%,54%)] flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-white">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-white truncate leading-none">
                {user?.email?.split('@')[0] ?? 'User'}
              </p>
              <p className="text-[10px] text-[hsl(var(--sidebar-foreground))] mt-0.5 truncate leading-none">
                {user?.email ?? ''}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 px-2.5 py-2 w-full rounded-lg text-[13px] font-medium text-[hsl(var(--sidebar-foreground))] hover:bg-red-500/10 hover:text-red-400 transition-colors mt-0.5"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
