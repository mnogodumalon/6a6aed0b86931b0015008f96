import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'name',
    { row: ['ansprechpartner_vorname', 'ansprechpartner_nachname'] },
    'rechtsform',
    'branche',
    'beteiligungsquote',
    'investiertes_kapital',
    'aktueller_wert',
    'investitionsdatum',
    { row: ['stadt', 'land'] },
    'website',
    'ansprechpartner_email',
    'ansprechpartner_telefon',
    'cockpit_zusammenfassung',
    'allgemeine_notizen',
  ],
  defaults: {
    'investitionsdatum': { kind: 'today' },
    'beteiligungsquote': { kind: 'literal', value: 0 },
  },
  computed: {},
  numberFields: {
    'beteiligungsquote': { max: 100 },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
