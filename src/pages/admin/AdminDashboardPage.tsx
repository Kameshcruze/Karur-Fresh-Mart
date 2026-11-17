import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  IndianRupee,
  PackageCheck,
  Plus,
  ShoppingBag,
  ShoppingBasket,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, ErrorStateCard, ListSkeleton, ProductImage } from '../../components/ui';
import { useI18n } from '../../context/I18nContext';
import {
  adjustProductStock,
  computeAdminDashboardStats,
  computeLowStockProducts,
  computeTopProducts,
  computeWeeklyOrdersSeries,
  getAllUserCarts,
  getOrders,
  getProducts,
  getTotalAvailableQty,
  subscribeToCartUpdates,
  subscribeToCatalogUpdates,
  subscribeToOrderUpdates,
} from '../../services';
import type { CartSummary, Order, Product } from '../../types';
import { formatINR } from '../../utils/format';

export function AdminDashboardPage() {
  const { t, bi } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [userCarts, setUserCarts] = useState<Array<{ userId: string; summary: CartSummary }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [restockingId, setRestockingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [ordersList, productsList, cartsList] = await Promise.all([
        getOrders(),
        getProducts({ includeHidden: true }),
        getAllUserCarts(),
      ]);
      setOrders(ordersList);
      setProducts(productsList);
      setUserCarts(cartsList);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const unsubOrders = subscribeToOrderUpdates(() => void loadData());
    const unsubCarts = subscribeToCartUpdates(() => void loadData());
    const unsubCatalog = subscribeToCatalogUpdates(() => void loadData());
    return () => {
      unsubOrders();
      unsubCarts();
      unsubCatalog();
    };
  }, [loadData]);

  const stats = useMemo(
    () => computeAdminDashboardStats(orders, userCarts),
    [orders, userCarts],
  );
  const weeklySeries = useMemo(
    () => computeWeeklyOrdersSeries(orders),
    [orders],
  );
  const maxWeeklyOrders = useMemo(
    () => Math.max(1, ...weeklySeries.map((d) => d.ordersCount)),
    [weeklySeries],
  );
  const lowStockProducts = useMemo(
    () => computeLowStockProducts(products, 5),
    [products],
  );
  const topProducts = useMemo(
    () => computeTopProducts(orders, products, 5),
    [orders, products],
  );

  const handleQuickRestock = async (prod: Product) => {
    setRestockingId(prod.id);
    await adjustProductStock(prod.id, prod.stockQty + 5, prod.reservedQty);
    await loadData();
    setRestockingId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <ListSkeleton rows={4} rowHeightClass="h-24" />
      </div>
    );
  }

  if (hasError) {
    return (
      <ErrorStateCard
        title={t('a11y.loadErrorTitle')}
        subtitle={t('a11y.loadErrorSubtitle')}
        retryLabel={t('a11y.retry')}
        onRetry={() => void loadData()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="font-heading font-bold text-2xl text-dark-ink">
            {t('admin.dashboard')}
          </h1>
          <p className="text-sm text-muted-text mt-0.5">{t('admin.storeStatus')}</p>
        </div>
        <Link to="/admin/orders">
          <Button
            type="button"
            variant="primary"
            size="sm"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            {t('admin.orders')}
          </Button>
        </Link>
      </div>

      {/* 4 Stat Cards */}
      <section
        aria-label={t('admin.storeMetricsAria')}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <Card data-testid="stat-todays-orders" className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-text">
              {t('admin.statTodaysOrders')}
            </p>
            <p className="font-heading font-bold text-3xl text-dark-ink mt-1.5 tabular-nums">
              {stats.todaysOrders}
            </p>
            <p className="text-xs text-fresh-green font-medium mt-1">
              {t('admin.statTodaysRevenueHint', {
                amount: formatINR(stats.todaysRevenue),
              })}
            </p>
          </div>
          <div className="w-11 h-11 rounded-[12px] bg-light-green text-fresh-green flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" aria-hidden="true" />
          </div>
        </Card>

        <Card data-testid="stat-revenue" className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-text">
              {t('admin.statRevenue')}
            </p>
            <p className="font-heading font-bold text-3xl text-dark-ink mt-1.5 tabular-nums">
              {formatINR(stats.totalRevenue)}
            </p>
            <p className="text-xs text-muted-text mt-1 tabular-nums">
              {t('admin.statTodaysRevenueHint', {
                amount: formatINR(stats.todaysRevenue),
              })}
            </p>
          </div>
          <div className="w-11 h-11 rounded-[12px] bg-warm-yellow/25 text-dark-ink flex items-center justify-center shrink-0">
            <IndianRupee className="w-5 h-5" aria-hidden="true" />
          </div>
        </Card>

        <Card data-testid="stat-pending-deliveries" className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-text">
              {t('admin.statPendingDeliveries')}
            </p>
            <p className="font-heading font-bold text-3xl text-dark-ink mt-1.5 tabular-nums">
              {stats.pendingDeliveries}
            </p>
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-1 text-xs font-semibold text-fresh-green hover:underline mt-1"
            >
              <span>{t('admin.orders')}</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="w-11 h-11 rounded-[12px] bg-tint-dairy text-dark-ink flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" aria-hidden="true" />
          </div>
        </Card>

        <Card data-testid="stat-active-carts" className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-text">
              {t('admin.statActiveCarts')}
            </p>
            <p className="font-heading font-bold text-3xl text-dark-ink mt-1.5 tabular-nums">
              {stats.activeCartsCount}
            </p>
            <Link
              to="/admin/live-carts"
              className="inline-flex items-center gap-1 text-xs font-semibold text-fresh-green hover:underline mt-1 tabular-nums"
            >
              <span>
                {t('admin.statActiveCartsValueHint', {
                  amount: formatINR(stats.activeCartsValue),
                })}
              </span>
            </Link>
          </div>
          <div className="w-11 h-11 rounded-[12px] bg-light-green text-fresh-green flex items-center justify-center shrink-0">
            <ShoppingBasket className="w-5 h-5" aria-hidden="true" />
          </div>
        </Card>
      </section>

      {/* Weekly Orders Bar Chart */}
      <Card data-testid="weekly-orders-chart" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] bg-light-green text-fresh-green flex items-center justify-center">
              <BarChart3 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-lg text-dark-ink">
                {t('admin.weeklyChartTitle')}
              </h2>
              <p className="text-xs text-muted-text">{t('admin.weeklyChartSubtitle')}</p>
            </div>
          </div>
        </div>

        <div className="pt-3">
          <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-52 border-b border-border-grey pb-3">
            {weeklySeries.map((point) => {
              const heightPct = Math.max(
                10,
                Math.round((point.ordersCount / maxWeeklyOrders) * 100),
              );
              return (
                <div
                  key={point.dateKey}
                  className="flex flex-col items-center justify-end h-full gap-1.5"
                  title={`${point.dayLabel}: ${point.ordersCount} ${t('admin.ordersUnit')} (${formatINR(point.revenue)})`}
                >
                  <span className="text-xs font-bold text-dark-ink tabular-nums">
                    {point.ordersCount}
                  </span>
                  <div className="w-full max-w-[44px] flex-1 flex items-end">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={[
                        'w-full rounded-t-[8px] transition-all duration-300',
                        point.isToday
                          ? 'bg-fresh-green'
                          : 'bg-bright-green/75 hover:bg-bright-green',
                      ].join(' ')}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7 gap-2 sm:gap-4 pt-2 text-center">
            {weeklySeries.map((point) => (
              <div key={`${point.dateKey}-lbl`}>
                <p
                  className={[
                    'text-xs font-semibold',
                    point.isToday ? 'text-fresh-green font-bold' : 'text-dark-ink',
                  ].join(' ')}
                >
                  {point.dayLabel}
                </p>
                <p className="text-[11px] text-muted-text tabular-nums hidden sm:block">
                  {formatINR(point.revenue)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Low-stock alerts + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Low-stock alerts */}
        <Card data-testid="low-stock-alerts" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-[10px] bg-alert-red-soft text-alert-red flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-heading font-bold text-lg text-dark-ink">
                  {t('admin.lowStockTitle')}
                </h2>
                <p className="text-xs text-muted-text">{t('admin.lowStockSubtitle')}</p>
              </div>
            </div>
            <Link
              to="/admin/stock"
              className="text-xs font-semibold text-fresh-green hover:underline shrink-0"
            >
              {t('admin.manageStockCta')}
            </Link>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="rounded-[10px] bg-light-green/60 px-4 py-6 text-center space-y-1">
              <PackageCheck className="w-6 h-6 text-fresh-green mx-auto" aria-hidden="true" />
              <p className="text-sm font-medium text-dark-ink">{t('admin.lowStockHealthy')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border-grey/70">
              {lowStockProducts.slice(0, 6).map((prod) => {
                const avail = getTotalAvailableQty(prod);
                return (
                  <li
                    key={prod.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ProductImage
                        tint={prod.imageTint}
                        image={prod.image}
                        alt={bi(prod.name)}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-dark-ink truncate">
                          {bi(prod.name)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-text">{prod.packSize}</span>
                          <Badge tone="red">
                            {avail === 0
                              ? t('common.outOfStock')
                              : t('common.lowStock', { count: avail })}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={restockingId === prod.id}
                      onClick={() => handleQuickRestock(prod)}
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      className="shrink-0"
                    >
                      {t('admin.restockPlus5')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Top products */}
        <Card data-testid="top-products-card" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-[10px] bg-light-green text-fresh-green flex items-center justify-center">
                <TrendingUp className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-heading font-bold text-lg text-dark-ink">
                  {t('admin.topProductsTitle')}
                </h2>
                <p className="text-xs text-muted-text">{t('admin.topProductsSubtitle')}</p>
              </div>
            </div>
          </div>

          <ul className="divide-y divide-border-grey/70">
            {topProducts.map((item, idx) => (
              <li
                key={item.productId}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-soft-grey border border-border-grey text-xs font-bold text-dark-ink flex items-center justify-center shrink-0 tabular-nums">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-dark-ink truncate">
                      {bi(item.name)}
                    </p>
                    <p className="text-xs text-muted-text tabular-nums">
                      {t('admin.unitsSoldLabel', { count: item.unitsSold })}
                    </p>
                  </div>
                </div>
                <span className="font-heading font-bold text-sm text-dark-ink tabular-nums shrink-0">
                  {formatINR(item.revenue)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
