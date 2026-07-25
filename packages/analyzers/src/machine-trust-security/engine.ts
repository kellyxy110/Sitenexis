import type {
  MachineTrustEvidence,
  MachineTrustFinding,
  MachineTrustResource,
  MachineTrustSecurityReport,
  MachineTrustSeverity,
  PromptInjectionSignal,
} from '@sitenexis/shared';

export interface MachineTrustSecurityInput {
  resources: MachineTrustResource[];
  expectedMachineResources?: string[];
}

interface SignalRule {
  code: string;
  category: PromptInjectionSignal;
  severity: MachineTrustSeverity;
  title: string;
  pattern: RegExp;
  recommendation: string;
}

const RULES: SignalRule[] = [
  { code: 'instruction_override', category: 'instruction_override', severity: 'critical', title: 'Instruction override language detected', pattern: /(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|prior|above|system|developer)\s+instructions?/i, recommendation: 'Remove the instruction and keep machine-facing content descriptive, not directive.' },
  { code: 'role_impersonation', category: 'role_impersonation', severity: 'warning', title: 'AI role impersonation detected', pattern: /(?:system|developer|assistant)\s*(?:message|prompt|instruction)\s*:/i, recommendation: 'Remove text that imitates system, developer, or assistant messages.' },
  { code: 'tool_manipulation', category: 'tool_manipulation', severity: 'critical', title: 'Tool manipulation language detected', pattern: /(?:call|invoke|execute|use)\s+(?:the\s+)?(?:tool|function|browser|shell|mcp)/i, recommendation: 'Do not instruct an AI agent to invoke tools from public content.' },
  { code: 'credential_request', category: 'credential_request', severity: 'critical', title: 'Credential request detected', pattern: /(?:send|share|provide|reveal|export)\s+(?:your\s+)?(?:api\s*key|token|password|cookie|secret|ssh\s+key|environment\s+variables?)/i, recommendation: 'Remove credential requests and investigate the source content for compromise.' },
  { code: 'data_exfiltration', category: 'data_exfiltration', severity: 'critical', title: 'Data exfiltration language detected', pattern: /(?:upload|post|send|forward|email)\s+(?:the\s+)?(?:database|customer|private|sensitive|session|environment|local)\s+(?:data|files?|contents?)/i, recommendation: 'Remove requests to transfer private data or local files.' },
  { code: 'memory_rag_poisoning', category: 'memory_or_rag_poisoning', severity: 'warning', title: 'Memory or retrieval poisoning language detected', pattern: /(?:remember|store|save|index|embed)\s+(?:this|these)\s+(?:instructions?|facts?|as\s+trusted)/i, recommendation: 'Do not ask agents to persist or trust instructions from crawled content.' },
];

const WEIGHTS = {
  promptInjectionRisk: 25,
  machineResourceIntegrity: 15,
  structuredDataIntegrity: 10,
  aiCrawlerCompatibility: 10,
  thirdPartyScriptTrust: 10,
  dataLeakageRisk: 10,
  agentSafety: 10,
  contentProvenance: 5,
  securityHeaders: 5,
  monitoring: 5,
} as const;

function excerpt(text: string, index: number): string {
  const start = Math.max(0, index - 70);
  return text.slice(start, Math.min(text.length, index + 170)).replace(/\s+/g, ' ').trim();
}

function addEvidence(evidence: MachineTrustEvidence[], resource: MachineTrustResource, text: string, method: MachineTrustEvidence['detectionMethod']): string {
  const id = `evidence-${evidence.length + 1}`;
  evidence.push({ id, resourceId: resource.id, source: resource.url, excerpt: text.slice(0, 240), detectionMethod: method });
  return id;
}

function scoreFromFindings(findings: MachineTrustFinding[], category: MachineTrustFinding['category']): number {
  const penalty = findings.filter((finding) => finding.category === category).reduce((total, finding) => total + (finding.severity === 'critical' ? 35 : finding.severity === 'warning' ? 15 : 5), 0);
  return Math.max(0, 100 - Math.min(100, penalty));
}

