import { useState, useMemo, useCallback } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine, enrichDokumente, enrichNotizen } from '@/lib/enrich';
import type { EnrichedTermine } from '@/types/enriched';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import {
  useRecordOverlayStack,
  RecordOverlayHost,
  RecordHeader,
  RecordField,
  RecordSection,
  RecordAttachments,
} from '@/components/widgets/RecordView';
import { UnternehmenDetails } from '@/components/details/UnternehmenDetails';
import { TermineDetails } from '@/components/details/TermineDetails';
import { DokumenteDetails } from '@/components/details/DokumenteDetails';
import { NotizenDetails } from '@/components/details/NotizenDetails';
import { CalendarWidget } from '@/components/widgets/CalendarWidget';
import type { CalendarEvent } from '@/components/widgets/CalendarWidget';
import { UnternehmenDialog } from '@/components/dialogs/UnternehmenDialog';
import { TermineDialog } from '@/components/dialogs/TermineDialog';
import { DokumenteDialog } from '@/components/dialogs/DokumenteDialog';
import { NotizenDialog } from '@/components/dialogs/NotizenDialog';
import type { TermineDialogDefaults } from '@/components/dialogs/TermineDialog';
import type { DokumenteDialogDefaults } from '@/components/dialogs/DokumenteDialog';
import type { NotizenDialogDefaults } from '@/components/dialogs/NotizenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { format, parseISO, isBefore, isAfter, addDays, startOfDay } from 'date-fns';
import {
  IconBriefcase,
  IconCalendar,
  IconAlertTriangle,
  IconPlus,
  IconBuilding,
  IconFileText,
  IconNotes,
  IconCheck,
} from '@tabler/icons-react';

