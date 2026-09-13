import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import LandCalendar from './LandCalendar';
import { I18nProvider } from '../../i18n';

/**
 * Every form control must have an accessible name.
 *
 * This is asserted against the rendered DOM rather than the source text, and
 * that distinction is the whole point. A text scan of this file reports the
 * inputs as unlabelled, because the ones in the neighbouring `LandFormModal`
 * are labelled by a `<Field>` component that renders a `<label>` at runtime —
 * which no amount of regular expressions can see. The accessibility tree is the
 * only place where "does this control have a name" has a true answer.
 *
 * The bug this pins was narrow and easy to make: in the add-event row the
 * `<select>` had `aria-label="نوع عملیات"` and the date input had
 * `aria-label="تاریخ"`, but the title input had only a placeholder. A
 * placeholder is not a label — it vanishes on input and is announced
 * inconsistently — so that control had no reliable name at all (WCAG 4.1.2).
 */

function renderCalendar() {
  // The component reads its strings through useTranslation, which throws
  // outside the provider — so the provider is part of rendering it honestly,
  // not test scaffolding to route around.
  return render(
    <I18nProvider>
      <LandCalendar events={[]} landId={1} onChanged={vi.fn()} />
    </I18nProvider>,
  );
}

/** Walk the accessibility tree and collect every control that lacks a name. */
function unnamedControls(container: HTMLElement) {
  const roles = 'input, select, textarea';
  return Array.from(container.querySelectorAll(roles)).filter((el) => {
    const input = el as HTMLInputElement;
    if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') return false;
    // testing-library's own computation, rather than a hand-rolled one, so this
    // test cannot drift from what a screen reader actually resolves.
    try {
      const label =
        input.getAttribute('aria-label') ||
        (input.getAttribute('aria-labelledby')
          ? document.getElementById(input.getAttribute('aria-labelledby')!)?.textContent
          : null) ||
        // an ancestor <label> is a valid implicit association
        input.closest('label')?.textContent ||
        (input.id ? document.querySelector(`label[for="${input.id}"]`)?.textContent : null);
      return !label || label.trim() === '';
    } catch {
      return true;
    }
  });
}

describe('LandCalendar accessibility', () => {
  it('names every control in the add-event form', async () => {
    const user = userEvent.setup();
    const { container } = renderCalendar();

    // The form is behind the add toggle.
    const toggle = screen.getByRole('button', { name: 'افزودن رویداد' });
    await user.click(toggle);

    const unnamed = unnamedControls(container);
    expect(
      unnamed.map((el) => (el as HTMLInputElement).outerHTML.slice(0, 80)),
    ).toEqual([]);
  });

  it('can reach the title field by its name, which is what a screen reader does', async () => {
    const user = userEvent.setup();
    renderCalendar();
    await user.click(screen.getByRole('button', { name: 'افزودن رویداد' }));

    const field = screen.getByLabelText('عنوان رویداد');
    await user.type(field, 'سم‌پاشی بهار');
    expect(field).toHaveValue('سم‌پاشی بهار');
  });
});
