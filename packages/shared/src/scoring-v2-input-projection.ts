import { createConfidenceSummary, type EvidenceProjectionConfidence, type EvidenceScope, type VerificationState } from './intelligence-report-v2'; import type { CanonicalIntelligenceReportV2 } from './canonical-intelligence-report-v2'; import { mapLegacyEvidenceToScoringSignalTypes, type LegacyScoringMappingDiagnostic } from './legacy-scoring-signal-mapping';
export const SCORING_V2_CATEGORIES=['Web Health and Crawlability','Crawl Stability','Sitemap and Index Hygiene','Technical SEO','On-Page SEO','Content Depth and Information Gain','Passage Quality and Readability','Structured Data and Schema','AI Retrievability','AI Answer Readiness','AI Recommendation Readiness','Entity Detection','Entity Consistency','Entity Authenticity','Citation Readiness','Citation Authority','E-E-A-T','Machine Trust','Local and Geographic Visibility','Social and Off-Site Amplification','Brand Consistency','Topical Authority','Temporal Authority','Visual Integrity','Security and AI Governance'] as const; export type ScoringV2Category=(typeof SCORING_V2_CATEGORIES)[number]; export type ScoringSignalPolarity='POSITIVE'|'NEGATIVE'|'NEUTRAL'|'UNAVAILABLE'; export type ScoringApplicability='APPLICABLE'|'LIMITED'|'NOT_APPLICABLE'|'UNKNOWN';
export interface ScoringSignal{id:string;category:ScoringV2Category;polarity:ScoringSignalPolarity;type:string;subject?:string|undefined; evidenceIds:string[];findingIds:string[];contradictionIds:string[];rootCauseIds:string[];moduleIds:string[];verificationState:VerificationState;confidence:EvidenceProjectionConfidence;scope:EvidenceScope;affectedUrls:string[];deduplicationGroup?:string;isPrimaryRootCauseSignal?:boolean;rootCauseRole?:'PRIMARY'|'SECONDARY'|'SYMPTOM'|undefined;secondaryCategories:string[];metadata?:Record<string,string|number|boolean|null>}
export interface ScoringV2CategoryInput{category:ScoringV2Category;applicable:ScoringApplicability;applicabilityReason?:string;evidenceIds:string[];findingIds:string[];contradictionIds:string[];rootCauseIds:string[];moduleIds:string[];positiveSignals:ScoringSignal[];negativeSignals:ScoringSignal[];neutralSignals:ScoringSignal[];unavailableSignals:ScoringSignal[];coverage?:number;confidence:EvidenceProjectionConfidence;limitations:string[];providerDependencies:string[];methodologyVersion:string;metadata?:Record<string,string|number|boolean|null>}
export interface ScoringV2ProjectionDiagnostic{code:'CATEGORY_NO_EVIDENCE'|'CATEGORY_MEASUREMENT_UNAVAILABLE'|'UNKNOWN_APPLICABILITY'|'CATEGORY_PARTIAL_COVERAGE'|'MODULE_DATA_UNAVAILABLE';category:ScoringV2Category;message:string}
export interface ScoringV2InputProjection{auditId:string;domain:string;methodologyVersion:string;categories:ScoringV2CategoryInput[];globalCoverage?:number|undefined;globalConfidence:EvidenceProjectionConfidence;globalLimitations:string[];legacyScores:Record<string,number|null>;diagnostics:ScoringV2ProjectionDiagnostic[];legacyMappingDiagnostics:LegacyScoringMappingDiagnostic[];metadata:{sourceReportVersion:string}}
export const SCORING_V2_METHODOLOGY_VERSION='sitenexis-intelligence-v2';
export function projectScoringV2Input(report:CanonicalIntelligenceReportV2):ScoringV2InputProjection{const categories=SCORING_V2_CATEGORIES.map(category=>empty(category,report));const diagnostics:ScoringV2ProjectionDiagnostic[]=[];for(const contradiction of report.contradictions){for(const category of categoriesForContradiction(contradiction.type)){add(categories,signal(category,'NEGATIVE',contradiction.type,contradiction.subject,contradiction.evidenceIds,[],[contradiction.id],report.rootCauses.filter(root=>root.contradictionIds.includes(contradiction.id)).map(root=>root.id),contradiction.modules,contradiction.confidence,contradiction.scope,contradiction.affectedUrls));}}const legacyMappingDiagnostics:LegacyScoringMappingDiagnostic[]=[];for(const evidence of report.evidence){const mapped=mapLegacyEvidenceToScoringSignalTypes(evidence);legacyMappingDiagnostics.push(...mapped.diagnostics);for(const type of mapped.signalTypes){const policy=SCORING_V2_SIGNAL_POLICY[type];if(!policy)continue;for(const category of policy.categories)add(categories,signal(category,policy.polarity,type,evidence.url??undefined,[evidence.id],[],[],[],evidence.moduleId?[evidence.moduleId]:[],evidence.confidence,evidence.scope,evidence.url?[evidence.url]:[]));}}for(const provider of report.providers)if(!provider.available)add(categories,signal('Citation Authority','UNAVAILABLE','PROVIDER_UNAVAILABLE',`provider:${provider.provider}`,[],[],[],[],[],createConfidenceSummary({reasons:[provider.reason??'Provider unavailable.']}),'PROVIDER_DATA',[]));for(const module of report.moduleStatus)if(module.state==='UNAVAILABLE'||module.state==='BLOCKED')for(const category of categoriesForModule(module.moduleId))add(categories,signal(category,'UNAVAILABLE',`MODULE_${module.state}`,module.moduleId,[],[],[],[],[module.moduleId],createConfidenceSummary({reasons:[module.reason??`Module ${module.state.toLowerCase()}.`]}),'DOMAIN',[]));for(const category of categories){if(report.coverage?.coverageRatio!==undefined)category.coverage=report.coverage.coverageRatio;if(category.applicable==='UNKNOWN')diagnostics.push({code:'UNKNOWN_APPLICABILITY',category:category.category,message:'Business applicability was not supplied.'});if(category.unavailableSignals.length)diagnostics.push({code:'CATEGORY_MEASUREMENT_UNAVAILABLE',category:category.category,message:'Some measurement inputs are unavailable.'});if(!all(category).length)diagnostics.push({code:'CATEGORY_NO_EVIDENCE',category:category.category,message:'No eligible scoring signals were supplied.'});}return{auditId:report.identity.auditId,domain:report.identity.domain,methodologyVersion:SCORING_V2_METHODOLOGY_VERSION,categories,globalCoverage:report.coverage?.coverageRatio,globalConfidence:{...report.confidence,reasons:[...report.confidence.reasons]},globalLimitations:report.limitations.map(x=>x.code),legacyScores:{...report.legacyScores},diagnostics,legacyMappingDiagnostics,metadata:{sourceReportVersion:report.identity.reportVersion}}}
function empty(category:ScoringV2Category,report:CanonicalIntelligenceReportV2):ScoringV2CategoryInput{return{category,applicable:report.business?.primaryCategory?'APPLICABLE':'UNKNOWN',evidenceIds:[],findingIds:[],contradictionIds:[],rootCauseIds:[],moduleIds:[],positiveSignals:[],negativeSignals:[],neutralSignals:[],unavailableSignals:[],confidence:createConfidenceSummary(),limitations:[],providerDependencies:[],methodologyVersion:SCORING_V2_METHODOLOGY_VERSION}}
function add(categories:ScoringV2CategoryInput[],value:ScoringSignal){const category=categories.find(x=>x.category===value.category)!;({POSITIVE:category.positiveSignals,NEGATIVE:category.negativeSignals,NEUTRAL:category.neutralSignals,UNAVAILABLE:category.unavailableSignals}[value.polarity]).push(value);category.evidenceIds=unique([...category.evidenceIds,...value.evidenceIds]);category.findingIds=unique([...category.findingIds,...value.findingIds]);category.contradictionIds=unique([...category.contradictionIds,...value.contradictionIds]);category.rootCauseIds=unique([...category.rootCauseIds,...value.rootCauseIds]);category.moduleIds=unique([...category.moduleIds,...value.moduleIds])}
function signal(category:ScoringV2Category,polarity:ScoringSignalPolarity,type:string,subject:string|undefined,evidenceIds:string[],findingIds:string[],contradictionIds:string[],rootCauseIds:string[],moduleIds:string[],confidence:EvidenceProjectionConfidence,scope:EvidenceScope,affectedUrls:string[],_unused?:unknown):ScoringSignal{return{id:`scoring-signal:${category}:${type}:${subject??'domain'}`,category,polarity,type,subject,evidenceIds:[...evidenceIds],findingIds:[...findingIds],contradictionIds:[...contradictionIds],rootCauseIds:[...rootCauseIds],moduleIds:[...moduleIds],verificationState:polarity==='UNAVAILABLE'?'PROVIDER_UNAVAILABLE':'CONFIRMED',confidence:{...confidence,reasons:[...confidence.reasons]},scope,affectedUrls:[...affectedUrls],deduplicationGroup:rootCauseIds[0],isPrimaryRootCauseSignal:Boolean(rootCauseIds.length),secondaryCategories:[]}}
function categoriesForContradiction(type:string):ScoringV2Category[]{if(type==='CANONICAL_CONFLICT')return['Technical SEO','On-Page SEO'];if(['EMAIL_DOMAIN_CONFLICT','ENTITY_NAME_CONFLICT','LEGAL_NAME_CONFLICT'].includes(type))return['Entity Consistency','Brand Consistency'];if(type.includes('GOVERNANCE')||type.includes('CRAWLER_POLICY'))return['Security and AI Governance'];return[]}
function categoriesForModule(id:string):ScoringV2Category[]{if(id.includes('citation'))return['Citation Authority'];if(id.includes('governance')||id.includes('redlab'))return['Security and AI Governance'];return[]}function all(c:ScoringV2CategoryInput):ScoringSignal[]{return[...c.positiveSignals,...c.negativeSignals,...c.neutralSignals,...c.unavailableSignals]}function unique(v:string[]):string[]{return[...new Set(v.filter(Boolean))]}
export type ScoringV2SignalMagnitude = 'MINOR' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export interface ScoringV2SignalPolicyEntry {
  categories: readonly ScoringV2Category[];
  magnitude: ScoringV2SignalMagnitude;
  polarity: 'POSITIVE' | 'NEGATIVE';
  categoryDefining?: boolean;
}
export interface ScoringV2PolicyValidation { valid: boolean; errors: string[]; warnings: string[]; }
export const SCORING_V2_POLICY = {
  baseline: 50,
  magnitudes: { MINOR: 2, LOW: 4, MODERATE: 7, HIGH: 10, CRITICAL: 15 },
  verification: { CONFIRMED: 1, LIKELY: .75, PARTIAL: .5, INFERRED: .4, CONFLICTING: 0, UNVERIFIED: 0, NOT_DETECTED: 0, NOT_APPLICABLE: 0, CRAWL_FAILED: 0, TEMPORARY_FAILURE: 0, RENDERING_REQUIRED: 0, EXTERNAL_DATA_REQUIRED: 0, PROVIDER_UNAVAILABLE: 0 },
  secondaryRootCauseFactor: .25,
  groupedSymptomFactor: .25,
  perCategoryRootCauseCap: 15,
  globalRootCauseCap: 20,
  coverage: { calculated: .80, moderateConfidenceCap: .60, partial: .40, lowConfidenceCap: .20 },
  grades: [
    { minimum: 90, grade: 'EXCELLENT' }, { minimum: 80, grade: 'STRONG' },
    { minimum: 70, grade: 'GOOD' }, { minimum: 60, grade: 'FAIR' },
    { minimum: 50, grade: 'WEAK' }, { minimum: 35, grade: 'POOR' }, { minimum: 0, grade: 'CRITICAL' },
  ],
  weights: {
    'Web Health and Crawlability': 5, 'Crawl Stability': 3, 'Sitemap and Index Hygiene': 3, 'Technical SEO': 6, 'On-Page SEO': 5,
    'Content Depth and Information Gain': 6, 'Passage Quality and Readability': 3, 'Structured Data and Schema': 5, 'AI Retrievability': 6,
    'AI Answer Readiness': 5, 'AI Recommendation Readiness': 6, 'Entity Detection': 2, 'Entity Consistency': 5,
    'Entity Authenticity': 5, 'Citation Readiness': 4, 'Citation Authority': 5, 'E-E-A-T': 5, 'Machine Trust': 5,
    'Local and Geographic Visibility': 3, 'Social and Off-Site Amplification': 1, 'Brand Consistency': 2, 'Topical Authority': 3,
    'Temporal Authority': 1, 'Visual Integrity': 1, 'Security and AI Governance': 5,
  } as Record<ScoringV2Category, number>,
} as const;
export const SCORING_V2_SIGNAL_POLICY: Record<string, ScoringV2SignalPolicyEntry> = {
  HTTPS_CONFIRMED: { categories: ['Technical SEO'], magnitude: 'MODERATE', polarity: 'POSITIVE' },
  HEALTHY_STATUS_CONFIRMED: { categories: ['Technical SEO'], magnitude: 'MODERATE', polarity: 'POSITIVE' },
  ROBOTS_ACCESSIBLE: { categories: ['Technical SEO'], magnitude: 'MODERATE', polarity: 'POSITIVE' },
  SITEMAP_ACCESSIBLE: { categories: ['Technical SEO'], magnitude: 'MODERATE', polarity: 'POSITIVE' },
  ROBOTS_MISSING: { categories: ['Technical SEO'], magnitude: 'MODERATE', polarity: 'NEGATIVE' },
  SITEMAP_MISSING: { categories: ['Technical SEO'], magnitude: 'MODERATE', polarity: 'NEGATIVE' },
  CANONICAL_CONFIRMED: { categories: ['Technical SEO', 'On-Page SEO'], magnitude: 'MODERATE', polarity: 'POSITIVE' },
  CANONICAL_CONFLICT: { categories: ['Technical SEO', 'On-Page SEO'], magnitude: 'HIGH', polarity: 'NEGATIVE', categoryDefining: true },
  TITLE_CONFIRMED: { categories: ['On-Page SEO'], magnitude: 'MODERATE', polarity: 'POSITIVE' },
  H1_CONFIRMED: { categories: ['On-Page SEO'], magnitude: 'MODERATE', polarity: 'POSITIVE' },
  H1_MISSING: { categories: ['On-Page SEO'], magnitude: 'MODERATE', polarity: 'NEGATIVE' },
  H2_CONFIRMED: { categories: ['On-Page SEO'], magnitude: 'LOW', polarity: 'POSITIVE' },
  META_DESCRIPTION_CONFIRMED: { categories: ['On-Page SEO'], magnitude: 'LOW', polarity: 'POSITIVE' },
  VALID_SCHEMA_CONFIRMED: { categories: ['Structured Data and Schema'], magnitude: 'MODERATE', polarity: 'POSITIVE' },
  INVALID_SCHEMA: { categories: ['Structured Data and Schema'], magnitude: 'HIGH', polarity: 'NEGATIVE', categoryDefining: true },
  SCHEMA_VISIBLE_CONTENT_CONFLICT: { categories: ['Structured Data and Schema'], magnitude: 'HIGH', polarity: 'NEGATIVE', categoryDefining: true },
  CRAWL_ACCESS_CONFIRMED: { categories: ['AI Retrievability'], magnitude: 'MODERATE', polarity: 'POSITIVE' },
  RENDERING_DEPENDENCY_CONFIRMED: { categories: ['AI Retrievability'], magnitude: 'MODERATE', polarity: 'NEGATIVE' },
  ENTITY_NAME_CONFLICT: { categories: ['Entity Consistency'], magnitude: 'HIGH', polarity: 'NEGATIVE', categoryDefining: true },
  ENTITY_IDENTITY_ROOT_CAUSE: { categories: ['Entity Consistency', 'Entity Authenticity', 'Machine Trust', 'AI Recommendation Readiness', 'Brand Consistency'], magnitude: 'HIGH', polarity: 'NEGATIVE', categoryDefining: true },
  LEGAL_NAME_CONFLICT: { categories: ['Entity Consistency'], magnitude: 'HIGH', polarity: 'NEGATIVE', categoryDefining: true },
  EMAIL_DOMAIN_CONFLICT: { categories: ['Entity Consistency'], magnitude: 'HIGH', polarity: 'NEGATIVE', categoryDefining: true },
  PHONE_CONFLICT: { categories: ['Entity Consistency'], magnitude: 'MODERATE', polarity: 'NEGATIVE' },
  ADDRESS_CONFLICT: { categories: ['Entity Consistency'], magnitude: 'MODERATE', polarity: 'NEGATIVE' },
  SOCIAL_IDENTITY_CONFLICT: { categories: ['Entity Consistency'], magnitude: 'MODERATE', polarity: 'NEGATIVE' },
  INDEPENDENT_CITATION_CONFIRMED: { categories: ['Citation Authority'], magnitude: 'HIGH', polarity: 'POSITIVE', categoryDefining: true },
  GOVERNANCE_POLICY_CONFLICT: { categories: ['Security and AI Governance'], magnitude: 'HIGH', polarity: 'NEGATIVE', categoryDefining: true },
  CRAWLER_POLICY_CONFLICT: { categories: ['Security and AI Governance'], magnitude: 'HIGH', polarity: 'NEGATIVE', categoryDefining: true },
  GOVERNANCE_POLICY_CONFIRMED: { categories: ['Security and AI Governance'], magnitude: 'MODERATE', polarity: 'POSITIVE' },
  TRUST_IDENTITY_CONFIRMED: { categories: ['Machine Trust'], magnitude: 'MODERATE', polarity: 'POSITIVE' },
};
export function validateScoringV2Policy(policy: typeof SCORING_V2_POLICY = SCORING_V2_POLICY, signalPolicy: Record<string, ScoringV2SignalPolicyEntry> = SCORING_V2_SIGNAL_POLICY): ScoringV2PolicyValidation {
  const errors: string[] = [];
  if (SCORING_V2_METHODOLOGY_VERSION !== 'sitenexis-intelligence-v2') errors.push('INVALID_METHODOLOGY_VERSION');
  const entries = Object.entries(policy.weights);
  if (entries.length !== SCORING_V2_CATEGORIES.length) errors.push('INVALID_CATEGORY_COUNT');
  if (new Set(entries.map(([category]) => category)).size !== entries.length) errors.push('DUPLICATE_CATEGORY_WEIGHT');
  for (const category of SCORING_V2_CATEGORIES) if (!(category in policy.weights)) errors.push('MISSING_CATEGORY_WEIGHT');
  if (entries.some(([, weight]) => weight < 0)) errors.push('NEGATIVE_CATEGORY_WEIGHT');
  if (entries.reduce((total, [, weight]) => total + weight, 0) !== 100) errors.push('INVALID_WEIGHT_TOTAL');
  if (policy.baseline !== 50) errors.push('INVALID_BASELINE');
  if (JSON.stringify(policy.magnitudes) !== JSON.stringify({ MINOR: 2, LOW: 4, MODERATE: 7, HIGH: 10, CRITICAL: 15 })) errors.push('INVALID_MAGNITUDE_SCALE');
  if (policy.verification.CONFIRMED !== 1 || policy.verification.LIKELY !== .75 || policy.verification.PARTIAL !== .5 || policy.verification.INFERRED !== .4 || ['UNVERIFIED','NOT_DETECTED','CRAWL_FAILED','TEMPORARY_FAILURE','RENDERING_REQUIRED','EXTERNAL_DATA_REQUIRED','PROVIDER_UNAVAILABLE'].some((state) => policy.verification[state as keyof typeof policy.verification] !== 0)) errors.push('INVALID_VERIFICATION_FACTOR');
  if (policy.secondaryRootCauseFactor !== .25 || policy.groupedSymptomFactor !== .25) errors.push('INVALID_ROOT_CAUSE_FACTOR');
  if (policy.perCategoryRootCauseCap !== 15 || policy.globalRootCauseCap !== 20 || policy.perCategoryRootCauseCap < 0 || policy.globalRootCauseCap < 0) errors.push('INVALID_ROOT_CAUSE_CAP');
  if (!(policy.coverage.calculated > policy.coverage.moderateConfidenceCap && policy.coverage.moderateConfidenceCap > policy.coverage.partial && policy.coverage.partial > policy.coverage.lowConfidenceCap && policy.coverage.lowConfidenceCap > 0)) errors.push('INVALID_COVERAGE_THRESHOLDS');
  const gradeMinima = policy.grades.map((grade) => grade.minimum); if (gradeMinima[0] !== 90 || gradeMinima.at(-1) !== 0 || new Set(gradeMinima).size !== policy.grades.length || gradeMinima.some((value, index) => index > 0 && value >= gradeMinima[index - 1])) errors.push('INVALID_GRADE_THRESHOLDS');
  for (const [type, entry] of Object.entries(signalPolicy)) { if (!type || !entry.categories.length || entry.categories.some((category) => !SCORING_V2_CATEGORIES.includes(category)) || !['MINOR','LOW','MODERATE','HIGH','CRITICAL'].includes(entry.magnitude) || !['POSITIVE','NEGATIVE'].includes(entry.polarity)) errors.push('INVALID_SIGNAL_POLICY_CATEGORY'); }
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [] };
}