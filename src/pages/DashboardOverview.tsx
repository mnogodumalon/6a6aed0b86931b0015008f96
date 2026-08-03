import { useState, useMemo, useCallback } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine } from '@/lib/enrich';
import type { EnrichedTermine } from '@/types/enriched';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatDateTime, lookupKey } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { KanbanWidget } from '@/components/widgets/KanbanWidget';
import type { KanbanCard, KanbanColumn } from '@/components/widgets/KanbanWidget';
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
  IconCalendarEvent,
  IconFileText,
  IconNotes,
  IconAlertTriangle,
  IconPlus,
  IconCheck,
} from '@tabler/icons-react';
import { format, parseISO, isToday, isTomorrow, startOfDay, addDays } from 'date-fns';
import { de } from 'date-fns/locale';

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

  const enrichedTermine: EnrichedTermine[] = useMemo(
    () => enrichTermine(termine, { unternehmenMap }),
    [termine, unternehmenMap]
  );

  const overlay = useRecordOverlayStack<OverlayItem>();

  // Dialog state
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

  // Derived data (must be before early returns — only pure derivations, no hooks below)
  const today = format(clock, 'yyyy-MM-dd');
  const in7Days = format(addDays(clock, 7), 'yyyy-MM-dd');

  const aktiveUnternehmen = useMemo(() =>
    unternehmen.filter(u => lookupKey(u.fields.status) === 'aktiv'),
    [unternehmen]
  );

  const anstehendeTermine = useMemo(() =>
    enrichedTermine
      .filter(t => {
        const dt = t.fields.datum_uhrzeit;
        if (!dt) return false;
        const dateKey = dt.slice(0, 10);
        return dateKey >= today && lookupKey(t.fields.terminstatus) !== 'abgesagt';
      })
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedTermine, today]
  );

  const heutigeTermine = useMemo(() =>
    anstehendeTermine.filter(t => t.fields.datum_uhrzeit?.slice(0, 10) === today),
    [anstehendeTermine, today]
  );

  const dieseWocheTermine = useMemo(() =>
    anstehendeTermine.filter(t => {
      const dt = t.fields.datum_uhrzeit?.slice(0, 10);
      return dt && dt >= today && dt <= in7Days;
    }),
    [anstehendeTermine, today, in7Days]
  );

  const naechsterTermin = anstehendeTermine[0];

  // Kanban columns from status lookup
  const kanbanColumns = useMemo((): KanbanColumn[] =>
    (LOOKUP_OPTIONS['unternehmen']?.['status'] ?? []).map(o => ({
      key: o.key,
      label: o.label,
      tone: o.key === 'aktiv' ? 'success' : o.key === 'exit' ? 'default' : 'default',
    })) as KanbanColumn[],
    []
  );

  const kanbanCards = useMemo((): KanbanCard[] =>
    unternehmen
      .sort((a, b) => (a.fields.name ?? '').localeCompare(b.fields.name ?? ''))
      .map(u => {
        const branche = u.fields.branche?.label;
        const quote = u.fields.beteiligungsquote != null
          ? `${u.fields.beteiligungsquote}%`
          : null;
        const termineCount = termine.filter(t => extractRecordId(t.fields.unternehmen) === u.record_id).length;
        return {
          id: `unternehmen:${u.record_id}`,
          column: lookupKey(u.fields.status) ?? 'aktiv',
          title: u.fields.name ?? '—',
          subtitle: [branche, quote, termineCount > 0 ? `${termineCount} Termine` : null]
            .filter(Boolean).join(' · '),
          tone: lookupKey(u.fields.status) === 'aktiv' ? 'success' : 'default',
        } as KanbanCard;
      }),
    [unternehmen, termine]
  );

  // Optimistic status change
  const handleCardMove = useCallback(async (cardId: string, newColumn: string) => {
    const id = cardId.split(':')[1];
    const record = unternehmen.find(u => u.record_id === id);
    if (!record) return;

    const prevStatus = record.fields.status;
    const newLabel = (LOOKUP_OPTIONS['unternehmen']?.['status'] ?? []).find(o => o.key === newColumn)?.label ?? newColumn;

    // Optimistic update
    setUnternehmen(prev => prev.map(u =>
      u.record_id === id
        ? { ...u, fields: { ...u.fields, status: { key: newColumn, label: newLabel } } }
        : u
    ));

    LivingAppsService.updateUnternehmenEntry(id, { status: newColumn } as any).catch(() => {
      fetchAll();
    });

    undoToast(`${record.fields.name ?? 'Unternehmen'} → ${newLabel}`, async () => {
      setUnternehmen(prev => prev.map(u =>
        u.record_id === id ? { ...u, fields: { ...u.fields, status: prevStatus } } : u
      ));
      await LivingAppsService.updateUnternehmenEntry(id, { status: prevStatus ? lookupKey(prevStatus) : null } as any).catch(() => fetchAll());
    });
  }, [unternehmen, setUnternehmen, fetchAll]);

  // Termin status advance
  const advanceTermin = useCallback(async (t: Termine) => {
    const prev = t.fields.terminstatus;
    const newStatus = 'stattgefunden';
    const newLabel = 'Stattgefunden';
    setTermine(prevT => prevT.map(r =>
      r.record_id === t.record_id
        ? { ...r, fields: { ...r.fields, terminstatus: { key: newStatus, label: newLabel } } }
        : r
    ));
    LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: newStatus } as any).catch(() => fetchAll());
    undoToast(`${t.fields.terminbezeichnung ?? 'Termin'} als stattgefunden markiert`, async () => {
      setTermine(prevT => prevT.map(r =>
        r.record_id === t.record_id ? { ...r, fields: { ...r.fields, terminstatus: prev } } : r
      ));
      await LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: prev ? lookupKey(prev) : null } as any).catch(() => fetchAll());
    });
  }, [setTermine, fetchAll]);

  // Open helpers for satellites (pre-bound with hub context)
  const openTerminForHub = useCallback((hubId: string) => {
    setTermineDefaults({ unternehmen: hubId });
    setEditingTermin(null);
    setTermineDialogOpen(true);
  }, []);

  const openDokumentForHub = useCallback((hubId: string) => {
    setDokumenteDefaults({ unternehmen: hubId });
    setEditingDokument(null);
    setDokumenteDialogOpen(true);
  }, []);

  const openNotizForHub = useCallback((hubId: string) => {
    setNotizenDefaults({ unternehmen: hubId });
    setEditingNotiz(null);
    setNotizenDialogOpen(true);
  }, []);

  // ─── Every hook goes ABOVE this line ───────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;
  // ─── Below this line: plain derivations only ───────────────────────────────

  // Context line
  const terminNamen = namen(heutigeTermine.map(t => t.unternehmenName || t.fields.terminbezeichnung || '').filter(Boolean));
  const contextLine = heutigeTermine.length > 0
    ? `Heute ${heutigeTermine.length === 1 ? '1 Termin' : `${heutigeTermine.length} Termine`}: ${terminNamen}.`
    : anstehendeTermine.length > 0
    ? `Nächster Termin: ${anstehendeTermine[0].fields.terminbezeichnung ?? ''} (${formatDateTime(anstehendeTermine[0].fields.datum_uhrzeit)}).`
    : `${aktiveUnternehmen.length} aktive Beteiligungen — kein Termin geplant.`;

  // Hero: Termin der heute stattfinden soll und noch nicht bestätigt
  const ungeplantHeute = heutigeTermine.filter(t => lookupKey(t.fields.terminstatus) === 'geplant');

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{gruss(clock)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <button
          onClick={() => { setUnternehmenDefaults(undefined); setEditingUnternehmen(null); setUnternehmenDialogOpen(true); }}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <IconPlus size={16} className="shrink-0" />
          <span className="hidden sm:inline">Unternehmen</span>
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          ungeplantHeute.length > 0 ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: 'Als stattgefunden markieren',
                onClick: () => advanceTermin(ungeplantHeute[0]),
              }}
            >
              <b>{namen(ungeplantHeute.map(t => t.unternehmenName || t.fields.terminbezeichnung || ''))}</b>
              {' '}— {ungeplantHeute.length === 1 ? 'Termin heute noch nicht bestätigt' : `${ungeplantHeute.length} Termine heute noch ausstehend`}.
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title="Aktive Beteiligungen"
              value={aktiveUnternehmen.length}
              icon={<IconBuildingSkyscraper size={16} className="shrink-0" />}
              tone={aktiveUnternehmen.length > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title="Termine diese Woche"
              value={dieseWocheTermine.length}
              icon={<IconCalendarEvent size={16} className="shrink-0" />}
              tone={heutigeTermine.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title="Dokumente"
              value={dokumente.length}
              icon={<IconFileText size={16} className="shrink-0" />}
            />
            <StatStripItem
              title="Notizen"
              value={notizen.length}
              icon={<IconNotes size={16} className="shrink-0" />}
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            columns={kanbanColumns}
            cards={kanbanCards}
            defaultCollapsed={['exit']}
            onCardClick={card => {
              const id = card.id.split(':')[1];
              const record = unternehmen.find(u => u.record_id === id);
              if (record) overlay.replace({ type: 'unternehmen', record });
            }}
            onCardMove={handleCardMove}
            onAddCard={columnKey => {
              setUnternehmenDefaults({ status: columnKey });
              setEditingUnternehmen(null);
              setUnternehmenDialogOpen(true);
            }}
          />
        }
        aside={
          <>
            <WorkList
              title="Anstehende Termine"
              items={anstehendeTermine.slice(0, 8).map(t => {
                const dtStr = t.fields.datum_uhrzeit;
                const dtLabel = dtStr
                  ? (isToday(parseISO(dtStr)) ? `Heute, ${format(parseISO(dtStr), 'HH:mm', { locale: de })}` :
                     isTomorrow(parseISO(dtStr)) ? `Morgen, ${format(parseISO(dtStr), 'HH:mm', { locale: de })}` :
                     formatDateTime(dtStr))
                  : '—';
                const isHeute = dtStr?.slice(0, 10) === today;
                const statusKey = lookupKey(t.fields.terminstatus);
                return {
                  id: t.record_id,
                  title: t.fields.terminbezeichnung ?? '—',
                  secondLine: (
                    <>
                      <span className={isHeute ? 'font-medium text-warning-foreground' : 'text-muted-foreground'}>{dtLabel}</span>
                      {t.unternehmenName ? <span className="text-muted-foreground"> · {t.unternehmenName}</span> : null}
                      {statusKey && statusKey !== 'geplant' ? (
                        <span className={`ml-1 ${statusKey === 'stattgefunden' ? 'text-success' : 'text-muted-foreground'}`}>
                          {' · '}{t.fields.terminstatus?.label}
                        </span>
                      ) : null}
                    </>
                  ),
                  action: statusKey === 'geplant' ? {
                    label: '✓ Bestätigen',
                    onClick: () => advanceTermin(t),
                  } : undefined,
                };
              })}
              onItemClick={id => {
                const record = termine.find(t => t.record_id === id);
                if (record) overlay.replace({ type: 'termine', record });
              }}
              empty={{
                text: naechsterTermin
                  ? `Nächster: ${naechsterTermin.fields.terminbezeichnung ?? ''} — ${formatDate(naechsterTermin.fields.datum_uhrzeit)}`
                  : 'Kein Termin geplant',
                action: {
                  label: 'Termin anlegen',
                  onClick: () => { setTermineDefaults(undefined); setEditingTermin(null); setTermineDialogOpen(true); },
                },
              }}
            />

            <WorkList
              title="Neueste Notizen"
              items={[...notizen]
                .sort((a, b) => (b.fields.notiz_datum ?? '').localeCompare(a.fields.notiz_datum ?? ''))
                .slice(0, 5)
                .map(n => {
                  const u = n.fields.unternehmen ? unternehmenMap.get(extractRecordId(n.fields.unternehmen) ?? '') : null;
                  return {
                    id: n.record_id,
                    title: n.fields.notiz_titel ?? '—',
                    secondLine: (
                      <>
                        {n.fields.prioritaet?.key === 'hoch' && (
                          <span className="font-medium text-destructive">Hoch · </span>
                        )}
                        <span className="text-muted-foreground">
                          {n.fields.kategorie?.label ?? ''}{u ? ` · ${u.fields.name}` : ''}
                          {n.fields.notiz_datum ? ` · ${formatDate(n.fields.notiz_datum)}` : ''}
                        </span>
                      </>
                    ),
                  };
                })}
              onItemClick={id => {
                const record = notizen.find(n => n.record_id === id);
                if (record) overlay.replace({ type: 'notizen', record });
              }}
              empty={{
                text: 'Noch keine Notizen erfasst',
                action: {
                  label: 'Notiz hinzufügen',
                  onClick: () => { setNotizenDefaults(undefined); setEditingNotiz(null); setNotizenDialogOpen(true); },
                },
              }}
            />
          </>
        }
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
        defaultValues={editingUnternehmen ? editingUnternehmen.fields : unternehmenDefaults}
        recordId={editingUnternehmen?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
      />

      <TermineDialog
        open={termineDialogOpen}
        onClose={() => { setTermineDialogOpen(false); setEditingTermin(null); }}
        onSubmit={async fields => {
          if (editingTermin) {
            await LivingAppsService.updateTermineEntry(editingTermin.record_id, fields as any);
          } else {
            await LivingAppsService.createTermineEntry(fields as any);
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
        onClose={() => { setDokumenteDialogOpen(false); setEditingDokument(null); }}
        onSubmit={async fields => {
          if (editingDokument) {
            await LivingAppsService.updateDokumenteEntry(editingDokument.record_id, fields as any);
          } else {
            await LivingAppsService.createDokumenteEntry(fields as any);
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
        onClose={() => { setNotizenDialogOpen(false); setEditingNotiz(null); }}
        onSubmit={async fields => {
          if (editingNotiz) {
            await LivingAppsService.updateNotizenEntry(editingNotiz.record_id, fields as any);
          } else {
            await LivingAppsService.createNotizenEntry(fields as any);
          }
          fetchAll();
        }}
        defaultValues={editingNotiz ? editingNotiz.fields : notizenDefaults}
        recordId={editingNotiz?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />

      {/* Record Overlay Stack */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'unternehmen') {
            const u = top.record;
            return (
              <>
                <RecordHeader
                  title={u.fields.name ?? '—'}
                  subtitle={[u.fields.rechtsform?.label, u.fields.branche?.label, u.fields.stadt].filter(Boolean).join(' · ')}
                  badges={
                    u.fields.status ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        lookupKey(u.fields.status) === 'aktiv' ? 'bg-success/10 text-success' :
                        lookupKey(u.fields.status) === 'exit' ? 'bg-muted text-muted-foreground' :
                        'bg-warning/10 text-warning-foreground'
                      }`}>
                        {u.fields.status.label}
                      </span>
                    ) : undefined
                  }
                  actions={
                    <button
                      onClick={() => { setEditingUnternehmen(u); setUnternehmenDefaults(undefined); setUnternehmenDialogOpen(true); }}
                      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <UnternehmenDetails
                  record={u}
                  termineList={termine}
                  onOpenTermine={r => overlay.push({ type: 'termine', record: r })}
                  onAddTermine={() => openTerminForHub(u.record_id)}
                  dokumenteList={dokumente}
                  onOpenDokumente={r => overlay.push({ type: 'dokumente', record: r })}
                  onAddDokumente={() => openDokumentForHub(u.record_id)}
                  notizenList={notizen}
                  onOpenNotizen={r => overlay.push({ type: 'notizen', record: r })}
                  onAddNotizen={() => openNotizForHub(u.record_id)}
                />
              </>
            );
          }
          if (top.type === 'termine') {
            const t = top.record;
            return (
              <>
                <RecordHeader
                  title={t.fields.terminbezeichnung ?? '—'}
                  subtitle={[t.fields.terminart?.label, formatDateTime(t.fields.datum_uhrzeit), t.fields.ort].filter(Boolean).join(' · ')}
                  badges={
                    t.fields.terminstatus ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        lookupKey(t.fields.terminstatus) === 'stattgefunden' ? 'bg-success/10 text-success' :
                        lookupKey(t.fields.terminstatus) === 'abgesagt' ? 'bg-muted text-muted-foreground' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {t.fields.terminstatus.label}
                      </span>
                    ) : undefined
                  }
                  actions={
                    <button
                      onClick={() => { setEditingTermin(t); setTermineDefaults(undefined); setTermineDialogOpen(true); }}
                      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <TermineDetails
                  record={t}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={r => overlay.push({ type: 'unternehmen', record: r })}
                />
              </>
            );
          }
          if (top.type === 'dokumente') {
            const d = top.record;
            return (
              <>
                <RecordHeader
                  title={d.fields.dokumentenbezeichnung ?? '—'}
                  subtitle={[d.fields.dokumententyp?.label, formatDate(d.fields.dokumentendatum)].filter(Boolean).join(' · ')}
                  actions={
                    <button
                      onClick={() => { setEditingDokument(d); setDokumenteDefaults(undefined); setDokumenteDialogOpen(true); }}
                      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <DokumenteDetails
                  record={d}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={r => overlay.push({ type: 'unternehmen', record: r })}
                />
              </>
            );
          }
          if (top.type === 'notizen') {
            const n = top.record;
            return (
              <>
                <RecordHeader
                  title={n.fields.notiz_titel ?? '—'}
                  subtitle={[n.fields.kategorie?.label, n.fields.prioritaet?.label, formatDate(n.fields.notiz_datum)].filter(Boolean).join(' · ')}
                  actions={
                    <button
                      onClick={() => { setEditingNotiz(n); setNotizenDefaults(undefined); setNotizenDialogOpen(true); }}
                      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <NotizenDetails
                  record={n}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={r => overlay.push({ type: 'unternehmen', record: r })}
                />
              </>
            );
          }
          return null;
        }}
        footer={top => {
          if (top.type === 'termine' && lookupKey(top.record.fields.terminstatus) === 'geplant') {
            return {
              label: 'Als stattgefunden markieren',
              onClick: () => {
                advanceTermin(top.record);
                overlay.close();
              },
            };
          }
          return undefined;
        }}
        onEdit={top => {
          if (top.type === 'unternehmen') { setEditingUnternehmen(top.record); setUnternehmenDefaults(undefined); setUnternehmenDialogOpen(true); }
          if (top.type === 'termine') { setEditingTermin(top.record); setTermineDefaults(undefined); setTermineDialogOpen(true); }
          if (top.type === 'dokumente') { setEditingDokument(top.record); setDokumenteDefaults(undefined); setDokumenteDialogOpen(true); }
          if (top.type === 'notizen') { setEditingNotiz(top.record); setNotizenDefaults(undefined); setNotizenDialogOpen(true); }
        }}
      />
    </div>
  );
}
