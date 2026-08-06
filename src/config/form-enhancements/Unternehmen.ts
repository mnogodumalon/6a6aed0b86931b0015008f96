import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'name',
    'rechtsform',
    'branche',
    'status',
    { row: ['stadt', 'land'], cols: '1fr 1fr' },
    'website',
    'beteiligungsquote',
    'investiertes_kapital',
    'aktueller_wert',
    'investitionsdatum',
    { row: ['ansprechpartner_vorname', 'ansprechpartner_nachname'] },
    'ansprechpartner_email',
    'ansprechpartner_telefon',
    'cockpit_zusammenfassung',
    'allgemeine_notizen',
  ],
  defaults: {
    'status': { kind: 'lookup', key: 'aktiv', label: 'Aktiv' },
    'beteiligungsquote': { kind: 'literal', value: 0 },
    'investiertes_kapital': { kind: 'literal', value: 0 },
    'aktueller_wert': { kind: 'literal', value: 0 },
  },
  computed: {
    '_gewinn_verlust': { op: 'sub', left: { kind: 'field', key: 'aktueller_wert' }, right: { kind: 'field', key: 'investiertes_kapital' } },
  },
  numberFields: {
    'beteiligungsquote': { max: 100 },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
