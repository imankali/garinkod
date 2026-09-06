// frontend/src/hooks/useSitePolicies.ts
//
// What the shop has actually declared about returns and express delivery.
//
// The footer badge, the legal document and the checkout summary all need the same
// number, and none of them may invent it: the value lives in one admin record and
// this hook is the only reader. When the operator has not filled it in, the label
// is empty and every caller falls back to wording that makes no numeric promise —
// which is why the components branch on `hasReturnWindow` rather than on a
// hardcoded default.

import { useQuery } from '@tanstack/react-query';

import { policiesApi } from '../api/services';
import type { SitePolicies } from '../types';

const EMPTY: SitePolicies = {
  return_window_days: null,
  return_window_label: '',
  return_conditions: '',
  express_shipping: { enabled: false, fee: 0 },
  updated_at: '',
};

export function useSitePolicies() {
  const { data, isLoading } = useQuery({
    queryKey: ['site-policies'],
    queryFn: async () => (await policiesApi.get()).data,
    // A policy is changed rarely, but when it is changed it matters immediately.
    staleTime: 5 * 60 * 1000,
  });

  const policies = { ...EMPTY, ...(data || {}) };

  return {
    policies,
    isLoading,
    /** Only true once the operator has stated a window; drives every badge. */
    hasReturnWindow: Boolean(policies.return_window_days),
    returnWindowLabel: policies.return_window_label,
    expressEnabled: Boolean(policies.express_shipping?.enabled),
  };
}
