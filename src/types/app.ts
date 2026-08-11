import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Unternehmen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    name?: string;
    rechtsform?: LookupValue;
    branche?: LookupValue;
    status?: LookupValue;
    beteiligungsquote?: number;
    investiertes_kapital?: number;
    aktueller_wert?: number;
    investitionsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    stadt?: string;
    land?: string;
    website?: string;
    ansprechpartner_vorname?: string;
    ansprechpartner_nachname?: string;
    ansprechpartner_email?: string;
    ansprechpartner_telefon?: string;
    cockpit_zusammenfassung?: string;
    allgemeine_notizen?: string;
  };
}

export interface Termine {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    unternehmen?: string; // applookup -> URL zu 'Unternehmen' Record
    terminbezeichnung?: string;
    terminart?: LookupValue;
    datum_uhrzeit?: string; // Format: YYYY-MM-DD oder ISO String
    ort?: string;
    wiederholung?: LookupValue;
    erinnerung_tage?: number;
    google_kalender?: boolean;
    terminstatus?: LookupValue;
    notizen_termin?: string;
  };
}

export interface Dokumente {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    unternehmen?: string; // applookup -> URL zu 'Unternehmen' Record
    dokumentenbezeichnung?: string;
    dokumententyp?: LookupValue;
    dokumentenbeschreibung?: string;
    dokumentendatum?: string; // Format: YYYY-MM-DD oder ISO String
    dokumentenlink?: string;
    datei_upload?: string;
    bereitgestellt_von?: string;
    notizen_dokument?: string;
  };
}

export interface Notizen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    unternehmen?: string; // applookup -> URL zu 'Unternehmen' Record
    notiz_titel?: string;
    notiz_inhalt?: string;
    notiz_datum?: string; // Format: YYYY-MM-DD oder ISO String
    kategorie?: LookupValue;
    prioritaet?: LookupValue;
    schlagwoerter?: string;
  };
}

