import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'unternehmen',
    'dokumentenbezeichnung',
    'dokumententyp',
    'dokumentendatum',
    'bereitgestellt_von',
    'dokumentenlink',
    'dokumentenbeschreibung',
    'notizen_dokument',
  ],
  defaults: {
    'dokumentendatum': { kind: 'today' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
