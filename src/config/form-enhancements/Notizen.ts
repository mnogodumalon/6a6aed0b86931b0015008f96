import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'unternehmen',
    'notiz_titel',
    'notiz_datum',
    'kategorie',
    'prioritaet',
    'notiz_inhalt',
    'schlagwoerter',
  ],
  defaults: {
    notiz_datum: { kind: 'today' },
    prioritaet: { kind: 'lookup', key: 'mittel', label: 'Mittel' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
