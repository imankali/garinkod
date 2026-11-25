// frontend/src/components/ui/Field.test.tsx
//
// The form rules that used to be decided per page: a visible label attached to
// the input, an error announced with the field it belongs to, and a hint that is
// described-by the control rather than floating next to it.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SelectField, TextArea, TextField } from './Field';

describe('TextField', () => {
  it('labels the input with real text the user can click', async () => {
    render(<TextField label="شمارهٔ همراه" />);
    const input = screen.getByLabelText('شمارهٔ همراه');
    expect(input.tagName).toBe('INPUT');
    await userEvent.click(screen.getByText('شمارهٔ همراه'));
    expect(input).toHaveFocus();
  });

  it('describes itself with the hint', () => {
    render(<TextField label="نشانی" hint="نشانی‌ای که سفارش‌ها به آن می‌رسد." />);
    const input = screen.getByLabelText('نشانی');
    const hint = screen.getByText('نشانی‌ای که سفارش‌ها به آن می‌رسد.');
    expect(input).toHaveAttribute('aria-describedby', hint.id);
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('announces an error and marks the field invalid', () => {
    render(<TextField label="کد ملی" error="کد ملی باید ۱۰ رقم باشد." />);
    const input = screen.getByLabelText('کد ملی');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('کد ملی باید ۱۰ رقم باشد.');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
  });

  it('prefers the error over the hint when both are given', () => {
    render(<TextField label="تلفن" hint="۰۹..." error="شماره را با ۰۹ شروع کنید." />);
    expect(screen.getByRole('alert')).toHaveTextContent('شماره را با ۰۹ شروع کنید.');
    expect(screen.queryByText('۰۹...')).not.toBeInTheDocument();
  });
});

describe('TextArea and SelectField', () => {
  it('render their own labelled control', () => {
    render(
      <>
        <TextArea label="یادداشت سفارش" />
        <SelectField label="استان">
          <option value="tehran">تهران</option>
        </SelectField>
      </>,
    );
    expect(screen.getByLabelText('یادداشت سفارش').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('استان').tagName).toBe('SELECT');
  });
});
