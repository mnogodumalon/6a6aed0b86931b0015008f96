import { useState, useMemo, useCallback } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { LivingAppsService, extractRecordId, cleanFieldsForApi } from '@/services/livingAppsService';
import { UnternehmenDialog } from '@/components/dialogs/UnternehmenDialog';
import { UnternehmenViewDialog } from '@/components/dialogs/UnternehmenViewDialog';
import { TermineDialog } from '@/components/dialogs/TermineDialog';
import { TermineViewDialog } from '@/components/dialogs/TermineViewDialog';
import { DokumenteDialog } from '@/components/dialogs/DokumenteDialog';
import { DokumenteViewDialog } from '@/components/dialogs/DokumenteViewDialog';
import { NotizenDialog } from '@/components/dialogs/NotizenDialog';
import { NotizenViewDialog } from '@/components/dialogs/NotizenViewDialog';
import { BulkEditDialog } from '@/components/dialogs/BulkEditDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageShell } from '@/components/PageShell';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { IconPencil, IconTrash, IconPlus, IconFilter, IconX, IconArrowsUpDown, IconArrowUp, IconArrowDown, IconSearch, IconCopy, IconFileText } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

// Field metadata per entity for bulk edit and column filters
const UNTERNEHMEN_FIELDS = [
  { key: 'name', label: 'Unternehmensname', type: 'string/text' },
  { key: 'rechtsform', label: 'Rechtsform', type: 'lookup/select', options: [{ key: 'gmbh', label: 'GmbH' }, { key: 'ag', label: 'AG' }, { key: 'gmbh_co_kg', label: 'GmbH & Co. KG' }, { key: 'ug', label: 'UG (haftungsbeschränkt)' }, { key: 'kg', label: 'KG' }, { key: 'ohg', label: 'OHG' }, { key: 'einzelunternehmen', label: 'Einzelunternehmen' }, { key: 'sonstige', label: 'Sonstige' }] },
  { key: 'branche', label: 'Branche', type: 'lookup/select', options: [{ key: 'energie', label: 'Energie & Umwelt' }, { key: 'medien', label: 'Medien & Kommunikation' }, { key: 'beratung', label: 'Beratung & Dienstleistung' }, { key: 'branche_sonstige', label: 'Sonstige' }, { key: 'technologie', label: 'Technologie & Software' }, { key: 'gesundheit', label: 'Gesundheit & Medizin' }, { key: 'finanzen', label: 'Finanzen & Versicherung' }, { key: 'immobilien', label: 'Immobilien' }, { key: 'handel', label: 'Handel & E-Commerce' }, { key: 'produktion', label: 'Produktion & Industrie' }] },
  { key: 'status', label: 'Status der Beteiligung', type: 'lookup/radio', options: [{ key: 'aktiv', label: 'Aktiv' }, { key: 'inaktiv', label: 'Inaktiv' }, { key: 'exit', label: 'Exit' }] },
  { key: 'beteiligungsquote', label: 'Beteiligungsquote (%)', type: 'number' },
  { key: 'investiertes_kapital', label: 'Investiertes Kapital (EUR)', type: 'number' },
  { key: 'aktueller_wert', label: 'Aktueller Unternehmenswert (EUR)', type: 'number' },
  { key: 'investitionsdatum', label: 'Investitionsdatum', type: 'date/date' },
  { key: 'stadt', label: 'Stadt', type: 'string/text' },
  { key: 'land', label: 'Land', type: 'string/text' },
  { key: 'website', label: 'Website', type: 'string/url' },
  { key: 'ansprechpartner_vorname', label: 'Vorname Ansprechpartner', type: 'string/text' },
  { key: 'ansprechpartner_nachname', label: 'Nachname Ansprechpartner', type: 'string/text' },
  { key: 'ansprechpartner_email', label: 'E-Mail Ansprechpartner', type: 'string/email' },
  { key: 'ansprechpartner_telefon', label: 'Telefon Ansprechpartner', type: 'string/tel' },
  { key: 'cockpit_zusammenfassung', label: 'Cockpit-Zusammenfassung', type: 'string/textarea' },
  { key: 'allgemeine_notizen', label: 'Allgemeine Notizen', type: 'string/textarea' },
];
const TERMINE_FIELDS = [
  { key: 'unternehmen', label: 'Unternehmen', type: 'applookup/select', targetEntity: 'unternehmen', targetAppId: 'UNTERNEHMEN', displayField: 'name' },
  { key: 'terminbezeichnung', label: 'Terminbezeichnung', type: 'string/text' },
  { key: 'terminart', label: 'Terminart', type: 'lookup/select', options: [{ key: 'gremiensitzung', label: 'Gremiensitzung' }, { key: 'gesellschafterversammlung', label: 'Gesellschafterversammlung' }, { key: 'beiratssitzung', label: 'Beiratssitzung' }, { key: 'strategiemeeting', label: 'Strategiemeeting' }, { key: 'jahresabschluss', label: 'Jahresabschlussbesprechung' }, { key: 'terminart_sonstiges', label: 'Sonstiges' }] },
  { key: 'datum_uhrzeit', label: 'Datum & Uhrzeit', type: 'date/datetimeminute' },
  { key: 'ort', label: 'Ort / Videolink', type: 'string/text' },
  { key: 'wiederholung', label: 'Wiederholung', type: 'lookup/select', options: [{ key: 'einmalig', label: 'Einmalig' }, { key: 'woechentlich', label: 'Wöchentlich' }, { key: 'monatlich', label: 'Monatlich' }, { key: 'quartalsweise', label: 'Quartalsweise' }, { key: 'jaehrlich', label: 'Jährlich' }] },
  { key: 'erinnerung_tage', label: 'Erinnerung (Tage vorher)', type: 'number' },
  { key: 'google_kalender', label: 'Mit Google-Kalender synchronisieren', type: 'bool' },
  { key: 'terminstatus', label: 'Status', type: 'lookup/radio', options: [{ key: 'geplant', label: 'Geplant' }, { key: 'stattgefunden', label: 'Stattgefunden' }, { key: 'abgesagt', label: 'Abgesagt' }] },
  { key: 'notizen_termin', label: 'Notizen zum Termin', type: 'string/textarea' },
];
const DOKUMENTE_FIELDS = [
  { key: 'unternehmen', label: 'Unternehmen', type: 'applookup/select', targetEntity: 'unternehmen', targetAppId: 'UNTERNEHMEN', displayField: 'name' },
  { key: 'dokumentenbezeichnung', label: 'Dokumentenbezeichnung', type: 'string/text' },
  { key: 'dokumententyp', label: 'Dokumententyp', type: 'lookup/select', options: [{ key: 'gesellschaftsvertrag', label: 'Gesellschaftsvertrag' }, { key: 'jahresabschluss', label: 'Jahresabschluss' }, { key: 'protokoll', label: 'Sitzungsprotokoll' }, { key: 'praesentation', label: 'Präsentation' }, { key: 'beteiligungsvertrag', label: 'Beteiligungsvertrag' }, { key: 'geschaeftsbericht', label: 'Geschäftsbericht' }, { key: 'dokumententyp_sonstiges', label: 'Sonstiges' }] },
  { key: 'dokumentenbeschreibung', label: 'Beschreibung', type: 'string/textarea' },
  { key: 'dokumentendatum', label: 'Datum des Dokuments', type: 'date/date' },
  { key: 'dokumentenlink', label: 'Dokumentenlink (URL)', type: 'string/url' },
  { key: 'datei_upload', label: 'Datei-Upload', type: 'file' },
  { key: 'bereitgestellt_von', label: 'Bereitgestellt von', type: 'string/text' },
  { key: 'notizen_dokument', label: 'Notizen zum Dokument', type: 'string/textarea' },
];
const NOTIZEN_FIELDS = [
  { key: 'unternehmen', label: 'Unternehmen', type: 'applookup/select', targetEntity: 'unternehmen', targetAppId: 'UNTERNEHMEN', displayField: 'name' },
  { key: 'notiz_titel', label: 'Titel der Notiz', type: 'string/text' },
  { key: 'notiz_inhalt', label: 'Notizinhalt', type: 'string/textarea' },
  { key: 'notiz_datum', label: 'Datum der Notiz', type: 'date/date' },
  { key: 'kategorie', label: 'Kategorie', type: 'lookup/select', options: [{ key: 'allgemein', label: 'Allgemein' }, { key: 'meeting', label: 'Meeting' }, { key: 'finanzen', label: 'Finanzen' }, { key: 'strategie', label: 'Strategie' }, { key: 'risiken', label: 'Risiken' }, { key: 'kategorie_sonstiges', label: 'Sonstiges' }] },
  { key: 'prioritaet', label: 'Priorität', type: 'lookup/radio', options: [{ key: 'hoch', label: 'Hoch' }, { key: 'mittel', label: 'Mittel' }, { key: 'niedrig', label: 'Niedrig' }] },
  { key: 'schlagwoerter', label: 'Schlagwörter / Tags', type: 'string/text' },
];

