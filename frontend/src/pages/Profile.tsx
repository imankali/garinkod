import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, BadgeCheck, BarChart3, Building2, ClipboardList, Edit3, Leaf,
  LogOut, Package, Plus, Save, Settings2, ShoppingBag,
  Store, UserRound, X,
} from "lucide-react";
import toast from "react-hot-toast";

import { agricultureApi, ordersApi } from "../api/services";
import AvatarUploader from "../components/AvatarUploader";
import LocationPicker from "../components/LocationPicker";
import { useTranslation } from "../i18n";
import { useAuthStore } from "../store/authStore";
import type { MarketplaceListing, Order, Storefront } from "../types";
import { formatPrice } from "../utils/formatPrice";

type Tab = "overview" | "buyer" | "seller" | "settings";

interface ProfileForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
}

const emptyStore = { name: "", slug: "", seller_type: "farmer" as Storefront["seller_type"], bio: "", province: "", city: "" };
const emptyListing = { title: "", crop_name: "", description: "", price: "", unit: "کیلوگرم", quantity_available: "", min_order_quantity: "1" };

export default function Profile() {
  const { user, account, isAuthenticated, isLoading, isSessionChecked, logout, fetchProfile, updateProfile } = useAuthStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(() => new URLSearchParams(window.location.search).get("tab") === "seller" ? "seller" : "overview");
  const [profileForm, setProfileForm] = useState<ProfileForm>({ first_name: "", last_name: "", email: "", phone: "", address: "" });
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loadingSeller, setLoadingSeller] = useState(false);
  const [storeForm, setStoreForm] = useState(emptyStore);
  const [listingForm, setListingForm] = useState(emptyListing);
  const [creatingStore, setCreatingStore] = useState(false);
  const [creatingListing, setCreatingListing] = useState(false);

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

  async function createListing(event: FormEvent) {
    event.preventDefault();
    setCreatingListing(true);
    try {
      await agricultureApi.createListing({
        ...listingForm,
        price: Number(listingForm.price),
        quantity_available: listingForm.quantity_available,
        min_order_quantity: listingForm.min_order_quantity,
      });
      setListingForm(emptyListing);
      await loadSeller();
      toast.success(t("account.listingCreated"));
    } catch {
      // API client reports a detailed error.
    } finally {
      setCreatingListing(false);
    }
  }

  async function signOut() {
    await logout();
    navigate("/");
  }

  if (!isSessionChecked || !isAuthenticated || isLoading) {
    return <main className="flex min-h-[55vh] items-center justify-center"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" /><p className="mt-4 text-sm text-slate-500">{t("common.loading")}</p></div></main>;
  }

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "—";
  const pendingOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
  const activeListings = listings.filter((listing) => listing.status === "published");
  const navItems: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview", label: t("account.overview"), icon: BarChart3 },
    { id: "buyer", label: t("account.buyer"), icon: ShoppingBag },
    { id: "seller", label: t("account.seller"), icon: Store },
    { id: "settings", label: t("account.settings"), icon: Settings2 },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-[#f8faf6] to-white px-4 py-7 dark:from-emerald-950 dark:via-[#062d21] dark:to-emerald-950">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-l from-emerald-800 via-emerald-700 to-lime-600 p-6 text-white shadow-xl shadow-emerald-900/15 md:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <AvatarUploader fallback={fullName.charAt(0)} />
              <div><p className="text-sm text-lime-200">{t("account.title")}</p><h1 className="mt-1 text-2xl font-extrabold md:text-3xl">{fullName}</h1><p className="mt-1 text-sm text-emerald-100">{user?.email || user?.username}</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold"><UserRound size={14} className="me-1 inline" />{account?.level_label || t("role.buyer")}</span>
              {storefront && <span className="rounded-full bg-lime-300/20 px-3 py-1.5 text-xs font-bold text-lime-100"><Store size={14} className="me-1 inline" />{t("role.seller")}</span>}
              <button onClick={signOut} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold transition hover:bg-white/25"><LogOut size={14} className="me-1 inline" />{t("account.signout")}</button>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[230px_1fr]">
          <aside className="h-fit rounded-3xl border border-emerald-100 bg-white p-3 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 lg:sticky lg:top-5">
            <nav className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Account sections">
              {navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${tab === id ? "bg-emerald-600 text-white shadow-md" : "text-slate-600 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900/50"}`}><Icon size={18} />{label}</button>)}
            </nav>
            <div className="mt-3 rounded-2xl bg-emerald-50 p-4 text-xs leading-6 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100"><Leaf size={16} className="mb-1" />حساب شما می‌تواند هم‌زمان خریدار و فروشنده باشد؛ نقش فروشنده با ساخت غرفه فعال می‌شود.</div>
          </aside>

          <section>
            {tab === "overview" && <Overview orders={orders} pendingOrders={pendingOrders.length} storefront={storefront} activeListings={activeListings.length} onBuyer={() => setTab("buyer")} onSeller={() => setTab("seller")} t={t} />}
            {tab === "buyer" && <BuyerPanel orders={orders} t={t} />}
            {tab === "seller" && <SellerPanel storefront={storefront} listings={listings} loading={loadingSeller} storeForm={storeForm} setStoreForm={setStoreForm} listingForm={listingForm} setListingForm={setListingForm} creatingStore={creatingStore} creatingListing={creatingListing} onCreateStore={createStore} onCreateListing={createListing} t={t} />}
            {tab === "settings" && <SettingsPanel form={profileForm} setForm={setProfileForm} editing={editing} setEditing={setEditing} saving={savingProfile} onSave={saveProfile} onCancel={() => { syncProfileForm(); setEditing(false); }} t={t} username={user?.username || ""} />}
          </section>
        </div>
      </div>
    </main>
  );
}

function Overview({ orders, pendingOrders, storefront, activeListings, onBuyer, onSeller, t }: { orders: Order[]; pendingOrders: number; storefront: Storefront | null; activeListings: number; onBuyer: () => void; onSeller: () => void; t: (key: string) => string }) {
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat icon={ClipboardList} label={t("account.orders")} value={orders.length.toLocaleString("fa-IR")} /><Stat icon={Package} label="سفارش‌های جاری" value={pendingOrders.toLocaleString("fa-IR")} /><Stat icon={Store} label={t("account.store")} value={storefront ? "فعال" : "—"} /><Stat icon={Building2} label="آگهی منتشرشده" value={activeListings.toLocaleString("fa-IR")} /></div><div className="grid gap-6 lg:grid-cols-2"><Panel title={t("account.buyer")} text={t("account.buyerDescription")} icon={ShoppingBag} action={t("account.openOrders")} onClick={onBuyer} /><Panel title={t("account.seller")} text={t("account.sellerDescription")} icon={Store} action={storefront ? t("account.store") : t("account.createStore")} onClick={onSeller} /></div><section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold text-slate-800 dark:text-white">آخرین سفارش‌ها</h2><Link to="/orders" className="text-sm font-bold text-emerald-700 dark:text-lime-300">{t("common.viewAll")}</Link></div>{orders.length ? <div className="mt-4 divide-y divide-slate-100 dark:divide-emerald-900">{orders.slice(0, 3).map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"><div><strong className="text-slate-800 dark:text-white" dir="ltr">{order.code}</strong><p className="mt-1 text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString("fa-IR")}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-100">{order.status_label}</span><strong className="text-emerald-700 dark:text-lime-300">{formatPrice(order.total_price)}</strong></div>)}</div> : <Empty text={t("account.noOrders")} />}</section></div>;
}

function BuyerPanel({ orders, t }: { orders: Order[]; t: (key: string) => string }) {
  return <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">{t("account.buyer")}</h2><p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">{t("account.buyerDescription")}</p></div><Link to="/orders" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-bold text-white">{t("account.openOrders")}</Link></div>{orders.length ? <div className="mt-6 space-y-3">{orders.map((order) => <article key={order.id} className="rounded-2xl border border-slate-100 p-4 dark:border-emerald-900"><div className="flex flex-wrap justify-between gap-3"><div><strong dir="ltr" className="text-slate-800 dark:text-white">{order.code}</strong><p className="mt-1 text-xs text-slate-500">{order.total_items} کالا · {new Date(order.created_at).toLocaleDateString("fa-IR")}</p></div><div className="text-end"><span className="block text-xs text-slate-500">{order.status_label}</span><strong className="mt-1 block text-emerald-700 dark:text-lime-300">{formatPrice(order.total_price)}</strong></div></div></article>)}</div> : <Empty text={t("account.noOrders")} />}</section>;
}

function SellerPanel({ storefront, listings, loading, storeForm, setStoreForm, listingForm, setListingForm, creatingStore, creatingListing, onCreateStore, onCreateListing, t }: { storefront: Storefront | null; listings: MarketplaceListing[]; loading: boolean; storeForm: typeof emptyStore; setStoreForm: (value: typeof emptyStore) => void; listingForm: typeof emptyListing; setListingForm: (value: typeof emptyListing) => void; creatingStore: boolean; creatingListing: boolean; onCreateStore: (event: FormEvent) => Promise<void>; onCreateListing: (event: FormEvent) => Promise<void>; t: (key: string) => string }) {
  if (loading) return <section className="rounded-3xl bg-white p-8 text-center text-slate-500 dark:bg-emerald-950">{t("common.loading")}</section>;
  if (!storefront) return <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">{t("account.createStore")}</h2><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-emerald-200">{t("account.noStore")} غرفه به شما امکان ثبت محصول و فروش پس از بررسی را می‌دهد.</p><form onSubmit={onCreateStore} className="mt-6 grid gap-4 sm:grid-cols-2"><TextField label="نام غرفه" value={storeForm.name} onChange={(value) => setStoreForm({ ...storeForm, name: value })} /><TextField label="آدرس یکتا (اختیاری)" required={false} value={storeForm.slug} onChange={(value) => setStoreForm({ ...storeForm, slug: value })} /><SelectField label="نوع فروشنده" value={storeForm.seller_type} onChange={(value) => setStoreForm({ ...storeForm, seller_type: value as Storefront["seller_type"] })} options={[['farmer', t("role.farmer")], ['cooperative', t("role.cooperative")], ['merchant', t("role.merchant")], ['company', t("role.company")]]} /><LocationPicker idPrefix="profile-store" required province={storeForm.province} city={storeForm.city} onProvinceChange={(value) => setStoreForm({ ...storeForm, province: value, city: "" })} onCityChange={(value) => setStoreForm({ ...storeForm, city: value })} /><label className="block text-sm font-bold text-slate-700 dark:text-emerald-50 sm:col-span-2">معرفی کوتاه<textarea value={storeForm.bio} onChange={(event) => setStoreForm({ ...storeForm, bio: event.target.value })} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" /></label><button disabled={creatingStore} className="w-fit rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{creatingStore ? t("common.loading") : t("account.createStore")}</button></form></section>;
  return <div className="space-y-6"><section className="rounded-3xl border border-emerald-100 bg-gradient-to-l from-emerald-50 to-white p-6 shadow-sm dark:border-emerald-800 dark:from-emerald-900/40 dark:to-emerald-950"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">{storefront.name}</h2>{storefront.is_verified ? <BadgeCheck className="text-emerald-600" size={20} /> : null}</div><p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">{storefront.city}{storefront.province ? `، ${storefront.province}` : ""} · کمیسیون توافق‌شده: {storefront.commission_rate}٪</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${storefront.is_verified ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100"}`}>{storefront.is_verified ? t("seller.verificationApproved") : t("seller.verificationPending")}</span></div></section><section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">{t("account.createListing")}</h2><p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">هر آگهی ابتدا برای بررسی کیفیت و اطلاعات بازار ثبت می‌شود.</p><form onSubmit={onCreateListing} className="mt-5 grid gap-4 sm:grid-cols-2"><TextField label="عنوان آگهی" value={listingForm.title} onChange={(value) => setListingForm({ ...listingForm, title: value })} /><TextField label="نام محصول" value={listingForm.crop_name} onChange={(value) => setListingForm({ ...listingForm, crop_name: value })} /><TextField label="قیمت هر واحد (تومان)" type="number" value={listingForm.price} onChange={(value) => setListingForm({ ...listingForm, price: value })} /><TextField label="موجودی" type="number" value={listingForm.quantity_available} onChange={(value) => setListingForm({ ...listingForm, quantity_available: value })} /><TextField label="حداقل سفارش" type="number" value={listingForm.min_order_quantity} onChange={(value) => setListingForm({ ...listingForm, min_order_quantity: value })} /><TextField label="واحد" value={listingForm.unit} onChange={(value) => setListingForm({ ...listingForm, unit: value })} /><label className="block text-sm font-bold text-slate-700 dark:text-emerald-50 sm:col-span-2">توضیحات محصول<textarea required value={listingForm.description} onChange={(event) => setListingForm({ ...listingForm, description: event.target.value })} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" /></label><button disabled={creatingListing} className="w-fit rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2"><Plus size={16} className="me-1 inline" />{creatingListing ? t("common.loading") : t("account.createListing")}</button></form></section><section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">{t("seller.listings")}</h2>{listings.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{listings.map((listing) => (
                <article key={listing.id} className={`rounded-2xl border p-4 ${listing.status === "rejected" ? "border-rose-300 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/20" : "border-slate-100 dark:border-emerald-900"}`}>
                  <div className="flex justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-white">{listing.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">{listing.quantity_available} {listing.unit} · {formatPrice(listing.price)}</p>
                    </div>
                    <span className={`h-fit rounded-full px-2.5 py-1 text-xs font-bold ${listing.status === "rejected" ? "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-100" : listing.status === "published" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100"}`}>{listing.status_label}</span>
                  </div>
                  {/* The moderator's reason is shown to the seller here — storing
                      it without surfacing it would make the rejection unactionable. */}
                  {listing.status === "rejected" && listing.rejection_reason && (
                    <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-rose-100 p-3 dark:bg-rose-950/50">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-300" />
                      <div>
                        <p className="text-xs font-extrabold text-rose-800 dark:text-rose-200">دلیل رد آگهی</p>
                        <p className="mt-1 text-xs leading-6 text-rose-700 dark:text-rose-100">{listing.rejection_reason}</p>
                        <p className="mt-2 text-fluid-xs text-rose-600 dark:text-rose-300">پس از اصلاح، آگهی دوباره برای بررسی ارسال می‌شود.</p>
                      </div>
                    </div>
                  )}
                </article>
              ))}</div> : <Empty text={t("seller.noListings")} />}</section></div>;
}

function SettingsPanel({ form, setForm, editing, setEditing, saving, onSave, onCancel, t, username }: { form: ProfileForm; setForm: (value: ProfileForm) => void; editing: boolean; setEditing: (value: boolean) => void; saving: boolean; onSave: (event: FormEvent) => Promise<void>; onCancel: () => void; t: (key: string) => string; username: string }) {
  return <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">{t("account.settings")}</h2><p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">اطلاعات تحویل برای خریدهای بعدی از اینجا تکمیل می‌شود.</p></div>{!editing ? <button onClick={() => setEditing(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"><Edit3 size={16} />{t("common.edit")}</button> : <div className="flex gap-2"><button onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold dark:border-emerald-700"><X size={16} className="me-1 inline" />{t("common.cancel")}</button></div>}</div><form onSubmit={onSave} className="mt-6 grid gap-4 sm:grid-cols-2"><InfoField label={t("profile.firstName")} value={form.first_name} editing={editing} onChange={(value) => setForm({ ...form, first_name: value })} /><InfoField label={t("profile.lastName")} value={form.last_name} editing={editing} onChange={(value) => setForm({ ...form, last_name: value })} /><InfoField label={t("profile.email")} value={form.email} editing={editing} type="email" onChange={(value) => setForm({ ...form, email: value })} /><InfoField label={t("profile.phone")} value={form.phone} editing={editing} onChange={(value) => setForm({ ...form, phone: value })} /><InfoField label={t("profile.address")} value={form.address} editing={editing} multiline onChange={(value) => setForm({ ...form, address: value })} /><div className="rounded-2xl bg-slate-50 p-4 text-sm dark:bg-emerald-900/40"><p className="text-xs text-slate-500 dark:text-emerald-200">{t("profile.username")}</p><p className="mt-1 font-bold text-slate-800 dark:text-white">{username}</p></div>{editing && <button disabled={saving} className="inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2"><Save size={16} />{saving ? t("common.loading") : t("common.save")}</button>}</form></section>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) { return <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><Icon size={20} className="text-emerald-600 dark:text-lime-300" /><p className="mt-4 text-2xl font-extrabold text-slate-800 dark:text-white">{value}</p><p className="mt-1 text-xs text-slate-500 dark:text-emerald-200">{label}</p></div>; }
function Panel({ title, text, icon: Icon, action, onClick }: { title: string; text: string; icon: typeof Store; action: string; onClick: () => void }) { return <article className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><Icon className="text-emerald-600 dark:text-lime-300" /><h2 className="mt-4 text-xl font-extrabold text-slate-800 dark:text-white">{title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500 dark:text-emerald-200">{text}</p><button onClick={onClick} className="mt-5 text-sm font-bold text-emerald-700 dark:text-lime-300">{action}</button></article>; }
function Empty({ text }: { text: string }) { return <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-emerald-900/40 dark:text-emerald-200">{text}</div>; }
function TextField({ label, value, onChange, type = "text", required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">{label}<input required={required} type={type} min={type === "number" ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) { return <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal dark:border-emerald-700 dark:bg-emerald-900">{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>; }
function InfoField({ label, value, editing, onChange, type = "text", multiline = false }: { label: string; value: string; editing: boolean; onChange: (value: string) => void; type?: string; multiline?: boolean }) { return <label className={`block rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-slate-700 dark:bg-emerald-900/40 dark:text-emerald-50 ${multiline ? "sm:col-span-2" : ""}`}><span className="text-xs text-slate-500 dark:text-emerald-200">{label}</span>{editing ? multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-emerald-200 bg-white p-2.5 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-950" /> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-950" /> : <p className="mt-2 font-bold">{value || "—"}</p>}</label>; }