export const APP_IDS = {
  UNTERNEHMEN: '6a6aece61fcbb67ed9aeb827',
  TERMINE: '6a6aeceb7fa15073a952d84c',
  DOKUMENTE: '6a6aecec57d32fc34229557a',
  NOTIZEN: '6a6aecec609614cbbaaa085a',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'unternehmen': {
    rechtsform: [{ key: "gmbh", get label() { return lookupLabel('unternehmen', 'rechtsform', "gmbh") ?? "GmbH"; } }, { key: "ag", get label() { return lookupLabel('unternehmen', 'rechtsform', "ag") ?? "AG"; } }, { key: "gmbh_co_kg", get label() { return lookupLabel('unternehmen', 'rechtsform', "gmbh_co_kg") ?? "GmbH & Co. KG"; } }, { key: "ug", get label() { return lookupLabel('unternehmen', 'rechtsform', "ug") ?? "UG (haftungsbeschränkt)"; } }, { key: "kg", get label() { return lookupLabel('unternehmen', 'rechtsform', "kg") ?? "KG"; } }, { key: "ohg", get label() { return lookupLabel('unternehmen', 'rechtsform', "ohg") ?? "OHG"; } }, { key: "einzelunternehmen", get label() { return lookupLabel('unternehmen', 'rechtsform', "einzelunternehmen") ?? "Einzelunternehmen"; } }, { key: "sonstige", get label() { return lookupLabel('unternehmen', 'rechtsform', "sonstige") ?? "Sonstige"; } }],
    branche: [{ key: "energie", get label() { return lookupLabel('unternehmen', 'branche', "energie") ?? "Energie & Umwelt"; } }, { key: "medien", get label() { return lookupLabel('unternehmen', 'branche', "medien") ?? "Medien & Kommunikation"; } }, { key: "beratung", get label() { return lookupLabel('unternehmen', 'branche', "beratung") ?? "Beratung & Dienstleistung"; } }, { key: "branche_sonstige", get label() { return lookupLabel('unternehmen', 'branche', "branche_sonstige") ?? "Sonstige"; } }, { key: "technologie", get label() { return lookupLabel('unternehmen', 'branche', "technologie") ?? "Technologie & Software"; } }, { key: "gesundheit", get label() { return lookupLabel('unternehmen', 'branche', "gesundheit") ?? "Gesundheit & Medizin"; } }, { key: "finanzen", get label() { return lookupLabel('unternehmen', 'branche', "finanzen") ?? "Finanzen & Versicherung"; } }, { key: "immobilien", get label() { return lookupLabel('unternehmen', 'branche', "immobilien") ?? "Immobilien"; } }, { key: "handel", get label() { return lookupLabel('unternehmen', 'branche', "handel") ?? "Handel & E-Commerce"; } }, { key: "produktion", get label() { return lookupLabel('unternehmen', 'branche', "produktion") ?? "Produktion & Industrie"; } }],
    status: [{ key: "aktiv", get label() { return lookupLabel('unternehmen', 'status', "aktiv") ?? "Aktiv"; } }, { key: "inaktiv", get label() { return lookupLabel('unternehmen', 'status', "inaktiv") ?? "Inaktiv"; } }, { key: "exit", get label() { return lookupLabel('unternehmen', 'status', "exit") ?? "Exit"; } }],
  },
  'termine': {
    terminart: [{ key: "gremiensitzung", get label() { return lookupLabel('termine', 'terminart', "gremiensitzung") ?? "Gremiensitzung"; } }, { key: "gesellschafterversammlung", get label() { return lookupLabel('termine', 'terminart', "gesellschafterversammlung") ?? "Gesellschafterversammlung"; } }, { key: "beiratssitzung", get label() { return lookupLabel('termine', 'terminart', "beiratssitzung") ?? "Beiratssitzung"; } }, { key: "strategiemeeting", get label() { return lookupLabel('termine', 'terminart', "strategiemeeting") ?? "Strategiemeeting"; } }, { key: "jahresabschluss", get label() { return lookupLabel('termine', 'terminart', "jahresabschluss") ?? "Jahresabschlussbesprechung"; } }, { key: "terminart_sonstiges", get label() { return lookupLabel('termine', 'terminart', "terminart_sonstiges") ?? "Sonstiges"; } }],
    wiederholung: [{ key: "einmalig", get label() { return lookupLabel('termine', 'wiederholung', "einmalig") ?? "Einmalig"; } }, { key: "woechentlich", get label() { return lookupLabel('termine', 'wiederholung', "woechentlich") ?? "Wöchentlich"; } }, { key: "monatlich", get label() { return lookupLabel('termine', 'wiederholung', "monatlich") ?? "Monatlich"; } }, { key: "quartalsweise", get label() { return lookupLabel('termine', 'wiederholung', "quartalsweise") ?? "Quartalsweise"; } }, { key: "jaehrlich", get label() { return lookupLabel('termine', 'wiederholung', "jaehrlich") ?? "Jährlich"; } }],
    terminstatus: [{ key: "geplant", get label() { return lookupLabel('termine', 'terminstatus', "geplant") ?? "Geplant"; } }, { key: "stattgefunden", get label() { return lookupLabel('termine', 'terminstatus', "stattgefunden") ?? "Stattgefunden"; } }, { key: "abgesagt", get label() { return lookupLabel('termine', 'terminstatus', "abgesagt") ?? "Abgesagt"; } }],
  },
  'dokumente': {
    dokumententyp: [{ key: "gesellschaftsvertrag", get label() { return lookupLabel('dokumente', 'dokumententyp', "gesellschaftsvertrag") ?? "Gesellschaftsvertrag"; } }, { key: "jahresabschluss", get label() { return lookupLabel('dokumente', 'dokumententyp', "jahresabschluss") ?? "Jahresabschluss"; } }, { key: "protokoll", get label() { return lookupLabel('dokumente', 'dokumententyp', "protokoll") ?? "Sitzungsprotokoll"; } }, { key: "praesentation", get label() { return lookupLabel('dokumente', 'dokumententyp', "praesentation") ?? "Präsentation"; } }, { key: "beteiligungsvertrag", get label() { return lookupLabel('dokumente', 'dokumententyp', "beteiligungsvertrag") ?? "Beteiligungsvertrag"; } }, { key: "geschaeftsbericht", get label() { return lookupLabel('dokumente', 'dokumententyp', "geschaeftsbericht") ?? "Geschäftsbericht"; } }, { key: "dokumententyp_sonstiges", get label() { return lookupLabel('dokumente', 'dokumententyp', "dokumententyp_sonstiges") ?? "Sonstiges"; } }],
  },
  'notizen': {
    kategorie: [{ key: "allgemein", get label() { return lookupLabel('notizen', 'kategorie', "allgemein") ?? "Allgemein"; } }, { key: "meeting", get label() { return lookupLabel('notizen', 'kategorie', "meeting") ?? "Meeting"; } }, { key: "finanzen", get label() { return lookupLabel('notizen', 'kategorie', "finanzen") ?? "Finanzen"; } }, { key: "strategie", get label() { return lookupLabel('notizen', 'kategorie', "strategie") ?? "Strategie"; } }, { key: "risiken", get label() { return lookupLabel('notizen', 'kategorie', "risiken") ?? "Risiken"; } }, { key: "kategorie_sonstiges", get label() { return lookupLabel('notizen', 'kategorie', "kategorie_sonstiges") ?? "Sonstiges"; } }],
    prioritaet: [{ key: "hoch", get label() { return lookupLabel('notizen', 'prioritaet', "hoch") ?? "Hoch"; } }, { key: "mittel", get label() { return lookupLabel('notizen', 'prioritaet', "mittel") ?? "Mittel"; } }, { key: "niedrig", get label() { return lookupLabel('notizen', 'prioritaet', "niedrig") ?? "Niedrig"; } }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'unternehmen': {
    'name': 'string/text',
    'rechtsform': 'lookup/select',
    'branche': 'lookup/select',
    'status': 'lookup/radio',
    'beteiligungsquote': 'number',
    'investiertes_kapital': 'number',
    'aktueller_wert': 'number',
    'investitionsdatum': 'date/date',
    'stadt': 'string/text',
    'land': 'string/text',
    'website': 'string/url',
    'ansprechpartner_vorname': 'string/text',
    'ansprechpartner_nachname': 'string/text',
    'ansprechpartner_email': 'string/email',
    'ansprechpartner_telefon': 'string/tel',
    'cockpit_zusammenfassung': 'string/textarea',
    'allgemeine_notizen': 'string/textarea',
  },
  'termine': {
    'unternehmen': 'applookup/select',
    'terminbezeichnung': 'string/text',
    'terminart': 'lookup/select',
    'datum_uhrzeit': 'date/datetimeminute',
    'ort': 'string/text',
    'wiederholung': 'lookup/select',
    'erinnerung_tage': 'number',
    'google_kalender': 'bool',
    'terminstatus': 'lookup/radio',
    'notizen_termin': 'string/textarea',
  },
  'dokumente': {
    'unternehmen': 'applookup/select',
    'dokumentenbezeichnung': 'string/text',
    'dokumententyp': 'lookup/select',
    'dokumentenbeschreibung': 'string/textarea',
    'dokumentendatum': 'date/date',
    'dokumentenlink': 'string/url',
    'datei_upload': 'file',
    'bereitgestellt_von': 'string/text',
    'notizen_dokument': 'string/textarea',
  },
  'notizen': {
    'unternehmen': 'applookup/select',
    'notiz_titel': 'string/text',
    'notiz_inhalt': 'string/textarea',
    'notiz_datum': 'date/date',
    'kategorie': 'lookup/select',
    'prioritaet': 'lookup/radio',
    'schlagwoerter': 'string/text',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
  'unternehmen': [
    { field: 'unternehmen', entity: 'termine' },
    { field: 'unternehmen', entity: 'dokumente' },
    { field: 'unternehmen', entity: 'notizen' },
  ],
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateUnternehmen = StripLookup<Unternehmen['fields']>;
export type CreateTermine = StripLookup<Termine['fields']>;
export type CreateDokumente = StripLookup<Dokumente['fields']>;
export type CreateNotizen = StripLookup<Notizen['fields']>;