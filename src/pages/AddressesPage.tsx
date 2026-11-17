import React, { useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Check,
  CheckCircle2,
  ExternalLink,
  Home,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { AddressMapPicker } from '../components/addresses/AddressMapPicker';
import { Badge, Button, Card, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { KARUR_STORE_COORDS } from '../mock/addresses';
import type { Address, AddressLabel } from '../types';
import { buildGoogleMapsNavUrl, checkServiceArea } from '../utils/geo';

interface AddressDraft {
  id?: string;
  label: AddressLabel;
  recipientName: string;
  mobile: string;
  door: string;
  street: string;
  landmark: string;
  pincode: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}

function createEmptyDraft(
  defaultName = '',
  defaultMobile = '',
  hubLat = KARUR_STORE_COORDS.lat,
  hubLng = KARUR_STORE_COORDS.lng,
): AddressDraft {
  return {
    label: 'Home',
    recipientName: defaultName,
    mobile: defaultMobile,
    door: '',
    street: '',
    landmark: '',
    pincode: '639001',
    lat: hubLat,
    lng: hubLng,
    isDefault: false,
  };
}

function toDraft(address: Address): AddressDraft {
  return {
    id: address.id,
    label: address.label,
    recipientName: address.recipientName ?? '',
    mobile: address.mobile ?? '',
    door: address.door,
    street: address.street,
    landmark: address.landmark,
    pincode: address.pincode,
    lat: address.lat,
    lng: address.lng,
    isDefault: Boolean(address.isDefault),
  };
}

export function AddressesPage() {
  const { t } = useI18n();
  const {
    user,
    addresses,
    deliverySettings,
    saveUserAddress,
    deleteUserAddress,
    selectDefaultAddress,
  } = useAuth();

  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<AddressDraft>(() =>
    createEmptyDraft(
      user?.name ?? '',
      user?.mobile ?? '',
      deliverySettings.hubLat,
      deliverySettings.hubLng,
    ),
  );
  const [formError, setFormError] = useState('');
  const [savedNotice, setSavedNotice] = useState('');

  const openAddForm = () => {
    setFormError('');
    setSavedNotice('');
    setDraft(
      createEmptyDraft(
        user?.name ?? '',
        user?.mobile ?? '',
        deliverySettings.hubLat,
        deliverySettings.hubLng,
      ),
    );
    setFormOpen(true);
  };

  const openEditForm = (addr: Address) => {
    setFormError('');
    setSavedNotice('');
    setDraft(toDraft(addr));
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanPin = draft.pincode.replace(/\D/g, '');
    if (
      !draft.door.trim() ||
      !draft.street.trim() ||
      !draft.landmark.trim() ||
      cleanPin.length !== 6
    ) {
      setFormError(t('addresses.requiredFieldsError'));
      return;
    }

    const addressToSave: Address = {
      id: draft.id ?? `addr-${Date.now()}`,
      userId: user?.id ?? 'user-cust-1',
      label: draft.label,
      recipientName: draft.recipientName.trim() || user?.name,
      mobile: draft.mobile.replace(/\D/g, '').slice(0, 10) || user?.mobile,
      door: draft.door.trim(),
      street: draft.street.trim(),
      landmark: draft.landmark.trim(),
      pincode: cleanPin,
      lat: draft.lat,
      lng: draft.lng,
      isDefault: draft.isDefault || addresses.length === 0,
    };

    await saveUserAddress(addressToSave);
    setFormOpen(false);
    setSavedNotice(t('addresses.savedToast'));
    window.setTimeout(() => setSavedNotice(''), 2500);
  };

  const renderLabelIcon = (label: AddressLabel) => {
    switch (label) {
      case 'Home':
        return <Home className="w-3.5 h-3.5" aria-hidden="true" />;
      case 'Work':
        return <Briefcase className="w-3.5 h-3.5" aria-hidden="true" />;
      default:
        return <MapPin className="w-3.5 h-3.5" aria-hidden="true" />;
    }
  };

  const labelText = (label: AddressLabel) => {
    switch (label) {
      case 'Home':
        return t('addresses.labelHome');
      case 'Work':
        return t('addresses.labelWork');
      default:
        return t('addresses.labelOther');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-dark-ink">
            {t('addresses.title')}
          </h1>
          <p className="text-sm text-muted-text mt-1">
            {t('addresses.subtitle')} ·{' '}
            <span className="font-medium text-dark-ink tabular-nums">
              {t('addresses.radiusConfigNote', {
                radius: deliverySettings.deliveryRadiusKm,
              })}
            </span>
          </p>
        </div>

        {!formOpen && (
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={openAddForm}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {t('addresses.addNew')}
          </Button>
        )}
      </div>

      {savedNotice && (
        <div
          role="status"
          className="rounded-[12px] bg-light-green border border-fresh-green/30 px-4 py-3 flex items-center gap-2 text-sm font-medium text-fresh-green"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Add / Edit Address Panel with Leaflet Picker */}
      {formOpen && (
        <Card padding="lg" className="space-y-5">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-border-grey/70">
            <h2 className="font-heading font-bold text-lg sm:text-xl text-dark-ink">
              {draft.id
                ? t('addresses.editAddressFormTitle')
                : t('addresses.addAddressFormTitle')}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFormOpen(false)}
            >
              {t('addresses.cancel')}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: OpenStreetMap + Leaflet Interactive Picker */}
            <div className="lg:col-span-6">
              <AddressMapPicker
                lat={draft.lat}
                lng={draft.lng}
                deliverySettings={deliverySettings}
                onChangeCoords={(nextLat, nextLng) =>
                  setDraft((prev) => ({ ...prev, lat: nextLat, lng: nextLng }))
                }
              />
            </div>

            {/* Right: Address Form Fields */}
            <form
              onSubmit={(e) => void handleSave(e)}
              className="lg:col-span-6 space-y-4"
            >
              <div>
                <span className="block text-sm font-medium text-dark-ink mb-1.5">
                  {t('addresses.labelField')}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['Home', 'Work', 'Other'] as AddressLabel[]).map((lbl) => {
                    const active = draft.label === lbl;
                    return (
                      <button
                        key={lbl}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setDraft((prev) => ({ ...prev, label: lbl }))}
                        className={[
                          'min-h-[44px] px-3 rounded-[10px] border text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer',
                          active
                            ? 'bg-light-green border-fresh-green text-fresh-green'
                            : 'bg-white border-border-grey text-dark-ink hover:border-fresh-green/60',
                        ].join(' ')}
                      >
                        {renderLabelIcon(lbl)}
                        <span>{labelText(lbl)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label={t('addresses.recipientLabel')}
                  placeholder={t('addresses.recipientPlaceholder')}
                  value={draft.recipientName}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, recipientName: e.target.value }))
                  }
                />
                <Input
                  label={t('addresses.mobileLabel')}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={draft.mobile}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      mobile: e.target.value.replace(/\D/g, '').slice(0, 10),
                    }))
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label={t('addresses.doorLabel')}
                  placeholder={t('addresses.doorPlaceholder')}
                  value={draft.door}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, door: e.target.value }))
                  }
                  required
                />
                <Input
                  label={t('addresses.pincodeLabel')}
                  placeholder={t('addresses.pincodePlaceholder')}
                  inputMode="numeric"
                  maxLength={6}
                  value={draft.pincode}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      pincode: e.target.value.replace(/\D/g, '').slice(0, 6),
                    }))
                  }
                  required
                />
              </div>

              <Input
                label={t('addresses.streetLabel')}
                placeholder={t('addresses.streetPlaceholder')}
                value={draft.street}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, street: e.target.value }))
                }
                required
              />

              <Input
                label={t('addresses.landmarkLabel')}
                placeholder={t('addresses.landmarkPlaceholder')}
                value={draft.landmark}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, landmark: e.target.value }))
                }
                required
              />

              {formError && (
                <p role="alert" className="text-xs font-medium text-alert-red">
                  {formError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button type="submit" variant="primary" size="lg" className="flex-1">
                  {draft.id
                    ? t('addresses.updateAddress')
                    : t('addresses.saveAddress')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setFormOpen(false)}
                >
                  {t('addresses.cancel')}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}

      {/* Saved Addresses Grid */}
      {addresses.length === 0 ? (
        <Card className="text-center py-12 space-y-3">
          <div className="w-12 h-12 rounded-[12px] bg-light-green text-fresh-green mx-auto flex items-center justify-center">
            <MapPin className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="font-heading font-bold text-lg text-dark-ink">
            {t('addresses.emptyTitle')}
          </h2>
          <p className="text-sm text-muted-text">{t('addresses.emptySubtitle')}</p>
          <div className="pt-1">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={openAddForm}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {t('addresses.addNew')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {addresses.map((addr) => {
            const areaCheck = checkServiceArea(addr.lat, addr.lng, deliverySettings);
            return (
              <Card
                key={addr.id}
                padding="md"
                className={[
                  'flex flex-col justify-between gap-4',
                  addr.isDefault ? 'border-fresh-green ring-1 ring-fresh-green/20' : '',
                ].join(' ')}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={addr.label === 'Work' ? 'yellow' : 'green'}
                        icon={renderLabelIcon(addr.label)}
                      >
                        {labelText(addr.label)}
                      </Badge>
                      {addr.isDefault && (
                        <Badge tone="dark" icon={<Check className="w-3 h-3" />}>
                          {t('addresses.defaultBadge')}
                        </Badge>
                      )}
                    </div>

                    {!areaCheck.inServiceArea && (
                      <Badge tone="red" icon={<AlertTriangle className="w-3 h-3" />}>
                        {areaCheck.distanceKm} km
                      </Badge>
                    )}
                  </div>

                  <div>
                    {addr.recipientName && (
                      <p className="font-heading font-semibold text-sm text-dark-ink">
                        {addr.recipientName}
                      </p>
                    )}
                    <p className="text-sm text-dark-ink mt-0.5 leading-snug">
                      {addr.door}, {addr.street}
                    </p>
                    <p className="text-xs text-muted-text mt-1">
                      {addr.landmark} · {t('common.karurCity')} - {addr.pincode}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <span className="text-muted-text tabular-nums">
                      {addr.lat.toFixed(4)}, {addr.lng.toFixed(4)}
                    </span>
                    <a
                      href={buildGoogleMapsNavUrl(addr.lat, addr.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-fresh-green hover:underline"
                    >
                      <span>{t('addresses.openInMaps')}</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </div>
                </div>

                <div className="pt-3 border-t border-border-grey/70 flex flex-wrap items-center justify-between gap-2">
                  {!addr.isDefault ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void selectDefaultAddress(addr.id)}
                    >
                      {t('addresses.setDefault')}
                    </Button>
                  ) : (
                    <span className="text-xs font-semibold text-fresh-green inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t('addresses.defaultBadge')}</span>
                    </span>
                  )}

                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`${t('addresses.edit')} ${labelText(addr.label)} ${addr.door}`}
                      onClick={() => openEditForm(addr)}
                      leftIcon={<Pencil className="w-3.5 h-3.5" />}
                    >
                      {t('addresses.edit')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`${t('addresses.delete')} ${labelText(addr.label)} ${addr.door}`}
                      onClick={() => void deleteUserAddress(addr.id)}
                      className="text-alert-red hover:bg-alert-red/10 px-2.5"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
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
