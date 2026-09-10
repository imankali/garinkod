// frontend/src/components/management/ContentStudio.tsx
//
// تولید محتوا — the console's content-production screen.
//
// Before this existed, adding a product or publishing an article meant leaving
// the console and opening Django admin: two different mental models, no audit
// trail from the site's own flow, and a manager needing eleven fields typed into
// a raw form. This panel covers the same ground through the console API, with
// every writable field present — pricing, discount, stock, packaging, spec table,
// shipping, SEO, gallery and links — because a form that omits a field is a form
// that silently resets it.
//
// Three sub-tabs, in the order the work actually happens:
//   • محصول‌ها  — the catalogue rows
//   • مقاله‌ها  — blog posts and growing guides, with their product links
//   • دسته‌ها  — the taxonomy those two depend on (a new department has to be
//                created somewhere before it can be chosen)
//
// The list never re-fetches the whole catalogue: search, department, status and
// ordering are sent to the API, so a manager with 4 000 products types a word and
// gets a page of 25, not a client-side scan of everything.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowRight, ChevronLeft, ChevronRight, FolderTree, Layers, Link2,
  ListPlus, Pencil, Plus, Save, Send, Tags, Trash2, X,
} from 'lucide-react';

import {
  contentStudioApi,
  type ArticleWork,
  type PackageRow,
  type ProductWork,
  type SpecRow,
  type StudioOptions,
  type TaxonomyCategory,
  type TaxonomySubCategory,
  type TaxonomyTag,
} from '../../api/contentStudio';
import { agricultureApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import { cn } from '../../utils/cn';
import { formatPrice } from '../../utils/formatPrice';

type Sub = 'products' | 'articles' | 'taxonomy';

const PAGE_SIZE = 25;

export default function ContentStudio() {
  const [sub, setSub] = useState<Sub>('products');
  const [options, setOptions] = useState<StudioOptions | null>(null);

  useEffect(() => {
    contentStudioApi
      .options()
      .then((response) => setOptions(response.data))
      .catch(() => setOptions(null));
  }, []);

  const subtabs: { id: Sub; label: string; icon: typeof Layers }[] = [
    { id: 'products', label: 'محصول‌ها', icon: Layers },
    { id: 'articles', label: 'مقاله‌ها و راهنما', icon: Send },
    { id: 'taxonomy', label: 'دسته‌ها و برچسب‌ها', icon: FolderTree },
  ];

  return (
    <section className="space-y-5">
      <header className="rounded-3xl bg-gradient-to-l from-slate-950 via-emerald-950 to-emerald-700 p-6 text-white shadow-xl">
        <h2 className="text-fluid-2xl font-extrabold">تولید محتوای سایت</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-emerald-100">
          افزودن و ویرایش محصول، مقاله و راهنمای کشت با همه فیلدها — قیمت، تخفیف، موجودی، بسته‌بندی، جدول
          ویژگی‌ها، سئو و پیوندها. تغییرات همین‌جا در لاگ مدیریتی ثبت می‌شود.
        </p>
      </header>

      <nav
        className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-emerald-900 dark:bg-emerald-950"
        aria-label="بخش‌های تولید محتوا"
      >
        {subtabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSub(id)}
            aria-current={sub === id ? 'true' : undefined}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-fluid-sm font-bold transition',
              sub === id
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900/50',
            )}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      {/* The forms need the taxonomy before they can render their dropdowns. */}
      {!options ? (
        <p role="status" className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500 dark:bg-emerald-950">
          در حال دریافت فهرست دسته‌ها…
        </p>
      ) : sub === 'products' ? (
        <ProductsPanel options={options} />
      ) : sub === 'articles' ? (
        <ArticlesPanel options={options} />
      ) : (
        <TaxonomyPanel options={options} />
      )}
    </section>
  );
}

// =============================================================================
// Products
// =============================================================================

