import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isAfter, isBefore, addDays, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine, enrichDokumente, enrichNotizen } from '@/lib/enrich';
import type { EnrichedTermine } from '@/types/enriched';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
// Pre-generated loading/error surfaces (self-repair flow inside) — keep these
// imports and the two early-returns below; never re-implement them here.
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatCardRow, StatCard } from '@/components/StatCard';
import {
  RecordOverlayHost,
  RecordHeader,
  RecordAttachments,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { CalendarWidget, type CalendarEvent, type CalendarTone } from '@/components/widgets/CalendarWidget';
import { ChartWidget, type ChartRow } from '@/components/widgets/ChartWidget';
import { UnternehmenDialog, type UnternehmenDialogDefaults } from '@/components/dialogs/UnternehmenDialog';
import { TermineDialog, type TermineDialogDefaults } from '@/components/dialogs/TermineDialog';
import { DokumenteDialog, type DokumenteDialogDefaults } from '@/components/dialogs/DokumenteDialog';
import { NotizenDialog, type NotizenDialogDefaults } from '@/components/dialogs/NotizenDialog';
import { UnternehmenDetails } from '@/components/details/UnternehmenDetails';
import { TermineDetails } from '@/components/details/TermineDetails';
import { DokumenteDetails } from '@/components/details/DokumenteDetails';
import { NotizenDetails } from '@/components/details/NotizenDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import {
  IconPlus,
  IconCalendar,
  IconBuilding,
  IconAlertCircle,
  IconClock,
  IconFileText,
  IconNotes,
} from '@tabler/icons-react';

// ─── Overlay stack item type ─────────────────────────────────────────────────
type OverlayItem =
  | { type: 'unternehmen'; id: string }
  | { type: 'termine'; id: string }
  | { type: 'dokumente'; id: string }
  | { type: 'notizen'; id: string };

// ─── Tone helpers ─────────────────────────────────────────────────────────────
function toneForTermin(t: Termine, now: Date): CalendarTone {
  const status = (t.fields.terminstatus as { key: string } | undefined)?.key;
  if (status === 'abgesagt') return 'default';
  if (status === 'stattgefunden') return 'success';
  if (t.fields.datum_uhrzeit && isBefore(parseISO(t.fields.datum_uhrzeit), now)) return 'warning';
  return 'primary';
}

