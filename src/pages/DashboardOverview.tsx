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
  RecordKeyFacts,
} from '@/components/widgets/RecordView';
import { CalendarWidget } from '@/components/widgets/CalendarWidget';
import type { CalendarEvent } from '@/components/widgets/CalendarWidget';
import { UnternehmenDetails } from '@/components/details/UnternehmenDetails';
import { TermineDetails } from '@/components/details/TermineDetails';
import { DokumenteDetails } from '@/components/details/DokumenteDetails';
import { NotizenDetails } from '@/components/details/NotizenDetails';
import { UnternehmenDialog } from '@/components/dialogs/UnternehmenDialog';
import { TermineDialog } from '@/components/dialogs/TermineDialog';
import type { TermineDialogDefaults } from '@/components/dialogs/TermineDialog';
import { DokumenteDialog } from '@/components/dialogs/DokumenteDialog';
import type { DokumenteDialogDefaults } from '@/components/dialogs/DokumenteDialog';
import { NotizenDialog } from '@/components/dialogs/NotizenDialog';
import type { NotizenDialogDefaults } from '@/components/dialogs/NotizenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import {
  IconBuilding,
  IconCalendarEvent,
  IconCurrencyEuro,
  IconTrendingUp,
  IconAlertTriangle,
  IconPlus,
  IconCheck,
  IconBriefcase,
} from '@tabler/icons-react';

