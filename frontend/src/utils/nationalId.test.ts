// frontend/src/utils/nationalId.test.ts
//
// The national code rule, tested against the same cases the server's own tests
// use. The client copy exists so a form can say «this cannot work» while typing;
// the moment the two disagree, one of them starts lying to people.

import { describe, expect, it } from 'vitest';

import {
  NATIONAL_ID_ERRORS,
  isValidNationalId,
  maskNationalId,
  nationalIdError,
  normaliseNationalId,
} from './nationalId';

describe('normaliseNationalId', () => {
  it('folds Persian and Arabic-Indic digits onto ASCII ones', () => {
    expect(normaliseNationalId('۳۹۷۱۸۵۷۲۹۹')).toBe('3971857299');
    expect(normaliseNationalId('٣٩٧١٨٥٧٢٩٩')).toBe('3971857299');
  });

  it('drops the separators people copy from documents', () => {
    expect(normaliseNationalId(' 007-9584-381 ')).toBe('0079584381');
  });

  it('treats nothing as nothing', () => {
    expect(normaliseNationalId(null)).toBe('');
    expect(normaliseNationalId(undefined)).toBe('');
  });
});

describe('isValidNationalId', () => {
  // The codes the Django suite also uses, so both sides are graded on one key.
  it.each(['3971857299', '1551553104', '0079584381'])(
    'accepts the checksum-valid code %s',
    (code) => {
      expect(isValidNationalId(code)).toBe(true);
      expect(nationalIdError(code)).toBe('');
    },
  );

  it('accepts a valid code written in Persian digits', () => {
    expect(isValidNationalId('۳۹۷۱۸۵۷۲۹۹')).toBe(true);
  });

  it.each([
    ['0084575988', NATIONAL_ID_ERRORS.checksum],
    ['1234567890', NATIONAL_ID_ERRORS.checksum],
    ['3971857298', NATIONAL_ID_ERRORS.checksum],
  ])('rejects %s on the check digit', (code, message) => {
    expect(isValidNationalId(code)).toBe(false);
    expect(nationalIdError(code)).toBe(message);
  });

  it.each(['1111111111', '0000000000', '0000001234', '1111110000'])(
    'refuses the structurally impossible shape %s',
    (code) => {
      expect(nationalIdError(code)).toBe(NATIONAL_ID_ERRORS.repeated);
    },
  );

  it.each(['', '   ', '۳۹۷۱۸۵۷۲۹', '39718572991', '007958438A', 'کد'])(
    'calls %s the wrong length or shape',
    (code) => {
      expect(isValidNationalId(code)).toBe(false);
      expect(nationalIdError(code)).toBe(
        code.trim() ? NATIONAL_ID_ERRORS.format : NATIONAL_ID_ERRORS.blank,
      );
    },
  );
});

describe('maskNationalId', () => {
  it('keeps the head and the last digit, exactly like the API', () => {
    expect(maskNationalId('0079584381')).toBe('007*****1');
    expect(maskNationalId('۰۰۷۹۵۸۴۳۸۱')).toBe('007*****1');
  });

  it('prints nothing rather than a partial code', () => {
    expect(maskNationalId('1234')).toBe('');
    expect(maskNationalId('')).toBe('');
  });
});
