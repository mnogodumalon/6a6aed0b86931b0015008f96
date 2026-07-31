import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isBefore, addDays } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine, enrichDokumente, enrichNotizen } from '@/lib/enrich';
import type { EnrichedTermine } from '@/types/enriched';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatCard, StatCardRow, StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { SatelliteSection } from '@/components/SatelliteSection';
import {
  useRecordOverlayStack,
  RecordOverlayHost,
  RecordHeader,
  RecordAttachments,
} from '@/components/widgets/RecordView';
import { TermineDetails } from '@/components/details/TermineDetails';
import { DokumenteDetails } from '@/components/details/DokumenteDetails';
import { NotizenDetails } from '@/components/details/NotizenDetails';
import { UnternehmenDialog } from '@/components/dialogs/UnternehmenDialog';
import { TermineDialog } from '@/components/dialogs/TermineDialog';
import { DokumenteDialog } from '@/components/dialogs/DokumenteDialog';
import { NotizenDialog } from '@/components/dialogs/NotizenDialog';
import type { UnternehmenDialogDefaults } from '@/components/dialogs/UnternehmenDialog';
import type { TermineDialogDefaults } from '@/components/dialogs/TermineDialog';
import type { DokumenteDialogDefaults } from '@/components/dialogs/DokumenteDialog';
import type { NotizenDialogDefaults } from '@/components/dialogs/NotizenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import {
  CalendarWidget,
  CalendarSkeleton,
  CalendarError,
  useCalendar,
  type CalendarEvent,
} from '@/components/widgets/CalendarWidget';
import {
  IconBuilding,
  IconCalendar,
  IconFileText,
  IconNotes,
  IconPlus,
  IconTrendingUp,
  IconAlertTriangle,
  IconCheck,
  IconBriefcase,
} from '@tabler/icons-react';

// ─── Overlay stack item types ────────────────────────────────────────────────
type OverlayItem =
  | { type: 'unternehmen'; record: Unternehmen }
  | { type: 'termin'; record: Termine }
  | { type: 'dokument'; record: Dokumente }
  | { type: 'notiz'; record: Notizen };

