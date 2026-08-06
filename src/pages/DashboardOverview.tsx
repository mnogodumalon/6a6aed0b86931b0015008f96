import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isAfter, isBefore, addDays, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine, enrichDokumente, enrichNotizen } from '@/lib/enrich';
import type { EnrichedTermine } from '@/types/enriched';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import {
  useRecordOverlayStack,
  RecordOverlayHost,
  RecordHeader,
  RecordField,
  RecordSection,
} from '@/components/widgets/RecordView';
import { UnternehmenDetails } from '@/components/details/UnternehmenDetails';
import { TermineDetails } from '@/components/details/TermineDetails';
import { DokumenteDetails } from '@/components/details/DokumenteDetails';
import { NotizenDetails } from '@/components/details/NotizenDetails';
import { CalendarWidget } from '@/components/widgets/CalendarWidget';
import type { CalendarEvent } from '@/components/widgets/CalendarWidget';
import { UnternehmenDialog } from '@/components/dialogs/UnternehmenDialog';
import type { UnternehmenDialogDefaults } from '@/components/dialogs/UnternehmenDialog';
import { TermineDialog } from '@/components/dialogs/TermineDialog';
import type { TermineDialogDefaults } from '@/components/dialogs/TermineDialog';
import { DokumenteDialog } from '@/components/dialogs/DokumenteDialog';
import type { DokumenteDialogDefaults } from '@/components/dialogs/DokumenteDialog';
import { NotizenDialog } from '@/components/dialogs/NotizenDialog';
import type { NotizenDialogDefaults } from '@/components/dialogs/NotizenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import {
  IconBriefcase,
  IconCalendar,
  IconAlertTriangle,
  IconPlus,
  IconChartBar,
  IconFileText,
  IconNote,
  IconBuilding,
  IconTrendingUp,
} from '@tabler/icons-react';

// Overlay item union
type OverlayItem =
  | { type: 'unternehmen'; record: Unternehmen }
  | { type: 'termin'; record: Termine }
  | { type: 'dokument'; record: Dokumente }
  | { type: 'notiz'; record: Notizen };

