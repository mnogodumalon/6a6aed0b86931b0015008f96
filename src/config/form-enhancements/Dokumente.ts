import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'unternehmen',
    'dokumentenbezeichnung',
    'dokumententyp',
    'dokumentenbeschreibung',
    'dokumentendatum',
    'dokumentenlink',
    'bereitgestellt_von',
    'notizen_dokument',
  ],
  defaults: {
    'dokumentendatum': { kind: 'today' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