export default function DashboardOverview() {
  const {
    unternehmen, setUnternehmen, termine, setTermine,
    dokumente, setDokumente, notizen, setNotizen,
    unternehmenMap, loading, error, fetchAll,
  } = useDashboardData();

  const clock = useClock();
  const overlay = useRecordOverlayStack<OverlayItem>();

  // ─── Dialog state ──────────────────────────────────────────────────────────
  const [unternehmenDialogOpen, setUnternehmenDialogOpen] = useState(false);
  const [unternehmenDefaults, setUnternehmenDefaults] = useState<UnternehmenDialogDefaults | undefined>(undefined);
  const [editingUnternehmen, setEditingUnternehmen] = useState<Unternehmen | null>(null);

  const [termineDialogOpen, setTermineDialogOpen] = useState(false);
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>(undefined);
  const [editingTermin, setEditingTermin] = useState<Termine | null>(null);

  const [dokumenteDialogOpen, setDokumenteDialogOpen] = useState(false);
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>(undefined);
  const [editingDokument, setEditingDokument] = useState<Dokumente | null>(null);

  const [notizenDialogOpen, setNotizenDialogOpen] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>(undefined);
  const [editingNotiz, setEditingNotiz] = useState<Notizen | null>(null);

  // ─── KPI filter state ──────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // ─── Enriched data ─────────────────────────────────────────────────────────
  const enrichedTermine = enrichTermine(termine, { unternehmenMap });
  const enrichedDokumente = enrichDokumente(dokumente, { unternehmenMap });
  const enrichedNotizen = enrichNotizen(notizen, { unternehmenMap });

  // ─── Derived KPIs ──────────────────────────────────────────────────────────
  const today = format(clock, 'yyyy-MM-dd');
  const in7Days = format(addDays(clock, 7), 'yyyy-MM-dd');

  const aktiveUnternehmen = useMemo(
    () => unternehmen.filter(u => (u.fields.status as { key: string } | undefined)?.key === 'aktiv'),
    [unternehmen]
  );
  const inaktiveUnternehmen = useMemo(
    () => unternehmen.filter(u => (u.fields.status as { key: string } | undefined)?.key === 'inaktiv'),
    [unternehmen]
  );

  const gesamtInvestiert = useMemo(
    () => unternehmen.reduce((sum, u) => sum + (u.fields.investiertes_kapital ?? 0), 0),
    [unternehmen]
  );

  const upcomingTermine = useMemo(
    () => enrichedTermine
      .filter(t => {
        const status = (t.fields.terminstatus as { key: string } | undefined)?.key;
        if (status === 'abgesagt' || status === 'stattgefunden') return false;
        if (!t.fields.datum_uhrzeit) return false;
        return isAfter(parseISO(t.fields.datum_uhrzeit), clock);
      })
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedTermine, clock]
  );

  const todayTermine = useMemo(
    () => enrichedTermine.filter(t => {
      if (!t.fields.datum_uhrzeit) return false;
      return t.fields.datum_uhrzeit.startsWith(today);
    }),
    [enrichedTermine, today]
  );

  const nextWeekTermine = useMemo(
    () => enrichedTermine.filter(t => {
      if (!t.fields.datum_uhrzeit) return false;
      const d = t.fields.datum_uhrzeit.slice(0, 10);
      return d > today && d <= in7Days;
    }),
    [enrichedTermine, today, in7Days]
  );

  // ─── Filtered companies for primary view ──────────────────────────────────
  const displayedUnternehmen = useMemo(() => {
    if (!statusFilter) return unternehmen;
    return unternehmen.filter(u => (u.fields.status as { key: string } | undefined)?.key === statusFilter);
  }, [unternehmen, statusFilter]);

  // ─── Calendar events ────────────────────────────────────────────────────────
  const calendarEvents = useMemo<CalendarEvent[]>(
    () => enrichedTermine.map(t => ({
      id: `termine:${t.record_id}`,
      start: t.fields.datum_uhrzeit ?? format(clock, 'yyyy-MM-dd'),
      title: t.fields.terminbezeichnung ?? 'Termin',
      subtitle: t.unternehmenName || undefined,
      tone: toneForTermin(t, clock),
    })),
    [enrichedTermine, clock]
  );

  // ─── Advance termin status (shared write path) ────────────────────────────
  const advanceTermin = useCallback((t: Termine) => {
    const status = (t.fields.terminstatus as { key: string } | undefined)?.key;
    const nextStatus = status === 'geplant' ? 'stattgefunden' : 'geplant';
    const nextLabel = nextStatus === 'stattgefunden' ? 'Stattgefunden' : 'Geplant';
    const prevState = termine.map(x => x);
    setTermine(termine.map(x =>
      x.record_id === t.record_id
        ? { ...x, fields: { ...x.fields, terminstatus: { key: nextStatus, label: nextLabel } } }
        : x
    ));
    LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: nextStatus }).catch(() => {
      setTermine(prevState);
      fetchAll();
    });
    undoToast(
      nextStatus === 'stattgefunden' ? 'Als stattgefunden markiert' : 'Auf Geplant zurückgesetzt',
      () => {
        setTermine(prevState);
        LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: status ?? 'geplant' }).catch(() => fetchAll());
      }
    );
  }, [termine, setTermine, fetchAll]);

  // ─── Hero: today's upcoming Termine ──────────────────────────────────────
  const heroTermin = todayTermine.length > 0 ? todayTermine[0] : null;

  // Every hook is above this line.
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;
  // ─── Below: plain derivations only ──────────────────────────────────────

  const nextTermin = upcomingTermine[0];

  // Context line for greeting
  const todayNames = todayTermine.map(t => t.unternehmenName || t.fields.terminbezeichnung || '').filter(Boolean);
  const contextLine = todayTermine.length > 0
    ? `Heute: ${namen(todayNames, 3)} — ${todayTermine.length} Termin${todayTermine.length > 1 ? 'e' : ''} im Kalender.`
    : nextTermin
    ? `Nächster Termin: ${nextTermin.fields.terminbezeichnung} (${formatDate(nextTermin.fields.datum_uhrzeit)}).`
    : unternehmen.length === 0
    ? 'Leg dein erstes Beteiligungsunternehmen an.'
    : `${aktiveUnternehmen.length} aktive Beteiligung${aktiveUnternehmen.length !== 1 ? 'en' : ''} im Portfolio.`;

  return (
    <>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground mt-1 truncate">{contextLine}</p>
        </div>
        <button
          onClick={() => { setUnternehmenDefaults(undefined); setEditingUnternehmen(null); setUnternehmenDialogOpen(true); }}
          className="shrink-0 flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <IconPlus size={16} className="shrink-0" />
          <span className="hidden sm:inline">Unternehmen</span>
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={heroTermin && (
          <HeroBanner
            icon={<IconCalendar size={18} />}
            action={{
              label: 'Als stattgefunden markieren',
              onClick: () => advanceTermin(heroTermin),
            }}
          >
            <b>{heroTermin.fields.terminbezeichnung}</b>
            {heroTermin.unternehmenName ? ` · ${heroTermin.unternehmenName}` : ''}
            {heroTermin.fields.datum_uhrzeit ? ` um ${format(parseISO(heroTermin.fields.datum_uhrzeit), 'HH:mm')} Uhr` : ''}
          </HeroBanner>
        )}
        kpis={
          <StatCardRow>
            <StatCard
              title="Aktive Beteiligungen"
              value={aktiveUnternehmen.length}
              description={aktiveUnternehmen.length > 0 ? `${inaktiveUnternehmen.length} inaktiv` : 'Noch keine aktiven'}
              icon={<IconBuilding size={18} className="text-muted-foreground" />}
              tone={aktiveUnternehmen.length > 0 ? 'primary' : 'default'}
              onClick={() => setStatusFilter(f => f === 'aktiv' ? null : 'aktiv')}
              active={statusFilter === 'aktiv'}
            />
            <StatCard
              title="Investiertes Kapital"
              value={gesamtInvestiert > 0 ? formatCurrency(gesamtInvestiert) : '—'}
              description={`${unternehmen.length} Beteiligungen gesamt`}
              icon={<IconBuilding size={18} className="text-muted-foreground" />}
              tone="default"
            />
            <StatCard
              title="Termine diese Woche"
              value={nextWeekTermine.length}
              description={nextWeekTermine.length > 0 ? `Nächster: ${nextWeekTermine[0]?.fields.terminbezeichnung ?? ''}` : 'Keine Termine geplant'}
              icon={<IconCalendar size={18} className="text-muted-foreground" />}
              tone={todayTermine.length > 0 ? 'warning' : 'default'}
            />
            <StatCard
              title="Dokumente"
              value={dokumenteDefaults !== undefined ? dokumente.length : dokumente.length}
              description={`${notizen.length} Notizen`}
              icon={<IconFileText size={18} className="text-muted-foreground" />}
              tone="default"
            />
          </StatCardRow>
        }
        primary={
          <CalendarWidget
            events={calendarEvents}
            defaultView="week"
            locale={de}
            weekDays={5}
            dayStartHour={8}
            dayEndHour={20}
            onEventClick={ev => {
              const id = ev.id.split(':')[1] ?? '';
              overlay.replace({ type: 'termine', id });
            }}
            onEmptyClick={(date) => {
              setEditingTermin(null);
              setTermineDefaults({ datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm") });
              setTermineDialogOpen(true);
            }}
            onEventDrop={async (eventId, newStart) => {
              const id = eventId.split(':')[1] ?? '';
              const prev = termine.find(t => t.record_id === id);
              if (!prev) return;
              const prevState = termine.map(x => x);
              setTermine(termine.map(x =>
                x.record_id === id ? { ...x, fields: { ...x.fields, datum_uhrzeit: newStart } } : x
              ));
              LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: newStart }).catch(() => {
                setTermine(prevState);
                fetchAll();
              });
              undoToast('Termin verschoben', () => {
                setTermine(prevState);
                LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: prev.fields.datum_uhrzeit }).catch(() => fetchAll());
              });
            }}
          />
        }
        aside={<>
          <WorkList
            title="Bevorstehende Termine"
            items={upcomingTermine.slice(0, 8).map(t => {
              const statusKey = (t.fields.terminstatus as { key: string } | undefined)?.key ?? 'geplant';
              const isGeplant = statusKey === 'geplant';
              return {
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? 'Termin',
                secondLine: (
                  <>
                    <span className={isGeplant ? 'font-medium text-primary' : 'text-muted-foreground'}>
                      {t.fields.terminart?.label ?? 'Termin'}
                    </span>
                    <span className="text-muted-foreground"> · {formatDate(t.fields.datum_uhrzeit)}</span>
                    {t.unternehmenName ? <span className="text-muted-foreground"> · {t.unternehmenName}</span> : null}
                  </>
                ),
                action: isGeplant ? {
                  label: '✓ Stattgefunden',
                  onClick: () => advanceTermin(t),
                } : undefined,
              };
            })}
            onItemClick={id => overlay.replace({ type: 'termine', id })}
            empty={{
              text: nextTermin
                ? `Nächster Termin: ${nextTermin.fields.terminbezeichnung}`
                : 'Keine Termine geplant',
              action: {
                label: 'Termin anlegen',
                onClick: () => { setEditingTermin(null); setTermineDefaults(undefined); setTermineDialogOpen(true); },
              },
            }}
          />
          <ChartWidget
            title="Portfolio nach Branche"
            rows={unternehmen.map(u => ({ id: `unternehmen:${u.record_id}`, data: u }))}
            dimension={{
              kind: 'category',
              accessor: (row: ChartRow<Unternehmen>) => row.data.fields.branche,
              label: 'Branche',
            }}
          />
        </>}
      />

      {/* Unternehmen empty state */}
      {unternehmen.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <IconBuilding size={48} className="text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">Noch keine Beteiligungen</p>
            <p className="text-sm text-muted-foreground mt-1">Leg dein erstes Unternehmen an und verwalte dein Portfolio.</p>
          </div>
          <button
            onClick={() => { setUnternehmenDefaults(undefined); setEditingUnternehmen(null); setUnternehmenDialogOpen(true); }}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <IconPlus size={16} className="shrink-0" />
            Erstes Unternehmen anlegen
          </button>
        </div>
      )}

      {/* Dialogs */}
      <UnternehmenDialog
        open={unternehmenDialogOpen}
        onClose={() => setUnternehmenDialogOpen(false)}
        onSubmit={async (fields) => {
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
        onClose={() => setTermineDialogOpen(false)}
        onSubmit={async (fields) => {
          if (editingTermin) {
            await LivingAppsService.updateTermineEntry(editingTermin.record_id, fields);
          } else {
            await LivingAppsService.createTermineEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingTermin ? editingTermin.fields : termineDefaults}
        recordId={editingTermin?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Termine']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Termine']}
      />

      <DokumenteDialog
        open={dokumenteDialogOpen}
        onClose={() => setDokumenteDialogOpen(false)}
        onSubmit={async (fields) => {
          if (editingDokument) {
            await LivingAppsService.updateDokumenteEntry(editingDokument.record_id, fields);
          } else {
            await LivingAppsService.createDokumenteEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingDokument ? editingDokument.fields : dokumenteDefaults}
        recordId={editingDokument?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Dokumente']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Dokumente']}
      />

      <NotizenDialog
        open={notizenDialogOpen}
        onClose={() => setNotizenDialogOpen(false)}
        onSubmit={async (fields) => {
          if (editingNotiz) {
            await LivingAppsService.updateNotizenEntry(editingNotiz.record_id, fields);
          } else {
            await LivingAppsService.createNotizenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingNotiz ? editingNotiz.fields : notizenDefaults}
        recordId={editingNotiz?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />

      {/* Record overlay stack — ONE host for all entity types */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'unternehmen') {
            const rec = unternehmen.find(u => u.record_id === top.id);
            if (!rec) return null;
            return (
              <>
                <RecordHeader
                  title={rec.fields.name ?? 'Unternehmen'}
                  subtitle={[rec.fields.rechtsform?.label, rec.fields.branche?.label].filter(Boolean).join(' · ')}
                  badges={
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      rec.fields.status?.key === 'aktiv' ? 'bg-success/15 text-success' :
                      rec.fields.status?.key === 'exit' ? 'bg-primary/15 text-primary' :
                      'bg-muted text-muted-foreground'
                    }`}>{rec.fields.status?.label ?? '—'}</span>
                  }
                />
                <UnternehmenDetails
                  record={rec}
                  termineList={termine}
                  onOpenTermine={t => overlay.push({ type: 'termine', id: t.record_id })}
                  onAddTermine={() => {
                    setEditingTermin(null);
                    setTermineDefaults({ unternehmen: rec.record_id });
                    setTermineDialogOpen(true);
                  }}
                  dokumenteList={dokumente}
                  onOpenDokumente={d => overlay.push({ type: 'dokumente', id: d.record_id })}
                  onAddDokumente={() => {
                    setEditingDokument(null);
                    setDokumenteDefaults({ unternehmen: rec.record_id });
                    setDokumenteDialogOpen(true);
                  }}
                  notizenList={notizen}
                  onOpenNotizen={n => overlay.push({ type: 'notizen', id: n.record_id })}
                  onAddNotizen={() => {
                    setEditingNotiz(null);
                    setNotizenDefaults({ unternehmen: rec.record_id });
                    setNotizenDialogOpen(true);
                  }}
                />
              </>
            );
          }
          if (top.type === 'termine') {
            const rec = termine.find(t => t.record_id === top.id);
            if (!rec) return null;
            const unternehmenRec = unternehmen.find(u => u.record_id === extractRecordId(rec.fields.unternehmen));
            return (
              <>
                <RecordHeader
                  title={rec.fields.terminbezeichnung ?? 'Termin'}
                  subtitle={[rec.fields.terminart?.label, formatDate(rec.fields.datum_uhrzeit)].filter(Boolean).join(' · ')}
                  badges={
                    rec.fields.terminstatus && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        rec.fields.terminstatus.key === 'stattgefunden' ? 'bg-success/15 text-success' :
                        rec.fields.terminstatus.key === 'abgesagt' ? 'bg-muted text-muted-foreground' :
                        'bg-primary/15 text-primary'
                      }`}>{rec.fields.terminstatus.label}</span>
                    )
                  }
                />
                <TermineDetails
                  record={rec}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u => overlay.push({ type: 'unternehmen', id: u.record_id })}
                />
              </>
            );
          }
          if (top.type === 'dokumente') {
            const rec = dokumente.find(d => d.record_id === top.id);
            if (!rec) return null;
            return (
              <>
                <RecordHeader
                  title={rec.fields.dokumentenbezeichnung ?? 'Dokument'}
                  subtitle={rec.fields.dokumententyp?.label}
                />
                <DokumenteDetails
                  record={rec}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u => overlay.push({ type: 'unternehmen', id: u.record_id })}
                />
              </>
            );
          }
          if (top.type === 'notizen') {
            const rec = notizen.find(n => n.record_id === top.id);
            if (!rec) return null;
            return (
              <>
                <RecordHeader
                  title={rec.fields.notiz_titel ?? 'Notiz'}
                  subtitle={[rec.fields.kategorie?.label, formatDate(rec.fields.notiz_datum)].filter(Boolean).join(' · ')}
                />
                <NotizenDetails
                  record={rec}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u => overlay.push({ type: 'unternehmen', id: u.record_id })}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={top => {
          overlay.close();
          if (top.type === 'unternehmen') {
            const rec = unternehmen.find(u => u.record_id === top.id);
            if (rec) { setEditingUnternehmen(rec); setUnternehmenDefaults(undefined); setUnternehmenDialogOpen(true); }
          } else if (top.type === 'termine') {
            const rec = termine.find(t => t.record_id === top.id);
            if (rec) { setEditingTermin(rec); setTermineDefaults(undefined); setTermineDialogOpen(true); }
          } else if (top.type === 'dokumente') {
            const rec = dokumente.find(d => d.record_id === top.id);
            if (rec) { setEditingDokument(rec); setDokumenteDefaults(undefined); setDokumenteDialogOpen(true); }
          } else if (top.type === 'notizen') {
            const rec = notizen.find(n => n.record_id === top.id);
            if (rec) { setEditingNotiz(rec); setNotizenDefaults(undefined); setNotizenDialogOpen(true); }
          }
        }}
        footer={top => {
          if (top.type === 'termine') {
            const rec = termine.find(t => t.record_id === top.id);
            if (!rec) return undefined;
            const status = (rec.fields.terminstatus as { key: string } | undefined)?.key;
            if (status === 'stattgefunden' || status === 'abgesagt') return undefined;
            return {
              label: 'Als stattgefunden markieren',
              onClick: () => { advanceTermin(rec); overlay.close(); },
            };
          }
          return undefined;
        }}
      />
    </>
  );
}
