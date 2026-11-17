import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Clock,
  Languages,
  LogIn,
  MapPin,
  Package,
  Search,
  ShoppingBag,
  Store,
  User as UserIcon,
  X,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useI18n } from '../../context/I18nContext';
import {
  getBrands,
  getSearchSuggestions,
  getTotalAvailableQty,
  resolveBrandName,
} from '../../services';
import type { Brand, Product } from '../../types';
import { formatINR } from '../../utils/format';
import { resolveProductImage } from '../../utils/productImages';
import { PRODUCT_TINT_CLASSES } from '../../utils/tints';

export function Header() {
  const { lang, toggleLang, t, bi } = useI18n();
  const { summary } = useCart();
  const { user, isLoggedIn, defaultAddress } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationLabel = defaultAddress
    ? t('header.locationPincode', { pincode: defaultAddress.pincode })
    : t('brand.locationDefault');
  const authLabel = isLoggedIn && user ? user.name.split(' ')[0] : t('header.login');
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';

  const [searchValue, setSearchValue] = useState(urlQuery);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const desktopSearchRef = useRef<HTMLFormElement>(null);
  const mobileSearchRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    void getBrands().then(setBrands);
  }, []);

  useEffect(() => {
    setSearchValue(urlQuery);
  }, [urlQuery]);

  // Close autocomplete dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname, location.search]);

  // Close autocomplete dropdown on outside click or Escape
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideDesktop = desktopSearchRef.current?.contains(target) ?? false;
      const insideMobile = mobileSearchRef.current?.contains(target) ?? false;
      if (!insideDesktop && !insideMobile) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Fetch live search suggestions as user types
  useEffect(() => {
    const trimmed = searchValue.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    let active = true;
    void getSearchSuggestions(trimmed, 6).then((items) => {
      if (active) {
        setSuggestions(items);
      }
    });
    return () => {
      active = false;
    };
  }, [searchValue]);

  const handleSearchChange = (nextValue: string) => {
    setSearchValue(nextValue);
    setDropdownOpen(nextValue.trim().length > 0);

    // If already on search or category page, sync query param live
    if (location.pathname === '/search' || location.pathname.startsWith('/category/')) {
      const nextParams = new URLSearchParams(searchParams);
      if (nextValue.trim()) {
        nextParams.set('q', nextValue);
      } else {
        nextParams.delete('q');
      }
      setSearchParams(nextParams, { replace: true });
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchValue.trim();
    setDropdownOpen(false);
    if (!trimmed) {
      if (location.pathname === '/search') {
        navigate('/category/all');
      }
      return;
    }
    if (location.pathname.startsWith('/category/')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('q', trimmed);
      setSearchParams(nextParams, { replace: true });
      return;
    }
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleClearSearch = () => {
    setSearchValue('');
    setSuggestions([]);
    setDropdownOpen(false);
    if (
      location.pathname === '/' ||
      location.pathname === '/search' ||
      location.pathname.startsWith('/category/')
    ) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('q');
      setSearchParams(nextParams, { replace: true });
    }
  };

  const handleSelectSuggestion = (productId: string) => {
    setDropdownOpen(false);
    navigate(`/product/${productId}`);
  };

  const handleViewAllResults = () => {
    const trimmed = searchValue.trim();
    setDropdownOpen(false);
    if (trimmed) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const renderSuggestionsDropdown = () => {
    const trimmed = searchValue.trim();
    if (!dropdownOpen || !trimmed) return null;

    return (
      <div
        role="listbox"
        aria-label={t('header.suggestionsTitle')}
        className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-white text-dark-ink rounded-[12px] border border-border-grey shadow-[0_12px_32px_rgba(17,24,39,0.14)] overflow-hidden"
      >
        <div className="px-3.5 py-2 bg-soft-grey border-b border-border-grey/70 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-text">
          <span>{t('header.suggestionsTitle')}</span>
          <span className="tabular-nums">{suggestions.length}</span>
        </div>

        {suggestions.length === 0 ? (
          <div className="px-4 py-5 text-sm text-muted-text text-center">
            {t('header.noSuggestions', { query: trimmed })}
          </div>
        ) : (
          <ul className="divide-y divide-border-grey/60 max-h-[340px] overflow-y-auto">
            {suggestions.map((item) => {
              const imgUrl = resolveProductImage(item.image);
              const avail = getTotalAvailableQty(item);
              const isOut = avail <= 0;
              const isLow = avail > 0 && avail <= 5;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => handleSelectSuggestion(item.id)}
                    className="w-full px-3.5 py-2.5 flex items-center gap-3 text-left hover:bg-light-green/60 transition-colors cursor-pointer min-h-[52px]"
                  >
                    <div
                      className={`w-10 h-10 rounded-[8px] ${PRODUCT_TINT_CLASSES[item.imageTint]} overflow-hidden flex items-center justify-center shrink-0`}
                    >
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-4 h-4 text-fresh-green" aria-hidden="true" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-dark-ink truncate">
                        {bi(item.name)}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-text">
                        <span className="truncate">
                          {resolveBrandName(item.brandId, brands)} · {item.packSize}
                        </span>
                        {isOut ? (
                          <span className="text-muted-text font-semibold shrink-0">
                            · {t('common.outOfStock')}
                          </span>
                        ) : isLow ? (
                          <span className="text-alert-red font-semibold shrink-0">
                            · {t('common.lowStock', { count: avail })}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <span className="text-sm font-bold text-dark-ink tabular-nums shrink-0">
                      {formatINR(item.price)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={handleViewAllResults}
          className="w-full px-4 py-2.5 bg-light-green hover:bg-fresh-green/15 text-fresh-green text-xs sm:text-sm font-semibold flex items-center justify-between border-t border-border-grey/70 cursor-pointer min-h-[44px]"
        >
          <span className="truncate">{t('header.viewAllResults', { query: trimmed })}</span>
          <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
        </button>
      </div>
    );
  };

  return (
    <header className="md:sticky md:top-0 z-30 bg-fresh-green text-white md:bg-white md:text-dark-ink md:border-b md:border-border-grey shadow-xs md:shadow-none">
      {/* Desktop Single-Row Header */}
      <div className="hidden md:flex max-w-7xl mx-auto px-6 h-[72px] items-center justify-between gap-4">
        <div className="flex items-center gap-4 shrink-0">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 text-fresh-green font-heading font-bold text-xl tracking-tight whitespace-nowrap shrink-0 min-h-[44px]"
          >
            <span className="w-9 h-9 rounded-[10px] bg-fresh-green text-white inline-flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" aria-hidden="true" />
            </span>
            <span>{t('brand.name')}</span>
          </Link>

          <Link
            to="/addresses"
            className="inline-flex items-center gap-2 min-h-[40px] px-3 py-1.5 rounded-[10px] bg-light-green text-fresh-green text-xs font-semibold hover:bg-fresh-green/15 transition-colors whitespace-nowrap shrink-0"
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{locationLabel}</span>
          </Link>
        </div>

        {/* Desktop Search Bar with Autocomplete */}
        <form
          ref={desktopSearchRef}
          onSubmit={handleSearchSubmit}
          role="search"
          className="flex-1 max-w-md relative"
        >
          <Search
            className="w-4 h-4 text-muted-text absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchValue}
            onFocus={() => {
              if (searchValue.trim().length > 0) setDropdownOpen(true);
            }}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('header.searchPlaceholder')}
            aria-label={t('header.searchLabel')}
            autoComplete="off"
            className="w-full h-11 pl-10 pr-10 rounded-[10px] bg-soft-grey border border-border-grey text-sm text-dark-ink placeholder:text-muted-text focus:bg-white focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20 transition-colors [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          />
          {searchValue && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label={t('header.clearSearch')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-[8px] flex items-center justify-center text-muted-text hover:text-dark-ink cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {renderSuggestionsDropdown()}
        </form>

        {/* Desktop Actions: Language Toggle, Login, Cart */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={toggleLang}
            aria-label={t('header.languageLabel')}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-[10px] border border-border-grey bg-soft-grey hover:border-fresh-green text-xs font-semibold text-dark-ink whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Languages className="w-4 h-4 text-fresh-green" aria-hidden="true" />
            <span>{lang === 'en' ? 'தமிழ்' : 'English'}</span>
          </button>

          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-[10px] border border-border-grey bg-white hover:border-fresh-green text-sm font-medium text-dark-ink whitespace-nowrap shrink-0 transition-colors"
          >
            <Package className="w-4 h-4 text-fresh-green" aria-hidden="true" />
            <span>{t('nav.orders')}</span>
          </Link>

          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-[10px] border border-border-grey bg-white hover:border-fresh-green text-sm font-medium text-dark-ink whitespace-nowrap shrink-0 transition-colors"
          >
            {isLoggedIn ? (
              <UserIcon className="w-4 h-4 text-fresh-green" aria-hidden="true" />
            ) : (
              <LogIn className="w-4 h-4 text-fresh-green" aria-hidden="true" />
            )}
            <span>{authLabel}</span>
          </Link>

          <Link
            to="/cart"
            aria-label={`${t('nav.cart')}: ${summary.totalUnits}`}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[10px] bg-fresh-green hover:bg-fresh-green-hover text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            <span className="tabular-nums">
              {summary.totalUnits > 0
                ? `${summary.totalUnits} · ${formatINR(summary.subtotal)}`
                : `${t('header.viewCart')} (0)`}
            </span>
          </Link>
        </div>
      </div>

      {/* Mobile Green Header with Location + Search */}
      <div className="md:hidden px-4 pt-3 pb-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <Link
              to="/"
              className="font-heading font-bold text-base tracking-tight text-white flex items-center gap-2 truncate"
            >
              <Store className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t('brand.name')}</span>
            </Link>
            <Link
              to="/addresses"
              className="inline-flex items-center gap-1.5 text-xs text-white/95 font-medium mt-0.5 truncate max-w-full"
            >
              <MapPin className="w-3.5 h-3.5 text-warm-yellow shrink-0" aria-hidden="true" />
              <span className="truncate">{locationLabel}</span>
              <Clock className="w-3 h-3 text-warm-yellow shrink-0 ml-0.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleLang}
              aria-label={t('header.languageLabel')}
              className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-[10px] bg-white/15 hover:bg-white/25 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{lang === 'en' ? 'தமிழ்' : 'EN'}</span>
            </button>

            <Link
              to="/login"
              aria-label={authLabel}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-2.5 rounded-[10px] bg-white/15 hover:bg-white/25 text-xs font-semibold text-white whitespace-nowrap shrink-0"
            >
              {isLoggedIn ? (
                <UserIcon className="w-4 h-4" aria-hidden="true" />
              ) : (
                <LogIn className="w-4 h-4" aria-hidden="true" />
              )}
            </Link>
          </div>
        </div>

        <form ref={mobileSearchRef} onSubmit={handleSearchSubmit} role="search" className="relative">
          <Search
            className="w-4 h-4 text-muted-text absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchValue}
            onFocus={() => {
              if (searchValue.trim().length > 0) setDropdownOpen(true);
            }}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('header.searchPlaceholder')}
            aria-label={t('header.searchLabel')}
            autoComplete="off"
            className="w-full min-h-[44px] pl-10 pr-10 rounded-[10px] bg-white text-sm text-dark-ink placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-warm-yellow [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          />
          {searchValue && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label={t('header.clearSearch')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-[8px] flex items-center justify-center text-muted-text hover:text-dark-ink cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {renderSuggestionsDropdown()}
        </form>
      </div>
    </header>
  );
}
