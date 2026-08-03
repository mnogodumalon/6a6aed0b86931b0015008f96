import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isAfter, isBefore, addDays, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  IconCalendar, IconPlus, IconBuilding, IconAlertTriangle,
  IconClipboardList, IconNotes, IconTrendingUp, IconCheck,
} from '@tabler/icons-react';

import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine } from '@/lib/enrich';
import type { EnrichedTermine } from '@/types/enriched';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';

import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';

import { CalendarWidget } from '@/components/widgets/CalendarWidget';
import type { CalendarEvent } from '@/components/widgets/CalendarWidget';
import { ChartWidget } from '@/components/widgets/ChartWidget';
import type { ChartRow } from '@/components/widgets/ChartWidget';

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

type OverlayItem =
  | { type: 'unternehmen'; record: Unternehmen }
  | { type: 'termin'; record: Termine }
  | { type: 'dokument'; record: Dokumente }
  | { type: 'notiz'; record: Notizen };

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
  const overlay = useRecordOverlayStack<OverlayItem>();

  // ── Dialog state ────────────────────────────────────────────────────────
  const [unternehmenDialog, setUnternehmenDialog] = useState(false);
  const [editingUnternehmen, setEditingUnternehmen] = useState<UnternehmenDialogDefaults | undefined>();
  const [editingUnternehmenId, setEditingUnternehmenId] = useState<string | undefined>();

  const [termineDialog, setTermineDialog] = useState(false);
  const [editingTermin, setEditingTermin] = useState<TermineDialogDefaults | undefined>();
  const [editingTerminId, setEditingTerminId] = useState<string | undefined>();

  const [dokumenteDialog, setDokumenteDialog] = useState(false);
  const [editingDokument, setEditingDokument] = useState<DokumenteDialogDefaults | undefined>();
  const [editingDokumentId, setEditingDokumentId] = useState<string | undefined>();

  const [notizenDialog, setNotizenDialog] = useState(false);
  const [editingNotiz, setEditingNotiz] = useState<NotizenDialogDefaults | undefined>();
  const [editingNotizId, setEditingNotizId] = useState<string | undefined>();

  // ── Enrichment ──────────────────────────────────────────────────────────
  const enrichedTermine = useMemo(
    () => enrichTermine(termine, { unternehmenMap }),
    [termine, unternehmenMap],
  );

  // ── Derived data ────────────────────────────────────────────────────────
  const today = format(clock, 'yyyy-MM-dd');
  const nextWeek = format(addDays(clock, 7), 'yyyy-MM-dd');

  const aktiveUnternehmen = useMemo(
    () => unternehmen.filter(u => u.fields.status?.key === 'aktiv'),
    [unternehmen],
  );

  const gesamtKapital = useMemo(
    () => unternehmen.reduce((s, u) => s + (u.fields.investiertes_kapital ?? 0), 0),
    [unternehmen],
  );

  const bevorstehendTermine = useMemo(
    () =>
      enrichedTermine
        .filter(t => {
          const dt = t.fields.datum_uhrzeit;
          return dt && dt >= today && t.fields.terminstatus?.key !== 'abgesagt';
        })
        .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedTermine, today],
  );

  const ueberfaelligeTermine = useMemo(
    () =>
      enrichedTermine.filter(t => {
        const dt = t.fields.datum_uhrzeit;
        return (
          dt &&
          dt < today &&
          t.fields.terminstatus?.key === 'geplant'
        );
      }),
    [enrichedTermine, today],
  );

  // ── Calendar events mapping ─────────────────────────────────────────────
  const calEvents = useMemo<CalendarEvent[]>(
    () =>
      termine.map(t => {
        const unternName = unternehmenMap.get(extractRecordId(t.fields.unternehmen) ?? '')?.fields.name ?? '';
        const status = t.fields.terminstatus?.key;
        const tone =
          status === 'stattgefunden' ? 'success'
          : status === 'abgesagt' ? 'default'
          : t.fields.datum_uhrzeit && t.fields.datum_uhrzeit < today ? 'destructive'
          : 'primary';
        return {
          id: t.record_id,
          start: t.fields.datum_uhrzeit ?? today,
          title: t.fields.terminbezeichnung ?? 'Termin',
          subtitle: unternName,
          tone,
        } as CalendarEvent;
      }),
    [termine, unternehmenMap, today],
  );

  // ── Calendar drag write ─────────────────────────────────────────────────
  const handleEventDrop = useCallback(async (eventId: string, newStart: string) => {
    const termin = termine.find(t => t.record_id === eventId);
    if (!termin) return;
    const prev = termin.fields.datum_uhrzeit;
    setTermine(ts => ts.map(t => t.record_id === eventId ? { ...t, fields: { ...t.fields, datum_uhrzeit: newStart } } : t));
    undoToast(
      `Termin auf ${formatDateTime(newStart)} verschoben`,
      async () => {
        setTermine(ts => ts.map(t => t.record_id === eventId ? { ...t, fields: { ...t.fields, datum_uhrzeit: prev } } : t));
        await LivingAppsService.updateTermineEntry(eventId, { datum_uhrzeit: prev });
      },
    );
    try {
      await LivingAppsService.updateTermineEntry(eventId, { datum_uhrzeit: newStart });
    } catch {
      setTermine(ts => ts.map(t => t.record_id === eventId ? { ...t, fields: { ...t.fields, datum_uhrzeit: prev } } : t));
      fetchAll();
    }
  }, [termine, setTermine, fetchAll]);

  // ── Advance termin status ───────────────────────────────────────────────
  const advanceTermin = useCallback(async (t: EnrichedTermine) => {
    const newStatus = 'stattgefunden';
    const prev = t.fields.terminstatus;
    setTermine(ts =>
      ts.map(x => x.record_id === t.record_id
        ? { ...x, fields: { ...x.fields, terminstatus: { key: newStatus, label: 'Stattgefunden' } } }
        : x,
      ),
    );
    undoToast(`"${t.fields.terminbezeichnung}" als stattgefunden markiert`, async () => {
      setTermine(ts =>
        ts.map(x => x.record_id === t.record_id ? { ...x, fields: { ...x.fields, terminstatus: prev } } : x),
      );
      await LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: prev?.key ?? null as any });
    });
    try {
      await LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: newStatus });
    } catch {
      setTermine(ts =>
        ts.map(x => x.record_id === t.record_id ? { ...x, fields: { ...x.fields, terminstatus: prev } } : x),
      );
      fetchAll();
    }
  }, [setTermine, fetchAll]);

  // ── Open helpers ────────────────────────────────────────────────────────
  const openCreateTermin = useCallback((defaults?: TermineDialogDefaults) => {
    setEditingTermin(defaults);
    setEditingTerminId(undefined);
    setTermineDialog(true);
  }, []);

  const openCreateDokument = useCallback((defaults?: DokumenteDialogDefaults) => {
    setEditingDokument(defaults);
    setEditingDokumentId(undefined);
    setDokumenteDialog(true);
  }, []);

  const openCreateNotiz = useCallback((defaults?: NotizenDialogDefaults) => {
    setEditingNotiz(defaults);
    setEditingNotizId(undefined);
    setNotizenDialog(true);
  }, []);

  // ── Chart rows ──────────────────────────────────────────────────────────
  const branchenRows = useMemo<ChartRow<Unternehmen>[]>(
    () => unternehmen.map(u => ({ id: `unternehmen:${u.record_id}`, data: u })),
    [unternehmen],
  );

  // ── Context line ────────────────────────────────────────────────────────
  const naechsterName = bevorstehendTermine[0]?.unternehmenName || bevorstehendTermine[0]?.fields.terminbezeichnung || '';
  const contextLine = useMemo(() => {
    if (bevorstehendTermine.length === 0 && ueberfaelligeTermine.length === 0) {
      return 'Keine offenen Termine — Zeit für neue Meetings.';
    }
    if (ueberfaelligeTermine.length > 0) {
      const names = namen(ueberfaelligeTermine.map(t => t.unternehmenName || t.fields.terminbezeichnung || ''));
      return `${ueberfaelligeTermine.length} überfällige Termine: ${names}.`;
    }
    return `Nächster Termin: ${naechsterName} — ${formatDateTime(bevorstehendTermine[0]?.fields.datum_uhrzeit)}.`;
  }, [bevorstehendTermine, ueberfaelligeTermine, naechsterName]);

  // ── ALL hooks above early returns ────────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ── Overlay render helpers (plain derivations only below) ────────────────
  const getUnternehmenForRecord = (r: Termine | Dokumente | Notizen) =>
    unternehmenMap.get(extractRecordId(r.fields.unternehmen) ?? '') ?? null;

  return (
    <>
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
            <p className="text-muted-foreground mt-0.5">{contextLine}</p>
          </div>
          <div className="flex gap-2 flex-wrap shrink-0">
            <button
              onClick={() => { setUnternehmenDialog(true); setEditingUnternehmen(undefined); setEditingUnternehmenId(undefined); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <IconPlus size={16} className="shrink-0" />
              Unternehmen
            </button>
            <button
              onClick={() => openCreateTermin()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <IconPlus size={16} className="shrink-0" />
              Termin
            </button>
          </div>
        </div>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          ueberfaelligeTermine.length > 0 ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: '✓ Als stattgefunden markieren',
                onClick: () => advanceTermin(ueberfaelligeTermine[0]),
              }}
            >
              <b>{namen(ueberfaelligeTermine.map(t => t.unternehmenName || t.fields.terminbezeichnung || ''))}</b>
              {' '}— {ueberfaelligeTermine.length === 1 ? 'Termin' : `${ueberfaelligeTermine.length} Termine`} überfällig (geplant, noch nicht stattgefunden).
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title="Aktive Beteiligungen"
              value={aktiveUnternehmen.length}
              icon={<IconBuilding size={16} className="shrink-0" />}
              tone="primary"
            />
            <StatStripItem
              title="Investiertes Kapital"
              value={gesamtKapital > 0 ? formatCurrency(gesamtKapital) : '—'}
              icon={<IconTrendingUp size={16} className="shrink-0" />}
            />
            <StatStripItem
              title="Termine diese Woche"
              value={bevorstehendTermine.filter(t => t.fields.datum_uhrzeit && t.fields.datum_uhrzeit <= nextWeek).length}
              icon={<IconCalendar size={16} className="shrink-0" />}
              tone={bevorstehendTermine.filter(t => t.fields.datum_uhrzeit && t.fields.datum_uhrzeit <= nextWeek).length > 0 ? 'default' : 'default'}
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
            events={calEvents}
            defaultView="week"
            locale={de}
            weekDays={5}
            onEventClick={ev => {
              const t = termine.find(x => x.record_id === ev.id);
              if (t) overlay.replace({ type: 'termin', record: t });
            }}
            onEmptyClick={date => {
              openCreateTermin({ datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm") });
            }}
            onEventDrop={handleEventDrop}
          />
        }
        aside={
          <>
            <WorkList
              title="Nächste Termine"
              items={bevorstehendTermine.slice(0, 8).map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? 'Termin',
                secondLine: (
                  <>
                    <span className="text-muted-foreground">{t.unternehmenName}</span>
                    {t.fields.terminart && (
                      <span className="text-muted-foreground"> · {t.fields.terminart.label}</span>
                    )}
                    <br />
                    <span className="text-muted-foreground text-xs">{formatDateTime(t.fields.datum_uhrzeit)}</span>
                    {t.fields.terminstatus?.key === 'geplant' && (
                      <span className="ml-1 font-medium text-primary"> · Geplant</span>
                    )}
                  </>
                ),
                action:
                  t.fields.terminstatus?.key === 'geplant'
                    ? { label: '✓ Bestätigen', onClick: () => advanceTermin(t) }
                    : undefined,
              }))}
              onItemClick={id => {
                const t = termine.find(x => x.record_id === id);
                if (t) overlay.replace({ type: 'termin', record: t });
              }}
              empty={{
                text: 'Keine bevorstehenden Termine.',
                action: { label: 'Termin anlegen', onClick: () => openCreateTermin() },
              }}
            />

            <ChartWidget
              title="Portfolio nach Branche"
              rows={branchenRows}
              dimension={{
                kind: 'category',
                accessor: row => row.data.fields.branche,
                label: 'Branche',
              }}
            />
          </>
        }
      />

      {/* Overlay host */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'unternehmen') {
            const u = top.record;
            return (
              <>
                <RecordHeader
                  title={u.fields.name ?? 'Unternehmen'}
                  subtitle={[u.fields.branche?.label, u.fields.stadt].filter(Boolean).join(' · ')}
                  badges={
                    u.fields.status ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${u.fields.status.key === 'aktiv' ? 'bg-success/10 text-success' : u.fields.status.key === 'exit' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {u.fields.status.label}
                      </span>
                    ) : undefined
                  }
                  actions={
                    <button
                      onClick={() => {
                        setEditingUnternehmen({ ...u.fields } as UnternehmenDialogDefaults);
                        setEditingUnternehmenId(u.record_id);
                        setUnternehmenDialog(true);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <UnternehmenDetails
                  record={u}
                  termineList={termine}
                  onOpenTermine={t => overlay.push({ type: 'termin', record: t })}
                  onAddTermine={() => openCreateTermin({ unternehmen: u.record_id })}
                  dokumenteList={dokumente}
                  onOpenDokumente={d => overlay.push({ type: 'dokument', record: d })}
                  onAddDokumente={() => openCreateDokument({ unternehmen: u.record_id })}
                  notizenList={notizen}
                  onOpenNotizen={n => overlay.push({ type: 'notiz', record: n })}
                  onAddNotizen={() => openCreateNotiz({ unternehmen: u.record_id })}
                />
              </>
            );
          }
          if (top.type === 'termin') {
            const t = top.record;
            const u = getUnternehmenForRecord(t);
            return (
              <>
                <RecordHeader
                  title={t.fields.terminbezeichnung ?? 'Termin'}
                  subtitle={t.fields.terminart?.label}
                  badges={
                    t.fields.terminstatus ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t.fields.terminstatus.key === 'stattgefunden' ? 'bg-success/10 text-success' : t.fields.terminstatus.key === 'abgesagt' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                        {t.fields.terminstatus.label}
                      </span>
                    ) : undefined
                  }
                  actions={
                    <button
                      onClick={() => {
                        setEditingTermin({ ...t.fields } as TermineDialogDefaults);
                        setEditingTerminId(t.record_id);
                        setTermineDialog(true);
                        overlay.close();
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <TermineDetails
                  record={t}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={uu => overlay.push({ type: 'unternehmen', record: uu })}
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
                        setEditingDokument({ ...d.fields } as DokumenteDialogDefaults);
                        setEditingDokumentId(d.record_id);
                        setDokumenteDialog(true);
                        overlay.close();
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <DokumenteDetails
                  record={d}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={uu => overlay.push({ type: 'unternehmen', record: uu })}
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
                  badges={
                    n.fields.prioritaet ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${n.fields.prioritaet.key === 'hoch' ? 'bg-destructive/10 text-destructive' : n.fields.prioritaet.key === 'mittel' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}`}>
                        {n.fields.prioritaet.label}
                      </span>
                    ) : undefined
                  }
                  actions={
                    <button
                      onClick={() => {
                        setEditingNotiz({ ...n.fields } as NotizenDialogDefaults);
                        setEditingNotizId(n.record_id);
                        setNotizenDialog(true);
                        overlay.close();
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <NotizenDetails
                  record={n}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={uu => overlay.push({ type: 'unternehmen', record: uu })}
                />
              </>
            );
          }
          return null;
        }}
        footer={top => {
          if (top.type === 'termin' && top.record.fields.terminstatus?.key === 'geplant') {
            return {
              label: '✓ Als stattgefunden markieren',
              onClick: () => {
                const t = enrichedTermine.find(x => x.record_id === top.record.record_id);
                if (t) { advanceTermin(t); overlay.close(); }
              },
            };
          }
          return undefined;
        }}
      />

      {/* Dialogs */}
      <UnternehmenDialog
        open={unternehmenDialog}
        onClose={() => { setUnternehmenDialog(false); setEditingUnternehmen(undefined); setEditingUnternehmenId(undefined); }}
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
        open={termineDialog}
        onClose={() => { setTermineDialog(false); setEditingTermin(undefined); setEditingTerminId(undefined); }}
        onSubmit={async fields => {
          if (editingTerminId) {
            await LivingAppsService.updateTermineEntry(editingTerminId, fields);
          } else {
            await LivingAppsService.createTermineEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingTermin}
        recordId={editingTerminId}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Termine']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Termine']}
      />

      <DokumenteDialog
        open={dokumenteDialog}
        onClose={() => { setDokumenteDialog(false); setEditingDokument(undefined); setEditingDokumentId(undefined); }}
        onSubmit={async fields => {
          if (editingDokumentId) {
            await LivingAppsService.updateDokumenteEntry(editingDokumentId, fields);
          } else {
            await LivingAppsService.createDokumenteEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingDokument}
        recordId={editingDokumentId}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Dokumente']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Dokumente']}
      />

      <NotizenDialog
        open={notizenDialog}
        onClose={() => { setNotizenDialog(false); setEditingNotiz(undefined); setEditingNotizId(undefined); }}
        onSubmit={async fields => {
          if (editingNotizId) {
            await LivingAppsService.updateNotizenEntry(editingNotizId, fields);
          } else {
            await LivingAppsService.createNotizenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingNotiz}
        recordId={editingNotizId}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />
    </>
  );
}
