import React from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, History, Languages, Truck, User } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useI18n } from '../../context/I18nContext';

export function DeliveryShell({ children }: { children: React.ReactNode }) {
  const { lang, toggleLang, t } = useI18n();

  const navItems = [
    { to: '/delivery', label: t('delivery.activeTasks'), icon: Truck, end: true },
    { to: '/delivery/orders', label: t('delivery.orderQueue'), icon: ClipboardList, end: false },
    { to: '/delivery/history', label: t('delivery.history'), icon: History, end: false },
    { to: '/delivery/profile', label: t('delivery.profile'), icon: User, end: false },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-soft-grey text-dark-ink">
      <header className="sticky top-0 z-30 bg-dark-ink text-white border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              aria-label={t('nav.backToStore')}
              className="min-w-[44px] min-h-[44px] rounded-[10px] bg-white/10 hover:bg-white/15 inline-flex items-center justify-center shrink-0 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </Link>
            <div className="min-w-0">
              <p className="font-heading font-bold text-base truncate">
                {t('delivery.portalTitle')}
              </p>
              <p className="text-xs text-bright-green inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('delivery.dutyOnline')}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleLang}
            aria-label={t('header.languageLabel')}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-[10px] bg-white/10 hover:bg-white/15 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Languages className="w-4 h-4" aria-hidden="true" />
            <span>{lang === 'en' ? 'தமிழ்' : 'English'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-5 pb-24 sm:pb-10">
        {children}
      </main>

      <nav
        aria-label="Delivery partner navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border-grey pb-safe"
      >
        <div className="max-w-4xl mx-auto grid grid-cols-4 h-[60px]">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-1 text-[11px] transition-colors',
                    isActive ? 'text-fresh-green font-semibold' : 'text-muted-text hover:text-dark-ink',
                  ].join(' ')
                }
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="truncate max-w-full">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
