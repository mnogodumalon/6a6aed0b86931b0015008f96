import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isAfter, isBefore, startOfDay, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine, enrichDokumente, enrichNotizen } from '@/lib/enrich';
import type { EnrichedTermine, EnrichedDokumente, EnrichedNotizen } from '@/types/enriched';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency, displayLookup } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import {
  useRecordOverlayStack,
  RecordOverlayHost,
  RecordHeader,
  RecordField,
  RecordSection,
} from '@/components/widgets/RecordView';
import { CalendarWidget, type CalendarEvent, type CalendarTone } from '@/components/widgets/CalendarWidget';
import { UnternehmenDetails } from '@/components/details/UnternehmenDetails';
import { TermineDetails } from '@/components/details/TermineDetails';
import { DokumenteDetails } from '@/components/details/DokumenteDetails';
import { NotizenDetails } from '@/components/details/NotizenDetails';
import { UnternehmenDialog } from '@/components/dialogs/UnternehmenDialog';
import { TermineDialog, type TermineDialogDefaults } from '@/components/dialogs/TermineDialog';
import { DokumenteDialog, type DokumenteDialogDefaults } from '@/components/dialogs/DokumenteDialog';
import { NotizenDialog, type NotizenDialogDefaults } from '@/components/dialogs/NotizenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import {
  IconBuilding, IconCalendar, IconCurrencyEuro, IconTrendingUp, IconAlertTriangle,
  IconPlus,
} from '@tabler/icons-react';

// Overlay union type
type OverlayItem =
  | { type: 'unternehmen'; id: string }
  | { type: 'termin'; id: string }
  | { type: 'dokument'; id: string }
  | { type: 'notiz'; id: string };

function termineTone(t: Termine, now: Date): CalendarTone {
  const key = t.fields.terminstatus?.key;
  if (key === 'abgesagt') return 'default';
  if (key === 'stattgefunden') return 'success';
  if (t.fields.datum_uhrzeit && isBefore(parseISO(t.fields.datum_uhrzeit), now)) return 'warning';
  return 'primary';
}

