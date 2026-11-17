import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  History,
  Languages,
  Power,
  Truck,
  User,
} from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import type { DeliveryPartnerProfile } from '../../mock/users';
import {
  getDeliveryPartners,
  resolvePartnerForUser,
  subscribeToDeliveryPartnerUpdates,
  togglePartnerDutyStatus,
} from '../../services';

export function DeliveryShell({ children }: { children: React.ReactNode }) {
  const { lang, toggleLang, t } = useI18n();
  const { user } = useAuth();

  const [partner, setPartner] = useState<DeliveryPartnerProfile | undefined>(undefined);
  const [isToggling, setIsToggling] = useState(false);

  const loadPartner = useCallback(async () => {
    const partners = await getDeliveryPartners();
    setPartner(resolvePartnerForUser(user?.id, user?.mobile, partners));
  }, [user?.id, user?.mobile]);

  useEffect(() => {
    void loadPartner();
    return subscribeToDeliveryPartnerUpdates(() => {
      void loadPartner();
    });
  }, [loadPartner]);

  const handleToggleDuty = async () => {
    if (!partner || isToggling) return;
    setIsToggling(true);
    try {
      const next = await togglePartnerDutyStatus(partner.id, !partner.isAvailable);
      setPartner(resolvePartnerForUser(user?.id, user?.mobile, next));
    } finally {
      setIsToggling(false);
    }
  };

  const isOnDuty = partner?.isAvailable ?? true;

  const navItems = [
    { to: '/delivery', label: t('delivery.activeTasks'), icon: Truck, end: true },
    { to: '/delivery/orders', label: t('delivery.orderQueue'), icon: ClipboardList, end: false },
    { to: '/delivery/history', label: t('delivery.history'), icon: History, end: false },
    { to: '/delivery/profile', label: t('delivery.profile'), icon: User, end: false },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-soft-grey text-dark-ink">
      {/* Deep Forest (#16281F) phone-first header with interactive On duty chip */}
      <header className="sticky top-0 z-30 bg-deep-forest text-white border-b border-white/10 shadow-xs">
        <div className="max-w-lg mx-auto px-3.5 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              to="/"
              aria-label={t('nav.backToStore')}
              className="min-w-[40px] min-h-[40px] rounded-[10px] bg-white/10 hover:bg-white/15 inline-flex items-center justify-center shrink-0 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </Link>
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm sm:text-base leading-tight truncate">
                {partner?.name ?? user?.name ?? t('delivery.portalTitle')}
              </p>
              <p className="text-[11px] text-white/70 truncate">
                {partner?.vehicleNumber ? `${partner.vehicleNumber} · ` : ''}
                {t('delivery.portalTitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleDuty}
              disabled={isToggling}
              aria-label={t('delivery.dutyToggleAria')}
              aria-pressed={isOnDuty}
              data-testid="delivery-duty-chip"
              className={[
                'inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap',
                isOnDuty
                  ? 'bg-bright-green/20 text-bright-green border-bright-green/40 hover:bg-bright-green/30'
                  : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/15',
              ].join(' ')}
            >
              {isOnDuty ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Power className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{isOnDuty ? t('delivery.dutyOnline') : t('delivery.dutyOffline')}</span>
            </button>

            <button
              type="button"
              onClick={toggleLang}
              aria-label={t('header.languageLabel')}
              className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-[10px] bg-white/10 hover:bg-white/15 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{lang === 'en' ? 'தமிழ்' : 'EN'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-3.5 py-4 pb-24">
        {children}
      </main>

      <nav
        aria-label="Delivery partner navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border-grey pb-safe shadow-lg"
      >
        <div className="max-w-lg mx-auto grid grid-cols-4 h-[62px]">
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
                    isActive
                      ? 'text-fresh-green font-semibold'
                      : 'text-muted-text hover:text-dark-ink',
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
