import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Layers } from 'lucide-react';
import { Badge, Card } from '../components/ui';
import { useI18n } from '../context/I18nContext';
import type { TranslationKey } from '../i18n';

interface SkeletonPageProps {
  titleKey: TranslationKey;
  role?: 'customer' | 'admin' | 'delivery';
  backTo?: string;
}

export function SkeletonPage({
  titleKey,
  role = 'customer',
  backTo = '/',
}: SkeletonPageProps) {
  const { t } = useI18n();
  const location = useLocation();
  const params = useParams();
  const paramEntries = Object.entries(params).filter(([, val]) => Boolean(val));

  const roleBadge =
    role === 'admin'
      ? t('common.roleAdmin')
      : role === 'delivery'
        ? t('common.roleDelivery')
        : t('common.roleCustomer');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge tone={role === 'admin' ? 'dark' : role === 'delivery' ? 'yellow' : 'green'}>
              {roleBadge}
            </Badge>
            <span className="text-xs text-muted-text font-mono">
              {location.pathname}
            </span>
          </div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-dark-ink">
            {t(titleKey)}
          </h1>
        </div>

        <Link
          to={backTo}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[10px] border border-border-grey bg-white text-sm font-medium text-dark-ink hover:border-fresh-green hover:text-fresh-green transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t('nav.home')}</span>
        </Link>
      </div>

      <Card padding="lg" className="space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-[10px] bg-light-green text-fresh-green flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-heading font-semibold text-base text-dark-ink">
              {t('common.routeLabel')}: {location.pathname}
            </h2>
            <p className="text-sm text-muted-text leading-relaxed max-w-2xl">
              {t('common.comingSoonNote')}
            </p>
          </div>
        </div>

        {paramEntries.length > 0 && (
          <div className="pt-3 border-t border-border-grey/70 flex flex-wrap gap-3 text-xs text-muted-text">
            {paramEntries.map(([key, value]) => (
              <span key={key} className="font-mono bg-soft-grey px-2.5 py-1 rounded-[6px] border border-border-grey">
                {key}={value}
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
