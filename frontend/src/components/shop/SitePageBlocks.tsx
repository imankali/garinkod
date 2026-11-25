// frontend/src/components/shop/SitePageBlocks.tsx
//
// The renderer for an operator-authored information page.
//
// A SitePage is a stack of typed blocks — heading, text, bullets, spec table,
// price table, image, video, quote, cta, faq — and the admin composes them in
// order. Until now nothing rendered a `kind: 'page'` row at all: the operator
// published «شماره حسابهای گرین‌کود», a page whose whole point is telling a
// buyer which card numbers are legitimate before they pay, and the site had no
// address for it.
//
// The type is the contract: every block the API can emit has a branch here, and
// an unknown type renders its text rather than vanishing — a page that silently
// drops a section is worse than one that shows it plainly.

import { Link } from 'react-router';

import type { SitePageBlock } from '@/types/content';
import { cn } from '../../lib/cn';

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line dark:border-night-line">
      <table className="w-full border-collapse text-xs">
        {/* The editor writes rows as «a | b | c» lines and the API sends no head
            field, so a table only gets a header row when the block declared
            `data.head`. Inventing one would relabel the operator's first data
            row as a caption. */}
        {head.length > 0 && (
          <thead className="bg-brand-50 dark:bg-night-soft">
            <tr>
              {head.map((cell, index) => (
                <th
                  key={index}
                  scope="col"
                  className="whitespace-nowrap px-3 py-2 text-start text-2xs font-extrabold text-brand-900 dark:text-brand-200"
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-line dark:divide-night-line">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn(
                    'px-3 py-2 text-2xs leading-6 text-ink-soft dark:text-white/65',
                    cellIndex === 0 && 'font-bold text-ink dark:text-white',
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SitePageBlocks({ blocks }: { blocks: SitePageBlock[] }) {
  return (
    <div className="flex flex-col gap-5">
      {blocks.map((block) => {
        switch (block.block_type) {
          case 'heading':
            return (
              <h2 key={block.id} className="text-base font-extrabold text-ink dark:text-white">
                {block.title}
              </h2>
            );

          case 'text':
            return (
              <p
                key={block.id}
                className="whitespace-pre-line text-xs leading-8 text-ink-soft dark:text-white/70"
              >
                {block.text}
              </p>
            );

          case 'bullets':
            return (
              <ul key={block.id} className="list-disc space-y-1.5 ps-5 text-xs leading-7 text-ink-soft dark:text-white/70">
                {(block.rows.length > 0 ? block.rows.map((row) => row.join(' ')) : block.text.split('\n'))
                  .filter(Boolean)
                  .map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
              </ul>
            );

          case 'image':
            return block.image_url ? (
              <figure key={block.id}>
                <img
                  src={block.image_url}
                  alt={block.title || ''}
                  loading="lazy"
                  className="w-full rounded-lg object-cover"
                />
                {block.text && (
                  <figcaption className="mt-1.5 text-2xs text-ink-mute dark:text-white/45">
                    {block.text}
                  </figcaption>
                )}
              </figure>
            ) : null;

          case 'video':
            return block.video_url ? (
              <video
                key={block.id}
                src={block.video_url}
                controls
                preload="metadata"
                className="w-full rounded-lg"
              />
            ) : null;

          case 'spec_table':
          case 'price_table':
            return (
              <div key={block.id}>
                {block.title && (
                  <h3 className="mb-2 text-2xs font-extrabold text-ink dark:text-white">{block.title}</h3>
                )}
                <Table
                  head={Array.isArray(block.data?.head) ? (block.data.head as string[]) : []}
                  rows={block.rows}
                />
              </div>
            );

          case 'quote':
            return (
              <blockquote
                key={block.id}
                className="border-s-2 border-brand-600 bg-brand-50/60 px-3 py-2 text-xs leading-7 text-ink-soft dark:border-brand-700 dark:bg-night-soft dark:text-white/70"
              >
                {block.text}
              </blockquote>
            );

          case 'cta':
            return (
              <div
                key={block.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft"
              >
                <div className="min-w-0">
                  {block.title && (
                    <p className="text-xs font-extrabold text-ink dark:text-white">{block.title}</p>
                  )}
                  {block.text && (
                    <p className="mt-0.5 text-2xs leading-6 text-ink-mute dark:text-white/55">{block.text}</p>
                  )}
                </div>
                {block.link && (
                  <Link
                    to={block.link}
                    className="inline-flex min-h-10 items-center rounded-md bg-brand-700 px-4 text-2xs font-extrabold text-white hover:bg-brand-800"
                  >
                    {block.data?.label as string || 'ادامه'}
                  </Link>
                )}
              </div>
            );

          case 'faq':
            return (
              <dl key={block.id} className="divide-y divide-line dark:divide-night-line">
                {(block.rows.length > 0 ? block.rows : [[block.title, block.text]]).map((row, index) => (
                  <div key={index} className="py-2.5">
                    <dt className="text-xs font-extrabold text-ink dark:text-white">{row[0]}</dt>
                    <dd className="mt-1 text-2xs leading-6 text-ink-soft dark:text-white/65">{row[1]}</dd>
                  </div>
                ))}
              </dl>
            );

          case 'products':
          case 'articles':
            // These two reference rows by id and are rendered by the landing
            // page components, not here; a page of kind 'page' does not use them.
            return null;

          default:
            // An unknown block type still shows its words. A page that silently
            // drops a section is worse than one that prints it plainly.
            return block.text ? (
              <p key={block.id} className="text-xs leading-7 text-ink-soft dark:text-white/70">
                {block.text}
              </p>
            ) : null;
        }
      })}
    </div>
  );
}
