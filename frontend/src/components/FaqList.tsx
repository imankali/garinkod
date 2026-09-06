// frontend/src/components/FaqList.tsx
//
// One accordion for a «پرسش و پاسخ» block, shared by the /faq page and by any
// published page that contains such a block.
//
// A question must not read one way on the FAQ page and another way on the category
// landing that embeds it, and the split on the pipe has to happen in one place: the
// admin writes `سؤال | پاسخ`, and an answer that contains a pipe of its own keeps
// every cell after the first one.

import { ChevronDown } from 'lucide-react';

import type { SitePageBlock } from '../types';

export interface FaqPair {
  question: string;
  answer: string;
}

/** Question/answer pairs of a block, half-finished lines dropped. */
export function faqPairs(rows: string[][] | undefined | null): FaqPair[] {
  return (rows ?? [])
    .map((row) => ({ question: (row[0] ?? '').trim(), answer: row.slice(1).join(' | ').trim() }))
    .filter((pair) => pair.question && pair.answer);
}

export function faqPairsOfBlock(block: SitePageBlock): FaqPair[] {
  return faqPairs(block.rows);
}

export default function FaqList({ pairs, title }: { pairs: FaqPair[]; title?: string }) {
  if (!pairs.length) return null;

  return (
    <section className="rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
      {title && (
        <h2 className="border-b border-slate-100 px-5 py-4 text-fluid-lg font-extrabold text-slate-800 dark:border-emerald-900 dark:text-white">
          {title}
        </h2>
      )}
      <div className="divide-y divide-slate-100 dark:divide-emerald-900">
        {pairs.map((pair) => (
          <details key={pair.question} className="group/pair px-4 py-1">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 text-fluid-sm font-extrabold text-slate-800 transition-colors hover:text-emerald-700 dark:text-white dark:hover:text-lime-300">
              <span>{pair.question}</span>
              <ChevronDown
                size={17}
                aria-hidden="true"
                className="shrink-0 text-emerald-600 transition-transform duration-200 group-open/pair:rotate-180 dark:text-lime-300"
              />
            </summary>
            <p className="whitespace-pre-line pb-4 text-fluid-sm leading-8 text-slate-600 dark:text-emerald-100">
              {pair.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
