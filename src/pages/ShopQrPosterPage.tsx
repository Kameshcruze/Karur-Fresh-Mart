import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ShopQrPosterCard } from '../components/qr/ShopQrPosterCard';
import { useI18n } from '../context/I18nContext';

export function ShopQrPosterPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-soft-grey print:bg-white py-6 px-4 sm:px-6 print:p-0">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-[8px] focus:bg-deep-forest focus:text-white focus:text-sm focus:font-semibold focus:shadow-lg print:hidden"
      >
        {t('a11y.skipToContent')}
      </a>
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-4xl mx-auto space-y-5 print:max-w-none print:space-y-0 focus:outline-none"
      >
        <div className="print:hidden">
          <Link
            to="/shop"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-fresh-green hover:underline min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>{t('qrPoster.backToStore')}</span>
          </Link>
        </div>

        <ShopQrPosterCard showShopPreviewLink titleAsHeading="h1" />
      </main>
    </div>
  );
}
