import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DeliverySettings } from '../../types';

export interface CheckoutAddressMapProps {
  lat: number;
  lng: number;
  deliverySettings: DeliverySettings;
}

function createPinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'kfm-checkout-pin',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:32px;transform:translate(-50%,-100%);">
      <svg width="26" height="30" viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.163 0 0 7.163 0 16C0 27.2 16 36 16 36C16 36 32 27.2 32 16C32 7.163 24.837 0 16 0Z" fill="#E5484D"/>
        <circle cx="16" cy="15" r="6" fill="white"/>
      </svg>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function createHubIcon(): L.DivIcon {
  return L.divIcon({
    className: 'kfm-checkout-hub',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:#1B8A4B;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.28);transform:translate(-50%,-50%);">
      <div style="width:6px;height:6px;border-radius:9999px;background:#FFC83D;"></div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export function CheckoutAddressMap({
  lat,
  lng,
  deliverySettings,
}: CheckoutAddressMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    L.marker([deliverySettings.hubLat, deliverySettings.hubLng], {
      icon: createHubIcon(),
      interactive: false,
    }).addTo(map);

    L.circle([deliverySettings.hubLat, deliverySettings.hubLng], {
      radius: deliverySettings.deliveryRadiusKm * 1000,
      color: '#1B8A4B',
      weight: 1,
      dashArray: '4 4',
      fillColor: '#1B8A4B',
      fillOpacity: 0.06,
      interactive: false,
    }).addTo(map);

    const pin = L.marker([lat, lng], {
      icon: createPinIcon(),
      interactive: false,
    }).addTo(map);

    mapRef.current = map;
    pinRef.current = pin;

    return () => {
      map.remove();
      mapRef.current = null;
      pinRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !pinRef.current) return;
    pinRef.current.setLatLng([lat, lng]);
    mapRef.current.setView([lat, lng], 14);
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      data-testid="checkout-address-map"
      className="w-full h-[170px] rounded-[10px] border border-border-grey overflow-hidden bg-soft-grey relative z-0"
    />
  );
}
