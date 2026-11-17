import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Megaphone, Plus, Tag, Ticket, Trash2 } from 'lucide-react';
import { ShopQrPosterCard } from '../../components/qr/ShopQrPosterCard';
import { Badge, Button, Card, ErrorStateCard, ListSkeleton } from '../../components/ui';
import { useI18n } from '../../context/I18nContext';
import {
  deleteBanner,
  deleteCoupon,
  deleteOffer,
  getBanners,
  getCoupons,
  getOffers,
  saveBanner,
  saveCoupon,
  saveOffer,
} from '../../services';
import type { Banner, Coupon, Offer } from '../../types';

function formatWindowLabel(
  startDate: string | undefined,
  endDate: string | undefined,
  t: ReturnType<typeof useI18n>['t'],
): string {
  if (!startDate && !endDate) return t('admin.alwaysActiveWindow');
  return t('admin.validityWindowLabel', {
    start: startDate || t('admin.statusActiveChip'),
    end: endDate || t('admin.alwaysActiveWindow'),
  });
}

export function AdminOffersQrPage() {
  const { t, bi } = useI18n();
  const [subTab, setSubTab] = useState<'offers' | 'coupons' | 'banners'>('offers');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Offer creation form
  const [offerTitle, setOfferTitle] = useState('');
  const [offerSubtitle, setOfferSubtitle] = useState('');
  const [offerBadge, setOfferBadge] = useState('15% OFF');
  const [offerType, setOfferType] = useState<'percent' | 'flat'>('percent');
  const [offerValue, setOfferValue] = useState('15');
  const [offerMinOrder, setOfferMinOrder] = useState('499');
  const [offerStartDate, setOfferStartDate] = useState('2026-11-01');
  const [offerEndDate, setOfferEndDate] = useState('2026-12-31');

  // Coupon creation form
  const [couponCode, setCouponCode] = useState('');
  const [couponDesc, setCouponDesc] = useState('');
  const [couponType, setCouponType] = useState<'percent' | 'flat'>('flat');
  const [couponValue, setCouponValue] = useState('75');
  const [couponMaxDiscount, setCouponMaxDiscount] = useState('150');
  const [couponMinOrder, setCouponMinOrder] = useState('699');
  const [couponStartDate, setCouponStartDate] = useState('2026-11-01');
  const [couponEndDate, setCouponEndDate] = useState('2026-12-31');

  // Banner creation form
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [bannerCta, setBannerCta] = useState('Shop Now');
  const [bannerRoute, setBannerRoute] = useState('/category/rice-and-grains');
  const [bannerTone, setBannerTone] = useState<'green' | 'yellow' | 'forest'>('green');
  const [bannerStartDate, setBannerStartDate] = useState('2026-11-01');
  const [bannerEndDate, setBannerEndDate] = useState('2026-12-31');

  const loadData = useCallback(async () => {
    try {
      const [offerList, couponList, bannerList] = await Promise.all([
        getOffers(false),
        getCoupons(false),
        getBanners(false),
      ]);
      setOffers(offerList);
      setCoupons(couponList);
      setBanners(bannerList);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = offerTitle.trim();
    if (!title) return;
    const badge = offerBadge.trim() || `${offerValue}% OFF`;
    await saveOffer({
      id: `offer-${Date.now().toString(36)}`,
      title: { en: title, ta: title },
      subtitle: {
        en: offerSubtitle.trim() || `Save on Karur groceries above ₹${offerMinOrder || 0}`,
        ta: offerSubtitle.trim() || `₹${offerMinOrder || 0} மேல் ஆர்டருக்கு சலுகை`,
      },
      badgeText: { en: badge, ta: badge },
      discountType: offerType,
      discountValue: Math.max(1, Number(offerValue) || 10),
      minOrderAmount: Math.max(0, Number(offerMinOrder) || 0),
      startDate: offerStartDate || undefined,
      endDate: offerEndDate || undefined,
      validTill: offerEndDate || '2026-12-31',
      active: true,
    });
    setOfferTitle('');
    setOfferSubtitle('');
    await loadData();
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    await saveCoupon({
      code,
      description: {
        en: couponDesc.trim() || `Save with ${code} on orders above ₹${couponMinOrder || 0}`,
        ta: couponDesc.trim() || `${code} கூப்பன் சலுகை`,
      },
      discountType: couponType,
      discountValue: Math.max(1, Number(couponValue) || 50),
      maxDiscount:
        couponType === 'percent' && Number(couponMaxDiscount) > 0
          ? Number(couponMaxDiscount)
          : undefined,
      minOrderAmount: Math.max(0, Number(couponMinOrder) || 0),
      startDate: couponStartDate || undefined,
      endDate: couponEndDate || undefined,
      active: true,
    });
    setCouponCode('');
    setCouponDesc('');
    await loadData();
  };

  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = bannerTitle.trim();
    if (!title) return;
    await saveBanner({
      id: `banner-${Date.now().toString(36)}`,
      title: { en: title, ta: title },
      subtitle: {
        en: bannerSubtitle.trim() || 'Delivered across Karur in 45 minutes',
        ta: bannerSubtitle.trim() || 'கரூர் முழுவதும் 45 நிமிடங்களில் டெலிவரி',
      },
      ctaLabel: { en: bannerCta.trim() || 'Shop Now', ta: bannerCta.trim() || 'வாங்கு' },
      ctaRoute: bannerRoute.trim() || '/offers',
      tone: bannerTone,
      startDate: bannerStartDate || undefined,
      endDate: bannerEndDate || undefined,
      active: true,
    });
    setBannerTitle('');
    setBannerSubtitle('');
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden space-y-5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-dark-ink">
            {t('admin.offersQrPageTitle')}
          </h1>
          <p className="text-sm text-muted-text mt-0.5">{t('admin.offersQrPageSubtitle')}</p>
        </div>

        {/* Sub-tabs: Discounts | Coupons | Banners */}
        <div role="tablist" className="flex flex-wrap gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'offers'}
            onClick={() => setSubTab('offers')}
            className={[
              'min-h-[40px] px-4 rounded-[10px] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer',
              subTab === 'offers'
                ? 'bg-fresh-green text-white'
                : 'bg-white border border-border-grey text-dark-ink hover:bg-soft-grey',
            ].join(' ')}
          >
            <Tag className="w-4 h-4" aria-hidden="true" />
            <span>{t('admin.tabDiscounts', { count: offers.length })}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'coupons'}
            onClick={() => setSubTab('coupons')}
            className={[
              'min-h-[40px] px-4 rounded-[10px] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer',
              subTab === 'coupons'
                ? 'bg-fresh-green text-white'
                : 'bg-white border border-border-grey text-dark-ink hover:bg-soft-grey',
            ].join(' ')}
          >
            <Ticket className="w-4 h-4" aria-hidden="true" />
            <span>{t('admin.tabCoupons', { count: coupons.length })}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'banners'}
            onClick={() => setSubTab('banners')}
            className={[
              'min-h-[40px] px-4 rounded-[10px] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer',
              subTab === 'banners'
                ? 'bg-fresh-green text-white'
                : 'bg-white border border-border-grey text-dark-ink hover:bg-soft-grey',
            ].join(' ')}
          >
            <Megaphone className="w-4 h-4" aria-hidden="true" />
            <span>{t('admin.tabBanners', { count: banners.length })}</span>
          </button>
        </div>

        {loading ? (
          <ListSkeleton rows={3} rowHeightClass="h-24" />
        ) : hasError ? (
          <ErrorStateCard
            title={t('a11y.loadErrorTitle')}
            subtitle={t('a11y.loadErrorSubtitle')}
            retryLabel={t('a11y.retry')}
            onRetry={() => void loadData()}
          />
        ) : (
          <>
        {/* DISCOUNTS (OFFERS) TAB */}
        {subTab === 'offers' && (
          <div className="space-y-4">
            <Card padding="md" className="space-y-3">
              <h2 className="font-heading font-bold text-base text-dark-ink">
                {t('admin.createOfferTitle')}
              </h2>
              <form onSubmit={(e) => void handleCreateOffer(e)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="offer-title-en" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.offerTitleEn')} *
                  </label>
                  <input
                    id="offer-title-en"
                    type="text"
                    required
                    value={offerTitle}
                    onChange={(e) => setOfferTitle(e.target.value)}
                    placeholder="e.g. Weekend Spice Saver"
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="offer-subtitle-en" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.offerSubtitleEn')}
                  </label>
                  <input
                    id="offer-subtitle-en"
                    type="text"
                    value={offerSubtitle}
                    onChange={(e) => setOfferSubtitle(e.target.value)}
                    placeholder="On Shakthi & Ramkumar masalas"
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="offer-badge" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.offerBadgeText')}
                  </label>
                  <input
                    id="offer-badge"
                    type="text"
                    value={offerBadge}
                    onChange={(e) => setOfferBadge(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="offer-type" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.discountTypeLabel')}
                    </label>
                    <select
                      id="offer-type"
                      value={offerType}
                      onChange={(e) => setOfferType(e.target.value as 'percent' | 'flat')}
                      className="w-full min-h-[40px] px-2 rounded-[8px] border border-border-grey bg-white text-xs font-semibold"
                    >
                      <option value="percent">{t('admin.discountTypePercent')}</option>
                      <option value="flat">{t('admin.discountTypeFlat')}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="offer-value" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.discountValueLabel')}
                    </label>
                    <input
                      id="offer-value"
                      type="number"
                      min={1}
                      value={offerValue}
                      onChange={(e) => setOfferValue(e.target.value)}
                      className="w-full min-h-[40px] px-2.5 rounded-[8px] border border-border-grey bg-white text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="offer-min" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.minOrderLabel')}
                  </label>
                  <input
                    id="offer-min"
                    type="number"
                    min={0}
                    value={offerMinOrder}
                    onChange={(e) => setOfferMinOrder(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="offer-start" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.startDateLabel')}
                  </label>
                  <input
                    id="offer-start"
                    type="date"
                    value={offerStartDate}
                    onChange={(e) => setOfferStartDate(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="offer-end" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.endDateLabel')}
                  </label>
                  <input
                    id="offer-end"
                    type="date"
                    value={offerEndDate}
                    onChange={(e) => setOfferEndDate(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    fullWidth
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    {t('admin.saveOfferCta')}
                  </Button>
                </div>
              </form>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offers.map((offer) => (
                <Card key={offer.id} className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-[10px] bg-warm-yellow/25 text-dark-ink flex items-center justify-center shrink-0">
                      <Tag className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-heading font-bold text-sm text-dark-ink">
                          {bi(offer.title)}
                        </h3>
                        <Badge tone={offer.active ? 'green' : 'neutral'}>
                          {bi(offer.badgeText)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-text mt-1">{bi(offer.subtitle)}</p>
                      <p className="text-[11px] text-muted-text mt-1.5 inline-flex items-center gap-1 tabular-nums">
                        <Calendar className="w-3 h-3" aria-hidden="true" />
                        <span>
                          {formatWindowLabel(offer.startDate, offer.endDate ?? offer.validTill, t)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void saveOffer({ ...offer, active: !offer.active }).then(loadData)}
                    >
                      {offer.active ? t('admin.statusActiveChip') : t('admin.statusPausedChip')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`${t('admin.deleteCta')} ${bi(offer.title)}`}
                      onClick={() => void deleteOffer(offer.id).then(loadData)}
                      className="text-alert-red hover:bg-alert-red/10 px-2"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* COUPONS TAB */}
        {subTab === 'coupons' && (
          <div className="space-y-4">
            <Card padding="md" className="space-y-3">
              <h2 className="font-heading font-bold text-base text-dark-ink">
                {t('admin.createCouponTitle')}
              </h2>
              <form onSubmit={(e) => void handleCreateCoupon(e)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="coupon-code" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.couponCodeLabel')} *
                  </label>
                  <input
                    id="coupon-code"
                    type="text"
                    required
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="e.g. KARUR75"
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm font-bold uppercase"
                  />
                </div>

                <div>
                  <label htmlFor="coupon-desc" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.couponDescLabel')}
                  </label>
                  <input
                    id="coupon-desc"
                    type="text"
                    value={couponDesc}
                    onChange={(e) => setCouponDesc(e.target.value)}
                    placeholder="Flat ₹75 off on orders above ₹699"
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="coupon-type" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.discountTypeLabel')}
                    </label>
                    <select
                      id="coupon-type"
                      value={couponType}
                      onChange={(e) => setCouponType(e.target.value as 'percent' | 'flat')}
                      className="w-full min-h-[40px] px-2 rounded-[8px] border border-border-grey bg-white text-xs font-semibold"
                    >
                      <option value="flat">{t('admin.discountTypeFlat')}</option>
                      <option value="percent">{t('admin.discountTypePercent')}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="coupon-value" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.discountValueLabel')}
                    </label>
                    <input
                      id="coupon-value"
                      type="number"
                      min={1}
                      value={couponValue}
                      onChange={(e) => setCouponValue(e.target.value)}
                      className="w-full min-h-[40px] px-2.5 rounded-[8px] border border-border-grey bg-white text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="coupon-min" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.minOrderLabel')}
                    </label>
                    <input
                      id="coupon-min"
                      type="number"
                      min={0}
                      value={couponMinOrder}
                      onChange={(e) => setCouponMinOrder(e.target.value)}
                      className="w-full min-h-[40px] px-2.5 rounded-[8px] border border-border-grey bg-white text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="coupon-max" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.maxDiscountLabel')}
                    </label>
                    <input
                      id="coupon-max"
                      type="number"
                      min={0}
                      disabled={couponType === 'flat'}
                      value={couponMaxDiscount}
                      onChange={(e) => setCouponMaxDiscount(e.target.value)}
                      className="w-full min-h-[40px] px-2.5 rounded-[8px] border border-border-grey bg-white text-sm tabular-nums disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="coupon-start" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.startDateLabel')}
                  </label>
                  <input
                    id="coupon-start"
                    type="date"
                    value={couponStartDate}
                    onChange={(e) => setCouponStartDate(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="coupon-end" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.endDateLabel')}
                  </label>
                  <input
                    id="coupon-end"
                    type="date"
                    value={couponEndDate}
                    onChange={(e) => setCouponEndDate(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                  />
                </div>

                <div className="sm:col-span-2 flex items-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    {t('admin.saveCouponCta')}
                  </Button>
                </div>
              </form>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coupons.map((c) => (
                <Card key={c.code} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-bold text-base text-fresh-green">
                        {c.code}
                      </span>
                      <Badge tone={c.active ? 'green' : 'neutral'}>
                        {c.discountType === 'flat' ? `₹${c.discountValue} OFF` : `${c.discountValue}% OFF`}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-text mt-1">{bi(c.description)}</p>
                    <p className="text-[11px] text-muted-text mt-1 tabular-nums">
                      {t('admin.offerMinOrderChip')} ₹{c.minOrderAmount} · {formatWindowLabel(c.startDate, c.endDate, t)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void saveCoupon({ ...c, active: !c.active }).then(loadData)}
                    >
                      {c.active ? t('admin.statusActiveChip') : t('admin.statusPausedChip')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`${t('admin.deleteCta')} ${c.code}`}
                      onClick={() => void deleteCoupon(c.code).then(loadData)}
                      className="text-alert-red hover:bg-alert-red/10 px-2"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* BANNERS TAB */}
        {subTab === 'banners' && (
          <div className="space-y-4">
            <Card padding="md" className="space-y-3">
              <h2 className="font-heading font-bold text-base text-dark-ink">
                {t('admin.createBannerTitle')}
              </h2>
              <form onSubmit={(e) => void handleCreateBanner(e)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="banner-title" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.bannerTitleLabel')} *
                  </label>
                  <input
                    id="banner-title"
                    type="text"
                    required
                    value={bannerTitle}
                    onChange={(e) => setBannerTitle(e.target.value)}
                    placeholder="e.g. Pongal Harvest Rice Festival"
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="banner-subtitle" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.bannerSubtitleLabel')}
                  </label>
                  <input
                    id="banner-subtitle"
                    type="text"
                    value={bannerSubtitle}
                    onChange={(e) => setBannerSubtitle(e.target.value)}
                    placeholder="Fresh mill-direct 10 kg bags at ₹680"
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="banner-cta" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.bannerCtaLabel')}
                  </label>
                  <input
                    id="banner-cta"
                    type="text"
                    value={bannerCta}
                    onChange={(e) => setBannerCta(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="banner-route" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.bannerRouteLabel')}
                  </label>
                  <input
                    id="banner-route"
                    type="text"
                    value={bannerRoute}
                    onChange={(e) => setBannerRoute(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="banner-tone" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.bannerToneLabel')}
                  </label>
                  <select
                    id="banner-tone"
                    value={bannerTone}
                    onChange={(e) =>
                      setBannerTone(e.target.value as 'green' | 'yellow' | 'forest')
                    }
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm font-semibold"
                  >
                    <option value="green">{t('admin.toneGreen')}</option>
                    <option value="yellow">{t('admin.toneYellow')}</option>
                    <option value="forest">{t('admin.toneDark')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="banner-start" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.startDateLabel')}
                  </label>
                  <input
                    id="banner-start"
                    type="date"
                    value={bannerStartDate}
                    onChange={(e) => setBannerStartDate(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="banner-end" className="block text-xs font-semibold text-dark-ink mb-1">
                    {t('admin.endDateLabel')}
                  </label>
                  <input
                    id="banner-end"
                    type="date"
                    value={bannerEndDate}
                    onChange={(e) => setBannerEndDate(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4 flex justify-end pt-1">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    {t('admin.saveBannerCta')}
                  </Button>
                </div>
              </form>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banners.map((b) => (
                <Card key={b.id} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-heading font-bold text-sm text-dark-ink">
                        {bi(b.title)}
                      </h3>
                      <Badge
                        tone={
                          b.tone === 'yellow' ? 'yellow' : b.tone === 'forest' ? 'dark' : 'green'
                        }
                      >
                        {b.tone === 'yellow'
                          ? t('admin.toneYellow')
                          : b.tone === 'forest'
                            ? t('admin.toneDark')
                            : t('admin.toneGreen')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-text mt-1">{bi(b.subtitle)}</p>
                    <p className="text-[11px] text-muted-text mt-1 tabular-nums">
                      {t('admin.ctaPrefix')} {bi(b.ctaLabel)} ({b.ctaRoute}) · {formatWindowLabel(b.startDate, b.endDate, t)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void saveBanner({ ...b, active: !b.active }).then(loadData)}
                    >
                      {b.active ? t('admin.statusActiveChip') : t('admin.statusPausedChip')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`${t('admin.deleteCta')} ${bi(b.title)}`}
                      onClick={() => void deleteBanner(b.id).then(loadData)}
                      className="text-alert-red hover:bg-alert-red/10 px-2"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Permanent Printable A4 QR Poster & PNG Downloader */}
      <ShopQrPosterCard showShopPreviewLink />
    </div>
  );
}
