import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, PackageCheck, PackageX, ShoppingCart } from "lucide-react";

import { productsApi } from "../api/services";
import { useCartStore } from "../store/cartStore";
import { formatPrice } from "../utils/formatPrice";

const FALLBACK_IMAGE = "/images/hero-farm.jpg";

export default function ProductPage() {
  const { slug = "" } = useParams();
  const addToCart = useCartStore((state) => state.addToCart);
  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => (await productsApi.getBySlug(slug)).data,
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!product) return;

    const oldTitle = document.title;
    const description = `${product.title} | خرید نهاده کشاورزی از گرین کود`;
    const productUrl = `${window.location.origin}/products/${product.slug}`;
    document.title = description;

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    const oldDescription = meta.getAttribute("content");
    meta.setAttribute("content", product.description.slice(0, 155) || description);

    const canonical = document.querySelector('link[rel="canonical"]');
    const oldCanonical = canonical?.getAttribute("href");
    canonical?.setAttribute("href", productUrl);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogUrl = document.querySelector('meta[property="og:url"]');
    const oldOgTitle = ogTitle?.getAttribute("content");
    const oldOgUrl = ogUrl?.getAttribute("content");
    ogTitle?.setAttribute("content", description);
    ogUrl?.setAttribute("content", productUrl);

    return () => {
      document.title = oldTitle;
      meta?.setAttribute("content", oldDescription || "");
      canonical?.setAttribute("href", oldCanonical || "/");
      ogTitle?.setAttribute("content", oldOgTitle || "");
      ogUrl?.setAttribute("content", oldOgUrl || "");
    };
  }, [product]);

  if (isLoading) {
    return <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center px-4 text-slate-500">در حال بارگذاری محصول...</div>;
  }

  if (isError || !product) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-7xl flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">محصول مورد نظر یافت نشد</h1>
        <Link to="/" className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">بازگشت به فروشگاه</Link>
      </div>
    );
  }

  const category = typeof product.category === "string" ? product.category : product.category?.name;
  const image = product.image_url || FALLBACK_IMAGE;

  return (
    <article className="mx-auto max-w-7xl px-4 py-8 md:py-12">
      <Link to="/" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900 dark:text-lime-300" aria-label="بازگشت به محصولات">
        <ArrowRight size={18} /> بازگشت به محصولات
      </Link>

      <div className="grid gap-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:grid-cols-2 md:p-8 dark:border-emerald-900 dark:bg-emerald-950">
        <div className="overflow-hidden rounded-2xl bg-emerald-50 dark:bg-emerald-900/30">
          <img
            src={image}
            alt={product.title}
            className="aspect-square h-full w-full object-cover"
            onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }}
          />
        </div>

        <div className="flex flex-col">
          {category && <p className="mb-2 text-sm font-bold text-emerald-700 dark:text-lime-300">{category}</p>}
          <h1 className="text-2xl font-extrabold leading-10 text-slate-800 md:text-3xl dark:text-white">{product.title}</h1>
          <p className="mt-5 whitespace-pre-line leading-8 text-slate-600 dark:text-emerald-100">{product.description}</p>

          <div className="mt-6 flex items-center gap-2 text-sm font-semibold">
            {product.is_in_stock ? (
              <><PackageCheck size={18} className="text-emerald-600" /><span className="text-emerald-700 dark:text-lime-300">موجود در انبار</span></>
            ) : (
              <><PackageX size={18} className="text-rose-500" /><span className="text-rose-600">ناموجود</span></>
            )}
          </div>

          <div className="mt-auto border-t border-slate-100 pt-6 dark:border-emerald-900">
            <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{formatPrice(product.price)}</p>
            <button
              type="button"
              onClick={() => addToCart(product.id)}
              disabled={!product.is_in_stock}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald-600 to-lime-500 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ShoppingCart size={18} />
              {product.is_in_stock ? "افزودن به سبد خرید" : "ناموجود"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