type OverlayItem =
  | { type: 'unternehmen'; record: Unternehmen; ctx?: { addTermin?: boolean; addDokument?: boolean; addNotiz?: boolean } }
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

  // Dialogs
  const [unternehmenDialogOpen, setUnternehmenDialogOpen] = useState(false);
  const [editingUnternehmen, setEditingUnternehmen] = useState<Unternehmen | undefined>();

  const [termineDialogOpen, setTermineDialogOpen] = useState(false);
  const [editingTermin, setEditingTermin] = useState<Termine | undefined>();
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>();

  const [dokumenteDialogOpen, setDokumenteDialogOpen] = useState(false);
  const [editingDokument, setEditingDokument] = useState<Dokumente | undefined>();
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>();

  const [notizenDialogOpen, setNotizenDialogOpen] = useState(false);
  const [editingNotiz, setEditingNotiz] = useState<Notizen | undefined>();
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>();

  // Overlay stack
  const overlay = useRecordOverlayStack<OverlayItem>();

  // Today key for comparisons
  const todayKey = format(clock, 'yyyy-MM-dd');

  // Upcoming/overdue termine
  const termineNaechste = useMemo(() => {
    const upcoming = enrichedTermine
      .filter(t => {
        const key = t.fields.datum_uhrzeit?.slice(0, 10) ?? '';
        return key >= todayKey && t.fields.terminstatus?.key !== 'abgesagt';
      })
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? ''));
    return upcoming;
  }, [enrichedTermine, todayKey]);

  const termineUeberfaellig = useMemo(() => {
    return enrichedTermine.filter(t => {
      const key = t.fields.datum_uhrzeit?.slice(0, 10) ?? '';
      return key < todayKey && t.fields.terminstatus?.key === 'geplant';
    });
  }, [enrichedTermine, todayKey]);

  // Portfolio KPIs
  const aktiveUnternehmen = useMemo(
    () => unternehmen.filter(u => u.fields.status?.key === 'aktiv'),
    [unternehmen]
  );
  const gesamtInvestiert = useMemo(
    () => unternehmen.reduce((sum, u) => sum + (u.fields.investiertes_kapital ?? 0), 0),
    [unternehmen]
  );
  const gesamtWert = useMemo(
    () => unternehmen.reduce((sum, u) => sum + (u.fields.aktueller_wert ?? 0), 0),
    [unternehmen]
  );

  // Calendar events from termine
  const calendarEvents = useMemo((): CalendarEvent[] => {
    return enrichedTermine
      .filter(t => !!t.fields.datum_uhrzeit)
      .map(t => {
        const statusKey = t.fields.terminstatus?.key;
        const tone =
          statusKey === 'stattgefunden' ? 'success' :
          statusKey === 'abgesagt' ? 'default' :
          t.fields.datum_uhrzeit!.slice(0, 10) < todayKey ? 'destructive' :
          t.fields.datum_uhrzeit!.slice(0, 10) <= format(addDays(clock, 7), 'yyyy-MM-dd') ? 'primary' :
          'default';
        return {
          id: t.record_id,
          start: t.fields.datum_uhrzeit!,
          title: t.fields.terminbezeichnung ?? 'Termin',
          subtitle: t.unternehmenName || t.fields.terminart?.label,
          tone,
        };
      });
  }, [enrichedTermine, todayKey, clock]);

  // Mark a termin as stattgefunden (advance write)
  const advanceTermin = useCallback(async (termin: Termine) => {
    const prev = termin.fields.terminstatus;
    setTermine(ts => ts.map(t =>
      t.record_id === termin.record_id
        ? { ...t, fields: { ...t.fields, terminstatus: { key: 'stattgefunden', label: 'Stattgefunden' } } }
        : t
    ));
    undoToast(`„${termin.fields.terminbezeichnung}" als stattgefunden markiert.`, async () => {
      setTermine(ts => ts.map(t =>
        t.record_id === termin.record_id
          ? { ...t, fields: { ...t.fields, terminstatus: prev } }
          : t
      ));
      await LivingAppsService.updateTermineEntry(termin.record_id, { terminstatus: prev?.key as any });
    });
    try {
      await LivingAppsService.updateTermineEntry(termin.record_id, { terminstatus: 'stattgefunden' as any });
    } catch {
      fetchAll();
    }
  }, [setTermine, fetchAll]);

  // Context line
  const contextLine = useMemo(() => {
    const naechster = termineNaechste[0];
    if (termineUeberfaellig.length > 0) {
      const firmen = namen(termineUeberfaellig.map(t => enrichedTermine.find(e => e.record_id === t.record_id)?.unternehmenName ?? '').filter(Boolean));
      return `${termineUeberfaellig.length} überfälliger Termin${termineUeberfaellig.length > 1 ? 'e' : ''} bei ${firmen || 'deinen Beteiligungen'}.`;
    }
    if (naechster) {
      const firma = naechster.unternehmenName;
      return `Nächster Termin: ${naechster.fields.terminbezeichnung}${firma ? ` bei ${firma}` : ''} am ${formatDate(naechster.fields.datum_uhrzeit?.slice(0, 10))}.`;
    }
    if (aktiveUnternehmen.length > 0) {
      const firmenNamen = namen(aktiveUnternehmen.slice(0, 3).map(u => u.fields.name ?? ''));
      return `${aktiveUnternehmen.length} aktive Beteiligung${aktiveUnternehmen.length > 1 ? 'en' : ''}: ${firmenNamen}.`;
    }
    return 'Starte, indem du deine erste Beteiligung erfasst.';
  }, [termineNaechste, termineUeberfaellig, enrichedTermine, aktiveUnternehmen]);

  // ─── Every hook goes ABOVE this line ───
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;
  // ─── Below this line: plain derivations only ───

  const termineIn7Tagen = termineNaechste.filter(t =>
    (t.fields.datum_uhrzeit?.slice(0, 10) ?? '') <= format(addDays(clock, 7), 'yyyy-MM-dd')
  );

  // Empty state
  if (unternehmen.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <IconBriefcase size={48} className="text-primary" stroke={1.5} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Willkommen im BeteiligungsManager</h2>
          <p className="text-muted-foreground max-w-sm">Erfasse deine erste Beteiligung und behalte Portfolio, Termine und Dokumente im Blick.</p>
        </div>
        <button
          onClick={() => { setEditingUnternehmen(undefined); setUnternehmenDialogOpen(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <IconPlus size={16} />
          Erste Beteiligung erfassen
        </button>
        <UnternehmenDialog
          open={unternehmenDialogOpen}
          onClose={() => setUnternehmenDialogOpen(false)}
          onSubmit={async (fields) => { await LivingAppsService.createUnternehmenEntry(fields); fetchAll(); }}
          enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
        />
      </div>
    );
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{contextLine}</p>
        </div>
        <button
          onClick={() => { setEditingUnternehmen(undefined); setUnternehmenDialogOpen(true); }}
          className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <IconPlus size={15} />
          <span className="hidden sm:inline">Beteiligung</span>
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={termineUeberfaellig.length > 0 && (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: 'Als erledigt markieren',
              onClick: () => advanceTermin(termineUeberfaellig[0]),
            }}
          >
            <b>{namen(termineUeberfaellig.map(t => enrichedTermine.find(e => e.record_id === t.record_id)?.unternehmenName ?? t.fields.terminbezeichnung ?? ''))}</b>
            {' '}— {termineUeberfaellig.length === 1
              ? `Termin „${termineUeberfaellig[0].fields.terminbezeichnung}" war am ${formatDate(termineUeberfaellig[0].fields.datum_uhrzeit?.slice(0, 10))}.`
              : `${termineUeberfaellig.length} Termine nicht als stattgefunden markiert.`
            }
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title="Beteiligungen"
              value={aktiveUnternehmen.length}
              icon={<IconBuilding size={16} />}
              tone="default"
            />
            <StatStripItem
              title="Investiert"
              value={gesamtInvestiert > 0 ? formatCurrency(gesamtInvestiert) : '—'}
              icon={<IconCurrencyEuro size={16} />}
              tone="default"
            />
            <StatStripItem
              title="Portfoliowert"
              value={gesamtWert > 0 ? formatCurrency(gesamtWert) : '—'}
              icon={<IconTrendingUp size={16} />}
              tone={gesamtWert > gesamtInvestiert && gesamtInvestiert > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title="Nächste 7 Tage"
              value={termineIn7Tagen.length}
              icon={<IconCalendarEvent size={16} />}
              tone={termineIn7Tagen.length > 0 ? 'primary' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <CalendarWidget
            events={calendarEvents}
            defaultView="week"
            locale={de}
            weekDays={5}
            onEventClick={ev => {
              const t = termine.find(r => r.record_id === ev.id);
              if (t) overlay.replace({ type: 'termin', record: t });
            }}
            onEmptyClick={(date) => {
              setTermineDefaults({ datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm") });
              setEditingTermin(undefined);
              setTermineDialogOpen(true);
            }}
            onEventDrop={async (eventId, newStart) => {
              const t = termine.find(r => r.record_id === eventId);
              if (!t) return;
              const prev = t.fields.datum_uhrzeit;
              setTermine(ts => ts.map(r =>
                r.record_id === eventId
                  ? { ...r, fields: { ...r.fields, datum_uhrzeit: newStart } }
                  : r
              ));
              undoToast(`Termin verschoben auf ${formatDate(newStart.slice(0, 10))}.`, async () => {
                setTermine(ts => ts.map(r =>
                  r.record_id === eventId
                    ? { ...r, fields: { ...r.fields, datum_uhrzeit: prev } }
                    : r
                ));
                await LivingAppsService.updateTermineEntry(eventId, { datum_uhrzeit: prev as any });
              });
              try {
                await LivingAppsService.updateTermineEntry(eventId, { datum_uhrzeit: newStart as any });
              } catch {
                fetchAll();
              }
            }}
          />
        }
        aside={
          <>
            <WorkList
              title="Beteiligungen"
              items={unternehmen
                .filter(u => u.fields.status?.key !== 'exit')
                .sort((a, b) => (b.fields.aktueller_wert ?? 0) - (a.fields.aktueller_wert ?? 0))
                .slice(0, 8)
                .map(u => {
                  const ownedTermine = termine.filter(t => extractRecordId(t.fields.unternehmen) === u.record_id);
                  const nextTermin = ownedTermine
                    .filter(t => (t.fields.datum_uhrzeit?.slice(0, 10) ?? '') >= todayKey)
                    .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? ''))[0];
                  return {
                    id: u.record_id,
                    title: u.fields.name ?? '—',
                    secondLine: (
                      <>
                        <span className={
                          u.fields.status?.key === 'aktiv' ? 'font-medium text-success' :
                          u.fields.status?.key === 'inaktiv' ? 'text-muted-foreground' :
                          'text-warning'
                        }>
                          {u.fields.status?.label ?? '—'}
                        </span>
                        {u.fields.branche && (
                          <span className="text-muted-foreground"> · {u.fields.branche.label}</span>
                        )}
                        {nextTermin && (
                          <span className="text-muted-foreground"> · {formatDate(nextTermin.fields.datum_uhrzeit?.slice(0, 10))}</span>
                        )}
                      </>
                    ),
                    action: {
                      label: '+ Termin',
                      onClick: () => {
                        setTermineDefaults({ unternehmen: u.record_id });
                        setEditingTermin(undefined);
                        setTermineDialogOpen(true);
                      },
                    },
                  };
                })}
              onItemClick={id => {
                const u = unternehmen.find(r => r.record_id === id);
                if (u) overlay.replace({ type: 'unternehmen', record: u });
              }}
              empty={{
                text: 'Noch keine Beteiligungen erfasst.',
                action: { label: 'Erste Beteiligung anlegen', onClick: () => { setEditingUnternehmen(undefined); setUnternehmenDialogOpen(true); } },
              }}
            />
            <WorkList
              title="Anstehende Termine"
              items={termineNaechste.slice(0, 6).map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? '—',
                secondLine: (
                  <>
                    <span className="font-medium text-primary">{formatDate(t.fields.datum_uhrzeit?.slice(0, 10))}</span>
                    {t.unternehmenName && (
                      <span className="text-muted-foreground"> · {t.unternehmenName}</span>
                    )}
                    {t.fields.terminart && (
                      <span className="text-muted-foreground"> · {t.fields.terminart.label}</span>
                    )}
                  </>
                ),
                action: {
                  label: <><IconCheck size={14} className="shrink-0" /> Erledigt</>,
                  onClick: () => advanceTermin(t),
                },
              }))}
              onItemClick={id => {
                const t = termine.find(r => r.record_id === id);
                if (t) overlay.replace({ type: 'termin', record: t });
              }}
              empty={{
                text: aktiveUnternehmen.length > 0
                  ? `Keine anstehenden Termine — alles im Griff.`
                  : 'Noch keine Termine geplant.',
                action: { label: 'Termin planen', onClick: () => { setTermineDefaults(undefined); setEditingTermin(undefined); setTermineDialogOpen(true); } },
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
                  subtitle={[u.fields.rechtsform?.label, u.fields.stadt, u.fields.land].filter(Boolean).join(' · ')}
                  badges={u.fields.status && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      u.fields.status.key === 'aktiv' ? 'bg-success/10 text-success' :
                      u.fields.status.key === 'exit' ? 'bg-warning/10 text-warning' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {u.fields.status.label}
                    </span>
                  )}
                  actions={
                    <button
                      onClick={() => { setEditingUnternehmen(u); setUnternehmenDialogOpen(true); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                {(u.fields.investiertes_kapital || u.fields.aktueller_wert) && (
                  <RecordKeyFacts items={[
                    ...(u.fields.investiertes_kapital != null ? [{ label: 'Investiert', value: formatCurrency(u.fields.investiertes_kapital), icon: IconCurrencyEuro }] : []),
                    ...(u.fields.aktueller_wert != null ? [{ label: 'Unternehmenswert', value: formatCurrency(u.fields.aktueller_wert), icon: IconTrendingUp }] : []),
                    ...(u.fields.beteiligungsquote != null ? [{ label: 'Beteiligungsquote', value: `${u.fields.beteiligungsquote} %`, icon: IconBriefcase }] : []),
                  ]} />
                )}
                <UnternehmenDetails
                  record={u}
                  termineList={termine}
                  onOpenTermine={r => overlay.push({ type: 'termin', record: r })}
                  onAddTermine={() => {
                    setTermineDefaults({ unternehmen: u.record_id });
                    setEditingTermin(undefined);
                    setTermineDialogOpen(true);
                  }}
                  dokumenteList={dokumente}
                  onOpenDokumente={r => overlay.push({ type: 'dokument', record: r })}
                  onAddDokumente={() => {
                    setDokumenteDefaults({ unternehmen: u.record_id });
                    setEditingDokument(undefined);
                    setDokumenteDialogOpen(true);
                  }}
                  notizenList={notizen}
                  onOpenNotizen={r => overlay.push({ type: 'notiz', record: r })}
                  onAddNotizen={() => {
                    setNotizenDefaults({ unternehmen: u.record_id });
                    setEditingNotiz(undefined);
                    setNotizenDialogOpen(true);
                  }}
                />
              </>
            );
          }
          if (top.type === 'termin') {
            const t = top.record;
            const parentU = unternehmen.find(u => u.record_id === extractRecordId(t.fields.unternehmen));
            return (
              <>
                <RecordHeader
                  title={t.fields.terminbezeichnung ?? '—'}
                  subtitle={[t.fields.terminart?.label, t.fields.ort].filter(Boolean).join(' · ')}
                  actions={
                    <button
                      onClick={() => { setEditingTermin(t); setTermineDefaults(undefined); setTermineDialogOpen(true); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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
                  title={d.fields.dokumentenbezeichnung ?? '—'}
                  subtitle={d.fields.dokumententyp?.label}
                  actions={
                    <button
                      onClick={() => { setEditingDokument(d); setDokumenteDefaults(undefined); setDokumenteDialogOpen(true); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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
                  title={n.fields.notiz_titel ?? '—'}
                  subtitle={[n.fields.kategorie?.label, n.fields.prioritaet?.label].filter(Boolean).join(' · ')}
                  actions={
                    <button
                      onClick={() => { setEditingNotiz(n); setNotizenDefaults(undefined); setNotizenDialogOpen(true); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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
            const isPending = t.fields.terminstatus?.key === 'geplant' && (t.fields.datum_uhrzeit?.slice(0, 10) ?? '') < todayKey;
            if (isPending) {
              return {
                label: '✓ Als stattgefunden markieren',
                onClick: () => {
                  advanceTermin(t);
                  overlay.close();
                },
              };
            }
          }
          return undefined;
        }}
      />

      {/* Dialogs */}
      <UnternehmenDialog
        open={unternehmenDialogOpen}
        onClose={() => { setUnternehmenDialogOpen(false); setEditingUnternehmen(undefined); }}
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
        onClose={() => { setTermineDialogOpen(false); setEditingTermin(undefined); setTermineDefaults(undefined); }}
        onSubmit={async (fields) => {
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
        onClose={() => { setDokumenteDialogOpen(false); setEditingDokument(undefined); setDokumenteDefaults(undefined); }}
        onSubmit={async (fields) => {
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
        onClose={() => { setNotizenDialogOpen(false); setEditingNotiz(undefined); setNotizenDefaults(undefined); }}
        onSubmit={async (fields) => {
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
