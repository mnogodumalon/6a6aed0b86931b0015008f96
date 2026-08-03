import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isAfter, isBefore, startOfDay, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine, enrichDokumente, enrichNotizen } from '@/lib/enrich';
import type { EnrichedTermine, EnrichedDokumente, EnrichedNotizen } from '@/types/enriched';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatCardRow, StatCard, StatStrip, StatStripItem } from '@/components/StatCard';
import { CalendarWidget, type CalendarEvent, type CalendarTone } from '@/components/widgets/CalendarWidget';
import {
  RecordOverlayHost,
  RecordHeader,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { UnternehmenDetails } from '@/components/details/UnternehmenDetails';
import { TermineDetails } from '@/components/details/TermineDetails';
import { DokumenteDetails } from '@/components/details/DokumenteDetails';
import { NotizenDetails } from '@/components/details/NotizenDetails';
import { UnternehmenDialog, type UnternehmenDialogDefaults } from '@/components/dialogs/UnternehmenDialog';
import { TermineDialog, type TermineDialogDefaults } from '@/components/dialogs/TermineDialog';
import { DokumenteDialog, type DokumenteDialogDefaults } from '@/components/dialogs/DokumenteDialog';
import { NotizenDialog, type NotizenDialogDefaults } from '@/components/dialogs/NotizenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import {
  IconBuilding, IconCalendarEvent, IconFileText, IconNotes,
  IconPlus, IconCheck, IconBriefcase, IconAlertTriangle,
  IconTrendingUp,
} from '@tabler/icons-react';

