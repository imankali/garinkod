// frontend/src/components/home/StoryStrip.tsx

import { useQuery } from '@tanstack/react-query';

import { storefrontPostsApi } from '../../api/services';
import StoriesRow from '../social/StoriesRow';

/**
 * The ring of storefront stories above the slider — the Digikala pattern
 * where the very first thing under the header is live activity from sellers,
 * not a static banner. Here it shows what the غرفه‌داران posted in the last
 * day; the strip hides itself entirely when nobody has posted a story, so an
 * empty state can never sit above the hero.
 */
export default function StoryStrip() {
  const { data } = useQuery({
    queryKey: ['home-stories'],
    queryFn: () => storefrontPostsApi.list({ post_type: 'story', page_size: 20 }),
    staleTime: 2 * 60 * 1000,
  });

  const stories = data?.data.results ?? [];
  if (!stories.length) return null;

  return (
    <section className="page-shell pt-4" aria-label="استوری غرفه‌ها">
      <StoriesRow stories={stories} title="تازه از غرفه‌داران" />
    </section>
  );
}
