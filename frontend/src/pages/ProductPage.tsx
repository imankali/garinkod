import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ImagePlus, MessageCircle, PackageCheck, PackageX, Send, Share2, ShoppingCart, X } from "lucide-react";
import toast from "react-hot-toast";

import { commentsApi, productsApi } from "../api/services";
import { useAuthStore } from "../store/authStore";
import { useCartStore } from "../store/cartStore";
import type { Comment, ProductList } from "../types";
import { formatPrice } from "../utils/formatPrice";

const FALLBACK_IMAGE = "/images/hero-farm.jpg";
const STICKERS = ["🌱", "🌾", "👍", "⭐", "💚", "👏"];

export default function ProductPage() {
  const { slug = "" } = useParams();
  const addToCart = useCartStore((state) => state.addToCart);
  const { user, isAuthenticated } = useAuthStore();
  const [commentBody, setCommentBody] = useState("");
  const [sticker, setSticker] = useState("");
  const [commentImage, setCommentImage] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => (await productsApi.getBySlug(slug)).data,
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  });
  const { data: comments = [], refetch: refetchComments } = useQuery({
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

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share && product) {
        await navigator.share({ title: product.title, text: product.description.slice(0, 120), url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("لینک محصول کپی شد.");
      }
    } catch {
      // User cancellation should not be treated as an error.
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!isAuthenticated || !product || (!commentBody.trim() && !sticker && !commentImage)) {
      if (!isAuthenticated) toast.error("برای ثبت نظر یا پاسخ ابتدا وارد حساب کاربری شوید.");
      return;
    }
    setSubmittingComment(true);
    try {
      await commentsApi.create({
        product: product.id,
        name: [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "کاربر",
        email: user?.email || "",
        body: commentBody.trim(),
        parent: replyTo?.id || null,
        sticker,
        image: commentImage,
      });
      setCommentBody("");
      setSticker("");
      setCommentImage(null);
      setReplyTo(null);
      await refetchComments();
      toast.success("نظر شما ثبت شد.");
    } catch {
      // API client displays the detailed failure.
    } finally {
      setSubmittingComment(false);
    }
  }

  if (isLoading) return <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center px-4 text-slate-500">در حال بارگذاری محصول...</div>;
  if (isError || !product) return <div className="mx-auto flex min-h-[50vh] max-w-7xl flex-col items-center justify-center px-4 text-center"><h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">محصول مورد نظر یافت نشد</h1><Link to="/" className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">بازگشت به فروشگاه</Link></div>;

  const category = typeof product.category === "string" ? product.category : product.category?.name;
  const image = product.image_url || FALLBACK_IMAGE;
  return <main className="mx-auto max-w-7xl px-4 py-8 md:py-12"><Link to="/" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900 dark:text-lime-300" aria-label="بازگشت به محصولات"><ArrowRight size={18} /> بازگشت به محصولات</Link><article className="grid gap-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:grid-cols-2 md:p-8 dark:border-emerald-900 dark:bg-emerald-950"><div className="overflow-hidden rounded-2xl bg-emerald-50 dark:bg-emerald-900/30"><img src={image} alt={product.title} className="aspect-square h-full w-full object-cover" onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }} /></div><div className="flex flex-col">{category && <p className="mb-2 text-sm font-bold text-emerald-700 dark:text-lime-300">{category}</p>}<div className="flex items-start justify-between gap-4"><h1 className="text-2xl font-extrabold leading-10 text-slate-800 md:text-3xl dark:text-white">{product.title}</h1><button onClick={share} className="rounded-xl border border-emerald-200 p-2 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-lime-300" aria-label="اشتراک‌گذاری محصول"><Share2 size={19} /></button></div><p className="mt-5 whitespace-pre-line leading-8 text-slate-600 dark:text-emerald-100">{product.description}</p><div className="mt-6 flex items-center gap-2 text-sm font-semibold">{product.is_in_stock ? <><PackageCheck size={18} className="text-emerald-600" /><span className="text-emerald-700 dark:text-lime-300">موجود در انبار</span></> : <><PackageX size={18} className="text-rose-500" /><span className="text-rose-600">ناموجود</span></>}</div><div className="mt-auto border-t border-slate-100 pt-6 dark:border-emerald-900"><p className="text-2xl font-extrabold text-slate-800 dark:text-white">{formatPrice(product.price)}</p><button type="button" onClick={() => addToCart(product.id)} disabled={!product.is_in_stock} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald-600 to-lime-500 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"><ShoppingCart size={18} />{product.is_in_stock ? "افزودن به سبد خرید" : "ناموجود"}</button></div></div></article><section className="mt-9"><div className="flex items-center gap-2"><MessageCircle className="text-emerald-600" /><h2 className="text-2xl font-extrabold text-slate-800 dark:text-white">پرسش‌ها و تجربه خریداران</h2></div><form onSubmit={submitComment} className="mt-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">{replyTo && <div className="mb-3 flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100"><span>در پاسخ به {replyTo.name}</span><button type="button" onClick={() => setReplyTo(null)} aria-label="لغو پاسخ"><X size={15} /></button></div>}<textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} rows={3} placeholder={isAuthenticated ? "تجربه یا پرسش خود را بنویسید..." : "برای ثبت نظر وارد حساب کاربری شوید"} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" /><div className="mt-3 flex flex-wrap items-center gap-2">{STICKERS.map((item) => <button key={item} type="button" onClick={() => setSticker(sticker === item ? "" : item)} className={`rounded-lg px-2 py-1 text-lg ${sticker === item ? "bg-emerald-100 ring-1 ring-emerald-400 dark:bg-emerald-900" : "bg-slate-50 dark:bg-emerald-900/40"}`}>{item}</button>)}<input ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setCommentImage(event.target.files?.[0] || null)} /><button type="button" onClick={() => imageRef.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 dark:border-emerald-700 dark:text-emerald-100"><ImagePlus size={15} />{commentImage ? commentImage.name : "افزودن عکس"}</button><button disabled={submittingComment || !isAuthenticated} className="mr-auto inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Send size={16} />{submittingComment ? "در حال ثبت..." : "ثبت نظر"}</button></div></form><div className="mt-5 space-y-4">{comments.length ? comments.map((comment) => <CommentCard key={comment.id} comment={comment} onReply={setReplyTo} />) : <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-emerald-900/40 dark:text-emerald-200">هنوز نظری ثبت نشده است. اولین تجربه خرید را بنویسید.</p>}</div></section>{similar.length > 0 && <section className="mt-10"><h2 className="text-2xl font-extrabold text-slate-800 dark:text-white">محصولات مشابه</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{similar.map((item) => <SimilarCard key={item.id} product={item} />)}</div></section>}</main>;
}

