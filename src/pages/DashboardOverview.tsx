import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine, enrichDokumente, enrichNotizen } from '@/lib/enrich';
import type { EnrichedTermine, EnrichedDokumente, EnrichedNotizen } from '@/types/enriched';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/formatters';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { HeroBanner } from '@/components/HeroBanner';
import {
  useRecordOverlayStack,
  RecordOverlayHost,
  RecordHeader,
  RecordField,
  RecordSection,
} from '@/components/widgets/RecordView';
import { CalendarWidget } from '@/components/widgets/CalendarWidget';
import type { CalendarEvent } from '@/components/widgets/CalendarWidget';
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
import { Button } from '@/components/ui/button';
import {
  IconPlus, IconBuildingSkyscraper, IconCalendarEvent,
  IconFileText, IconNotes, IconAlertTriangle,
  IconTrendingUp, IconCheckbox,
} from '@tabler/icons-react';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';

type OverlayItem =
  | { type: 'unternehmen'; id: string }
  | { type: 'termine'; id: string }
  | { type: 'dokumente'; id: string }
  | { type: 'notizen'; id: string };

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
  const [unternehmenDialog, setUnternehmenDialog] = useState(false);
  const [unternehmenDefaults, setUnternehmenDefaults] = useState<UnternehmenDialogDefaults | undefined>();
  const [editingUnternehmen, setEditingUnternehmen] = useState<Unternehmen | null>(null);

  const [termineDialog, setTermineDialog] = useState(false);
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>();
  const [editingTermine, setEditingTermine] = useState<Termine | null>(null);

  const [dokumenteDialog, setDokumenteDialog] = useState(false);
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>();
  const [editingDokumente, setEditingDokumente] = useState<Dokumente | null>(null);

  const [notizenDialog, setNotizenDialog] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>();
  const [editingNotizen, setEditingNotizen] = useState<Notizen | null>(null);

  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const enrichedTermine = useMemo(() => enrichTermine(termine, { unternehmenMap }), [termine, unternehmenMap]);
  const enrichedDokumente = useMemo(() => enrichDokumente(dokumente, { unternehmenMap }), [dokumente, unternehmenMap]);
  const enrichedNotizen = useMemo(() => enrichNotizen(notizen, { unternehmenMap }), [notizen, unternehmenMap]);

  const todayStr = format(clock, 'yyyy-MM-dd');

  // Filtered unternehmen
  const filteredUnternehmen = useMemo(() =>
    statusFilter
      ? unternehmen.filter(u => u.fields.status?.key === statusFilter)
      : unternehmen,
    [unternehmen, statusFilter]
  );

  // KPIs
  const aktiv = useMemo(() => unternehmen.filter(u => u.fields.status?.key === 'aktiv'), [unternehmen]);
  const exits = useMemo(() => unternehmen.filter(u => u.fields.status?.key === 'exit'), [unternehmen]);
  const totalInvestiert = useMemo(() =>
    unternehmen.reduce((s, u) => s + (u.fields.investiertes_kapital ?? 0), 0), [unternehmen]);
  const totalWert = useMemo(() =>
    unternehmen.reduce((s, u) => s + (u.fields.aktueller_wert ?? 0), 0), [unternehmen]);

  // Upcoming appointments (next 30 days, geplant)
  const upcoming = useMemo(() => {
    const limit = format(addDays(clock, 30), "yyyy-MM-dd'T'HH:mm");
    return enrichedTermine
      .filter(t =>
        t.fields.datum_uhrzeit &&
        t.fields.datum_uhrzeit >= todayStr &&
        t.fields.datum_uhrzeit <= limit &&
        t.fields.terminstatus?.key !== 'abgesagt'
      )
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? ''));
  }, [enrichedTermine, todayStr, clock]);

  // Overdue appointments (geplant, in the past)
  const overdueTermine = useMemo(() =>
    enrichedTermine.filter(t =>
      t.fields.datum_uhrzeit &&
      t.fields.datum_uhrzeit < format(clock, "yyyy-MM-dd'T'HH:mm") &&
      t.fields.terminstatus?.key === 'geplant'
    ),
    [enrichedTermine, clock]
  );

  // Recent notizen
  const recentNotizen = useMemo(() =>
    [...enrichedNotizen]
      .sort((a, b) => (b.fields.notiz_datum ?? '').localeCompare(a.fields.notiz_datum ?? ''))
      .slice(0, 8),
    [enrichedNotizen]
  );

  // Calendar events from termine
  const calendarEvents = useMemo((): CalendarEvent[] =>
    termine
      .filter(t => t.fields.datum_uhrzeit)
      .map(t => {
        const unterName = unternehmenMap.get(extractRecordId(t.fields.unternehmen) ?? '')?.fields.name ?? '';
        const status = t.fields.terminstatus?.key;
        const tone: CalendarEvent['tone'] =
          status === 'abgesagt' ? 'warning' :
          status === 'stattgefunden' ? 'success' :
          t.fields.datum_uhrzeit! < format(clock, "yyyy-MM-dd'T'HH:mm") ? 'destructive' :
          'default';
        return {
          id: t.record_id,
          start: t.fields.datum_uhrzeit!,
          title: t.fields.terminbezeichnung ?? 'Termin',
          subtitle: unterName || t.fields.terminart?.label,
          tone,
        };
      }),
    [termine, unternehmenMap, clock]
  );

  // Advance termine status
  const advanceTerminStatus = useCallback(async (termin: Termine) => {
    const prev = termin.fields.terminstatus?.key;
    const next = prev === 'geplant' ? 'stattgefunden' : undefined;
    if (!next) return;
    const snapshot = { ...termin, fields: { ...termin.fields, terminstatus: termin.fields.terminstatus } };
    setTermine(ts => ts.map(t =>
      t.record_id === termin.record_id
        ? { ...t, fields: { ...t.fields, terminstatus: { key: next, label: 'Stattgefunden' } } }
        : t
    ));
    undoToast(`Termin als "Stattgefunden" markiert`, async () => {
      setTermine(ts => ts.map(t => t.record_id === termin.record_id ? snapshot : t));
      await LivingAppsService.updateTermineEntry(termin.record_id, { terminstatus: snapshot.fields.terminstatus?.key as any });
    });
    LivingAppsService.updateTermineEntry(termin.record_id, { terminstatus: next as any }).catch(() => fetchAll());
  }, [setTermine, fetchAll]);

  // Context line
  const contextLine = useMemo(() => {
    const parts: string[] = [];
    if (aktiv.length > 0) parts.push(`${aktiv.length} aktive Beteiligung${aktiv.length !== 1 ? 'en' : ''}`);
    if (upcoming.length > 0) {
      const names = namen(upcoming.slice(0, 2).map(t => t.fields.terminbezeichnung ?? ''));
      parts.push(`nächster Termin: ${names}`);
    }
    return parts.length > 0 ? parts.join(' — ') : 'Dein Beteiligungsportfolio auf einen Blick.';
  }, [aktiv, upcoming]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const overlayUnternehmenRecord = overlay.top?.type === 'unternehmen'
    ? unternehmen.find(u => u.record_id === overlay.top!.id) ?? null
    : null;
  const overlayTermineRecord = overlay.top?.type === 'termine'
    ? termine.find(t => t.record_id === overlay.top!.id) ?? null
    : null;
  const overlayDokumenteRecord = overlay.top?.type === 'dokumente'
    ? dokumente.find(d => d.record_id === overlay.top!.id) ?? null
    : null;
  const overlayNotizenRecord = overlay.top?.type === 'notizen'
    ? notizen.find(n => n.record_id === overlay.top!.id) ?? null
    : null;

  return (
    <>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1">{contextLine}</p>
        </div>
        <Button onClick={() => { setUnternehmenDefaults(undefined); setEditingUnternehmen(null); setUnternehmenDialog(true); }} className="shrink-0">
          <IconPlus size={16} className="mr-2 shrink-0" />
          <span className="hidden sm:inline">Unternehmen</span>
        </Button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={overdueTermine.length > 0 ? (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: 'Als stattgefunden markieren',
              onClick: () => advanceTerminStatus(overdueTermine[0]),
            }}
          >
            <b>{namen(overdueTermine.map(t => t.fields.terminbezeichnung ?? ''))}</b>
            {' '}— {overdueTermine.length === 1 ? 'Termin noch als „Geplant"' : `${overdueTermine.length} Termine noch als „Geplant"`}, obwohl der Zeitpunkt verstrichen ist.
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatStrip>
            <StatStripItem
              title="Aktiv"
              value={aktiv.length}
              icon={<IconBuildingSkyscraper size={16} />}
              tone={aktiv.length > 0 ? 'success' : 'default'}
              onClick={() => setStatusFilter(f => f === 'aktiv' ? null : 'aktiv')}
              active={statusFilter === 'aktiv'}
            />
            <StatStripItem
              title="Investiert"
              value={totalInvestiert > 0 ? formatCurrency(totalInvestiert) : '—'}
              icon={<IconTrendingUp size={16} />}
              tone="default"
            />
            <StatStripItem
              title="Portfoliowert"
              value={totalWert > 0 ? formatCurrency(totalWert) : '—'}
              icon={<IconTrendingUp size={16} />}
              tone={totalWert > totalInvestiert ? 'success' : totalWert > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title="Exits"
              value={exits.length}
              icon={<IconCheckbox size={16} />}
              tone="default"
              onClick={() => setStatusFilter(f => f === 'exit' ? null : 'exit')}
              active={statusFilter === 'exit'}
            />
            <StatStripItem
              title="Termine (30 Tage)"
              value={upcoming.length}
              icon={<IconCalendarEvent size={16} />}
              tone={upcoming.length > 0 ? 'primary' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <CalendarWidget
            events={calendarEvents}
            defaultView="week"
            locale={de}
            weekDays={5}
            onEventClick={ev => overlay.replace({ type: 'termine', id: ev.id })}
            onEmptyClick={(date) => {
              setTermineDefaults({ datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm") });
              setEditingTermine(null);
              setTermineDialog(true);
            }}
            onEventDrop={async (eventId, newStart) => {
              const t = termine.find(x => x.record_id === eventId);
              if (!t) return;
              const snapshot = { ...t, fields: { ...t.fields } };
              setTermine(ts => ts.map(x =>
                x.record_id === eventId
                  ? { ...x, fields: { ...x.fields, datum_uhrzeit: newStart } }
                  : x
              ));
              undoToast('Termin verschoben', async () => {
                setTermine(ts => ts.map(x => x.record_id === eventId ? snapshot : x));
                await LivingAppsService.updateTermineEntry(eventId, { datum_uhrzeit: snapshot.fields.datum_uhrzeit as any });
              });
              LivingAppsService.updateTermineEntry(eventId, { datum_uhrzeit: newStart as any }).catch(() => fetchAll());
            }}
          />
        }
        aside={
          <>
            {/* Portfolio-Cockpit: Beteiligungen als klickbare Karten */}
            <WorkList
              title="Portfolio"
              items={filteredUnternehmen.map(u => ({
                id: u.record_id,
                title: u.fields.name ?? '—',
                secondLine: (
                  <>
                    {u.fields.status?.key === 'aktiv' && <span className="font-medium text-success">Aktiv</span>}
                    {u.fields.status?.key === 'inaktiv' && <span className="font-medium text-muted-foreground">Inaktiv</span>}
                    {u.fields.status?.key === 'exit' && <span className="font-medium text-warning">Exit</span>}
                    {u.fields.branche && <span className="text-muted-foreground"> · {u.fields.branche.label}</span>}
                    {u.fields.investiertes_kapital != null && (
                      <span className="text-muted-foreground"> · {formatCurrency(u.fields.investiertes_kapital)}</span>
                    )}
                  </>
                ),
                action: {
                  label: '+ Termin',
                  onClick: () => {
                    setTermineDefaults({ unternehmen: u.record_id });
                    setEditingTermine(null);
                    setTermineDialog(true);
                  },
                },
              }))}
              onItemClick={id => overlay.replace({ type: 'unternehmen', id })}
              empty={{
                text: 'Noch keine Beteiligungen — leg die erste an.',
                action: {
                  label: 'Unternehmen anlegen',
                  onClick: () => { setUnternehmenDefaults(undefined); setEditingUnternehmen(null); setUnternehmenDialog(true); },
                },
              }}
            />

            {/* Letzte Notizen */}
            <WorkList
              title="Letzte Notizen"
              items={recentNotizen.map(n => ({
                id: n.record_id,
                title: n.fields.notiz_titel ?? '—',
                secondLine: (
                  <>
                    {n.fields.prioritaet?.key === 'hoch' && <span className="font-medium text-destructive">Hohe Priorität</span>}
                    {n.fields.prioritaet?.key === 'mittel' && <span className="font-medium text-warning">Mittel</span>}
                    {n.fields.prioritaet?.key === 'niedrig' && <span className="text-muted-foreground">Niedrig</span>}
                    {n.unternehmenName && <span className="text-muted-foreground"> · {n.unternehmenName}</span>}
                    {n.fields.notiz_datum && <span className="text-muted-foreground"> · {formatDate(n.fields.notiz_datum)}</span>}
                  </>
                ),
                action: {
                  label: 'Öffnen',
                  onClick: () => overlay.replace({ type: 'notizen', id: n.record_id }),
                },
              }))}
              onItemClick={id => overlay.replace({ type: 'notizen', id })}
              empty={{
                text: 'Noch keine Notizen vorhanden.',
                action: {
                  label: 'Notiz anlegen',
                  onClick: () => { setNotizenDefaults(undefined); setEditingNotizen(null); setNotizenDialog(true); },
                },
              }}
            />
          </>
        }
      />

      {/* Overlay host — one shell for the whole multi-type stack */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'unternehmen' && overlayUnternehmenRecord) {
            return (
              <>
                <RecordHeader
                  title={overlayUnternehmenRecord.fields.name ?? '—'}
                  subtitle={[
                    overlayUnternehmenRecord.fields.branche?.label,
                    overlayUnternehmenRecord.fields.rechtsform?.label,
                    overlayUnternehmenRecord.fields.stadt,
                  ].filter(Boolean).join(' · ')}
                  badges={
                    overlayUnternehmenRecord.fields.status && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        overlayUnternehmenRecord.fields.status.key === 'aktiv' ? 'bg-success/10 text-success' :
                        overlayUnternehmenRecord.fields.status.key === 'exit' ? 'bg-warning/10 text-warning' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {overlayUnternehmenRecord.fields.status.label}
                      </span>
                    )
                  }
                />
                <UnternehmenDetails
                  record={overlayUnternehmenRecord}
                  termineList={termine}
                  onOpenTermine={r => overlay.push({ type: 'termine', id: r.record_id })}
                  onAddTermine={() => {
                    setTermineDefaults({ unternehmen: overlayUnternehmenRecord.record_id });
                    setEditingTermine(null);
                    setTermineDialog(true);
                  }}
                  dokumenteList={dokumente}
                  onOpenDokumente={r => overlay.push({ type: 'dokumente', id: r.record_id })}
                  onAddDokumente={() => {
                    setDokumenteDefaults({ unternehmen: overlayUnternehmenRecord.record_id });
                    setEditingDokumente(null);
                    setDokumenteDialog(true);
                  }}
                  notizenList={notizen}
                  onOpenNotizen={r => overlay.push({ type: 'notizen', id: r.record_id })}
                  onAddNotizen={() => {
                    setNotizenDefaults({ unternehmen: overlayUnternehmenRecord.record_id });
                    setEditingNotizen(null);
                    setNotizenDialog(true);
                  }}
                />
              </>
            );
          }
          if (top.type === 'termine' && overlayTermineRecord) {
            const unt = unternehmen.find(u => u.record_id === extractRecordId(overlayTermineRecord.fields.unternehmen));
            return (
              <>
                <RecordHeader
                  title={overlayTermineRecord.fields.terminbezeichnung ?? 'Termin'}
                  subtitle={[
                    overlayTermineRecord.fields.terminart?.label,
                    unt?.fields.name,
                  ].filter(Boolean).join(' · ')}
                />
                <TermineDetails
                  record={overlayTermineRecord}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={r => overlay.push({ type: 'unternehmen', id: r.record_id })}
                />
              </>
            );
          }
          if (top.type === 'dokumente' && overlayDokumenteRecord) {
            return (
              <>
                <RecordHeader
                  title={overlayDokumenteRecord.fields.dokumentenbezeichnung ?? 'Dokument'}
                  subtitle={overlayDokumenteRecord.fields.dokumententyp?.label}
                />
                <DokumenteDetails
                  record={overlayDokumenteRecord}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={r => overlay.push({ type: 'unternehmen', id: r.record_id })}
                />
              </>
            );
          }
          if (top.type === 'notizen' && overlayNotizenRecord) {
            return (
              <>
                <RecordHeader
                  title={overlayNotizenRecord.fields.notiz_titel ?? 'Notiz'}
                  subtitle={overlayNotizenRecord.fields.kategorie?.label}
                />
                <NotizenDetails
                  record={overlayNotizenRecord}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={r => overlay.push({ type: 'unternehmen', id: r.record_id })}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={top => {
          if (top.type === 'unternehmen' && overlayUnternehmenRecord) {
            setEditingUnternehmen(overlayUnternehmenRecord);
            setUnternehmenDefaults(overlayUnternehmenRecord.fields as any);
            setUnternehmenDialog(true);
          } else if (top.type === 'termine' && overlayTermineRecord) {
            setEditingTermine(overlayTermineRecord);
            setTermineDefaults(overlayTermineRecord.fields as any);
            setTermineDialog(true);
          } else if (top.type === 'dokumente' && overlayDokumenteRecord) {
            setEditingDokumente(overlayDokumenteRecord);
            setDokumenteDefaults(overlayDokumenteRecord.fields as any);
            setDokumenteDialog(true);
          } else if (top.type === 'notizen' && overlayNotizenRecord) {
            setEditingNotizen(overlayNotizenRecord);
            setNotizenDefaults(overlayNotizenRecord.fields as any);
            setNotizenDialog(true);
          }
        }}
        footer={top => {
          if (top.type === 'termine') {
            const rec = termine.find(t => t.record_id === top.id);
            if (rec && rec.fields.terminstatus?.key === 'geplant') {
              return {
                label: '✓ Als stattgefunden markieren',
                onClick: () => { advanceTerminStatus(rec); overlay.close(); },
              };
            }
          }
          return undefined;
        }}
      />

      {/* Dialogs */}
      <UnternehmenDialog
        open={unternehmenDialog}
        onClose={() => setUnternehmenDialog(false)}
        onSubmit={async (fields) => {
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
        open={termineDialog}
        onClose={() => setTermineDialog(false)}
        onSubmit={async (fields) => {
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
        open={dokumenteDialog}
        onClose={() => setDokumenteDialog(false)}
        onSubmit={async (fields) => {
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
        open={notizenDialog}
        onClose={() => setNotizenDialog(false)}
        onSubmit={async (fields) => {
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
