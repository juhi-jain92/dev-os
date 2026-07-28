import type { ContractType } from '@/types/contract'

// Standard term schema per contract type, shown in the pre-processing
// preview and used to build the extraction prompt. Source:
// docs/specs/upload-extraction-spec.md — Component Spec.
export const STANDARD_TERMS: Record<ContractType, string[]> = {
  nda: [
    'Parties',
    'Effective Date',
    'Confidentiality Obligations',
    'Permitted Disclosures',
    'Term & Duration',
    'Governing Law',
    'Jurisdiction',
    'IP Ownership',
    'Non-Solicitation',
    'Breach & Remedy',
  ],
  msa: [
    'Parties',
    'Service Scope',
    'Payment Terms',
    'Invoice Schedule',
    'Late Payment Penalty',
    'Liability Cap',
    'Indemnification',
    'IP Ownership',
    'Termination Clause',
    'Governing Law',
    'Dispute Resolution',
    'Notice Period',
  ],
}

export const MAX_CUSTOM_TERMS = 5