function CommentCard({ comment, onReply, nested = false }: { comment: Comment; onReply: (comment: Comment) => void; nested?: boolean }) { return <article className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 ${nested ? "mr-6 mt-3" : ""}`}><div className="flex items-center justify-between gap-3"><strong className="text-sm text-slate-800 dark:text-white">{comment.name}</strong><time className="text-xs text-slate-400">{new Date(comment.created).toLocaleDateString("fa-IR")}</time></div><p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-emerald-100">{comment.sticker && <span className="ml-1 text-lg">{comment.sticker}</span>}{comment.body}</p>{comment.image && <img src={comment.image} alt="تصویر ارسالی کاربر" className="mt-3 max-h-72 rounded-xl object-cover" />}<button onClick={() => onReply(comment)} className="mt-3 text-xs font-bold text-emerald-700 hover:underline dark:text-lime-300">پاسخ دادن</button>{comment.replies?.map((reply) => <CommentCard key={reply.id} comment={reply} onReply={onReply} nested />)}</article>; }
function SimilarCard({ product }: { product: ProductList }) { return <Link to={`/products/${product.slug}`} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950"><img src={product.image_url || FALLBACK_IMAGE} alt={product.title} className="h-36 w-full object-cover" /><div className="p-3"><p className="line-clamp-2 text-sm font-bold text-slate-800 dark:text-white">{product.title}</p><p className="mt-2 text-sm font-extrabold text-emerald-700 dark:text-lime-300">{formatPrice(product.price)}</p></div></Link>; }
