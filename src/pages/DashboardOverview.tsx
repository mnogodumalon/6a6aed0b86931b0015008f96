import { useState, useMemo, useCallback } from 'react';
import { de } from 'date-fns/locale';
import { format, parseISO, isAfter, isBefore, startOfDay, addDays } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine, enrichDokumente, enrichNotizen } from '@/lib/enrich';
import type { EnrichedTermine } from '@/types/enriched';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import {
  RecordOverlayHost,
  RecordHeader,
  RecordField,
  RecordSection,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { UnternehmenDetails } from '@/components/details/UnternehmenDetails';
import { TermineDetails } from '@/components/details/TermineDetails';
import { DokumenteDetails } from '@/components/details/DokumenteDetails';
import { NotizenDetails } from '@/components/details/NotizenDetails';
import { CalendarWidget, type CalendarEvent, type CalendarTone } from '@/components/widgets/CalendarWidget';
import { UnternehmenDialog, type UnternehmenDialogDefaults } from '@/components/dialogs/UnternehmenDialog';
import { TermineDialog, type TermineDialogDefaults } from '@/components/dialogs/TermineDialog';
import { DokumenteDialog, type DokumenteDialogDefaults } from '@/components/dialogs/DokumenteDialog';
import { NotizenDialog, type NotizenDialogDefaults } from '@/components/dialogs/NotizenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import {
  IconBuilding, IconPlus, IconCalendarEvent, IconFileText,
  IconNotes, IconAlertCircle, IconBriefcase, IconTrendingUp,
  IconCheck,
} from '@tabler/icons-react';

// Overlay stack item type
type OverlayItem =
  | { type: 'unternehmen'; id: string }
  | { type: 'termin'; id: string }
  | { type: 'dokument'; id: string }
  | { type: 'notiz'; id: string };

