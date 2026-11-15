import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  ExternalLink,
  Phone,
  Printer,
  QrCode,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { Button, Card } from '../ui';
import { useI18n } from '../../context/I18nContext';
import {
  buildPublicShopUrl,
  downloadQrPng,
  generateShopQrDataUrl,
  STORE_PHONE_DISPLAY,
} from '../../utils/qr';

export function ShopQrPosterCard({ showShopPreviewLink = true }: { showShopPreviewLink?: boolean }) {
  const { t } = useI18n();
  const shopUrl = buildPublicShopUrl();
  const [qrPngUrl, setQrPngUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    void generateShopQrDataUrl(shopUrl, { width: 720, margin: 2 }).then((dataUrl) => {
      if (active) setQrPngUrl(dataUrl);
    });
    return () => {
      active = false;
    };
  }, [shopUrl]);

  return (
    <div className="space-y-4">
      {/* Action Bar (hidden when printing A4 poster) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="font-heading font-bold text-lg sm:text-xl text-dark-ink flex items-center gap-2">
            <QrCode className="w-5 h-5 text-fresh-green shrink-0" aria-hidden="true" />
            <span>{t('qrPoster.title')}</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted-text">{t('qrPoster.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={!qrPngUrl}
            onClick={() => downloadQrPng(qrPngUrl)}
            leftIcon={<Download className="w-4 h-4" />}
          >
            {t('qrPoster.downloadPng')}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => window.print()}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            {t('qrPoster.printA4')}
          </Button>

          {showShopPreviewLink && (
            <Link to="/shop">
              <Button
                variant="outline"
                size="md"
                rightIcon={<ExternalLink className="w-4 h-4" />}
              >
                {t('qrPoster.previewShop')}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Permanent URL Notice */}
      <div className="print:hidden rounded-[10px] bg-light-green border border-fresh-green/25 px-4 py-2.5 flex items-start gap-2.5 text-xs sm:text-sm text-fresh-green font-medium">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{t('qrPoster.permanentNote')}</span>
      </div>

      {/* Printable A4 Wall Poster Sheet */}
      <Card
        padding="none"
        data-testid="a4-qr-poster"
        className="max-w-[794px] mx-auto overflow-hidden border-2 border-fresh-green/30 print:max-w-none print:w-full print:border-2 print:border-fresh-green print:shadow-none print:rounded-none"
      >
        {/* Top Green Poster Banner */}
        <div className="bg-gradient-to-br from-fresh-green to-bright-green text-white px-6 py-7 sm:px-10 sm:py-8 text-center space-y-2.5">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-[10px] bg-white/15 backdrop-blur-xs">
            <Store className="w-5 h-5 text-warm-yellow" aria-hidden="true" />
            <span className="font-heading font-bold text-lg sm:text-xl tracking-tight">
              {t('brand.name')}
            </span>
          </div>

          <h3 className="font-heading font-bold text-2xl sm:text-3xl leading-tight max-w-xl mx-auto">
            {t('qrPoster.posterScanHeadline')}
          </h3>

          <p className="text-sm sm:text-base text-white/95 font-medium">
            {t('shop.headerTagline')}
          </p>
        </div>

        {/* Center QR Code Block */}
        <div className="bg-white px-6 py-7 sm:px-10 sm:py-9 flex flex-col items-center text-center space-y-5">
          <div className="p-4 sm:p-5 rounded-[16px] bg-white border-4 border-warm-yellow shadow-[0_10px_30px_rgba(27,138,75,0.12)]">
            {qrPngUrl ? (
              <img
                src={qrPngUrl}
                alt={`QR code linking to ${shopUrl}`}
                data-testid="shop-qr-image"
                className="w-56 h-56 sm:w-64 sm:h-64 block"
              />
            ) : (
              <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-[12px] bg-soft-grey animate-pulse" />
            )}
          </div>

          <div className="rounded-[10px] bg-warm-yellow text-dark-ink px-5 py-2.5 font-heading font-bold text-sm sm:text-base">
            {t('qrPoster.posterComboHighlight')}
          </div>

          {/* 3-Step Visual Guide */}
          <div className="w-full max-w-lg rounded-[12px] bg-soft-grey border border-border-grey/80 p-4 text-left space-y-1.5">
            <p className="font-heading font-bold text-xs uppercase tracking-wider text-fresh-green">
              {t('qrPoster.posterStepsTitle')}
            </p>
            <p className="text-sm font-medium text-dark-ink">{t('qrPoster.posterStep1')}</p>
            <p className="text-sm font-medium text-dark-ink">{t('qrPoster.posterStep2')}</p>
            <p className="text-sm font-medium text-dark-ink">{t('qrPoster.posterStep3')}</p>
          </div>

          {/* Footer Contact & Stable URL */}
          <div className="w-full pt-3 border-t border-border-grey/70 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm text-muted-text">
            <span className="inline-flex items-center gap-1.5 font-semibold text-dark-ink tabular-nums">
              <Phone className="w-4 h-4 text-fresh-green" aria-hidden="true" />
              <span>{t('qrPoster.posterCallLine', { phone: STORE_PHONE_DISPLAY })}</span>
            </span>
            <span className="tabular-nums truncate max-w-full">
              {t('qrPoster.posterUrlLabel')}: <strong className="text-dark-ink">{shopUrl}</strong>
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
