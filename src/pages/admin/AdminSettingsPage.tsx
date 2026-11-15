import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  IndianRupee,
  MapPin,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { Badge, Button, Card } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useI18n } from '../../context/I18nContext';
import {
  getDeliverySettings,
  getRegisteredUsers,
  updateDeliverySettings,
  updateUserRole,
} from '../../services';
import type { DeliverySlotId, User, UserRole } from '../../types';

export function AdminSettingsPage() {
  const { t } = useI18n();
  const { refreshAddresses } = useAuth();
  const { refresh: refreshCart } = useCart();

  const [hubName, setHubName] = useState('');
  const [radiusKm, setRadiusKm] = useState('8');
  const [deliveryFee, setDeliveryFee] = useState('25');
  const [freeThreshold, setFreeThreshold] = useState('499');
  const [openTime, setOpenTime] = useState('06:30');
  const [closeTime, setCloseTime] = useState('22:00');
  const [enabledSlots, setEnabledSlots] = useState<DeliverySlotId[]>([
    '45min',
    'today_evening',
    'tomorrow_morning',
  ]);
  const [users, setUsers] = useState<User[]>([]);

  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [roleToast, setRoleToast] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [settings, userList] = await Promise.all([
      getDeliverySettings(),
      getRegisteredUsers(),
    ]);
    setHubName(settings.hubName);
    setRadiusKm(String(settings.deliveryRadiusKm));
    setDeliveryFee(String(settings.deliveryFeeInr ?? 25));
    setFreeThreshold(String(settings.freeDeliveryThresholdInr ?? 499));
    setOpenTime(settings.storeOpenTime ?? '06:30');
    setCloseTime(settings.storeCloseTime ?? '22:00');
    setEnabledSlots(
      settings.enabledSlots && settings.enabledSlots.length > 0
        ? settings.enabledSlots
        : ['45min', 'today_evening', 'tomorrow_morning'],
    );
    setUsers(userList);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toggleSlot = (slotId: DeliverySlotId) => {
    setEnabledSlots((prev) => {
      const exists = prev.includes(slotId);
      if (exists && prev.length <= 1) return prev; // Keep at least 1 active delivery slot
      return exists ? prev.filter((id) => id !== slotId) : [...prev, slotId];
    });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericRadius = Math.max(1, Number(radiusKm) || 8);
    const numericFee = Math.max(0, Number(deliveryFee) || 0);
    const numericThreshold = Math.max(0, Number(freeThreshold) || 0);

    const updated = await updateDeliverySettings({
      hubName: hubName.trim() || 'Karur Fresh Mart Hub (Jawahar Bazaar)',
      deliveryRadiusKm: numericRadius,
      deliveryFeeInr: numericFee,
      freeDeliveryThresholdInr: numericThreshold,
      storeOpenTime: openTime || '06:30',
      storeCloseTime: closeTime || '22:00',
      enabledSlots,
    });

    await Promise.all([refreshAddresses(), refreshCart()]);
    const msg = t('admin.settingsSavedToast', {
      radius: updated.deliveryRadiusKm,
      fee: updated.deliveryFeeInr ?? 25,
      threshold: updated.freeDeliveryThresholdInr ?? 499,
    });
    setSavedToast(msg);
    window.setTimeout(() => {
      setSavedToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleRoleChange = async (user: User, role: UserRole) => {
    const nextUsers = await updateUserRole(user.id, role);
    setUsers(nextUsers);
    const roleLabel =
      role === 'admin'
        ? t('common.roleAdmin')
        : role === 'delivery'
          ? t('common.roleDelivery')
          : t('common.roleCustomer');
    const msg = t('admin.roleUpdatedToast', { name: user.name, role: roleLabel });
    setRoleToast(msg);
    window.setTimeout(() => {
      setRoleToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const slotMeta: Array<{ id: DeliverySlotId; label: string }> = [
    { id: '45min', label: t('cart.slot45Min') },
    { id: 'today_evening', label: t('cart.slotTodayEvening') },
    { id: 'tomorrow_morning', label: t('cart.slotTomorrowMorning') },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-heading font-bold text-2xl text-dark-ink">
          {t('admin.settingsTitle')}
        </h1>
        <p className="text-sm text-muted-text mt-0.5">{t('admin.settingsSubtitle')}</p>
      </div>

      {/* Store, Radius, Fees, Timings & Delivery Slots */}
      <Card padding="lg">
        <form onSubmit={(e) => void handleSaveSettings(e)} className="space-y-5">
          <div className="flex items-center gap-2 text-fresh-green pb-2 border-b border-border-grey">
            <Settings className="w-4 h-4" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wide">
              Karur Hub, Delivery Fees & Store Timings
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="admin-hub-name"
                className="block text-xs font-semibold text-dark-ink mb-1.5"
              >
                {t('admin.hubNameLabel')}
              </label>
              <input
                id="admin-hub-name"
                type="text"
                value={hubName}
                onChange={(e) => setHubName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-[10px] border border-border-grey bg-white text-sm text-dark-ink focus:outline-none focus:ring-2 focus:ring-fresh-green"
              />
            </div>

            <div>
              <label
                htmlFor="admin-radius-km"
                className="block text-xs font-semibold text-dark-ink mb-1.5"
              >
                {t('admin.deliveryRadiusLabel')}
              </label>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-alert-red shrink-0" aria-hidden="true" />
                <input
                  id="admin-radius-km"
                  type="number"
                  min={1}
                  max={50}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-[10px] border border-border-grey bg-white text-sm font-semibold tabular-nums text-dark-ink focus:outline-none focus:ring-2 focus:ring-fresh-green"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-delivery-fee"
                className="block text-xs font-semibold text-dark-ink mb-1.5"
              >
                {t('admin.deliveryFeeLabel')}
              </label>
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-fresh-green shrink-0" aria-hidden="true" />
                <input
                  id="admin-delivery-fee"
                  type="number"
                  min={0}
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-[10px] border border-border-grey bg-white text-sm font-semibold tabular-nums text-dark-ink focus:outline-none focus:ring-2 focus:ring-fresh-green"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-free-threshold"
                className="block text-xs font-semibold text-dark-ink mb-1.5"
              >
                {t('admin.freeDeliveryThresholdLabel')}
              </label>
              <input
                id="admin-free-threshold"
                type="number"
                min={0}
                value={freeThreshold}
                onChange={(e) => setFreeThreshold(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-[10px] border border-border-grey bg-white text-sm font-semibold tabular-nums text-dark-ink focus:outline-none focus:ring-2 focus:ring-fresh-green"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="admin-open-time"
                  className="block text-xs font-semibold text-dark-ink mb-1.5"
                >
                  {t('admin.storeOpenTimeLabel')}
                </label>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-muted-text shrink-0" aria-hidden="true" />
                  <input
                    id="admin-open-time"
                    type="time"
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                    className="w-full min-h-[44px] px-2.5 rounded-[10px] border border-border-grey bg-white text-sm font-semibold tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-close-time"
                  className="block text-xs font-semibold text-dark-ink mb-1.5"
                >
                  {t('admin.storeCloseTimeLabel')}
                </label>
                <input
                  id="admin-close-time"
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className="w-full min-h-[44px] px-2.5 rounded-[10px] border border-border-grey bg-white text-sm font-semibold tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Delivery Slots Checkboxes */}
          <div className="space-y-2 pt-2 border-t border-border-grey/70">
            <p className="text-xs font-semibold text-dark-ink">
              {t('admin.enabledSlotsLabel')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {slotMeta.map((slot) => {
                const checked = enabledSlots.includes(slot.id);
                return (
                  <label
                    key={slot.id}
                    className={[
                      'min-h-[44px] px-3 py-2 rounded-[10px] border flex items-center gap-2.5 text-xs font-semibold cursor-pointer transition-colors',
                      checked
                        ? 'bg-light-green border-fresh-green text-dark-ink'
                        : 'bg-soft-grey border-border-grey text-muted-text',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSlot(slot.id)}
                      className="w-4 h-4 accent-fresh-green rounded"
                    />
                    <span>{slot.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {savedToast && (
            <div
              role="status"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] bg-light-green text-fresh-green text-xs font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{savedToast}</span>
            </div>
          )}

          <Button type="submit" variant="primary" size="md">
            {t('admin.saveSettingsCta')}
          </Button>
        </form>
      </Card>

      {/* User Roles Management */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center gap-2 text-fresh-green pb-2 border-b border-border-grey">
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          <div>
            <h2 className="font-heading font-bold text-base text-dark-ink">
              {t('admin.userRolesHeading')}
            </h2>
            <p className="text-xs text-muted-text">{t('admin.userRolesSubtitle')}</p>
          </div>
        </div>

        {roleToast && (
          <div
            role="status"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] bg-light-green text-fresh-green text-xs font-semibold"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{roleToast}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-soft-grey border-b border-border-grey text-xs uppercase text-muted-text">
                <th className="py-2.5 px-3 font-semibold">{t('admin.colCustomer')}</th>
                <th className="py-2.5 px-3 font-semibold">{t('admin.colStatus')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{t('admin.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-grey/60">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-dark-ink">{u.name}</p>
                    <p className="text-xs text-muted-text tabular-nums">+91 {u.mobile}</p>
                  </td>
                  <td className="py-3 px-3">
                    <Badge
                      tone={
                        u.role === 'admin'
                          ? 'dark'
                          : u.role === 'delivery'
                            ? 'yellow'
                            : 'green'
                      }
                    >
                      {u.role === 'admin'
                        ? t('common.roleAdmin')
                        : u.role === 'delivery'
                          ? t('common.roleDelivery')
                          : t('common.roleCustomer')}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <select
                      aria-label={`Role for ${u.name}`}
                      value={u.role}
                      onChange={(e) => void handleRoleChange(u, e.target.value as UserRole)}
                      className="min-h-[38px] px-2.5 rounded-[8px] border border-border-grey bg-white text-xs font-semibold text-dark-ink cursor-pointer"
                    >
                      <option value="customer">{t('common.roleCustomer')}</option>
                      <option value="admin">{t('common.roleAdmin')}</option>
                      <option value="delivery">{t('common.roleDelivery')}</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
