"""Seller withdrawals: registration prerequisites, commission and the ledger.

A withdrawal is the moment real money leaves the platform's books, so every
rule here is pinned: the card and the rules acceptance at registration, the
commission math, the balance guard, and the ledger trail through approval or
refusal.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import FinancialLedgerEntry, Storefront, WithdrawalRequest
from .settlements import settle_withdrawal, storefront_balances

CARD = '6037991234567890'
NATIONAL_ID = '0079584381'


def make_seller(username='sara', *, card=CARD, commission=8):
    user = User.objects.create_user(username=username, password='x')
    storefront = Storefront.objects.create(
        user=user, name=f'غرفه {username}', slug=username,
        commission_rate=commission, card_number=card,
        rules_accepted=True,
    )
    return user, storefront


def give_balance(storefront, amount, status='available'):
    return FinancialLedgerEntry.objects.create(
        owner_type='seller', user=storefront.user, storefront=storefront,
        entry_type='sale', status=status, amount=amount, currency='IRT',
        description='موجودی تستی',
    )


class RegistrationPrerequisiteTests(TestCase):
    """The card and the rules checkbox are part of *opening* a storefront."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='novice', password='x')
        self.client.force_authenticate(user=self.user)

    def payload(self, **overrides):
        data = {
            'name': 'غرفه تازه',
            'seller_type': 'farmer',
            'province': 'گلستان',
            'city': 'گرگان',
            'owner_first_name': 'سارا',
            'owner_last_name': 'راد',
            'national_id': NATIONAL_ID,
            'card_number': CARD,
            'rules_accepted': True,
        }
        data.update(overrides)
        return data

    def test_registration_demands_card_and_rules(self):
        response = self.client.post(
            '/api/marketplace/storefront/',
            self.payload(card_number='', rules_accepted=False),
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('card_number', response.data['fields'])
        self.assertIn('rules_accepted', response.data['fields'])

    def test_registration_with_card_and_rules_stores_both(self):
        response = self.client.post(
            '/api/marketplace/storefront/', self.payload(), format='json',
        )

        self.assertEqual(response.status_code, 201)
        storefront = Storefront.objects.get()
        self.assertEqual(storefront.card_number, CARD)
        self.assertTrue(storefront.rules_accepted)
        self.assertIsNotNone(storefront.rules_accepted_at)
        # The full card never comes back; only the masked tail does.
        self.assertEqual(response.data['card_number_masked'], '****-****-****-7890')
        self.assertNotIn('card_number', response.data)

    def test_a_misshapen_card_is_refused_on_update_too(self):
        self.client.post('/api/marketplace/storefront/', self.payload(), format='json')

        response = self.client.patch(
            '/api/marketplace/storefront/', {'card_number': '۱۲۳۴'}, format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('card_number', response.data['fields'])


class WithdrawalRequestTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller, self.storefront = make_seller(commission=8)
        give_balance(self.storefront, 1_000_000)
        self.client.force_authenticate(user=self.seller)

    def test_withdraw_deducts_the_platform_commission_and_lands_on_the_card(self):
        response = self.client.post(
            '/api/marketplace/finance/withdraw/', {'amount': 500_000}, format='json',
        )

        self.assertEqual(response.status_code, 201)
        withdrawal = response.data['withdrawal']
        self.assertEqual(withdrawal['amount'], 500_000)
        self.assertEqual(withdrawal['commission_amount'], 40_000)  # 8٪
        self.assertEqual(withdrawal['net_amount'], 460_000)
        self.assertEqual(withdrawal['card_number_masked'], '****-****-****-7890')
        # The wallet no longer offers the withdrawn half.
        self.assertEqual(response.data['balances']['available'], 500_000)

    def test_withdrawal_writes_a_payout_and_a_commission_entry(self):
        self.client.post('/api/marketplace/finance/withdraw/', {'amount': 500_000}, format='json')

        payout = FinancialLedgerEntry.objects.get(entry_type='payout')
        commission = FinancialLedgerEntry.objects.filter(
            owner_type='platform', entry_type='commission',
        ).get()
        self.assertEqual(payout.amount, -500_000)
        self.assertEqual(payout.status, 'pending')
        self.assertEqual(commission.amount, 40_000)
        withdrawal = WithdrawalRequest.objects.get()
        self.assertEqual(payout.metadata['withdrawal_id'], withdrawal.id)

    def test_a_pending_request_blocks_the_same_toman_twice(self):
        self.client.post('/api/marketplace/finance/withdraw/', {'amount': 600_000}, format='json')

        response = self.client.post(
            '/api/marketplace/finance/withdraw/', {'amount': 600_000}, format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('بیشتر از موجودی', response.data['error'])

    def test_withdrawal_above_the_balance_is_refused(self):
        response = self.client.post(
            '/api/marketplace/finance/withdraw/', {'amount': 1_500_000}, format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(WithdrawalRequest.objects.count(), 0)

    def test_a_storefront_without_a_card_cannot_withdraw(self):
        self.storefront.card_number = ''
        self.storefront.save()

        response = self.client.post(
            '/api/marketplace/finance/withdraw/', {'amount': 100_000}, format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('شماره کارت', response.data['error'])

    def test_platform_commission_rows_are_not_seller_money(self):
        FinancialLedgerEntry.objects.create(
            owner_type='platform', storefront=self.storefront,
            entry_type='commission', status='available', amount=250_000,
            currency='IRT', description='کمیسیون فروش',
        )

        balances = storefront_balances(self.storefront)

        self.assertEqual(balances['available'], 1_000_000)

    def test_paying_a_withdrawal_moves_its_entries_to_paid(self):
        self.client.post('/api/marketplace/finance/withdraw/', {'amount': 500_000}, format='json')
        withdrawal = WithdrawalRequest.objects.get()

        settle_withdrawal(withdrawal, paid=True, note='payroll')

        withdrawal.refresh_from_db()
        self.assertEqual(withdrawal.status, 'paid')
        self.assertEqual(
            FinancialLedgerEntry.objects.filter(
                metadata__withdrawal_id=withdrawal.id, status='paid',
            ).count(),
            2,
        )

    def test_refusing_a_withdrawal_reverses_its_entries_and_restores_balance(self):
        self.client.post('/api/marketplace/finance/withdraw/', {'amount': 500_000}, format='json')
        withdrawal = WithdrawalRequest.objects.get()

        settle_withdrawal(withdrawal, paid=False, note='cart mismatch')

        withdrawal.refresh_from_db()
        self.assertEqual(withdrawal.status, 'rejected')
        self.assertEqual(
            FinancialLedgerEntry.objects.filter(
                metadata__withdrawal_id=withdrawal.id, status='reversed',
            ).count(),
            2,
        )
        self.assertEqual(storefront_balances(self.storefront)['available'], 1_000_000)

    def test_the_finance_page_lists_the_requests(self):
        self.client.post('/api/marketplace/finance/withdraw/', {'amount': 100_000}, format='json')

        response = self.client.get('/api/marketplace/finance/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['withdrawals']), 1)
        self.assertEqual(response.data['withdrawals'][0]['status'], 'pending')
