import React from 'react';
import { ArrowLeft, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';

export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoggedIn, isLoading } = useAuth();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-soft-grey flex items-center justify-center p-4">
        <Card className="w-full max-w-md h-48 animate-pulse bg-white/80" />
      </div>
    );
  }

  if (!isLoggedIn || user?.role !== 'admin') {
    const currentRoleLabel =
      user?.role === 'delivery'
        ? t('common.roleDelivery')
        : t('common.roleCustomer');

    return (
      <div
        data-testid="admin-role-guard"
        className="min-h-screen bg-soft-grey flex items-center justify-center p-4 sm:p-6"
      >
        <Card padding="lg" className="w-full max-w-md text-center space-y-5 shadow-sm">
          <div className="w-14 h-14 rounded-[12px] bg-alert-red-soft text-alert-red mx-auto flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="font-heading font-bold text-xl text-dark-ink">
              {t('admin.accessRestrictedTitle')}
            </h1>
            <p className="text-sm text-muted-text leading-relaxed">
              {isLoggedIn && user
                ? t('admin.signedInAsOtherRole', {
                    name: user.name,
                    role: currentRoleLabel,
                  })
                : t('admin.accessRestrictedSubtitle')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link to="/login" className="flex-1">
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                leftIcon={<ShieldCheck className="w-4 h-4" />}
              >
                {t('admin.signInAsAdminCta')}
              </Button>
            </Link>
            <Link to="/" className="flex-1">
              <Button
                type="button"
                variant="secondary"
                size="md"
                fullWidth
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                {t('nav.backToStore')}
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
