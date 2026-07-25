import type { Prisma } from '../../generated';
import { db } from '../client';
import type { PageInteractionBlockerProbe } from '@sitenexis/shared';

export async function saveBrowserAgentProbes(
  auditId: string,
  probes: PageInteractionBlockerProbe[],
): Promise<void> {
  if (probes.length === 0) return;
  await db.browserAgentProbe.createMany({
    data: probes.map((p) => ({
      auditId,
      pageUrl: p.url,
      blockers: p.blockers as unknown as Prisma.InputJsonValue,
      probeStatus: p.probeStatus,
    })),
    skipDuplicates: true,
  });
}

export async function getBrowserAgentProbes(auditId: string): Promise<PageInteractionBlockerProbe[]> {
  const records = await db.browserAgentProbe.findMany({ where: { auditId } });
  return records.map((r) => ({
    url: r.pageUrl,
    blockers: r.blockers as unknown as PageInteractionBlockerProbe['blockers'],
    probeStatus: r.probeStatus as PageInteractionBlockerProbe['probeStatus'],
  }));
}
