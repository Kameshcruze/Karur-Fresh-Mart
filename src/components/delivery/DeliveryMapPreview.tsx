import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Store, MapPin } from 'lucide-react';
import { KARUR_STORE_COORDS } from '../../mock/addresses';
import { useI18n } from '../../context/I18nContext';
import { calculateDistanceKm } from '../../utils/geo';

export interface DeliveryMapPreviewProps {
  customerLat: number;
  customerLng: number;
  hubLat?: number;
  hubLng?: number;
  customerLabel?: string;
}

function createHubIcon(): L.DivIcon {
  return L.divIcon({
    className: 'kfm-hub-pin',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:#16281F;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);transform:translate(-50%,-50%);">
      <div style="width:9px;height:9px;border-radius:9999px;background:#26A65B;"></div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function createDropPinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'kfm-drop-pin',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:36px;transform:translate(-50%,-100%);">
      <svg width="30" height="36" viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.163 0 0 7.163 0 16C0 27.2 16 36 16 36C16 36 32 27.2 32 16C32 7.163 24.837 0 16 0Z" fill="#E5484D"/>
        <circle cx="16" cy="15" r="5.5" fill="white"/>
      </svg>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export function DeliveryMapPreview({
  customerLat,
  customerLng,
  hubLat = KARUR_STORE_COORDS.lat,
  hubLng = KARUR_STORE_COORDS.lng,
  customerLabel,
}: DeliveryMapPreviewProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const distanceKm = useMemo(
    () => calculateDistanceKm(hubLat, hubLng, customerLat, customerLng),
    [hubLat, hubLng, customerLat, customerLng],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      center: [customerLat, customerLng],
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    L.marker([hubLat, hubLng], {
      icon: createHubIcon(),
      interactive: false,
    }).addTo(map);

    L.marker([customerLat, customerLng], {
      icon: createDropPinIcon(),
      interactive: false,
    }).addTo(map);

    L.polyline(
      [
        [hubLat, hubLng],
        [customerLat, customerLng],
      ],
      {
        color: '#1B8A4B',
        weight: 3,
        dashArray: '6 6',
        opacity: 0.85,
      },
    ).addTo(map);

    const bounds = L.latLngBounds([
      [hubLat, hubLng],
      [customerLat, customerLng],
    ]);
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [customerLat, customerLng, hubLat, hubLng]);

  return (
    <div className="space-y-2.5">
      <div className="relative isolate z-0 rounded-[12px] overflow-hidden border border-border-grey bg-soft-grey">
        <div
          ref={containerRef}
          data-testid="delivery-map-preview"
          className="h-[190px] w-full z-0"
        />
        <div className="absolute top-2.5 left-2.5 z-[400] inline-flex items-center gap-1.5 rounded-[8px] bg-deep-forest/90 text-white px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur-xs">
          <Navigation className="w-3 h-3 text-bright-green" aria-hidden="true" />
          <span>{t('delivery.distanceFromHub', { km: distanceKm })}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-text px-0.5">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Store className="w-3.5 h-3.5 text-fresh-green" aria-hidden="true" />
            <span>{t('delivery.storeHubPinLabel')}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-alert-red" aria-hidden="true" />
            <span>{customerLabel || t('delivery.customerPinLabel')}</span>
          </span>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-dark-ink">
          {customerLat.toFixed(5)}, {customerLng.toFixed(5)}
        </span>
      </div>
    </div>
  );
}
