import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns';
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
import { StatCardRow, StatCard } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { CalendarWidget } from '@/components/widgets/CalendarWidget';
import type { CalendarEvent } from '@/components/widgets/CalendarWidget';
import {
  useRecordOverlayStack,
  RecordOverlayHost,
  RecordHeader,
} from '@/components/widgets/RecordView';
import { UnternehmenDetails } from '@/components/details/UnternehmenDetails';
import { TermineDetails } from '@/components/details/TermineDetails';
import { DokumenteDetails } from '@/components/details/DokumenteDetails';
import { NotizenDetails } from '@/components/details/NotizenDetails';
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
  IconBuildingSkyscraper,
  IconPlus,
  IconCalendar,
  IconAlertTriangle,
  IconTrendingUp,
  IconFileText,
  IconNotes,
  IconChevronRight,
} from '@tabler/icons-react';

type OverlayItem =
  | { type: 'unternehmen'; record: Unternehmen }
  | { type: 'termine'; record: Termine }
  | { type: 'dokumente'; record: Dokumente }
  | { type: 'notizen'; record: Notizen };

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
  const [unternehmenDefaults, setUnternehmenDefaults] = useState<UnternehmenDialogDefaults | undefined>();
  const [editingUnternehmen, setEditingUnternehmen] = useState<Unternehmen | null>(null);

  const [termineDialogOpen, setTermineDialogOpen] = useState(false);
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>();
  const [editingTermine, setEditingTermine] = useState<Termine | null>(null);

  const [dokumenteDialogOpen, setDokumenteDialogOpen] = useState(false);
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>();
  const [editingDokumente, setEditingDokumente] = useState<Dokumente | null>(null);

  const [notizenDialogOpen, setNotizenDialogOpen] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>();
  const [editingNotizen, setEditingNotizen] = useState<Notizen | null>(null);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Derived data
  const today = format(clock, 'yyyy-MM-dd');

  const aktiveUnternehmen = useMemo(
    () => unternehmen.filter(u => u.fields.status?.key === 'aktiv'),
    [unternehmen]
  );
  const inaktiveUnternehmen = useMemo(
    () => unternehmen.filter(u => u.fields.status?.key === 'inaktiv'),
    [unternehmen]
  );

  const gesamtkapital = useMemo(
    () => aktiveUnternehmen.reduce((sum, u) => sum + (u.fields.investiertes_kapital ?? 0), 0),
    [aktiveUnternehmen]
  );

  const anstehendTermine = useMemo(
    () => enrichedTermine
      .filter(t => t.fields.datum_uhrzeit && t.fields.datum_uhrzeit >= today && t.fields.terminstatus?.key !== 'abgesagt')
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedTermine, today]
  );

  const naechsterTermin = anstehendTermine[0];

  // Überfällige Termine (vergangen + geplant)
  const ueberfaelligeTermine = useMemo(
    () => enrichedTermine.filter(t =>
      t.fields.datum_uhrzeit &&
      t.fields.datum_uhrzeit < today &&
      t.fields.terminstatus?.key === 'geplant'
    ),
    [enrichedTermine, today]
  );

  // Filtered companies
  const filteredUnternehmen = useMemo(() => {
    if (!statusFilter) return unternehmen;
    return unternehmen.filter(u => u.fields.status?.key === statusFilter);
  }, [unternehmen, statusFilter]);

  // Calendar events from Termine
  const calendarEvents = useMemo((): CalendarEvent[] =>
    termine
      .filter(t => t.fields.datum_uhrzeit)
      .map(t => {
        const toneMap: Record<string, CalendarEvent['tone']> = {
          geplant: 'primary',
          stattgefunden: 'success',
          abgesagt: 'default',
        };
        const unternehmenName = unternehmenMap.get(extractRecordId(t.fields.unternehmen) ?? '')?.fields.name ?? '';
        return {
          id: t.record_id,
          start: t.fields.datum_uhrzeit!,
          title: t.fields.terminbezeichnung ?? 'Termin',
          subtitle: unternehmenName || t.fields.terminart?.label,
          tone: toneMap[t.fields.terminstatus?.key ?? ''] ?? 'default',
        };
      }),
    [termine, unternehmenMap]
  );

  // Termin status advance helper
  const advanceTermin = useCallback(async (termin: EnrichedTermine) => {
    const prev = { ...termin };
    const newStatus = termin.fields.terminstatus?.key === 'geplant' ? 'stattgefunden' : 'geplant';
    const newLabel = newStatus === 'stattgefunden' ? 'Stattgefunden' : 'Geplant';
    setTermine(prev2 =>
      prev2.map(t => t.record_id === termin.record_id
        ? { ...t, fields: { ...t.fields, terminstatus: { key: newStatus, label: newLabel } } }
        : t
      )
    );
    LivingAppsService.updateTermineEntry(termin.record_id, { terminstatus: newStatus as any })
      .catch(() => {
        setTermine(prev2 => prev2.map(t => t.record_id === prev.record_id ? prev : t));
        fetchAll();
      });
    undoToast(
      `${termin.fields.terminbezeichnung} → ${newLabel}`,
      () => {
        setTermine(prev2 => prev2.map(t => t.record_id === prev.record_id ? prev : t));
        LivingAppsService.updateTermineEntry(prev.record_id, { terminstatus: (prev.fields.terminstatus?.key ?? 'geplant') as any }).catch(() => fetchAll());
      }
    );
  }, [setTermine, fetchAll]);

  // ─── Every hook goes ABOVE this line ───
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;
  // ─── Below this line: plain derivations only ───

  const contextLine = (() => {
    const namens = namen(aktiveUnternehmen.map(u => u.fields.name ?? ''));
    if (unternehmen.length === 0) return 'Noch keine Beteiligungen erfasst — starte jetzt.';
    if (naechsterTermin) {
      const dt = naechsterTermin.fields.datum_uhrzeit;
      const datumStr = dt ? format(parseISO(dt), 'EEE dd.MM., HH:mm', { locale: de }) : '';
      return `Portfolio: ${namens}. Nächster Termin ${datumStr} — ${naechsterTermin.fields.terminbezeichnung}.`;
    }
    return `Portfolio: ${namens}. Keine anstehenden Termine.`;
  })();

  const heroContent = ueberfaelligeTermine.length > 0 ? (
    <span>
      <b>{namen(ueberfaelligeTermine.map(t => t.fields.terminbezeichnung ?? ''))}</b>{' '}
      {ueberfaelligeTermine.length === 1 ? 'ist noch als „Geplant" offen' : 'sind noch als „Geplant" offen'} —{' '}
      bitte Status aktualisieren.
    </span>
  ) : null;

  return (
    <>
      {/* Page header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {gruss(clock)} {ueberfaelligeTermine.length === 0 && unternehmen.length > 0 ? '✓' : ''}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5 max-w-2xl">{contextLine}</p>
        </div>
        <button
          onClick={() => {
            setEditingUnternehmen(null);
            setUnternehmenDefaults(undefined);
            setUnternehmenDialogOpen(true);
          }}
          className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <IconPlus size={16} className="shrink-0" />
          Beteiligung erfassen
        </button>
      </div>

      <DashboardGrid
        variant="split"
        hero={ueberfaelligeTermine.length > 0 ? (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: `Als „Stattgefunden" markieren`,
              onClick: () => advanceTermin(ueberfaelligeTermine[0] as EnrichedTermine),
            }}
          >
            {heroContent}
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatCardRow>
            <StatCard
              title="Aktive Beteiligungen"
              value={aktiveUnternehmen.length}
              description={aktiveUnternehmen.length > 0 ? 'im Portfolio' : 'Noch keine aktiven'}
              icon={<IconBuildingSkyscraper size={18} className="text-muted-foreground" />}
              tone={aktiveUnternehmen.length > 0 ? 'success' : 'default'}
              onClick={() => setStatusFilter(f => f === 'aktiv' ? null : 'aktiv')}
              active={statusFilter === 'aktiv'}
            />
            <StatCard
              title="Inaktiv / Exit"
              value={inaktiveUnternehmen.length + unternehmen.filter(u => u.fields.status?.key === 'exit').length}
              description="beendet oder ruhend"
              icon={<IconTrendingUp size={18} className="text-muted-foreground" />}
              tone="default"
              onClick={() => setStatusFilter(f => f === 'inaktiv' ? null : 'inaktiv')}
              active={statusFilter === 'inaktiv'}
            />
            <StatCard
              title="Invest. Kapital"
              value={gesamtkapital > 0 ? formatCurrency(gesamtkapital) : '—'}
              description="aktive Beteiligungen"
              icon={<IconFileText size={18} className="text-muted-foreground" />}
              tone="default"
            />
            <StatCard
              title="Anstehende Termine"
              value={anstehendTermine.length}
              description={anstehendTermine.length > 0 ? 'in Zukunft geplant' : 'Alles erledigt'}
              icon={<IconCalendar size={18} className="text-muted-foreground" />}
              tone={anstehendTermine.length > 0 ? 'primary' : 'default'}
            />
          </StatCardRow>
        }
        aside={
          <>
            {/* Unternehmen Cockpit */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/40">
                <h2 className="text-sm font-semibold text-foreground">Beteiligungen</h2>
                <span className="text-xs text-muted-foreground">{filteredUnternehmen.length} Einträge</span>
              </div>
              <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
                {filteredUnternehmen.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-4">
                    <IconBuildingSkyscraper size={40} className="text-muted-foreground" stroke={1.5} />
                    <p className="text-sm text-muted-foreground">
                      {statusFilter ? 'Keine Beteiligungen mit diesem Status.' : 'Noch keine Beteiligungen erfasst.'}
                    </p>
                    <button
                      onClick={() => { setEditingUnternehmen(null); setUnternehmenDefaults(undefined); setUnternehmenDialogOpen(true); }}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Erste Beteiligung anlegen
                    </button>
                  </div>
                ) : (
                  filteredUnternehmen.map(u => {
                    const termineCount = termine.filter(t => extractRecordId(t.fields.unternehmen) === u.record_id).length;
                    const dokCount = dokumente.filter(d => extractRecordId(d.fields.unternehmen) === u.record_id).length;
                    const notizCount = notizen.filter(n => extractRecordId(n.fields.unternehmen) === u.record_id).length;
                    const statusTone: Record<string, string> = {
                      aktiv: 'text-success',
                      inaktiv: 'text-muted-foreground',
                      exit: 'text-destructive',
                    };
                    return (
                      <button
                        key={u.record_id}
                        onClick={() => overlay.replace({ type: 'unternehmen', record: u })}
                        className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex items-start gap-3"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <IconBuildingSkyscraper size={16} className="text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground truncate">{u.fields.name}</span>
                            <IconChevronRight size={14} className="shrink-0 text-muted-foreground" />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-xs font-medium ${statusTone[u.fields.status?.key ?? ''] ?? 'text-muted-foreground'}`}>
                              {u.fields.status?.label ?? '—'}
                            </span>
                            {u.fields.branche && (
                              <span className="text-xs text-muted-foreground">· {u.fields.branche.label}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {termineCount > 0 && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <IconCalendar size={11} /> {termineCount}
                              </span>
                            )}
                            {dokCount > 0 && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <IconFileText size={11} /> {dokCount}
                              </span>
                            )}
                            {notizCount > 0 && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <IconNotes size={11} /> {notizCount}
                              </span>
                            )}
                            {u.fields.investiertes_kapital != null && (
                              <span className="text-xs text-muted-foreground ml-auto">{formatCurrency(u.fields.investiertes_kapital)}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Anstehende Termine */}
            <WorkList
              title="Anstehende Termine"
              items={anstehendTermine.slice(0, 8).map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? 'Termin',
                secondLine: (
                  <>
                    <span className="font-medium text-primary">{t.unternehmenName}</span>
                    {t.fields.datum_uhrzeit && (
                      <span className="text-muted-foreground"> · {format(parseISO(t.fields.datum_uhrzeit), 'EEE dd.MM., HH:mm', { locale: de })}</span>
                    )}
                  </>
                ),
                action: t.fields.terminstatus?.key === 'geplant' ? {
                  label: '✓ Stattgefunden',
                  onClick: () => advanceTermin(t as EnrichedTermine),
                } : undefined,
              }))}
              onItemClick={id => {
                const t = termine.find(t => t.record_id === id);
                if (t) overlay.push({ type: 'termine', record: t });
              }}
              empty={{
                text: 'Keine anstehenden Termine',
                action: {
                  label: 'Termin anlegen',
                  onClick: () => { setEditingTermine(null); setTermineDefaults(undefined); setTermineDialogOpen(true); },
                },
              }}
            />
          </>
        }
        primary={
          <CalendarWidget
            events={calendarEvents}
            locale={de}
            defaultView="week"
            weekDays={5}
            onEventClick={ev => {
              const t = termine.find(t => t.record_id === ev.id);
              if (t) overlay.push({ type: 'termine', record: t });
            }}
            onEmptyClick={(date) => {
              setEditingTermine(null);
              setTermineDefaults({ datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm") });
              setTermineDialogOpen(true);
            }}
            onEventDrop={async (eventId, newStart) => {
              const termin = termine.find(t => t.record_id === eventId);
              if (!termin) return;
              const prev = { ...termin };
              setTermine(prev2 => prev2.map(t => t.record_id === eventId
                ? { ...t, fields: { ...t.fields, datum_uhrzeit: newStart } }
                : t
              ));
              LivingAppsService.updateTermineEntry(eventId, { datum_uhrzeit: newStart as any }).catch(() => {
                setTermine(prev2 => prev2.map(t => t.record_id === eventId ? prev : t));
                fetchAll();
              });
              undoToast(`Termin verschoben → ${formatDateTime(newStart)}`, () => {
                setTermine(prev2 => prev2.map(t => t.record_id === prev.record_id ? prev : t));
                LivingAppsService.updateTermineEntry(prev.record_id, { datum_uhrzeit: prev.fields.datum_uhrzeit as any }).catch(() => fetchAll());
              });
            }}
          />
        }
      />

      {/* Record Overlay Host */}
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
                    u.fields.status ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        u.fields.status.key === 'aktiv' ? 'bg-success/10 text-success' :
                        u.fields.status.key === 'exit' ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>{u.fields.status.label}</span>
                    ) : undefined
                  }
                  actions={
                    <button
                      onClick={() => { setEditingUnternehmen(u); setUnternehmenDefaults(u.fields as any); setUnternehmenDialogOpen(true); }}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <UnternehmenDetails
                  record={u}
                  termineList={termine}
                  onOpenTermine={t => overlay.push({ type: 'termine', record: t })}
                  onAddTermine={() => {
                    setEditingTermine(null);
                    setTermineDefaults({ unternehmen: u.record_id });
                    setTermineDialogOpen(true);
                  }}
                  dokumenteList={dokumente}
                  onOpenDokumente={d => overlay.push({ type: 'dokumente', record: d })}
                  onAddDokumente={() => {
                    setEditingDokumente(null);
                    setDokumenteDefaults({ unternehmen: u.record_id });
                    setDokumenteDialogOpen(true);
                  }}
                  notizenList={notizen}
                  onOpenNotizen={n => overlay.push({ type: 'notizen', record: n })}
                  onAddNotizen={() => {
                    setEditingNotizen(null);
                    setNotizenDefaults({ unternehmen: u.record_id });
                    setNotizenDialogOpen(true);
                  }}
                />
              </>
            );
          }
          if (top.type === 'termine') {
            const t = top.record;
            const u = unternehmenMap.get(extractRecordId(t.fields.unternehmen) ?? '') ?? null;
            return (
              <>
                <RecordHeader
                  title={t.fields.terminbezeichnung ?? 'Termin'}
                  subtitle={[t.fields.terminart?.label, t.fields.datum_uhrzeit ? formatDateTime(t.fields.datum_uhrzeit) : undefined].filter(Boolean).join(' · ')}
                  badges={
                    t.fields.terminstatus ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {t.fields.terminstatus.label}
                      </span>
                    ) : undefined
                  }
                  actions={
                    <button
                      onClick={() => { setEditingTermine(t); setTermineDefaults(t.fields as any); setTermineDialogOpen(true); }}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <TermineDetails
                  record={t}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u ? () => overlay.push({ type: 'unternehmen', record: u! }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'dokumente') {
            const d = top.record;
            const u = unternehmenMap.get(extractRecordId(d.fields.unternehmen) ?? '') ?? null;
            return (
              <>
                <RecordHeader
                  title={d.fields.dokumentenbezeichnung ?? 'Dokument'}
                  subtitle={[d.fields.dokumententyp?.label, d.fields.dokumentendatum ? formatDate(d.fields.dokumentendatum) : undefined].filter(Boolean).join(' · ')}
                  actions={
                    <button
                      onClick={() => { setEditingDokumente(d); setDokumenteDefaults(d.fields as any); setDokumenteDialogOpen(true); }}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <DokumenteDetails
                  record={d}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u ? () => overlay.push({ type: 'unternehmen', record: u! }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'notizen') {
            const n = top.record;
            const u = unternehmenMap.get(extractRecordId(n.fields.unternehmen) ?? '') ?? null;
            return (
              <>
                <RecordHeader
                  title={n.fields.notiz_titel ?? 'Notiz'}
                  subtitle={[n.fields.kategorie?.label, n.fields.notiz_datum ? formatDate(n.fields.notiz_datum) : undefined].filter(Boolean).join(' · ')}
                  badges={
                    n.fields.prioritaet ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        n.fields.prioritaet.key === 'hoch' ? 'bg-destructive/10 text-destructive' :
                        n.fields.prioritaet.key === 'mittel' ? 'bg-warning/10 text-warning' :
                        'bg-muted text-muted-foreground'
                      }`}>{n.fields.prioritaet.label}</span>
                    ) : undefined
                  }
                  actions={
                    <button
                      onClick={() => { setEditingNotizen(n); setNotizenDefaults(n.fields as any); setNotizenDialogOpen(true); }}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <NotizenDetails
                  record={n}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u ? () => overlay.push({ type: 'unternehmen', record: u! }) : undefined}
                />
              </>
            );
          }
          return null;
        }}
        footer={top => {
          if (top.type === 'termine') {
            const t = top.record;
            if (t.fields.terminstatus?.key === 'geplant') {
              return {
                label: 'Als „Stattgefunden" markieren',
                onClick: () => {
                  advanceTermin(t as EnrichedTermine);
                  overlay.close();
                },
              };
            }
          }
          return undefined;
        }}
        onEdit={top => {
          if (top.type === 'unternehmen') {
            setEditingUnternehmen(top.record);
            setUnternehmenDefaults(top.record.fields as any);
            setUnternehmenDialogOpen(true);
          }
        }}
      />

      {/* Dialogs */}
      <UnternehmenDialog
        open={unternehmenDialogOpen}
        onClose={() => { setUnternehmenDialogOpen(false); setEditingUnternehmen(null); }}
        onSubmit={async fields => {
          if (editingUnternehmen) {
            await LivingAppsService.updateUnternehmenEntry(editingUnternehmen.record_id, fields as any);
          } else {
            await LivingAppsService.createUnternehmenEntry(fields as any);
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
        onClose={() => { setTermineDialogOpen(false); setEditingTermine(null); }}
        onSubmit={async fields => {
          if (editingTermine) {
            await LivingAppsService.updateTermineEntry(editingTermine.record_id, fields as any);
          } else {
            await LivingAppsService.createTermineEntry(fields as any);
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
        onClose={() => { setDokumenteDialogOpen(false); setEditingDokumente(null); }}
        onSubmit={async fields => {
          if (editingDokumente) {
            await LivingAppsService.updateDokumenteEntry(editingDokumente.record_id, fields as any);
          } else {
            await LivingAppsService.createDokumenteEntry(fields as any);
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
        onClose={() => { setNotizenDialogOpen(false); setEditingNotizen(null); }}
        onSubmit={async fields => {
          if (editingNotizen) {
            await LivingAppsService.updateNotizenEntry(editingNotizen.record_id, fields as any);
          } else {
            await LivingAppsService.createNotizenEntry(fields as any);
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
