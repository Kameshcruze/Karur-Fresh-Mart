import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../context/I18nContext';
import { BottomNav } from './BottomNav';
import { Header } from './Header';
import { StickyCartBar } from './StickyCartBar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex flex-col bg-soft-grey text-dark-ink print:bg-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-[8px] focus:bg-deep-forest focus:text-white focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        {t('a11y.skipToContent')}
      </a>
      <div className="print:hidden">
        <Header />
      </div>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-32 md:pb-12 print:max-w-none print:p-0 focus:outline-none"
      >
        {children}
      </main>

      <footer className="hidden md:block print:hidden bg-white border-t border-border-grey mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-text">
          <div className="flex items-center gap-3">
            <span className="font-heading font-semibold text-dark-ink">
              {t('brand.name')}
            </span>
            <span aria-hidden="true">·</span>
            <span>{t('brand.locationDefault')}</span>
          </div>

          <div className="flex items-center gap-5">
            <Link to="/orders" className="hover:text-fresh-green transition-colors">
              {t('nav.orders')}
            </Link>
            <Link to="/shop" className="hover:text-fresh-green transition-colors">
              {t('nav.offers')}
            </Link>
            <Link to="/admin" className="hover:text-fresh-green transition-colors">
              {t('nav.adminPortal')}
            </Link>
            <Link to="/delivery" className="hover:text-fresh-green transition-colors">
              {t('nav.deliveryPortal')}
            </Link>
          </div>
        </div>
      </footer>

      <div className="print:hidden">
        <StickyCartBar />
        <BottomNav />
      </div>
    </div>
  );
}
