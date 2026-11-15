import { KARUR_STORE_COORDS } from '../mock/addresses';
import type { DeliverySettings } from '../types';

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Computes great-circle distance in kilometers between two coordinates using Haversine.
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((EARTH_RADIUS_KM * c).toFixed(2));
}

export interface ServiceAreaCheckResult {
  inServiceArea: boolean;
  distanceKm: number;
  radiusKm: number;
}

/**
 * Checks whether coordinates fall within the configured Karur delivery radius.
 */
export function checkServiceArea(
  lat: number,
  lng: number,
  settings: Pick<DeliverySettings, 'hubLat' | 'hubLng' | 'deliveryRadiusKm'> = {
    hubLat: KARUR_STORE_COORDS.lat,
    hubLng: KARUR_STORE_COORDS.lng,
    deliveryRadiusKm: 8,
  },
): ServiceAreaCheckResult {
  const distanceKm = calculateDistanceKm(
    lat,
    lng,
    settings.hubLat,
    settings.hubLng,
  );
  return {
    inServiceArea: distanceKm <= settings.deliveryRadiusKm,
    distanceKm,
    radiusKm: settings.deliveryRadiusKm,
  };
}

/**
 * Builds a turnkey Google Maps turn-by-turn navigation link for saved coordinates.
 */
export function buildGoogleMapsNavUrl(lat: number, lng: number): string {
  const formattedLat = Number(lat.toFixed(6));
  const formattedLng = Number(lng.toFixed(6));
  return `https://www.google.com/maps/dir/?api=1&destination=${formattedLat},${formattedLng}`;
}
