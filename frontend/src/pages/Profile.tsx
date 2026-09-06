import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, BadgeCheck, BarChart3, Bell, BellOff, Building2, ClipboardList, Edit3, ExternalLink,
  Leaf, LogOut, Moon, Package, Plus, Save, Settings2, ShoppingBag, Sprout,
  Store, Sun, UserRound, X,
} from "lucide-react";
import toast from "react-hot-toast";

import { agricultureApi, ordersApi, webPushApi } from "../api/services";
import { ACCOUNT_ITEMS, visibleItems } from "../config/navigation";
import AvatarUploader from "../components/AvatarUploader";
import FarmPanel from "../components/farm/FarmPanel";
import LocationPicker from "../components/LocationPicker";
import { LANGUAGES, useTranslation } from "../i18n";
import { useAuthStore, useUserLevel } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import type { MarketplaceListing, Order, Storefront } from "../types";
import { formatPrice } from "../utils/formatPrice";
import { cn } from "../utils/cn";
import { normalizePhoneNumber } from "../utils/normalizeDigits";

type Tab = "overview" | "buyer" | "seller" | "farm" | "settings";

interface ProfileForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
}

const emptyStore = { name: "", slug: "", seller_type: "farmer" as Storefront["seller_type"], bio: "", province: "", city: "" };
export default function Profile() {
  const { user, account, isAuthenticated, isLoading, isSessionChecked, logout, fetchProfile, updateProfile } = useAuthStore();
  const level = useUserLevel();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    return fromUrl === "seller" || fromUrl === "farm" ? fromUrl : "overview";
  });
  const [profileForm, setProfileForm] = useState<ProfileForm>({ first_name: "", last_name: "", email: "", phone: "", address: "" });
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loadingSeller, setLoadingSeller] = useState(false);
  const [storeForm, setStoreForm] = useState(emptyStore);
  const [creatingStore, setCreatingStore] = useState(false);

  const syncProfileForm = useCallback(() => {
    setProfileForm({
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      email: user?.email || "",
      phone: account?.phone || "",
      address: account?.address || "",
    });
  }, [user, account]);

  const loadSeller = useCallback(async () => {
    setLoadingSeller(true);
    try {
      const storeResponse = await agricultureApi.getStorefront();
      setStorefront(storeResponse.data);
      if (storeResponse.data) {
        const listingsResponse = await agricultureApi.myListings();
        setListings(listingsResponse.data);
      } else {
        setListings([]);
      }
    } catch {
      toast.error("دریافت اطلاعات غرفه با خطا روبه‌رو شد.");
    } finally {
      setLoadingSeller(false);
    }
  }, []);

  useEffect(() => {
    if (!isSessionChecked) return;
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }
    fetchProfile();
  }, [isSessionChecked, isAuthenticated, navigate, fetchProfile]);

  useEffect(() => {
    syncProfileForm();
  }, [syncProfileForm]);

  useEffect(() => {
    if (isAuthenticated) {
      ordersApi.mine().then((response) => setOrders(response.data)).catch(() => undefined);
      loadSeller();
    }
  }, [isAuthenticated, loadSeller]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile(profileForm);
      setEditing(false);
      toast.success(t("account.profileSaved"));
    } catch {
      // API client reports a detailed error.
    } finally {
      setSavingProfile(false);
    }
  }

  async function createStore(event: FormEvent) {
    event.preventDefault();
    setCreatingStore(true);
    try {
      const response = await agricultureApi.createStorefront(storeForm);
      setStorefront(response.data);
      setStoreForm(emptyStore);
      toast.success(t("account.storeCreated"));
    } catch {
      // API client reports a detailed error.
    } finally {
      setCreatingStore(false);
    }
  }

  /**
   * "غرفه و فروش" from حساب من.
   *
   * With a غرفه the seller belongs on their own غرفه page — that is where
   * آگهی‌ها, پست‌ها and استوری‌ها are published and managed. Without one there
   * is nothing to open yet, so the tab shows the ثبت غرفه form instead.
   */
  function openSellerSection() {
    if (storefront) {
      navigate(`/storefronts/${storefront.slug}`);
      return;
    }
    setTab("seller");
  }

  async function signOut() {
    await logout();
    navigate("/");
  }

  if (!isSessionChecked || !isAuthenticated || isLoading) {
    return <main className="flex min-h-[55dvh] items-center justify-center"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" /><p className="mt-4 text-sm text-slate-500">{t("common.loading")}</p></div></main>;
  }

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "—";
  const pendingOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
  const activeListings = listings.filter((listing) => listing.status === "published");
  const navItems: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview", label: t("account.overview"), icon: BarChart3 },
    { id: "buyer", label: t("account.buyer"), icon: ShoppingBag },
    { id: "seller", label: t("account.seller"), icon: Store },
    { id: "farm", label: t("account.farm"), icon: Sprout },
    { id: "settings", label: t("account.settings"), icon: Settings2 },
  ];

  return (
    <main className="min-h-dvh bg-gradient-to-b from-emerald-50 via-[#f8faf6] to-white px-[var(--page-gutter)] py-6 dark:from-emerald-950 dark:via-[#062d21] dark:to-emerald-950 md:py-8">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-l from-emerald-800 via-emerald-700 to-lime-600 p-5 text-white shadow-xl shadow-emerald-900/15 sm:p-6 md:p-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              <AvatarUploader fallback={fullName.charAt(0)} />
              <div className="min-w-0 flex-1">
                <p className="text-fluid-xs text-lime-200">{t("account.title")}</p>
                <h1 className="mt-1 truncate text-fluid-xl font-extrabold">{fullName}</h1>
                <p className="mt-1 truncate text-fluid-xs text-emerald-100">{user?.email || user?.username}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex min-h-9 items-center rounded-full bg-white/15 px-3 text-fluid-xs font-bold"><UserRound size={14} className="me-1 inline" />{account?.level_label || t("role.buyer")}</span>
              {storefront && <span className="flex min-h-9 items-center rounded-full bg-lime-300/20 px-3 text-fluid-xs font-bold text-lime-100"><Store size={14} className="me-1 inline" />{t("role.seller")}</span>}
              <button onClick={signOut} className="flex min-h-11 items-center rounded-full bg-white/15 px-4 text-fluid-xs font-bold transition hover:bg-white/25"><LogOut size={14} className="me-1 inline" />{t("account.signout")}</button>
            </div>
          </div>
        </section>

        {/*
          حساب فقط همین پنج تب نیست: پاداش، دفتر مالی، استودیو غرفه و پیام‌ها مقصد‌هایی
          هستند که کاربر همین‌جا انتظارشان را دارد. از همان فهرستِ منو خوانده می‌شوند تا
          هیچ‌وقت از هم جدا نیفتند، و در موبایل در یک ردیف کشویی می‌ایستند تا چیزی پشت
          لبه پنهان نماند.
        */}
        <nav aria-label="میان‌برهای حساب" className="no-scrollbar mt-5 flex snap-x gap-2 overflow-x-auto pb-1">
          {visibleItems(ACCOUNT_ITEMS, { level, isAuthenticated }).filter((item) => item.id !== "profile").map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className="flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-2xl border border-emerald-100 bg-white px-3.5 text-fluid-xs font-bold text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100 sm:text-fluid-sm"
            >
              <item.icon size={16} className="shrink-0 text-emerald-600 dark:text-lime-300" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 grid min-w-0 gap-5 md:mt-6 md:gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="h-fit min-w-0 rounded-3xl border border-emerald-100 bg-white p-2.5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-3 lg:sticky lg:top-[calc(var(--header-height)+1rem)]">
            <nav
              className="no-scrollbar flex snap-x gap-2 overflow-x-auto lg:flex-col lg:overflow-visible"
              aria-label="Account sections"
            >
              {navItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  aria-current={tab === id ? "page" : undefined}
                  className={`flex min-h-12 shrink-0 snap-start items-center gap-2.5 whitespace-nowrap rounded-2xl px-3.5 text-fluid-sm font-bold transition sm:gap-3 sm:px-4 lg:w-full ${tab === id ? "bg-emerald-600 text-white shadow-md" : "text-slate-600 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900/50"}`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </nav>
            <div className="mt-3 rounded-2xl bg-emerald-50 p-4 text-xs leading-6 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">
              <Leaf size={16} className="mb-1" />
              حساب شما می‌تواند هم‌زمان خریدار و فروشنده باشد؛ نقش فروشنده با ساخت غرفه فعال می‌شود.
            </div>
          </aside>

          <section className="min-w-0">
            {tab === "overview" && <Overview orders={orders} pendingOrders={pendingOrders.length} storefront={storefront} activeListings={activeListings.length} onBuyer={() => setTab("buyer")} onSeller={openSellerSection} t={t} />}
            {tab === "buyer" && <BuyerPanel orders={orders} t={t} />}
            {tab === "seller" && <SellerPanel storefront={storefront} listings={listings} loading={loadingSeller} storeForm={storeForm} setStoreForm={setStoreForm} creatingStore={creatingStore} onCreateStore={createStore} t={t} />}
            {tab === "farm" && <FarmPanel />}
            {tab === "settings" && <SettingsPanel form={profileForm} setForm={setProfileForm} editing={editing} setEditing={setEditing} saving={savingProfile} onSave={saveProfile} onCancel={() => { syncProfileForm(); setEditing(false); }} t={t} username={user?.username || ""} />}
          </section>
        </div>
      </div>
    </main>
  );
}

function Overview({ orders, pendingOrders, storefront, activeListings, onBuyer, onSeller, t }: { orders: Order[]; pendingOrders: number; storefront: Storefront | null; activeListings: number; onBuyer: () => void; onSeller: () => void; t: (key: string) => string }) {
  return <div className="space-y-6"><div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"><Stat icon={ClipboardList} label={t("account.orders")} value={orders.length.toLocaleString("fa-IR")} /><Stat icon={Package} label="سفارش‌های جاری" value={pendingOrders.toLocaleString("fa-IR")} /><Stat icon={Store} label={t("account.store")} value={storefront ? "فعال" : "—"} /><Stat icon={Building2} label="آگهی منتشرشده" value={activeListings.toLocaleString("fa-IR")} /></div><div className="grid gap-6 lg:grid-cols-2"><Panel title={t("account.buyer")} text={t("account.buyerDescription")} icon={ShoppingBag} action={t("account.openOrders")} onClick={onBuyer} /><Panel title={t("account.seller")} text={t("account.sellerDescription")} icon={Store} action={storefront ? t("account.store") : t("account.createStore")} onClick={onSeller} /></div><section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold text-slate-800 dark:text-white">آخرین سفارش‌ها</h2><Link to="/orders" className="inline-flex min-h-11 items-center text-fluid-sm font-bold text-emerald-700 dark:text-lime-300">{t("common.viewAll")}</Link></div>{orders.length ? <div className="mt-4 divide-y divide-slate-100 dark:divide-emerald-900">{orders.slice(0, 3).map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"><div><strong className="text-slate-800 dark:text-white" dir="ltr">{order.code}</strong><p className="mt-1 text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString("fa-IR")}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-100">{order.status_label}</span><strong className="text-emerald-700 dark:text-lime-300">{formatPrice(order.total_price)}</strong></div>)}</div> : <Empty text={t("account.noOrders")} />}</section></div>;
}

function BuyerPanel({ orders, t }: { orders: Order[]; t: (key: string) => string }) {
  return <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">{t("account.buyer")}</h2><p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">{t("account.buyerDescription")}</p></div><Link to="/orders" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-bold text-white">{t("account.openOrders")}</Link></div>{orders.length ? <div className="mt-6 space-y-3">{orders.map((order) => <article key={order.id} className="rounded-2xl border border-slate-100 p-4 dark:border-emerald-900"><div className="flex flex-wrap justify-between gap-3"><div><strong dir="ltr" className="text-slate-800 dark:text-white">{order.code}</strong><p className="mt-1 text-xs text-slate-500">{order.total_items} کالا · {new Date(order.created_at).toLocaleDateString("fa-IR")}</p></div><div className="text-end"><span className="block text-xs text-slate-500">{order.status_label}</span><strong className="mt-1 block text-emerald-700 dark:text-lime-300">{formatPrice(order.total_price)}</strong></div></div></article>)}</div> : <Empty text={t("account.noOrders")} />}</section>;
}

/**
 * "غرفه و فروش".
 *
 * Without a غرفه this is the ثبت غرفه form. With one it is a summary that
 * hands the seller off to their own غرفه page: publishing and managing
 * آگهی‌ها now happens *inside* the غرفه, next to the posts and stories they
 * belong with, instead of on a disconnected account screen that showed a
 * create-form but no way to edit or remove anything afterwards.
 */
function SellerPanel({ storefront, listings, loading, storeForm, setStoreForm, creatingStore, onCreateStore, t }: { storefront: Storefront | null; listings: MarketplaceListing[]; loading: boolean; storeForm: typeof emptyStore; setStoreForm: (value: typeof emptyStore) => void; creatingStore: boolean; onCreateStore: (event: FormEvent) => Promise<void>; t: (key: string) => string }) {
  if (loading) return <section className="rounded-3xl bg-white p-8 text-center text-slate-500 dark:bg-emerald-950">{t("common.loading")}</section>;

  if (!storefront) {
    return (
      <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-6">
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">{t("account.createStore")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-emerald-200">
          {t("account.noStore")} غرفه به شما امکان ثبت محصول و فروش پس از بررسی را می‌دهد.
        </p>
        <form onSubmit={onCreateStore} className="mt-6 grid gap-4 sm:grid-cols-2">
          <TextField label="نام غرفه" value={storeForm.name} onChange={(value) => setStoreForm({ ...storeForm, name: value })} />
          <TextField label="آدرس یکتا (اختیاری)" required={false} value={storeForm.slug} onChange={(value) => setStoreForm({ ...storeForm, slug: value })} />
          <SelectField label="نوع فروشنده" value={storeForm.seller_type} onChange={(value) => setStoreForm({ ...storeForm, seller_type: value as Storefront["seller_type"] })} options={[['farmer', t("role.farmer")], ['cooperative', t("role.cooperative")], ['merchant', t("role.merchant")], ['company', t("role.company")]]} />
          <LocationPicker idPrefix="profile-store" required province={storeForm.province} city={storeForm.city} onProvinceChange={(value) => setStoreForm({ ...storeForm, province: value, city: "" })} onCityChange={(value) => setStoreForm({ ...storeForm, city: value })} />
          <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50 sm:col-span-2">
            معرفی کوتاه
            <textarea value={storeForm.bio} onChange={(event) => setStoreForm({ ...storeForm, bio: event.target.value })} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" />
          </label>
          <button disabled={creatingStore} className="inline-flex w-fit min-h-12 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">
            <Plus size={16} />
            {creatingStore ? t("common.loading") : t("account.createStore")}
          </button>
        </form>
      </section>
    );
  }

  const storeUrl = `/storefronts/${storefront.slug}`;
  const published = listings.filter((listing) => listing.status === "published").length;
  // The model's value is `pending_review`, not `pending` — matching the wrong
  // string silently reported zero آگهی in review.
  const pending = listings.filter((listing) => listing.status === "pending_review").length;
  const rejected = listings.filter((listing) => listing.status === "rejected");

  return (
    <div className="space-y-6">
      {/* Store identity + the way into it */}
      <section className="rounded-3xl border border-emerald-100 bg-gradient-to-l from-emerald-50 to-white p-5 shadow-sm dark:border-emerald-800 dark:from-emerald-900/40 dark:to-emerald-950 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-extrabold text-slate-800 dark:text-white">{storefront.name}</h2>
              {storefront.is_verified ? <BadgeCheck className="shrink-0 text-emerald-600" size={20} /> : null}
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">
              {storefront.city}{storefront.province ? `، ${storefront.province}` : ""} · کمیسیون توافق‌شده: {storefront.commission_rate}٪
            </p>
          </div>
          <span className={`h-fit w-fit shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${storefront.is_verified ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100"}`}>
            {storefront.is_verified ? t("seller.verificationApproved") : t("seller.verificationPending")}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link to={storeUrl} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-700">
            <Store size={16} />
            {t("storefront.myStore")}
            <ArrowLeft size={15} />
          </Link>
          <Link to={storeUrl} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-emerald-300 bg-white px-5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-lime-300">
            <Plus size={16} />
            {t("account.createListing")}
          </Link>
        </div>
        <p className="mt-3 flex items-start gap-2 text-fluid-xs leading-6 text-slate-500 dark:text-emerald-200">
          <ExternalLink size={14} className="mt-0.5 shrink-0" />
          ثبت و ویرایش آگهی، پست و استوری داخل صفحه غرفه شما انجام می‌شود.
        </p>
      </section>

      {/* Listing health at a glance */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Building2} label="منتشرشده" value={published.toLocaleString("fa-IR")} />
        <Stat icon={ClipboardList} label="در انتظار بررسی" value={pending.toLocaleString("fa-IR")} />
        <Stat icon={AlertTriangle} label="ردشده" value={rejected.length.toLocaleString("fa-IR")} />
      </div>

      {/* Only rejections need attention here; the rest is managed in the store. */}
      {rejected.length > 0 && (
        <section className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-900 dark:bg-emerald-950 sm:p-6">
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">آگهی‌های ردشده</h2>
          <p className="mt-1 text-fluid-xs text-slate-500 dark:text-emerald-200">
            پس از اصلاح در صفحه غرفه، آگهی دوباره برای بررسی ارسال می‌شود.
          </p>
          <ul className="mt-4 space-y-3">
            {rejected.map((listing) => (
              <li key={listing.id} className="rounded-2xl border border-rose-300 bg-rose-50/50 p-4 dark:border-rose-800 dark:bg-rose-950/20">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-slate-800 dark:text-white">{listing.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{listing.quantity_available} {listing.unit} · {formatPrice(listing.price)}</p>
                  </div>
                  <Link to={storeUrl} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-rose-300 px-3 text-fluid-xs font-bold text-rose-700 transition hover:bg-rose-100 dark:border-rose-700 dark:text-rose-200 dark:hover:bg-rose-950/50">
                    <Edit3 size={13} />
                    اصلاح در غرفه
                  </Link>
                </div>
                {/* The moderator's reason is shown to the seller here — storing
                    it without surfacing it would make the rejection unactionable. */}
                {listing.rejection_reason && (
                  <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-rose-100 p-3 dark:bg-rose-950/50">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-300" />
                    <div>
                      <p className="text-xs font-extrabold text-rose-800 dark:text-rose-200">دلیل رد آگهی</p>
                      <p className="mt-1 text-xs leading-6 text-rose-700 dark:text-rose-100">{listing.rejection_reason}</p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recent listings, read-only: editing lives in the store page */}
      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">{t("seller.listings")}</h2>
          <Link to={storeUrl} className="inline-flex min-h-11 items-center text-fluid-sm font-bold text-emerald-700 dark:text-lime-300">
            {t("common.viewAll")}
          </Link>
        </div>
        {listings.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {listings.slice(0, 6).map((listing) => (
              <article key={listing.id} className="rounded-2xl border border-slate-100 p-4 dark:border-emerald-900">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-slate-800 dark:text-white">{listing.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{listing.quantity_available} {listing.unit} · {formatPrice(listing.price)}</p>
                  </div>
                  <span className={`h-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${listing.status === "rejected" ? "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-100" : listing.status === "published" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100"}`}>
                    {listing.status_label}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty text={t("seller.noListings")} />
        )}
      </section>
    </div>
  );
}

function SettingsPanel({ form, setForm, editing, setEditing, saving, onSave, onCancel, t, username }: { form: ProfileForm; setForm: (value: ProfileForm) => void; editing: boolean; setEditing: (value: boolean) => void; saving: boolean; onSave: (event: FormEvent) => Promise<void>; onCancel: () => void; t: (key: string) => string; username: string }) {
  return (
    <div className="space-y-6">
      {/* Account settings */}
      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">{t("account.settings")}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">اطلاعات تحویل برای خریدهای بعدی از اینجا تکمیل می‌شود.</p>
          </div>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">
              <Edit3 size={16} />
              {t("common.edit")}
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={onCancel} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold dark:border-emerald-700">
                <X size={16} className="me-1 inline" />
                {t("common.cancel")}
              </button>
            </div>
          )}
        </div>
        <form onSubmit={onSave} className="mt-6 grid gap-4 sm:grid-cols-2">
          <InfoField label={t("profile.firstName")} value={form.first_name} editing={editing} onChange={(value) => setForm({ ...form, first_name: value })} />
          <InfoField label={t("profile.lastName")} value={form.last_name} editing={editing} onChange={(value) => setForm({ ...form, last_name: value })} />
          <InfoField label={t("profile.email")} value={form.email} editing={editing} type="email" onChange={(value) => setForm({ ...form, email: value.trim() })} />
          <InfoField label={t("profile.phone")} value={form.phone} editing={editing} onChange={(value) => setForm({ ...form, phone: normalizePhoneNumber(value) })} />
          <InfoField label={t("profile.address")} value={form.address} editing={editing} multiline onChange={(value) => setForm({ ...form, address: value })} />
          <div className="rounded-2xl bg-slate-50 p-4 text-sm dark:bg-emerald-900/40">
            <p className="text-xs text-slate-500 dark:text-emerald-200">{t("profile.username")}</p>
            <p className="mt-1 font-bold text-slate-800 dark:text-white">{username}</p>
          </div>
          {editing && (
            <button disabled={saving} className="inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">
              <Save size={16} />
              {saving ? t("common.loading") : t("common.save")}
            </button>
          )}
        </form>
      </section>

      <BrowserNotificationsSection />

      {/* Site settings: language + theme */}
      <SiteSettingsSection t={t} />
    </div>
  );
}

function vapidKeyBytes(value: string): ArrayBuffer {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return buffer;
}

async function endpointFingerprint(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24);
}

function BrowserNotificationsSection() {
  const supported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
  const [available, setAvailable] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [currentSubscriptionId, setCurrentSubscriptionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!supported) {
      setBusy(false);
      return;
    }
    let cancelled = false;
    async function loadStatus() {
      try {
        const [{ data }, registration] = await Promise.all([
          webPushApi.status(),
          navigator.serviceWorker.getRegistration(),
        ]);
        const browserSubscription = await registration?.pushManager.getSubscription();
        const fingerprint = browserSubscription
          ? await endpointFingerprint(browserSubscription.endpoint)
          : '';
        if (!cancelled) {
          setAvailable(data.enabled);
          setPublicKey(data.public_key);
          setCurrentSubscriptionId(
            data.subscriptions.find((item) => item.endpoint_fingerprint === fingerprint)?.id || null,
          );
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    loadStatus().catch(() => undefined);
    return () => { cancelled = true; };
  }, [supported]);

  async function enableNotifications() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('اجازه نمایش اعلان داده نشد. می‌توانید آن را از تنظیمات مرورگر تغییر دهید.');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const browserSubscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyBytes(publicKey),
      });
      const response = await webPushApi.subscribe(browserSubscription.toJSON());
      setCurrentSubscriptionId(response.data.id);
      toast.success('اعلان وضعیت سفارش برای این مرورگر فعال شد.');
    } catch {
      toast.error('فعال‌سازی اعلان انجام نشد. اتصال و تنظیمات مرورگر را بررسی کنید.');
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const browserSubscription = await registration?.pushManager.getSubscription();
      await browserSubscription?.unsubscribe();
      if (currentSubscriptionId) await webPushApi.remove(currentSubscriptionId);
      setCurrentSubscriptionId(null);
      toast.success('اعلان این مرورگر غیرفعال شد.');
    } catch {
      toast.error('غیرفعال‌سازی اعلان کامل نشد؛ دوباره تلاش کنید.');
    } finally {
      setBusy(false);
    }
  }

  const active = Boolean(currentSubscriptionId);
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-800 dark:text-white">
        {active ? <Bell size={19} className="text-emerald-600 dark:text-lime-300" /> : <BellOff size={19} className="text-slate-400" />}
        اعلان وضعیت سفارش
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-emerald-200">
        با اجازه صریح شما، تغییر وضعیت سفارش روی همین مرورگر نمایش داده می‌شود. هر زمان بخواهید می‌توانید اشتراک را حذف کنید.
      </p>
      {!supported ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-emerald-900/40 dark:text-emerald-200">این مرورگر از اعلان Push پشتیبانی نمی‌کند.</p>
      ) : !available ? (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-100">این قابلیت هنوز برای حساب شما فعال نشده است.</p>
      ) : (
        <button type="button" onClick={active ? disableNotifications : enableNotifications} disabled={busy} className={cn(
          "mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50",
          active ? "bg-rose-600" : "bg-emerald-600",
        )}>
          {active ? <BellOff size={16} /> : <Bell size={16} />}
          {busy ? 'در حال بررسی…' : active ? 'غیرفعال کردن اعلان' : 'فعال کردن اعلان'}
        </button>
      )}
    </section>
  );
}

/** زبان نمایش و حالت شب/روز — طبق درخواست، انتخاب زبان از هدر به اینجا منتقل شده است. */
function SiteSettingsSection({ t }: { t: (key: string) => string }) {
  const { locale, setLocale } = useTranslation();
  const isDark = useThemeStore((state) => state.isDark);
  const toggleDark = useThemeStore((state) => state.toggle);

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-800 dark:text-white">
        <Settings2 size={19} className="text-emerald-600 dark:text-lime-300" />
        {t("settings.site")}
      </h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">{t("settings.siteDescription")}</p>

      <div className="mt-5 space-y-6">
        {/* Language */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-emerald-50">{t("language.label")}</h3>
          <p className="mt-1 text-xs text-slate-400 dark:text-emerald-300/70">{t("language.description")}</p>
          <div role="radiogroup" aria-label={t("language.label")} className="mt-3 grid grid-cols-3 gap-2 sm:max-w-md">
            {LANGUAGES.map((language) => (
              <button
                key={language.value}
                type="button"
                role="radio"
                aria-checked={locale === language.value}
                onClick={() => setLocale(language.value)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-3 py-2 transition",
                  locale === language.value
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/50 dark:text-lime-200"
                    : "border-slate-100 text-slate-500 hover:border-emerald-300 dark:border-emerald-900 dark:text-emerald-100",
                )}
              >
                <span className="text-lg leading-none">{language.flag}</span>
                <span className="text-xs font-bold">{t(language.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-emerald-50">{t("settings.theme")}</h3>
          <div role="radiogroup" aria-label={t("settings.theme")} className="mt-3 grid grid-cols-2 gap-2 sm:max-w-xs">
            <button
              type="button"
              role="radio"
              aria-checked={!isDark}
              onClick={() => isDark && toggleDark()}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 px-3 text-sm font-bold transition",
                !isDark
                  ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                  : "border-slate-100 text-slate-500 dark:border-emerald-900 dark:text-emerald-100",
              )}
            >
              <Sun size={16} />
              {t("settings.light")}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={isDark}
              onClick={() => !isDark && toggleDark()}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 px-3 text-sm font-bold transition",
                isDark
                  ? "border-emerald-500 bg-emerald-900/60 text-lime-200"
                  : "border-slate-100 text-slate-500 dark:border-emerald-900 dark:text-emerald-100",
              )}
            >
              <Moon size={16} />
              {t("settings.dark")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) { return <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:rounded-3xl sm:p-5"><Icon size={18} className="text-emerald-600 dark:text-lime-300" /><p className="mt-3 text-fluid-xl font-extrabold text-slate-800 dark:text-white">{value}</p><p className="mt-1 text-fluid-2xs leading-5 text-slate-500 dark:text-emerald-200">{label}</p></div>; }
function Panel({ title, text, icon: Icon, action, onClick }: { title: string; text: string; icon: typeof Store; action: string; onClick: () => void }) { return <article className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><Icon className="text-emerald-600 dark:text-lime-300" /><h2 className="mt-4 text-xl font-extrabold text-slate-800 dark:text-white">{title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500 dark:text-emerald-200">{text}</p><button onClick={onClick} className="mt-4 inline-flex min-h-11 items-center text-fluid-sm font-bold text-emerald-700 dark:text-lime-300">{action}</button></article>; }
function Empty({ text }: { text: string }) { return <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-emerald-900/40 dark:text-emerald-200">{text}</div>; }
function TextField({ label, value, onChange, type = "text", required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">{label}<input required={required} type={type} min={type === "number" ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) { return <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal dark:border-emerald-700 dark:bg-emerald-900">{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>; }
function InfoField({ label, value, editing, onChange, type = "text", multiline = false }: { label: string; value: string; editing: boolean; onChange: (value: string) => void; type?: string; multiline?: boolean }) { return <label className={`block rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-slate-700 dark:bg-emerald-900/40 dark:text-emerald-50 ${multiline ? "sm:col-span-2" : ""}`}><span className="text-xs text-slate-500 dark:text-emerald-200">{label}</span>{editing ? multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-emerald-200 bg-white p-2.5 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-950" /> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-950" /> : <p className="mt-2 font-bold">{value || "—"}</p>}</label>; }
