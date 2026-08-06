import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine, enrichDokumente, enrichNotizen } from '@/lib/enrich';
import type { EnrichedTermine } from '@/types/enriched';
import type { Unternehmen, Termine } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency, lookupKey } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { KanbanWidget } from '@/components/widgets/KanbanWidget';
import type { KanbanCard, KanbanColumn } from '@/components/widgets/KanbanWidget';
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
import { IconBriefcase, IconAlertCircle, IconCalendar, IconBuildingSkyscraper } from '@tabler/icons-react';

type OverlayItem =
  | { type: 'unternehmen'; id: string }
  | { type: 'termin'; id: string }
  | { type: 'dokument'; id: string }
  | { type: 'notiz'; id: string };

export default function DashboardOverview() {
  const {
    unternehmen, setUnternehmen, termine, setTermine,
    dokumente, notizen,
    unternehmenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const clock = useClock();

  const enrichedTermine = enrichTermine(termine, { unternehmenMap });
  const enrichedDokumente = enrichDokumente(dokumente, { unternehmenMap });
  const enrichedNotizen = enrichNotizen(notizen, { unternehmenMap });

  const overlay = useRecordOverlayStack<OverlayItem>();

  // Dialog state
  const [unternehmenDialog, setUnternehmenDialog] = useState(false);
  const [unternehmenDefaults, setUnternehmenDefaults] = useState<UnternehmenDialogDefaults | undefined>(undefined);
  const [editingUnternehmen, setEditingUnternehmen] = useState<Unternehmen | undefined>(undefined);

  const [termineDialog, setTermineDialog] = useState(false);
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>(undefined);
  const [editingTermin, setEditingTermin] = useState<Termine | undefined>(undefined);

  const [dokumenteDialog, setDokumenteDialog] = useState(false);
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>(undefined);

  const [notizenDialog, setNotizenDialog] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>(undefined);

  // Heute-Datum
  const today = format(clock, 'yyyy-MM-dd');

  // Kanban columns für Beteiligungsstatus
  const kanbanColumns: KanbanColumn[] = useMemo(
    () => (LOOKUP_OPTIONS['unternehmen']?.['status'] ?? []).map(o => ({
      key: o.key,
      label: o.label,
      tone: o.key === 'aktiv' ? 'success' : o.key === 'exit' ? 'default' : 'warning',
    } as KanbanColumn)),
    []
  );

  // Karten für das Board
  const kanbanCards: KanbanCard[] = useMemo(
    () => unternehmen.map(u => {
      const statusKey = lookupKey(u.fields.status) ?? '';
      const kapital = u.fields.investiertes_kapital;
      const wert = u.fields.aktueller_wert;
      const branche = u.fields.branche?.label ?? '';
      const ort = [u.fields.stadt, u.fields.land].filter(Boolean).join(', ');
      return {
        id: `unternehmen:${u.record_id}`,
        column: statusKey,
        title: u.fields.name ?? '—',
        subtitle: [branche, ort].filter(Boolean).join(' · ') ||
          (kapital != null ? `${formatCurrency(kapital)} investiert` : undefined),
        tone: statusKey === 'aktiv' ? 'success' : statusKey === 'exit' ? 'default' : 'warning',
      } as KanbanCard;
    }),
    [unternehmen]
  );

  // Dringende Termine: heute und in den nächsten 7 Tagen, Status "geplant"
  const bevorstehend: EnrichedTermine[] = useMemo(() => {
    const nextWeek = format(addDays(clock, 7), 'yyyy-MM-dd');
    return enrichedTermine.filter(t => {
      if (!t.fields.datum_uhrzeit) return false;
      const d = t.fields.datum_uhrzeit.slice(0, 10);
      return lookupKey(t.fields.terminstatus) === 'geplant' && d >= today && d <= nextWeek;
    }).sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? ''));
  }, [enrichedTermine, today, clock]);

  // Überfällige Termine (geplant, datum < heute)
  const ueberfaelligeTermine: EnrichedTermine[] = useMemo(() => {
    return enrichedTermine.filter(t => {
      if (!t.fields.datum_uhrzeit) return false;
      const d = t.fields.datum_uhrzeit.slice(0, 10);
      return lookupKey(t.fields.terminstatus) === 'geplant' && d < today;
    });
  }, [enrichedTermine, today]);

  // KPI-Berechnungen
  const aktiveUnternehmen = useMemo(() => unternehmen.filter(u => lookupKey(u.fields.status) === 'aktiv'), [unternehmen]);
  const gesamtKapital = useMemo(() => unternehmen.reduce((s, u) => s + (u.fields.investiertes_kapital ?? 0), 0), [unternehmen]);
  const gesamtWert = useMemo(() => unternehmen.reduce((s, u) => s + (u.fields.aktueller_wert ?? 0), 0), [unternehmen]);

  // Chart-Daten: Branchen-Verteilung
  const chartRows: ChartRow<Unternehmen>[] = useMemo(
    () => unternehmen.map(u => ({ id: `unternehmen:${u.record_id}`, data: u })),
    [unternehmen]
  );

  // Termin-Status setzen (Bestätigen = "stattgefunden")
  const markTerminDone = useCallback(async (termin: Termine) => {
    const prev = termin.fields.terminstatus;
    setTermine(ts => ts.map(t =>
      t.record_id === termin.record_id
        ? { ...t, fields: { ...t.fields, terminstatus: { key: 'stattgefunden', label: 'Stattgefunden' } } }
        : t
    ));
    try {
      await LivingAppsService.updateTermineEntry(termin.record_id, { terminstatus: 'stattgefunden' });
      undoToast(`${termin.fields.terminbezeichnung ?? 'Termin'} als stattgefunden markiert`, async () => {
        setTermine(ts => ts.map(t =>
          t.record_id === termin.record_id
            ? { ...t, fields: { ...t.fields, terminstatus: prev } }
            : t
        ));
        await LivingAppsService.updateTermineEntry(termin.record_id, { terminstatus: prev ? (typeof prev === 'object' ? prev.key : prev) : undefined });
      });
    } catch {
      fetchAll();
    }
  }, [setTermine, fetchAll]);

  // Kanban: Status-Wechsel
  const handleCardMove = useCallback(async (cardId: string, newColumn: string) => {
    const id = cardId.split(':')[1];
    const u = unternehmen.find(x => x.record_id === id);
    if (!u) return;
    const prevStatus = u.fields.status;
    const newLabel = LOOKUP_OPTIONS['unternehmen']?.['status']?.find(o => o.key === newColumn)?.label ?? newColumn;
    setUnternehmen(list => list.map(x =>
      x.record_id === id
        ? { ...x, fields: { ...x.fields, status: { key: newColumn, label: newLabel } } }
        : x
    ));
    try {
      await LivingAppsService.updateUnternehmenEntry(id, { status: newColumn });
      undoToast(`Status auf „${newLabel}" gesetzt`, async () => {
        setUnternehmen(list => list.map(x =>
          x.record_id === id ? { ...x, fields: { ...x.fields, status: prevStatus } } : x
        ));
        await LivingAppsService.updateUnternehmenEntry(id, { status: prevStatus ? (typeof prevStatus === 'object' ? prevStatus.key : prevStatus) : undefined });
      });
    } catch {
      fetchAll();
    }
  }, [unternehmen, setUnternehmen, fetchAll]);

  // Kontext-Zeile
  const kontextZeile = useMemo(() => {
    if (unternehmen.length === 0) return 'Noch keine Beteiligungen erfasst — lege deine erste an.';
    const aktivNamen = namen(aktiveUnternehmen.map(u => u.fields.name ?? ''));
    if (ueberfaelligeTermine.length > 0) {
      const tNamen = namen(ueberfaelligeTermine.map(t => t.fields.terminbezeichnung ?? ''));
      return `${aktivNamen} im Portfolio. ${ueberfaelligeTermine.length} Termin${ueberfaelligeTermine.length > 1 ? 'e' : ''} überfällig: ${tNamen}.`;
    }
    if (bevorstehend.length > 0) {
      const nächster = bevorstehend[0];
      return `${aktivNamen} aktiv. Nächster Termin: ${nächster.fields.terminbezeichnung ?? ''} am ${formatDate(nächster.fields.datum_uhrzeit)}.`;
    }
    return `${aktivNamen} im Portfolio — ${aktiveUnternehmen.length} aktiv.`;
  }, [unternehmen, aktiveUnternehmen, ueberfaelligeTermine, bevorstehend]);

  // Overlay: Termin-Dialog für Unternehmen öffnen
  const openTerminForUnternehmen = useCallback((u: Unternehmen) => {
    setTermineDefaults({ unternehmen: u.record_id });
    setEditingTermin(undefined);
    setTermineDialog(true);
  }, []);

  const openDokumentForUnternehmen = useCallback((u: Unternehmen) => {
    setDokumenteDefaults({ unternehmen: u.record_id });
    setDokumenteDialog(true);
  }, []);

  const openNotizenForUnternehmen = useCallback((u: Unternehmen) => {
    setNotizenDefaults({ unternehmen: u.record_id });
    setNotizenDialog(true);
  }, []);

  // ─── Every hook goes ABOVE this line ─────────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;
  // ─── Below this line: plain derivations only ─────────────────────────────────

  const gesamtRoI = gesamtKapital > 0 ? ((gesamtWert - gesamtKapital) / gesamtKapital * 100) : null;

  // Leerer Zustand
  if (unternehmen.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <IconBuildingSkyscraper size={48} className="text-primary" stroke={1.5} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Noch keine Beteiligung erfasst</h2>
          <p className="text-muted-foreground">Richte dein Portfolio ein — füge deine erste Beteiligung hinzu.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          onClick={() => { setEditingUnternehmen(undefined); setUnternehmenDefaults(undefined); setUnternehmenDialog(true); }}
        >
          <IconBriefcase size={16} className="shrink-0" />
          Erste Beteiligung anlegen
        </button>
        <UnternehmenDialog
          open={unternehmenDialog}
          onClose={() => setUnternehmenDialog(false)}
          onSubmit={async (fields) => { await LivingAppsService.createUnternehmenEntry(fields); fetchAll(); }}
          enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
        />
      </div>
    );
  }

  return (
    <>
      {/* Seitenkopf */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="mt-1 text-muted-foreground text-sm">{kontextZeile}</p>
        </div>
        <button
          className="inline-flex shrink-0 items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          onClick={() => { setEditingUnternehmen(undefined); setUnternehmenDefaults(undefined); setUnternehmenDialog(true); }}
        >
          <IconBriefcase size={16} className="shrink-0" />
          Neue Beteiligung
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={ueberfaelligeTermine.length > 0 && (
          <HeroBanner
            icon={<IconAlertCircle size={18} />}
            action={{
              label: 'Als stattgefunden markieren',
              onClick: () => markTerminDone(ueberfaelligeTermine[0]),
            }}
          >
            <b>{namen(ueberfaelligeTermine.map(t => t.fields.terminbezeichnung ?? ''))}</b>
            {' '}— {ueberfaelligeTermine.length === 1 ? 'Termin überfällig' : `${ueberfaelligeTermine.length} Termine überfällig`}.
            Fällig war {formatDate(ueberfaelligeTermine[0].fields.datum_uhrzeit)}.
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title="Beteiligungen aktiv"
              value={aktiveUnternehmen.length}
              icon={<IconBuildingSkyscraper size={16} className="shrink-0" />}
              tone={aktiveUnternehmen.length > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title="Investiertes Kapital"
              value={formatCurrency(gesamtKapital)}
              icon={<IconBriefcase size={16} className="shrink-0" />}
              tone="default"
            />
            <StatStripItem
              title="Portfoliowert aktuell"
              value={formatCurrency(gesamtWert)}
              tone={gesamtWert >= gesamtKapital ? 'success' : 'warning'}
            />
            <StatStripItem
              title="Gesamt-RoI"
              value={gesamtRoI != null ? `${gesamtRoI >= 0 ? '+' : ''}${gesamtRoI.toFixed(1)} %` : '—'}
              tone={gesamtRoI != null && gesamtRoI >= 0 ? 'success' : gesamtRoI != null ? 'warning' : 'default'}
            />
            <StatStripItem
              title="Termine diese Woche"
              value={bevorstehend.length}
              icon={<IconCalendar size={16} className="shrink-0" />}
              tone={ueberfaelligeTermine.length > 0 ? 'destructive' : bevorstehend.length > 0 ? 'warning' : 'default'}
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
              overlay.replace({ type: 'unternehmen', id });
            }}
            onCardMove={handleCardMove}
            onAddCard={col => {
              setUnternehmenDefaults({ status: col });
              setEditingUnternehmen(undefined);
              setUnternehmenDialog(true);
            }}
          />
        }
        aside={
          <>
            <WorkList
              title="Bevorstehende Termine"
              items={bevorstehend.map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? '—',
                secondLine: (
                  <>
                    <span className="font-medium text-foreground">{t.unternehmenName}</span>
                    <span className="text-muted-foreground"> · {formatDate(t.fields.datum_uhrzeit)}</span>
                    {t.fields.terminart && <span className="text-muted-foreground"> · {t.fields.terminart.label}</span>}
                  </>
                ),
                action: {
                  label: '✓ Fertig',
                  onClick: () => markTerminDone(t),
                },
              }))}
              onItemClick={id => overlay.replace({ type: 'termin', id })}
              empty={{
                text: 'Keine Termine in den nächsten 7 Tagen',
                action: {
                  label: 'Termin anlegen',
                  onClick: () => { setTermineDefaults(undefined); setEditingTermin(undefined); setTermineDialog(true); },
                },
              }}
            />
            <ChartWidget
              title="Branchenverteilung"
              rows={chartRows}
              dimension={{
                kind: 'category',
                accessor: row => row.data.fields.branche,
                label: 'Branche',
              }}
            />
          </>
        }
      />

      {/* Dialoge */}
      <UnternehmenDialog
        open={unternehmenDialog}
        onClose={() => { setUnternehmenDialog(false); setEditingUnternehmen(undefined); setUnternehmenDefaults(undefined); }}
        onSubmit={async (fields) => {
          if (editingUnternehmen) {
            await LivingAppsService.updateUnternehmenEntry(editingUnternehmen.record_id, fields);
          } else {
            await LivingAppsService.createUnternehmenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingUnternehmen ? editingUnternehmen.fields : unternehmenDefaults}
        recordId={editingUnternehmen?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
      />

      <TermineDialog
        open={termineDialog}
        onClose={() => { setTermineDialog(false); setEditingTermin(undefined); setTermineDefaults(undefined); }}
        onSubmit={async (fields) => {
          if (editingTermin) {
            await LivingAppsService.updateTermineEntry(editingTermin.record_id, fields);
          } else {
            await LivingAppsService.createTermineEntry(fields);
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
        open={dokumenteDialog}
        onClose={() => { setDokumenteDialog(false); setDokumenteDefaults(undefined); }}
        onSubmit={async (fields) => {
          await LivingAppsService.createDokumenteEntry(fields);
          fetchAll();
        }}
        defaultValues={dokumenteDefaults}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Dokumente']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Dokumente']}
      />

      <NotizenDialog
        open={notizenDialog}
        onClose={() => { setNotizenDialog(false); setNotizenDefaults(undefined); }}
        onSubmit={async (fields) => {
          await LivingAppsService.createNotizenEntry(fields);
          fetchAll();
        }}
        defaultValues={notizenDefaults}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />

      {/* Overlay-Stack */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'unternehmen') {
            const u = unternehmen.find(x => x.record_id === top.id);
            if (!u) return null;
            return (
              <>
                <RecordHeader
                  title={u.fields.name ?? '—'}
                  subtitle={[u.fields.branche?.label, u.fields.rechtsform?.label].filter(Boolean).join(' · ')}
                  badges={
                    u.fields.status ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        lookupKey(u.fields.status) === 'aktiv' ? 'bg-success/15 text-success' :
                        lookupKey(u.fields.status) === 'exit' ? 'bg-muted text-muted-foreground' :
                        'bg-warning/15 text-warning'
                      }`}>{u.fields.status.label}</span>
                    ) : undefined
                  }
                />
                <UnternehmenDetails
                  record={u}
                  termineList={termine}
                  onOpenTermine={t => overlay.push({ type: 'termin', id: t.record_id })}
                  onAddTermine={() => openTerminForUnternehmen(u)}
                  dokumenteList={dokumente}
                  onOpenDokumente={d => overlay.push({ type: 'dokument', id: d.record_id })}
                  onAddDokumente={() => openDokumentForUnternehmen(u)}
                  notizenList={notizen}
                  onOpenNotizen={n => overlay.push({ type: 'notiz', id: n.record_id })}
                  onAddNotizen={() => openNotizenForUnternehmen(u)}
                />
              </>
            );
          }
          if (top.type === 'termin') {
            const t = termine.find(x => x.record_id === top.id);
            if (!t) return null;
            return (
              <>
                <RecordHeader
                  title={t.fields.terminbezeichnung ?? '—'}
                  subtitle={t.fields.terminart?.label}
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
            const d = dokumente.find(x => x.record_id === top.id);
            if (!d) return null;
            return (
              <>
                <RecordHeader
                  title={d.fields.dokumentenbezeichnung ?? '—'}
                  subtitle={d.fields.dokumententyp?.label}
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
            const n = notizen.find(x => x.record_id === top.id);
            if (!n) return null;
            return (
              <>
                <RecordHeader
                  title={n.fields.notiz_titel ?? '—'}
                  subtitle={n.fields.kategorie?.label}
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
            const u = unternehmen.find(x => x.record_id === top.id);
            if (u) { setEditingUnternehmen(u); setUnternehmenDefaults(undefined); setUnternehmenDialog(true); }
          } else if (top.type === 'termin') {
            const t = termine.find(x => x.record_id === top.id);
            if (t) { setEditingTermin(t); setTermineDefaults(undefined); setTermineDialog(true); }
          }
        }}
        footer={top => {
          if (top.type === 'termin') {
            const t = termine.find(x => x.record_id === top.id);
            if (t && lookupKey(t.fields.terminstatus) === 'geplant') {
              return { label: '✓ Als stattgefunden markieren', onClick: () => { markTerminDone(t); overlay.close(); } };
            }
          }
          if (top.type === 'unternehmen') {
            const u = unternehmen.find(x => x.record_id === top.id);
            if (u && lookupKey(u.fields.status) === 'aktiv') {
              return {
                label: 'Termin hinzufügen',
                onClick: () => { openTerminForUnternehmen(u); }
              };
            }
          }
          return undefined;
        }}
      />
    </>
  );
}
