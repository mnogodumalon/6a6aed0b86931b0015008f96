import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine, enrichDokumente, enrichNotizen } from '@/lib/enrich';
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
  IconPlus,
  IconBuilding,
  IconCalendar,
  IconAlertCircle,
  IconCircleCheck,
  IconBriefcase,
  IconFileText,
  IconNotes,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

// Overlay-Stack-Typen
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

  const enrichedTermine = enrichTermine(termine, { unternehmenMap });
  const enrichedDokumente = enrichDokumente(dokumente, { unternehmenMap });
  const enrichedNotizen = enrichNotizen(notizen, { unternehmenMap });

  // Overlay-Stack
  const overlay = useRecordOverlayStack<OverlayItem>();

  // Dialog-State
  const [unternehmenDialogOpen, setUnternehmenDialogOpen] = useState(false);
  const [unternehmenDefaults, setUnternehmenDefaults] = useState<UnternehmenDialogDefaults | undefined>();
  const [editingUnternehmen, setEditingUnternehmen] = useState<Unternehmen | null>(null);

  const [termineDialogOpen, setTermineDialogOpen] = useState(false);
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>();
  const [editingTermin, setEditingTermin] = useState<Termine | null>(null);

  const [dokumenteDialogOpen, setDokumenteDialogOpen] = useState(false);
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>();
  const [editingDokument, setEditingDokument] = useState<Dokumente | null>(null);

  const [notizenDialogOpen, setNotizenDialogOpen] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>();
  const [editingNotiz, setEditingNotiz] = useState<Notizen | null>(null);

  // Kalender-Events
  const calendarEvents = useMemo<CalendarEvent[]>(() =>
    enrichedTermine.map(t => ({
      id: t.record_id,
      start: t.fields.datum_uhrzeit ?? '',
      title: t.fields.terminbezeichnung ?? 'Termin',
      subtitle: t.unternehmenName || t.fields.ort,
      tone: t.fields.terminstatus?.key === 'abgesagt'
        ? 'destructive'
        : t.fields.terminstatus?.key === 'stattgefunden'
        ? 'success'
        : 'primary',
    })),
    [enrichedTermine]
  );

  // KPIs
  const today = format(clock, 'yyyy-MM-dd');
  const nextWeek = format(addDays(clock, 7), 'yyyy-MM-dd');

  const aktiveUnternehmen = useMemo(
    () => unternehmen.filter(u => u.fields.status?.key === 'aktiv'),
    [unternehmen]
  );

  const anstehendeTermine = useMemo(
    () => enrichedTermine.filter(t => {
      const d = t.fields.datum_uhrzeit;
      if (!d) return false;
      return d >= today && t.fields.terminstatus?.key !== 'abgesagt';
    }).sort((a, b) => (a.fields.datum_uhrzeit ?? '') < (b.fields.datum_uhrzeit ?? '') ? -1 : 1),
    [enrichedTermine, today]
  );

  const termineNaechsteWoche = useMemo(
    () => anstehendeTermine.filter(t => (t.fields.datum_uhrzeit ?? '') <= nextWeek),
    [anstehendeTermine, nextWeek]
  );

  const gesamtKapital = useMemo(
    () => aktiveUnternehmen.reduce((sum, u) => sum + (u.fields.investiertes_kapital ?? 0), 0),
    [aktiveUnternehmen]
  );

  const gesamtWert = useMemo(
    () => aktiveUnternehmen.reduce((sum, u) => sum + (u.fields.aktueller_wert ?? 0), 0),
    [aktiveUnternehmen]
  );

  // Überfällige Termine (in der Vergangenheit, noch nicht stattgefunden)
  const ueberfaelligeTermine = useMemo(
    () => enrichedTermine.filter(t => {
      const d = t.fields.datum_uhrzeit;
      if (!d) return false;
      return d < today && t.fields.terminstatus?.key === 'geplant';
    }),
    [enrichedTermine, today]
  );

  // Termin als stattgefunden markieren (optimistisch)
  const markiereStattgefunden = useCallback(async (termin: EnrichedTermine) => {
    const vorher = { ...termin, fields: { ...termin.fields } };
    setTermine(prev => prev.map(t =>
      t.record_id === termin.record_id
        ? { ...t, fields: { ...t.fields, terminstatus: { key: 'stattgefunden', label: 'Stattgefunden' } } }
        : t
    ));
    undoToast(`"${termin.fields.terminbezeichnung}" als stattgefunden markiert`, async () => {
      setTermine(prev => prev.map(t =>
        t.record_id === termin.record_id ? vorher : t
      ));
      await LivingAppsService.updateTermineEntry(termin.record_id, { terminstatus: 'geplant' });
    });
    try {
      await LivingAppsService.updateTermineEntry(termin.record_id, { terminstatus: 'stattgefunden' });
    } catch {
      fetchAll();
    }
  }, [setTermine, fetchAll]);

  // Kalender: Event-Drop
  const handleEventDrop = useCallback(async (eventId: string, newStart: string) => {
    const termin = termine.find(t => t.record_id === eventId);
    if (!termin) return;
    const vorher = { ...termin, fields: { ...termin.fields } };
    setTermine(prev => prev.map(t =>
      t.record_id === eventId
        ? { ...t, fields: { ...t.fields, datum_uhrzeit: newStart } }
        : t
    ));
    undoToast(`Termin verschoben auf ${formatDateTime(newStart)}`, async () => {
      setTermine(prev => prev.map(t => t.record_id === eventId ? vorher : t));
      await LivingAppsService.updateTermineEntry(eventId, { datum_uhrzeit: vorher.fields.datum_uhrzeit });
    });
    try {
      await LivingAppsService.updateTermineEntry(eventId, { datum_uhrzeit: newStart });
    } catch {
      fetchAll();
    }
  }, [termine, setTermine, fetchAll]);

  // Kalender: Neues Event durch Klick
  const handleEmptyClick = useCallback((date: Date) => {
    setEditingTermin(null);
    setTermineDefaults({ datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm") });
    setTermineDialogOpen(true);
  }, []);

  // Kontextuelle Dialoge aus Unternehmen-Overlay
  const openTermineForUnternehmen = useCallback((unternehmenId: string) => {
    setEditingTermin(null);
    setTermineDefaults({ unternehmen: unternehmenId });
    setTermineDialogOpen(true);
  }, []);

  const openDokumenteForUnternehmen = useCallback((unternehmenId: string) => {
    setEditingDokument(null);
    setDokumenteDefaults({ unternehmen: unternehmenId });
    setDokumenteDialogOpen(true);
  }, []);

  const openNotizenForUnternehmen = useCallback((unternehmenId: string) => {
    setEditingNotiz(null);
    setNotizenDefaults({ unternehmen: unternehmenId });
    setNotizenDialogOpen(true);
  }, []);

  // Kontext-Zeile
  const contextLine = useMemo(() => {
    if (termineNaechsteWoche.length === 0 && aktiveUnternehmen.length === 0) {
      return 'Noch keine Beteiligungen oder Termine eingetragen.';
    }
    const firmen = namen(aktiveUnternehmen.map(u => u.fields.name ?? ''));
    if (termineNaechsteWoche.length > 0) {
      const erster = termineNaechsteWoche[0];
      return `${firmen ? firmen + ' — ' : ''}Nächster Termin: ${erster.fields.terminbezeichnung} (${formatDateTime(erster.fields.datum_uhrzeit)})`;
    }
    return `Aktive Beteiligungen: ${firmen || `${aktiveUnternehmen.length} Unternehmen`}`;
  }, [termineNaechsteWoche, aktiveUnternehmen]);

  // ─── Hooks ENDE ─── Early returns nach allen Hooks
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Overlay-Rendering: Record-Lookup-Helfer
  const getUnternehmen = (id: string) => unternehmen.find(u => u.record_id === id);
  const getTermin = (id: string) => termine.find(t => t.record_id === id);
  const getDokument = (id: string) => dokumente.find(d => d.record_id === id);
  const getNotiz = (id: string) => notizen.find(n => n.record_id === id);

  const naechsteTermine = anstehendeTermine.slice(0, 8);

  return (
    <>
      {/* Seiten-Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {gruss(clock)}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">{contextLine}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setEditingUnternehmen(null); setUnternehmenDefaults(undefined); setUnternehmenDialogOpen(true); }}
            >
              <IconPlus size={14} className="mr-1.5 shrink-0" />
              Unternehmen
            </Button>
            <Button
              size="sm"
              onClick={() => { setEditingTermin(null); setTermineDefaults(undefined); setTermineDialogOpen(true); }}
            >
              <IconPlus size={14} className="mr-1.5 shrink-0" />
              Termin
            </Button>
          </div>
        </div>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          ueberfaelligeTermine.length > 0 ? (
            <HeroBanner
              icon={<IconAlertCircle size={18} />}
              action={{
                label: 'Als stattgefunden markieren',
                onClick: () => markiereStattgefunden(ueberfaelligeTermine[0]),
              }}
            >
              <b>{namen(ueberfaelligeTermine.map(t => t.fields.terminbezeichnung ?? ''))}</b>
              {ueberfaelligeTermine.length === 1
                ? ` — Termin war geplant für ${formatDateTime(ueberfaelligeTermine[0].fields.datum_uhrzeit)} und wurde noch nicht abgeschlossen.`
                : ` — ${ueberfaelligeTermine.length} geplante Termine sind überfällig.`}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title="Aktive Beteiligungen"
              value={aktiveUnternehmen.length}
              icon={<IconBuilding size={14} />}
              tone={aktiveUnternehmen.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Investiertes Kapital"
              value={gesamtKapital > 0 ? formatCurrency(gesamtKapital) : '—'}
              icon={<IconBriefcase size={14} />}
            />
            <StatStripItem
              title="Portfolio-Wert"
              value={gesamtWert > 0 ? formatCurrency(gesamtWert) : '—'}
              icon={<IconBriefcase size={14} />}
              tone={gesamtWert > gesamtKapital ? 'success' : gesamtWert < gesamtKapital && gesamtWert > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title="Termine diese Woche"
              value={termineNaechsteWoche.length}
              icon={<IconCalendar size={14} />}
              tone={termineNaechsteWoche.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Dokumente"
              value={dokumente.length}
              icon={<IconFileText size={14} />}
            />
            <StatStripItem
              title="Notizen"
              value={notizen.length}
              icon={<IconNotes size={14} />}
            />
          </StatStrip>
        }
        primary={
          <CalendarWidget
            events={calendarEvents}
            defaultView="week"
            locale={de}
            weekDays={5}
            onEventClick={ev => overlay.replace({ type: 'termin', id: ev.id })}
            onEmptyClick={handleEmptyClick}
            onEventDrop={handleEventDrop}
          />
        }
        aside={
          <>
            <WorkList
              title="Nächste Termine"
              items={naechsteTermine.map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? 'Termin',
                secondLine: (
                  <>
                    <span className="font-medium text-primary">
                      {formatDateTime(t.fields.datum_uhrzeit)}
                    </span>
                    {t.unternehmenName && (
                      <span className="text-muted-foreground"> · {t.unternehmenName}</span>
                    )}
                    {t.fields.terminart && (
                      <span className="text-muted-foreground"> · {t.fields.terminart.label}</span>
                    )}
                  </>
                ),
                action: t.fields.terminstatus?.key === 'geplant'
                  ? { label: '✓ Stattgefunden', onClick: () => markiereStattgefunden(t) }
                  : undefined,
              }))}
              onItemClick={id => overlay.replace({ type: 'termin', id })}
              empty={{
                text: 'Keine anstehenden Termine — alles entspannt.',
                action: {
                  label: 'Termin anlegen',
                  onClick: () => { setEditingTermin(null); setTermineDefaults(undefined); setTermineDialogOpen(true); },
                },
              }}
            />
            <WorkList
              title="Aktive Beteiligungen"
              items={aktiveUnternehmen.slice(0, 6).map(u => ({
                id: u.record_id,
                title: u.fields.name ?? 'Unternehmen',
                secondLine: (
                  <>
                    {u.fields.branche && (
                      <span className="font-medium text-foreground">{u.fields.branche.label}</span>
                    )}
                    {u.fields.beteiligungsquote != null && (
                      <span className="text-muted-foreground"> · {u.fields.beteiligungsquote}%</span>
                    )}
                    {u.fields.rechtsform && (
                      <span className="text-muted-foreground"> · {u.fields.rechtsform.label}</span>
                    )}
                  </>
                ),
                action: { label: 'Öffnen', onClick: () => overlay.replace({ type: 'unternehmen', id: u.record_id }) },
              }))}
              onItemClick={id => overlay.replace({ type: 'unternehmen', id })}
              empty={{
                text: 'Noch keine aktiven Beteiligungen.',
                action: {
                  label: 'Unternehmen hinzufügen',
                  onClick: () => { setEditingUnternehmen(null); setUnternehmenDefaults(undefined); setUnternehmenDialogOpen(true); },
                },
              }}
            />
          </>
        }
      />

      {/* ─── Overlays ─── */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'unternehmen') {
            const u = getUnternehmen(top.id);
            if (!u) return null;
            return (
              <>
                <RecordHeader
                  title={u.fields.name ?? 'Unternehmen'}
                  subtitle={[u.fields.branche?.label, u.fields.rechtsform?.label].filter(Boolean).join(' · ')}
                  badges={
                    u.fields.status ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.fields.status.key === 'aktiv' ? 'bg-success/10 text-success' :
                        u.fields.status.key === 'exit' ? 'bg-muted text-muted-foreground' :
                        'bg-warning/10 text-warning'
                      }`}>{u.fields.status.label}</span>
                    ) : undefined
                  }
                />
                <UnternehmenDetails
                  record={u}
                  termineList={termine}
                  onOpenTermine={t => overlay.push({ type: 'termin', id: t.record_id })}
                  onAddTermine={() => openTermineForUnternehmen(u.record_id)}
                  dokumenteList={dokumente}
                  onOpenDokumente={d => overlay.push({ type: 'dokument', id: d.record_id })}
                  onAddDokumente={() => openDokumenteForUnternehmen(u.record_id)}
                  notizenList={notizen}
                  onOpenNotizen={n => overlay.push({ type: 'notiz', id: n.record_id })}
                  onAddNotizen={() => openNotizenForUnternehmen(u.record_id)}
                />
              </>
            );
          }
          if (top.type === 'termin') {
            const t = getTermin(top.id);
            if (!t) return null;
            return (
              <>
                <RecordHeader
                  title={t.fields.terminbezeichnung ?? 'Termin'}
                  subtitle={[t.fields.terminart?.label, t.fields.ort].filter(Boolean).join(' · ')}
                  meta={t.fields.datum_uhrzeit ? formatDateTime(t.fields.datum_uhrzeit) : undefined}
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
            const d = getDokument(top.id);
            if (!d) return null;
            return (
              <>
                <RecordHeader
                  title={d.fields.dokumentenbezeichnung ?? 'Dokument'}
                  subtitle={d.fields.dokumententyp?.label}
                  meta={d.fields.dokumentendatum ? formatDate(d.fields.dokumentendatum) : undefined}
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
            const n = getNotiz(top.id);
            if (!n) return null;
            return (
              <>
                <RecordHeader
                  title={n.fields.notiz_titel ?? 'Notiz'}
                  subtitle={n.fields.kategorie?.label}
                  meta={n.fields.notiz_datum ? formatDate(n.fields.notiz_datum) : undefined}
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
            const u = getUnternehmen(top.id);
            if (u) { setEditingUnternehmen(u); setUnternehmenDefaults(u.fields as UnternehmenDialogDefaults); setUnternehmenDialogOpen(true); }
          } else if (top.type === 'termin') {
            const t = getTermin(top.id);
            if (t) { setEditingTermin(t); setTermineDefaults(t.fields as TermineDialogDefaults); setTermineDialogOpen(true); }
          } else if (top.type === 'dokument') {
            const d = getDokument(top.id);
            if (d) { setEditingDokument(d); setDokumenteDefaults(d.fields as DokumenteDialogDefaults); setDokumenteDialogOpen(true); }
          } else if (top.type === 'notiz') {
            const n = getNotiz(top.id);
            if (n) { setEditingNotiz(n); setNotizenDefaults(n.fields as NotizenDialogDefaults); setNotizenDialogOpen(true); }
          }
        }}
        footer={top => {
          if (top.type === 'termin') {
            const t = getTermin(top.id);
            if (t && t.fields.terminstatus?.key === 'geplant') {
              const enriched = enrichedTermine.find(e => e.record_id === top.id);
              if (enriched) return { label: '✓ Als stattgefunden markieren', onClick: () => markiereStattgefunden(enriched) };
            }
          }
          return undefined;
        }}
      />

      {/* ─── Dialoge ─── */}
      <UnternehmenDialog
        open={unternehmenDialogOpen}
        onClose={() => { setUnternehmenDialogOpen(false); setEditingUnternehmen(null); setUnternehmenDefaults(undefined); }}
        onSubmit={async fields => {
          if (editingUnternehmen) {
            await LivingAppsService.updateUnternehmenEntry(editingUnternehmen.record_id, fields);
            undoToast(`${fields.name ?? 'Unternehmen'} aktualisiert`);
          } else {
            await LivingAppsService.createUnternehmenEntry(fields);
            undoToast(`${fields.name ?? 'Unternehmen'} angelegt`);
          }
          fetchAll();
        }}
        defaultValues={unternehmenDefaults}
        recordId={editingUnternehmen?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
      />

      <TermineDialog
        open={termineDialogOpen}
        onClose={() => { setTermineDialogOpen(false); setEditingTermin(null); setTermineDefaults(undefined); }}
        onSubmit={async fields => {
          if (editingTermin) {
            await LivingAppsService.updateTermineEntry(editingTermin.record_id, fields);
            undoToast(`Termin aktualisiert`);
          } else {
            await LivingAppsService.createTermineEntry(fields);
            undoToast(`Termin angelegt`);
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
        open={dokumenteDialogOpen}
        onClose={() => { setDokumenteDialogOpen(false); setEditingDokument(null); setDokumenteDefaults(undefined); }}
        onSubmit={async fields => {
          if (editingDokument) {
            await LivingAppsService.updateDokumenteEntry(editingDokument.record_id, fields);
            undoToast(`Dokument aktualisiert`);
          } else {
            await LivingAppsService.createDokumenteEntry(fields);
            undoToast(`Dokument angelegt`);
          }
          fetchAll();
        }}
        defaultValues={dokumenteDefaults}
        recordId={editingDokument?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Dokumente']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Dokumente']}
      />

      <NotizenDialog
        open={notizenDialogOpen}
        onClose={() => { setNotizenDialogOpen(false); setEditingNotiz(null); setNotizenDefaults(undefined); }}
        onSubmit={async fields => {
          if (editingNotiz) {
            await LivingAppsService.updateNotizenEntry(editingNotiz.record_id, fields);
            undoToast(`Notiz aktualisiert`);
          } else {
            await LivingAppsService.createNotizenEntry(fields);
            undoToast(`Notiz angelegt`);
          }
          fetchAll();
        }}
        defaultValues={notizenDefaults}
        recordId={editingNotiz?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />
    </>
  );
}