type OverlayItem =
  | { type: 'unternehmen'; record: Unternehmen }
  | { type: 'termine'; record: Termine }
  | { type: 'dokumente'; record: Dokumente }
  | { type: 'notizen'; record: Notizen };

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
  const overlay = useRecordOverlayStack<OverlayItem>();

  // Dialog state
  const [unternehmenDialogOpen, setUnternehmenDialogOpen] = useState(false);
  const [termineDialogOpen, setTermineDialogOpen] = useState(false);
  const [dokumenteDialogOpen, setDokumenteDialogOpen] = useState(false);
  const [notizenDialogOpen, setNotizenDialogOpen] = useState(false);

  const [editingUnternehmen, setEditingUnternehmen] = useState<Unternehmen | undefined>();
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>();
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>();
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>();
  const [editingTermine, setEditingTermine] = useState<Termine | undefined>();
  const [editingDokumente, setEditingDokumente] = useState<Dokumente | undefined>();
  const [editingNotizen, setEditingNotizen] = useState<Notizen | undefined>();

  // Enriched data
  const enrichedTermine = useMemo(() =>
    enrichTermine(termine, { unternehmenMap }),
    [termine, unternehmenMap]
  );
  const enrichedDokumente = useMemo(() =>
    enrichDokumente(dokumente, { unternehmenMap }),
    [dokumente, unternehmenMap]
  );
  const enrichedNotizen = useMemo(() =>
    enrichNotizen(notizen, { unternehmenMap }),
    [notizen, unternehmenMap]
  );

  // Today & derived dates
  const today = useMemo(() => format(clock, 'yyyy-MM-dd'), [clock]);
  const in7days = useMemo(() => format(addDays(clock, 7), 'yyyy-MM-dd'), [clock]);

  // Portfolio KPIs
  const aktiveUnternehmen = useMemo(() =>
    unternehmen.filter(u => u.fields.status?.key === 'aktiv'),
    [unternehmen]
  );

  // Upcoming termine (next 7 days)
  const bevorstehende = useMemo(() =>
    enrichedTermine
      .filter(t => {
        if (!t.fields.datum_uhrzeit) return false;
        const d = t.fields.datum_uhrzeit.slice(0, 10);
        return d >= today && d <= in7days && t.fields.terminstatus?.key !== 'abgesagt';
      })
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedTermine, today, in7days]
  );

  // Overdue (past & not stattgefunden)
  const ueberfaellig = useMemo(() =>
    enrichedTermine.filter(t => {
      if (!t.fields.datum_uhrzeit) return false;
      const d = t.fields.datum_uhrzeit.slice(0, 10);
      return d < today
        && t.fields.terminstatus?.key !== 'stattgefunden'
        && t.fields.terminstatus?.key !== 'abgesagt';
    }),
    [enrichedTermine, today]
  );

  // Calendar events
  const calendarEvents = useMemo((): CalendarEvent[] =>
    termine
      .filter(t => !!t.fields.datum_uhrzeit)
      .map(t => {
        const isAbgesagt = t.fields.terminstatus?.key === 'abgesagt';
        const isStattgefunden = t.fields.terminstatus?.key === 'stattgefunden';
        const isUeberfaellig = ueberfaellig.some(u => u.record_id === t.record_id);
        const tone = isAbgesagt ? 'default'
          : isUeberfaellig ? 'destructive'
          : isStattgefunden ? 'success'
          : 'primary';
        const u = t.fields.unternehmen ? unternehmenMap.get(extractRecordId(t.fields.unternehmen) ?? '') : undefined;
        return {
          id: `termin:${t.record_id}`,
          start: t.fields.datum_uhrzeit!,
          title: t.fields.terminbezeichnung ?? 'Termin',
          subtitle: u?.fields.name,
          tone,
        };
      }),
    [termine, unternehmenMap, ueberfaellig]
  );

  // Advance termine to "stattgefunden"
  const advanceTermin = useCallback(async (t: EnrichedTermine) => {
    const prev = t.fields.terminstatus;
    setTermine(ts => ts.map(x =>
      x.record_id === t.record_id
        ? { ...x, fields: { ...x.fields, terminstatus: { key: 'stattgefunden', label: 'Stattgefunden' } } }
        : x
    ));
    undoToast(`${t.fields.terminbezeichnung} als stattgefunden markiert`, async () => {
      setTermine(ts => ts.map(x =>
        x.record_id === t.record_id
          ? { ...x, fields: { ...x.fields, terminstatus: prev } }
          : x
      ));
      await LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: prev?.key });
    });
    try {
      await LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: 'stattgefunden' });
    } catch {
      fetchAll();
    }
  }, [setTermine, fetchAll]);

  // Gesamtwert Portfolio
  const gesamtKapital = useMemo(() =>
    aktiveUnternehmen.reduce((sum, u) => sum + (u.fields.investiertes_kapital ?? 0), 0),
    [aktiveUnternehmen]
  );

  // Context line
  const contextLine = useMemo(() => {
    if (bevorstehende.length === 0 && ueberfaellig.length === 0) {
      return `${aktiveUnternehmen.length} aktive Beteiligung${aktiveUnternehmen.length !== 1 ? 'en' : ''} im Portfolio.`;
    }
    if (ueberfaellig.length > 0) {
      const names = ueberfaellig.slice(0, 2).map(t => t.fields.terminbezeichnung ?? '');
      return `${namen(names)} ${ueberfaellig.length === 1 ? 'ist überfällig' : 'sind überfällig'} — bitte nachverfolgen.`;
    }
    const next = bevorstehende[0];
    const u = next.unternehmenName;
    return `Nächster Termin: ${next.fields.terminbezeichnung}${u ? ` bei ${u}` : ''} am ${formatDateTime(next.fields.datum_uhrzeit)}.`;
  }, [bevorstehende, ueberfaellig, aktiveUnternehmen]);

  // Open overlay helpers
  const openUnternehmen = useCallback((u: Unternehmen) => overlay.replace({ type: 'unternehmen', record: u }), [overlay]);
  const openTermine = useCallback((t: Termine) => overlay.push({ type: 'termine', record: t }), [overlay]);
  const openDokumente = useCallback((d: Dokumente) => overlay.push({ type: 'dokumente', record: d }), [overlay]);
  const openNotizen = useCallback((n: Notizen) => overlay.push({ type: 'notizen', record: n }), [overlay]);

  // Calendar handlers
  const handleEventClick = useCallback((ev: CalendarEvent) => {
    const id = ev.id.split(':')[1];
    const t = termine.find(x => x.record_id === id);
    if (t) overlay.replace({ type: 'termine', record: t });
  }, [termine, overlay]);

  const handleEmptyClick = useCallback((date: Date) => {
    setTermineDefaults({ datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm") });
    setEditingTermine(undefined);
    setTermineDialogOpen(true);
  }, []);

  // ─── Every hook goes ABOVE this line ───
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;
  // ─── Below this line: plain derivations only ───

  const formatKapital = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} Mio.`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
    return `${v}`;
  };

  return (
    <>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {gruss(clock)}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{contextLine}</p>
        </div>
        <button
          onClick={() => { setEditingUnternehmen(undefined); setUnternehmenDialogOpen(true); }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors shrink-0"
        >
          <IconPlus size={16} className="shrink-0" />
          Neue Beteiligung
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={ueberfaellig.length > 0 && (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: 'Als stattgefunden markieren',
              onClick: () => advanceTermin(ueberfaellig[0]),
            }}
          >
            <b>{namen(ueberfaellig.map(t => t.fields.terminbezeichnung ?? ''))}</b>
            {' '}
            {ueberfaellig.length === 1 ? 'ist überfällig' : `(${ueberfaellig.length}) sind überfällig`}
            {' — '}
            fällig war {formatDateTime(ueberfaellig[0].fields.datum_uhrzeit)}.
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title="Aktive Beteiligungen"
              value={aktiveUnternehmen.length}
              icon={<IconBriefcase size={16} />}
              tone="primary"
            />
            <StatStripItem
              title="Investiertes Kapital"
              value={gesamtKapital > 0 ? `${formatKapital(gesamtKapital)} €` : '—'}
              icon={<IconBuilding size={16} />}
            />
            <StatStripItem
              title="Diese Woche"
              value={bevorstehende.length}
              icon={<IconCalendar size={16} />}
              tone={bevorstehende.length > 0 ? 'default' : 'default'}
            />
            <StatStripItem
              title="Dokumente"
              value={dokumente.length}
              icon={<IconFileText size={16} />}
            />
            <StatStripItem
              title="Notizen"
              value={notizen.length}
              icon={<IconNotes size={16} />}
            />
          </StatStrip>
        }
        primary={
          <CalendarWidget
            events={calendarEvents}
            defaultView="week"
            weekDays={5}
            onEventClick={handleEventClick}
            onEmptyClick={handleEmptyClick}
          />
        }
        aside={
          <>
            <WorkList
              title="Bevorstehende Termine"
              items={bevorstehende.map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? 'Termin',
                secondLine: (
                  <>
                    <span className="text-muted-foreground">{t.unternehmenName}</span>
                    {t.unternehmenName && <span className="text-muted-foreground"> · </span>}
                    <span className="text-muted-foreground">{formatDateTime(t.fields.datum_uhrzeit)}</span>
                  </>
                ),
                action: {
                  label: '✓',
                  onClick: () => advanceTermin(t),
                },
              }))}
              onItemClick={id => {
                const t = termine.find(x => x.record_id === id);
                if (t) overlay.replace({ type: 'termine', record: t });
              }}
              empty={{
                text: 'Keine Termine diese Woche — alles frei.',
                action: { label: 'Termin anlegen', onClick: () => { setTermineDefaults(undefined); setTermineDialogOpen(true); } },
              }}
            />

            <WorkList
              title="Portfolio — Unternehmen"
              items={unternehmen
                .sort((a, b) => (a.fields.name ?? '').localeCompare(b.fields.name ?? ''))
                .slice(0, 8)
                .map(u => ({
                  id: u.record_id,
                  title: u.fields.name ?? '—',
                  secondLine: (
                    <>
                      <span className={
                        u.fields.status?.key === 'aktiv' ? 'font-medium text-success' :
                        u.fields.status?.key === 'exit' ? 'text-muted-foreground' :
                        'text-muted-foreground'
                      }>
                        {u.fields.status?.label ?? '—'}
                      </span>
                      {u.fields.branche && (
                        <span className="text-muted-foreground"> · {u.fields.branche.label}</span>
                      )}
                    </>
                  ),
                  action: {
                    label: '→',
                    onClick: () => openUnternehmen(u),
                  },
                }))}
              onItemClick={id => {
                const u = unternehmen.find(x => x.record_id === id);
                if (u) openUnternehmen(u);
              }}
              empty={{
                text: 'Noch keine Beteiligung erfasst.',
                action: { label: 'Erste Beteiligung', onClick: () => { setEditingUnternehmen(undefined); setUnternehmenDialogOpen(true); } },
              }}
            />
          </>
        }
      />

      {/* ── Dialogs ── */}
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
        defaultValues={editingUnternehmen?.fields}
        recordId={editingUnternehmen?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
      />

      <TermineDialog
        open={termineDialogOpen}
        onClose={() => { setTermineDialogOpen(false); setTermineDefaults(undefined); setEditingTermine(undefined); }}
        onSubmit={async fields => {
          if (editingTermine) {
            await LivingAppsService.updateTermineEntry(editingTermine.record_id, fields);
          } else {
            await LivingAppsService.createTermineEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingTermine ? editingTermine.fields : termineDefaults}
        recordId={editingTermine?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Termine']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Termine']}
      />

      <DokumenteDialog
        open={dokumenteDialogOpen}
        onClose={() => { setDokumenteDialogOpen(false); setDokumenteDefaults(undefined); setEditingDokumente(undefined); }}
        onSubmit={async fields => {
          if (editingDokumente) {
            await LivingAppsService.updateDokumenteEntry(editingDokumente.record_id, fields);
          } else {
            await LivingAppsService.createDokumenteEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingDokumente ? editingDokumente.fields : dokumenteDefaults}
        recordId={editingDokumente?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Dokumente']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Dokumente']}
      />

      <NotizenDialog
        open={notizenDialogOpen}
        onClose={() => { setNotizenDialogOpen(false); setNotizenDefaults(undefined); setEditingNotizen(undefined); }}
        onSubmit={async fields => {
          if (editingNotizen) {
            await LivingAppsService.updateNotizenEntry(editingNotizen.record_id, fields);
          } else {
            await LivingAppsService.createNotizenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingNotizen ? editingNotizen.fields : notizenDefaults}
        recordId={editingNotizen?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />

      {/* ── Overlay stack ── */}
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
                  badges={
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.fields.status?.key === 'aktiv' ? 'bg-success/10 text-success' :
                      u.fields.status?.key === 'exit' ? 'bg-muted text-muted-foreground' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {u.fields.status?.label ?? '—'}
                    </span>
                  }
                  actions={
                    <button
                      onClick={() => { setEditingUnternehmen(u); setUnternehmenDialogOpen(true); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <UnternehmenDetails
                  record={u}
                  termineList={termine}
                  onOpenTermine={openTermine}
                  onAddTermine={() => {
                    setTermineDefaults({ unternehmen: u.record_id });
                    setEditingTermine(undefined);
                    setTermineDialogOpen(true);
                  }}
                  dokumenteList={dokumente}
                  onOpenDokumente={openDokumente}
                  onAddDokumente={() => {
                    setDokumenteDefaults({ unternehmen: u.record_id });
                    setEditingDokumente(undefined);
                    setDokumenteDialogOpen(true);
                  }}
                  notizenList={notizen}
                  onOpenNotizen={openNotizen}
                  onAddNotizen={() => {
                    setNotizenDefaults({ unternehmen: u.record_id });
                    setEditingNotizen(undefined);
                    setNotizenDialogOpen(true);
                  }}
                />
              </>
            );
          }
          if (top.type === 'termine') {
            const t = top.record;
            const u = t.fields.unternehmen
              ? unternehmenMap.get(extractRecordId(t.fields.unternehmen) ?? '')
              : undefined;
            return (
              <>
                <RecordHeader
                  title={t.fields.terminbezeichnung ?? 'Termin'}
                  subtitle={t.fields.terminart?.label}
                  badges={
                    t.fields.terminstatus && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.fields.terminstatus.key === 'stattgefunden' ? 'bg-success/10 text-success' :
                        t.fields.terminstatus.key === 'abgesagt' ? 'bg-muted text-muted-foreground' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {t.fields.terminstatus.label}
                      </span>
                    )
                  }
                  actions={
                    <button
                      onClick={() => { setEditingTermine(t); setTermineDialogOpen(true); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <TermineDetails
                  record={t}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u ? () => overlay.push({ type: 'unternehmen', record: u }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'dokumente') {
            const d = top.record;
            const u = d.fields.unternehmen
              ? unternehmenMap.get(extractRecordId(d.fields.unternehmen) ?? '')
              : undefined;
            return (
              <>
                <RecordHeader
                  title={d.fields.dokumentenbezeichnung ?? 'Dokument'}
                  subtitle={d.fields.dokumententyp?.label}
                  actions={
                    <button
                      onClick={() => { setEditingDokumente(d); setDokumenteDialogOpen(true); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <DokumenteDetails
                  record={d}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u ? () => overlay.push({ type: 'unternehmen', record: u }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'notizen') {
            const n = top.record;
            const u = n.fields.unternehmen
              ? unternehmenMap.get(extractRecordId(n.fields.unternehmen) ?? '')
              : undefined;
            return (
              <>
                <RecordHeader
                  title={n.fields.notiz_titel ?? 'Notiz'}
                  subtitle={n.fields.kategorie?.label}
                  actions={
                    <button
                      onClick={() => { setEditingNotizen(n); setNotizenDialogOpen(true); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <NotizenDetails
                  record={n}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u ? () => overlay.push({ type: 'unternehmen', record: u }) : undefined}
                />
              </>
            );
          }
          return null;
        }}
        footer={top => {
          if (top.type === 'termine') {
            const t = top.record;
            const enriched = enrichedTermine.find(x => x.record_id === t.record_id);
            if (t.fields.terminstatus?.key === 'geplant' && enriched) {
              return {
                label: '✓ Als stattgefunden markieren',
                onClick: () => { advanceTermin(enriched); overlay.close(); },
              };
            }
          }
          return undefined;
        }}
      />
    </>
  );
}
