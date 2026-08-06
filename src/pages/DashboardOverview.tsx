import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isAfter, isBefore, addDays, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine } from '@/lib/enrich';
import type { EnrichedTermine } from '@/types/enriched';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { CalendarWidget } from '@/components/widgets/CalendarWidget';
import type { CalendarEvent } from '@/components/widgets/CalendarWidget';
import {
  useRecordOverlayStack,
  RecordOverlayHost,
  RecordHeader,
  RecordField,
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
  IconBuildingFactory2,
  IconCalendar,
  IconPlus,
  IconAlertTriangle,
  IconCheck,
  IconCurrencyEuro,
  IconTrendingUp,
  IconFileText,
  IconNotes,
} from '@tabler/icons-react';

type OverlayItem =
  | { type: 'unternehmen'; record: Unternehmen }
  | { type: 'termin'; record: Termine }
  | { type: 'dokument'; record: Dokumente }
  | { type: 'notiz'; record: Notizen };

export default function DashboardOverview() {
  const {
    unternehmen, setTermine, termine, dokumente, notizen,
    unternehmenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const clock = useClock();

  const enrichedTermine = enrichTermine(termine, { unternehmenMap });

  const overlay = useRecordOverlayStack<OverlayItem>();

  // Dialog state
  const [unternehmenDialogOpen, setUnternehmenDialogOpen] = useState(false);
  const [unternehmenDefaults, setUnternehmenDefaults] = useState<UnternehmenDialogDefaults | undefined>();
  const [editingUnternehmen, setEditingUnternehmen] = useState<Unternehmen | undefined>();

  const [terminDialogOpen, setTerminDialogOpen] = useState(false);
  const [terminDefaults, setTerminDefaults] = useState<TermineDialogDefaults | undefined>();
  const [editingTermin, setEditingTermin] = useState<Termine | undefined>();

  const [dokumentDialogOpen, setDokumentDialogOpen] = useState(false);
  const [dokumentDefaults, setDokumentDefaults] = useState<DokumenteDialogDefaults | undefined>();
  const [editingDokument, setEditingDokument] = useState<Dokumente | undefined>();

  const [notizenDialogOpen, setNotizenDialogOpen] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>();
  const [editingNotizen, setEditingNotizen] = useState<Notizen | undefined>();

  // Derived data — ALL hooks above, derivations below
  const today = format(clock, 'yyyy-MM-dd');
  const in7Days = format(addDays(clock, 7), 'yyyy-MM-dd');

  const aktiveUnternehmen = useMemo(
    () => unternehmen.filter(u => u.fields.status?.key === 'aktiv'),
    [unternehmen]
  );
  const inaktiveUnternehmen = useMemo(
    () => unternehmen.filter(u => u.fields.status?.key === 'inaktiv'),
    [unternehmen]
  );

  const gesamtInvestitionen = useMemo(
    () => aktiveUnternehmen.reduce((s, u) => s + (u.fields.investiertes_kapital ?? 0), 0),
    [aktiveUnternehmen]
  );

  const gesamtWert = useMemo(
    () => aktiveUnternehmen.reduce((s, u) => s + (u.fields.aktueller_wert ?? 0), 0),
    [aktiveUnternehmen]
  );

  const baldFaelligeTermine = useMemo(
    () => enrichedTermine.filter(t => {
      if (!t.fields.datum_uhrzeit) return false;
      const d = t.fields.datum_uhrzeit.slice(0, 10);
      return d >= today && d <= in7Days && t.fields.terminstatus?.key !== 'abgesagt';
    }).sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedTermine, today, in7Days]
  );

  const offeneTermine = useMemo(
    () => enrichedTermine.filter(t =>
      t.fields.terminstatus?.key === 'geplant' && t.fields.datum_uhrzeit
    ).sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedTermine]
  );

  const ueberfaelligeTermine = useMemo(
    () => enrichedTermine.filter(t => {
      if (!t.fields.datum_uhrzeit) return false;
      return t.fields.datum_uhrzeit < format(clock, "yyyy-MM-dd'T'HH:mm") &&
        t.fields.terminstatus?.key === 'geplant';
    }),
    [enrichedTermine, clock]
  );

  // Calendar events
  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    return enrichedTermine
      .filter(t => t.fields.datum_uhrzeit && t.fields.terminstatus?.key !== 'abgesagt')
      .map(t => {
        const status = t.fields.terminstatus?.key;
        const tone: CalendarEvent['tone'] =
          status === 'stattgefunden' ? 'success' :
          isBefore(parseISO(t.fields.datum_uhrzeit!), clock) && status === 'geplant' ? 'destructive' :
          'primary';
        return {
          id: `termin:${t.record_id}`,
          start: t.fields.datum_uhrzeit!,
          title: t.fields.terminbezeichnung ?? 'Termin',
          subtitle: t.unternehmenName || t.fields.ort,
          tone,
        };
      });
  }, [enrichedTermine, clock]);

  // Mark termin as done
  const markTerminDone = useCallback(async (termin: Termine) => {
    const prev = { ...termin, fields: { ...termin.fields } };
    setTermine(ts => ts.map(t => t.record_id === termin.record_id
      ? { ...t, fields: { ...t.fields, terminstatus: { key: 'stattgefunden', label: 'Stattgefunden' } } }
      : t
    ));
    undoToast(`${termin.fields.terminbezeichnung ?? 'Termin'} als „Stattgefunden" markiert`, async () => {
      setTermine(ts => ts.map(t => t.record_id === termin.record_id ? prev : t));
      await LivingAppsService.updateTermineEntry(termin.record_id, { terminstatus: prev.fields.terminstatus as any });
    });
    try {
      await LivingAppsService.updateTermineEntry(termin.record_id, { terminstatus: 'stattgefunden' });
    } catch {
      setTermine(ts => ts.map(t => t.record_id === termin.record_id ? prev : t));
      await fetchAll();
    }
  }, [setTermine, fetchAll]);

  const openCreateTermin = useCallback((defaults?: TermineDialogDefaults) => {
    setEditingTermin(undefined);
    setTerminDefaults(defaults);
    setTerminDialogOpen(true);
  }, []);

  const openCreateDokument = useCallback((defaults?: DokumenteDialogDefaults) => {
    setEditingDokument(undefined);
    setDokumentDefaults(defaults);
    setDokumentDialogOpen(true);
  }, []);

  const openCreateNotiz = useCallback((defaults?: NotizenDialogDefaults) => {
    setEditingNotizen(undefined);
    setNotizenDefaults(defaults);
    setNotizenDialogOpen(true);
  }, []);

  // ─── Every hook goes ABOVE this line ───────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;
  // ─── Below this line: JSX only ─────────────────────────────────────────

  const naechsterTermin = offeneTermine[0];
  const naechsteUnternehmen = namen(baldFaelligeTermine.slice(0, 3).map(t => t.unternehmenName || t.fields.terminbezeichnung || ''));

  const contextLine = baldFaelligeTermine.length > 0
    ? `${baldFaelligeTermine.length === 1 ? 'Ein Termin' : `${baldFaelligeTermine.length} Termine`} diese Woche — ${naechsteUnternehmen}.`
    : aktiveUnternehmen.length > 0
    ? `${aktiveUnternehmen.length} aktive Beteiligung${aktiveUnternehmen.length !== 1 ? 'en' : ''} im Portfolio.`
    : 'Lege deine erste Beteiligung an.';

  const wertEntwicklung = gesamtInvestitionen > 0
    ? ((gesamtWert - gesamtInvestitionen) / gesamtInvestitionen * 100).toFixed(1)
    : null;

  return (
    <>
      {/* Page header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{contextLine}</p>
        </div>
        <button
          onClick={() => { setEditingUnternehmen(undefined); setUnternehmenDefaults(undefined); setUnternehmenDialogOpen(true); }}
          className="flex items-center gap-2 shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <IconPlus size={16} className="shrink-0" />
          <span className="hidden sm:inline">Beteiligung</span>
        </button>
      </div>

      <DashboardGrid
        variant="split"
        hero={ueberfaelligeTermine.length > 0 && (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: 'Termin abschließen',
              onClick: () => markTerminDone(ueberfaelligeTermine[0]),
            }}
          >
            <b>{namen(ueberfaelligeTermine.map(t => t.fields.terminbezeichnung ?? ''))}</b> überfällig —{' '}
            {ueberfaelligeTermine.length === 1
              ? `war ${formatDateTime(ueberfaelligeTermine[0].fields.datum_uhrzeit)}`
              : `${ueberfaelligeTermine.length} Termine ohne Rückmeldung`}.
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title="Aktive Beteiligungen"
              value={aktiveUnternehmen.length}
              icon={<IconBuildingFactory2 size={16} className="shrink-0" />}
              tone={aktiveUnternehmen.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Investiert"
              value={gesamtInvestitionen > 0 ? formatCurrency(gesamtInvestitionen) : '—'}
              icon={<IconCurrencyEuro size={16} className="shrink-0" />}
              tone="default"
            />
            <StatStripItem
              title={wertEntwicklung !== null && parseFloat(wertEntwicklung) > 0 ? `+${wertEntwicklung}% Rendite` : 'Portfoliowert'}
              value={gesamtWert > 0 ? formatCurrency(gesamtWert) : '—'}
              icon={<IconTrendingUp size={16} className="shrink-0" />}
              tone={wertEntwicklung !== null && parseFloat(wertEntwicklung) > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title="Termine (offen)"
              value={offeneTermine.length}
              icon={<IconCalendar size={16} className="shrink-0" />}
              tone={ueberfaelligeTermine.length > 0 ? 'destructive' : offeneTermine.length > 0 ? 'warning' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <CalendarWidget
            events={calendarEvents}
            defaultView="week"
            locale={de}
            weekDays={5}
            dayStartHour={7}
            dayEndHour={20}
            onEventClick={ev => {
              const id = ev.id.split(':')[1];
              const termin = termine.find(t => t.record_id === id);
              if (termin) overlay.replace({ type: 'termin', record: termin });
            }}
            onEmptyClick={(date) => {
              openCreateTermin({ datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm") });
            }}
            onEventDrop={async (eventId, newStart) => {
              const id = eventId.split(':')[1];
              const termin = termine.find(t => t.record_id === id);
              if (!termin) return;
              const prev = { ...termin, fields: { ...termin.fields } };
              setTermine(ts => ts.map(t => t.record_id === id
                ? { ...t, fields: { ...t.fields, datum_uhrzeit: newStart } }
                : t
              ));
              undoToast(`Termin verschoben auf ${format(parseISO(newStart), 'dd.MM. HH:mm', { locale: de })}`, async () => {
                setTermine(ts => ts.map(t => t.record_id === id ? prev : t));
                await LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: prev.fields.datum_uhrzeit });
              });
              try {
                await LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: newStart });
              } catch {
                setTermine(ts => ts.map(t => t.record_id === id ? prev : t));
                await fetchAll();
              }
            }}
          />
        }
        aside={
          <>
            <WorkList
              title="Anstehende Termine"
              items={offeneTermine.slice(0, 8).map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? 'Termin',
                secondLine: (
                  <>
                    <span className={ueberfaelligeTermine.some(u => u.record_id === t.record_id) ? 'font-medium text-destructive' : 'text-muted-foreground'}>
                      {ueberfaelligeTermine.some(u => u.record_id === t.record_id) ? 'Überfällig' : 'Geplant'}
                    </span>
                    {t.fields.datum_uhrzeit && (
                      <span className="text-muted-foreground"> · {formatDateTime(t.fields.datum_uhrzeit)}</span>
                    )}
                    {t.unternehmenName && (
                      <span className="text-muted-foreground"> · {t.unternehmenName}</span>
                    )}
                  </>
                ),
                action: {
                  label: '✓',
                  onClick: () => markTerminDone(t),
                },
              }))}
              onItemClick={id => {
                const termin = termine.find(t => t.record_id === id);
                if (termin) overlay.replace({ type: 'termin', record: termin });
              }}
              empty={naechsterTermin
                ? { text: `Nächster Termin: ${formatDateTime(naechsterTermin.fields.datum_uhrzeit)}` }
                : { text: 'Keine offenen Termine', action: { label: '+ Termin anlegen', onClick: () => openCreateTermin() } }
              }
            />

            <WorkList
              title="Beteiligungen"
              items={[...aktiveUnternehmen, ...inaktiveUnternehmen].slice(0, 6).map(u => ({
                id: u.record_id,
                title: u.fields.name ?? 'Unternehmen',
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
                    {u.fields.beteiligungsquote != null && (
                      <span className="text-muted-foreground"> · {u.fields.beteiligungsquote}%</span>
                    )}
                  </>
                ),
                action: {
                  label: '→',
                  onClick: () => overlay.replace({ type: 'unternehmen', record: u }),
                },
              }))}
              onItemClick={id => {
                const u = unternehmen.find(x => x.record_id === id);
                if (u) overlay.replace({ type: 'unternehmen', record: u });
              }}
              empty={{
                text: 'Noch keine Beteiligungen',
                action: { label: 'Erste Beteiligung anlegen', onClick: () => { setUnternehmenDialogOpen(true); } },
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
                  subtitle={[u.fields.branche?.label, u.fields.stadt, u.fields.land].filter(Boolean).join(' · ') || undefined}
                  badges={
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      u.fields.status?.key === 'aktiv' ? 'bg-success/10 text-success' :
                      u.fields.status?.key === 'exit' ? 'bg-muted text-muted-foreground' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {u.fields.status?.label ?? '—'}
                    </span>
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
            return (
              <>
                <RecordHeader
                  title={t.fields.terminbezeichnung ?? 'Termin'}
                  subtitle={t.fields.terminart?.label}
                  meta={t.fields.datum_uhrzeit ? <span className="text-sm text-muted-foreground">{formatDateTime(t.fields.datum_uhrzeit)}</span> : undefined}
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
                  title={d.fields.dokumentenbezeichnung ?? 'Dokument'}
                  subtitle={d.fields.dokumententyp?.label}
                  meta={d.fields.dokumentendatum ? <span className="text-sm text-muted-foreground">{formatDate(d.fields.dokumentendatum)}</span> : undefined}
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
                  title={n.fields.notiz_titel ?? 'Notiz'}
                  subtitle={n.fields.kategorie?.label}
                  meta={n.fields.notiz_datum ? <span className="text-sm text-muted-foreground">{formatDate(n.fields.notiz_datum)}</span> : undefined}
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
            if (t.fields.terminstatus?.key === 'geplant') {
              return { label: '✓ Termin abschließen', onClick: () => { markTerminDone(t); overlay.close(); } };
            }
          }
          if (top.type === 'unternehmen') {
            const u = top.record;
            return {
              label: 'Bearbeiten',
              onClick: () => {
                setEditingUnternehmen(u);
                setUnternehmenDefaults(u.fields as UnternehmenDialogDefaults);
                setUnternehmenDialogOpen(true);
              },
            };
          }
          return undefined;
        }}
        onEdit={top => {
          if (top.type === 'unternehmen') {
            setEditingUnternehmen(top.record);
            setUnternehmenDefaults(top.record.fields as UnternehmenDialogDefaults);
            setUnternehmenDialogOpen(true);
          } else if (top.type === 'termin') {
            setEditingTermin(top.record);
            setTerminDefaults(top.record.fields as TermineDialogDefaults);
            setTerminDialogOpen(true);
          } else if (top.type === 'dokument') {
            setEditingDokument(top.record);
            setDokumentDefaults(top.record.fields as DokumenteDialogDefaults);
            setDokumentDialogOpen(true);
          } else if (top.type === 'notiz') {
            setEditingNotizen(top.record);
            setNotizenDefaults(top.record.fields as NotizenDialogDefaults);
            setNotizenDialogOpen(true);
          }
        }}
      />

      {/* Dialogs */}
      <UnternehmenDialog
        open={unternehmenDialogOpen}
        onClose={() => setUnternehmenDialogOpen(false)}
        onSubmit={async fields => {
          if (editingUnternehmen) {
            await LivingAppsService.updateUnternehmenEntry(editingUnternehmen.record_id, fields);
            undoToast(`${fields.name ?? 'Unternehmen'} aktualisiert`);
          } else {
            await LivingAppsService.createUnternehmenEntry(fields);
            undoToast(`${fields.name ?? 'Unternehmen'} angelegt`);
          }
          await fetchAll();
        }}
        defaultValues={unternehmenDefaults}
        recordId={editingUnternehmen?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
      />

      <TermineDialog
        open={terminDialogOpen}
        onClose={() => setTerminDialogOpen(false)}
        onSubmit={async fields => {
          if (editingTermin) {
            await LivingAppsService.updateTermineEntry(editingTermin.record_id, fields);
            undoToast(`${fields.terminbezeichnung ?? 'Termin'} aktualisiert`);
          } else {
            await LivingAppsService.createTermineEntry(fields);
            undoToast(`${fields.terminbezeichnung ?? 'Termin'} angelegt`);
          }
          await fetchAll();
        }}
        defaultValues={terminDefaults}
        recordId={editingTermin?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Termine']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Termine']}
      />

      <DokumenteDialog
        open={dokumentDialogOpen}
        onClose={() => setDokumentDialogOpen(false)}
        onSubmit={async fields => {
          if (editingDokument) {
            await LivingAppsService.updateDokumenteEntry(editingDokument.record_id, fields);
          } else {
            await LivingAppsService.createDokumenteEntry(fields);
          }
          undoToast('Dokument gespeichert');
          await fetchAll();
        }}
        defaultValues={dokumentDefaults}
        recordId={editingDokument?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Dokumente']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Dokumente']}
      />

      <NotizenDialog
        open={notizenDialogOpen}
        onClose={() => setNotizenDialogOpen(false)}
        onSubmit={async fields => {
          if (editingNotizen) {
            await LivingAppsService.updateNotizenEntry(editingNotizen.record_id, fields);
          } else {
            await LivingAppsService.createNotizenEntry(fields);
          }
          undoToast('Notiz gespeichert');
          await fetchAll();
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
