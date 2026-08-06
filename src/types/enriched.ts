import type { Dokumente, Notizen, Termine } from './app';

export type EnrichedTermine = Termine & {
  unternehmenName: string;
};

export type EnrichedDokumente = Dokumente & {
  unternehmenName: string;
};

export type EnrichedNotizen = Notizen & {
  unternehmenName: string;
};