function terminTone(t: Termine): CalendarTone {
  const key = t.fields.terminstatus?.key;
  if (key === 'abgesagt') return 'destructive';
  if (key === 'stattgefunden') return 'default';
  const art = t.fields.terminart?.key;
  if (art === 'gremiensitzung' || art === 'gesellschafterversammlung') return 'warning';
  if (art === 'strategiemeeting') return 'primary';
  return 'success';
}

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

  // Dialog state
  const [unternehmenDialog, setUnternehmenDialog] = useState(false);
  const [unternehmenDefaults, setUnternehmenDefaults] = useState<UnternehmenDialogDefaults | undefined>();
  const [editingUnternehmen, setEditingUnternehmen] = useState<Unternehmen | null>(null);

  const [termineDialog, setTermineDialog] = useState(false);
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>();
  const [editingTermin, setEditingTermin] = useState<Termine | null>(null);

  const [dokumenteDialog, setDokumenteDialog] = useState(false);
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>();
  const [editingDokument, setEditingDokument] = useState<Dokumente | null>(null);

  const [notizenDialog, setNotizenDialog] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>();
  const [editingNotiz, setEditingNotiz] = useState<Notizen | null>(null);

  // Enriched data
  const enrichedTermine = enrichTermine(termine, { unternehmenMap });
  const enrichedDokumente = enrichDokumente(dokumente, { unternehmenMap });
  const enrichedNotizen = enrichNotizen(notizen, { unternehmenMap });

  // Derived data
  const today = format(clock, 'yyyy-MM-dd');
  const in7days = format(addDays(clock, 7), 'yyyy-MM-dd');
  const in30days = format(addDays(clock, 30), 'yyyy-MM-dd');

  const aktiveUnternehmen = useMemo(() => unternehmen.filter(u => u.fields.status?.key === 'aktiv'), [unternehmen]);
  const gesamtkapital = useMemo(() => unternehmen.reduce((s, u) => s + (u.fields.investiertes_kapital ?? 0), 0), [unternehmen]);

  const anstehendeTermine = useMemo(() =>
    enrichedTermine
      .filter(t => {
        const dt = t.fields.datum_uhrzeit;
        return dt && dt >= today && t.fields.terminstatus?.key !== 'abgesagt';
      })
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedTermine, today]
  );

  const termineNaechste7Tage = useMemo(() =>
    anstehendeTermine.filter(t => t.fields.datum_uhrzeit && t.fields.datum_uhrzeit <= in7days),
    [anstehendeTermine, in7days]
  );

  const termineNaechste30Tage = useMemo(() =>
    anstehendeTermine.filter(t => t.fields.datum_uhrzeit && t.fields.datum_uhrzeit <= in30days),
    [anstehendeTermine, in30days]
  );

  const ueberfaelligeTermine = useMemo(() =>
    enrichedTermine.filter(t => {
      const dt = t.fields.datum_uhrzeit;
      return dt && dt < today && t.fields.terminstatus?.key === 'geplant';
    }),
    [enrichedTermine, today]
  );

  const calendarEvents = useMemo((): CalendarEvent[] =>
    termine.map(t => ({
      id: `termin:${t.record_id}`,
      start: t.fields.datum_uhrzeit ?? today,
      title: t.fields.terminbezeichnung ?? 'Termin',
      subtitle: unternehmenMap.get(extractRecordId(t.fields.unternehmen) ?? '')?.fields.name,
      tone: terminTone(t),
    })),
    [termine, unternehmenMap, today]
  );

  // Advance a term to "stattgefunden"
  const advanceTermin = useCallback(async (t: Termine) => {
    const prev = termine.find(r => r.record_id === t.record_id);
    if (!prev) return;
    setTermine(ts => ts.map(r => r.record_id === t.record_id
      ? { ...r, fields: { ...r.fields, terminstatus: { key: 'stattgefunden', label: 'Stattgefunden' } } }
      : r
    ));
    undoToast(`Termin „${t.fields.terminbezeichnung}" als stattgefunden markiert`, async () => {
      setTermine(ts => ts.map(r => r.record_id === t.record_id ? prev : r));
      await LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: 'geplant' });
    });
    try {
      await LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: 'stattgefunden' });
    } catch {
      fetchAll();
    }
  }, [termine, setTermine, fetchAll]);

  const openTerminCreate = useCallback((defaults?: TermineDialogDefaults) => {
    setEditingTermin(null);
    setTermineDefaults(defaults);
    setTermineDialog(true);
  }, []);

  const openUnternehmenCreate = useCallback(() => {
    setEditingUnternehmen(null);
    setUnternehmenDefaults(undefined);
    setUnternehmenDialog(true);
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Context line
  const naechsterTermin = anstehendeTermine[0];
  const naechsteNames = termineNaechste7Tage.map(t => t.unternehmenName).filter(Boolean);
  let contextLine = 'Willkommen im BeteiligungsManager — dein Portfolio im Blick.';
  if (ueberfaelligeTermine.length > 0) {
    contextLine = `${ueberfaelligeTermine.length} Termin${ueberfaelligeTermine.length > 1 ? 'e' : ''} offen, noch kein Protokoll.`;
  } else if (naechsteNames.length > 0) {
    contextLine = `Diese Woche: Termine mit ${namen(naechsteNames)}.`;
  } else if (naechsterTermin) {
    contextLine = `Nächster Termin: ${naechsterTermin.fields.terminbezeichnung} am ${formatDate(naechsterTermin.fields.datum_uhrzeit)}.`;
  } else if (aktiveUnternehmen.length > 0) {
    contextLine = `${aktiveUnternehmen.length} aktive Beteiligungen — keine anstehenden Termine.`;
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{gruss(clock)}</h1>
            <p className="text-muted-foreground mt-1">{contextLine}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => openTerminCreate()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <IconPlus size={16} className="shrink-0" /> Termin
            </button>
            <button
              onClick={openUnternehmenCreate}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <IconBuilding size={16} className="shrink-0" /> Unternehmen
            </button>
          </div>
        </div>
      </div>

      <DashboardGrid
        variant="split"
        hero={ueberfaelligeTermine.length > 0 && (
          <HeroBanner
            icon={<IconAlertCircle size={18} />}
            action={{
              label: 'Termin nachführen',
              onClick: () => advanceTermin(ueberfaelligeTermine[0]),
            }}
          >
            <b>{namen(ueberfaelligeTermine.map(t => t.fields.terminbezeichnung ?? ''))}</b>
            {' '}— {ueberfaelligeTermine.length === 1 ? 'Termin' : `${ueberfaelligeTermine.length} Termine`} ohne Protokoll (war {formatDate(ueberfaelligeTermine[0].fields.datum_uhrzeit)}).
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title="Aktive Beteiligungen"
              value={aktiveUnternehmen.length}
              icon={<IconBriefcase size={16} className="shrink-0" />}
              tone="primary"
            />
            <StatStripItem
              title="Investiertes Kapital"
              value={gesamtkapital > 0 ? formatCurrency(gesamtkapital) : '—'}
              icon={<IconTrendingUp size={16} className="shrink-0" />}
              tone="default"
            />
            <StatStripItem
              title="Termine (7 Tage)"
              value={termineNaechste7Tage.length}
              icon={<IconCalendarEvent size={16} className="shrink-0" />}
              tone={termineNaechste7Tage.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title="Dokumente"
              value={dokumente.length}
              icon={<IconFileText size={16} className="shrink-0" />}
              tone="default"
            />
          </StatStrip>
        }
        aside={
          <>
            <WorkList
              title="Anstehende Termine"
              items={anstehendeTermine.slice(0, 8).map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? 'Termin',
                secondLine: (
                  <>
                    <span className="font-medium text-foreground">{t.unternehmenName}</span>
                    {t.fields.datum_uhrzeit && (
                      <span className="text-muted-foreground"> · {formatDateTime(t.fields.datum_uhrzeit)}</span>
                    )}
                  </>
                ),
                action: t.fields.terminstatus?.key !== 'stattgefunden' ? {
                  label: '✓',
                  onClick: () => advanceTermin(t),
                } : undefined,
              }))}
              onItemClick={id => overlay.replace({ type: 'termin', id })}
              empty={{
                text: 'Keine anstehenden Termine — jetzt eintragen',
                action: { label: 'Termin erstellen', onClick: () => openTerminCreate() },
              }}
            />
            <WorkList
              title="Notizen & Protokolle"
              items={enrichedNotizen
                .sort((a, b) => (b.fields.notiz_datum ?? '').localeCompare(a.fields.notiz_datum ?? ''))
                .slice(0, 6)
                .map(n => ({
                  id: n.record_id,
                  title: n.fields.notiz_titel ?? 'Notiz',
                  secondLine: (
                    <>
                      <span className="text-muted-foreground">{n.unternehmenName}</span>
                      {n.fields.prioritaet?.key === 'hoch' && (
                        <span className="ml-1 font-medium text-destructive"> · Hoch</span>
                      )}
                    </>
                  ),
                }))}
              onItemClick={id => overlay.replace({ type: 'notiz', id })}
              empty={{
                text: 'Noch keine Notizen',
                action: {
                  label: 'Notiz erstellen',
                  onClick: () => {
                    setEditingNotiz(null);
                    setNotizenDefaults(undefined);
                    setNotizenDialog(true);
                  },
                },
              }}
            />
          </>
        }
        primary={
          <CalendarWidget
            events={calendarEvents}
            defaultView="month"
            locale={de}
            onEventClick={ev => {
              const id = ev.id.split(':')[1] ?? '';
              overlay.replace({ type: 'termin', id });
            }}
            onEmptyClick={date => {
              openTerminCreate({ datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm") });
            }}
            onEventDrop={async (eventId, newStart) => {
              const id = eventId.split(':')[1] ?? '';
              const prev = termine.find(t => t.record_id === id);
              if (!prev) return;
              setTermine(ts => ts.map(t => t.record_id === id
                ? { ...t, fields: { ...t.fields, datum_uhrzeit: newStart } }
                : t
              ));
              undoToast('Termin verschoben', async () => {
                setTermine(ts => ts.map(t => t.record_id === id ? prev : t));
                await LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: prev.fields.datum_uhrzeit });
              });
              try {
                await LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: newStart });
              } catch {
                fetchAll();
              }
            }}
          />
        }
      />

      {/* Record Overlay */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'unternehmen') {
            const rec = unternehmen.find(u => u.record_id === top.id);
            if (!rec) return null;
            return (
              <>
                <RecordHeader
                  title={rec.fields.name ?? 'Unternehmen'}
                  subtitle={[rec.fields.branche?.label, rec.fields.rechtsform?.label].filter(Boolean).join(' · ')}
                  badges={
                    rec.fields.status && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        rec.fields.status.key === 'aktiv' ? 'bg-success/10 text-success' :
                        rec.fields.status.key === 'exit' ? 'bg-muted text-muted-foreground' :
                        'bg-destructive/10 text-destructive'
                      }`}>{rec.fields.status.label}</span>
                    )
                  }
                />
                <UnternehmenDetails
                  record={rec}
                  termineList={termine}
                  onOpenTermine={t => overlay.push({ type: 'termin', id: t.record_id })}
                  onAddTermine={() => openTerminCreate({ unternehmen: rec.record_id })}
                  dokumenteList={dokumente}
                  onOpenDokumente={d => overlay.push({ type: 'dokument', id: d.record_id })}
                  onAddDokumente={() => {
                    setEditingDokument(null);
                    setDokumenteDefaults({ unternehmen: rec.record_id });
                    setDokumenteDialog(true);
                  }}
                  notizenList={notizen}
                  onOpenNotizen={n => overlay.push({ type: 'notiz', id: n.record_id })}
                  onAddNotizen={() => {
                    setEditingNotiz(null);
                    setNotizenDefaults({ unternehmen: rec.record_id });
                    setNotizenDialog(true);
                  }}
                />
              </>
            );
          }
          if (top.type === 'termin') {
            const rec = termine.find(t => t.record_id === top.id);
            if (!rec) return null;
            const unternehmenRec = unternehmenMap.get(extractRecordId(rec.fields.unternehmen) ?? '');
            return (
              <>
                <RecordHeader
                  title={rec.fields.terminbezeichnung ?? 'Termin'}
                  subtitle={[rec.fields.terminart?.label, formatDateTime(rec.fields.datum_uhrzeit)].filter(Boolean).join(' · ')}
                  badges={
                    rec.fields.terminstatus && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        rec.fields.terminstatus.key === 'stattgefunden' ? 'bg-success/10 text-success' :
                        rec.fields.terminstatus.key === 'abgesagt' ? 'bg-destructive/10 text-destructive' :
                        'bg-warning/10 text-warning'
                      }`}>{rec.fields.terminstatus.label}</span>
                    )
                  }
                  meta={
                    unternehmenRec ? (
                      <button
                        onClick={() => overlay.push({ type: 'unternehmen', id: unternehmenRec.record_id })}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <IconBuilding size={14} className="shrink-0" />
                        {unternehmenRec.fields.name}
                      </button>
                    ) : undefined
                  }
                />
                <TermineDetails
                  record={rec}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u => overlay.push({ type: 'unternehmen', id: u.record_id })}
                />
              </>
            );
          }
          if (top.type === 'dokument') {
            const rec = dokumente.find(d => d.record_id === top.id);
            if (!rec) return null;
            return (
              <>
                <RecordHeader
                  title={rec.fields.dokumentenbezeichnung ?? 'Dokument'}
                  subtitle={[rec.fields.dokumententyp?.label, formatDate(rec.fields.dokumentendatum)].filter(Boolean).join(' · ')}
                />
                <DokumenteDetails
                  record={rec}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u => overlay.push({ type: 'unternehmen', id: u.record_id })}
                />
              </>
            );
          }
          if (top.type === 'notiz') {
            const rec = notizen.find(n => n.record_id === top.id);
            if (!rec) return null;
            return (
              <>
                <RecordHeader
                  title={rec.fields.notiz_titel ?? 'Notiz'}
                  subtitle={[rec.fields.kategorie?.label, formatDate(rec.fields.notiz_datum)].filter(Boolean).join(' · ')}
                  badges={
                    rec.fields.prioritaet?.key === 'hoch' ? (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">Hoch</span>
                    ) : undefined
                  }
                />
                <NotizenDetails
                  record={rec}
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
            const rec = termine.find(t => t.record_id === top.id);
            if (rec && rec.fields.terminstatus?.key === 'geplant') {
              return {
                label: 'Als stattgefunden markieren',
                onClick: async () => {
                  await advanceTermin(rec);
                  overlay.close();
                },
              };
            }
          }
          return undefined;
        }}
        onEdit={top => {
          if (top.type === 'unternehmen') {
            const rec = unternehmen.find(u => u.record_id === top.id);
            if (rec) {
              setEditingUnternehmen(rec);
              setUnternehmenDefaults(rec.fields as UnternehmenDialogDefaults);
              setUnternehmenDialog(true);
            }
          } else if (top.type === 'termin') {
            const rec = termine.find(t => t.record_id === top.id);
            if (rec) {
              setEditingTermin(rec);
              setTermineDefaults(rec.fields as TermineDialogDefaults);
              setTermineDialog(true);
            }
          } else if (top.type === 'dokument') {
            const rec = dokumente.find(d => d.record_id === top.id);
            if (rec) {
              setEditingDokument(rec);
              setDokumenteDefaults(rec.fields as DokumenteDialogDefaults);
              setDokumenteDialog(true);
            }
          } else if (top.type === 'notiz') {
            const rec = notizen.find(n => n.record_id === top.id);
            if (rec) {
              setEditingNotiz(rec);
              setNotizenDefaults(rec.fields as NotizenDialogDefaults);
              setNotizenDialog(true);
            }
          }
        }}
      />

      {/* Dialogs */}
      <UnternehmenDialog
        open={unternehmenDialog}
        onClose={() => { setUnternehmenDialog(false); setEditingUnternehmen(null); }}
        onSubmit={async fields => {
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
        onClose={() => { setTermineDialog(false); setEditingTermin(null); }}
        onSubmit={async fields => {
          if (editingTermin) {
            await LivingAppsService.updateTermineEntry(editingTermin.record_id, fields);
          } else {
            await LivingAppsService.createTermineEntry(fields);
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
        onClose={() => { setDokumenteDialog(false); setEditingDokument(null); }}
        onSubmit={async fields => {
          if (editingDokument) {
            await LivingAppsService.updateDokumenteEntry(editingDokument.record_id, fields);
          } else {
            await LivingAppsService.createDokumenteEntry(fields);
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
        open={notizenDialog}
        onClose={() => { setNotizenDialog(false); setEditingNotiz(null); }}
        onSubmit={async fields => {
          if (editingNotiz) {
            await LivingAppsService.updateNotizenEntry(editingNotiz.record_id, fields);
          } else {
            await LivingAppsService.createNotizenEntry(fields);
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
