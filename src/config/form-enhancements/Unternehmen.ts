import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'name',
    'rechtsform',
    'branche',
    'status',
    'beteiligungsquote',
    'investiertes_kapital',
    'aktueller_wert',
    'investitionsdatum',
    { row: ['stadt', 'land'], cols: '1fr 1fr' },
    'website',
    { row: ['ansprechpartner_vorname', 'ansprechpartner_nachname'], cols: '1fr 1fr' },
    'ansprechpartner_email',
    'ansprechpartner_telefon',
    'cockpit_zusammenfassung',
    'allgemeine_notizen',
  ],
  defaults: {
    'investitionsdatum': { kind: 'today' },
    'status': { kind: 'lookup', key: 'aktiv', label: 'Aktiv' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