const ENTITY_TABS = [
  { key: 'unternehmen', label: 'Unternehmen', pascal: 'Unternehmen' },
  { key: 'termine', label: 'Termine', pascal: 'Termine' },
  { key: 'dokumente', label: 'Dokumente', pascal: 'Dokumente' },
  { key: 'notizen', label: 'Notizen', pascal: 'Notizen' },
] as const;

type EntityKey = typeof ENTITY_TABS[number]['key'];

export default function AdminPage() {
  const data = useDashboardData();
  const { loading, error, fetchAll } = data;

  const [activeTab, setActiveTab] = useState<EntityKey>('unternehmen');
  const [selectedIds, setSelectedIds] = useState<Record<EntityKey, Set<string>>>(() => ({
    'unternehmen': new Set(),
    'termine': new Set(),
    'dokumente': new Set(),
    'notizen': new Set(),
  }));
  const [filters, setFilters] = useState<Record<EntityKey, Record<string, string>>>(() => ({
    'unternehmen': {},
    'termine': {},
    'dokumente': {},
    'notizen': {},
  }));
  const [showFilters, setShowFilters] = useState(false);
  const [dialogState, setDialogState] = useState<{ entity: EntityKey; record: any } | null>(null);
  const [createEntity, setCreateEntity] = useState<EntityKey | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<{ entity: EntityKey; ids: string[] } | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState<EntityKey | null>(null);
  const [viewState, setViewState] = useState<{ entity: EntityKey; record: any } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  const getRecords = useCallback((entity: EntityKey) => {
    switch (entity) {
      case 'unternehmen': return (data as any).unternehmen as Unternehmen[] ?? [];
      case 'termine': return (data as any).termine as Termine[] ?? [];
      case 'dokumente': return (data as any).dokumente as Dokumente[] ?? [];
      case 'notizen': return (data as any).notizen as Notizen[] ?? [];
      default: return [];
    }
  }, [data]);

  const getLookupLists = useCallback((entity: EntityKey) => {
    const lists: Record<string, any[]> = {};
    switch (entity) {
      case 'termine':
        lists.unternehmenList = (data as any).unternehmen ?? [];
        break;
      case 'dokumente':
        lists.unternehmenList = (data as any).unternehmen ?? [];
        break;
      case 'notizen':
        lists.unternehmenList = (data as any).unternehmen ?? [];
        break;
    }
    return lists;
  }, [data]);

  const getApplookupDisplay = useCallback((entity: EntityKey, fieldKey: string, url?: unknown) => {
    if (!url) return '—';
    const id = extractRecordId(url);
    if (!id) return '—';
    const lists = getLookupLists(entity);
    void fieldKey; // ensure used for noUnusedParameters
    if (entity === 'termine' && fieldKey === 'unternehmen') {
      const match = (lists.unternehmenList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.name ?? '—';
    }
    if (entity === 'dokumente' && fieldKey === 'unternehmen') {
      const match = (lists.unternehmenList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.name ?? '—';
    }
    if (entity === 'notizen' && fieldKey === 'unternehmen') {
      const match = (lists.unternehmenList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.name ?? '—';
    }
    return String(url);
  }, [getLookupLists]);

  const getFieldMeta = useCallback((entity: EntityKey) => {
    switch (entity) {
      case 'unternehmen': return UNTERNEHMEN_FIELDS;
      case 'termine': return TERMINE_FIELDS;
      case 'dokumente': return DOKUMENTE_FIELDS;
      case 'notizen': return NOTIZEN_FIELDS;
      default: return [];
    }
  }, []);

  const getFilteredRecords = useCallback((entity: EntityKey) => {
    const records = getRecords(entity);
    const s = search.toLowerCase();
    const searched = !s ? records : records.filter((r: any) => {
      return Object.values(r.fields).some((v: any) => {
        if (v == null) return false;
        if (Array.isArray(v)) return v.some((item: any) => typeof item === 'object' && item !== null && 'label' in item ? String((item as any).label).toLowerCase().includes(s) : String(item).toLowerCase().includes(s));
        if (typeof v === 'object' && 'label' in (v as any)) return String((v as any).label).toLowerCase().includes(s);
        return String(v).toLowerCase().includes(s);
      });
    });
    const entityFilters = filters[entity] ?? {};
    const fieldMeta = getFieldMeta(entity);
    return searched.filter((r: any) => {
      return fieldMeta.every((fm: any) => {
        const fv = entityFilters[fm.key];
        if (!fv || fv === '') return true;
        const val = r.fields?.[fm.key];
        if (fm.type === 'bool') {
          if (fv === 'true') return val === true;
          if (fv === 'false') return val !== true;
          return true;
        }
        if (fm.type === 'lookup/select' || fm.type === 'lookup/radio') {
          const label = val && typeof val === 'object' && 'label' in val ? val.label : '';
          return String(label).toLowerCase().includes(fv.toLowerCase());
        }
        if (fm.type.includes('multiplelookup')) {
          if (!Array.isArray(val)) return false;
          return val.some((item: any) => String(item?.label ?? '').toLowerCase().includes(fv.toLowerCase()));
        }
        if (fm.type.includes('applookup')) {
          const display = getApplookupDisplay(entity, fm.key, val);
          return String(display).toLowerCase().includes(fv.toLowerCase());
        }
        return String(val ?? '').toLowerCase().includes(fv.toLowerCase());
      });
    });
  }, [getRecords, filters, getFieldMeta, getApplookupDisplay, search]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortKey(''); setSortDir('asc'); }
    } else { setSortKey(key); setSortDir('asc'); }
  }

  function sortRecords<T extends { fields: Record<string, any> }>(recs: T[]): T[] {
    if (!sortKey) return recs;
    return [...recs].sort((a, b) => {
      let va: any = a.fields[sortKey], vb: any = b.fields[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'object' && 'label' in va) va = va.label;
      if (typeof vb === 'object' && 'label' in vb) vb = vb.label;
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }

  const toggleSelect = useCallback((entity: EntityKey, id: string) => {
    setSelectedIds(prev => {
      const next = { ...prev, [entity]: new Set(prev[entity]) };
      if (next[entity].has(id)) next[entity].delete(id);
      else next[entity].add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((entity: EntityKey) => {
    const filtered = getFilteredRecords(entity);
    setSelectedIds(prev => {
      const allSelected = filtered.every((r: any) => prev[entity].has(r.record_id));
      const next = { ...prev, [entity]: new Set(prev[entity]) };
      if (allSelected) {
        filtered.forEach((r: any) => next[entity].delete(r.record_id));
      } else {
        filtered.forEach((r: any) => next[entity].add(r.record_id));
      }
      return next;
    });
  }, [getFilteredRecords]);

  const clearSelection = useCallback((entity: EntityKey) => {
    setSelectedIds(prev => ({ ...prev, [entity]: new Set() }));
  }, []);

  const getServiceMethods = useCallback((entity: EntityKey) => {
    switch (entity) {
      case 'unternehmen': return {
        create: (fields: any) => LivingAppsService.createUnternehmenEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateUnternehmenEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteUnternehmenEntry(id),
      };
      case 'termine': return {
        create: (fields: any) => LivingAppsService.createTermineEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateTermineEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteTermineEntry(id),
      };
      case 'dokumente': return {
        create: (fields: any) => LivingAppsService.createDokumenteEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateDokumenteEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteDokumenteEntry(id),
      };
      case 'notizen': return {
        create: (fields: any) => LivingAppsService.createNotizenEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateNotizenEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteNotizenEntry(id),
      };
      default: return null;
    }
  }, []);

  async function handleCreate(entity: EntityKey, fields: any) {
    const svc = getServiceMethods(entity);
    if (!svc) return;
    await svc.create(fields);
    fetchAll();
    setCreateEntity(null);
  }

  async function handleUpdate(fields: any) {
    if (!dialogState) return;
    const svc = getServiceMethods(dialogState.entity);
    if (!svc) return;
    await svc.update(dialogState.record.record_id, fields);
    fetchAll();
    setDialogState(null);
  }

  async function handleBulkDelete() {
    if (!deleteTargets) return;
    const svc = getServiceMethods(deleteTargets.entity);
    if (!svc) return;
    setBulkLoading(true);
    try {
      for (const id of deleteTargets.ids) {
        await svc.remove(id);
      }
      clearSelection(deleteTargets.entity);
      fetchAll();
    } finally {
      setBulkLoading(false);
      setDeleteTargets(null);
    }
  }

  async function handleBulkClone() {
    const svc = getServiceMethods(activeTab);
    if (!svc) return;
    setBulkLoading(true);
    try {
      const records = getRecords(activeTab);
      const ids = Array.from(selectedIds[activeTab]);
      for (const id of ids) {
        const rec = records.find((r: any) => r.record_id === id);
        if (!rec) continue;
        const clean = cleanFieldsForApi(rec.fields, activeTab);
        await svc.create(clean as any);
      }
      clearSelection(activeTab);
      fetchAll();
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkEdit(fieldKey: string, value: any) {
    if (!bulkEditOpen) return;
    const svc = getServiceMethods(bulkEditOpen);
    if (!svc) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds[bulkEditOpen]);
      for (const id of ids) {
        await svc.update(id, { [fieldKey]: value });
      }
      clearSelection(bulkEditOpen);
      fetchAll();
    } finally {
      setBulkLoading(false);
      setBulkEditOpen(null);
    }
  }

  function updateFilter(entity: EntityKey, fieldKey: string, value: string) {
    setFilters(prev => ({
      ...prev,
      [entity]: { ...prev[entity], [fieldKey]: value },
    }));
  }

  function clearEntityFilters(entity: EntityKey) {
    setFilters(prev => ({ ...prev, [entity]: {} }));
  }

  const activeFilterCount = useMemo(() => {
    const f = filters[activeTab] ?? {};
    return Object.values(f).filter(v => v && v !== '').length;
  }, [filters, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-destructive">{error.message}</p>
        <Button onClick={fetchAll}>Erneut versuchen</Button>
      </div>
    );
  }

  const filtered = getFilteredRecords(activeTab);
  const sel = selectedIds[activeTab];
  const allFiltered = filtered.every((r: any) => sel.has(r.record_id)) && filtered.length > 0;
  const fieldMeta = getFieldMeta(activeTab);

  return (
    <PageShell
      title="Verwaltung"
      subtitle="Alle Daten verwalten"
      action={
        <Button onClick={() => setCreateEntity(activeTab)} className="shrink-0">
          <IconPlus className="h-4 w-4 mr-2" /> Hinzufügen
        </Button>
      }
    >
      <div className="flex gap-2 flex-wrap">
        {ENTITY_TABS.map(tab => {
          const count = getRecords(tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(''); setSortKey(''); setSortDir('asc'); fetchAll(); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tab.label}
              <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(f => !f)} className="gap-2">
            <IconFilter className="h-4 w-4" />
            Filtern
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => clearEntityFilters(activeTab)}>
              Filter zurücksetzen
            </Button>
          )}
        </div>
        {sel.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap bg-muted/60 rounded-lg px-3 py-1.5">
            <span className="text-sm font-medium">{sel.size} ausgewählt</span>
            <Button variant="outline" size="sm" onClick={() => setBulkEditOpen(activeTab)}>
              <IconPencil className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Feld bearbeiten</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkClone()}>
              <IconCopy className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Kopieren</span>
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteTargets({ entity: activeTab, ids: Array.from(sel) })}>
              <IconTrash className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Ausgewählte löschen</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => clearSelection(activeTab)}>
              <IconX className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Auswahl aufheben</span>
            </Button>
          </div>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4 rounded-lg border bg-muted/30">
          {fieldMeta.map((fm: any) => (
            <div key={fm.key} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{fm.label}</label>
              {fm.type === 'bool' ? (
                <Select value={filters[activeTab]?.[fm.key] ?? ''} onValueChange={v => updateFilter(activeTab, fm.key, v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Alle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="true">Ja</SelectItem>
                    <SelectItem value="false">Nein</SelectItem>
                  </SelectContent>
                </Select>
              ) : fm.type === 'lookup/select' || fm.type === 'lookup/radio' ? (
                <Select value={filters[activeTab]?.[fm.key] ?? ''} onValueChange={v => updateFilter(activeTab, fm.key, v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Alle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    {fm.options?.map((o: any) => (
                      <SelectItem key={o.key} value={o.label}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-8 text-xs"
                  placeholder="Filtern..."
                  value={filters[activeTab]?.[fm.key] ?? ''}
                  onChange={e => updateFilter(activeTab, fm.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-[27px] bg-card shadow-lg overflow-x-auto">
        <Table className="[&_tbody_td]:px-6 [&_tbody_td]:py-2 [&_tbody_td]:text-base [&_tbody_td]:font-medium [&_tbody_tr:first-child_td]:pt-6 [&_tbody_tr:last-child_td]:pb-10">
          <TableHeader className="bg-secondary">
            <TableRow className="border-b border-input">
              <TableHead className="w-10 px-6">
                <Checkbox
                  checked={allFiltered}
                  onCheckedChange={() => toggleSelectAll(activeTab)}
                />
              </TableHead>
              {fieldMeta.map((fm: any) => (
                <TableHead key={fm.key} className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort(fm.key)}>
                  <span className="inline-flex items-center gap-1">
                    {fm.label}
                    {sortKey === fm.key ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                  </span>
                </TableHead>
              ))}
              <TableHead className="w-24 uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortRecords(filtered).map((record: any) => (
              <TableRow key={record.record_id} className={`transition-colors cursor-pointer ${sel.has(record.record_id) ? "bg-primary/5" : "hover:bg-muted/50"}`} onClick={(e) => { if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) return; setViewState({ entity: activeTab, record }); }}>
                <TableCell>
                  <Checkbox
                    checked={sel.has(record.record_id)}
                    onCheckedChange={() => toggleSelect(activeTab, record.record_id)}
                  />
                </TableCell>
                {fieldMeta.map((fm: any) => {
                  const val = record.fields?.[fm.key];
                  if (fm.type === 'bool') {
                    return (
                      <TableCell key={fm.key}>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          val ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {val ? 'Ja' : 'Nein'}
                        </span>
                      </TableCell>
                    );
                  }
                  if (fm.type === 'lookup/select' || fm.type === 'lookup/radio') {
                    return <TableCell key={fm.key}><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{val?.label ?? '—'}</span></TableCell>;
                  }
                  if (fm.type.startsWith('multiplelookup')) {
                    return <TableCell key={fm.key}>{Array.isArray(val) ? val.map((v: any) => v?.label ?? v).join(', ') : '—'}</TableCell>;
                  }
                  if (fm.type.startsWith('multipleapplookup')) {
                    return (
                      <TableCell key={fm.key}>
                        {Array.isArray(val) && val.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {val.map((url: any, i: number) => (
                              <span key={i} className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{getApplookupDisplay(activeTab, fm.key, url)}</span>
                            ))}
                          </div>
                        ) : '—'}
                      </TableCell>
                    );
                  }
                  if (fm.type.startsWith('applookup')) {
                    return <TableCell key={fm.key}><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{getApplookupDisplay(activeTab, fm.key, val)}</span></TableCell>;
                  }
                  if (fm.type.includes('date')) {
                    return <TableCell key={fm.key} className="text-muted-foreground">{fmtDate(val)}</TableCell>;
                  }
                  if (fm.type.startsWith('file')) {
                    return (
                      <TableCell key={fm.key}>
                        {val ? (
                          <div className="relative h-8 w-8 rounded bg-muted overflow-hidden">
                            <img src={val} alt="" className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          </div>
                        ) : '—'}
                      </TableCell>
                    );
                  }
                  if (fm.type === 'string/textarea') {
                    return <TableCell key={fm.key} className="max-w-xs"><span className="truncate block">{val ?? '—'}</span></TableCell>;
                  }
                  if (fm.type === 'geo') {
                    return (
                      <TableCell key={fm.key} className="max-w-[200px]">
                        <span className="truncate block" title={val ? `${val.lat}, ${val.long}` : undefined}>
                          {val?.info ?? (val ? `${val.lat?.toFixed(4)}, ${val.long?.toFixed(4)}` : '—')}
                        </span>
                      </TableCell>
                    );
                  }
                  return <TableCell key={fm.key}>{val ?? '—'}</TableCell>;
                })}
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setDialogState({ entity: activeTab, record })}>
                      <IconPencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTargets({ entity: activeTab, ids: [record.record_id] })}>
                      <IconTrash className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={fieldMeta.length + 2} className="text-center py-16 text-muted-foreground">
                  Keine Ergebnisse gefunden.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {(createEntity === 'unternehmen' || dialogState?.entity === 'unternehmen') && (
        <UnternehmenDialog
          open={createEntity === 'unternehmen' || dialogState?.entity === 'unternehmen'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'unternehmen' ? handleUpdate : (fields: any) => handleCreate('unternehmen', fields)}
          defaultValues={dialogState?.entity === 'unternehmen' ? dialogState.record?.fields : undefined}
          enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
        />
      )}
      {(createEntity === 'termine' || dialogState?.entity === 'termine') && (
        <TermineDialog
          open={createEntity === 'termine' || dialogState?.entity === 'termine'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'termine' ? handleUpdate : (fields: any) => handleCreate('termine', fields)}
          defaultValues={dialogState?.entity === 'termine' ? dialogState.record?.fields : undefined}
          unternehmenList={(data as any).unternehmen ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['Termine']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Termine']}
        />
      )}
      {(createEntity === 'dokumente' || dialogState?.entity === 'dokumente') && (
        <DokumenteDialog
          open={createEntity === 'dokumente' || dialogState?.entity === 'dokumente'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'dokumente' ? handleUpdate : (fields: any) => handleCreate('dokumente', fields)}
          defaultValues={dialogState?.entity === 'dokumente' ? dialogState.record?.fields : undefined}
          unternehmenList={(data as any).unternehmen ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['Dokumente']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Dokumente']}
        />
      )}
      {(createEntity === 'notizen' || dialogState?.entity === 'notizen') && (
        <NotizenDialog
          open={createEntity === 'notizen' || dialogState?.entity === 'notizen'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'notizen' ? handleUpdate : (fields: any) => handleCreate('notizen', fields)}
          defaultValues={dialogState?.entity === 'notizen' ? dialogState.record?.fields : undefined}
          unternehmenList={(data as any).unternehmen ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
        />
      )}
      {viewState?.entity === 'unternehmen' && (
        <UnternehmenViewDialog
          open={viewState?.entity === 'unternehmen'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'unternehmen', record: r }); }}
        />
      )}
      {viewState?.entity === 'termine' && (
        <TermineViewDialog
          open={viewState?.entity === 'termine'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'termine', record: r }); }}
          unternehmenList={(data as any).unternehmen ?? []}
        />
      )}
      {viewState?.entity === 'dokumente' && (
        <DokumenteViewDialog
          open={viewState?.entity === 'dokumente'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'dokumente', record: r }); }}
          unternehmenList={(data as any).unternehmen ?? []}
        />
      )}
      {viewState?.entity === 'notizen' && (
        <NotizenViewDialog
          open={viewState?.entity === 'notizen'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'notizen', record: r }); }}
          unternehmenList={(data as any).unternehmen ?? []}
        />
      )}

      <BulkEditDialog
        open={!!bulkEditOpen}
        onClose={() => setBulkEditOpen(null)}
        onApply={handleBulkEdit}
        fields={bulkEditOpen ? getFieldMeta(bulkEditOpen) : []}
        selectedCount={bulkEditOpen ? selectedIds[bulkEditOpen].size : 0}
        loading={bulkLoading}
        lookupLists={bulkEditOpen ? getLookupLists(bulkEditOpen) : {}}
      />

      <ConfirmDialog
        open={!!deleteTargets}
        onClose={() => setDeleteTargets(null)}
        onConfirm={handleBulkDelete}
        title="Ausgewählte löschen"
        description={`Sollen ${deleteTargets?.ids.length ?? 0} Einträge wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`}
      />
    </PageShell>
  );
}