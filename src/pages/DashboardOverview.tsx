import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isToday, isBefore, isAfter, startOfDay, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  IconCalendar, IconBriefcase, IconAlertTriangle, IconPlus,
  IconCheck, IconBuilding, IconFileText, IconNotes,
} from '@tabler/icons-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine, enrichDokumente, enrichNotizen } from '@/lib/enrich';
import type { EnrichedTermine } from '@/types/enriched';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { CalendarWidget, type CalendarEvent } from '@/components/widgets/CalendarWidget';
import { ChartWidget, type ChartRow } from '@/components/widgets/ChartWidget';
import {
  useRecordOverlayStack, RecordOverlayHost,
  RecordHeader,
} from '@/components/widgets/RecordView';
import { UnternehmenDetails } from '@/components/details/UnternehmenDetails';
import { TermineDetails } from '@/components/details/TermineDetails';
import { DokumenteDetails } from '@/components/details/DokumenteDetails';
import { NotizenDetails } from '@/components/details/NotizenDetails';
import { UnternehmenDialog } from '@/components/dialogs/UnternehmenDialog';
import { TermineDialog, type TermineDialogDefaults } from '@/components/dialogs/TermineDialog';
import { DokumenteDialog, type DokumenteDialogDefaults } from '@/components/dialogs/DokumenteDialog';
import { NotizenDialog, type NotizenDialogDefaults } from '@/components/dialogs/NotizenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';

type OverlayItem =
  | { type: 'unternehmen'; record: Unternehmen }
  | { type: 'termine'; record: Termine }
  | { type: 'dokumente'; record: Dokumente }
  | { type: 'notizen'; record: Notizen };

