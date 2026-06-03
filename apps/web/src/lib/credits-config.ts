export const CREDIT_COSTS = {
  basic_seo_audit:      1,
  ai_visibility_audit:  2,
  ai_swarm_audit:       5,
  competitor_analysis:  2,
  fix_generation:       1,
  ai_search_simulation: 3,
  video_report:         10,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

export const CREDIT_ACTION_LABELS: Record<CreditAction, string> = {
  basic_seo_audit:      'Basic SEO Audit',
  ai_visibility_audit:  'AI Visibility Audit',
  ai_swarm_audit:       'AI Swarm Audit',
  competitor_analysis:  'Competitor Analysis',
  fix_generation:       'Fix Generation',
  ai_search_simulation: 'AI Search Simulation',
  video_report:         'Video Report',
};

export const CREDIT_PACKS = [
  { id: 'starter_pack', label: 'Starter', credits: 20,  price: 9,  perCredit: 0.45 },
  { id: 'growth_pack',  label: 'Growth',  credits: 60,  price: 19, perCredit: 0.32 },
  { id: 'pro_pack',     label: 'Pro',     credits: 150, price: 39, perCredit: 0.26 },
  { id: 'agency_pack',  label: 'Agency',  credits: 500, price: 99, perCredit: 0.20 },
] as const;
