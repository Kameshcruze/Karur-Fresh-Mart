import { Badge } from '../ui';
import { useI18n } from '../../context/I18nContext';
import type { OrderStatus } from '../../types';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useI18n();

  switch (status) {
    case 'delivered':
      return <Badge tone="green">{t('orders.statusDelivered')}</Badge>;
    case 'cancelled':
      return <Badge tone="red">{t('orders.statusCancelled')}</Badge>;
    case 'out_for_delivery':
      return <Badge tone="yellow">{t('orders.statusOutForDelivery')}</Badge>;
    case 'picked_up':
      return <Badge tone="yellow">{t('orders.statusPickedUp')}</Badge>;
    case 'packed':
      return <Badge tone="green">{t('orders.statusPacked')}</Badge>;
    default:
      return <Badge tone="neutral">{t('orders.statusPlaced')}</Badge>;
  }
}
