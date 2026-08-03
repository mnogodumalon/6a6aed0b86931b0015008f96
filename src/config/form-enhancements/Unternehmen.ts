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
    'ansprechpartner_vorname',
    'ansprechpartner_nachname',
    'ansprechpartner_email',
    'ansprechpartner_telefon',
    'cockpit_zusammenfassung',
    'allgemeine_notizen',
  ],
  defaults: {
    'status': { kind: 'lookup', key: 'aktiv', label: 'Aktiv' },
    'investitionsdatum': { kind: 'today' },
  },
  computed: {
    '_gewinn_verlust': { op: 'sub', left: { kind: 'field', key: 'aktueller_wert' }, right: { kind: 'field', key: 'investiertes_kapital' } },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
