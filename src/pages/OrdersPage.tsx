import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  FileText,
  Package,
  RotateCcw,
  ShoppingBag,
} from 'lucide-react';
import { OrderStatusBadge } from '../components/orders/OrderStatusBadge';
import { Button, Card, ErrorStateCard, ListSkeleton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useI18n } from '../context/I18nContext';
import {
  getOrdersByUser,
  reorderOrder,
  subscribeToOrderUpdates,
} from '../services';
import type { Order } from '../types';
import { formatINR } from '../utils/format';
import { resolveProductImage } from '../utils/productImages';
import { PRODUCT_TINT_CLASSES } from '../utils/tints';

function formatOrderDate(iso: string, locale = 'en-IN'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function OrdersPage() {
  const { t, bi, lang } = useI18n();
  const { user } = useAuth();
  const { refresh: refreshCart } = useCart();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [reorderToast, setReorderToast] = useState('');

  const loadOrders = useCallback(async () => {
    const uid = user?.id ?? 'user-cust-1';
    setHasError(false);
    try {
      const list = await getOrdersByUser(uid);
      const sorted = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setOrders(sorted);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial load + live service event listener + polling fallback
  useEffect(() => {
    void loadOrders();
    const unsubscribe = subscribeToOrderUpdates(() => {
      void loadOrders();
    });
    const pollTimer = window.setInterval(() => {
      void loadOrders();
    }, 2500);

    return () => {
      unsubscribe();
      window.clearInterval(pollTimer);
    };
  }, [loadOrders]);

  const handleReorder = async (orderId: string) => {
    setReorderingId(orderId);
    setReorderToast('');
    try {
      const result = await reorderOrder(orderId);
      await refreshCart();
      if (result.skippedLines > 0) {
        setReorderToast(
          t('orders.reorderPartialNote', { skipped: result.skippedLines }),
        );
      }
      navigate('/cart');
    } finally {
      setReorderingId(null);
    }
  };

  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-dark-ink">
            {t('orders.historyTitle')}
          </h1>
          <p className="text-sm text-muted-text mt-0.5">
            {t('orders.historySubtitle')}
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fresh-green bg-light-green px-3 py-1.5 rounded-[10px]">
          <span className="w-2 h-2 rounded-full bg-fresh-green animate-pulse" />
          {t('orders.liveUpdatingNote')}
        </span>
      </div>

      {reorderToast && (
        <div
          role="status"
          className="rounded-[10px] bg-light-green border border-fresh-green/30 px-4 py-2.5 text-sm font-medium text-fresh-green"
        >
          {reorderToast}
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={3} rowHeightClass="h-36" />
      ) : hasError ? (
        <ErrorStateCard
          title={t('a11y.loadErrorTitle')}
          subtitle={t('a11y.loadErrorSubtitle')}
          retryLabel={t('a11y.retry')}
          onRetry={() => {
            setLoading(true);
            void loadOrders();
          }}
        />
      ) : orders.length === 0 ? (
        <Card className="max-w-lg mx-auto text-center py-12 space-y-4">
          <div className="w-14 h-14 rounded-[12px] bg-light-green text-fresh-green mx-auto flex items-center justify-center">
            <ShoppingBag className="w-7 h-7" aria-hidden="true" />
          </div>
          <h2 className="font-heading font-bold text-xl text-dark-ink">
            {t('orders.emptyTitle')}
          </h2>
          <p className="text-sm text-muted-text">{t('orders.emptySubtitle')}</p>
          <Link to="/" className="inline-block">
            <Button variant="primary" size="md">
              {t('orders.startShopping')}
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4" data-testid="orders-history-list">
          {orders.map((order) => {
            const totalUnits = order.items.reduce((sum, i) => sum + i.quantity, 0);
            const itemsSummary = order.items
              .map((i) => `${bi(i.name)} × ${i.quantity}`)
              .join(', ');

            return (
              <Card
                key={order.id}
                padding="md"
                data-testid={`order-card-${order.id}`}
                className="space-y-4"
              >
                {/* Card Top: Order No, Date, Status Chip, Total */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-border-grey/70">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/orders/${order.id}`}
                        className="font-heading font-bold text-base sm:text-lg text-dark-ink hover:text-fresh-green tabular-nums"
                      >
                        {t('orders.orderNumberLabel')} #{order.id}
                      </Link>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-muted-text tabular-nums">
                      {t('orders.placedOn', {
                        date: formatOrderDate(order.createdAt, locale),
                      })}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-text">{t('orders.totalLabel')}</p>
                    <p className="font-heading font-bold text-lg sm:text-xl text-dark-ink tabular-nums">
                      {formatINR(order.total)}
                    </p>
                  </div>
                </div>

                {/* Items Preview Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex -space-x-2 shrink-0">
                      {order.items.slice(0, 3).map((item) => {
                        const imgUrl = resolveProductImage(item.image);
                        const tintClass = PRODUCT_TINT_CLASSES[item.imageTint];
                        return (
                          <div
                            key={item.id}
                            className={`w-11 h-11 rounded-[10px] ${tintClass} border-2 border-white overflow-hidden flex items-center justify-center shadow-xs`}
                          >
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-4 h-4 text-fresh-green" aria-hidden="true" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-dark-ink">
                        {totalUnits === 1
                          ? t('orders.itemsCountSingle')
                          : t('orders.itemsCountPlural', { count: totalUnits })}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-text line-clamp-1 mt-0.5">
                        {itemsSummary}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons: Track, Reorder, Invoice */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link to={`/orders/${order.id}/invoice`}>
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<FileText className="w-4 h-4" />}
                      >
                        {t('orders.downloadInvoice')}
                      </Button>
                    </Link>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={reorderingId === order.id}
                      onClick={() => void handleReorder(order.id)}
                      leftIcon={<RotateCcw className="w-4 h-4" />}
                    >
                      {reorderingId === order.id
                        ? t('orders.reordering')
                        : t('orders.reorder')}
                    </Button>

                    <Link to={`/orders/${order.id}`}>
                      <Button
                        variant="primary"
                        size="sm"
                        rightIcon={<ArrowRight className="w-4 h-4" />}
                      >
                        {t('orders.trackOrder')}
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
