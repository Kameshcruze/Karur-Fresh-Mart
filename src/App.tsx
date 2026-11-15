import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AdminRouteGuard } from './components/admin/AdminRouteGuard';
import { AdminShell, AppShell, DeliveryShell } from './components/layout';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { I18nProvider } from './context/I18nContext';
import { AddressesPage } from './pages/AddressesPage';
import {
  AdminCombosPage,
  AdminOffersQrPage,
  AdminStockPage,
} from './pages/admin/AdminCatalogPages';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminLiveCartsPage } from './pages/admin/AdminLiveCartsPage';
import {
  AdminCustomersPage,
  AdminDeliveryStaffPage,
  AdminPaymentsPage,
  AdminSettingsPage,
} from './pages/admin/AdminOperationsPages';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { CartPage } from './pages/CartPage';
import { CategoryPage } from './pages/CategoryPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ComboPage } from './pages/ComboPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { OrderInvoicePage } from './pages/OrderInvoicePage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { PublicShopPage } from './pages/PublicShopPage';
import { ShopQrPosterPage } from './pages/ShopQrPosterPage';
import { SkeletonPage } from './pages/SkeletonPage';

function CustomerLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AdminLayout() {
  return (
    <AdminRouteGuard>
      <AdminShell>
        <Outlet />
      </AdminShell>
    </AdminRouteGuard>
  );
}

function DeliveryLayout() {
  return (
    <DeliveryShell>
      <Outlet />
    </DeliveryShell>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              {/* Customer Storefront Routes */}
              <Route element={<CustomerLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/category/:slug" element={<CategoryPage />} />
                <Route path="/search" element={<CategoryPage />} />
                <Route path="/product/:id" element={<ProductDetailPage />} />
                <Route path="/combo/:type" element={<ComboPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/addresses" element={<AddressesPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/orders/:id" element={<OrderTrackingPage />} />
                <Route path="/orders/:id/invoice" element={<OrderInvoicePage />} />
              <Route
                path="/account"
                element={<SkeletonPage titleKey="routes.accountTitle" />}
              />
            </Route>

            {/* Public QR-Wall Offers & Printable A4 Poster (Lightweight, No Login Required) */}
            <Route path="/shop" element={<PublicShopPage />} />
            <Route path="/shop/poster" element={<ShopQrPosterPage />} />

            {/* Admin (Store Owner) Routes - Role Protected */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="live-carts" element={<AdminLiveCartsPage />} />
              <Route path="stock" element={<AdminStockPage />} />
              <Route path="products" element={<Navigate to="/admin/stock" replace />} />
              <Route path="inventory" element={<Navigate to="/admin/stock" replace />} />
              <Route path="combos" element={<AdminCombosPage />} />
              <Route path="offers" element={<AdminOffersQrPage />} />
              <Route path="delivery" element={<AdminDeliveryStaffPage />} />
              <Route path="customers" element={<AdminCustomersPage />} />
              <Route path="payments" element={<AdminPaymentsPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>

            {/* Delivery Partner Routes */}
            <Route path="/delivery" element={<DeliveryLayout />}>
              <Route
                index
                element={<SkeletonPage titleKey="routes.deliveryHomeTitle" role="delivery" backTo="/delivery" />}
              />
              <Route
                path="orders"
                element={<SkeletonPage titleKey="routes.deliveryOrdersTitle" role="delivery" backTo="/delivery" />}
              />
              <Route
                path="orders/:id"
                element={<SkeletonPage titleKey="routes.deliveryOrderDetailTitle" role="delivery" backTo="/delivery" />}
              />
              <Route
                path="history"
                element={<SkeletonPage titleKey="routes.deliveryHistoryTitle" role="delivery" backTo="/delivery" />}
              />
              <Route
                path="profile"
                element={<SkeletonPage titleKey="routes.deliveryProfileTitle" role="delivery" backTo="/delivery" />}
              />
              <Route path="*" element={<Navigate to="/delivery" replace />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