export default function DashboardOverview() {
  const {
    unternehmen, setUnternehmen,
    termine, setTermine,
    dokumente,
    notizen,
    unternehmenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const clock = useClock();

  const enrichedTermine = enrichTermine(termine, { unternehmenMap });
  const enrichedDokumente = enrichDokumente(dokumente, { unternehmenMap });
  const enrichedNotizen = enrichNotizen(notizen, { unternehmenMap });

  const cal = useCalendar({ initialView: 'week' });
  const overlay = useRecordOverlayStack<OverlayItem>();

  // ─── Dialog state ─────────────────────────────────────────────────────────
  const [unternehmenDialog, setUnternehmenDialog] = useState(false);
  const [editingUnternehmen, setEditingUnternehmen] = useState<UnternehmenDialogDefaults | undefined>();
  const [editingUnternehmenId, setEditingUnternehmenId] = useState<string | undefined>();

  const [termineDialog, setTermineDialog] = useState(false);
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>();
  const [editingTermineId, setEditingTermineId] = useState<string | undefined>();

  const [dokumenteDialog, setDokumenteDialog] = useState(false);
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>();
  const [editingDokumenteId, setEditingDokumenteId] = useState<string | undefined>();

  const [notizenDialog, setNotizenDialog] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>();
  const [editingNotizenId, setEditingNotizenId] = useState<string | undefined>();

  // ─── Filters ──────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // ─── Derived KPIs ─────────────────────────────────────────────────────────
  const today = format(clock, 'yyyy-MM-dd');
  const todayPlus7 = format(addDays(clock, 7), 'yyyy-MM-dd');

  const aktive = useMemo(() => unternehmen.filter(u => u.fields.status?.key === 'aktiv'), [unternehmen]);
  const inaktive = useMemo(() => unternehmen.filter(u => u.fields.status?.key === 'inaktiv'), [unternehmen]);
  const exits = useMemo(() => unternehmen.filter(u => u.fields.status?.key === 'exit'), [unternehmen]);

  const gesamtKapital = useMemo(() => aktive.reduce((s, u) => s + (u.fields.investiertes_kapital ?? 0), 0), [aktive]);
  const gesamtWert = useMemo(() => aktive.reduce((s, u) => s + (u.fields.aktueller_wert ?? 0), 0), [aktive]);

  const anstehendeTermine = useMemo(() =>
    enrichedTermine.filter(t =>
      t.fields.datum_uhrzeit &&
      t.fields.datum_uhrzeit >= today &&
      t.fields.datum_uhrzeit <= todayPlus7 &&
      t.fields.terminstatus?.key !== 'abgesagt'
    ).sort((a, b) => (a.fields.datum_uhrzeit ?? '') < (b.fields.datum_uhrzeit ?? '') ? -1 : 1),
    [enrichedTermine, today, todayPlus7]
  );

  const nextTermin = useMemo(() =>
    enrichedTermine
      .filter(t => t.fields.datum_uhrzeit && t.fields.datum_uhrzeit >= today && t.fields.terminstatus?.key !== 'abgesagt')
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '') < (b.fields.datum_uhrzeit ?? '') ? -1 : 1)[0],
    [enrichedTermine, today]
  );

  // ─── Calendar events ──────────────────────────────────────────────────────
  const calendarEvents = useMemo((): CalendarEvent[] =>
    enrichedTermine.flatMap(t => {
      if (!t.fields.datum_uhrzeit) return [];
      const terminartKey = t.fields.terminart?.key;
      const tone =
        terminartKey === 'gremiensitzung' || terminartKey === 'gesellschafterversammlung' ? 'primary' :
        terminartKey === 'beiratssitzung' || terminartKey === 'strategiemeeting' ? 'warning' :
        terminartKey === 'jahresabschluss' ? 'destructive' : 'default';
      return [{
        id: `termin:${t.record_id}`,
        start: t.fields.datum_uhrzeit,
        end: t.fields.datum_uhrzeit,
        title: t.fields.terminbezeichnung ?? 'Termin',
        subtitle: t.unternehmenName || t.fields.ort,
        tone,
      }];
    }),
    [enrichedTermine]
  );

  // ─── Filtered portfolio cards ─────────────────────────────────────────────
  const filteredUnternehmen = useMemo(() =>
    statusFilter ? unternehmen.filter(u => u.fields.status?.key === statusFilter) : unternehmen,
    [unternehmen, statusFilter]
  );

  // ─── Dialog openers with context pre-fill ────────────────────────────────
  const openTermineForUnternehmen = useCallback((u: Unternehmen) => {
    setTermineDefaults({ unternehmen: u.record_id });
    setEditingTermineId(undefined);
    setTermineDialog(true);
  }, []);

  const openDokumenteForUnternehmen = useCallback((u: Unternehmen) => {
    setDokumenteDefaults({ unternehmen: u.record_id });
    setEditingDokumenteId(undefined);
    setDokumenteDialog(true);
  }, []);

  const openNotizenForUnternehmen = useCallback((u: Unternehmen) => {
    setNotizenDefaults({ unternehmen: u.record_id });
    setEditingNotizenId(undefined);
    setNotizenDialog(true);
  }, []);

  // ─── Calendar drag write ──────────────────────────────────────────────────
  const handleEventDrop = useCallback(async (eventId: string, newStart: string, _newEnd?: string) => {
    const id = eventId.split(':')[1] ?? '';
    if (!id) return;
    const termin = termine.find(t => t.record_id === id);
    if (!termin) return;
    const prevDate = termin.fields.datum_uhrzeit;
    const newDate = newStart.slice(0, 16);
    // Optimistic update
    setTermine(prev => prev.map(t => t.record_id === id ? { ...t, fields: { ...t.fields, datum_uhrzeit: newDate } } : t));
    undoToast(`Termin verschoben auf ${formatDateTime(newDate)}`, () => {
      setTermine(prev => prev.map(t => t.record_id === id ? { ...t, fields: { ...t.fields, datum_uhrzeit: prevDate } } : t));
      LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: prevDate }).catch(() => fetchAll());
    });
    LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: newDate }).catch(() => fetchAll());
  }, [termine, setTermine, fetchAll]);

  // ─── Context line ─────────────────────────────────────────────────────────
  const contextLine = useMemo(() => {
    if (unternehmen.length === 0) return 'Starte dein Portfolio — lege dein erstes Beteiligungsunternehmen an.';
    const aktivNamen = namen(aktive.map(u => u.fields.name ?? ''));
    if (anstehendeTermine.length > 0) {
      const nextName = nextTermin?.fields.terminbezeichnung ?? '';
      const nextFirma = nextTermin?.unternehmenName ?? '';
      return `${aktive.length} aktive Beteiligung${aktive.length !== 1 ? 'en' : ''}: ${aktivNamen}. Nächster Termin: ${nextName}${nextFirma ? ` bei ${nextFirma}` : ''}.`;
    }
    return `${aktive.length} aktive Beteiligung${aktive.length !== 1 ? 'en' : ''}: ${aktivNamen}.`;
  }, [unternehmen.length, aktive, anstehendeTermine, nextTermin]);

  // ─── Every hook goes ABOVE this line ─────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;
  // ─── Below this line: plain derivations only, no hooks. ──────────────────

  const termineSoonAlert = anstehendeTermine.length > 0 && anstehendeTermine[0].fields.datum_uhrzeit
    ? isBefore(parseISO(anstehendeTermine[0].fields.datum_uhrzeit), addDays(clock, 2))
    : false;

  const statusOptions = LOOKUP_OPTIONS['unternehmen']?.status ?? [];

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {gruss(clock)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <button
          onClick={() => { setEditingUnternehmen(undefined); setEditingUnternehmenId(undefined); setUnternehmenDialog(true); }}
          className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <IconPlus size={16} className="shrink-0" />
          Unternehmen
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          termineSoonAlert && anstehendeTermine[0] ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: 'Als stattgefunden markieren',
                onClick: async () => {
                  const t = anstehendeTermine[0];
                  const prev = t.fields.terminstatus;
                  setTermine(prev2 => prev2.map(r => r.record_id === t.record_id
                    ? { ...r, fields: { ...r.fields, terminstatus: { key: 'stattgefunden', label: 'Stattgefunden' } } }
                    : r
                  ));
                  undoToast('Termin als stattgefunden markiert', () => {
                    setTermine(prev2 => prev2.map(r => r.record_id === t.record_id
                      ? { ...r, fields: { ...r.fields, terminstatus: prev } }
                      : r
                    ));
                    LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: prev?.key }).catch(() => fetchAll());
                  });
                  await LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: 'stattgefunden' }).catch(() => fetchAll());
                },
              }}
            >
              <b>{anstehendeTermine[0].fields.terminbezeichnung}</b>
              {anstehendeTermine[0].unternehmenName ? ` bei ${anstehendeTermine[0].unternehmenName}` : ''} — {formatDateTime(anstehendeTermine[0].fields.datum_uhrzeit)}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title="Aktive Beteiligungen"
              value={aktive.length}
              icon={<IconBuilding size={16} className="shrink-0" />}
              tone={aktive.length > 0 ? 'success' : 'default'}
              onClick={() => setStatusFilter(f => f === 'aktiv' ? null : 'aktiv')}
              active={statusFilter === 'aktiv'}
            />
            <StatStripItem
              title="Investiertes Kapital"
              value={gesamtKapital > 0 ? formatCurrency(gesamtKapital) : '—'}
              icon={<IconBriefcase size={16} className="shrink-0" />}
              tone="default"
            />
            <StatStripItem
              title="Portfoliowert"
              value={gesamtWert > 0 ? formatCurrency(gesamtWert) : '—'}
              icon={<IconTrendingUp size={16} className="shrink-0" />}
              tone={gesamtWert > gesamtKapital && gesamtKapital > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title="Termine (7 Tage)"
              value={anstehendeTermine.length}
              icon={<IconCalendar size={16} className="shrink-0" />}
              tone={anstehendeTermine.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Inaktiv / Exit"
              value={inaktive.length + exits.length}
              icon={<IconCheck size={16} className="shrink-0" />}
              tone="default"
              onClick={() => setStatusFilter(f => f === 'inaktiv' ? null : 'inaktiv')}
              active={statusFilter === 'inaktiv'}
            />
          </StatStrip>
        }
        primary={
          <div className="space-y-6">
            {/* Portfolio-Karten */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Portfolio</h2>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setStatusFilter(null)}
                    className={`text-xs px-2 py-1 rounded-md border transition-colors ${!statusFilter ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                  >
                    Alle ({unternehmen.length})
                  </button>
                  {statusOptions.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setStatusFilter(f => f === opt.key ? null : opt.key)}
                      className={`text-xs px-2 py-1 rounded-md border transition-colors ${statusFilter === opt.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                    >
                      {opt.label} ({unternehmen.filter(u => u.fields.status?.key === opt.key).length})
                    </button>
                  ))}
                </div>
              </div>
              {filteredUnternehmen.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
                  <IconBuilding size={48} className="text-muted-foreground" stroke={1.5} />
                  <div>
                    <p className="font-medium text-foreground">Noch keine Beteiligungen</p>
                    <p className="text-sm text-muted-foreground mt-1">Lege dein erstes Beteiligungsunternehmen an</p>
                  </div>
                  <button
                    onClick={() => { setEditingUnternehmen(undefined); setEditingUnternehmenId(undefined); setUnternehmenDialog(true); }}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <IconPlus size={16} />
                    Erstes Unternehmen anlegen
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredUnternehmen.map(u => {
                    const termineCount = termine.filter(t => extractRecordId(t.fields.unternehmen) === u.record_id).length;
                    const docsCount = dokumente.filter(d => extractRecordId(d.fields.unternehmen) === u.record_id).length;
                    const notizCount = notizen.filter(n => extractRecordId(n.fields.unternehmen) === u.record_id).length;
                    const statusKey = u.fields.status?.key;
                    const statusColor =
                      statusKey === 'aktiv' ? 'bg-success/10 text-success' :
                      statusKey === 'inaktiv' ? 'bg-muted text-muted-foreground' :
                      'bg-warning/10 text-warning';
                    const wertVsKapital = u.fields.aktueller_wert && u.fields.investiertes_kapital
                      ? ((u.fields.aktueller_wert - u.fields.investiertes_kapital) / u.fields.investiertes_kapital * 100)
                      : null;
                    return (
                      <button
                        key={u.record_id}
                        onClick={() => overlay.replace({ type: 'unternehmen', record: u })}
                        className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate">{u.fields.name ?? 'Unbekannt'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {[u.fields.branche?.label, u.fields.rechtsform?.label].filter(Boolean).join(' · ') || 'Keine Branche'}
                            </p>
                          </div>
                          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                            {u.fields.status?.label ?? '—'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {u.fields.investiertes_kapital != null && (
                            <div>
                              <span className="text-muted-foreground">Investiert</span>
                              <p className="font-medium text-foreground">{formatCurrency(u.fields.investiertes_kapital)}</p>
                            </div>
                          )}
                          {u.fields.aktueller_wert != null && (
                            <div>
                              <span className="text-muted-foreground">Aktueller Wert</span>
                              <p className={`font-medium ${wertVsKapital != null && wertVsKapital > 0 ? 'text-success' : wertVsKapital != null && wertVsKapital < 0 ? 'text-destructive' : 'text-foreground'}`}>
                                {formatCurrency(u.fields.aktueller_wert)}
                                {wertVsKapital != null && (
                                  <span className="ml-1 text-[10px]">({wertVsKapital > 0 ? '+' : ''}{wertVsKapital.toFixed(1)}%)</span>
                                )}
                              </p>
                            </div>
                          )}
                          {u.fields.beteiligungsquote != null && (
                            <div>
                              <span className="text-muted-foreground">Quote</span>
                              <p className="font-medium text-foreground">{u.fields.beteiligungsquote}%</p>
                            </div>
                          )}
                          {u.fields.stadt && (
                            <div>
                              <span className="text-muted-foreground">Standort</span>
                              <p className="font-medium text-foreground truncate">{u.fields.stadt}{u.fields.land ? `, ${u.fields.land}` : ''}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 border-t border-border pt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <IconCalendar size={12} className="shrink-0" />
                            {termineCount} Termin{termineCount !== 1 ? 'e' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <IconFileText size={12} className="shrink-0" />
                            {docsCount} Dok.
                          </span>
                          <span className="flex items-center gap-1">
                            <IconNotes size={12} className="shrink-0" />
                            {notizCount} Notiz{notizCount !== 1 ? 'en' : ''}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Terminkalender */}
            <div>
              <CalendarWidget
                {...cal}
                events={calendarEvents}
                onEmptyClick={(date) => {
                  setTermineDefaults({ datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm") });
                  setEditingTermineId(undefined);
                  setTermineDialog(true);
                }}
                onEventClick={(ev) => {
                  const id = ev.id.split(':')[1] ?? '';
                  const t = termine.find(r => r.record_id === id);
                  if (t) overlay.push({ type: 'termin', record: t });
                }}
                onEventDrop={handleEventDrop}
              />
            </div>
          </div>
        }
        aside={
          <>
            <WorkList
              title="Anstehende Termine"
              items={anstehendeTermine.slice(0, 8).map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? 'Termin',
                secondLine: (
                  <>
                    <span className="text-muted-foreground">{t.unternehmenName}</span>
                    {t.fields.datum_uhrzeit && (
                      <span className="text-muted-foreground"> · {formatDateTime(t.fields.datum_uhrzeit)}</span>
                    )}
                  </>
                ),
                action: {
                  label: '✓ Stattgefunden',
                  onClick: () => {
                    const prev = t.fields.terminstatus;
                    setTermine(prev2 => prev2.map(r => r.record_id === t.record_id
                      ? { ...r, fields: { ...r.fields, terminstatus: { key: 'stattgefunden', label: 'Stattgefunden' } } }
                      : r
                    ));
                    undoToast('Termin abgeschlossen', () => {
                      setTermine(prev2 => prev2.map(r => r.record_id === t.record_id
                        ? { ...r, fields: { ...r.fields, terminstatus: prev } }
                        : r
                      ));
                      LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: prev?.key }).catch(() => fetchAll());
                    });
                    LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: 'stattgefunden' }).catch(() => fetchAll());
                  },
                },
              }))}
              onItemClick={(id) => {
                const t = termine.find(r => r.record_id === id);
                if (t) overlay.push({ type: 'termin', record: t });
              }}
              empty={{
                text: nextTermin
                  ? `Nächster Termin: ${nextTermin.fields.terminbezeichnung} bei ${nextTermin.unternehmenName}`
                  : 'Keine Termine in den nächsten 7 Tagen',
                action: {
                  label: 'Termin anlegen',
                  onClick: () => { setTermineDefaults(undefined); setEditingTermineId(undefined); setTermineDialog(true); },
                },
              }}
            />
            <WorkList
              title="Zuletzt hinzugefügt"
              items={[...unternehmen]
                .sort((a, b) => (b.createdat ?? '').localeCompare(a.createdat ?? ''))
                .slice(0, 5)
                .map(u => {
                  const statusKey = u.fields.status?.key;
                  const statusColor =
                    statusKey === 'aktiv' ? 'text-success' :
                    statusKey === 'inaktiv' ? 'text-muted-foreground' :
                    'text-warning';
                  return {
                    id: u.record_id,
                    title: u.fields.name ?? 'Unbekannt',
                    secondLine: (
                      <>
                        <span className={`font-medium ${statusColor}`}>{u.fields.status?.label ?? '—'}</span>
                        {u.fields.branche?.label && (
                          <span className="text-muted-foreground"> · {u.fields.branche.label}</span>
                        )}
                      </>
                    ),
                    action: {
                      label: 'Bearbeiten',
                      onClick: () => {
                        setEditingUnternehmen({ ...u.fields });
                        setEditingUnternehmenId(u.record_id);
                        setUnternehmenDialog(true);
                      },
                    },
                  };
                })
              }
              onItemClick={(id) => {
                const u = unternehmen.find(r => r.record_id === id);
                if (u) overlay.replace({ type: 'unternehmen', record: u });
              }}
              empty={{
                text: 'Noch keine Beteiligungen im Portfolio',
                action: {
                  label: 'Unternehmen anlegen',
                  onClick: () => { setEditingUnternehmen(undefined); setEditingUnternehmenId(undefined); setUnternehmenDialog(true); },
                },
              }}
            />
          </>
        }
      />

      {/* ─── Overlay Stack ────────────────────────────────────────────────── */}
      <RecordOverlayHost
        overlay={overlay}
        render={(top) => {
          if (top.type === 'unternehmen') {
            const u = top.record;
            return (
              <>
                <RecordHeader
                  title={u.fields.name ?? 'Unternehmen'}
                  subtitle={[u.fields.branche?.label, u.fields.rechtsform?.label].filter(Boolean).join(' · ')}
                  badges={
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.fields.status?.key === 'aktiv' ? 'bg-success/10 text-success' :
                      u.fields.status?.key === 'inaktiv' ? 'bg-muted text-muted-foreground' :
                      'bg-warning/10 text-warning'
                    }`}>{u.fields.status?.label ?? '—'}</span>
                  }
                  actions={
                    <button
                      onClick={() => {
                        setEditingUnternehmen({ ...u.fields });
                        setEditingUnternehmenId(u.record_id);
                        setUnternehmenDialog(true);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border"
                    >
                      Bearbeiten
                    </button>
                  }
                />

                {/* Satellites — each gets its own SatelliteSection (hub-gate requires all 3) */}
                <SatelliteSection
                  title="Termine"
                  items={termine.filter(t => extractRecordId(t.fields.unternehmen) === u.record_id)}
                  getKey={t => t.record_id}
                  map={t => ({ name: t.fields.terminbezeichnung ?? 'Termin', meta: t.fields.datum_uhrzeit ? formatDateTime(t.fields.datum_uhrzeit) : undefined })}
                  onOpen={(t) => overlay.push({ type: 'termin', record: t })}
                  onAdd={() => openTermineForUnternehmen(u)}
                />
                <SatelliteSection
                  title="Dokumente"
                  items={dokumente.filter(d => extractRecordId(d.fields.unternehmen) === u.record_id)}
                  getKey={d => d.record_id}
                  map={d => ({ name: d.fields.dokumentenbezeichnung ?? 'Dokument', meta: d.fields.dokumententyp?.label })}
                  onOpen={(d) => overlay.push({ type: 'dokument', record: d })}
                  onAdd={() => openDokumenteForUnternehmen(u)}
                />
                <SatelliteSection
                  title="Notizen"
                  items={notizen.filter(n => extractRecordId(n.fields.unternehmen) === u.record_id)}
                  getKey={n => n.record_id}
                  map={n => ({ name: n.fields.notiz_titel ?? 'Notiz', meta: n.fields.kategorie?.label })}
                  onOpen={(n) => overlay.push({ type: 'notiz', record: n })}
                  onAdd={() => openNotizenForUnternehmen(u)}
                />

                <RecordAttachments appId={APP_IDS.UNTERNEHMEN} recordId={u.record_id} />
              </>
            );
          }
          if (top.type === 'termin') {
            const t = top.record;
            return (
              <>
                <RecordHeader
                  title={t.fields.terminbezeichnung ?? 'Termin'}
                  subtitle={t.fields.terminart?.label}
                  actions={
                    <button
                      onClick={() => {
                        setTermineDefaults({ ...t.fields });
                        setEditingTermineId(t.record_id);
                        setTermineDialog(true);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <TermineDetails
                  record={t}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={(u) => overlay.push({ type: 'unternehmen', record: u })}
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
                  subtitle={d.fields.dokumententyp?.label}
                  actions={
                    <button
                      onClick={() => {
                        setDokumenteDefaults({ ...d.fields });
                        setEditingDokumenteId(d.record_id);
                        setDokumenteDialog(true);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <DokumenteDetails
                  record={d}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={(u) => overlay.push({ type: 'unternehmen', record: u })}
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
                  subtitle={n.fields.kategorie?.label}
                  actions={
                    <button
                      onClick={() => {
                        setNotizenDefaults({ ...n.fields });
                        setEditingNotizenId(n.record_id);
                        setNotizenDialog(true);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <NotizenDetails
                  record={n}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={(u) => overlay.push({ type: 'unternehmen', record: u })}
                />
              </>
            );
          }
          return null;
        }}
        footer={(top) => {
          if (top.type === 'termin') {
            const t = top.record;
            const isGeplant = t.fields.terminstatus?.key === 'geplant' || !t.fields.terminstatus;
            if (!isGeplant) return undefined;
            return {
              label: '✓ Als stattgefunden markieren',
              onClick: () => {
                const prev = t.fields.terminstatus;
                setTermine(prev2 => prev2.map(r => r.record_id === t.record_id
                  ? { ...r, fields: { ...r.fields, terminstatus: { key: 'stattgefunden', label: 'Stattgefunden' } } }
                  : r
                ));
                undoToast('Termin als stattgefunden markiert', () => {
                  setTermine(prev2 => prev2.map(r => r.record_id === t.record_id
                    ? { ...r, fields: { ...r.fields, terminstatus: prev } }
                    : r
                  ));
                  LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: prev?.key }).catch(() => fetchAll());
                });
                LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: 'stattgefunden' }).catch(() => fetchAll());
                overlay.close();
              },
            };
          }
          return undefined;
        }}
      />

      {/* ─── Dialogs ────────────────────────────────────────────────────── */}
      <UnternehmenDialog
        open={unternehmenDialog}
        onClose={() => { setUnternehmenDialog(false); setEditingUnternehmen(undefined); setEditingUnternehmenId(undefined); }}
        onSubmit={async (fields) => {
          if (editingUnternehmenId) {
            await LivingAppsService.updateUnternehmenEntry(editingUnternehmenId, fields);
          } else {
            await LivingAppsService.createUnternehmenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingUnternehmen}
        recordId={editingUnternehmenId}
        enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
      />

      <TermineDialog
        open={termineDialog}
        onClose={() => { setTermineDialog(false); setTermineDefaults(undefined); setEditingTermineId(undefined); }}
        onSubmit={async (fields) => {
          if (editingTermineId) {
            await LivingAppsService.updateTermineEntry(editingTermineId, fields);
          } else {
            await LivingAppsService.createTermineEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={termineDefaults}
        recordId={editingTermineId}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Termine']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Termine']}
      />

      <DokumenteDialog
        open={dokumenteDialog}
        onClose={() => { setDokumenteDialog(false); setDokumenteDefaults(undefined); setEditingDokumenteId(undefined); }}
        onSubmit={async (fields) => {
          if (editingDokumenteId) {
            await LivingAppsService.updateDokumenteEntry(editingDokumenteId, fields);
          } else {
            await LivingAppsService.createDokumenteEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={dokumenteDefaults}
        recordId={editingDokumenteId}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Dokumente']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Dokumente']}
      />

      <NotizenDialog
        open={notizenDialog}
        onClose={() => { setNotizenDialog(false); setNotizenDefaults(undefined); setEditingNotizenId(undefined); }}
        onSubmit={async (fields) => {
          if (editingNotizenId) {
            await LivingAppsService.updateNotizenEntry(editingNotizenId, fields);
          } else {
            await LivingAppsService.createNotizenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={notizenDefaults}
        recordId={editingNotizenId}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />
    </>
  );
}
