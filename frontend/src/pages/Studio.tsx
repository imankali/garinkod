import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, ImagePlus, Send, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

import { agricultureApi, storefrontPostsApi } from "../api/services";
import HighlightManager from "../components/HighlightManager";
import { useAuthStore } from "../store/authStore";
import type { MarketplaceListing, Storefront, StorefrontPost } from "../types";

export default function Studio() {
  const { isAuthenticated } = useAuthStore();
  const [posts, setPosts] = useState<StorefrontPost[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [postType, setPostType] = useState<'post' | 'story'>('post');
  const [caption, setCaption] = useState('');
  const [listing, setListing] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [postsResponse, listingsResponse, storeResponse] = await Promise.all([
        storefrontPostsApi.mine(),
        agricultureApi.myListings(),
        agricultureApi.getStorefront(),
      ]);
      setPosts(postsResponse.data);
      setListings(listingsResponse.data);
      setStorefront(storeResponse.data);
    } catch {
      toast.error('برای استفاده از استودیو ابتدا غرفه فعال داشته باشید.');
    }
  }, [isAuthenticated]);
  useEffect(() => { load(); }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isAuthenticated) { toast.error('ابتدا وارد حساب کاربری شوید.'); return; }
    if (!caption.trim()) return;
    setSending(true);
    try {
      await storefrontPostsApi.create({ post_type: postType, caption: caption.trim(), listing: listing ? Number(listing) : undefined, image });
      setCaption(''); setListing(''); setImage(null);
      await load();
      toast.success('محتوا برای بررسی و انتشار ثبت شد.');
    } catch {
      // API client displays details.
    } finally { setSending(false); }
  }

  return <main className="mx-auto max-w-6xl px-[var(--page-gutter)] py-9"><section className="rounded-3xl bg-gradient-to-l from-rose-600 via-violet-700 to-emerald-600 p-8 text-white"><p className="text-sm font-bold text-lime-200">استودیو غرفه</p><h1 className="mt-2 text-3xl font-extrabold">پست و استوری محصولات خود را منتشر کنید</h1><p className="mt-3 max-w-3xl leading-7 text-white/90">هر پست یا استوری ابتدا بررسی می‌شود. استوری پس از انتشار حداکثر ۲۴ ساعت نمایش داده می‌شود.</p></section><section className="mt-7 grid gap-6 lg:grid-cols-[1fr_360px]"><form onSubmit={submit} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><div className="flex gap-2"><button type="button" onClick={() => setPostType('post')} className={`rounded-xl px-4 py-2 text-sm font-bold ${postType === 'post' ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-600 dark:bg-emerald-900 dark:text-emerald-100'}`}>پست</button><button type="button" onClick={() => setPostType('story')} className={`rounded-xl px-4 py-2 text-sm font-bold ${postType === 'story' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-emerald-900 dark:text-emerald-100'}`}>استوری ۲۴ ساعته</button></div><label className="mt-5 block text-sm font-bold text-slate-700 dark:text-emerald-50">متن معرفی محصول<textarea required value={caption} onChange={(event) => setCaption(event.target.value)} rows={5} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-violet-500 dark:border-emerald-700 dark:bg-emerald-900" placeholder="ویژگی محصول، زمان برداشت، گرید، حجم قابل عرضه و شرایط تحویل..." /></label><label className="mt-4 block text-sm font-bold text-slate-700 dark:text-emerald-50">اتصال به آگهی محصول (اختیاری)<select value={listing} onChange={(event) => setListing(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal dark:border-emerald-700 dark:bg-emerald-900"><option value="">بدون اتصال مستقیم</option>{listings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><input ref={imageRef} type="file"
        aria-label="انتخاب تصویر پست یا استوری" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setImage(event.target.files?.[0] || null)} /><button type="button" onClick={() => imageRef.current?.click()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 dark:border-emerald-700 dark:text-emerald-100"><ImagePlus size={17} />{image ? image.name : 'افزودن تصویر'}</button><button disabled={sending} className="ms-3 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Send size={16} />{sending ? 'در حال ثبت...' : 'ارسال برای بررسی'}</button></form><aside className="h-fit rounded-3xl bg-violet-50 p-6 dark:bg-violet-950/30"><Sparkles className="text-violet-600" /><h2 className="mt-3 font-extrabold text-slate-800 dark:text-white">قوانین محتوا</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-emerald-100"><li>قیمت، کیفیت و موجودی را شفاف بنویسید.</li><li>از ادعاهای پزشکی یا تضمین‌های غیرواقعی پرهیز کنید.</li><li>تصاویر باید متعلق به محصول یا غرفه شما باشند.</li><li>محتوا پس از بررسی منتشر می‌شود.</li></ul><Link to="/legal/marketplace" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-violet-700 underline dark:text-lime-300">قوانین کامل غرفه‌داری و انتشار آگهی</Link></aside></section>{storefront && (
      <div className="mt-8">
        <HighlightManager
          storefrontSlug={storefront.slug}
          stories={posts.filter((post) => post.post_type === 'story' && post.status === 'published')}
        />
      </div>
    )}<section className="mt-8"><div className="flex items-center gap-2"><Camera className="text-violet-600" /><h2 className="text-2xl font-extrabold text-slate-800 dark:text-white">محتوای غرفه من</h2></div>{posts.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{posts.map((post) => <article key={post.id} className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-emerald-900 dark:bg-emerald-950">{post.image && <img src={post.image_url} alt="محتوای غرفه" className="h-48 w-full object-cover" />}<div className="p-4"><span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-bold text-violet-700 dark:bg-violet-900 dark:text-violet-100">{post.post_type_label} · {post.status_label}</span><p className="mt-3 text-sm leading-7 text-slate-700 dark:text-emerald-100">{post.caption}</p></div></article>)}</div> : <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-emerald-900/40 dark:text-emerald-200">هنوز پست یا استوری ثبت نشده است.</p>}</section></main>;
}
