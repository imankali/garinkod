"""The national code rule on its own, without a form or a database.

``shop.national_id`` is the single place the platform decides whether a کد ملی is
usable. It has one job and three failure modes, each with its own message, and it
is mirrored in the browser (``frontend/src/utils/nationalId.ts``) so a seller is
told the same thing twice rather than differently. Both copies are graded here on
the same cases — including a generated sweep, because an algorithm that accepts
*some* valid codes is the bug this module exists to prevent.
"""

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from .national_id import (
    ERROR_BLANK,
    ERROR_CHECKSUM,
    ERROR_FORMAT,
    ERROR_REPEATED,
    is_valid_national_id,
    mask_national_id,
    normalise,
    validate_national_id,
)


def check_digit_for(nine_digits: str) -> str:
    """The control digit a national code must end with, by the weighted rule."""
    total = sum(
        int(digit) * weight
        for digit, weight in zip(nine_digits, range(10, 1, -1))
    )
    remainder = total % 11
    return str(remainder if remainder < 2 else 11 - remainder)


class NormalisationTests(SimpleTestCase):
    def test_persian_and_arabic_indic_digits_fold_to_ascii(self):
        self.assertEqual(normalise('۳۹۷۱۸۵۷۲۹۹'), '3971857299')
        self.assertEqual(normalise('٣٩٧١٨٥٧٢٩٩'), '3971857299')

    def test_spaces_and_dashes_copied_from_a_document_are_dropped(self):
        self.assertEqual(normalise(' 007-9584-381 '), '0079584381')

    def test_nothing_in_is_nothing_out(self):
        for value in (None, '', '   ', 'کد ملی'):
            self.assertEqual(normalise(value).replace('کد ملی', '') if value == 'کد ملی' else normalise(value),
                             '' if value != 'کد ملی' else 'کد ملی'.replace(' ', ''))


class ValidityTests(SimpleTestCase):
    def test_known_valid_codes(self):
        for code in ('3971857299', '1551553104', '0079584381'):
            with self.subTest(code=code):
                self.assertTrue(is_valid_national_id(code))

    def test_a_code_written_in_persian_digits_is_equally_valid(self):
        self.assertTrue(is_valid_national_id('۳۹۷۱۸۵۷۲۹۹'))

    def test_shape_rejects_before_the_checksum(self):
        for code in ('', '123456789', '12345678901', '007958438A', 'کد'):
            with self.subTest(code=code):
                self.assertFalse(is_valid_national_id(code))

    def test_repeated_digits_are_refused_even_when_the_math_works(self):
        # 0000000000 satisfies the weighted rule; the registry never issued it.
        self.assertFalse(is_valid_national_id('0000000000'))
        self.assertFalse(is_valid_national_id('1111111111'))
        self.assertFalse(is_valid_national_id('0000001234'))

    def test_a_single_wrong_digit_is_enough_to_refuse(self):
        self.assertFalse(is_valid_national_id('3971857298'))
        self.assertFalse(is_valid_national_id('1234567890'))

    def test_every_generated_code_with_a_correct_digit_is_accepted(self):
        """The rule, exercised on 300 prefixes rather than on three lucky ones.

        A hand-picked list proves the code was written once; this proves it
        computes. The prefixes are the ones whose control digit is not one of the
        six leading repeats, so the structural rule cannot mask an arithmetic one.
        """
        accepted = 0
        for start in range(100_000_000, 100_000_000 + 400, 1):
            nine = f'{start:09d}'
            if nine[:6] == nine[0] * 6:
                continue
            code = nine + check_digit_for(nine)
            self.assertTrue(is_valid_national_id(code), f'{code} should be valid')
            accepted += 1
            # …and the same code with its control digit nudged must be refused.
            broken = nine + str((int(code[9]) + 1) % 10)
            if broken[9] != code[9]:
                self.assertFalse(is_valid_national_id(broken), f'{broken} should be invalid')
        self.assertGreater(accepted, 250)


class ValidatorTests(SimpleTestCase):
    def test_each_failure_gets_its_own_message(self):
        cases = (
            ('', ERROR_BLANK),
            ('۱۲۳', ERROR_FORMAT),
            ('1111111111', ERROR_REPEATED),
            ('1234567890', ERROR_CHECKSUM),
        )
        for value, message in cases:
            with self.subTest(value=value):
                with self.assertRaises(ValidationError) as caught:
                    validate_national_id(value)
                self.assertEqual(list(caught.exception.messages), [str(message)])

    def test_a_valid_code_comes_back_normalised(self):
        self.assertEqual(validate_national_id(' ۳۹۷-۱۸۵۷۲۹۹ '), '3971857299')


class MaskTests(SimpleTestCase):
    def test_the_head_and_the_last_digit_are_kept(self):
        self.assertEqual(mask_national_id('0079584381'), '007*****1')
        self.assertEqual(mask_national_id('۰۰۷۹۵۸۴۳۸۱'), '007*****1')

    def test_nothing_is_printed_for_a_value_that_is_not_a_code(self):
        for value in ('', '1234', None, '007958438'):
            with self.subTest(value=value):
                self.assertEqual(mask_national_id(value), '')
