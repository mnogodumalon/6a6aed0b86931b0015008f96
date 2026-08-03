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
    rechtsform: [{ key: "gmbh", label: "GmbH" }, { key: "ag", label: "AG" }, { key: "gmbh_co_kg", label: "GmbH & Co. KG" }, { key: "ug", label: "UG (haftungsbeschränkt)" }, { key: "kg", label: "KG" }, { key: "ohg", label: "OHG" }, { key: "einzelunternehmen", label: "Einzelunternehmen" }, { key: "sonstige", label: "Sonstige" }],
    branche: [{ key: "energie", label: "Energie & Umwelt" }, { key: "medien", label: "Medien & Kommunikation" }, { key: "beratung", label: "Beratung & Dienstleistung" }, { key: "branche_sonstige", label: "Sonstige" }, { key: "technologie", label: "Technologie & Software" }, { key: "gesundheit", label: "Gesundheit & Medizin" }, { key: "finanzen", label: "Finanzen & Versicherung" }, { key: "immobilien", label: "Immobilien" }, { key: "handel", label: "Handel & E-Commerce" }, { key: "produktion", label: "Produktion & Industrie" }],
    status: [{ key: "aktiv", label: "Aktiv" }, { key: "inaktiv", label: "Inaktiv" }, { key: "exit", label: "Exit" }],
  },
  'termine': {
    terminart: [{ key: "gremiensitzung", label: "Gremiensitzung" }, { key: "gesellschafterversammlung", label: "Gesellschafterversammlung" }, { key: "beiratssitzung", label: "Beiratssitzung" }, { key: "strategiemeeting", label: "Strategiemeeting" }, { key: "jahresabschluss", label: "Jahresabschlussbesprechung" }, { key: "terminart_sonstiges", label: "Sonstiges" }],
    wiederholung: [{ key: "einmalig", label: "Einmalig" }, { key: "woechentlich", label: "Wöchentlich" }, { key: "monatlich", label: "Monatlich" }, { key: "quartalsweise", label: "Quartalsweise" }, { key: "jaehrlich", label: "Jährlich" }],
    terminstatus: [{ key: "geplant", label: "Geplant" }, { key: "stattgefunden", label: "Stattgefunden" }, { key: "abgesagt", label: "Abgesagt" }],
  },
  'dokumente': {
    dokumententyp: [{ key: "gesellschaftsvertrag", label: "Gesellschaftsvertrag" }, { key: "jahresabschluss", label: "Jahresabschluss" }, { key: "protokoll", label: "Sitzungsprotokoll" }, { key: "praesentation", label: "Präsentation" }, { key: "beteiligungsvertrag", label: "Beteiligungsvertrag" }, { key: "geschaeftsbericht", label: "Geschäftsbericht" }, { key: "dokumententyp_sonstiges", label: "Sonstiges" }],
  },
  'notizen': {
    kategorie: [{ key: "allgemein", label: "Allgemein" }, { key: "meeting", label: "Meeting" }, { key: "finanzen", label: "Finanzen" }, { key: "strategie", label: "Strategie" }, { key: "risiken", label: "Risiken" }, { key: "kategorie_sonstiges", label: "Sonstiges" }],
    prioritaet: [{ key: "hoch", label: "Hoch" }, { key: "mittel", label: "Mittel" }, { key: "niedrig", label: "Niedrig" }],
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