export default function DashboardOverview() {
  const clock = useClock();

  const {
    unternehmen, setUnternehmen,
    termine, setTermine,
    dokumente, setDokumente,
    notizen, setNotizen,
    unternehmenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedTermine = enrichTermine(termine, { unternehmenMap });
  const enrichedDokumente = enrichDokumente(dokumente, { unternehmenMap });
  const enrichedNotizen = enrichNotizen(notizen, { unternehmenMap });

  const overlay = useRecordOverlayStack<OverlayItem>();

  // Dialog state
  const [unternehmenDialogOpen, setUnternehmenDialogOpen] = useState(false);
  const [unternehmenDefaults, setUnternehmenDefaults] = useState<UnternehmenDialogDefaults | undefined>(undefined);
  const [editingUnternehmen, setEditingUnternehmen] = useState<Unternehmen | undefined>(undefined);

  const [termineDialogOpen, setTermineDialogOpen] = useState(false);
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>(undefined);
  const [editingTermine, setEditingTermine] = useState<Termine | undefined>(undefined);

  const [dokumenteDialogOpen, setDokumenteDialogOpen] = useState(false);
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>(undefined);
  const [editingDokumente, setEditingDokumente] = useState<Dokumente | undefined>(undefined);

  const [notizenDialogOpen, setNotizenDialogOpen] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>(undefined);
  const [editingNotizen, setEditingNotizen] = useState<Notizen | undefined>(undefined);

  // KPI derivations
  const today = format(clock, 'yyyy-MM-dd');
  const sevenDaysLater = format(addDays(clock, 7), 'yyyy-MM-dd');

  const aktiveUnternehmen = useMemo(
    () => unternehmen.filter(u => u.fields.status?.key === 'aktiv'),
    [unternehmen]
  );

  const gesamtInvestiert = useMemo(
    () => aktiveUnternehmen.reduce((sum, u) => sum + (u.fields.investiertes_kapital ?? 0), 0),
    [aktiveUnternehmen]
  );

  const gesamtWert = useMemo(
    () => aktiveUnternehmen.reduce((sum, u) => sum + (u.fields.aktueller_wert ?? 0), 0),
    [aktiveUnternehmen]
  );

  const upcomingTermine = useMemo(
    () => enrichedTermine
      .filter(t => t.fields.datum_uhrzeit && t.fields.datum_uhrzeit >= today && t.fields.terminstatus?.key !== 'abgesagt')
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedTermine, today]
  );

  const overdueTermine = useMemo(
    () => enrichedTermine.filter(
      t => t.fields.datum_uhrzeit && t.fields.datum_uhrzeit < today && t.fields.terminstatus?.key === 'geplant'
    ),
    [enrichedTermine, today]
  );

  const naechsteWocheTermine = useMemo(
    () => upcomingTermine.filter(t => t.fields.datum_uhrzeit && t.fields.datum_uhrzeit <= sevenDaysLater),
    [upcomingTermine, sevenDaysLater]
  );

  // Calendar events
  const calendarEvents = useMemo<CalendarEvent[]>(
    () => enrichedTermine.map(t => {
      const isOverdue = t.fields.datum_uhrzeit && t.fields.datum_uhrzeit < today && t.fields.terminstatus?.key === 'geplant';
      const isAbgesagt = t.fields.terminstatus?.key === 'abgesagt';
      const isStattgefunden = t.fields.terminstatus?.key === 'stattgefunden';
      return {
        id: t.record_id,
        start: t.fields.datum_uhrzeit ?? today,
        title: t.fields.terminbezeichnung ?? 'Termin',
        subtitle: t.unternehmenName || t.fields.terminart?.label,
        tone: isOverdue ? 'destructive' : isAbgesagt ? 'default' : isStattgefunden ? 'success' : 'primary',
      };
    }),
    [enrichedTermine, today]
  );

  // Advance termin status (Geplant → Stattgefunden)
  const advanceTermin = useCallback(async (t: EnrichedTermine) => {
    const snapshot = [...termine];
    setTermine(prev => prev.map(x =>
      x.record_id === t.record_id
        ? { ...x, fields: { ...x.fields, terminstatus: { key: 'stattgefunden', label: 'Stattgefunden' } } }
        : x
    ));
    undoToast(`„${t.fields.terminbezeichnung}" als stattgefunden markiert.`, () => {
      setTermine(snapshot);
      LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: 'geplant' }).catch(() => fetchAll());
    });
    LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: 'stattgefunden' }).catch(() => {
      setTermine(snapshot);
      fetchAll();
    });
  }, [termine, setTermine, fetchAll]);

  // Open termin create prefilled with a date
  const openTerminCreate = useCallback((datum?: string, unternehmenId?: string) => {
    setEditingTermine(undefined);
    setTermineDefaults({
      ...(datum ? { datum_uhrzeit: datum } : {}),
      ...(unternehmenId ? { unternehmen: unternehmenId } : {}),
    });
    setTermineDialogOpen(true);
  }, []);

  // Open overlays
  const openUnternehmenOverlay = useCallback((u: Unternehmen) => {
    overlay.replace({ type: 'unternehmen', record: u });
  }, [overlay]);

  // Calendar event drop
  const handleEventDrop = useCallback(async (eventId: string, newStart: string) => {
    const t = termine.find(x => x.record_id === eventId);
    if (!t) return;
    const snapshot = [...termine];
    setTermine(prev => prev.map(x =>
      x.record_id === eventId ? { ...x, fields: { ...x.fields, datum_uhrzeit: newStart } } : x
    ));
    undoToast(`Termin verschoben auf ${formatDateTime(newStart)}.`, () => {
      setTermine(snapshot);
      LivingAppsService.updateTermineEntry(eventId, { datum_uhrzeit: t.fields.datum_uhrzeit }).catch(() => fetchAll());
    });
    LivingAppsService.updateTermineEntry(eventId, { datum_uhrzeit: newStart }).catch(() => {
      setTermine(snapshot);
      fetchAll();
    });
  }, [termine, setTermine, fetchAll]);

  // ─── Early returns AFTER all hooks ───
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;
  // ─── Plain derivations only below ───

  const naechsterTermin = upcomingTermine[0];
  const naechsterTerminName = naechsterTermin
    ? `${naechsterTermin.unternehmenName || naechsterTermin.fields.terminbezeichnung} — ${formatDateTime(naechsterTermin.fields.datum_uhrzeit)}`
    : undefined;

  const contextLine = unternehmen.length === 0
    ? 'Noch keine Beteiligungen erfasst. Lege dein erstes Portfolio-Unternehmen an.'
    : overdueTermine.length > 0
    ? `${namen(overdueTermine.map(t => t.unternehmenName || t.fields.terminbezeichnung || ''))} ${overdueTermine.length === 1 ? 'hat' : 'haben'} einen überfälligen Termin.`
    : naechsterTermin
    ? `Nächster Termin: ${naechsterTerminName}.`
    : `${aktiveUnternehmen.length} aktive ${aktiveUnternehmen.length === 1 ? 'Beteiligung' : 'Beteiligungen'} im Portfolio.`;

  return (
    <>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)} Beteiligungsmanager</h1>
          <p className="text-muted-foreground mt-1 text-sm truncate">{contextLine}</p>
        </div>
        <button
          onClick={() => { setEditingUnternehmen(undefined); setUnternehmenDefaults(undefined); setUnternehmenDialogOpen(true); }}
          className="flex items-center gap-2 shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <IconPlus size={16} className="shrink-0" />
          <span className="hidden sm:inline">Unternehmen</span>
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={overdueTermine.length > 0 && (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: 'Als stattgefunden markieren',
              onClick: () => advanceTermin(overdueTermine[0] as EnrichedTermine),
            }}
          >
            <b>{namen(overdueTermine.map(t => t.unternehmenName || t.fields.terminbezeichnung || ''))}</b>
            {' '}
            {overdueTermine.length === 1 ? 'hat einen überfälligen Termin' : `haben ${overdueTermine.length} überfällige Termine`}
            {' — '}
            zuletzt geplant am {formatDateTime(overdueTermine[0].fields.datum_uhrzeit)}.
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title="Aktive Beteiligungen"
              value={aktiveUnternehmen.length}
              icon={<IconBuilding size={16} className="shrink-0" />}
              tone={aktiveUnternehmen.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Investiert"
              value={gesamtInvestiert > 0 ? formatCurrency(gesamtInvestiert) : '—'}
              icon={<IconBriefcase size={16} className="shrink-0" />}
            />
            <StatStripItem
              title="Portfolio-Wert"
              value={gesamtWert > 0 ? formatCurrency(gesamtWert) : '—'}
              icon={<IconChartBar size={16} className="shrink-0" />}
              tone={gesamtWert > gesamtInvestiert ? 'success' : gesamtWert > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title="Termine diese Woche"
              value={naechsteWocheTermine.length}
              icon={<IconCalendar size={16} className="shrink-0" />}
              tone={naechsteWocheTermine.length > 0 ? 'primary' : 'default'}
            />
          </StatStrip>
        }
        primary={
          unternehmen.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 flex flex-col items-center justify-center gap-4 text-center">
              <IconBuilding size={48} className="text-muted-foreground" stroke={1.5} />
              <div>
                <p className="font-semibold text-foreground">Noch keine Beteiligungen</p>
                <p className="text-sm text-muted-foreground mt-1">Erfasse dein erstes Portfolio-Unternehmen, um loszulegen.</p>
              </div>
              <button
                onClick={() => { setEditingUnternehmen(undefined); setUnternehmenDefaults(undefined); setUnternehmenDialogOpen(true); }}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <IconPlus size={16} />
                Erstes Unternehmen anlegen
              </button>
            </div>
          ) : (
            <CalendarWidget
              events={calendarEvents}
              locale={de}
              defaultView="week"
              onEventClick={ev => {
                const t = termine.find(x => x.record_id === ev.id);
                if (t) overlay.replace({ type: 'termin', record: t });
              }}
              onEmptyClick={date => {
                const datum = format(date, "yyyy-MM-dd'T'HH:mm");
                openTerminCreate(datum);
              }}
              onEventDrop={handleEventDrop}
            />
          )
        }
        aside={
          <>
            {/* Portfolio-Unternehmen */}
            <WorkList
              title="Portfolio"
              max={6}
              items={unternehmen
                .sort((a, b) => {
                  // Aktiv first, then alphabetical
                  const aAktiv = a.fields.status?.key === 'aktiv' ? 0 : 1;
                  const bAktiv = b.fields.status?.key === 'aktiv' ? 0 : 1;
                  if (aAktiv !== bAktiv) return aAktiv - bAktiv;
                  return (a.fields.name ?? '').localeCompare(b.fields.name ?? '');
                })
                .map(u => {
                  const termineCount = termine.filter(t => extractRecordId(t.fields.unternehmen) === u.record_id).length;
                  const docsCount = dokumente.filter(d => extractRecordId(d.fields.unternehmen) === u.record_id).length;
                  const statusKey = u.fields.status?.key;
                  return {
                    id: u.record_id,
                    title: u.fields.name ?? '—',
                    secondLine: (
                      <>
                        <span className={
                          statusKey === 'aktiv' ? 'font-medium text-success' :
                          statusKey === 'exit' ? 'font-medium text-muted-foreground' :
                          'font-medium text-warning'
                        }>
                          {u.fields.status?.label ?? '—'}
                        </span>
                        <span className="text-muted-foreground"> · {termineCount}T {docsCount}D</span>
                        {u.fields.branche && <span className="text-muted-foreground"> · {u.fields.branche.label}</span>}
                      </>
                    ),
                    action: {
                      label: '+ Termin',
                      onClick: () => openTerminCreate(undefined, u.record_id),
                    },
                  };
                })}
              onItemClick={id => {
                const u = unternehmen.find(x => x.record_id === id);
                if (u) openUnternehmenOverlay(u);
              }}
              empty={{
                text: 'Noch kein Unternehmen erfasst.',
                action: {
                  label: 'Unternehmen anlegen',
                  onClick: () => { setEditingUnternehmen(undefined); setUnternehmenDefaults(undefined); setUnternehmenDialogOpen(true); },
                },
              }}
            />

            {/* Anstehende Termine */}
            <WorkList
              title="Anstehende Termine"
              max={5}
              items={upcomingTermine.map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? 'Termin',
                secondLine: (
                  <>
                    <span className="font-medium text-primary">{t.unternehmenName}</span>
                    <span className="text-muted-foreground"> · {formatDateTime(t.fields.datum_uhrzeit)}</span>
                  </>
                ),
                action: t.fields.terminstatus?.key === 'geplant'
                  ? { label: '✓ Erledigt', onClick: () => advanceTermin(t) }
                  : undefined,
              }))}
              onItemClick={id => {
                const t = termine.find(x => x.record_id === id);
                if (t) overlay.replace({ type: 'termin', record: t });
              }}
              empty={{
                text: naechsterTermin
                  ? `Nächster: ${naechsterTerminName}`
                  : 'Keine anstehenden Termine.',
                action: {
                  label: 'Termin planen',
                  onClick: () => openTerminCreate(),
                },
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
            const u = top.record;
            return (
              <>
                <RecordHeader
                  title={u.fields.name ?? '—'}
                  subtitle={[u.fields.branche?.label, u.fields.stadt, u.fields.land].filter(Boolean).join(' · ')}
                  badges={
                    u.fields.status && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        u.fields.status.key === 'aktiv' ? 'bg-success/10 text-success' :
                        u.fields.status.key === 'exit' ? 'bg-muted text-muted-foreground' :
                        'bg-warning/10 text-warning'
                      }`}>
                        {u.fields.status.label}
                      </span>
                    )
                  }
                  meta={
                    gesamtWert > 0 ? (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <IconTrendingUp size={14} className="shrink-0" />
                        Wert: {formatCurrency(u.fields.aktueller_wert ?? 0)}
                      </span>
                    ) : undefined
                  }
                  actions={
                    <button
                      onClick={() => { setEditingUnternehmen(u); setUnternehmenDefaults(u.fields as UnternehmenDialogDefaults); setUnternehmenDialogOpen(true); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <UnternehmenDetails
                  record={u}
                  termineList={termine}
                  onOpenTermine={t => overlay.push({ type: 'termin', record: t })}
                  onAddTermine={() => {
                    openTerminCreate(undefined, u.record_id);
                  }}
                  dokumenteList={dokumente}
                  onOpenDokumente={d => overlay.push({ type: 'dokument', record: d })}
                  onAddDokumente={() => {
                    setEditingDokumente(undefined);
                    setDokumenteDefaults({ unternehmen: u.record_id });
                    setDokumenteDialogOpen(true);
                  }}
                  notizenList={notizen}
                  onOpenNotizen={n => overlay.push({ type: 'notiz', record: n })}
                  onAddNotizen={() => {
                    setEditingNotizen(undefined);
                    setNotizenDefaults({ unternehmen: u.record_id });
                    setNotizenDialogOpen(true);
                  }}
                />
              </>
            );
          }
          if (top.type === 'termin') {
            const t = top.record;
            return (
              <>
                <RecordHeader
                  title={t.fields.terminbezeichnung ?? 'Termin'}
                  subtitle={[t.fields.terminart?.label, t.fields.ort].filter(Boolean).join(' · ')}
                  actions={
                    <button
                      onClick={() => { setEditingTermine(t); setTermineDefaults(t.fields as TermineDialogDefaults); setTermineDialogOpen(true); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <TermineDetails
                  record={t}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u => overlay.push({ type: 'unternehmen', record: u })}
                />
              </>
            );
          }
          if (top.type === 'dokument') {
            const d = top.record;
            return (
              <>
                <RecordHeader
                  title={d.fields.dokumentenbezeichnung ?? 'Dokument'}
                  subtitle={[d.fields.dokumententyp?.label, d.fields.dokumentendatum ? formatDate(d.fields.dokumentendatum) : undefined].filter(Boolean).join(' · ')}
                  actions={
                    <button
                      onClick={() => { setEditingDokumente(d); setDokumenteDefaults(d.fields as DokumenteDialogDefaults); setDokumenteDialogOpen(true); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <DokumenteDetails
                  record={d}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u => overlay.push({ type: 'unternehmen', record: u })}
                />
              </>
            );
          }
          if (top.type === 'notiz') {
            const n = top.record;
            return (
              <>
                <RecordHeader
                  title={n.fields.notiz_titel ?? 'Notiz'}
                  subtitle={[n.fields.kategorie?.label, n.fields.prioritaet?.label].filter(Boolean).join(' · ')}
                  actions={
                    <button
                      onClick={() => { setEditingNotizen(n); setNotizenDefaults(n.fields as NotizenDialogDefaults); setNotizenDialogOpen(true); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <NotizenDetails
                  record={n}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u => overlay.push({ type: 'unternehmen', record: u })}
                />
              </>
            );
          }
          return null;
        }}
        footer={top => {
          if (top.type === 'termin') {
            const t = top.record;
            if (t.fields.terminstatus?.key === 'geplant') {
              const enriched = enrichedTermine.find(x => x.record_id === t.record_id);
              if (enriched) {
                return { label: '✓ Als stattgefunden markieren', onClick: () => { advanceTermin(enriched); overlay.close(); } };
              }
            }
          }
          return undefined;
        }}
      />

      {/* Dialogs */}
      <UnternehmenDialog
        open={unternehmenDialogOpen}
        onClose={() => { setUnternehmenDialogOpen(false); setEditingUnternehmen(undefined); }}
        onSubmit={async fields => {
          if (editingUnternehmen) {
            await LivingAppsService.updateUnternehmenEntry(editingUnternehmen.record_id, fields);
          } else {
            await LivingAppsService.createUnternehmenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={unternehmenDefaults}
        recordId={editingUnternehmen?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
      />

      <TermineDialog
        open={termineDialogOpen}
        onClose={() => { setTermineDialogOpen(false); setEditingTermine(undefined); }}
        onSubmit={async fields => {
          if (editingTermine) {
            await LivingAppsService.updateTermineEntry(editingTermine.record_id, fields);
          } else {
            await LivingAppsService.createTermineEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={termineDefaults}
        recordId={editingTermine?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Termine']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Termine']}
      />

      <DokumenteDialog
        open={dokumenteDialogOpen}
        onClose={() => { setDokumenteDialogOpen(false); setEditingDokumente(undefined); }}
        onSubmit={async fields => {
          if (editingDokumente) {
            await LivingAppsService.updateDokumenteEntry(editingDokumente.record_id, fields);
          } else {
            await LivingAppsService.createDokumenteEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={dokumenteDefaults}
        recordId={editingDokumente?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Dokumente']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Dokumente']}
      />

      <NotizenDialog
        open={notizenDialogOpen}
        onClose={() => { setNotizenDialogOpen(false); setEditingNotizen(undefined); }}
        onSubmit={async fields => {
          if (editingNotizen) {
            await LivingAppsService.updateNotizenEntry(editingNotizen.record_id, fields);
          } else {
            await LivingAppsService.createNotizenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={notizenDefaults}
        recordId={editingNotizen?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />
    </>
  );
}
