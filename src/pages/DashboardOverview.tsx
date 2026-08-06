import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine, enrichDokumente, enrichNotizen } from '@/lib/enrich';
import type { EnrichedTermine, EnrichedDokumente, EnrichedNotizen } from '@/types/enriched';
import type { Unternehmen, Termine } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
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
  IconBuilding,
  IconCalendar,
  IconCoin,
  IconAlertCircle,
  IconPlus,
  IconCheck,
  IconFileText,
  IconNote,
  IconChevronRight,
} from '@tabler/icons-react';

type OverlayItem =
  | { type: 'unternehmen'; id: string }
  | { type: 'termin'; id: string }
  | { type: 'dokument'; id: string }
  | { type: 'notiz'; id: string };

export default function DashboardOverview() {
  const clock = useClock();
  const {
    unternehmen, setUnternehmen,
    termine, setTermine,
    dokumente,
    notizen,
    unternehmenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedTermine = enrichTermine(termine, { unternehmenMap });
  const enrichedDokumente = enrichDokumente(dokumente, { unternehmenMap });
  const enrichedNotizen = enrichNotizen(notizen, { unternehmenMap });

  const overlay = useRecordOverlayStack<OverlayItem>();

  // Dialog state
  const [unternehmenDialog, setUnternehmenDialog] = useState(false);
  const [unternehmenDefaults, setUnternehmenDefaults] = useState<UnternehmenDialogDefaults | undefined>();
  const [editingUnternehmen, setEditingUnternehmen] = useState<Unternehmen | null>(null);

  const [termineDialog, setTermineDialog] = useState(false);
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>();
  const [editingTermin, setEditingTermin] = useState<Termine | null>(null);

  const [dokumenteDialog, setDokumenteDialog] = useState(false);
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>();

  const [notizenDialog, setNotizenDialog] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>();

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Computed values (all above early returns)
  const today = format(clock, 'yyyy-MM-dd');
  const weekStart = startOfWeek(clock, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(clock, { weekStartsOn: 1 });

  const aktiveUnternehmen = useMemo(() =>
    unternehmen.filter(u => u.fields.status?.key === 'aktiv'),
  [unternehmen]);

  const filteredUnternehmen = useMemo(() => {
    if (!statusFilter) return unternehmen;
    return unternehmen.filter(u => u.fields.status?.key === statusFilter);
  }, [unternehmen, statusFilter]);

  const termineThisWeek = useMemo(() =>
    termine.filter(t => {
      if (!t.fields.datum_uhrzeit) return false;
      const d = parseISO(t.fields.datum_uhrzeit);
      return !isBefore(d, weekStart) && !isAfter(d, weekEnd);
    }),
  [termine, weekStart, weekEnd]);

  const anstehendeTermine = useMemo(() =>
    enrichedTermine
      .filter(t => t.fields.datum_uhrzeit && isAfter(parseISO(t.fields.datum_uhrzeit), startOfDay(clock)))
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? ''))
      .slice(0, 5),
  [enrichedTermine, clock]);

  const gesamtInvestition = useMemo(() =>
    unternehmen.reduce((sum, u) => sum + (u.fields.investiertes_kapital ?? 0), 0),
  [unternehmen]);

  const gesamtWert = useMemo(() =>
    unternehmen.reduce((sum, u) => sum + (u.fields.aktueller_wert ?? 0), 0),
  [unternehmen]);

  const baldTermine = useMemo(() => {
    const inTwoDays = addDays(clock, 2);
    return termine.filter(t => {
      if (!t.fields.datum_uhrzeit) return false;
      if (t.fields.terminstatus?.key === 'stattgefunden') return false;
      const d = parseISO(t.fields.datum_uhrzeit);
      return !isBefore(d, startOfDay(clock)) && !isAfter(d, endOfDay(inTwoDays));
    });
  }, [termine, clock]);

  // Calendar events
  const calendarEvents = useMemo((): CalendarEvent[] =>
    enrichedTermine.map(t => ({
      id: `termin:${t.record_id}`,
      start: t.fields.datum_uhrzeit ?? today,
      title: t.fields.terminbezeichnung ?? '—',
      subtitle: t.unternehmenName || t.fields.ort,
      tone: t.fields.terminstatus?.key === 'abgesagt' ? 'destructive' as const
        : t.fields.terminstatus?.key === 'stattgefunden' ? 'success' as const
        : 'primary' as const,
    })),
  [enrichedTermine, today]);

  // Advance termin status
  const advanceTermin = useCallback(async (termin: Termine | EnrichedTermine) => {
    const next = termin.fields.terminstatus?.key === 'geplant' ? 'stattgefunden' : 'geplant';
    const label = LOOKUP_OPTIONS['termine']['terminstatus'].find(o => o.key === next)?.label ?? next;
    const prev = termin.fields.terminstatus;
    setTermine(ts => ts.map(t => t.record_id === termin.record_id
      ? { ...t, fields: { ...t.fields, terminstatus: { key: next, label } } }
      : t));
    undoToast(
      next === 'stattgefunden' ? `Termin „${termin.fields.terminbezeichnung}" als stattgefunden markiert` : 'Status zurückgesetzt',
      async () => {
        setTermine(ts => ts.map(t => t.record_id === termin.record_id
          ? { ...t, fields: { ...t.fields, terminstatus: prev } }
          : t));
        await LivingAppsService.updateTermineEntry(termin.record_id, { terminstatus: prev?.key });
      }
    );
    LivingAppsService.updateTermineEntry(termin.record_id, { terminstatus: next }).catch(() => fetchAll());
  }, [setTermine, fetchAll]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Context line
  const nextTermin = anstehendeTermine[0];
  const beteiligungenNamen = namen(aktiveUnternehmen.slice(0, 3).map(u => u.fields.name ?? ''));
  const contextLine = unternehmen.length === 0
    ? 'Lege dein erstes Portfoliounternehmen an, um zu beginnen.'
    : nextTermin
      ? `${beteiligungenNamen} im Portfolio — nächster Termin: ${nextTermin.fields.terminbezeichnung} bei ${nextTermin.unternehmenName || 'unbekannt'} am ${formatDate(nextTermin.fields.datum_uhrzeit)}.`
      : `${beteiligungenNamen} im Portfolio — keine anstehenden Termine.`;

  // Hero: baldige Termine (in 48h)
  const heroTermin = baldTermine[0];

  const rendite = gesamtInvestition > 0 ? ((gesamtWert - gesamtInvestition) / gesamtInvestition * 100) : null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="mt-1 text-sm text-muted-foreground truncate max-w-xl">{contextLine}</p>
        </div>
        <button
          onClick={() => { setEditingUnternehmen(null); setUnternehmenDefaults(undefined); setUnternehmenDialog(true); }}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <IconPlus size={16} className="shrink-0" />
          <span className="hidden sm:inline">Unternehmen</span>
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={heroTermin ? (
          <HeroBanner
            icon={<IconCalendar size={18} />}
            action={{
              label: 'Als stattgefunden markieren',
              onClick: () => advanceTermin(heroTermin),
            }}
          >
            <b>{heroTermin.fields.terminbezeichnung}</b>{' '}
            {(() => {
              const u = unternehmenMap.get(extractRecordId(heroTermin.fields.unternehmen) ?? '');
              return u ? `bei ${u.fields.name} ` : '';
            })()}
            — {formatDate(heroTermin.fields.datum_uhrzeit)}{heroTermin.fields.ort ? ` · ${heroTermin.fields.ort}` : ''}
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatStrip>
            <StatStripItem
              title="Aktive Beteiligungen"
              value={aktiveUnternehmen.length}
              icon={<IconBuilding size={16} />}
              tone={aktiveUnternehmen.length > 0 ? 'primary' : 'default'}
              onClick={() => setStatusFilter(f => f === 'aktiv' ? null : 'aktiv')}
              active={statusFilter === 'aktiv'}
            />
            <StatStripItem
              title="Investiertes Kapital"
              value={formatCurrency(gesamtInvestition) || '—'}
              icon={<IconCoin size={16} />}
            />
            <StatStripItem
              title={rendite !== null && rendite >= 0 ? 'Wertsteigerung' : 'Wertentwicklung'}
              value={rendite !== null ? `${rendite >= 0 ? '+' : ''}${rendite.toFixed(1)} %` : '—'}
              tone={rendite !== null ? (rendite > 0 ? 'success' : rendite < 0 ? 'destructive' : 'default') : 'default'}
              icon={<IconCoin size={16} />}
            />
            <StatStripItem
              title="Termine diese Woche"
              value={termineThisWeek.length}
              icon={<IconCalendar size={16} />}
              tone={termineThisWeek.length > 0 ? 'primary' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <CalendarWidget
            events={calendarEvents}
            locale={de}
            defaultView="week"
            weekDays={5}
            onEventClick={ev => {
              const id = ev.id.split(':')[1];
              overlay.replace({ type: 'termin', id });
            }}
            onEmptyClick={date => {
              setEditingTermin(null);
              setTermineDefaults({ datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm") });
              setTermineDialog(true);
            }}
            onEventDrop={(eventId, newStart) => {
              const id = eventId.split(':')[1];
              const termin = termine.find(t => t.record_id === id);
              if (!termin) return;
              setTermine(ts => ts.map(t => t.record_id === id
                ? { ...t, fields: { ...t.fields, datum_uhrzeit: newStart } }
                : t));
              LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: newStart }).catch(() => fetchAll());
              undoToast(`Termin auf ${formatDate(newStart)} verschoben`, async () => {
                const prev = termin.fields.datum_uhrzeit;
                setTermine(ts => ts.map(t => t.record_id === id
                  ? { ...t, fields: { ...t.fields, datum_uhrzeit: prev } }
                  : t));
                await LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: prev });
              });
            }}
          />
        }
        aside={
          <>
            {/* Anstehende Termine */}
            <WorkList
              title="Anstehende Termine"
              items={anstehendeTermine.map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? '—',
                secondLine: (
                  <>
                    <span className="font-medium text-primary">{t.fields.terminart?.label ?? ''}</span>
                    {t.unternehmenName && <span className="text-muted-foreground"> · {t.unternehmenName}</span>}
                    <span className="text-muted-foreground"> · {formatDate(t.fields.datum_uhrzeit)}</span>
                  </>
                ),
                action: t.fields.terminstatus?.key !== 'stattgefunden'
                  ? { label: '✓ Erledigt', onClick: () => advanceTermin(t) }
                  : undefined,
              }))}
              onItemClick={id => overlay.replace({ type: 'termin', id })}
              empty={{
                text: 'Keine anstehenden Termine — alles im grünen Bereich.',
                action: { label: 'Neuer Termin', onClick: () => { setEditingTermin(null); setTermineDefaults(undefined); setTermineDialog(true); } },
              }}
            />

            {/* Portfolio-Übersicht */}
            <WorkList
              title="Portfolio"
              items={filteredUnternehmen.slice(0, 8).map(u => {
                const terminCount = termine.filter(t => extractRecordId(t.fields.unternehmen) === u.record_id).length;
                const dokCount = dokumente.filter(d => extractRecordId(d.fields.unternehmen) === u.record_id).length;
                return {
                  id: u.record_id,
                  title: u.fields.name ?? '—',
                  secondLine: (
                    <>
                      <span className={`font-medium ${u.fields.status?.key === 'aktiv' ? 'text-success' : u.fields.status?.key === 'exit' ? 'text-warning' : 'text-muted-foreground'}`}>
                        {u.fields.status?.label ?? '—'}
                      </span>
                      {u.fields.branche && <span className="text-muted-foreground"> · {u.fields.branche.label}</span>}
                      <span className="text-muted-foreground"> · {terminCount} Termine · {dokCount} Dok.</span>
                    </>
                  ),
                  action: {
                    label: '',
                    onClick: () => overlay.replace({ type: 'unternehmen', id: u.record_id }),
                  },
                };
              })}
              onItemClick={id => overlay.replace({ type: 'unternehmen', id })}
              empty={{
                text: 'Noch keine Unternehmen im Portfolio.',
                action: { label: 'Erstes Unternehmen anlegen', onClick: () => { setEditingUnternehmen(null); setUnternehmenDefaults(undefined); setUnternehmenDialog(true); } },
              }}
            />
          </>
        }
      />

      {/* Overlays */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'unternehmen') {
            const u = unternehmen.find(r => r.record_id === top.id);
            if (!u) return null;
            return (
              <>
                <RecordHeader
                  title={u.fields.name ?? '—'}
                  subtitle={[u.fields.branche?.label, u.fields.stadt, u.fields.land].filter(Boolean).join(' · ')}
                  badges={
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${u.fields.status?.key === 'aktiv' ? 'bg-success/10 text-success' : u.fields.status?.key === 'exit' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}`}>
                      {u.fields.status?.label ?? '—'}
                    </span>
                  }
                  actions={
                    <button
                      onClick={() => { setEditingUnternehmen(u); setUnternehmenDefaults(u.fields as UnternehmenDialogDefaults); setUnternehmenDialog(true); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <UnternehmenDetails
                  record={u}
                  termineList={termine}
                  onOpenTermine={t => overlay.push({ type: 'termin', id: t.record_id })}
                  onAddTermine={() => {
                    setEditingTermin(null);
                    setTermineDefaults({ unternehmen: u.record_id });
                    setTermineDialog(true);
                  }}
                  dokumenteList={dokumente}
                  onOpenDokumente={d => overlay.push({ type: 'dokument', id: d.record_id })}
                  onAddDokumente={() => {
                    setDokumenteDefaults({ unternehmen: u.record_id });
                    setDokumenteDialog(true);
                  }}
                  notizenList={notizen}
                  onOpenNotizen={n => overlay.push({ type: 'notiz', id: n.record_id })}
                  onAddNotizen={() => {
                    setNotizenDefaults({ unternehmen: u.record_id });
                    setNotizenDialog(true);
                  }}
                />
              </>
            );
          }
          if (top.type === 'termin') {
            const t = termine.find(r => r.record_id === top.id);
            if (!t) return null;
            const u = unternehmenMap.get(extractRecordId(t.fields.unternehmen) ?? '');
            return (
              <>
                <RecordHeader
                  title={t.fields.terminbezeichnung ?? '—'}
                  subtitle={[t.fields.terminart?.label, formatDate(t.fields.datum_uhrzeit)].filter(Boolean).join(' · ')}
                  actions={
                    <button
                      onClick={() => { setEditingTermin(t); setTermineDefaults(t.fields as TermineDialogDefaults); setTermineDialog(true); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <TermineDetails
                  record={t}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={uu => overlay.push({ type: 'unternehmen', id: uu.record_id })}
                />
              </>
            );
          }
          if (top.type === 'dokument') {
            const d = dokumente.find(r => r.record_id === top.id);
            if (!d) return null;
            return (
              <>
                <RecordHeader
                  title={d.fields.dokumentenbezeichnung ?? '—'}
                  subtitle={[d.fields.dokumententyp?.label, formatDate(d.fields.dokumentendatum)].filter(Boolean).join(' · ')}
                  actions={
                    <button
                      onClick={() => { setDokumenteDefaults(d.fields as DokumenteDialogDefaults); setDokumenteDialog(true); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
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
            const n = notizen.find(r => r.record_id === top.id);
            if (!n) return null;
            return (
              <>
                <RecordHeader
                  title={n.fields.notiz_titel ?? '—'}
                  subtitle={[n.fields.kategorie?.label, formatDate(n.fields.notiz_datum)].filter(Boolean).join(' · ')}
                  actions={
                    <button
                      onClick={() => { setNotizenDefaults(n.fields as NotizenDialogDefaults); setNotizenDialog(true); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
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
        footer={top => {
          if (top.type === 'termin') {
            const t = termine.find(r => r.record_id === top.id);
            if (!t || t.fields.terminstatus?.key === 'stattgefunden') return undefined;
            return {
              label: '✓ Als stattgefunden markieren',
              onClick: () => { advanceTermin(t); overlay.close(); },
            };
          }
          return undefined;
        }}
      />

      {/* Dialogs */}
      <UnternehmenDialog
        open={unternehmenDialog}
        onClose={() => { setUnternehmenDialog(false); setEditingUnternehmen(null); }}
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
        open={termineDialog}
        onClose={() => { setTermineDialog(false); setEditingTermin(null); }}
        onSubmit={async fields => {
          if (editingTermin) {
            await LivingAppsService.updateTermineEntry(editingTermin.record_id, fields as any);
          } else {
            await LivingAppsService.createTermineEntry(fields as any);
          }
          fetchAll();
        }}
        defaultValues={termineDefaults}
        recordId={editingTermin?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Termine']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Termine']}
      />

      <DokumenteDialog
        open={dokumenteDialog}
        onClose={() => setDokumenteDialog(false)}
        onSubmit={async fields => {
          await LivingAppsService.createDokumenteEntry(fields as any);
          fetchAll();
        }}
        defaultValues={dokumenteDefaults}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Dokumente']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Dokumente']}
      />

      <NotizenDialog
        open={notizenDialog}
        onClose={() => setNotizenDialog(false)}
        onSubmit={async fields => {
          await LivingAppsService.createNotizenEntry(fields as any);
          fetchAll();
        }}
        defaultValues={notizenDefaults}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />
    </div>
  );
}