function ProductsPanel({ options }: { options: StudioOptions }) {
  const [rows, setRows] = useState<ProductWork[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [ordering, setOrdering] = useState('-created');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProductWork | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await contentStudioApi.products.list({
        search: search || undefined,
        status: status || undefined,
        category: category || undefined,
        ordering,
        page,
        page_size: PAGE_SIZE,
      });
      setRows(response.data.results);
      setCount(response.data.count);
    } catch (error) {
      toastError(error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, status, category, ordering, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(Math.ceil(count / PAGE_SIZE), 1);

  async function togglePublish(row: ProductWork) {
    try {
      await contentStudioApi.products.publish(row.id);
      await load();
    } catch (error) {
      toastError(error);
    }
  }

  async function remove(row: ProductWork) {
    if (!window.confirm(`«${row.title}» حذف شود؟ این اقدام بازگشت ندارد.`)) return;
    try {
      await contentStudioApi.products.remove(row.id);
      await load();
    } catch (error) {
      toastError(error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput
            label="جستجو"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="عنوان، برند، کد کالا…"
            debounce
          />
          <SelectInput
            label="وضعیت"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[{ value: '', label: 'همه' }, ...Object.entries(options.product_statuses).map(([value, label]) => ({ value, label }))]}
          />
          <SelectInput
            label="دسته"
            value={category}
            onChange={(value) => {
              setCategory(value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'همه دسته‌ها' },
              { value: 'unfiled', label: 'بدون دسته (فقط در مرتب‌سازی ممکن است)' },
              ...options.categories.map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
          <SelectInput
            label="مرتب‌سازی"
            value={ordering}
            onChange={setOrdering}
            options={[
              { value: '-created', label: 'جدیدترین' },
              { value: '-publish', label: 'تازه‌ترین انتشار' },
              { value: 'title', label: 'عنوان (الفبا)' },
              { value: '-price', label: 'گران‌ترین' },
              { value: 'price', label: 'ارزان‌ترین' },
              { value: '-sales_count', label: 'پرفروش‌ترین' },
              { value: 'stock', label: 'کم‌موجودی‌ترین' },
            ]}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-fluid-xs font-bold text-slate-500 dark:text-emerald-200">
            {count.toLocaleString('fa-IR')} محصول
            {loading ? ' — در حال بارگذاری…' : ''}
          </p>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-fluid-sm font-bold text-white transition hover:bg-emerald-700"
          >
            <Plus size={15} aria-hidden="true" />
            افزودن محصول
          </button>
        </div>
      </div>

      {rows.length === 0 && !loading ? (
        <p className="rounded-3xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400 dark:border-emerald-800">
          محصولی با این فیلترها نیست.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 dark:border-emerald-900 dark:bg-emerald-950"
            >
              <img
                src={row.image_url || ''}
                alt=""
                loading="lazy"
                className="h-12 w-12 shrink-0 rounded-xl bg-slate-100 object-cover dark:bg-emerald-900"
              />
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-slate-800 dark:text-white">{row.title}</strong>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-fluid-2xs text-slate-500 dark:text-emerald-200">
                  <span>{row.category_name || 'بدون دسته'}</span>
                  {row.subcategory_name && <span>· {row.subcategory_name}</span>}
                  {row.brand && <span>· {row.brand}</span>}
                  <span>· {formatPrice(row.price)}</span>
                  {row.discount_percent > 0 && <span className="text-rose-600">· ٪{row.discount_percent}</span>}
                  <span>· موجودی {row.stock.toLocaleString('fa-IR')}</span>
                </p>
              </div>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-fluid-2xs font-bold',
                  row.status === 'published'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
                )}
              >
                {row.status === 'published' ? 'منتشر' : 'پیش‌نویس'}
              </span>
              <div className="flex items-center gap-1">
                <IconButton label={`ویرایش ${row.title}`} onClick={() => setEditing(row)}>
                  <Pencil size={15} />
                </IconButton>
                <IconButton label={row.status === 'published' ? 'پیش‌نویس کردن' : 'انتشار'} onClick={() => void togglePublish(row)}>
                  <Send size={15} />
                </IconButton>
                <IconButton label={`حذف ${row.title}`} danger onClick={() => void remove(row)}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && <Pager page={page} totalPages={totalPages} onChange={setPage} />}

      {editing && (
        <ProductEditor
          product={editing === 'new' ? null : editing}
          options={options}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ProductEditor({
  product,
  options,
  onClose,
  onSaved,
}: {
  product: ProductWork | null;
  options: StudioOptions;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ProductWork>(() => product ?? blankProduct());
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const categories = options.categories;
  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === draft.category) || null,
    [categories, draft.category],
  );

  function set<K extends keyof ProductWork>(key: K, value: ProductWork[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setFieldErrors({});
    // The writable subset, named out loud: read-only echoes (image_url, views,
    // sales_count, discounted_price) must not ride along in a PATCH — DRF
    // ignores them, but they bloat the payload and confuse the audit log.
    const payload: Partial<ProductWork> = {
      title: draft.title,
      slug: draft.slug,
      description: draft.description,
      category: draft.category,
      subcategory: draft.subcategory,
      brand: draft.brand,
      package_weight: draft.package_weight,
      price: Number(draft.price) || 0,
      discount_percent: Number(draft.discount_percent) || 0,
      stock: Number(draft.stock) || 0,
      available: draft.available,
      is_featured: draft.is_featured,
      status: draft.status,
      publish: draft.publish,
      price_on_request: draft.price_on_request,
      sku: draft.sku,
      gtin: draft.gtin,
      seo_title: draft.seo_title,
      seo_description: draft.seo_description,
      video_url: draft.video_url,
      shipping_weight_grams: draft.shipping_weight_grams,
      shipping_length_cm: draft.shipping_length_cm,
      shipping_width_cm: draft.shipping_width_cm,
      shipping_height_cm: draft.shipping_height_cm,
      production_date: draft.production_date,
      expiry_date: draft.expiry_date,
      min_order_quantity: Number(draft.min_order_quantity) || 1,
      bulk_note: draft.bulk_note,
      image: draft.image,
      gallery: draft.gallery || [],
      // Written wholesale: sending the list replaces it, and a row with an empty
      // label is dropped by the server rather than stored as noise.
      attributes: (draft.attributes || []).filter((row) => row.label.trim()),
      packages: draft.packages || [],
      tag_names: (draft.tags || []).map((tag) => tag.name),
    };
    try {
      if (product) await contentStudioApi.products.update(product.id, payload);
      else await contentStudioApi.products.create(payload);
      onSaved();
    } catch (error) {
      const parsed = parseApiError(error);
      setFieldErrors(parsed.fields || {});
      toastError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={product ? `ویرایش: ${product.title}` : 'محصول جدید'} onClose={onClose}>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput label="عنوان" value={draft.title} onChange={(value) => set('title', value)} error={fieldErrors.title} />
          <TextInput
            label="آدرس یکتا (خودکار اگر خالی)"
            value={draft.slug}
            onChange={(value) => set('slug', value)}
            dir="ltr"
            error={fieldErrors.slug}
          />
          <SelectInput
            label="دسته"
            value={String(draft.category ?? '')}
            onChange={(value) => set('category', value ? Number(value) : null)}
            options={[{ value: '', label: 'بدون دسته' }, ...categories.map((item) => ({ value: String(item.id), label: item.name }))]}
          />
          <SelectInput
            label="زیردسته"
            value={String(draft.subcategory ?? '')}
            disabled={!selectedCategory?.subcategories?.length}
            onChange={(value) => set('subcategory', value ? Number(value) : null)}
            options={[
              { value: '', label: selectedCategory ? 'بدون زیردسته' : 'ابتدا دسته را انتخاب کنید' },
              ...(selectedCategory?.subcategories || []).map((item) => ({ value: String(item.id), label: item.name })),
            ]}
            error={fieldErrors.subcategory}
          />
          <TextInput label="برند" value={draft.brand} onChange={(value) => set('brand', value)} list="cs-brands" error={fieldErrors.brand} />
          <TextInput
            label="وزن بسته (مثلاً ۲۵ کیلوگرم)"
            value={draft.package_weight}
            onChange={(value) => set('package_weight', value)}
          />
        </div>

        <datalist id="cs-brands">
          {options.brands.map((brand) => (
            <option key={brand.slug || brand.brand} value={brand.brand} />
          ))}
        </datalist>

        <Fieldset legend="قیمت و موجودی">
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberInput label="قیمت (تومان)" value={draft.price} onChange={(value) => set('price', Number(value) || 0)} />
            <NumberInput
              label="تخفیف (٪، حداکثر ۹۰)"
              value={draft.discount_percent}
              onChange={(value) => set('discount_percent', Number(value) || 0)}
              error={fieldErrors.discount_percent}
            />
            <NumberInput label="موجودی" value={draft.stock} onChange={(value) => set('stock', Number(value) || 0)} />
            <NumberInput
              label="حداقل سفارش"
              value={draft.min_order_quantity}
              onChange={(value) => set('min_order_quantity', Number(value) || 0)}
            />
            <TextInput
              label="یادداشت فروش عمده"
              value={draft.bulk_note}
              onChange={(value) => set('bulk_note', value)}
            />
            <SelectInput
              label="وضعیت انتشار"
              value={draft.status}
              onChange={(value) => set('status', value)}
              options={Object.entries(options.product_statuses).map(([value, label]) => ({ value, label }))}
              error={fieldErrors.price}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            <Checkbox label="موجود و قابل خرید" checked={draft.available} onChange={(value) => set('available', value)} />
            <Checkbox label="ویژه (صفحه اصلی)" checked={draft.is_featured} onChange={(value) => set('is_featured', value)} />
            <Checkbox
              label="قیمت با تماس تلفنی"
              checked={draft.price_on_request}
              onChange={(value) => set('price_on_request', value)}
            />
          </div>
        </Fieldset>

        <Fieldset legend="تاریخ‌ها">
          <div className="grid gap-3 sm:grid-cols-3">
            <DateInput
              label="تاریخ انتشار"
              value={draft.publish}
              withTime
              onChange={(value) => set('publish', value)}
            />
            <DateInput
              label="تاریخ تولید"
              value={draft.production_date}
              onChange={(value) => set('production_date', value)}
            />
            <DateInput label="تاریخ انقضا" value={draft.expiry_date} onChange={(value) => set('expiry_date', value)} />
          </div>
        </Fieldset>

        <Fieldset legend="شناسه‌ها و ارسال">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <TextInput label="کد کالا (SKU)" value={draft.sku} onChange={(value) => set('sku', value)} dir="ltr" />
            <TextInput label="GTIN" value={draft.gtin} onChange={(value) => set('gtin', value)} dir="ltr" />
            <TextInput
              label="آدرس ویدیو"
              value={draft.video_url}
              onChange={(value) => set('video_url', value)}
              dir="ltr"
              error={fieldErrors.video_url}
            />
            <NumberInput
              label="وزن بسته پستی (گرم)"
              value={draft.shipping_weight_grams ?? ''}
              onChange={(value) => set('shipping_weight_grams', value === '' ? null : Number(value))}
            />
            <NumberInput
              label="طول (سانتی‌متر)"
              value={draft.shipping_length_cm ?? ''}
              onChange={(value) => set('shipping_length_cm', value === '' ? null : Number(value))}
            />
            <NumberInput
              label="عرض (سانتی‌متر)"
              value={draft.shipping_width_cm ?? ''}
              onChange={(value) => set('shipping_width_cm', value === '' ? null : Number(value))}
            />
            <NumberInput
              label="ارتفاع (سانتی‌متر)"
              value={draft.shipping_height_cm ?? ''}
              onChange={(value) => set('shipping_height_cm', value === '' ? null : Number(value))}
            />
          </div>
        </Fieldset>

        <Fieldset legend="توضیحات و سئو">
          <div className="space-y-3">
            <TextArea label="توضیحات محصول" value={draft.description} onChange={(value) => set('description', value)} rows={6} />
            <TextInput label="عنوان سئو" value={draft.seo_title} onChange={(value) => set('seo_title', value)} />
            <TextArea
              label="توضیحات متا"
              value={draft.seo_description}
              onChange={(value) => set('seo_description', value)}
              rows={2}
            />
          </div>
        </Fieldset>

        <Fieldset legend="تصویرها">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="آدرس تصویر اصلی"
              value={draft.image ?? ''}
              onChange={(value) => set('image', value)}
              dir="ltr"
            />
            <div className="flex items-end gap-2">
              {draft.image_url && (
                <img
                  src={draft.image_url}
                  alt=""
                  className="h-11 w-11 rounded-lg border border-slate-200 object-cover dark:border-emerald-800"
                />
              )}
              <p className="pb-3 text-fluid-2xs leading-5 text-slate-400">
                فایل را ابتدا در «رسانه‌ها» آپلود کنید، سپس آدرسش را اینجا بچسبانید.
              </p>
            </div>
          </div>
          <TextArea
            label="گالری (هر خط یک آدرس)"
            value={(draft.gallery || []).join('\n')}
            onChange={(value) => set('gallery', value.split('\n').map((line) => line.trim()).filter(Boolean))}
            rows={3}
            dir="ltr"
          />
        </Fieldset>

        <Fieldset
          legend="جدول ویژگی‌ها"
          action={
            <button
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  attributes: [
                    ...(current.attributes || []),
                    ...options.spec_template
                      .filter((label) => !(current.attributes || []).some((row) => row.label === label))
                      .map((label) => ({ label, value: '' })),
                  ],
                }))
              }
              className="flex min-h-9 items-center gap-1 rounded-lg bg-slate-100 px-2.5 text-fluid-2xs font-bold text-slate-600 hover:bg-slate-200 dark:bg-emerald-900 dark:text-emerald-100"
            >
              <ListPlus size={13} aria-hidden="true" />
              جدول استاندارد
            </button>
          }
        >
          <RowEditor
            rows={(draft.attributes || []) as SpecRow[]}
            onRows={(next) => set('attributes', next as SpecRow[])}
            blank={{ label: '', value: '' }}
            columns={[
              { key: 'label', label: 'ویژگی', type: 'text' },
              { key: 'value', label: 'مقدار', type: 'text' },
            ]}
          />
        </Fieldset>

        <Fieldset legend="بسته‌بندی‌ها">
          <RowEditor
            rows={(draft.packages || []) as PackageRow[]}
            onRows={(next) => set('packages', next as PackageRow[])}
            blank={{ label: '', weight_kg: '', price: null, stock: null, min_order_quantity: null, bulk_note: '', production_date: null, expiry_date: null, is_default: false }}
            columns={[
              { key: 'label', label: 'عنوان بسته', type: 'text' },
              { key: 'weight_kg', label: 'وزن (کیلوگرم)', type: 'text' },
              { key: 'price', label: 'قیمت', type: 'number' },
              { key: 'stock', label: 'موجودی', type: 'number' },
              { key: 'min_order_quantity', label: 'حداقل سفارش', type: 'number' },
              { key: 'expiry_date', label: 'انقضا', type: 'date' },
            ]}
            // Exactly one package may be the default, and the server enforces it;
            // a radio here means the form cannot submit a set with two or none.
            toggle={{ key: 'is_default', label: 'پیش‌فرض' }}
          />
        </Fieldset>

        <Fieldset legend="برچسب‌ها">
          <TagPicker
            selected={(draft.tags || []).map((tag) => tag.name)}
            known={options.tags.map((tag) => tag.name)}
            onChange={(names) =>
              set('tags', names.map((name, index) => ({ id: -(index + 1), name, slug: name })))
            }
          />
        </Fieldset>
      </div>

      <ModalFooter saving={saving} onClose={onClose} onSave={() => void save()} />
    </Modal>
  );
}

function blankProduct(): ProductWork {
  return {
    id: 0,
    title: '',
    slug: '',
    description: '',
    category: null,
    subcategory: null,
    brand: '',
    package_weight: '',
    price: 0,
    discount_percent: 0,
    stock: 0,
    available: true,
    is_featured: false,
    status: 'draft',
    publish: null,
    price_on_request: false,
    sku: '',
    gtin: '',
    seo_title: '',
    seo_description: '',
    video_url: '',
    shipping_weight_grams: null,
    shipping_length_cm: null,
    shipping_width_cm: null,
    shipping_height_cm: null,
    production_date: null,
    expiry_date: null,
    min_order_quantity: 1,
    bulk_note: '',
    image: null,
    image_url: '',
    gallery: [],
    packages: [],
    attributes: [],
    tags: [],
  };
}

// =============================================================================
// Articles
// =============================================================================

function ArticlesPanel({ options }: { options: StudioOptions }) {
  const [rows, setRows] = useState<ArticleWork[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [state, setState] = useState('');
  const [featured, setFeatured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ArticleWork | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await contentStudioApi.articles.list({
        search: search || undefined,
        kind: kind || undefined,
        state: (state || undefined) as 'published' | 'draft' | undefined,
        ...(featured ? { featured: 1 as const } : {}),
        ordering: '-created_at',
        page,
        page_size: PAGE_SIZE,
      });
      setRows(response.data.results);
      setCount(response.data.count);
    } catch (error) {
      toastError(error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, kind, state, featured, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(Math.ceil(count / PAGE_SIZE), 1);

  async function togglePublish(row: ArticleWork) {
    try {
      await contentStudioApi.articles.publish(row.id);
      await load();
    } catch (error) {
      toastError(error);
    }
  }

  async function remove(row: ArticleWork) {
    if (!window.confirm(`«${row.title}» حذف شود؟`)) return;
    try {
      await contentStudioApi.articles.remove(row.id);
      await load();
    } catch (error) {
      toastError(error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput
            label="جستجو"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="عنوان یا متن…"
            debounce
          />
          <SelectInput
            label="نوع محتوا"
            value={kind}
            onChange={(value) => {
              setKind(value);
              setPage(1);
            }}
            options={[{ value: '', label: 'همه' }, ...Object.entries(options.article_kinds).map(([value, label]) => ({ value, label }))]}
          />
          <SelectInput
            label="وضعیت"
            value={state}
            onChange={(value) => {
              setState(value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'همه' },
              { value: 'published', label: 'منتشرشده' },
              { value: 'draft', label: 'پیش‌نویس' },
            ]}
          />
          <div className="flex items-end pb-2">
            <Checkbox label="فقط ویژه‌ها" checked={featured} onChange={setFeatured} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-fluid-xs font-bold text-slate-500 dark:text-emerald-200">
            {count.toLocaleString('fa-IR')} محتوا
            {loading ? ' — در حال بارگذاری…' : ''}
          </p>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-fluid-sm font-bold text-white transition hover:bg-emerald-700"
          >
            <Plus size={15} aria-hidden="true" />
            افزودن مقاله
          </button>
        </div>
      </div>

      {rows.length === 0 && !loading ? (
        <p className="rounded-3xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400 dark:border-emerald-800">
          محتوایی با این فیلترها نیست.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 dark:border-emerald-900 dark:bg-emerald-950"
            >
              <img
                src={row.cover_url || ''}
                alt=""
                loading="lazy"
                className="h-12 w-16 shrink-0 rounded-xl bg-slate-100 object-cover dark:bg-emerald-900"
              />
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-slate-800 dark:text-white">{row.title}</strong>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-fluid-2xs text-slate-500 dark:text-emerald-200">
                  <span>{options.article_kinds[row.kind] || row.kind}</span>
                  {row.crop && <span>· {row.crop}</span>}
                  <span>· {row.reading_minutes} دقیقه مطالعه</span>
                  {(row.linked_products?.length || 0) > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Link2 size={10} aria-hidden="true" />
                      {row.linked_products!.length.toLocaleString('fa-IR')} محصول
                    </span>
                  )}
                </p>
              </div>
              {row.is_featured && (
                <span className="rounded-full bg-lime-100 px-2 py-0.5 text-fluid-2xs font-bold text-lime-700 dark:bg-lime-950 dark:text-lime-200">
                  ویژه
                </span>
              )}
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-fluid-2xs font-bold',
                  row.is_published
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
                )}
              >
                {row.is_published ? 'منتشرشده' : 'پیش‌نویس'}
              </span>
              <div className="flex items-center gap-1">
                <IconButton label={`ویرایش ${row.title}`} onClick={() => setEditing(row)}>
                  <Pencil size={15} />
                </IconButton>
                <IconButton label={row.is_published ? 'پیش‌نویس کردن' : 'انتشار'} onClick={() => void togglePublish(row)}>
                  <Send size={15} />
                </IconButton>
                <IconButton label={`حذف ${row.title}`} danger onClick={() => void remove(row)}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && <Pager page={page} totalPages={totalPages} onChange={setPage} />}

      {editing && (
        <ArticleEditor
          article={editing === 'new' ? null : editing}
          options={options}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ArticleEditor({
  article,
  options,
  onClose,
  onSaved,
}: {
  article: ArticleWork | null;
  options: StudioOptions;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ArticleWork>(() => article ?? blankArticle());
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function set<K extends keyof ArticleWork>(key: K, value: ArticleWork[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setFieldErrors({});
    try {
      const payload: Partial<ArticleWork> = { ...draft };
      if (article) await contentStudioApi.articles.update(article.id, payload);
      else await contentStudioApi.articles.create(payload);
      onSaved();
    } catch (error) {
      setFieldErrors(parseApiError(error).fields || {});
      toastError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={article ? `ویرایش: ${article.title}` : 'مقاله یا راهنمای جدید'} onClose={onClose}>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput label="عنوان" value={draft.title} onChange={(value) => set('title', value)} error={fieldErrors.title} />
          <TextInput
            label="آدرس یکتا (خودکار اگر خالی)"
            value={draft.slug}
            onChange={(value) => set('slug', value)}
            dir="ltr"
            error={fieldErrors.slug}
          />
          <SelectInput
            label="نوع"
            value={draft.kind}
            onChange={(value) => set('kind', value)}
            options={Object.entries(options.article_kinds).map(([value, label]) => ({ value, label }))}
          />
          <SelectInput
            label="محصول (برای راهنمای کشت)"
            value={draft.crop}
            onChange={(value) => set('crop', value)}
            options={[
              { value: '', label: 'بدون محصول' },
              ...options.crops.map((item) => ({ value: item.crop, label: item.crop })),
            ]}
          />
        </div>

        <TextArea label="چکیده" value={draft.excerpt} onChange={(value) => set('excerpt', value)} rows={2} error={fieldErrors.excerpt} />
        <TextArea label="متن اصلی" value={draft.body} onChange={(value) => set('body', value)} rows={12} error={fieldErrors.body} />

        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="تصویر جلد (آدرس)"
            value={draft.cover ?? ''}
            onChange={(value) => set('cover', value)}
            dir="ltr"
          />
          <TextInput label="عنوان سئو" value={draft.seo_title} onChange={(value) => set('seo_title', value)} />
        </div>
        <TextArea
          label="توضیحات متا"
          value={draft.seo_description}
          onChange={(value) => set('seo_description', value)}
          rows={2}
        />

        <div className="flex flex-wrap gap-4">
          <Checkbox label="منتشر شود" checked={draft.is_published} onChange={(value) => set('is_published', value)} />
          <Checkbox label="مقاله ویژه" checked={draft.is_featured} onChange={(value) => set('is_featured', value)} />
        </div>

        <Fieldset legend="پیوندها">
          <IdPicker
            label="محصول‌های مرتبط"
            ids={draft.products}
            known={draft.linked_products?.map((item) => ({ id: item.id, title: item.title })) || []}
            search={async (term) => {
              const response = await contentStudioApi.products.list({ search: term, page_size: 12 });
              return response.data.results.map((item) => ({ id: item.id, title: item.title }));
            }}
            onChange={(ids) => set('products', ids)}
          />
          <IdPicker
            label="آگهی‌های غرفه‌ها"
            ids={draft.listings}
            known={draft.linked_listings?.map((item) => ({ id: item.id, title: item.title })) || []}
            search={async (term) => {
              const response = await agricultureApi.listMarketplace({ search: term, page: 1, page_size: 12 });
              return response.data.results.map((item) => ({ id: item.id, title: item.title }));
            }}
            onChange={(ids) => set('listings', ids)}
          />
          <IdPicker
            label="مقاله‌های مرتبط"
            ids={draft.related_articles}
            known={[]}
            search={async (term) => {
              const response = await contentStudioApi.articles.list({ search: term, page_size: 12 });
              return response.data.results.map((item) => ({ id: item.id, title: item.title }));
            }}
            onChange={(ids) => set('related_articles', ids)}
          />
        </Fieldset>
      </div>

      <ModalFooter saving={saving} onClose={onClose} onSave={() => void save()} />
    </Modal>
  );
}

function blankArticle(): ArticleWork {
  return {
    id: 0,
    title: '',
    slug: '',
    kind: 'article',
    excerpt: '',
    body: '',
    cover: null,
    cover_url: '',
    crop: '',
    products: [],
    listings: [],
    related_articles: [],
    reading_minutes: 0,
    is_published: false,
    published_at: null,
    is_featured: false,
    seo_title: '',
    seo_description: '',
  };
}

// =============================================================================
// Taxonomy
// =============================================================================

function TaxonomyPanel({ options }: { options: StudioOptions }) {
  const [categories, setCategories] = useState<TaxonomyCategory[]>(options.categories);
  const [tags, setTags] = useState<TaxonomyTag[]>(options.tags);
  const [busy, setBusy] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState({ name: '', slug: '', description: '', storefront_only: false });
  const [subDraft, setSubDraft] = useState({ name: '', slug: '', category: '' });

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [categoryResponse, tagResponse] = await Promise.all([
        contentStudioApi.categories.list(),
        contentStudioApi.tags.list(),
      ]);
      setCategories(categoryResponse.data);
      setTags(tagResponse.data);
    } finally {
      setBusy(false);
    }
  }, []);

  async function addCategory() {
    if (!categoryDraft.name.trim()) return;
    try {
      await contentStudioApi.categories.create({ ...categoryDraft, name: categoryDraft.name.trim() });
      setCategoryDraft({ name: '', slug: '', description: '', storefront_only: false });
      await refresh();
    } catch (error) {
      toastError(error);
    }
  }

  async function addSubcategory() {
    if (!subDraft.name.trim() || !subDraft.category) return;
    try {
      await contentStudioApi.subcategories.create({
        name: subDraft.name.trim(),
        slug: subDraft.slug || undefined,
        category: Number(subDraft.category),
      } as Partial<TaxonomySubCategory>);
      setSubDraft({ name: '', slug: '', category: '' });
      await refresh();
    } catch (error) {
      toastError(error);
    }
  }

  async function addTag() {
    const name = window.prompt('نام برچسب جدید');
    if (!name?.trim()) return;
    try {
      await contentStudioApi.tags.create({ name: name.trim() });
      await refresh();
    } catch (error) {
      toastError(error);
    }
  }

  async function removeCategory(category: TaxonomyCategory) {
    if (!window.confirm(`دسته «${category.name}» حذف شود؟ محصولات آن بی‌دسته می‌مانند.`)) return;
    try {
      await contentStudioApi.categories.remove(category.id);
      await refresh();
    } catch (error) {
      toastError(error);
    }
  }

  async function removeTag(tag: TaxonomyTag) {
    try {
      await contentStudioApi.tags.remove(tag.slug);
      await refresh();
    } catch (error) {
      toastError(error);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
        <h3 className="flex items-center gap-2 text-fluid-sm font-extrabold text-slate-800 dark:text-white">
          <FolderTree size={15} className="text-emerald-600" aria-hidden="true" />
          دسته‌ها ({categories.length.toLocaleString('fa-IR')})
          {busy && <span className="text-fluid-2xs font-normal text-slate-400">به‌روزرسانی…</span>}
        </h3>
        <ul className="space-y-1.5">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-emerald-900/40"
            >
              <strong className="min-w-0 flex-1 truncate text-slate-700 dark:text-emerald-50">{category.name}</strong>
              {(category.product_count || 0) > 0 && (
                <span className="text-fluid-2xs text-slate-400">
                  {category.product_count!.toLocaleString('fa-IR')} محصول
                </span>
              )}
              {category.storefront_only && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-fluid-2xs font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-200">
                  فقط غرفه‌ها
                </span>
              )}
              {(category.subcategories?.length || 0) > 0 && (
                <span className="text-fluid-2xs text-slate-400">
                  {category.subcategories!.length.toLocaleString('fa-IR')} زیردسته
                </span>
              )}
              <IconButton label={`حذف ${category.name}`} danger onClick={() => void removeCategory(category)}>
                <Trash2 size={13} />
              </IconButton>
            </li>
          ))}
        </ul>

        <div className="grid gap-2 border-t border-slate-100 pt-3 dark:border-emerald-900 sm:grid-cols-2">
          <TextInput
            label="دسته جدید"
            value={categoryDraft.name}
            onChange={(value) => setCategoryDraft({ ...categoryDraft, name: value })}
          />
          <TextInput
            label="آدرس (اختیاری)"
            value={categoryDraft.slug}
            onChange={(value) => setCategoryDraft({ ...categoryDraft, slug: value })}
            dir="ltr"
          />
          <TextInput
            label="توضیح کوتاه"
            value={categoryDraft.description}
            onChange={(value) => setCategoryDraft({ ...categoryDraft, description: value })}
          />
          <div className="flex items-end justify-between gap-2">
            <Checkbox
              label="فقط بازار غرفه‌ها"
              checked={categoryDraft.storefront_only}
              onChange={(value) => setCategoryDraft({ ...categoryDraft, storefront_only: value })}
            />
            <button
              type="button"
              onClick={() => void addCategory()}
              className="flex min-h-11 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-fluid-xs font-bold text-white"
            >
              <Plus size={13} aria-hidden="true" />
              ثبت
            </button>
          </div>
        </div>

        <div className="grid gap-2 border-t border-slate-100 pt-3 dark:border-emerald-900 sm:grid-cols-[1fr_1fr_auto]">
          <TextInput
            label="زیردسته جدید"
            value={subDraft.name}
            onChange={(value) => setSubDraft({ ...subDraft, name: value })}
          />
          <SelectInput
            label="زیرمجموعه"
            value={subDraft.category}
            onChange={(value) => setSubDraft({ ...subDraft, category: value })}
            options={[{ value: '', label: 'انتخاب دسته' }, ...categories.map((item) => ({ value: String(item.id), label: item.name }))]}
          />
          <button
            type="button"
            onClick={() => void addSubcategory()}
            className="mt-6 flex min-h-11 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-fluid-xs font-bold text-white"
          >
            <Plus size={13} aria-hidden="true" />
            ثبت
          </button>
        </div>
      </div>

      <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
        <h3 className="flex items-center gap-2 text-fluid-sm font-extrabold text-slate-800 dark:text-white">
          <Tags size={15} className="text-emerald-600" aria-hidden="true" />
          برچسب‌ها ({tags.length.toLocaleString('fa-IR')})
        </h3>
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag.id}>
              <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-fluid-2xs font-bold text-slate-600 dark:bg-emerald-900/50 dark:text-emerald-100">
                {tag.name}
                <button
                  type="button"
                  onClick={() => void removeTag(tag)}
                  aria-label={`حذف برچسب ${tag.name}`}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <X size={11} />
                </button>
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => void addTag()}
          className="flex min-h-11 items-center gap-1 rounded-xl border border-emerald-200 px-3 text-fluid-xs font-bold text-emerald-700 dark:border-emerald-700 dark:text-lime-300"
        >
          <Plus size={13} aria-hidden="true" />
          برچسب جدید
        </button>
        <p className="text-fluid-2xs leading-5 text-slate-400">
          برچسب‌ها در فیلترهای کاتالوگ و صفحه برند استفاده می‌شوند؛ برای حذف دسته‌بندی‌های اشتباه، محصول را از فرم
          ویرایش کنید.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Shared console bits
// =============================================================================

function toastError(error: unknown) {
  toast.error(parseApiError(error).message);
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-emerald-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-emerald-950 sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-emerald-900">
          <h3 className="min-w-0 truncate text-fluid-sm font-extrabold text-slate-800 dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-emerald-900"
          >
            <X size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({
  saving,
  onClose,
  onSave,
}: {
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-5 flex justify-end gap-2 border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur dark:border-emerald-900 dark:bg-emerald-950/95">
      <button
        type="button"
        onClick={onClose}
        className="min-h-11 rounded-xl border border-slate-200 px-4 text-fluid-sm font-bold text-slate-600 dark:border-emerald-800 dark:text-emerald-100"
      >
        انصراف
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-5 text-fluid-sm font-bold text-white disabled:opacity-50"
      >
        <Save size={15} aria-hidden="true" />
        {saving ? 'در حال ذخیره…' : 'ذخیره'}
      </button>
    </div>
  );
}

function Fieldset({
  legend,
  action,
  children,
}: {
  legend: string;
  action?: React.ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-900/20">
      <div className="mb-3 flex items-center justify-between gap-2">
        <legend className="text-fluid-xs font-extrabold text-slate-700 dark:text-emerald-100">{legend}</legend>
        {action}
      </div>
      {children}
    </fieldset>
  );
}

const FIELD_CLASS =
  'mt-1.5 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900 dark:text-white';

function Labelled({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-fluid-xs font-bold text-slate-600 dark:text-emerald-100">
      {label}
      {children}
      {error && <span className="mt-1 block text-fluid-2xs font-bold text-rose-600">{error}</span>}
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  dir,
  error,
  debounce = false,
  list,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  dir?: 'ltr' | 'rtl';
  error?: string;
  /** Typing in a search box should not fire a request per keystroke. */
  debounce?: boolean;
  /** id of a <datalist> with the known values, so brands autocomplete. */
  list?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  return (
    <Labelled label={label} error={error}>
      <input
        type="text"
        value={local}
        placeholder={placeholder}
        list={list}
        dir={dir}
        onChange={(event) => {
          const next = event.target.value;
          if (!debounce) {
            onChange(next);
            return;
          }
          setLocal(next);
          window.setTimeout(() => onChange(next), 350);
        }}
        className={cn(FIELD_CLASS, dir === 'ltr' && 'text-start font-mono text-xs')}
      />
    </Labelled>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: number | '' | string | null;
  /** Empty is reported as '' so an optional field can be cleared, not zeroed. */
  onChange: (value: number | '') => void;
  error?: string;
}) {
  return (
    <Labelled label={label} error={error}>
      <input
        type="number"
        min={0}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
        className={FIELD_CLASS}
      />
    </Labelled>
  );
}

/**
 * `withTime` exists because `publish` is a datetime field while production and
 * expiry dates are plain dates: one input that guessed from the label would
 * eventually send the wrong shape for one of them.
 */
function DateInput({
  label,
  value,
  onChange,
  withTime = false,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  withTime?: boolean;
}) {
  const length = withTime ? 16 : 10;
  return (
    <Labelled label={label}>
      <input
        type={withTime ? 'datetime-local' : 'date'}
        value={value ? value.slice(0, length) : ''}
        onChange={(event) => {
          const next = event.target.value;
          // `datetime-local` yields no zone; the API wants an aware timestamp, and
          // a naive one is stored against server time and shifts by hours.
          onChange(next ? (withTime ? `${next}:00Z`.slice(0, 20) : next) : null);
        }}
        className={FIELD_CLASS}
      />
    </Labelled>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
  disabled = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  error?: string;
}) {
  return (
    <Labelled label={label} error={error}>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={FIELD_CLASS}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Labelled>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  dir,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  dir?: 'ltr' | 'rtl';
  error?: string;
}) {
  return (
    <Labelled label={label} error={error}>
      <textarea
        rows={rows}
        value={value}
        dir={dir}
        onChange={(event) => onChange(event.target.value)}
        className={cn(FIELD_CLASS, 'leading-7')}
      />
    </Labelled>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-fluid-xs font-bold text-slate-600 dark:text-emerald-100">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded accent-emerald-600"
      />
      {label}
    </label>
  );
}

function IconButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-500 transition',
        danger
          ? 'hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40'
          : 'hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900 dark:hover:text-lime-300',
      )}
    >
      {children}
    </button>
  );
}

function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav className="flex items-center justify-center gap-2" aria-label="صفحه‌بندی">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 px-3 text-fluid-xs font-bold disabled:opacity-40 dark:border-emerald-800 dark:text-emerald-100"
      >
        <ChevronRight size={14} aria-hidden="true" />
        قبلی
      </button>
      <span className="text-fluid-xs text-slate-500 dark:text-emerald-200">
        {page.toLocaleString('fa-IR')} / {totalPages.toLocaleString('fa-IR')}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 px-3 text-fluid-xs font-bold disabled:opacity-40 dark:border-emerald-800 dark:text-emerald-100"
      >
        بعدی
        <ChevronLeft size={14} aria-hidden="true" />
      </button>
    </nav>
  );
}

type RowColumn = { key: string; label: string; type: 'text' | 'number' | 'date' };

/**
 * The editable tables (spec rows, packages).
 *
 * A plain table with inputs, rather than a wizard: a manager filling «جدول
 * ویژگی‌ها» is typing ten short values, and a modal per row would make that
 * agony. `toggle` renders one boolean column as a radio group so a rule like
 * "exactly one default package" is expressible in the UI, not only on the server.
 */
function RowEditor<T extends object>({
  rows,
  onRows,
  blank,
  columns,
  toggle,
}: {
  rows: T[];
  onRows: (rows: T[]) => void;
  blank: T;
  columns: RowColumn[];
  toggle?: { key: string; label: string };
}) {
  return (
    <div className="space-y-1.5">
      {rows.length === 0 && (
        <p className="text-fluid-2xs text-slate-400">موردی ثبت نشده — با دکمه پایین اضافه کنید.</p>
      )}
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-end gap-1.5">
          {columns.map((column) => (
            <input
              key={column.key}
              type={column.type}
              aria-label={column.label}
              placeholder={column.label}
              value={String((row as Record<string, unknown>)[column.key] ?? '')}
              onChange={(event) => {
                const value = column.type === 'number' ? (event.target.value === '' ? null : Number(event.target.value)) : event.target.value;
                const next = [...rows];
                next[index] = { ...row, [column.key]: value } as T;
                onRows(next);
              }}
              className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
            />
          ))}
          {toggle && (
            <label className="flex min-h-11 items-center gap-1 px-1 text-fluid-2xs font-bold text-slate-500 dark:text-emerald-200">
              <input
                type={rows.length > 1 ? 'radio' : 'checkbox'}
                name={toggle.key}
                checked={Boolean((row as Record<string, unknown>)[toggle.key])}
                onChange={() =>
                  onRows(rows.map((item, position) => ({ ...item, [toggle.key]: position === index }) as T))
                }
                className="h-3.5 w-3.5 accent-emerald-600"
              />
              {toggle.label}
            </label>
          )}
          <IconButton label="حذف ردیف" danger onClick={() => onRows(rows.filter((_, position) => position !== index))}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onRows([...rows, { ...blank }])}
        className="flex min-h-11 items-center gap-1 rounded-xl border border-dashed border-emerald-300 px-3 text-fluid-2xs font-bold text-emerald-700 dark:border-emerald-700 dark:text-lime-300"
      >
        <Plus size={12} aria-hidden="true" />
        ردیف جدید
      </button>
    </div>
  );
}

function TagPicker({
  selected,
  known,
  onChange,
}: {
  selected: string[];
  known: string[];
  onChange: (names: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-1.5">
        {selected.map((name) => (
          <li key={name}>
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-fluid-2xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
              {name}
              <button
                type="button"
                onClick={() => onChange(selected.filter((item) => item !== name))}
                aria-label={`حذف ${name}`}
              >
                <X size={11} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-1.5">
        {known
          .filter((name) => !selected.includes(name))
          .slice(0, 40)
          .map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => onChange([...selected, name])}
                className="rounded-full border border-slate-200 px-2.5 py-1 text-fluid-2xs font-bold text-slate-500 hover:border-emerald-300 hover:text-emerald-700 dark:border-emerald-800 dark:text-emerald-200"
              >
                + {name}
              </button>
            </li>
          ))}
      </div>
      <input
        type="text"
        placeholder="برچسب جدید و Enter…"
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          const name = event.currentTarget.value.trim();
          if (!name || selected.includes(name)) return;
          event.currentTarget.value = '';
          onChange([...selected, name]);
        }}
        className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
      />
    </div>
  );
}

/**
 * A multi-select over rows the console cannot fetch a full list of (products and
 * ads are numbered in the thousands): search narrows it, and a known-id box
 * covers the case where the row is a draft nobody has published yet.
 */
function IdPicker({
  label,
  ids,
  known,
  search,
  onChange,
}: {
  label: string;
  ids: number[];
  known: { id: number; title: string }[];
  search: (term: string) => Promise<{ id: number; title: string }[]>;
  onChange: (ids: number[]) => void;
}) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<{ id: number; title: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function run(value: string) {
    setBusy(true);
    try {
      setResults(await search(value));
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  const titles = new Map(known.map((item) => [item.id, item.title]));
  for (const item of results) titles.set(item.id, item.title);

  return (
    <div className="rounded-xl border border-slate-100 p-2.5 dark:border-emerald-900">
      <p className="text-fluid-xs font-bold text-slate-600 dark:text-emerald-100">{label}</p>
      {ids.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {ids.map((id) => (
            <li key={id}>
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-fluid-2xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
                {titles.get(id) || `#${id}`}
                <button type="button" onClick={() => onChange(ids.filter((item) => item !== id))} aria-label="حذف">
                  <X size={10} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-1.5">
        <input
          type="text"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void run(term.trim());
            }
          }}
          placeholder="جستجوی عنوان…"
          className="min-h-11 flex-1 rounded-xl border border-slate-200 px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
        />
        <button
          type="button"
          onClick={() => void run(term.trim())}
          disabled={busy}
          className="min-h-11 rounded-xl bg-slate-100 px-3 text-fluid-xs font-bold text-slate-600 disabled:opacity-50 dark:bg-emerald-900 dark:text-emerald-100"
        >
          {busy ? '…' : 'جستجو'}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={ids.includes(item.id)}
                onClick={() => onChange([...ids, item.id])}
                className="flex min-h-9 w-full items-center gap-1.5 rounded-lg px-2 text-start text-fluid-xs text-slate-600 hover:bg-emerald-50 disabled:opacity-40 dark:text-emerald-100 dark:hover:bg-emerald-900"
              >
                <ArrowRight size={11} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

