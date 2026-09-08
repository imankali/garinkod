// Types that mirror export.ExportOrderSerializer and ExportDocumentSerializer.

export type ExportDocumentType =
  | 'commercial_invoice'
  | 'certificate_of_origin'
  | 'phytosanitary'
  | 'packing_list';

export interface ExportDocument {
  id: number;
  export_order: number;
  document_type: ExportDocumentType;
  document_type_label: string;
  /** DRF FileField serializes to a directly downloadable URL string. */
  download_url: string;
  /** ISO calendar date (YYYY-MM-DD). */
  issue_date: string;
  is_verified: boolean;
  /** ISO-8601 date-time. */
  created_at: string;
}

export type ExportOrderStatus =
  | 'draft'
  | 'pending_docs'
  | 'customs_clearance'
  | 'shipped'
  | 'completed';

export type ExportCurrency = 'USD' | 'EUR' | 'AED' | 'IRT';

export interface ExportOrder {
  id: number;
  order: number;
  order_code: string;
  /** ISO 3166-1 alpha-2 country code. */
  destination_country: string;
  destination_country_label: string;
  currency: ExportCurrency;
  currency_label: string;
  /** DRF DecimalField values are represented as strings. */
  total_value_foreign: string;
  status: ExportOrderStatus;
  status_label: string;
  documents: ExportDocument[];
  /** ISO-8601 date-times. */
  created_at: string;
  updated_at: string;
}
