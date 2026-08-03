import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'unternehmen',
    'terminbezeichnung',
    'terminart',
    'datum_uhrzeit',
    'wiederholung',
    'ort',
    'erinnerung_tage',
    'terminstatus',
    'google_kalender',
    'notizen_termin',
  ],
  defaults: {
    'datum_uhrzeit': { kind: 'today', withTime: true },
    'wiederholung': { kind: 'lookup', key: 'einmalig', label: 'Einmalig' },
    'erinnerung_tage': { kind: 'literal', value: 3 },
    'terminstatus': { kind: 'lookup', key: 'geplant', label: 'Geplant' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
