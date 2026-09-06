// frontend/src/components/article/ArticleBody.tsx
//
// Renders the stored article text. Body copy is plain text with two lightweight
// conventions so an editor never has to write HTML:
//
//   ## عنوان بخش     → an <h2> with a predictable id (the TOC links to it)
//   - مورد            → a bulleted list
//   a blank line      → a new paragraph
//
// The same heading rule is applied on the server (see SiteArticleSerializer) so
// the table of contents and the rendered DOM can never drift apart.

import { slugifyClient } from '../../utils/slugify';

const HEADING = /^##\s+(.*)$/;
const BULLET = /^[-•*]\s+(.*)$/;

interface Segment {
  kind: 'heading' | 'paragraph' | 'list';
  text: string;
  items: string[];
  id: string;
}

export function parseArticleBody(body: string): Segment[] {
  const segments: Segment[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  // Ids are assigned while parsing, so the table of contents is built from the
  // very values the DOM carries: a heading whose text has no slug-safe
  // characters (or a repeated heading) still gets a linkable, unique id.
  const used = new Set<string>();
  let headingOrder = 0;
  const nextHeadingId = (text: string) => {
    headingOrder += 1;
    let id = slugifyClient(text) || `sec-${headingOrder}`;
    if (used.has(id)) id = `${id}-${headingOrder}`;
    used.add(id);
    return id;
  };

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(' ');
    segments.push({ kind: 'paragraph', text, items: [], id: '' });
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    segments.push({ kind: 'list', text: '', items: list, id: '' });
    list = [];
  };

  for (const rawLine of (body || '').split('\n')) {
    const line = rawLine.trim();
    if (HEADING.test(line)) {
      flushParagraph();
      flushList();
      const text = line.replace(HEADING, '$1').trim();
      segments.push({ kind: 'heading', text, items: [], id: nextHeadingId(text) });
      continue;
    }
    if (BULLET.test(line)) {
      flushParagraph();
      list.push(line.replace(BULLET, '$1').trim());
      continue;
    }
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return segments;
}

export default function ArticleBody({ body }: { body: string }) {
  const segments = parseArticleBody(body);
  if (!segments.length) {
    return <p className="text-fluid-sm leading-8 text-slate-500 dark:text-emerald-200">متن این مقاله هنوز نوشته نشده است.</p>;
  }

  return (
    <div className="space-y-5">
      {segments.map((segment, index) => {
        if (segment.kind === 'heading') {
          return (
            <h2
              key={`h-${index}`}
              id={segment.id}
              className="scroll-mt-24 pt-2 text-fluid-lg font-extrabold text-slate-800 dark:text-white"
            >
              {segment.text}
            </h2>
          );
        }
        if (segment.kind === 'list') {
          return (
            <ul key={`l-${index}`} className="space-y-2">
              {segment.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-2 text-fluid-sm leading-8 text-slate-600 dark:text-emerald-100">
                  <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={`p-${index}`} className="whitespace-pre-line text-fluid-sm leading-8 text-slate-600 dark:text-emerald-100">
            {segment.text}
          </p>
        );
      })}
    </div>
  );
}
