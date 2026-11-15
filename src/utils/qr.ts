import QRCode from 'qrcode';

export const STORE_PHONE_DISPLAY = '+91 4324 220 450';
export const STORE_PHONE_TEL = '+914324220450';
export const DEFAULT_SHOP_ORIGIN = 'https://karurfreshmart.in';

export interface QrRenderOptions {
  width?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}

/**
 * Builds the permanent public /shop URL that wall-mounted QR codes point to.
 * The QR target stays fixed while offers, prices, and stock update live.
 */
export function buildPublicShopUrl(origin?: string): string {
  const rawOrigin =
    origin ??
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : DEFAULT_SHOP_ORIGIN);

  const normalized = rawOrigin.replace(/\/+$/, '');
  return `${normalized}/shop`;
}

/**
 * Generates a high-error-correction PNG data URL (downloadable PNG for posters & admin).
 */
export async function generateShopQrDataUrl(
  url: string = buildPublicShopUrl(),
  options: QrRenderOptions = {},
): Promise<string> {
  return QRCode.toDataURL(url, {
    width: options.width ?? 640,
    margin: options.margin ?? 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: options.darkColor ?? '#16281F',
      light: options.lightColor ?? '#FFFFFF',
    },
  });
}

/**
 * Generates a crisp vector SVG string of the /shop QR code for A4 print posters.
 */
export async function generateShopQrSvg(
  url: string = buildPublicShopUrl(),
  options: QrRenderOptions = {},
): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    width: options.width ?? 320,
    margin: options.margin ?? 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: options.darkColor ?? '#16281F',
      light: options.lightColor ?? '#FFFFFF',
    },
  });
}

/**
 * Triggers a browser download of the generated QR PNG file.
 */
export function downloadQrPng(
  dataUrl: string,
  filename = 'karur-fresh-mart-shop-qr.png',
): void {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