export default function DashboardOverview() {
  const {
    unternehmen, setUnternehmen,
    termine, setTermine,
    dokumente, setDokumente,
    notizen, setNotizen,
    unternehmenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const clock = useClock();
  const overlay = useRecordOverlayStack<OverlayItem>();

  // Dialog states
  const [unternehmenDialogOpen, setUnternehmenDialogOpen] = useState(false);
  const [editingUnternehmen, setEditingUnternehmen] = useState<Unternehmen | null>(null);
  const [termineDialogOpen, setTermineDialogOpen] = useState(false);
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>();
  const [editingTermin, setEditingTermin] = useState<Termine | null>(null);
  const [dokumenteDialogOpen, setDokumenteDialogOpen] = useState(false);
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>();
  const [editingDokument, setEditingDokument] = useState<Dokumente | null>(null);
  const [notizenDialogOpen, setNotizenDialogOpen] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>();
  const [editingNotiz, setEditingNotiz] = useState<Notizen | null>(null);

  // Filter state for KPI strip
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const enrichedTermine = enrichTermine(termine, { unternehmenMap });
  const enrichedDokumente = enrichDokumente(dokumente, { unternehmenMap });
  const enrichedNotizen = enrichNotizen(notizen, { unternehmenMap });

  // KPIs
  const aktiveUnternehmen = useMemo(
    () => unternehmen.filter(u => u.fields.status?.key === 'aktiv'),
    [unternehmen]
  );
  const gesamtKapital = useMemo(
    () => unternehmen.reduce((s, u) => s + (u.fields.investiertes_kapital ?? 0), 0),
    [unternehmen]
  );
  const gesamtWert = useMemo(
    () => unternehmen.reduce((s, u) => s + (u.fields.aktueller_wert ?? 0), 0),
    [unternehmen]
  );
  const today = format(clock, 'yyyy-MM-dd');
  const nextWeek = format(addDays(clock, 7), 'yyyy-MM-dd');
  const baldFaellig = useMemo(
    () => termine.filter(t => {
      if (!t.fields.datum_uhrzeit) return false;
      const d = t.fields.datum_uhrzeit.slice(0, 10);
      return d >= today && d <= nextWeek && t.fields.terminstatus?.key !== 'abgesagt' && t.fields.terminstatus?.key !== 'stattgefunden';
    }),
    [termine, today, nextWeek]
  );
  const ueberfaellig = useMemo(
    () => termine.filter(t => {
      if (!t.fields.datum_uhrzeit) return false;
      return t.fields.datum_uhrzeit < format(clock, "yyyy-MM-dd'T'HH:mm") && t.fields.terminstatus?.key === 'geplant';
    }),
    [termine, clock]
  );

  // Calendar events
  const calendarEvents = useMemo<CalendarEvent[]>(
    () => termine
      .filter(t => !!t.fields.datum_uhrzeit)
      .map(t => {
        const unternehmenName = unternehmenMap.get(extractRecordId(t.fields.unternehmen) ?? '')?.fields.name;
        return {
          id: `termin:${t.record_id}`,
          start: t.fields.datum_uhrzeit!,
          title: t.fields.terminbezeichnung ?? 'Termin',
          subtitle: unternehmenName,
          tone: termineTone(t, clock),
        };
      }),
    [termine, unternehmenMap, clock]
  );

  // Upcoming termine for worklist (next 30 days, geplant)
  const naechsteTermine = useMemo(
    () => enrichedTermine
      .filter(t => {
        if (!t.fields.datum_uhrzeit) return false;
        const d = t.fields.datum_uhrzeit;
        return d >= format(clock, "yyyy-MM-dd'T'HH:mm") && t.fields.terminstatus?.key !== 'abgesagt';
      })
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '') < (b.fields.datum_uhrzeit ?? '') ? -1 : 1)
      .slice(0, 8),
    [enrichedTermine, clock]
  );

  // Filtered unternehmen for status filter
  const filteredUnternehmen = useMemo(
    () => statusFilter ? unternehmen.filter(u => u.fields.status?.key === statusFilter) : unternehmen,
    [unternehmen, statusFilter]
  );

  // Termin status advance
  const advanceTermin = useCallback(async (t: Termine) => {
    const prev = t.fields.terminstatus?.key;
    const nextKey = prev === 'geplant' ? 'stattgefunden' : 'geplant';
    const nextLabel = nextKey === 'stattgefunden' ? 'Stattgefunden' : 'Geplant';
    const snap = termine.map(x => x.record_id === t.record_id ? { ...x, fields: { ...x.fields, terminstatus: { key: nextKey, label: nextLabel } } } : x);
    setTermine(snap);
    undoToast(
      nextKey === 'stattgefunden' ? 'Termin als stattgefunden markiert' : 'Status zurückgesetzt',
      async () => {
        const undo = termine.map(x => x.record_id === t.record_id ? t : x);
        setTermine(undo);
        await LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: prev ?? undefined });
      }
    );
    try {
      await LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: nextKey });
    } catch {
      fetchAll();
    }
  }, [termine, setTermine, fetchAll]);

  // ─── Every hook goes ABOVE this line ───
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;
  // ─── Below this line: plain derivations only ───

  // Context line
  const naechsterTermin = naechsteTermine[0];
  const naechsterName = naechsterTermin?.unternehmenName || naechsterTermin?.fields.terminbezeichnung;
  const contextLine = ueberfaellig.length > 0
    ? `${ueberfaellig.length} überfällige${ueberfaellig.length > 1 ? '' : 'r'} Termin${ueberfaellig.length > 1 ? 'e' : ''} — bitte prüfen.`
    : naechsterTermin
      ? `Nächster Termin: ${naechsterTermin.fields.terminbezeichnung}${naechsterName ? ` bei ${naechsterName}` : ''} am ${formatDate(naechsterTermin.fields.datum_uhrzeit)}.`
      : aktiveUnternehmen.length > 0
        ? `${aktiveUnternehmen.length} aktive Beteiligung${aktiveUnternehmen.length > 1 ? 'en' : ''} im Portfolio.`
        : 'Leg dein erstes Portfoliounternehmen an.';

  // Lookup helpers
  const findUnternehmen = (id: string) => unternehmen.find(u => u.record_id === id);
  const findTermin = (id: string) => termine.find(t => t.record_id === id);
  const findDokument = (id: string) => dokumente.find(d => d.record_id === id);
  const findNotiz = (id: string) => notizen.find(n => n.record_id === id);

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)} Portfolio-Cockpit</h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <div className="flex gap-2 mt-2 sm:mt-0">
          <button
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            onClick={() => { setEditingUnternehmen(null); setUnternehmenDialogOpen(true); }}
          >
            <IconPlus size={16} className="shrink-0" />
            Unternehmen
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent transition-colors"
            onClick={() => { setEditingTermin(null); setTermineDefaults(undefined); setTermineDialogOpen(true); }}
          >
            <IconCalendar size={16} className="shrink-0" />
            Termin
          </button>
        </div>
      </div>

      <DashboardGrid
        variant="split"
        hero={ueberfaellig.length > 0 ? (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: 'Als stattgefunden markieren',
              onClick: () => advanceTermin(ueberfaellig[0]),
            }}
          >
            <b>{namen(ueberfaellig.map(t => t.fields.terminbezeichnung ?? ''))}</b>
            {ueberfaellig.length === 1
              ? ` ist überfällig — war geplant am ${formatDate(ueberfaellig[0].fields.datum_uhrzeit)}`
              : ` sind überfällig`}.
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatStrip>
            <StatStripItem
              title="Aktive Beteiligungen"
              value={aktiveUnternehmen.length}
              icon={<IconBuilding size={16} className="shrink-0" />}
              tone={aktiveUnternehmen.length > 0 ? 'primary' : 'default'}
              onClick={() => setStatusFilter(f => f === 'aktiv' ? null : 'aktiv')}
              active={statusFilter === 'aktiv'}
            />
            <StatStripItem
              title="Investiertes Kapital"
              value={formatCurrency(gesamtKapital)}
              icon={<IconCurrencyEuro size={16} className="shrink-0" />}
            />
            <StatStripItem
              title="Portfoliowert"
              value={formatCurrency(gesamtWert)}
              icon={<IconTrendingUp size={16} className="shrink-0" />}
              tone={gesamtWert > gesamtKapital && gesamtKapital > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title="Diese Woche fällig"
              value={baldFaellig.length}
              icon={<IconCalendar size={16} className="shrink-0" />}
              tone={baldFaellig.length > 0 ? 'warning' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <CalendarWidget
            events={calendarEvents}
            locale={de}
            onEventClick={ev => {
              const id = ev.id.split(':')[1];
              if (id) overlay.replace({ type: 'termin', id });
            }}
            onEmptyClick={date => {
              setEditingTermin(null);
              setTermineDefaults({ datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm") });
              setTermineDialogOpen(true);
            }}
            onEventDrop={async (eventId, newStart) => {
              const id = eventId.split(':')[1];
              if (!id) return;
              const prev = termine.find(t => t.record_id === id);
              if (!prev) return;
              setTermine(ts => ts.map(t => t.record_id === id ? { ...t, fields: { ...t.fields, datum_uhrzeit: newStart } } : t));
              undoToast('Termin verschoben', async () => {
                if (prev.fields.datum_uhrzeit) {
                  setTermine(ts => ts.map(t => t.record_id === id ? prev : t));
                  await LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: prev.fields.datum_uhrzeit });
                }
              });
              try {
                await LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: newStart });
              } catch {
                fetchAll();
              }
            }}
          />
        }
        aside={
          <>
            <WorkList
              title="Nächste Termine"
              items={naechsteTermine.map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? 'Termin',
                secondLine: (
                  <>
                    <span className={t.fields.terminstatus?.key === 'geplant' ? 'font-medium text-primary' : 'text-muted-foreground'}>
                      {t.fields.terminstatus?.label ?? 'Geplant'}
                    </span>
                    <span className="text-muted-foreground"> · {formatDate(t.fields.datum_uhrzeit)}</span>
                    {t.unternehmenName ? <span className="text-muted-foreground"> · {t.unternehmenName}</span> : null}
                  </>
                ),
                action: t.fields.terminstatus?.key === 'geplant'
                  ? { label: '✓ Bestätigen', onClick: () => advanceTermin(t) }
                  : undefined,
              }))}
              onItemClick={id => overlay.replace({ type: 'termin', id })}
              empty={{
                text: baldFaellig.length === 0
                  ? 'Keine Termine diese Woche — alles im Plan.'
                  : 'Alle Termine bestätigt.',
                action: { label: 'Termin anlegen', onClick: () => setTermineDialogOpen(true) },
              }}
            />
            <WorkList
              title="Portfolio-Unternehmen"
              items={filteredUnternehmen
                .sort((a, b) => (a.fields.name ?? '').localeCompare(b.fields.name ?? '', 'de'))
                .slice(0, 8)
                .map(u => ({
                  id: u.record_id,
                  title: u.fields.name ?? 'Unbekannt',
                  secondLine: (
                    <>
                      <span className={
                        u.fields.status?.key === 'aktiv' ? 'font-medium text-success' :
                        u.fields.status?.key === 'exit' ? 'text-muted-foreground' :
                        'text-muted-foreground'
                      }>
                        {u.fields.status?.label ?? '—'}
                      </span>
                      {u.fields.branche ? <span className="text-muted-foreground"> · {u.fields.branche.label}</span> : null}
                    </>
                  ),
                  action: { label: 'Öffnen', onClick: () => overlay.replace({ type: 'unternehmen', id: u.record_id }) },
                }))}
              onItemClick={id => overlay.replace({ type: 'unternehmen', id })}
              empty={{
                text: 'Noch kein Unternehmen im Portfolio.',
                action: { label: 'Erstes Unternehmen anlegen', onClick: () => setUnternehmenDialogOpen(true) },
              }}
            />
          </>
        }
      />

      {/* Overlay stack */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'unternehmen') {
            const u = findUnternehmen(top.id);
            if (!u) return null;
            return (
              <>
                <RecordHeader
                  title={u.fields.name ?? 'Unternehmen'}
                  subtitle={[u.fields.branche?.label, u.fields.rechtsform?.label].filter(Boolean).join(' · ')}
                  badges={
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.fields.status?.key === 'aktiv' ? 'bg-success/10 text-success' :
                      u.fields.status?.key === 'exit' ? 'bg-muted text-muted-foreground' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {u.fields.status?.label ?? '—'}
                    </span>
                  }
                  meta={[u.fields.stadt, u.fields.land].filter(Boolean).join(', ') || undefined}
                />
                <UnternehmenDetails
                  record={u}
                  termineList={termine}
                  onOpenTermine={t => overlay.push({ type: 'termin', id: t.record_id })}
                  onAddTermine={() => {
                    setEditingTermin(null);
                    setTermineDefaults({ unternehmen: u.record_id });
                    setTermineDialogOpen(true);
                  }}
                  dokumenteList={dokumente}
                  onOpenDokumente={d => overlay.push({ type: 'dokument', id: d.record_id })}
                  onAddDokumente={() => {
                    setEditingDokument(null);
                    setDokumenteDefaults({ unternehmen: u.record_id });
                    setDokumenteDialogOpen(true);
                  }}
                  notizenList={notizen}
                  onOpenNotizen={n => overlay.push({ type: 'notiz', id: n.record_id })}
                  onAddNotizen={() => {
                    setEditingNotiz(null);
                    setNotizenDefaults({ unternehmen: u.record_id });
                    setNotizenDialogOpen(true);
                  }}
                />
              </>
            );
          }
          if (top.type === 'termin') {
            const t = findTermin(top.id);
            if (!t) return null;
            return (
              <>
                <RecordHeader
                  title={t.fields.terminbezeichnung ?? 'Termin'}
                  subtitle={t.fields.terminart?.label}
                  meta={formatDate(t.fields.datum_uhrzeit) + (t.fields.ort ? ` · ${t.fields.ort}` : '')}
                />
                <TermineDetails
                  record={t}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u => overlay.push({ type: 'unternehmen', id: u.record_id })}
                />
              </>
            );
          }
          if (top.type === 'dokument') {
            const d = findDokument(top.id);
            if (!d) return null;
            return (
              <>
                <RecordHeader
                  title={d.fields.dokumentenbezeichnung ?? 'Dokument'}
                  subtitle={d.fields.dokumententyp?.label}
                  meta={formatDate(d.fields.dokumentendatum)}
                />
                <DokumenteDetails
                  record={d}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u => overlay.push({ type: 'unternehmen', id: u.record_id })}
                />
              </>
            );
          }
          if (top.type === 'notiz') {
            const n = findNotiz(top.id);
            if (!n) return null;
            return (
              <>
                <RecordHeader
                  title={n.fields.notiz_titel ?? 'Notiz'}
                  subtitle={n.fields.kategorie?.label}
                  meta={formatDate(n.fields.notiz_datum)}
                />
                <NotizenDetails
                  record={n}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u => overlay.push({ type: 'unternehmen', id: u.record_id })}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={top => {
          if (top.type === 'unternehmen') {
            const u = findUnternehmen(top.id);
            if (u) { setEditingUnternehmen(u); setUnternehmenDialogOpen(true); }
          }
          if (top.type === 'termin') {
            const t = findTermin(top.id);
            if (t) { setEditingTermin(t); setTermineDefaults(undefined); setTermineDialogOpen(true); }
          }
          if (top.type === 'dokument') {
            const d = findDokument(top.id);
            if (d) { setEditingDokument(d); setDokumenteDefaults(undefined); setDokumenteDialogOpen(true); }
          }
          if (top.type === 'notiz') {
            const n = findNotiz(top.id);
            if (n) { setEditingNotiz(n); setNotizenDefaults(undefined); setNotizenDialogOpen(true); }
          }
        }}
        footer={top => {
          if (top.type === 'termin') {
            const t = findTermin(top.id);
            if (!t || t.fields.terminstatus?.key === 'abgesagt') return undefined;
            if (t.fields.terminstatus?.key === 'stattgefunden') return undefined;
            return {
              label: 'Als stattgefunden markieren',
              onClick: () => advanceTermin(t),
            };
          }
          return undefined;
        }}
      />

      {/* Dialogs */}
      <UnternehmenDialog
        open={unternehmenDialogOpen}
        onClose={() => { setUnternehmenDialogOpen(false); setEditingUnternehmen(null); }}
        onSubmit={async fields => {
          if (editingUnternehmen) {
            await LivingAppsService.updateUnternehmenEntry(editingUnternehmen.record_id, fields);
          } else {
            await LivingAppsService.createUnternehmenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingUnternehmen?.fields}
        recordId={editingUnternehmen?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
      />

      <TermineDialog
        open={termineDialogOpen}
        onClose={() => { setTermineDialogOpen(false); setEditingTermin(null); setTermineDefaults(undefined); }}
        onSubmit={async fields => {
          if (editingTermin) {
            await LivingAppsService.updateTermineEntry(editingTermin.record_id, fields);
          } else {
            await LivingAppsService.createTermineEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingTermin?.fields ?? termineDefaults}
        recordId={editingTermin?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Termine']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Termine']}
      />

      <DokumenteDialog
        open={dokumenteDialogOpen}
        onClose={() => { setDokumenteDialogOpen(false); setEditingDokument(null); setDokumenteDefaults(undefined); }}
        onSubmit={async fields => {
          if (editingDokument) {
            await LivingAppsService.updateDokumenteEntry(editingDokument.record_id, fields);
          } else {
            await LivingAppsService.createDokumenteEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingDokument?.fields ?? dokumenteDefaults}
        recordId={editingDokument?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Dokumente']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Dokumente']}
      />

      <NotizenDialog
        open={notizenDialogOpen}
        onClose={() => { setNotizenDialogOpen(false); setEditingNotiz(null); setNotizenDefaults(undefined); }}
        onSubmit={async fields => {
          if (editingNotiz) {
            await LivingAppsService.updateNotizenEntry(editingNotiz.record_id, fields);
          } else {
            await LivingAppsService.createNotizenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingNotiz?.fields ?? notizenDefaults}
        recordId={editingNotiz?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />
    </>
  );
}
