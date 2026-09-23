// frontend/src/components/ScrollToTop.test.tsx
//
// What a single-page app owes a reader who is not looking at it.
//
// The component lives in two effects: the page goes to the top, and the keyboard
// goes to the new page's content. Only the second one is invisible to a sighted
// mouse user, which is exactly why it needs a test — a route change that leaves
// focus on a link that no longer exists is silent to everyone else.

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Link, Route, Routes } from 'react-router';

import ScrollToTop from './ScrollToTop';
import { renderApp } from '../test/render';

function Harness() {
  return (
    <>
      <ScrollToTop />
      <a href="#main-content">پرش به محتوا</a>
      <nav>
        <Link to="/products">محصولات</Link>
      </nav>
      <main id="main-content" tabIndex={-1} data-testid="main">
        <Routes>
          <Route path="/" element={<h1>خانه</h1>} />
          <Route path="/products" element={<h1>محصولات</h1>} />
        </Routes>
      </main>
    </>
  );
}

describe('ScrollToTop', () => {
  it('moves focus into the new page when the route changes', async () => {
    const user = userEvent.setup();
    renderApp(<Harness />, { route: '/' });

    expect(screen.getByTestId('main')).not.toHaveFocus();

    await user.click(screen.getByRole('link', { name: 'محصولات' }));

    await waitFor(() => expect(screen.getByTestId('main')).toHaveFocus());
    expect(screen.getByRole('heading', { name: 'محصولات' })).toBeInTheDocument();
  });

  it('leaves the first page load alone, so the skip link still leads somewhere', () => {
    renderApp(<Harness />, { route: '/' });

    // Nothing has been clicked, so nothing should have been focused: a page that
    // focuses its own content on load turns the skip link into decoration.
    expect(screen.getByTestId('main')).not.toHaveFocus();
    expect(document.activeElement).toBe(document.body);
  });
});
