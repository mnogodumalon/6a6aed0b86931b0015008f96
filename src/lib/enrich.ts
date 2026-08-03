import type { EnrichedDokumente, EnrichedNotizen, EnrichedTermine } from '@/types/enriched';
import type { Dokumente, Notizen, Termine, Unternehmen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface TermineMaps {
  unternehmenMap: Map<string, Unternehmen>;
}

export function enrichTermine(
  termine: Termine[],
  maps: TermineMaps
): EnrichedTermine[] {
  return termine.map(r => ({
    ...r,
    unternehmenName: resolveDisplay(r.fields.unternehmen, maps.unternehmenMap, 'name'),
  }));
}

interface DokumenteMaps {
  unternehmenMap: Map<string, Unternehmen>;
}

export function enrichDokumente(
  dokumente: Dokumente[],
  maps: DokumenteMaps
): EnrichedDokumente[] {
  return dokumente.map(r => ({
    ...r,
    unternehmenName: resolveDisplay(r.fields.unternehmen, maps.unternehmenMap, 'name'),
  }));
}

interface NotizenMaps {
  unternehmenMap: Map<string, Unternehmen>;
}

export function enrichNotizen(
  notizen: Notizen[],
  maps: NotizenMaps
): EnrichedNotizen[] {
  return notizen.map(r => ({
    ...r,
    unternehmenName: resolveDisplay(r.fields.unternehmen, maps.unternehmenMap, 'name'),
  }));
}
