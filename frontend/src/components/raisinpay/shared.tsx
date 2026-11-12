import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  Command,
  CreditCard,
  FileText,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Workflow,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { LogOut, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEMO_USERS, useSession } from "@/lib/session";

const roleLabel = (role: string) => (role === "APPROVER" ? "Approver" : "Preparer");

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "U";

const mainNavigation = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Transactions", href: "/transactions", icon: FileText },
  { label: "Approvals", href: "/approvals", icon: ShieldCheck },
  { label: "Lifecycle canvas", href: "/workflow", icon: Workflow },
  { label: "AI assistant", href: "/assistant", icon: Sparkles },
] as const;

type RaisinPayLayoutProps = {
  children: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function RaisinPayLayout({ children, title, description, action }: RaisinPayLayoutProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useSession();
  const workspaceName = user?.companyName || "Workspace";

  return (
    <div className="rp-app-shell">
      <aside
        className={cn(
          "rp-sidebar",
          collapsed && "rp-sidebar-collapsed",
          mobileOpen && "rp-sidebar-mobile-open",
        )}
      >
        <div className="rp-brand-row">
          <Link to="/" className="rp-brand-mark" aria-label="RaisinPay overview">
            <img src="/logo.png" alt="RaisinPay logo" className="rp-logo-glyph" />
            {!collapsed && (
              <span className="rp-brand-name">
                raisin<span>pay</span>
              </span>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="rp-collapse-button hidden md:inline-flex"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            <PanelLeftClose
              className={cn("size-4 transition-transform", collapsed && "rotate-180")}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rp-collapse-button md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </Button>
        </div>

        {!collapsed && (
          <button
            type="button"
            className="rp-workspace-switcher"
            aria-label={`Current workspace: ${workspaceName}`}
          >
            <span className="rp-workspace-avatar">{initialsOf(workspaceName)}</span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-semibold">{workspaceName}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                Finance workspace
              </span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        )}
        {collapsed && (
          <div className="rp-workspace-avatar mx-auto mt-5" title={workspaceName}>
            {initialsOf(workspaceName)}
          </div>
        )}

        <div className="rp-nav-section-label">WORKSPACE</div>
        <nav className="rp-navigation" aria-label="Main navigation">
          {mainNavigation.map(({ label, href, icon: Icon }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={label}
                to={href}
                onClick={() => setMobileOpen(false)}
                className={cn("rp-nav-link", active && "rp-nav-link-active")}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
              >
                <Icon className="size-[17px] shrink-0" strokeWidth={1.8} />
                {!collapsed && <span>{label}</span>}
                {!collapsed && label === "Approvals" && <span className="rp-nav-count">—</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <>
            <div className="rp-nav-section-label rp-nav-section-secondary">TOOLS</div>
            <Link
              to="/payments/new"
              onClick={() => setMobileOpen(false)}
              className="rp-nav-link"
              title="New payment"
            >
              <CreditCard className="size-[17px] shrink-0" strokeWidth={1.8} />
              <span>New payment</span>
              <Plus className="ml-auto size-3.5 text-muted-foreground" />
            </Link>
          </>
        )}

        <div className="mt-auto">
          <div className="rp-nav-divider" />
          <Link to="/settings" className="rp-nav-link rp-bottom-link" title="Workspace settings">
            <Settings2 className="size-[17px] shrink-0" strokeWidth={1.8} />
            {!collapsed && <span>Workspace settings</span>}
          </Link>
          <UserSwitcher collapsed={collapsed} />
        </div>
      </aside>

      {mobileOpen && (
        <button
          className="rp-mobile-scrim md:hidden"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="rp-main-column">
        <header className="rp-topbar">
          <Button
            variant="ghost"
            size="icon"
            className="rp-topbar-icon md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
          <div className="rp-breadcrumb">
            <span>{workspaceName}</span>
            <span className="rp-breadcrumb-divider">/</span>
            <span className="font-medium text-foreground">{title}</span>
          </div>
          <div className="rp-topbar-actions">
            <button type="button" className="rp-help-button" aria-label="Help center">
              <CircleHelp className="size-4" />
              <span className="hidden sm:inline">Help center</span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="rp-topbar-icon rp-notification-button"
              aria-label="Notifications"
            >
              <Bell className="size-[17px]" strokeWidth={1.8} />
              <span className="rp-notification-dot" />
            </Button>
            <span className="rp-topbar-divider" />
            {user ? (
              <span className="rp-topbar-avatar" title={`${user.name} · ${roleLabel(user.role)}`}>
                {initialsOf(user.name)}
              </span>
            ) : null}
          </div>
        </header>

        <main className="rp-page-content">
          <div className="rp-page-heading">
            <div className="min-w-0">
              <p className="rp-page-eyebrow">
                <span className="rp-live-dot" /> FINANCE OPERATIONS
              </p>
              <h1 className="rp-page-title">{title}</h1>
              <p className="rp-page-description">{description}</p>
            </div>
            <div className="rp-page-actions">{action}</div>
          </div>
          {children}
        </main>
        <footer className="rp-footer">
          <span>RAISINPAY</span>
          <span>Secure payment operations</span>
          <span className="rp-footer-secure">
            <ShieldCheck className="size-3.5" /> Protected workspace
          </span>
        </footer>
      </div>
    </div>
  );
}

function UserSwitcher({ collapsed }: { collapsed: boolean }) {
  const { user, signOut, switchUser } = useSession();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <div className="rp-user-switcher">
      <button
        type="button"
        className="rp-profile-row"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="rp-profile-avatar">{initialsOf(user.name)}</span>
        {!collapsed && (
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[12px] font-semibold">{user.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {roleLabel(user.role)}
            </span>
          </span>
        )}
        {!collapsed && (
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        )}
      </button>
      {open && (
        <div className="rp-user-menu" role="menu">
          <p className="rp-user-menu-label">Switch demo user (maker-checker)</p>
          {DEMO_USERS.map((demo) => (
            <button
              key={demo.email}
              type="button"
              role="menuitem"
              className="rp-user-menu-item"
              onClick={() => {
                setOpen(false);
                void switchUser(demo.email, demo.password);
              }}
            >
              <Repeat className="size-3.5" />
              <span className="min-w-0 flex-1 text-left">{demo.label}</span>
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className="rp-user-menu-item rp-user-menu-signout"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
          >
            <LogOut className="size-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function SectionLabel({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="rp-section-label">
      <h2>{children}</h2>
      {trailing}
    </div>
  );
}

export function EmptyState({
  icon: Icon = WalletCards,
  title,
  description,
  action,
}: {
  icon?: typeof WalletCards;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rp-empty-state">
      <div className="rp-empty-icon">
        <Icon className="size-5" strokeWidth={1.7} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rp-error-state" role="alert">
      <span className="rp-error-icon">
        <ArrowDownLeft className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Couldn’t load your data</p>
        <p className="mt-1 break-words text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function LoadingLine({ label = "Loading your workspace" }: { label?: string }) {
  return (
    <div className="rp-loading-line" role="status">
      <span className="rp-loading-spinner" />
      {label}
    </div>
  );
}

export function StatusPill({ value }: { value: string }) {
  const normalized = value.trim().toLowerCase().replaceAll("_", " ");
  let style = "neutral";
  if (/paid|complete|approved|sent|received|success/.test(normalized)) style = "success";
  else if (/overdue|reject|critical|failed|error/.test(normalized)) style = "danger";
  else if (/pending|await|review|process|draft|warning/.test(normalized)) style = "warning";
  else if (/low|clear|info/.test(normalized)) style = "info";
  return (
    <span className={`rp-status-pill rp-status-${style}`}>
      <span className="rp-status-dot" />
      {normalized || "Not set"}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  note,
  icon,
  tone = "indigo",
}: {
  label: string;
  value: string;
  note: string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <div className="rp-metric-card">
      <div className="flex items-center justify-between gap-3">
        <span className="rp-metric-label">{label}</span>
        <span className={`rp-metric-icon rp-metric-icon-${tone}`}>{icon}</span>
      </div>
      <p className="rp-metric-value">{value}</p>
      <p className="rp-metric-note">{note}</p>
    </div>
  );
}

export function ArrowAction({
  href,
  children,
}: {
  href: "/transactions" | "/approvals" | "/assistant";
  children: ReactNode;
}) {
  return (
    <Link to={href} className="rp-text-link">
      {children}
      <ArrowRight className="size-3.5" />
    </Link>
  );
}

export function EmptyChart({ label = "Not enough activity yet" }: { label?: string }) {
  return (
    <div className="rp-chart-empty">
      <div className="rp-chart-bars" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <span>{label}</span>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="rp-search-wrap">
      <Search className="size-4" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}

export function PageTitleIcon({ children }: { children: ReactNode }) {
  return <span className="rp-page-icon">{children}</span>;
}

export function KeyboardHint() {
  return (
    <span className="rp-keyboard-hint">
      <Command className="size-3" /> K
    </span>
  );
}

export function TrendIndicator({ value }: { value: string }) {
  return (
    <span className="rp-trend-indicator">
      <ArrowUpRight className="size-3.5" />
      {value}
    </span>
  );
}

export function CheckMark() {
  return <Check className="size-3.5" />;
}

export function AssistantNavIcon() {
  return <MessageSquareText className="size-4" />;
}
