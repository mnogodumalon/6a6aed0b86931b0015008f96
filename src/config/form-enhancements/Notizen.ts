import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'unternehmen',
    'notiz_titel',
    'notiz_inhalt',
    'notiz_datum',
    'kategorie',
    'prioritaet',
    'schlagwoerter',
  ],
  defaults: {
    'notiz_datum': { kind: 'today' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};

export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
