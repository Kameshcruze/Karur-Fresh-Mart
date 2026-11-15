import { ChevronRight, ShoppingBag } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useI18n } from '../../context/I18nContext';
import { formatINR } from '../../utils/format';

export function StickyCartBar() {
  const { summary } = useCart();
  const { t } = useI18n();
  const location = useLocation();

  // Hide on cart, checkout, product detail, and combo pages (which have their own fixed bottom action bars)
  const hiddenPaths = ['/cart', '/checkout'];
  if (
    summary.totalUnits <= 0 ||
    hiddenPaths.includes(location.pathname) ||
    location.pathname.startsWith('/product/') ||
    location.pathname.startsWith('/combo/')
  ) {
    return null;
  }

  return (
    <div className="md:hidden fixed bottom-[68px] left-3 right-3 z-35 pointer-events-none">
      <Link
        to="/cart"
        className="pointer-events-auto flex items-center justify-between gap-3 w-full min-h-[48px] px-4 py-2 rounded-[12px] bg-fresh-green text-white shadow-[0_6px_20px_rgba(27,138,75,0.32)] active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-[8px] bg-white/15 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-white/90 truncate">
              {summary.totalUnits === 1
                ? t('common.itemCountSingle')
                : t('common.itemCountPlural', { count: summary.totalUnits })}
            </span>
            <span className="text-sm font-bold tabular-nums leading-tight">
              {formatINR(summary.subtotal)}
            </span>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-sm font-semibold whitespace-nowrap shrink-0">
          <span>{t('stickyCart.viewCart')}</span>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </span>
      </Link>
    </div>
  );
}
