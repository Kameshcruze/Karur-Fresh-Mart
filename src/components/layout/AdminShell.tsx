import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  CreditCard,
  Languages,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Settings,
  ShoppingBasket,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { lang, toggleLang, t } = useI18n();
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mobileMenuOpen]);

  const navItems = [
    { to: '/admin', label: t('admin.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/admin/orders', label: t('admin.orders'), icon: ClipboardList, end: false },
    { to: '/admin/live-carts', label: t('admin.liveCarts'), icon: ShoppingBasket, end: false },
    { to: '/admin/stock', label: t('admin.products'), icon: Boxes, end: false },
    { to: '/admin/combos', label: t('admin.combos'), icon: Layers, end: false },
    { to: '/admin/offers', label: t('admin.offers'), icon: QrCode, end: false },
    { to: '/admin/delivery', label: t('admin.delivery'), icon: Truck, end: false },
    { to: '/admin/customers', label: t('admin.customers'), icon: Users, end: false },
    { to: '/admin/payments', label: t('admin.payments'), icon: CreditCard, end: false },
    { to: '/admin/settings', label: t('admin.settings'), icon: Settings, end: false },
  ];

  const handleSignOut = async () => {
    await logoutUser();
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const renderNavLinks = (onItemClick?: () => void) => (
    <nav aria-label={t('a11y.adminNavAria')} className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onItemClick}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 min-h-[44px] px-3.5 py-2.5 rounded-[10px] text-sm font-medium transition-colors',
                isActive
                  ? 'bg-bright-green text-white font-semibold shadow-sm'
                  : 'text-white/80 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  const renderSidebarFooter = (onAction?: () => void) => (
    <div className="flex flex-col gap-2 p-4 border-t border-white/10">
      {user && (
        <div className="px-2 pb-1">
          <p className="text-xs font-semibold text-white truncate">{user.name}</p>
          <p className="text-[11px] text-white/85 tabular-nums">+91 {user.mobile}</p>
        </div>
      )}
      <button
        type="button"
        onClick={toggleLang}
        aria-label={t('header.languageLabel')}
        className="flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-[10px] bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors cursor-pointer"
      >
        <Languages className="w-4 h-4" aria-hidden="true" />
        <span>{lang === 'en' ? 'தமிழ் மொழியில் பார்' : 'Switch to English'}</span>
      </button>
      <Link
        to="/"
        onClick={onAction}
        className="flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-[10px] border border-white/20 hover:bg-white/10 text-xs font-medium text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>{t('nav.backToStore')}</span>
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        className="flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-[10px] border border-white/15 text-white/85 hover:bg-alert-red/20 hover:text-white text-xs font-medium transition-colors cursor-pointer"
      >
        <LogOut className="w-4 h-4" aria-hidden="true" />
        <span>{t('admin.signOut')}</span>
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-soft-grey text-dark-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-[8px] focus:bg-fresh-green focus:text-white focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        {t('a11y.skipToContent')}
      </a>
      {/* Desktop Deep Forest (#16281F) Sidebar */}
      <aside
        data-testid="admin-desktop-sidebar"
        className="hidden lg:flex lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-deep-forest text-white flex-col print:hidden"
      >
        <div className="px-5 py-5 border-b border-white/10">
          <p className="font-heading font-bold text-base tracking-tight text-white">
            {t('admin.portalTitle')}
          </p>
          <p className="text-xs text-white/85 mt-0.5">{t('admin.storeStatus')}</p>
        </div>

        {renderNavLinks()}
        {renderSidebarFooter()}
      </aside>

      {/* Mobile Compact Header + Collapsible Deep Forest Drawer */}
      <header className="lg:hidden bg-deep-forest text-white px-3 py-2.5 flex items-center justify-between gap-2 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="admin-mobile-sidebar"
            aria-label={t('admin.menuToggle')}
            data-testid="admin-mobile-menu-toggle"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[10px] bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
          <div className="min-w-0">
            <p className="font-heading font-bold text-sm text-white truncate">
              {t('admin.portalTitle')}
            </p>
            <p className="text-[11px] text-white/85 truncate">{t('admin.storeStatus')}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={toggleLang}
            aria-label={t('header.languageLabel')}
            className="min-h-[44px] px-2.5 rounded-[8px] bg-white/10 text-xs font-semibold text-white cursor-pointer"
          >
            {lang === 'en' ? 'தமிழ்' : 'EN'}
          </button>
          <Link
            to="/"
            className="min-h-[44px] px-2.5 inline-flex items-center gap-1 rounded-[8px] border border-white/20 text-xs font-medium text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden xs:inline">{t('nav.backToStore')}</span>
          </Link>
        </div>
      </header>

      {/* Mobile Collapsible Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex print:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={t('admin.closePanel')}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-dark-ink/50"
          />
          <aside
            id="admin-mobile-sidebar"
            data-testid="admin-mobile-sidebar"
            className="relative w-72 max-w-[85vw] bg-deep-forest text-white flex flex-col h-full shadow-xl z-10"
          >
            <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-heading font-bold text-sm text-white truncate">
                  {t('admin.portalTitle')}
                </p>
                <p className="text-[11px] text-white/85 truncate">{t('admin.storeStatus')}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label={t('admin.closePanel')}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[10px] hover:bg-white/10 text-white cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            {renderNavLinks(() => setMobileMenuOpen(false))}
            {renderSidebarFooter(() => setMobileMenuOpen(false))}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto print:p-0 print:max-w-none focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
