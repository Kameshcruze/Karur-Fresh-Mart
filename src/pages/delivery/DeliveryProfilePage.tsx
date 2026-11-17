import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Languages,
  LogOut,
  MapPin,
  Phone,
  Power,
  Truck,
} from 'lucide-react';
import { Badge, Button, Card } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import type { DeliveryPartnerProfile } from '../../mock/users';
import {
  getDeliveryPartners,
  resolvePartnerForUser,
  subscribeToDeliveryPartnerUpdates,
  togglePartnerDutyStatus,
} from '../../services';

export function DeliveryProfilePage() {
  const { user, logoutUser } = useAuth();
  const { lang, toggleLang, t } = useI18n();
  const [partner, setPartner] = useState<DeliveryPartnerProfile | undefined>(undefined);

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
    if (!partner) return;
    const next = await togglePartnerDutyStatus(partner.id, !partner.isAvailable);
    setPartner(resolvePartnerForUser(user?.id, user?.mobile, next));
  };

  const isOnDuty = partner?.isAvailable ?? true;

  return (
    <div className="space-y-4" data-testid="delivery-profile-page">
      <h1 className="font-heading font-bold text-xl text-dark-ink">
        {t('delivery.profile')}
      </h1>

      <Card padding="lg" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-deep-forest text-bright-green flex items-center justify-center font-heading font-bold text-lg shrink-0">
              {(partner?.name ?? user?.name ?? 'R').charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-heading font-bold text-lg text-dark-ink truncate">
                {partner?.name ?? user?.name}
              </p>
              <p className="text-xs text-muted-text">
                {t('delivery.portalTitle')}
              </p>
            </div>
          </div>

          <Badge tone={isOnDuty ? 'green' : 'neutral'}>
            {isOnDuty ? t('delivery.dutyOnline') : t('delivery.dutyOffline')}
          </Badge>
        </div>

        <div className="divide-y divide-border-grey/80 text-sm">
          <div className="py-2.5 flex items-center justify-between gap-3">
            <span className="text-muted-text inline-flex items-center gap-2">
              <Phone className="w-4 h-4" aria-hidden="true" />
              {t('delivery.profileMobileLabel')}
            </span>
            <span className="font-semibold tabular-nums">
              +91 {partner?.mobile ?? user?.mobile}
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-3">
            <span className="text-muted-text inline-flex items-center gap-2">
              <Truck className="w-4 h-4" aria-hidden="true" />
              {t('delivery.profileVehicleLabel')}
            </span>
            <span className="font-semibold">
              {partner?.vehicleNumber ?? 'TN 47 BL 4821'}
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-3">
            <span className="text-muted-text inline-flex items-center gap-2">
              <MapPin className="w-4 h-4" aria-hidden="true" />
              {t('delivery.profileZoneLabel')}
            </span>
            <span className="font-semibold">
              {partner?.zone ?? 'Karur Central & West'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Button
            type="button"
            variant={isOnDuty ? 'outline' : 'primary'}
            size="md"
            fullWidth
            onClick={handleToggleDuty}
            leftIcon={
              isOnDuty ? <Power className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />
            }
          >
            {isOnDuty ? t('delivery.dutyOffline') : t('delivery.dutyOnline')}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="md"
            fullWidth
            onClick={toggleLang}
            leftIcon={<Languages className="w-4 h-4" />}
          >
            {lang === 'en' ? 'தமிழ்' : 'English'}
          </Button>
        </div>

        <Button
          type="button"
          variant="danger"
          size="md"
          fullWidth
          onClick={() => void logoutUser()}
          leftIcon={<LogOut className="w-4 h-4" />}
        >
          {t('delivery.profileSignOut')}
        </Button>
      </Card>
    </div>
  );
}
