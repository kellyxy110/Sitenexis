/**
 * SiteNexis Brand Presence Scanner (Module 13).
 *
 * A pure analyzer (no external scraping in v1). It reasons over signals already
 * on the site — external links, schema `sameAs`, and contact emails — to score
 * how discoverable and consistent the brand's presence is across platforms.
 *
 * A profile that appears in schema `sameAs` (not just linked in the footer) is
 * a stronger, machine-validated signal, so it is scored higher.
 */

export interface BrandPresenceInput {
  domain: string;
  /** All external links aggregated across crawled pages. */
  externalLinks: string[];
  /** URLs declared in schema `sameAs` across the site. */
  sameAsUrls?: string[];
  /** Contact emails found on the site, if extracted. */
  emails?: string[];
  brandName?: string | null;
}

export interface BrandProfile {
  platform: string;
  url: string;
  /** True when this profile is also declared in schema sameAs (machine-validated). */
  inSameAs: boolean;
}

export interface BrandPresenceReport {
  brandPresenceScore: number;
  foundProfiles: BrandProfile[];
  missingRecommended: string[];
  sameAsValidatedCount: number;
  /** null when no email was available to assess. */
  emailDomainConsistent: boolean | null;
  notes: string[];
}

interface PlatformSpec {
  key: string;
  test: RegExp;
  /** Part of the baseline brands are expected to maintain. */
  recommended: boolean;
}

const PLATFORMS: PlatformSpec[] = [
  { key: 'linkedin', test: /linkedin\.com/i, recommended: true },
  { key: 'twitter/x', test: /(twitter\.com|(?:^|\/\/|www\.)x\.com)/i, recommended: true },
  { key: 'facebook', test: /facebook\.com/i, recommended: true },
  { key: 'instagram', test: /instagram\.com/i, recommended: true },
  { key: 'youtube', test: /youtube\.com|youtu\.be/i, recommended: false },
  { key: 'github', test: /github\.com/i, recommended: false },
  { key: 'tiktok', test: /tiktok\.com/i, recommended: false },
  { key: 'crunchbase', test: /crunchbase\.com/i, recommended: false },
];

function rootDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, '').split('.');
  return parts.length > 2 ? parts.slice(-2).join('.') : parts.join('.');
}

function hostOf(url: string): string | null {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  } catch {
    return null;
  }
}

export function buildBrandPresenceReport(input: BrandPresenceInput): BrandPresenceReport {
  const sameAs = (input.sameAsUrls ?? []).map((u) => u.toLowerCase());
  const externalPool = [...input.externalLinks, ...(input.sameAsUrls ?? [])];

  const foundProfiles: BrandProfile[] = [];
  for (const spec of PLATFORMS) {
    const match = externalPool.find((u) => spec.test.test(u));
    if (!match) continue;
    const inSameAs = sameAs.some((s) => spec.test.test(s));
    foundProfiles.push({ platform: spec.key, url: match, inSameAs });
  }

  const foundKeys = new Set(foundProfiles.map((p) => p.platform));
  const missingRecommended = PLATFORMS.filter((p) => p.recommended && !foundKeys.has(p.key)).map((p) => p.key);
  const sameAsValidatedCount = foundProfiles.filter((p) => p.inSameAs).length;

  // Email/domain consistency: a brand-domain email is a stronger identity signal
  // than a free-mail address (gmail/outlook/etc.).
  let emailDomainConsistent: boolean | null = null;
  const emails = input.emails ?? [];
  if (emails.length > 0) {
    const siteRoot = rootDomain(input.domain);
    emailDomainConsistent = emails.some((e) => {
      const at = e.split('@')[1];
      return at != null && rootDomain(at) === siteRoot;
    });
  }

  // Scoring: breadth of recommended presence (50), sameAs validation (30), email consistency (20).
  const recommendedTotal = PLATFORMS.filter((p) => p.recommended).length;
  const recommendedFound = recommendedTotal - missingRecommended.length;
  const breadthScore = (recommendedFound / recommendedTotal) * 50;
  const validationScore = foundProfiles.length > 0
    ? (sameAsValidatedCount / foundProfiles.length) * 30
    : 0;
  const emailScore = emailDomainConsistent === true ? 20 : emailDomainConsistent === false ? 5 : 10;
  const brandPresenceScore = Math.round(breadthScore + validationScore + emailScore);

  const notes: string[] = [];
  if (foundProfiles.length === 0) {
    notes.push('No social or directory profiles detected — brand presence is effectively invisible to AI entity validation.');
  }
  if (foundProfiles.length > 0 && sameAsValidatedCount === 0) {
    notes.push('Profiles are linked but none are declared in schema sameAs — add sameAs so AI systems can machine-validate the brand identity.');
  }
  if (missingRecommended.length > 0) {
    notes.push(`Missing recommended profiles: ${missingRecommended.join(', ')}.`);
  }
  if (emailDomainConsistent === false) {
    notes.push('Contact email uses a free-mail domain rather than the brand domain, weakening entity consistency.');
  }
  if (input.brandName && input.brandName.trim().length > 0) {
    const brandHosts = foundProfiles.map((p) => hostOf(p.url)).filter((h): h is string => !!h);
    if (foundProfiles.length > 0) {
      notes.push(`Brand "${input.brandName}" is represented across ${brandHosts.length} external ${brandHosts.length === 1 ? 'profile' : 'profiles'}.`);
    }
  }

  return {
    brandPresenceScore,
    foundProfiles,
    missingRecommended,
    sameAsValidatedCount,
    emailDomainConsistent,
    notes,
  };
}
