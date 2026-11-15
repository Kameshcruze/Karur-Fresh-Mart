import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShoppingBasket,
} from 'lucide-react';
import { Badge, Button, Card, ProductImage } from '../../components/ui';
import { useI18n } from '../../context/I18nContext';
import {
  getAllUserCarts,
  getCartReminders,
  getRegisteredUsers,
  saveUserCartReminder,
  subscribeToCartUpdates,
} from '../../services';
import type { Cart, CartSummary, DeliverySlotId, User } from '../../types';
import { formatINR } from '../../utils/format';

interface EnrichedLiveCart {
  userId: string;
  customerName: string;
  customerMobile: string;
  cart: Cart;
  summary: CartSummary;
  lastReminderAt?: string;
}

export function AdminLiveCartsPage() {
  const { t, bi, lang } = useI18n();
  const [carts, setCarts] = useState<EnrichedLiveCart[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [sendingForUser, setSendingForUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [rawCarts, users, reminders] = await Promise.all([
      getAllUserCarts(),
      getRegisteredUsers(),
      getCartReminders(),
    ]);

    const userMap = new Map<string, User>();
    for (const u of users) {
      userMap.set(u.id, u);
    }

    const enriched: EnrichedLiveCart[] = rawCarts
      .map((entry) => {
        const matched = userMap.get(entry.userId);
        return {
          userId: entry.userId,
          customerName: matched?.name ?? `Karur Customer (${entry.userId})`,
          customerMobile: matched?.mobile ?? '—',
          cart: entry.cart,
          summary: entry.summary,
          lastReminderAt: reminders[entry.userId],
        };
      })
      .sort(
        (a, b) =>
          new Date(b.cart.updatedAt).getTime() - new Date(a.cart.updatedAt).getTime(),
      );

    setCarts(enriched);
    setSelectedUserId((prev) => {
      if (prev && enriched.some((c) => c.userId === prev)) return prev;
      return enriched[0]?.userId ?? null;
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
    const unsub = subscribeToCartUpdates(() => void loadData());
    const interval = window.setInterval(() => void loadData(), 2500);
    return () => {
      unsub();
      window.clearInterval(interval);
    };
  }, [loadData]);

  const selectedCart = useMemo(
    () => carts.find((c) => c.userId === selectedUserId) ?? null,
    [carts, selectedUserId],
  );

  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';
  const formatActivityTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));

  const slotLabel = (slot: DeliverySlotId): string => {
    switch (slot) {
      case 'today_evening':
        return t('cart.slotTodayEvening');
      case 'tomorrow_morning':
        return t('cart.slotTomorrowMorning');
      case '45min':
      default:
        return t('cart.slot45Min');
    }
  };

  const handleSendReminder = async (target: EnrichedLiveCart) => {
    setSendingForUser(target.userId);
    await saveUserCartReminder(target.userId);
    await loadData();
    setSendingForUser(null);
    const message = t('admin.reminderSentToast', {
      name: target.customerName,
      mobile: target.customerMobile,
    });
    setToastMsg(message);
    setTimeout(() => {
      setToastMsg((prev) => (prev === message ? null : prev));
    }, 4000);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl text-dark-ink">
            {t('admin.liveCartsTitle')}
          </h1>
          <p className="text-sm text-muted-text mt-0.5">{t('admin.liveCartsSubtitle')}</p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-light-green text-fresh-green text-xs font-semibold shrink-0">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          <span>{t('admin.liveAutoBadge')}</span>
        </div>
      </div>

      {toastMsg && (
        <div
          role="status"
          data-testid="live-cart-reminder-toast"
          className="flex items-center gap-2 px-4 py-3 rounded-[12px] bg-light-green border border-fresh-green/30 text-fresh-green text-sm font-semibold"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{toastMsg}</span>
        </div>
      )}

      {isLoading ? (
        <Card className="h-64 animate-pulse bg-white/80" />
      ) : carts.length === 0 ? (
        <Card className="py-12 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-[12px] bg-light-green text-fresh-green mx-auto flex items-center justify-center">
            <ShoppingBasket className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="font-heading font-bold text-lg text-dark-ink">
            {t('admin.noLiveCartsTitle')}
          </h2>
          <p className="text-sm text-muted-text max-w-md mx-auto">
            {t('admin.noLiveCartsSubtitle')}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Customer Carts Table */}
          <Card padding="none" className="lg:col-span-7 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-soft-grey border-b border-border-grey text-xs uppercase tracking-wide text-muted-text">
                    <th className="py-3 px-4 font-semibold">{t('admin.colCustomer')}</th>
                    <th className="py-3 px-4 font-semibold">{t('admin.colCartItems')}</th>
                    <th className="py-3 px-4 font-semibold">{t('admin.colCartValue')}</th>
                    <th className="py-3 px-4 font-semibold">{t('admin.colLastActivity')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-grey/70">
                  {carts.map((entry) => {
                    const isSelected = entry.userId === selectedUserId;
                    return (
                      <tr
                        key={entry.userId}
                        data-testid={`live-cart-row-${entry.userId}`}
                        onClick={() => setSelectedUserId(entry.userId)}
                        className={[
                          'cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-light-green/55'
                            : 'hover:bg-soft-grey/70',
                        ].join(' ')}
                      >
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-dark-ink">{entry.customerName}</p>
                          <p className="text-xs text-muted-text tabular-nums">
                            +91 {entry.customerMobile}
                          </p>
                          {entry.lastReminderAt && (
                            <Badge tone="yellow" className="mt-1">
                              {t('admin.reminderSentLabel')}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-dark-ink tabular-nums">
                          {entry.summary.totalUnits}{' '}
                          <span className="text-muted-text">
                            (
                            {entry.summary.itemCount === 1
                              ? t('common.itemCountSingle')
                              : t('common.itemCountPlural', {
                                  count: entry.summary.itemCount,
                                })}
                            )
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-heading font-bold text-dark-ink tabular-nums">
                          {formatINR(entry.summary.grandTotal)}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-muted-text tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{formatActivityTime(entry.cart.updatedAt)}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Side Panel: Selected Customer's Separate Cart */}
          <Card
            data-testid="live-cart-detail-panel"
            className="lg:col-span-5 space-y-4"
          >
            {!selectedCart ? (
              <p className="text-sm text-muted-text py-8 text-center">
                {t('admin.selectCartHint')}
              </p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-border-grey">
                  <div>
                    <h2 className="font-heading font-bold text-lg text-dark-ink">
                      {t('admin.selectedCartTitle', { name: selectedCart.customerName })}
                    </h2>
                    <p className="text-xs text-muted-text tabular-nums mt-0.5">
                      +91 {selectedCart.customerMobile} ·{' '}
                      {formatActivityTime(selectedCart.cart.updatedAt)}
                    </p>
                  </div>
                  <Badge tone="green">{slotLabel(selectedCart.summary.deliverySlot)}</Badge>
                </div>

                {/* Items inside this customer's separate basket */}
                <ul className="divide-y divide-border-grey/70">
                  {selectedCart.summary.lines.map((line) => (
                    <li key={line.cartItem.lineId} className="py-3 first:pt-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <ProductImage
                            tint={line.imageTint}
                            image={line.image}
                            alt={bi(line.title)}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-dark-ink truncate">
                              {bi(line.title)}
                            </p>
                            <p className="text-xs text-muted-text">
                              {line.subtitle} × {line.cartItem.quantity}
                            </p>
                          </div>
                        </div>
                        <span className="font-heading font-bold text-sm text-dark-ink tabular-nums shrink-0">
                          {formatINR(line.lineTotal)}
                        </span>
                      </div>

                      {line.comboBrandBreakdown && line.comboBrandBreakdown.length > 0 && (
                        <div className="pl-14 text-[11px] text-muted-text leading-relaxed">
                          {line.comboBrandBreakdown
                            .map((b) => `${bi(b.groupName)}: ${b.brandName}`)
                            .join(' · ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                {/* Totals */}
                <div className="rounded-[10px] bg-soft-grey p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-dark-ink">
                    <span>{t('cart.itemTotal')}</span>
                    <span className="font-semibold tabular-nums">
                      {formatINR(selectedCart.summary.subtotal)}
                    </span>
                  </div>
                  {selectedCart.summary.couponDiscount > 0 && (
                    <div className="flex justify-between text-fresh-green">
                      <span>
                        {t('cart.couponDiscount', {
                          code: selectedCart.summary.couponCode ?? '',
                        })}
                      </span>
                      <span className="font-semibold tabular-nums">
                        -{formatINR(selectedCart.summary.couponDiscount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-dark-ink">
                    <span>{t('cart.deliveryFee')}</span>
                    <span className="font-semibold tabular-nums">
                      {selectedCart.summary.deliveryFee === 0
                        ? t('cart.free')
                        : formatINR(selectedCart.summary.deliveryFee)}
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-border-grey flex justify-between items-baseline text-sm">
                    <span className="font-heading font-bold text-dark-ink">
                      {t('admin.colCartValue')}
                    </span>
                    <span className="font-heading font-bold text-base text-dark-ink tabular-nums">
                      {formatINR(selectedCart.summary.grandTotal)}
                    </span>
                  </div>
                </div>

                {/* Send Reminder Action */}
                <div className="space-y-2 pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    fullWidth
                    data-testid="send-cart-reminder-btn"
                    disabled={sendingForUser === selectedCart.userId}
                    onClick={() => handleSendReminder(selectedCart)}
                    leftIcon={<BellRing className="w-4 h-4" />}
                  >
                    {t('admin.sendReminderCta')}
                  </Button>
                  {selectedCart.lastReminderAt && (
                    <p className="text-[11px] text-fresh-green font-medium text-center tabular-nums">
                      {t('admin.reminderSentLabel')}:{' '}
                      {formatActivityTime(selectedCart.lastReminderAt)}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-text text-center">
                    {t('admin.reminderMockNote')}
                  </p>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
