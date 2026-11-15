import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  ExternalLink,
  MapPin,
} from 'lucide-react';
import { Button } from '../ui';
import { useI18n } from '../../context/I18nContext';
import type { DeliverySettings } from '../../types';
import { buildGoogleMapsNavUrl, checkServiceArea } from '../../utils/geo';

export interface AddressMapPickerProps {
  lat: number;
  lng: number;
  deliverySettings: DeliverySettings;
  onChangeCoords: (lat: number, lng: number) => void;
}

function createCustomerPinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'kfm-custom-pin',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;transform:translate(-50%,-100%);">
      <svg width="32" height="36" viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.163 0 0 7.163 0 16C0 27.2 16 36 16 36C16 36 32 27.2 32 16C32 7.163 24.837 0 16 0Z" fill="#E5484D"/>
        <circle cx="16" cy="15" r="6" fill="white"/>
      </svg>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function createStoreHubIcon(): L.DivIcon {
  return L.divIcon({
    className: 'kfm-hub-pin',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:#1B8A4B;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.28);transform:translate(-50%,-50%);">
      <div style="width:8px;height:8px;border-radius:9999px;background:#FFC83D;"></div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export function AddressMapPicker({
  lat,
  lng,
  deliverySettings,
  onChangeCoords,
}: AddressMapPickerProps) {
  const { t } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeCoordsRef = useRef(onChangeCoords);
  onChangeCoordsRef.current = onChangeCoords;

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  const serviceStatus = useMemo(
    () => checkServiceArea(lat, lng, deliverySettings),
    [lat, lng, deliverySettings],
  );

  // Initialize OpenStreetMap + Leaflet once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Store hub marker + configurable delivery radius circle
    L.marker([deliverySettings.hubLat, deliverySettings.hubLng], {
      icon: createStoreHubIcon(),
      interactive: false,
      title: deliverySettings.hubName,
    }).addTo(map);

    const radiusCircle = L.circle([deliverySettings.hubLat, deliverySettings.hubLng], {
      radius: deliverySettings.deliveryRadiusKm * 1000,
      color: '#1B8A4B',
      weight: 1.5,
      dashArray: '6 6',
      fillColor: '#1B8A4B',
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(map);

    // Draggable customer delivery pin (#E5484D Alert Red)
    const pinMarker = L.marker([lat, lng], {
      icon: createCustomerPinIcon(),
      draggable: true,
    }).addTo(map);

    pinMarker.on('dragend', () => {
      const pos = pinMarker.getLatLng();
      onChangeCoordsRef.current(
        Number(pos.lat.toFixed(6)),
        Number(pos.lng.toFixed(6)),
      );
    });

    map.on('click', (event: L.LeafletMouseEvent) => {
      const nextLat = Number(event.latlng.lat.toFixed(6));
      const nextLng = Number(event.latlng.lng.toFixed(6));
      pinMarker.setLatLng([nextLat, nextLng]);
      onChangeCoordsRef.current(nextLat, nextLng);
    });

    mapRef.current = map;
    markerRef.current = pinMarker;
    circleRef.current = radiusCircle;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // Intentionally initialize once and sync coordinates/radius in effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep pin & map synced when props update (e.g. clicking Edit on another address or GPS)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const current = markerRef.current.getLatLng();
    if (
      Math.abs(current.lat - lat) > 0.00001 ||
      Math.abs(current.lng - lng) > 0.00001
    ) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.panTo([lat, lng]);
    }
  }, [lat, lng]);

  // Keep radius circle synced with admin deliverySettings
  useEffect(() => {
    if (!circleRef.current) return;
    circleRef.current.setLatLng([deliverySettings.hubLat, deliverySettings.hubLng]);
    circleRef.current.setRadius(deliverySettings.deliveryRadiusKm * 1000);
  }, [deliverySettings]);

  const handleUseCurrentLocation = () => {
    setGeoError('');
    if (!('geolocation' in navigator)) {
      setGeoError(t('addresses.geolocationUnsupported'));
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLat = Number(pos.coords.latitude.toFixed(6));
        const nextLng = Number(pos.coords.longitude.toFixed(6));
        markerRef.current?.setLatLng([nextLat, nextLng]);
        mapRef.current?.setView([nextLat, nextLng], 15);
        onChangeCoords(nextLat, nextLng);
        setGeoLoading(false);
      },
      () => {
        setGeoError(t('addresses.geolocationFailed'));
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-heading font-semibold text-sm text-dark-ink">
            {t('addresses.mapTitle')}
          </h3>
          <p className="text-xs text-muted-text">{t('addresses.mapHint')}</p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={geoLoading}
          onClick={handleUseCurrentLocation}
          leftIcon={<Crosshair className="w-4 h-4" />}
        >
          {geoLoading ? t('addresses.locating') : t('addresses.useCurrentLocation')}
        </Button>
      </div>

      {geoError && (
        <p role="alert" className="text-xs font-medium text-alert-red">
          {geoError}
        </p>
      )}

      {/* Leaflet Map Canvas */}
      <div
        ref={mapContainerRef}
        data-testid="address-leaflet-map"
        className="w-full h-[270px] sm:h-[320px] rounded-[12px] border border-border-grey overflow-hidden bg-soft-grey relative z-0"
      />

      {/* Coordinates + Google Maps Navigation Helper */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-[10px] bg-soft-grey border border-border-grey/80 text-xs">
        <div className="flex items-center gap-1.5 text-dark-ink font-medium tabular-nums">
          <MapPin className="w-3.5 h-3.5 text-alert-red shrink-0" aria-hidden="true" />
          <span>{t('addresses.coordinatesLabel')}:</span>
          <span data-testid="pinned-coords" className="font-semibold">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        </div>

        <a
          href={buildGoogleMapsNavUrl(lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-fresh-green hover:underline"
        >
          <span>{t('addresses.openInMaps')}</span>
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      </div>

      {/* Live Service-Area Radius Check */}
      {serviceStatus.inServiceArea ? (
        <div
          data-testid="service-area-status"
          className="rounded-[10px] bg-light-green border border-fresh-green/25 px-3.5 py-2.5 flex items-center gap-2 text-xs sm:text-sm font-medium text-fresh-green"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">
            {t('addresses.inServiceZone', {
              distance: serviceStatus.distanceKm,
              radius: serviceStatus.radiusKm,
            })}
          </span>
        </div>
      ) : (
        <div
          role="alert"
          data-testid="service-area-warning"
          className="rounded-[10px] bg-alert-red-soft border border-alert-red/30 px-3.5 py-2.5 flex items-start gap-2 text-xs sm:text-sm font-medium text-alert-red"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="tabular-nums">
            {t('addresses.outsideServiceZoneWarning', {
              distance: serviceStatus.distanceKm,
              radius: serviceStatus.radiusKm,
            })}
          </span>
        </div>
      )}
    </div>
  );
}
