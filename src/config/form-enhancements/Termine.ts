import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'unternehmen',
    'terminbezeichnung',
    'terminart',
    { row: ['datum_uhrzeit', 'erinnerung_tage'] },
    'ort',
    'wiederholung',
    'google_kalender',
    'terminstatus',
    'notizen_termin',
  ],
  defaults: {
    'datum_uhrzeit': { kind: 'today', withTime: true },
    'erinnerung_tage': { kind: 'literal', value: 7 },
    'wiederholung': { kind: 'lookup', key: 'einmalig', label: 'Einmalig' },
    'terminstatus': { kind: 'lookup', key: 'geplant', label: 'Geplant' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