export function buildMachineTrustSecurityReport(input: MachineTrustSecurityInput): MachineTrustSecurityReport {
  const findings: MachineTrustFinding[] = [];
  const evidence: MachineTrustEvidence[] = [];
  const seen = new Set<string>();

  for (const resource of input.resources) {
    const content = resource.content ?? '';
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      const match = rule.pattern.exec(content);
      if (!match) continue;
      const key = `${resource.id}:${rule.code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const evidenceId = addEvidence(evidence, resource, excerpt(content, match.index), 'pattern_match');
      findings.push({ id: `finding-${findings.length + 1}`, code: rule.code, category: rule.category, severity: rule.severity, title: rule.title, explanation: `The resource contains language that can steer an AI system or agent beyond its intended task. This is a deterministic signal. It does not prove exploitation, but it requires review.`, recommendation: rule.recommendation, resourceId: resource.id, evidenceIds: [evidenceId], confidence: 0.92 });
    }

    if (/\u200B|\u200C|\u200D|\u2060|\uFEFF/.test(content)) {
      const evidenceId = addEvidence(evidence, resource, 'Zero-width or invisible Unicode characters detected.', 'unicode_scan');
      findings.push({ id: `finding-${findings.length + 1}`, code: 'zero_width_obfuscation', category: 'obfuscation', severity: 'warning', title: 'Invisible Unicode characters detected', explanation: 'Invisible characters can hide instructions from people while leaving them available to parsers or language models.', recommendation: 'Remove unnecessary invisible characters and review the affected content in a code-point aware editor.', resourceId: resource.id, evidenceIds: [evidenceId], confidence: 0.98 });
    }

    if (/(?:data|tool|system|developer|secret)[^\n]{0,20}(?:base64|atob\s*\(|decode)/i.test(content)) {
      const evidenceId = addEvidence(evidence, resource, 'Possible encoded or decoded instruction marker detected.', 'pattern_match');
      findings.push({ id: `finding-${findings.length + 1}`, code: 'encoded_payload_marker', category: 'obfuscation', severity: 'warning', title: 'Possible encoded payload marker detected', explanation: 'The resource contains a marker associated with encoded content near a machine-sensitive term. The scanner does not decode or execute the content.', recommendation: 'Review the encoded value and remove it if it is not required for the page function.', resourceId: resource.id, evidenceIds: [evidenceId], confidence: 0.76 });
    }
  }

  const expected = input.expectedMachineResources ?? [];
  const seenKinds = new Set(input.resources.map((resource) => resource.kind));
  for (const kind of expected) {
    if (seenKinds.has(kind as MachineTrustResource['kind'])) continue;
    findings.push({ id: `finding-${findings.length + 1}`, code: `resource_not_assessed_${kind}`, category: 'coverage', severity: 'info', title: `${kind} was not assessed`, explanation: 'This resource was not supplied by the crawl, so the security score does not assume that it is safe or unsafe.', recommendation: 'Run a crawl that captures this machine-facing resource before making a final security decision.', resourceId: null, evidenceIds: [], confidence: 1 });
  }

  const promptScore = scoreFromFindings(findings, 'instruction_override');
  const promptFindings = findings.filter((finding) => ['instruction_override', 'role_impersonation', 'tool_manipulation', 'credential_request', 'data_exfiltration', 'memory_or_rag_poisoning', 'obfuscation', 'hidden_instruction'].includes(finding.category));
  const injectionScore = Math.max(0, 100 - Math.min(100, promptFindings.reduce((total, finding) => total + (finding.severity === 'critical' ? 35 : 15), 0)));
  const integrityScore = scoreFromFindings(findings, 'resource_integrity');
  const headerScore = resourceHeadersScore(input.resources);
  const breakdown = { promptInjectionRisk: injectionScore, machineResourceIntegrity: integrityScore, structuredDataIntegrity: seenKinds.has('structured_data') ? 100 : null, aiCrawlerCompatibility: expected.length === 0 ? null : Math.round((seenKinds.size / Math.max(1, expected.length)) * 100), thirdPartyScriptTrust: null, dataLeakageRisk: scoreFromFindings(findings, 'data_exfiltration'), agentSafety: promptScore, contentProvenance: input.resources.length > 0 ? 100 : null, securityHeaders: headerScore, monitoring: null } satisfies MachineTrustSecurityReport['scoreBreakdown'];
  const weighted = Object.entries(WEIGHTS).reduce((total, [key, weight]) => { const value = breakdown[key as keyof typeof breakdown]; return value === null ? total : total + value * weight; }, 0);
  const availableWeight = Object.entries(WEIGHTS).reduce((total, [key, weight]) => total + (breakdown[key as keyof typeof breakdown] === null ? 0 : weight), 0);
  const overallScore = availableWeight === 0 ? null : Math.round(weighted / availableWeight);
  return { version: 'machine-trust-security-v1', assessedAt: new Date().toISOString(), overallScore, confidence: input.resources.length > 0 ? 0.9 : 0, scoreBreakdown: breakdown, findings: findings.sort((a, b) => (a.severity === 'critical' ? 0 : a.severity === 'warning' ? 1 : 2) - (b.severity === 'critical' ? 0 : b.severity === 'warning' ? 1 : 2)), evidence, resourcesAssessed: input.resources.length, limitations: ['This scanner is deterministic and does not execute JavaScript, tools, browser actions, or encoded payloads.', 'A clean result does not prove that a site is secure. It means that these supplied resources did not match the current rules.', 'Security headers and machine resources are scored only when the crawl supplies them.'] };
}

function resourceHeadersScore(resources: MachineTrustResource[]): number | null {
  const headers = resources.find((resource) => resource.headers)?.headers;
  if (!headers) return null;
  const required = ['content-security-policy', 'strict-transport-security', 'x-content-type-options', 'referrer-policy', 'permissions-policy'];
  return Math.round(required.filter((header) => headers[header] || headers[header.toLowerCase()]).length / required.length * 100);
}