type OverlayItem =
  | { type: 'unternehmen'; id: string }
  | { type: 'termin'; id: string }
  | { type: 'dokument'; id: string }
  | { type: 'notiz'; id: string };

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

  const enrichedTermine = useMemo(
    () => enrichTermine(termine, { unternehmenMap }),
    [termine, unternehmenMap],
  );
  const enrichedDokumente = useMemo(
    () => enrichDokumente(dokumente, { unternehmenMap }),
    [dokumente, unternehmenMap],
  );
  const enrichedNotizen = useMemo(
    () => enrichNotizen(notizen, { unternehmenMap }),
    [notizen, unternehmenMap],
  );

  const overlay = useRecordOverlayStack<OverlayItem>();

  // Dialog state
  const [unternehmenDialogOpen, setUnternehmenDialogOpen] = useState(false);
  const [editingUnternehmen, setEditingUnternehmen] = useState<UnternehmenDialogDefaults | undefined>();
  const [editingUnternehmenId, setEditingUnternehmenId] = useState<string | undefined>();

  const [termineDialogOpen, setTermineDialogOpen] = useState(false);
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>();
  const [editingTermineId, setEditingTermineId] = useState<string | undefined>();

  const [dokumenteDialogOpen, setDokumenteDialogOpen] = useState(false);
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>();
  const [editingDokumenteId, setEditingDokumenteId] = useState<string | undefined>();

  const [notizenDialogOpen, setNotizenDialogOpen] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>();
  const [editingNotizenId, setEditingNotizenId] = useState<string | undefined>();

  // Status filter
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Computed values (all hoisted above early returns)
  const today = format(clock, 'yyyy-MM-dd');
  const in7days = format(addDays(clock, 7), 'yyyy-MM-dd');

  const aktiveUnternehmen = useMemo(
    () => unternehmen.filter(u => u.fields.status?.key === 'aktiv'),
    [unternehmen],
  );
  const inaktiveUnternehmen = useMemo(
    () => unternehmen.filter(u => u.fields.status?.key === 'inaktiv'),
    [unternehmen],
  );

  const filteredUnternehmen = useMemo(() => {
    if (!statusFilter) return unternehmen;
    return unternehmen.filter(u => u.fields.status?.key === statusFilter);
  }, [unternehmen, statusFilter]);

  const bevorstehende = useMemo(
    () =>
      enrichedTermine
        .filter(t => {
          const d = t.fields.datum_uhrzeit;
          return d && d >= today && d <= in7days && t.fields.terminstatus?.key !== 'abgesagt';
        })
        .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedTermine, today, in7days],
  );

  const ueberfaelligeTermine = useMemo(
    () =>
      enrichedTermine.filter(
        t => t.fields.datum_uhrzeit && t.fields.datum_uhrzeit < today && t.fields.terminstatus?.key === 'geplant',
      ),
    [enrichedTermine, today],
  );

  // Calendar events
  const calendarEvents = useMemo<CalendarEvent[]>(
    () =>
      enrichedTermine
        .filter(t => !!t.fields.datum_uhrzeit)
        .map(t => {
          const key = t.fields.terminstatus?.key;
          let tone: CalendarTone = 'primary';
          if (key === 'stattgefunden') tone = 'success';
          else if (key === 'abgesagt') tone = 'default';
          else if (t.fields.datum_uhrzeit! < today) tone = 'destructive';
          return {
            id: `termin:${t.record_id}`,
            start: t.fields.datum_uhrzeit!,
            title: t.fields.terminbezeichnung ?? 'Termin',
            subtitle: t.unternehmenName || t.fields.terminart?.label,
            tone,
          };
        }),
    [enrichedTermine, today],
  );

  // Resolve helpers for overlay
  const findUnternehmen = useCallback((id: string) => unternehmen.find(u => u.record_id === id), [unternehmen]);
  const findTermin = useCallback((id: string) => termine.find(t => t.record_id === id), [termine]);
  const findDokument = useCallback((id: string) => dokumente.find(d => d.record_id === id), [dokumente]);
  const findNotiz = useCallback((id: string) => notizen.find(n => n.record_id === id), [notizen]);

  // Advance termin status
  const markTerminStattgefunden = useCallback(
    async (t: Termine) => {
      const prev = t.fields.terminstatus;
      setTermine(ts => ts.map(x => x.record_id === t.record_id ? { ...x, fields: { ...x.fields, terminstatus: { key: 'stattgefunden', label: 'Stattgefunden' } } } : x));
      try {
        await LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: 'stattgefunden' });
        undoToast(`"${t.fields.terminbezeichnung}" als stattgefunden markiert`, async () => {
          setTermine(ts => ts.map(x => x.record_id === t.record_id ? { ...x, fields: { ...x.fields, terminstatus: prev } } : x));
          await LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: prev?.key ?? null as any });
        });
      } catch {
        await fetchAll();
      }
    },
    [setTermine, fetchAll],
  );

  // Context line
  const contextLine = useMemo(() => {
    if (bevorstehende.length === 0 && ueberfaelligeTermine.length === 0) {
      return `${unternehmen.length} Beteiligung${unternehmen.length !== 1 ? 'en' : ''} im Portfolio — alles im Plan.`;
    }
    const parts: string[] = [];
    if (bevorstehende.length > 0) {
      const firmenNamen = bevorstehende.slice(0, 2).map(t => t.unternehmenName || t.fields.terminbezeichnung || '');
      parts.push(`Nächste Termine: ${namen(firmenNamen)}`);
    }
    if (ueberfaelligeTermine.length > 0) {
      parts.push(`${ueberfaelligeTermine.length} Termin${ueberfaelligeTermine.length !== 1 ? 'e' : ''} offen`);
    }
    return parts.join(' · ');
  }, [bevorstehende, ueberfaelligeTermine, unternehmen]);

  // ─── Every hook goes ABOVE this line ───
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;
  // ─── Below this line: plain derivations only ───

  const gesamtKapital = unternehmen.reduce((s, u) => s + (u.fields.investiertes_kapital ?? 0), 0);
  const gesamtWert = unternehmen.reduce((s, u) => s + (u.fields.aktueller_wert ?? 0), 0);

  // Helpers to open context dialogs from hub overlay
  const openTermineForUnternehmen = (u: Unternehmen) => {
    setTermineDefaults({ unternehmen: u.record_id });
    setEditingTermineId(undefined);
    setTermineDialogOpen(true);
  };
  const openDokumenteForUnternehmen = (u: Unternehmen) => {
    setDokumenteDefaults({ unternehmen: u.record_id });
    setEditingDokumenteId(undefined);
    setDokumenteDialogOpen(true);
  };
  const openNotizenForUnternehmen = (u: Unternehmen) => {
    setNotizenDefaults({ unternehmen: u.record_id });
    setEditingNotizenId(undefined);
    setNotizenDialogOpen(true);
  };

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <button
          onClick={() => {
            setEditingUnternehmen(undefined);
            setEditingUnternehmenId(undefined);
            setUnternehmenDialogOpen(true);
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <IconPlus size={16} className="shrink-0" />
          <span className="hidden sm:inline">Beteiligung</span>
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          ueberfaelligeTermine.length > 0 ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: 'Termin abhaken',
                onClick: () => void markTerminStattgefunden(ueberfaelligeTermine[0]),
              }}
            >
              <b>{namen(ueberfaelligeTermine.map(t => t.fields.terminbezeichnung ?? ''))}</b>
              {ueberfaelligeTermine.length === 1
                ? ` — geplant für ${formatDateTime(ueberfaelligeTermine[0].fields.datum_uhrzeit)}, noch offen.`
                : ` — ${ueberfaelligeTermine.length} Termine noch nicht als stattgefunden markiert.`}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title="Beteiligungen"
              value={unternehmen.length}
              icon={<IconBuilding size={16} className="shrink-0" />}
            />
            <StatStripItem
              title="Aktiv"
              value={aktiveUnternehmen.length}
              tone={aktiveUnternehmen.length > 0 ? 'success' : 'default'}
              icon={<IconTrendingUp size={16} className="shrink-0" />}
              onClick={() => setStatusFilter(f => f === 'aktiv' ? null : 'aktiv')}
              active={statusFilter === 'aktiv'}
            />
            <StatStripItem
              title="Inaktiv"
              value={inaktiveUnternehmen.length}
              tone={inaktiveUnternehmen.length > 0 ? 'warning' : 'default'}
              icon={<IconBriefcase size={16} className="shrink-0" />}
              onClick={() => setStatusFilter(f => f === 'inaktiv' ? null : 'inaktiv')}
              active={statusFilter === 'inaktiv'}
            />
            <StatStripItem
              title="Termine (7 Tage)"
              value={bevorstehende.length}
              tone={bevorstehende.length > 0 ? 'primary' : 'default'}
              icon={<IconCalendarEvent size={16} className="shrink-0" />}
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
          <CalendarWidget
            events={calendarEvents}
            locale={de}
            onEventClick={ev => {
              const id = ev.id.split(':')[1];
              if (id) overlay.replace({ type: 'termin', id });
            }}
            onEmptyClick={date => {
              setTermineDefaults({ datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm") });
              setEditingTermineId(undefined);
              setTermineDialogOpen(true);
            }}
          />
        }
        aside={
          <>
            {/* Hub cockpit — Unternehmen cards */}
            <WorkList
              title="Portfolio-Unternehmen"
              max={8}
              items={filteredUnternehmen.map(u => {
                const uTermine = termine.filter(t => extractRecordId(t.fields.unternehmen) === u.record_id);
                const nextTermin = uTermine
                  .filter(t => t.fields.datum_uhrzeit && t.fields.datum_uhrzeit >= today && t.fields.terminstatus?.key !== 'abgesagt')
                  .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? ''))[0];
                const uDokumente = dokumente.filter(d => extractRecordId(d.fields.unternehmen) === u.record_id);
                const uNotizen = notizen.filter(n => extractRecordId(n.fields.unternehmen) === u.record_id);
                const isExit = u.fields.status?.key === 'exit';
                return {
                  id: u.record_id,
                  title: u.fields.name ?? '—',
                  secondLine: (
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className={
                        u.fields.status?.key === 'aktiv' ? 'font-medium text-emerald-600' :
                        u.fields.status?.key === 'inaktiv' ? 'text-amber-600' :
                        'text-muted-foreground'
                      }>
                        {u.fields.status?.label ?? '—'}
                      </span>
                      {u.fields.branche && (
                        <span className="text-muted-foreground">· {u.fields.branche.label}</span>
                      )}
                      {nextTermin && (
                        <span className="text-muted-foreground">· {formatDateTime(nextTermin.fields.datum_uhrzeit)}</span>
                      )}
                      <span className="text-muted-foreground">
                        · {uTermine.length}T {uDokumente.length}D {uNotizen.length}N
                      </span>
                    </span>
                  ),
                  action: !isExit ? {
                    label: '+ Termin',
                    onClick: () => openTermineForUnternehmen(u),
                  } : undefined,
                };
              })}
              onItemClick={id => overlay.replace({ type: 'unternehmen', id })}
              empty={{
                text: 'Noch keine Beteiligungen — erste anlegen',
                action: {
                  label: 'Beteiligung anlegen',
                  onClick: () => {
                    setEditingUnternehmen(undefined);
                    setEditingUnternehmenId(undefined);
                    setUnternehmenDialogOpen(true);
                  },
                },
              }}
            />

            {/* Upcoming termine */}
            <WorkList
              title="Nächste 7 Tage"
              max={5}
              items={bevorstehende.map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? '—',
                secondLine: (
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">{t.unternehmenName}</span>
                    <span className="text-muted-foreground">· {formatDateTime(t.fields.datum_uhrzeit)}</span>
                    {t.fields.terminart && (
                      <span className="text-muted-foreground">· {t.fields.terminart.label}</span>
                    )}
                  </span>
                ),
                action: {
                  label: <><IconCheck size={14} className="shrink-0" /> Abhaken</>,
                  onClick: () => void markTerminStattgefunden(t),
                },
              }))}
              onItemClick={id => overlay.replace({ type: 'termin', id })}
              empty={{
                text: 'Keine Termine in den nächsten 7 Tagen',
                action: {
                  label: 'Termin anlegen',
                  onClick: () => {
                    setTermineDefaults(undefined);
                    setEditingTermineId(undefined);
                    setTermineDialogOpen(true);
                  },
                },
              }}
            />
          </>
        }
      />

      {/* Overlay host — single shell for all entity types */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'unternehmen') {
            const u = findUnternehmen(top.id);
            if (!u) return null;
            return (
              <>
                <RecordHeader
                  title={u.fields.name ?? '—'}
                  subtitle={[u.fields.rechtsform?.label, u.fields.stadt, u.fields.land].filter(Boolean).join(' · ')}
                  badges={
                    u.fields.status ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.fields.status.key === 'aktiv' ? 'bg-emerald-100 text-emerald-700' :
                        u.fields.status.key === 'inaktiv' ? 'bg-amber-100 text-amber-700' :
                        'bg-muted text-muted-foreground'
                      }`}>{u.fields.status.label}</span>
                    ) : undefined
                  }
                />
                <UnternehmenDetails
                  record={u}
                  termineList={termine}
                  onOpenTermine={t => overlay.push({ type: 'termin', id: t.record_id })}
                  onAddTermine={() => openTermineForUnternehmen(u)}
                  dokumenteList={dokumente}
                  onOpenDokumente={d => overlay.push({ type: 'dokument', id: d.record_id })}
                  onAddDokumente={() => openDokumenteForUnternehmen(u)}
                  notizenList={notizen}
                  onOpenNotizen={n => overlay.push({ type: 'notiz', id: n.record_id })}
                  onAddNotizen={() => openNotizenForUnternehmen(u)}
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
                  title={t.fields.terminbezeichnung ?? '—'}
                  subtitle={t.fields.terminart?.label}
                  meta={formatDateTime(t.fields.datum_uhrzeit)}
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
                  title={d.fields.dokumentenbezeichnung ?? '—'}
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
                  title={n.fields.notiz_titel ?? '—'}
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
            if (!u) return;
            setEditingUnternehmen(u.fields as UnternehmenDialogDefaults);
            setEditingUnternehmenId(u.record_id);
            setUnternehmenDialogOpen(true);
          } else if (top.type === 'termin') {
            const t = findTermin(top.id);
            if (!t) return;
            setTermineDefaults(t.fields as TermineDialogDefaults);
            setEditingTermineId(t.record_id);
            setTermineDialogOpen(true);
          } else if (top.type === 'dokument') {
            const d = findDokument(top.id);
            if (!d) return;
            setDokumenteDefaults(d.fields as DokumenteDialogDefaults);
            setEditingDokumenteId(d.record_id);
            setDokumenteDialogOpen(true);
          } else if (top.type === 'notiz') {
            const n = findNotiz(top.id);
            if (!n) return;
            setNotizenDefaults(n.fields as NotizenDialogDefaults);
            setEditingNotizenId(n.record_id);
            setNotizenDialogOpen(true);
          }
        }}
        footer={top => {
          if (top.type === 'termin') {
            const t = findTermin(top.id);
            if (t && t.fields.terminstatus?.key === 'geplant') {
              return {
                label: '✓ Als stattgefunden markieren',
                onClick: () => {
                  void markTerminStattgefunden(t);
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
        onClose={() => setUnternehmenDialogOpen(false)}
        onSubmit={async fields => {
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
        open={termineDialogOpen}
        onClose={() => setTermineDialogOpen(false)}
        onSubmit={async fields => {
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
        open={dokumenteDialogOpen}
        onClose={() => setDokumenteDialogOpen(false)}
        onSubmit={async fields => {
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
        open={notizenDialogOpen}
        onClose={() => setNotizenDialogOpen(false)}
        onSubmit={async fields => {
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
