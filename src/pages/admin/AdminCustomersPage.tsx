import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Package, Search, Users, X } from 'lucide-react';
import { Badge, Card } from '../../components/ui';
import { useI18n } from '../../context/I18nContext';
import {
  getAddresses,
  getAllUserCarts,
  getOrders,
  getRegisteredUsers,
} from '../../services';
import type { Address, CartSummary, Order, User } from '../../types';
import { formatINR } from '../../utils/format';

export function AdminCustomersPage() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [carts, setCarts] = useState<Array<{ userId: string; summary: CartSummary }>>([]);
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [userList, orderList, cartList, addrList] = await Promise.all([
      getRegisteredUsers(),
      getOrders(),
      getAllUserCarts(),
      getAddresses(),
    ]);
    const onlyCustomers = userList.filter((u) => u.role === 'customer');
    setCustomers(onlyCustomers);
    setOrders(orderList);
    setCarts(cartList);
    setAddresses(addrList);
    if (!selectedCustomerId && onlyCustomers.length > 0) {
      setSelectedCustomerId(onlyCustomers[0].id);
    }
  }, [selectedCustomerId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.mobile.includes(q),
    );
  }, [customers, search]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? null;
  const selectedOrders = useMemo(
    () =>
      selectedCustomer
        ? orders.filter((o) => o.userId === selectedCustomer.id)
        : [],
    [orders, selectedCustomer],
  );
  const selectedAddresses = useMemo(
    () =>
      selectedCustomer
        ? addresses.filter((a) => a.userId === selectedCustomer.id)
        : [],
    [addresses, selectedCustomer],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl text-dark-ink">
            {t('admin.customersTitle')}
          </h1>
          <p className="text-sm text-muted-text mt-0.5">{t('admin.customersSubtitle')}</p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search
            className="w-4 h-4 text-muted-text absolute left-3.5 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.customersSearchPlaceholder')}
            aria-label={t('admin.customersSearchPlaceholder')}
            className="w-full min-h-[42px] pl-10 pr-3 rounded-[10px] border border-border-grey bg-white text-sm text-dark-ink focus:outline-none focus:ring-2 focus:ring-fresh-green"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Customer Directory Table */}
        <Card padding="none" className="lg:col-span-7 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-soft-grey border-b border-border-grey text-xs uppercase tracking-wide text-muted-text">
                  <th className="py-3 px-4 font-semibold">{t('admin.colCustomer')}</th>
                  <th className="py-3 px-4 font-semibold">{t('admin.orders')}</th>
                  <th className="py-3 px-4 font-semibold">{t('admin.statRevenue')}</th>
                  <th className="py-3 px-4 font-semibold">{t('admin.colCartValue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-grey/70">
                {filteredCustomers.map((c) => {
                  const userOrders = orders.filter(
                    (o) => o.userId === c.id && o.status !== 'cancelled',
                  );
                  const spend = userOrders.reduce((s, o) => s + o.total, 0);
                  const activeCart = carts.find((cart) => cart.userId === c.id);
                  const isSelected = selectedCustomerId === c.id;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className={[
                        'cursor-pointer transition-colors',
                        isSelected ? 'bg-light-green/70' : 'hover:bg-soft-grey/60',
                      ].join(' ')}
                    >
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerId(c.id)}
                          className="flex items-center gap-3 text-left w-full cursor-pointer"
                        >
                          <div className="w-9 h-9 rounded-full bg-light-green text-fresh-green flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <div>
                            <p className="font-semibold text-dark-ink">{c.name}</p>
                            <p className="text-xs text-muted-text tabular-nums">+91 {c.mobile}</p>
                          </div>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 tabular-nums">{userOrders.length}</td>
                      <td className="py-3.5 px-4 font-heading font-bold tabular-nums">
                        {formatINR(spend)}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums">
                        {activeCart ? (
                          <Badge tone="green">{formatINR(activeCart.summary.grandTotal)}</Badge>
                        ) : (
                          <span className="text-xs text-muted-text">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Customer Detail Side Panel */}
        <div className="lg:col-span-5">
          {selectedCustomer ? (
            <Card padding="lg" className="space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-border-grey">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-fresh-green">
                    {t('admin.customerDetailTitle')}
                  </span>
                  <h2 className="font-heading font-bold text-lg text-dark-ink">
                    {selectedCustomer.name}
                  </h2>
                  <p className="text-xs text-muted-text tabular-nums">
                    +91 {selectedCustomer.mobile} ·{' '}
                    {t('admin.customerOrdersCount', { count: selectedOrders.length })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId(null)}
                  aria-label={t('admin.closePanel')}
                  className="p-1.5 rounded-[8px] text-muted-text hover:bg-soft-grey lg:hidden cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Saved Addresses */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-text flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-fresh-green" aria-hidden="true" />
                  <span>
                    {t('admin.customerAddressesHeading', { count: selectedAddresses.length })}
                  </span>
                </h3>
                {selectedAddresses.length === 0 ? (
                  <p className="text-xs text-muted-text">{t('admin.noAddressesSaved')}</p>
                ) : (
                  <div className="space-y-2">
                    {selectedAddresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="rounded-[8px] bg-soft-grey border border-border-grey p-2.5 text-xs"
                      >
                        <span className="font-bold text-dark-ink">{addr.label}</span>
                        <p className="text-muted-text mt-0.5">
                          {addr.door}, {addr.street}, {addr.landmark} – {addr.pincode}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Orders */}
              <div className="space-y-2 pt-2 border-t border-border-grey/70">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-text flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-fresh-green" aria-hidden="true" />
                  <span>
                    {t('admin.customerRecentOrdersHeading', { count: selectedOrders.length })}
                  </span>
                </h3>
                {selectedOrders.length === 0 ? (
                  <p className="text-xs text-muted-text">{t('admin.noCustomerOrders')}</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedOrders.slice(0, 6).map((o) => (
                      <div
                        key={o.id}
                        className="rounded-[8px] bg-soft-grey border border-border-grey p-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <p className="font-heading font-bold text-dark-ink tabular-nums">
                            {o.id}
                          </p>
                          <p className="text-muted-text">
                            {new Date(o.createdAt).toLocaleDateString('en-IN')} · {o.items.length}{' '}
                            items
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-heading font-bold text-dark-ink tabular-nums">
                            {formatINR(o.total)}
                          </p>
                          <Badge tone={o.status === 'cancelled' ? 'red' : 'green'}>
                            {o.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card padding="lg" className="text-center text-sm text-muted-text">
              {t('admin.selectCartHint')}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
