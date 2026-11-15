import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Truck, UserPlus } from 'lucide-react';
import { Badge, Button, Card } from '../../components/ui';
import { useI18n } from '../../context/I18nContext';
import type { DeliveryPartnerProfile } from '../../mock/users';
import {
  addDeliveryPartner,
  computeDeliveryPartnerStats,
  getDeliveryPartners,
  getOrders,
  togglePartnerAvailability,
} from '../../services';
import type { Order } from '../../types';
import { formatINR } from '../../utils/format';

export function AdminDeliveryStaffPage() {
  const { t } = useI18n();
  const [partners, setPartners] = useState<DeliveryPartnerProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Add partner form state
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [zone, setZone] = useState('Karur Central & Jawahar Bazaar');
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [list, allOrders] = await Promise.all([getDeliveryPartners(), getOrders()]);
    setPartners(list);
    setOrders(allOrders);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggle = async (partner: DeliveryPartnerProfile) => {
    await togglePartnerAvailability(partner.id, !partner.isAvailable);
    await loadData();
  };

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      const added = await addDeliveryPartner({
        name,
        mobile,
        vehicleNumber,
        zone,
      });
      setName('');
      setMobile('');
      setVehicleNumber('');
      await loadData();
      const msg = t('admin.partnerAddedToast', {
        name: added.name,
        mobile: added.mobile,
      });
      setToastMsg(msg);
      window.setTimeout(() => {
        setToastMsg((prev) => (prev === msg ? null : prev));
      }, 3500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to add partner.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading font-bold text-2xl text-dark-ink">
          {t('admin.deliveryStaffTitle')}
        </h1>
        <p className="text-sm text-muted-text mt-0.5">{t('admin.deliveryStaffSubtitle')}</p>
      </div>

      {/* Add Partner Form */}
      <Card padding="lg" className="space-y-3">
        <div className="flex items-center gap-2 text-fresh-green pb-2 border-b border-border-grey">
          <UserPlus className="w-4 h-4" aria-hidden="true" />
          <h2 className="font-heading font-bold text-base text-dark-ink">
            {t('admin.addPartnerHeading')}
          </h2>
        </div>

        <form onSubmit={(e) => void handleAddPartner(e)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label htmlFor="partner-name" className="block text-xs font-semibold text-dark-ink mb-1">
              {t('admin.partnerNameLabel')} *
            </label>
            <input
              id="partner-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aravind Raj"
              className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
            />
          </div>

          <div>
            <label htmlFor="partner-mobile" className="block text-xs font-semibold text-dark-ink mb-1">
              {t('admin.partnerMobileLabel')} *
            </label>
            <input
              id="partner-mobile"
              type="tel"
              required
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="9842212345"
              className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm tabular-nums"
            />
          </div>

          <div>
            <label htmlFor="partner-vehicle" className="block text-xs font-semibold text-dark-ink mb-1">
              {t('admin.partnerVehicleLabel')} *
            </label>
            <input
              id="partner-vehicle"
              type="text"
              required
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder="TN 47 AB 9012"
              className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm uppercase"
            />
          </div>

          <div>
            <label htmlFor="partner-zone" className="block text-xs font-semibold text-dark-ink mb-1">
              {t('admin.partnerZoneLabel')}
            </label>
            <input
              id="partner-zone"
              type="text"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
            />
          </div>

          <Button type="submit" variant="primary" size="md" fullWidth>
            {t('admin.addPartnerCta')}
          </Button>
        </form>

        {formError && (
          <p role="alert" className="text-xs font-semibold text-alert-red">
            {formError}
          </p>
        )}

        {toastMsg && (
          <div
            role="status"
            className="rounded-[10px] bg-light-green border border-fresh-green/35 px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-fresh-green"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{toastMsg}</span>
          </div>
        )}
      </Card>

      {/* Partners List with Status & Live Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {partners.map((partner) => {
          const stats = computeDeliveryPartnerStats(partner.id, orders);
          return (
            <Card key={partner.id} className="space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-light-green text-fresh-green flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-base text-dark-ink">
                      {partner.name}
                    </h3>
                    <p className="text-xs text-muted-text tabular-nums">
                      +91 {partner.mobile} · {partner.vehicleNumber}
                    </p>
                    <p className="text-[11px] text-muted-text mt-0.5">{partner.zone}</p>
                  </div>
                </div>
                <Badge tone={partner.isAvailable ? 'green' : 'neutral'}>
                  {partner.isAvailable
                    ? t('admin.availableOnDuty')
                    : t('admin.offlineDuty')}
                </Badge>
              </div>

              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-2 rounded-[10px] bg-soft-grey p-2.5 text-center">
                <div>
                  <p className="text-[11px] text-muted-text">Active</p>
                  <p className="font-heading font-bold text-sm text-dark-ink tabular-nums">
                    {stats.activeDrops}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-text">{t('admin.deliveredCountLabel')}</p>
                  <p className="font-heading font-bold text-sm text-fresh-green tabular-nums">
                    {stats.deliveredCount}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-text">{t('admin.codCollectedLabel')}</p>
                  <p className="font-heading font-bold text-sm text-dark-ink tabular-nums">
                    {formatINR(stats.codCollectedAmount)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border-grey/70 text-xs">
                <span className="text-muted-text font-semibold">
                  {t('admin.activeDropsCount', { count: stats.activeDrops })}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleToggle(partner)}
                >
                  {partner.isAvailable
                    ? t('admin.offlineDuty')
                    : t('admin.availableOnDuty')}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
