import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'unternehmen',
    'terminbezeichnung',
    'terminart',
    'datum_uhrzeit',
    'ort',
    'wiederholung',
    'erinnerung_tage',
    'terminstatus',
    'google_kalender',
    'notizen_termin',
  ],
  defaults: {
    'datum_uhrzeit': { kind: 'today', withTime: true },
    'terminstatus': { kind: 'lookup', key: 'geplant', label: 'Geplant' },
    'wiederholung': { kind: 'lookup', key: 'einmalig', label: 'Einmalig' },
    'erinnerung_tage': { kind: 'literal', value: 3 },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
