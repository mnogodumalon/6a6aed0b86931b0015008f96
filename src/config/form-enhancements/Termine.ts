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
    'google_kalender',
    'terminstatus',
    'notizen_termin',
  ],
  defaults: {
    'datum_uhrzeit': { kind: 'today', withTime: true },
    'terminstatus': { kind: 'lookup', key: 'geplant', label: 'Geplant' },
    'erinnerung_tage': { kind: 'literal', value: 7 },
    'google_kalender': { kind: 'literal', value: false },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
