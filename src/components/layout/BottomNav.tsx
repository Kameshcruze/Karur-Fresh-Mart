import { Grid2X2, Home, ShoppingBag, Tag, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useI18n } from '../../context/I18nContext';

export function BottomNav() {
  const { t } = useI18n();
  const { summary } = useCart();

  const items = [
    { to: '/', label: t('nav.home'), icon: Home, end: true },
    { to: '/category/rice-grains', label: t('nav.categories'), icon: Grid2X2, end: false },
    { to: '/shop', label: t('nav.offers'), icon: Tag, end: false },
    { to: '/cart', label: t('nav.cart'), icon: ShoppingBag, badge: summary.totalUnits, end: false },
    { to: '/account', label: t('nav.account'), icon: User, end: false },
  ];

  return (
    <nav
      aria-label={t('a11y.mobileBottomAria')}
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-border-grey pb-safe"
    >
      <div className="grid grid-cols-5 h-[60px]">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'relative flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] px-1 transition-colors',
                  isActive ? 'text-fresh-green font-semibold' : 'text-muted-text hover:text-dark-ink',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon
                      className="w-5 h-5"
                      strokeWidth={isActive ? 2.4 : 1.9}
                      aria-hidden="true"
                    />
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-warm-yellow text-dark-ink text-[10px] font-bold flex items-center justify-center tabular-nums">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] leading-tight truncate max-w-full">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