export default function DashboardOverview() {
  const {
    unternehmen, setUnternehmen, termine, setTermine, dokumente, setDokumente, notizen, setNotizen,
    unternehmenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const clock = useClock();

  const enrichedTermine = enrichTermine(termine, { unternehmenMap });
  enrichDokumente(dokumente, { unternehmenMap });
  enrichNotizen(notizen, { unternehmenMap });

  const overlay = useRecordOverlayStack<OverlayItem>();

  // Dialog state
  const [unternehmenDialogOpen, setUnternehmenDialogOpen] = useState(false);
  const [editUnternehmen, setEditUnternehmen] = useState<Unternehmen | undefined>(undefined);

  const [termineDialogOpen, setTermineDialogOpen] = useState(false);
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>(undefined);
  const [editTermine, setEditTermine] = useState<Termine | undefined>(undefined);

  const [dokumenteDialogOpen, setDokumenteDialogOpen] = useState(false);
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>(undefined);
  const [editDokumente, setEditDokumente] = useState<Dokumente | undefined>(undefined);

  const [notizenDialogOpen, setNotizenDialogOpen] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>(undefined);
  const [editNotizen, setEditNotizen] = useState<Notizen | undefined>(undefined);

  // ── Derivations (before early returns) ────────────────────────────────────
  const today = format(clock, 'yyyy-MM-dd');
  const sevenDaysOut = format(addDays(clock, 7), 'yyyy-MM-dd');

  const aktiveUnternehmen = useMemo(
    () => unternehmen.filter(u => u.fields.status?.key === 'aktiv'),
    [unternehmen],
  );

  const heuteTermine = useMemo(
    () => enrichedTermine.filter(t => t.fields.datum_uhrzeit?.startsWith(today)),
    [enrichedTermine, today],
  );

  const ueberfaelligeTermine = useMemo(
    () => enrichedTermine.filter(t => {
      if (!t.fields.datum_uhrzeit) return false;
      if (t.fields.terminstatus?.key === 'stattgefunden' || t.fields.terminstatus?.key === 'abgesagt') return false;
      return isBefore(parseISO(t.fields.datum_uhrzeit), startOfDay(clock));
    }),
    [enrichedTermine, clock],
  );

  const demnächstTermine = useMemo(
    () => enrichedTermine
      .filter(t => {
        if (!t.fields.datum_uhrzeit) return false;
        const d = t.fields.datum_uhrzeit;
        return d >= today && d <= sevenDaysOut && t.fields.terminstatus?.key !== 'abgesagt';
      })
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedTermine, today, sevenDaysOut],
  );

  const geplantTermine = useMemo(
    () => enrichedTermine.filter(t => t.fields.terminstatus?.key === 'geplant' || !t.fields.terminstatus),
    [enrichedTermine],
  );

  // Calendar events
  const calendarEvents = useMemo<CalendarEvent[]>(() =>
    enrichedTermine
      .filter(t => !!t.fields.datum_uhrzeit)
      .map(t => {
        const key = t.fields.terminstatus?.key;
        const isOverdue = ueberfaelligeTermine.some(u => u.record_id === t.record_id);
        const tone: CalendarEvent['tone'] = isOverdue
          ? 'destructive'
          : key === 'stattgefunden' ? 'success'
          : key === 'abgesagt' ? 'default'
          : 'primary';
        return {
          id: `termine:${t.record_id}`,
          start: t.fields.datum_uhrzeit!,
          title: t.fields.terminbezeichnung ?? 'Termin',
          subtitle: t.unternehmenName || t.fields.terminart?.label,
          tone,
        };
      }),
    [enrichedTermine, ueberfaelligeTermine],
  );

  // ChartWidget rows for Termine by Terminart
  const termineChartRows = useMemo<ChartRow<Termine>[]>(
    () => termine.map(t => ({ id: `termine:${t.record_id}`, data: t })),
    [termine],
  );

  // Advance helper: mark termin as "stattgefunden"
  const markStattgefunden = useCallback(async (termin: EnrichedTermine) => {
    const prev = { ...termin, fields: { ...termin.fields } };
    setTermine(ts =>
      ts.map(t => t.record_id === termin.record_id
        ? { ...t, fields: { ...t.fields, terminstatus: { key: 'stattgefunden', label: 'Stattgefunden' } } }
        : t),
    );
    undoToast(`${termin.fields.terminbezeichnung ?? 'Termin'} als stattgefunden markiert`, async () => {
      setTermine(ts =>
        ts.map(t => t.record_id === termin.record_id ? prev : t),
      );
      await LivingAppsService.updateTermineEntry(termin.record_id, { terminstatus: 'geplant' });
    });
    try {
      await LivingAppsService.updateTermineEntry(termin.record_id, { terminstatus: 'stattgefunden' });
    } catch {
      await fetchAll();
    }
  }, [setTermine, fetchAll]);

  // Context line
  const contextLine = useMemo(() => {
    const g = gruss(clock);
    if (enrichedTermine.length === 0) return `${g} Noch keine Termine eingetragen.`;
    if (heuteTermine.length > 0) {
      const names = namen(heuteTermine.map(t => t.unternehmenName || t.fields.terminbezeichnung || ''));
      return `${g} Heute: ${names}.`;
    }
    const next = demnächstTermine[0];
    if (next) {
      const when = formatDateTime(next.fields.datum_uhrzeit);
      return `${g} Nächster Termin: ${next.fields.terminbezeichnung ?? ''} bei ${next.unternehmenName || '—'} am ${when}.`;
    }
    return `${g} ${aktiveUnternehmen.length} aktive Beteiligungen im Portfolio.`;
  }, [clock, enrichedTermine.length, heuteTermine, demnächstTermine, aktiveUnternehmen.length]);

  // Investiertes Kapital Gesamt
  const totalKapital = useMemo(
    () => unternehmen.reduce((sum, u) => sum + (u.fields.investiertes_kapital ?? 0), 0),
    [unternehmen],
  );
  const totalWert = useMemo(
    () => unternehmen.reduce((sum, u) => sum + (u.fields.aktueller_wert ?? 0), 0),
    [unternehmen],
  );

  // ── Early returns (keep these) ─────────────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ── Helpers for overlay drill ──────────────────────────────────────────────
  const findUnternehmen = (id: string) => unternehmen.find(u => u.record_id === id);
  const findTermine = (id: string) => termine.find(t => t.record_id === id);
  const findDokumente = (id: string) => dokumente.find(d => d.record_id === id);
  const findNotizen = (id: string) => notizen.find(n => n.record_id === id);

  // ── Hero ───────────────────────────────────────────────────────────────────
  const heroTarget = ueberfaelligeTermine[0];

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground truncate">
            BeteiligungsManager
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{contextLine}</p>
        </div>
        <div className="flex gap-2 shrink-0 mt-2 sm:mt-0">
          <button
            onClick={() => { setEditUnternehmen(undefined); setUnternehmenDialogOpen(true); }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <IconPlus size={15} className="shrink-0" />
            Unternehmen
          </button>
          <button
            onClick={() => { setEditTermine(undefined); setTermineDefaults(undefined); setTermineDialogOpen(true); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            <IconCalendar size={15} className="shrink-0" />
            Termin
          </button>
        </div>
      </div>

      <DashboardGrid
        variant="wide"
        hero={heroTarget ? (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: '✓ Als stattgefunden markieren',
              onClick: () => markStattgefunden(ueberfaelligeTermine[0]),
            }}
          >
            <b>{namen(ueberfaelligeTermine.map(t => t.fields.terminbezeichnung ?? ''))}</b>{' '}
            — {ueberfaelligeTermine.length === 1 ? 'überfällig' : `${ueberfaelligeTermine.length} überfällige Termine`}.{' '}
            Fällig war {formatDateTime(heroTarget.fields.datum_uhrzeit)}.
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatStrip>
            <StatStripItem
              title="Aktive Beteil."
              value={aktiveUnternehmen.length}
              icon={<IconBuilding size={14} />}
              tone={aktiveUnternehmen.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Geplante Termine"
              value={geplantTermine.length}
              icon={<IconCalendar size={14} />}
              tone={geplantTermine.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Überfällig"
              value={ueberfaelligeTermine.length}
              icon={<IconAlertTriangle size={14} />}
              tone={ueberfaelligeTermine.length > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title="Dokumente"
              value={dokumente.length}
              icon={<IconFileText size={14} />}
              tone="default"
            />
            {totalKapital > 0 && (
              <StatStripItem
                title="Investiert"
                value={new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(totalKapital) + ' €'}
                icon={<IconBriefcase size={14} />}
                tone="default"
              />
            )}
            {totalWert > 0 && (
              <StatStripItem
                title="Akt. Portfoliowert"
                value={new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(totalWert) + ' €'}
                icon={<IconBriefcase size={14} />}
                tone={totalWert > totalKapital ? 'success' : totalWert < totalKapital ? 'warning' : 'default'}
              />
            )}
          </StatStrip>
        }
        primary={
          termine.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card py-20 text-center">
              <IconCalendar size={48} className="text-muted-foreground" stroke={1.5} />
              <div>
                <p className="font-semibold text-foreground">Noch keine Termine</p>
                <p className="mt-1 text-sm text-muted-foreground">Lege deinen ersten Termin an, um den Kalender zu füllen.</p>
              </div>
              <button
                onClick={() => { setEditTermine(undefined); setTermineDefaults(undefined); setTermineDialogOpen(true); }}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <IconPlus size={15} className="shrink-0" />
                Erster Termin
              </button>
            </div>
          ) : (
            <CalendarWidget
              events={calendarEvents}
              locale={de}
              onEventClick={ev => {
                const id = ev.id.split(':')[1] ?? '';
                const rec = findTermine(id);
                if (rec) overlay.replace({ type: 'termine', record: rec });
              }}
              onEmptyClick={date => {
                const prefill: TermineDialogDefaults = {
                  datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm"),
                };
                setEditTermine(undefined);
                setTermineDefaults(prefill);
                setTermineDialogOpen(true);
              }}
              onEventDrop={async (eventId, newStart) => {
                const id = eventId.split(':')[1] ?? '';
                const rec = termine.find(t => t.record_id === id);
                if (!rec) return;
                const prev = rec.fields.datum_uhrzeit;
                setTermine(ts => ts.map(t => t.record_id === id ? { ...t, fields: { ...t.fields, datum_uhrzeit: newStart } } : t));
                undoToast(`Termin verschoben auf ${formatDateTime(newStart)}`, async () => {
                  setTermine(ts => ts.map(t => t.record_id === id ? { ...t, fields: { ...t.fields, datum_uhrzeit: prev } } : t));
                  await LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: prev });
                });
                try {
                  await LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: newStart });
                } catch {
                  await fetchAll();
                }
              }}
            />
          )
        }
        aside={
          <>
            <WorkList
              title="Diese Woche"
              max={6}
              items={demnächstTermine.map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? 'Termin',
                secondLine: (
                  <>
                    <span className={
                      t.fields.terminstatus?.key === 'stattgefunden' ? 'font-medium text-success' :
                      isToday(parseISO(t.fields.datum_uhrzeit!)) ? 'font-medium text-primary' :
                      'text-muted-foreground'
                    }>
                      {isToday(parseISO(t.fields.datum_uhrzeit!)) ? 'Heute' : formatDate(t.fields.datum_uhrzeit)}
                      {t.fields.datum_uhrzeit?.includes('T') ? ` ${t.fields.datum_uhrzeit.slice(11, 16)} Uhr` : ''}
                    </span>
                    {t.unternehmenName ? (
                      <span className="text-muted-foreground"> · {t.unternehmenName}</span>
                    ) : null}
                  </>
                ),
                action: t.fields.terminstatus?.key !== 'stattgefunden'
                  ? { label: '✓', onClick: () => markStattgefunden(t) }
                  : undefined,
              }))}
              onItemClick={id => {
                const rec = findTermine(id);
                if (rec) overlay.replace({ type: 'termine', record: rec });
              }}
              empty={{
                text: ueberfaelligeTermine.length > 0
                  ? `${ueberfaelligeTermine.length} überfällige Termine erledigen`
                  : 'Keine Termine diese Woche — alles im Plan.',
                action: { label: 'Termin anlegen', onClick: () => { setEditTermine(undefined); setTermineDefaults(undefined); setTermineDialogOpen(true); } },
              }}
            />
            <ChartWidget
              title="Terminarten"
              rows={termineChartRows}
              dimension={{
                kind: 'category',
                accessor: row => row.data.fields.terminart,
                label: 'Art',
              }}
              locale="de"
            />
          </>
        }
      />

      {/* ── Dialogs ── */}
      <UnternehmenDialog
        open={unternehmenDialogOpen}
        onClose={() => { setUnternehmenDialogOpen(false); setEditUnternehmen(undefined); }}
        onSubmit={async fields => {
          if (editUnternehmen) {
            await LivingAppsService.updateUnternehmenEntry(editUnternehmen.record_id, fields);
          } else {
            await LivingAppsService.createUnternehmenEntry(fields);
          }
          await fetchAll();
        }}
        defaultValues={editUnternehmen?.fields}
        recordId={editUnternehmen?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
      />

      <TermineDialog
        open={termineDialogOpen}
        onClose={() => { setTermineDialogOpen(false); setEditTermine(undefined); setTermineDefaults(undefined); }}
        onSubmit={async fields => {
          if (editTermine) {
            await LivingAppsService.updateTermineEntry(editTermine.record_id, fields);
          } else {
            await LivingAppsService.createTermineEntry(fields);
          }
          await fetchAll();
        }}
        defaultValues={editTermine?.fields ?? termineDefaults}
        recordId={editTermine?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Termine']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Termine']}
      />

      <DokumenteDialog
        open={dokumenteDialogOpen}
        onClose={() => { setDokumenteDialogOpen(false); setEditDokumente(undefined); setDokumenteDefaults(undefined); }}
        onSubmit={async fields => {
          if (editDokumente) {
            await LivingAppsService.updateDokumenteEntry(editDokumente.record_id, fields);
          } else {
            await LivingAppsService.createDokumenteEntry(fields);
          }
          await fetchAll();
        }}
        defaultValues={editDokumente?.fields ?? dokumenteDefaults}
        recordId={editDokumente?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Dokumente']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Dokumente']}
      />

      <NotizenDialog
        open={notizenDialogOpen}
        onClose={() => { setNotizenDialogOpen(false); setEditNotizen(undefined); setNotizenDefaults(undefined); }}
        onSubmit={async fields => {
          if (editNotizen) {
            await LivingAppsService.updateNotizenEntry(editNotizen.record_id, fields);
          } else {
            await LivingAppsService.createNotizenEntry(fields);
          }
          await fetchAll();
        }}
        defaultValues={editNotizen?.fields ?? notizenDefaults}
        recordId={editNotizen?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />

      {/* ── RecordOverlayHost ── */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          switch (top.type) {
            case 'unternehmen': {
              const rec = findUnternehmen(top.record.record_id) ?? top.record;
              return (
                <>
                  <RecordHeader
                    title={rec.fields.name ?? '—'}
                    badges={rec.fields.status ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        rec.fields.status.key === 'aktiv' ? 'bg-success/10 text-success' :
                        rec.fields.status.key === 'exit' ? 'bg-warning/10 text-warning' :
                        'bg-muted text-muted-foreground'
                      }`}>{rec.fields.status.label}</span>
                    ) : undefined}
                    meta={[rec.fields.branche?.label, rec.fields.stadt && rec.fields.land ? `${rec.fields.stadt}, ${rec.fields.land}` : rec.fields.stadt ?? rec.fields.land].filter(Boolean).join(' · ') || undefined}
                  />
                  <UnternehmenDetails
                    record={rec}
                    termineList={termine}
                    onOpenTermine={r => overlay.push({ type: 'termine', record: r })}
                    onAddTermine={() => {
                      setTermineDefaults({ unternehmen: rec.record_id });
                      setEditTermine(undefined);
                      setTermineDialogOpen(true);
                    }}
                    dokumenteList={dokumente}
                    onOpenDokumente={r => overlay.push({ type: 'dokumente', record: r })}
                    onAddDokumente={() => {
                      setDokumenteDefaults({ unternehmen: rec.record_id });
                      setEditDokumente(undefined);
                      setDokumenteDialogOpen(true);
                    }}
                    notizenList={notizen}
                    onOpenNotizen={r => overlay.push({ type: 'notizen', record: r })}
                    onAddNotizen={() => {
                      setNotizenDefaults({ unternehmen: rec.record_id });
                      setEditNotizen(undefined);
                      setNotizenDialogOpen(true);
                    }}
                  />
                </>
              );
            }
            case 'termine': {
              const rec = findTermine(top.record.record_id) ?? top.record;
              const unterRef = rec.fields.unternehmen ? unternehmen.find(u => u.record_id === extractRecordId(rec.fields.unternehmen)) : undefined;
              return (
                <>
                  <RecordHeader
                    title={rec.fields.terminbezeichnung ?? '—'}
                    meta={[rec.fields.terminart?.label, formatDateTime(rec.fields.datum_uhrzeit)].filter(Boolean).join(' · ') || undefined}
                    badges={rec.fields.terminstatus ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        rec.fields.terminstatus.key === 'stattgefunden' ? 'bg-success/10 text-success' :
                        rec.fields.terminstatus.key === 'abgesagt' ? 'bg-muted text-muted-foreground' :
                        'bg-primary/10 text-primary'
                      }`}>{rec.fields.terminstatus.label}</span>
                    ) : undefined}
                  />
                  <TermineDetails
                    record={rec}
                    unternehmenList={unternehmen}
                    onOpenUnternehmen={r => overlay.push({ type: 'unternehmen', record: r })}
                  />
                </>
              );
            }
            case 'dokumente': {
              const rec = findDokumente(top.record.record_id) ?? top.record;
              return (
                <>
                  <RecordHeader
                    title={rec.fields.dokumentenbezeichnung ?? '—'}
                    meta={[rec.fields.dokumententyp?.label, formatDate(rec.fields.dokumentendatum)].filter(Boolean).join(' · ') || undefined}
                  />
                  <DokumenteDetails
                    record={rec}
                    unternehmenList={unternehmen}
                    onOpenUnternehmen={r => overlay.push({ type: 'unternehmen', record: r })}
                  />
                </>
              );
            }
            case 'notizen': {
              const rec = findNotizen(top.record.record_id) ?? top.record;
              return (
                <>
                  <RecordHeader
                    title={rec.fields.notiz_titel ?? '—'}
                    meta={[rec.fields.kategorie?.label, formatDate(rec.fields.notiz_datum)].filter(Boolean).join(' · ') || undefined}
                    badges={rec.fields.prioritaet ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        rec.fields.prioritaet.key === 'hoch' ? 'bg-destructive/10 text-destructive' :
                        rec.fields.prioritaet.key === 'mittel' ? 'bg-warning/10 text-warning' :
                        'bg-muted text-muted-foreground'
                      }`}>{rec.fields.prioritaet.label}</span>
                    ) : undefined}
                  />
                  <NotizenDetails
                    record={rec}
                    unternehmenList={unternehmen}
                    onOpenUnternehmen={r => overlay.push({ type: 'unternehmen', record: r })}
                  />
                </>
              );
            }
            default:
              return null;
          }
        }}
        onEdit={top => {
          switch (top.type) {
            case 'unternehmen':
              setEditUnternehmen(top.record);
              setUnternehmenDialogOpen(true);
              break;
            case 'termine':
              setEditTermine(top.record);
              setTermineDefaults(undefined);
              setTermineDialogOpen(true);
              break;
            case 'dokumente':
              setEditDokumente(top.record);
              setDokumenteDefaults(undefined);
              setDokumenteDialogOpen(true);
              break;
            case 'notizen':
              setEditNotizen(top.record);
              setNotizenDefaults(undefined);
              setNotizenDialogOpen(true);
              break;
          }
        }}
        footer={top => {
          if (top.type === 'termine') {
            const rec = findTermine(top.record.record_id) ?? top.record;
            const enriched = enrichedTermine.find(t => t.record_id === rec.record_id);
            if (enriched && rec.fields.terminstatus?.key === 'geplant') {
              return { label: '✓ Als stattgefunden markieren', onClick: () => markStattgefunden(enriched) };
            }
          }
          return undefined;
        }}
      />
    </>
  );
}
