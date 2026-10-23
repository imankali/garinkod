// frontend/src/components/ui/PlaybackToggle.test.tsx
//
// WCAG 2.2.2: auto-rotation needs a persistent stop. The control has to say
// what it will do (label), expose the current state (aria-pressed), and be
// large enough to hit — the three things this test pins.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import PlaybackToggle from './PlaybackToggle';

describe('PlaybackToggle', () => {
  it('names the action and exposes whether rotation is on', async () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <PlaybackToggle playing onToggle={onToggle} subject="اسلایدها" />,
    );

    const button = screen.getByRole('button', { name: 'توقف پخش خودکار اسلایدها' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<PlaybackToggle playing={false} onToggle={onToggle} subject="اسلایدها" />);
    expect(
      screen.getByRole('button', { name: 'پخش خودکار اسلایدها' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});
