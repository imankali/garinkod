import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import {
  ArrowRight,
  BadgeCheck,
  Beaker,
  ImagePlus,
  MessageCircle,
  PackageCheck,
  PackageX,
  Ruler,
  Send,
  ShieldCheck,
  ShoppingCart,
  Flag,
  PlayCircle,
  Sparkles,
  Star,
  Tag,
  ThumbsUp,
  Weight,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import { articlesApi, commentsApi, productsApi } from "../api/services";
import { parseApiError } from "../api/errors";
import ConsultCard from "../components/product/ConsultCard";
import PackagingPicker from "../components/product/PackagingPicker";
import ProductGallery from "../components/product/ProductGallery";
import ArticleCard from "../components/article/ArticleCard";
import SharePanel from "../components/SharePanel";
import SpecTable from "../components/SpecTable";
import { RatingBars, StarPicker, StarRow } from "../components/StarRating";
import { useAuthStore } from "../store/authStore";
import { useAuthModalStore } from "../store/authModalStore";
import { useCartStore } from "../store/cartStore";
import { useSiteContact, whatsappHref } from "../hooks/useSiteContact";
import type { Comment, ProductList } from "../types";
import { formatPrice } from "../utils/formatPrice";
import { cn } from "../utils/cn";

const FALLBACK_IMAGE = "/images/hero-farm.jpg";
const STICKERS = ["🌱", "🌾", "👍", "⭐", "💚", "👏"];

type Tab = "description" | "specs" | "reviews";

const TABS: Array<{ id: Tab; label: string; icon: typeof Beaker }> = [
  { id: "description", label: "توضیحات", icon: Beaker },
  { id: "specs", label: "ویژگی‌ها", icon: BadgeCheck },
  { id: "reviews", label: "دیدگاه‌ها", icon: MessageCircle },
];

export default function ProductPage() {
  const { slug = "" } = useParams();
  /*
    `?comment=<id>` is where an inbox notification about an answered review or
    question points. The reader came for one line in a long thread, so the
    reviews tab opens itself, that comment is scrolled to and flashed, and the
    parameter is then dropped so navigating away and back does not replay it.
  */
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedComment = searchParams.get("comment") ? Number(searchParams.get("comment")) : null;
  const [flashedComment, setFlashedComment] = useState<number | null>(null);
  const linkedHandled = useRef(false);
  const addToCart = useCartStore((state) => state.addToCart);
  const { user, isAuthenticated } = useAuthStore();
  const openAuthModal = useAuthModalStore((state) => state.openAuthModal);
  const queryClient = useQueryClient();
  const { whatsappDigits, primaryPhone } = useSiteContact();
  // Declared with the other hooks, before the page's early returns: the picked
  // packaging survives a re-render, and resets when the product changes.
  const [packageId, setPackageId] = useState<number | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [rating, setRating] = useState(0);
  const [sticker, setSticker] = useState("");
  const [commentImage, setCommentImage] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>(() => (linkedComment ? "reviews" : "description"));
  const imageRef = useRef<HTMLInputElement>(null);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => (await productsApi.getBySlug(slug)).data,
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  });
  const { data: comments = [], isFetching: commentsFetching } = useQuery({
    queryKey: ["product-comments", slug],
    queryFn: async () => (await commentsApi.getByProduct(slug)).data,
    enabled: Boolean(slug),
    staleTime: 30_000,
  });
  const { data: similar = [] } = useQuery({
    queryKey: ["similar-products", slug],
    queryFn: async () => (await productsApi.getSimilar(slug)).data,
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  });
  // The guides written for this product's crop — the "راهنمای کشت گل کلم" idea,
  // reached from the product instead of only from the blog.
  const { data: guides = [] } = useQuery({
    queryKey: ["product-articles", slug, product?.id],
    queryFn: async () => (await articlesApi.getAll({ product: product?.id, limit: 3 })).data,
    enabled: Boolean(product?.id),
    staleTime: 10 * 60 * 1000,
  });

  const reviewSubmit = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("no product");
      return commentsApi.create({
        product: product.id,
        name: [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "کاربر",
        email: user?.email || "",
        body: commentBody.trim(),
        parent: replyTo?.id || null,
        sticker,
        image: commentImage,
        rating: rating || null,
      });
    },
    onSuccess: async () => {
      setCommentBody("");
      setSticker("");
      setRating(0);
      setCommentImage(null);
      setReplyTo(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["product-comments", slug] }),
        queryClient.invalidateQueries({ queryKey: ["product", slug] }),
      ]);
      toast.success("دیدگاه شما ثبت شد و پس از تأیید نمایش داده می‌شود.");
    },
    onError: (error) => {
      toast.error(parseApiError(error).message || "ثبت دیدگاه انجام نشد.");
    },
  });

  const summary = product?.rating_summary;
  useEffect(() => {
    if (!linkedComment || comments.length === 0 || linkedHandled.current) return;
    const node = document.getElementById(`comment-${linkedComment}`);
    if (!node) return;
    linkedHandled.current = true;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashedComment(linkedComment);
    setSearchParams({}, { replace: true });
    window.setTimeout(() => setFlashedComment(null), 2200);
  }, [comments, linkedComment, setSearchParams]);

  const reviews = useMemo(() => comments.filter((comment) => !comment.parent && comment.rating), [comments]);
  const visibleReviews = useMemo(
    () => (starFilter ? reviews.filter((review) => review.rating === starFilter) : reviews),
    [reviews, starFilter],
  );
  const questions = useMemo(() => comments.filter((comment) => !comment.parent && !comment.rating), [comments]);
  const specRows = product?.attributes || [];

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!isAuthenticated) {
      openAuthModal({ reason: "برای ثبت دیدگاه یا پرسش وارد حساب خود شوید." });
      return;
    }
    if (!commentBody.trim() && !sticker && !commentImage) {
      toast.error("متن دیدگاه را بنویسید.");
      return;
    }
    await reviewSubmit.mutateAsync();
  }

  if (isLoading) return <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center px-4 text-slate-500">در حال بارگذاری محصول...</div>;
  if (isError || !product) return <><Helmet><title>محصول پیدا نشد | گرین کود</title><meta name="robots" content="noindex,nofollow" /></Helmet><div className="mx-auto flex min-h-[50vh] max-w-7xl flex-col items-center justify-center px-4 text-center"><h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">محصول مورد نظر یافت نشد</h1><Link to="/" className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">بازگشت به فروشگاه</Link></div></>;

  const category = typeof product.category === "string" ? product.category : product.category?.name;
  const image = product.image_url || FALLBACK_IMAGE;
  const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');
  const productUrl = `${siteUrl}/products/${product.slug}`;
  const imageUrl = new URL(image, `${siteUrl}/`).href;
  const seoTitle = product.seo_title || `${product.title} | گرین کود`;
  const seoDescription = product.seo_description || product.description.slice(0, 160);
  const gtinProperty = product.gtin && [8, 12, 13, 14].includes(product.gtin.length)
    ? { [`gtin${product.gtin.length}`]: product.gtin }
    : {};
  const priceOnRequest = Boolean(product.price_on_request);

  // Which bag is being bought decides the price, the stock, the minimum order and
  // the expiry that is quoted, so the page reads everything off that row instead
  // of mixing the product's own numbers with the selected one.
  const packages = product.packages ?? [];
  const selectedPackage = packages.find((item) => item.id === packageId) ?? packages[0] ?? null;
  const displayPrice = selectedPackage ? selectedPackage.effective_price : product.price;
  const displayDiscounted = selectedPackage ? selectedPackage.discounted_price : product.discounted_price;
  const packageInStock = selectedPackage ? selectedPackage.is_in_stock : product.is_in_stock;
  const whatsappDraft = whatsappDigits
    ? whatsappHref(whatsappDigits, `سلام، درباره «${product.title}» و قیمت عمده سؤال دارم: ${productUrl}`)
    : '';
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${productUrl}#product`,
        name: product.title,
        url: productUrl,
        image: [imageUrl],
        description: seoDescription,
        category,
        ...(product.sku ? { sku: product.sku } : {}),
        ...gtinProperty,
        ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
        offers: {
          '@type': 'Offer',
          url: productUrl,
          // Schema.org expects ISO 4217. Stored/displayed values are تومان,
          // therefore the structured IRR amount is explicitly multiplied by 10.
          priceCurrency: 'IRR',
          ...(priceOnRequest
            ? { priceSpecification: { '@type': 'PriceSpecification', price: undefined, priceCurrency: 'IRR' }, availability: 'https://schema.org/InStock' }
            : {
                price: product.price * 10,
                availability: product.is_in_stock
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
                itemCondition: 'https://schema.org/NewCondition',
              }),
        },
        // Only publish an aggregate the platform actually has: a product with no
        // scored review must not advertise empty stars to Google.
        ...(summary && summary.reviews_count > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: summary.average,
                reviewCount: summary.reviews_count,
                bestRating: 5,
                worstRating: 1,
              },
              review: visibleReviews.slice(0, 3).map((review) => ({
                '@type': 'Review',
                reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 5, worstRating: 1 },
                author: { '@type': 'Person', name: review.name },
                reviewBody: review.body.slice(0, 500),
                datePublished: review.created.slice(0, 10),
              })),
            }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'گرین کود', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: category || 'محصولات', item: `${siteUrl}/products` },
          { '@type': 'ListItem', position: 3, name: product.title, item: productUrl },
        ],
      },
    ],
  };
  const facts = [
    product.brand ? { icon: ShieldCheck, label: 'برند', value: product.brand } : null,
    product.package_weight ? { icon: Weight, label: 'بسته‌بندی', value: product.package_weight } : null,
    product.sku ? { icon: BadgeCheck, label: 'شناسه کالا', value: product.sku } : null,
    product.shipping_weight_grams ? { icon: Ruler, label: 'وزن ارسال', value: `${(product.shipping_weight_grams / 1000).toLocaleString('fa-IR')} کیلوگرم` } : null,
  ].filter(Boolean) as Array<{ icon: typeof Beaker; label: string; value: string }>;

  return <><Helmet>
    <title>{seoTitle}</title>
    <meta name="description" content={seoDescription} />
    <link rel="canonical" href={productUrl} />
    <meta property="og:type" content="product" />
    <meta property="og:title" content={seoTitle} />
    <meta property="og:description" content={seoDescription} />
    <meta property="og:url" content={productUrl} />
    <meta property="og:image" content={imageUrl} />
    {!priceOnRequest && <meta property="product:price:amount" content={String(product.price * 10)} />}
    <meta property="product:price:currency" content="IRR" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={seoTitle} />
    <meta name="twitter:description" content={seoDescription} />
    <meta name="twitter:image" content={imageUrl} />
    <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
  </Helmet><main className="mx-auto max-w-7xl px-[var(--page-gutter)] py-8 md:py-12">
    <Link to="/products" className="mb-7 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900 dark:text-lime-300" aria-label="بازگشت به محصولات"><ArrowRight size={18} /> بازگشت به محصولات</Link>

    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="grid gap-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:grid-cols-2 md:p-8 dark:border-emerald-900 dark:bg-emerald-950">
        <ProductGallery shots={product.gallery ?? []} title={product.title} cover={image} />
        <div className="flex flex-col">{category && (
            <p className="mb-2 flex flex-wrap items-center gap-2 text-sm font-bold text-emerald-700 dark:text-lime-300">
              {typeof product.category === "object" && product.category && 'slug' in product.category ? (
                <Link to={`/c/${product.category.slug}`} className="hover:underline">{category}</Link>
              ) : (
                <span>{category}</span>
              )}
              {product.brand ? (
                <Link
                  to={`/brand/${product.brand_slug || product.brand}`}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-fluid-2xs text-emerald-700 hover:underline dark:bg-emerald-900/60 dark:text-lime-300"
                >
                  <ShieldCheck size={12} aria-hidden="true" /> {product.brand}
                </Link>
              ) : null}
            </p>
          )}
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-extrabold leading-10 text-slate-800 md:text-3xl dark:text-white">{product.title}</h1>
          </div>

          {/* Rating line: stars, average and a jump to the reviews tab. */}
          <button
            type="button"
            onClick={() => { setTab('reviews'); document.getElementById('product-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            className="mt-2.5 inline-flex items-center gap-2 self-start rounded-lg px-1 py-0.5 text-start transition hover:bg-emerald-50 dark:hover:bg-emerald-900/50"
          >
            <StarRow value={summary?.average || 0} size={15} />
            <span className="text-fluid-2xs text-slate-500 dark:text-emerald-300">
              {summary && summary.reviews_count
                ? `${summary.average.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} از ۵ · ${summary.reviews_count.toLocaleString('fa-IR')} دیدگاه`
                : 'هنوز دیدگاه امتیازدار ندارد'}
            </span>
          </button>

          {facts.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {facts.map((fact) => (
                <li key={fact.label} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-1.5 text-fluid-2xs font-bold text-slate-600 dark:bg-emerald-900/50 dark:text-emerald-100">
                  <fact.icon size={13} className="text-emerald-600 dark:text-lime-300" />
                  {fact.label}: <span className="text-slate-800 dark:text-white">{fact.value}</span>
                </li>
              ))}
            </ul>
          )}

          {(product.is_expiring_soon || (product.tags?.length ?? 0) > 0 || product.video_url) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {product.is_expiring_soon && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-fluid-2xs font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
                  <Sparkles size={12} aria-hidden="true" />
                  {typeof product.expiry_days_left === 'number' && product.expiry_days_left >= 0
                    ? `${product.expiry_days_left.toLocaleString('fa-IR')} روز تا انقضای اعلام‌شده`
                    : 'به تاریخ انقضای اعلام‌شده نزدیک شده‌ایم'}
                </span>
              )}
              {product.video_url && (
                <a
                  href={product.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-fluid-2xs font-bold text-slate-700 transition hover:bg-emerald-100 dark:bg-emerald-900/60 dark:text-emerald-100"
                >
                  <PlayCircle size={13} aria-hidden="true" /> ویدئوی معرفی محصول
                </a>
              )}
              {(product.tags ?? []).map((item) => (
                <Link
                  key={item.slug}
                  to={`/tag/${item.slug}`}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-fluid-2xs font-bold text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-emerald-800 dark:text-emerald-200"
                >
                  <Tag size={12} aria-hidden="true" /> {item.name}
                </Link>
              ))}
            </div>
          )}

          <p className="mt-5 whitespace-pre-line leading-8 text-slate-600 dark:text-emerald-100">{product.description}</p>
          <div className="mt-6 flex items-center gap-2 text-sm font-semibold">{product.is_in_stock ? <><PackageCheck size={18} className="text-emerald-600" /><span className="text-emerald-700 dark:text-lime-300">موجود در انبار</span></> : <><PackageX size={18} className="text-rose-500" /><span className="text-rose-600">ناموجود</span></>}</div>
          {/* The promise is worth reading where the decision is made, not only
              in the footer after the money has moved. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-fluid-2xs font-bold text-slate-500 dark:text-emerald-200">
            <Link to="/legal/warranty" className="inline-flex items-center gap-1 hover:text-emerald-700 hover:underline dark:hover:text-lime-300"><ShieldCheck size={13} aria-hidden="true" /> ضمانت اصالت کالا</Link>
            <Link to="/legal/returns" className="hover:text-emerald-700 hover:underline dark:hover:text-lime-300">شرایط بازگشت کالا</Link>
            <Link to="/legal/shipping" className="hover:text-emerald-700 hover:underline dark:hover:text-lime-300">زمان و هزینه ارسال</Link>
          </div>

          {product.price_on_request && (
            <p className="mt-4 rounded-2xl bg-amber-50 p-3.5 text-fluid-xs leading-7 text-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              این کالا به‌صورت عمده و با استعلام قیمت فروخته می‌شود؛ رقم درج‌شده در سایت مبنای فروش نیست. برای قیمت روز، حداقل سفارش و زمان تحویل تماس بگیرید.
            </p>
          )}

          <PackagingPicker packages={packages} selected={selectedPackage} onSelect={(id) => setPackageId(id)} />

          <div className="mt-auto border-t border-slate-100 pt-6 dark:border-emerald-900">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-2xl font-extrabold text-slate-800 dark:text-white">
                {priceOnRequest ? 'تماس بگیرید' : formatPrice(displayPrice)}
                {!priceOnRequest && product.discount_percent > 0 && (
                  <span className="ms-2 text-sm font-bold text-slate-400 line-through">{formatPrice(product.price)}</span>
                )}
              </p>
              {product.discount_percent > 0 && !priceOnRequest && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-fluid-2xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                  <Sparkles size={12} />
                  {product.discount_percent.toLocaleString('fa-IR')}٪ تخفیف
                </span>
              )}
            </div>
            {!priceOnRequest && product.discount_percent > 0 && (
              <p className="mt-1.5 text-fluid-sm font-extrabold text-emerald-700 dark:text-lime-300">{formatPrice(displayDiscounted)} تومان</p>
            )}

            {priceOnRequest ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {whatsappDraft && (
                  <a href={whatsappDraft} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald-600 to-lime-500 px-5 text-sm font-bold text-white shadow-md">
                    <Send size={18} />
                    استعلام قیمت در واتساپ
                  </a>
                )}
                {primaryPhone && (
                  <a href={`tel:${primaryPhone.replace(/[^\d+]/g, '')}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-300 px-5 text-sm font-bold text-emerald-700 dark:border-emerald-700 dark:text-lime-300" dir="ltr">
                    <MessageCircle size={18} />
                    تماس
                  </a>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void addToCart(
                  product.id,
                  (selectedPackage?.min_order_quantity ?? 1) > 1 ? (selectedPackage?.min_order_quantity ?? 1) : 1,
                  selectedPackage?.id ?? null,
                )}
                disabled={!product.is_in_stock || !packageInStock}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald-600 to-lime-500 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ShoppingCart size={18} />
                {product.is_in_stock && packageInStock ? "افزودن به سبد خرید" : "از این بسته‌بندی موجود نیست"}
              </button>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <SharePanel url={productUrl} title={product.title} text={seoDescription} />
              <Link to="/support" className="text-fluid-2xs font-bold text-emerald-700 underline dark:text-lime-300">گزارش خطای قیمت یا موجودی</Link>
            </div>
          </div>
        </div>
      </article>

      <aside className="space-y-4">
        <ConsultCard productTitle={product.title} productUrl={productUrl} />
        {product.stock > 0 && product.stock <= 5 && (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-fluid-xs font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
            تنها {product.stock.toLocaleString('fa-IR')} عدد در انبار باقی مانده است.
          </p>
        )}
        {product.sales_count > 0 && (
          <p className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-fluid-xs text-slate-500 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            <strong className="text-slate-800 dark:text-white">{product.sales_count.toLocaleString('fa-IR')}</strong> خرید از زمان انتشار این کالا.
          </p>
        )}
      </aside>
    </div>

    {/* Tabs: توضیحات / ویژگی‌ها / دیدگاه‌ها */}
    <div id="product-tabs" className="mt-9 scroll-mt-24">
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1 dark:bg-emerald-900/60" role="tablist" aria-label="بخش‌های محصول">
        {TABS.map((item) => {
          const count = item.id === 'reviews' ? comments.length : item.id === 'specs' ? specRows.length : 0;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-4 text-fluid-xs font-bold transition',
                tab === item.id
                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-emerald-950 dark:text-lime-300'
                  : 'text-slate-500 dark:text-emerald-300',
              )}
            >
              <item.icon size={15} />
              {item.label}
              {count > 0 && <span className="rounded-full bg-emerald-100 px-1.5 text-fluid-2xs text-emerald-700 dark:bg-emerald-800 dark:text-lime-200">{count.toLocaleString('fa-IR')}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {tab === 'specs' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            {specRows.length ? (
              <SpecTable rows={specRows} title="جدول ویژگی‌های کالا" columns={2} />
            ) : (
              <p className="rounded-3xl border border-dashed border-emerald-200 bg-white/60 p-6 text-fluid-sm text-slate-500 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                جدول مشخصات این کالا هنوز کامل نشده است. اگر برگه اطلاعات (تایت‌شیت) یا برچسب محصول را دارید، برای پشتیبانی بفرستید تا منتشر شود.
              </p>
            )}
            <div className="rounded-3xl border border-slate-100 bg-white p-5 dark:border-emerald-900 dark:bg-emerald-950">
              <h3 className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">راهنمای مصرف</h3>
              <p className="mt-2 text-fluid-xs leading-7 text-slate-500 dark:text-emerald-200">
                دوز و روش مصرف را با «ماشین‌حساب دوز» و بر پایه مساحت زمین خودتان حساب کنید؛ اعداد این صفحه جای برچسب رسمی محصول را نمی‌گیرد.
              </p>
              <Link to="/#agri-calculator" className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-3 text-fluid-2xs font-bold text-white">ماشین‌حساب دوز</Link>
            </div>
          </div>
        )}

        {tab === 'reviews' && (
          <section className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-100 bg-white p-5 dark:border-emerald-900 dark:bg-emerald-950">
                <p className="text-fluid-2xs font-bold text-slate-500 dark:text-emerald-300">میانگین امتیاز</p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{summary?.average ? summary.average.toLocaleString('fa-IR', { maximumFractionDigits: 1 }) : '—'}</span>
                  <span className="text-fluid-2xs text-slate-400">از ۵</span>
                </p>
                <StarRow value={summary?.average || 0} size={16} className="mt-1.5" />
                <p className="mt-2 text-fluid-2xs text-slate-500 dark:text-emerald-300">
                  {(summary?.reviews_count || 0).toLocaleString('fa-IR')} دیدگاه ثبت‌شده
                  {questions.length > 0 && ` · ${questions.length.toLocaleString('fa-IR')} پرسش`}
                </p>
                {summary && summary.reviews_count > 0 && (
                  <div className="mt-4">
                    <RatingBars
                      distribution={summary.distribution}
                      total={summary.reviews_count}
                      activeBucket={starFilter}
                      onSelect={(star) => setStarFilter((current) => (current === star ? null : star))}
                    />
                  </div>
                )}
              </div>

              <form className="space-y-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950" onSubmit={submitComment}>
                <h3 className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">{replyTo ? 'پاسخ به دیدگاه' : 'ثبت دیدگاه'}</h3>
                {replyTo && (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-2.5 text-fluid-2xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">
                    <span className="truncate">در پاسخ به {replyTo.name}</span>
                    <button type="button" onClick={() => setReplyTo(null)} aria-label="لغو پاسخ"><X size={15} /></button>
                  </div>
                )}
                {!replyTo && (
                  <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-emerald-900/40">
                    <p className="mb-1 text-fluid-2xs font-bold text-slate-500 dark:text-emerald-300">امتیاز شما به کیفیت و بسته‌بندی</p>
                    <StarPicker value={rating} onChange={setRating} disabled={!isAuthenticated} />
                  </div>
                )}
                <textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} rows={4} placeholder={isAuthenticated ? "تجربه خرید، نحوه بسته‌بندی و نتیجه در مزرعه را بنویسید..." : "برای ثبت نظر یا پاسخ ابتدا وارد حساب کاربری شوید"} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" />
                <div className="flex flex-wrap items-center gap-2">{STICKERS.map((item) => <button key={item} type="button" onClick={() => setSticker(sticker === item ? "" : item)} className={cn("rounded-lg px-2 py-1 text-lg", sticker === item ? "bg-emerald-100 ring-1 ring-emerald-400 dark:bg-emerald-900" : "bg-slate-50 dark:bg-emerald-900/40")}>{item}</button>)}
                  <input ref={imageRef} type="file" aria-label="افزودن تصویر به دیدگاه" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setCommentImage(event.target.files?.[0] || null)} />
                  <button type="button" onClick={() => imageRef.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 dark:border-emerald-700 dark:text-emerald-100"><ImagePlus size={15} />{commentImage ? commentImage.name : "افزودن عکس"}</button>
                  <button disabled={reviewSubmit.isPending} className="ms-auto inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Send size={16} />{reviewSubmit.isPending ? "در حال ثبت..." : "ثبت نظر"}</button>
                </div>
              </form>
            </div>

            <div className="space-y-4">
              {commentsFetching && !comments.length && <p className="text-fluid-sm text-slate-400">در حال بارگذاری دیدگاه‌ها...</p>}
              {!comments.length && <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-emerald-900/40 dark:text-emerald-200">هنوز نظری ثبت نشده است. اولین تجربه خرید را بنویسید.</p>}
              {visibleReviews.length > 0 && (
                <div className="space-y-3">
                  {starFilter && (
                    <button type="button" onClick={() => setStarFilter(null)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-amber-50 px-3 text-fluid-2xs font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
                      نمایش دیدگاه‌های {starFilter.toLocaleString('fa-IR')} ستاره · حذف فیلتر
                    </button>
                  )}
                  {visibleReviews.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    onReply={setReplyTo}
                    highlighted={flashedComment === comment.id}
                  />
                ))}
                </div>
              )}
              {questions.length > 0 && (
                <section className="rounded-3xl border border-slate-100 bg-white p-5 dark:border-emerald-900 dark:bg-emerald-950">
                  <h3 className="flex items-center gap-2 text-fluid-sm font-extrabold text-slate-800 dark:text-white">
                    <MessageCircle size={16} className="text-emerald-600 dark:text-lime-300" />
                    پرسش‌های بی‌پاسخ مانده و پاسخ غرفه
                  </h3>
                  <div className="mt-3 space-y-3">
                    {questions.map((comment) => (
                      <CommentCard
                        key={comment.id}
                        comment={comment}
                        onReply={setReplyTo}
                        highlighted={flashedComment === comment.id}
                      />
                    ))}
                  </div>
                </section>
              )}
              {reviews.length === 0 && questions.length === 0 && comments.length > 0 && (
                comments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    onReply={setReplyTo}
                    highlighted={flashedComment === comment.id}
                  />
                ))
              )}
            </div>
          </section>
        )}

        {tab === 'description' && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="prose-emerald rounded-3xl border border-slate-100 bg-white p-5 text-fluid-sm leading-8 text-slate-600 shadow-sm sm:p-6 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                {product.description}
              </div>
              {guides.length > 0 && (
                <section>
                  <h3 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">راهنمای کشت مرتبط با این کالا</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {guides.map((article) => <ArticleCard key={article.id} article={article} />)}
                  </div>
                </section>
              )}
            </div>
            <div className="space-y-4">
              {specRows.length > 0 && (
                <div className="rounded-3xl border border-slate-100 bg-white p-5 dark:border-emerald-900 dark:bg-emerald-950">
                  <h3 className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">خلاصه مشخصات</h3>
                  <ul className="mt-3 space-y-2">
                    {specRows.slice(0, 6).map((row) => (
                      <li key={row.label} className="flex items-baseline justify-between gap-3 border-b border-dashed border-slate-100 pb-2 text-fluid-xs last:border-0 dark:border-emerald-900">
                        <span className="text-slate-500 dark:text-emerald-300">{row.label}</span>
                        <span className="font-bold text-slate-800 dark:text-white">{row.value}</span>
                      </li>
                    ))}
                  </ul>
                  {specRows.length > 6 && (
                    <button type="button" onClick={() => setTab('specs')} className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-emerald-50 px-3 text-fluid-2xs font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-lime-300">
                      مشاهده جدول کامل ({specRows.length.toLocaleString('fa-IR')} ویژگی)
                    </button>
                  )}
                </div>
              )}
              {summary && summary.reviews_count > 0 && (
                <div className="rounded-3xl bg-emerald-50 p-5 dark:bg-emerald-900/40">
                  <p className="flex items-center gap-1.5 text-fluid-sm font-extrabold text-emerald-800 dark:text-lime-300">
                    <Star size={15} fill="currentColor" />
                    تجربه خریداران
                  </p>
                  <p className="mt-2 text-fluid-xs leading-7 text-slate-600 dark:text-emerald-100">
                    میانگین {summary.average.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} از ۵ بر پایه {summary.reviews_count.toLocaleString('fa-IR')} دیدگاه تأییدشده.
                  </p>
                  <button type="button" onClick={() => setTab('reviews')} className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-white px-3 text-fluid-2xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-lime-300">
                    خواندن دیدگاه‌ها
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {similar.length > 0 && <section className="mt-10"><h2 className="text-2xl font-extrabold text-slate-800 dark:text-white">محصولات مشابه</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{similar.map((item) => <SimilarCard key={item.id} product={item} />)}</div></section>}
  </main></>;
}

function CommentCard({ comment, onReply, nested = false, highlighted = false }: { comment: Comment; onReply: (comment: Comment) => void; nested?: boolean; /** The comment an inbox notification was about. */ highlighted?: boolean }) {
  // «مفید بود» is writable by a guest, so the row keeps its own tally taken from
  // the server response: the API returns the authoritative count after the
  // toggle, so nothing is shown that the database has not recorded.
  const [votes, setVotes] = useState({ count: comment.helpful_count ?? 0, voted: false, busy: false });
  const [reported, setReported] = useState(Boolean(comment.is_reported));

  async function toggleHelpful() {
    if (votes.busy) return;
    setVotes((current) => ({ ...current, busy: true }));
    try {
      const response = await commentsApi.toggleHelpful(comment.id);
      setVotes({ count: response.data.helpful_count, voted: response.data.voted, busy: false });
    } catch (error) {
      setVotes((current) => ({ ...current, busy: false }));
      toast.error(parseApiError(error).message);
    }
  }

  async function reportReview() {
    const reason = window.prompt('چه چیزی در این دیدگاه مشکل دارد؟ (اختیاری)') ?? '';
    try {
      await commentsApi.report(comment.id, reason);
      setReported(true);
      toast('گزارش برای بررسی به میز پشتیبانی رسید؛ دیدگاه پنهان نمی‌شود.');
    } catch (error) {
      toast.error(parseApiError(error).message);
    }
  }

 return <article id={`comment-${comment.id}`} className={cn("scroll-mt-28 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-colors duration-500 dark:border-emerald-900 dark:bg-emerald-950", nested && "ms-6 mt-3", highlighted && "border-amber-300 ring-2 ring-amber-300 dark:border-amber-500")}>
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-fluid-sm text-slate-800 dark:text-white">{comment.name}</strong>
        {comment.is_verified_purchase && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-fluid-2xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
            <BadgeCheck size={12} />
            خرید قطعی
          </span>
        )}
      </div>
      {comment.rating ? <StarRow value={comment.rating} size={13} className="mt-1" /> : <span className="text-fluid-2xs text-slate-400">پرسش</span>}
    </div>
    <time className="shrink-0 text-fluid-2xs text-slate-400">{new Date(comment.created).toLocaleDateString("fa-IR")}</time>
  </div>
  <p className="mt-3 whitespace-pre-line text-fluid-sm leading-7 text-slate-600 dark:text-emerald-100">{comment.sticker && <span className="me-1 text-lg">{comment.sticker}</span>}{comment.body}</p>
  {comment.image && <img src={comment.image} alt="تصویر ارسالی کاربر" className="mt-3 max-h-72 rounded-xl object-cover" />}
  <div className="mt-2 flex flex-wrap items-center gap-2">
    {!nested && (
      <button
        type="button"
        onClick={() => void toggleHelpful()}
        disabled={votes.busy}
        aria-pressed={votes.voted}
        className={cn(
          "inline-flex min-h-9 items-center gap-1 rounded-lg border px-2.5 text-fluid-2xs font-bold transition",
          votes.voted
            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/60 dark:text-lime-300"
            : "border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-700 dark:border-emerald-800 dark:text-emerald-200",
        )}
      >
        <ThumbsUp size={13} aria-hidden="true" />
        مفید بود{votes.count ? ` (${votes.count.toLocaleString('fa-IR')})` : ''}
      </button>
    )}
    {!nested && (
      <button
        type="button"
        onClick={() => void reportReview()}
        disabled={reported}
        className={cn("inline-flex min-h-9 items-center gap-1 px-2 text-fluid-2xs font-bold transition", reported ? "text-slate-400" : "text-slate-400 hover:text-rose-600 dark:hover:text-rose-300")}
      >
        <Flag size={13} aria-hidden="true" />
        {reported ? 'گزارش‌شده' : 'گزارش'}
      </button>
    )}
    <button onClick={() => onReply(comment)} className="ms-auto text-fluid-2xs font-bold text-emerald-700 hover:underline dark:text-lime-300">پاسخ دادن</button>
  </div>
  {comment.replies?.map((reply) => <CommentCard key={reply.id} comment={reply} onReply={onReply} nested />)}
</article>; }

function SimilarCard({ product }: { product: ProductList }) { return <Link to={`/products/${product.slug}`} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950"><img src={product.image_url || FALLBACK_IMAGE} alt={product.title} className="h-36 w-full object-cover" /><div className="p-3"><p className="line-clamp-2 text-fluid-sm font-bold text-slate-800 dark:text-white">{product.title}</p>{typeof product.avg_rating === 'number' && product.avg_rating > 0 && <StarRow value={product.avg_rating} size={12} className="mt-1.5" count={product.reviews_count || 0} />}<p className="mt-2 text-fluid-sm font-extrabold text-emerald-700 dark:text-lime-300">{product.price_on_request ? 'تماس بگیرید' : formatPrice(product.price)}</p></div></Link>; }
