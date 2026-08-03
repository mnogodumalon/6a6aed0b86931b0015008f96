import { useState, useMemo, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine, enrichDokumente, enrichNotizen } from '@/lib/enrich';
import type { EnrichedTermine } from '@/types/enriched';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { CalendarWidget } from '@/components/widgets/CalendarWidget';
import type { CalendarEvent } from '@/components/widgets/CalendarWidget';
import {
  RecordOverlayHost,
  RecordHeader,
  RecordSection,
  RecordField,
  RecordAttachments,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { SatelliteSection } from '@/components/SatelliteSection';
import { TermineDetails } from '@/components/details/TermineDetails';
import { DokumenteDetails } from '@/components/details/DokumenteDetails';
import { NotizenDetails } from '@/components/details/NotizenDetails';
import { UnternehmenDialog } from '@/components/dialogs/UnternehmenDialog';
import { TermineDialog } from '@/components/dialogs/TermineDialog';
import type { TermineDialogDefaults } from '@/components/dialogs/TermineDialog';
import { DokumenteDialog } from '@/components/dialogs/DokumenteDialog';
import type { DokumenteDialogDefaults } from '@/components/dialogs/DokumenteDialog';
import { NotizenDialog } from '@/components/dialogs/NotizenDialog';
import type { NotizenDialogDefaults } from '@/components/dialogs/NotizenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import {
  IconCalendar,
  IconBuilding,
  IconFileText,
  IconNote,
  IconAlertCircle,
  IconPlus,
} from '@tabler/icons-react';

type OverlayItem =
  | { type: 'unternehmen'; id: string }
  | { type: 'termine'; id: string }
  | { type: 'dokumente'; id: string }
  | { type: 'notizen'; id: string };

export default function DashboardOverview() {
  const clock = useClock();

  const {
    unternehmen, setTermine, termine, dokumente, notizen,
    unternehmenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedTermine = enrichTermine(termine, { unternehmenMap });
  const enrichedDokumente = enrichDokumente(dokumente, { unternehmenMap });
  const enrichedNotizen = enrichNotizen(notizen, { unternehmenMap });

  const overlay = useRecordOverlayStack<OverlayItem>();

  // Dialog state
  const [unternehmenDialogOpen, setUnternehmenDialogOpen] = useState(false);
  const [termineDialogOpen, setTermineDialogOpen] = useState(false);
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>();
  const [termineEditId, setTermineEditId] = useState<string | undefined>();
  const [dokumenteDialogOpen, setDokumenteDialogOpen] = useState(false);
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>();
  const [dokumenteEditId, setDokumenteEditId] = useState<string | undefined>();
  const [notizenDialogOpen, setNotizenDialogOpen] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>();
  const [notizenEditId, setNotizenEditId] = useState<string | undefined>();

  // KPI filter
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Derived values
  const today = format(clock, 'yyyy-MM-dd');
  const in7Days = format(addDays(clock, 7), 'yyyy-MM-dd');

  const aktiveUnternehmen = useMemo(() =>
    unternehmen.filter(u => u.fields.status?.key === 'aktiv'), [unternehmen]);

  const upcomingTermine = useMemo(() =>
    enrichedTermine
      .filter(t => t.fields.datum_uhrzeit && t.fields.datum_uhrzeit >= today && t.fields.terminstatus?.key !== 'abgesagt')
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedTermine, today]);

  const termineThisWeek = useMemo(() =>
    upcomingTermine.filter(t => t.fields.datum_uhrzeit && t.fields.datum_uhrzeit <= in7Days),
    [upcomingTermine, in7Days]);

  const pendingTermine = useMemo(() =>
    enrichedTermine.filter(t => t.fields.terminstatus?.key === 'geplant' && t.fields.datum_uhrzeit && t.fields.datum_uhrzeit < today),
    [enrichedTermine, today]);

  const recentNotizen = useMemo(() =>
    [...enrichedNotizen].sort((a, b) => (b.fields.notiz_datum ?? '').localeCompare(a.fields.notiz_datum ?? '')).slice(0, 8),
    [enrichedNotizen]);

  // CalendarWidget events from Termine
  const calendarEvents: CalendarEvent[] = useMemo(() =>
    termine
      .filter(t => !!t.fields.datum_uhrzeit)
      .map(t => {
        const uName = extractRecordId(t.fields.unternehmen)
          ? unternehmenMap.get(extractRecordId(t.fields.unternehmen)!)?.fields.name ?? ''
          : '';
        const status = t.fields.terminstatus?.key;
        return {
          id: `termin:${t.record_id}`,
          start: t.fields.datum_uhrzeit!,
          title: t.fields.terminbezeichnung ?? 'Termin',
          subtitle: uName || t.fields.ort || undefined,
          tone: status === 'stattgefunden' ? 'success' : status === 'abgesagt' ? 'default' : 'primary',
        } as CalendarEvent;
      }),
    [termine, unternehmenMap]);

  // Advance termin status (Geplant → Stattgefunden)
  const advanceTerminStatus = useCallback(async (t: EnrichedTermine) => {
    const prev = t.fields.terminstatus?.key;
    if (prev !== 'geplant') return;
    const next = 'stattgefunden';
    setTermine(ts => ts.map(r => r.record_id === t.record_id
      ? { ...r, fields: { ...r.fields, terminstatus: { key: next, label: 'Stattgefunden' } } }
      : r));
    undoToast(`„${t.fields.terminbezeichnung}" als stattgefunden markiert`, async () => {
      setTermine(ts => ts.map(r => r.record_id === t.record_id
        ? { ...r, fields: { ...r.fields, terminstatus: { key: 'geplant', label: 'Geplant' } } }
        : r));
      try { await LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: 'geplant' }); }
      catch { fetchAll(); }
    });
    try {
      await LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: next });
    } catch {
      fetchAll();
    }
  }, [setTermine, fetchAll]);

  // Context line
  const contextLine = useMemo(() => {
    if (termine.length === 0 && unternehmen.length === 0) {
      return 'Starte jetzt und füge dein erstes Beteiligungsunternehmen hinzu.';
    }
    if (termineThisWeek.length > 0) {
      const companies = termineThisWeek.map(t => t.unternehmenName).filter(Boolean);
      const unique = [...new Set(companies)];
      return `Diese Woche ${termineThisWeek.length === 1 ? 'steht ein Termin' : `stehen ${termineThisWeek.length} Termine`} an${unique.length > 0 ? ` — ${namen(unique)}` : ''}.`;
    }
    if (aktiveUnternehmen.length > 0) {
      return `${aktiveUnternehmen.length} aktive Beteiligung${aktiveUnternehmen.length > 1 ? 'en' : ''} im Portfolio — keine Termine diese Woche.`;
    }
    return 'Alles ruhig — keine Termine in den nächsten 7 Tagen.';
  }, [termine, unternehmen, termineThisWeek, aktiveUnternehmen]);

  // ─── Every hook goes ABOVE this line ───
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;
  // ─── Below this line: plain derivations only, no hooks. ───

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="mt-1 text-muted-foreground">{contextLine}</p>
        </div>
        <button
          onClick={() => setUnternehmenDialogOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <IconPlus size={16} className="shrink-0" />
          <span className="hidden sm:inline">Unternehmen</span>
        </button>
      </div>

      {/* Hero: overdue/pending appointments */}
      {pendingTermine.length > 0 && (
        <div className="mb-6">
          <HeroBanner
            icon={<IconAlertCircle size={18} />}
            action={{
              label: 'Als stattgefunden markieren',
              onClick: () => advanceTerminStatus(pendingTermine[0]),
            }}
          >
            <b>{pendingTermine.length === 1
              ? `„${pendingTermine[0].fields.terminbezeichnung}"`
              : `${pendingTermine.length} Termine`}</b>{' '}
            {pendingTermine.length === 1 ? 'ist' : 'sind'} noch als „Geplant" offen
            {pendingTermine[0].unternehmenName ? ` — ${pendingTermine[0].unternehmenName}` : ''}.
          </HeroBanner>
        </div>
      )}

      <DashboardGrid
        variant="wide"
        kpis={
          <StatStrip>
            <StatStripItem
              title="Aktiv"
              value={aktiveUnternehmen.length}
              icon={<IconBuilding size={16} className="shrink-0" />}
              tone={aktiveUnternehmen.length > 0 ? 'success' : 'default'}
              onClick={() => setStatusFilter(f => f === 'aktiv' ? null : 'aktiv')}
              active={statusFilter === 'aktiv'}
            />
            <StatStripItem
              title="Diese Woche"
              value={termineThisWeek.length}
              icon={<IconCalendar size={16} className="shrink-0" />}
              tone={termineThisWeek.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Dokumente"
              value={dokumente.length}
              icon={<IconFileText size={16} className="shrink-0" />}
              tone="default"
            />
            <StatStripItem
              title="Notizen"
              value={notizen.length}
              icon={<IconNote size={16} className="shrink-0" />}
              tone="default"
            />
          </StatStrip>
        }
        primary={
          <CalendarWidget
            events={calendarEvents}
            locale={de}
            defaultView="week"
            weekDays={5}
            onEventClick={ev => {
              const id = ev.id.split(':')[1];
              overlay.replace({ type: 'termine', id });
            }}
            onEmptyClick={date => {
              setTermineDefaults({
                datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm"),
              });
              setTermineEditId(undefined);
              setTermineDialogOpen(true);
            }}
            onEventDrop={async (eventId, newStart) => {
              const id = eventId.split(':')[1];
              setTermine(ts => ts.map(r => r.record_id === id
                ? { ...r, fields: { ...r.fields, datum_uhrzeit: newStart } }
                : r));
              try {
                await LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: newStart });
              } catch {
                fetchAll();
              }
            }}
          />
        }
        aside={
          <>
            <WorkList
              title="Bevorstehende Termine"
              items={upcomingTermine.slice(0, 8).map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? 'Termin',
                secondLine: (
                  <>
                    <span className="font-medium text-foreground">
                      {t.fields.datum_uhrzeit ? formatDateTime(t.fields.datum_uhrzeit) : '—'}
                    </span>
                    {t.unternehmenName && (
                      <span className="text-muted-foreground"> · {t.unternehmenName}</span>
                    )}
                  </>
                ),
                action: t.fields.terminstatus?.key === 'geplant'
                  ? { label: '✓ Markieren', onClick: () => advanceTerminStatus(t) }
                  : undefined,
              }))}
              onItemClick={id => overlay.replace({ type: 'termine', id })}
              empty={{
                text: 'Keine bevorstehenden Termine — alles erledigt!',
                action: { label: 'Termin anlegen', onClick: () => { setTermineDefaults(undefined); setTermineDialogOpen(true); } },
              }}
            />
            <WorkList
              title="Neueste Notizen"
              items={recentNotizen.map(n => ({
                id: n.record_id,
                title: n.fields.notiz_titel ?? 'Notiz',
                secondLine: (
                  <>
                    <span className="text-muted-foreground">
                      {n.fields.notiz_datum ? formatDate(n.fields.notiz_datum) : '—'}
                    </span>
                    {n.unternehmenName && (
                      <span className="text-muted-foreground"> · {n.unternehmenName}</span>
                    )}
                  </>
                ),
              }))}
              onItemClick={id => overlay.replace({ type: 'notizen', id })}
              empty={{
                text: 'Noch keine Notizen vorhanden.',
                action: { label: 'Notiz anlegen', onClick: () => { setNotizenDefaults(undefined); setNotizenDialogOpen(true); } },
              }}
            />
          </>
        }
      />

      {/* Single RecordOverlayHost for all entity types */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'unternehmen') {
            const rec = unternehmen.find(u => u.record_id === top.id);
            if (!rec) return null;
            return (
              <>
                <RecordHeader
                  title={rec.fields.name ?? '—'}
                  subtitle={[rec.fields.branche?.label, rec.fields.stadt, rec.fields.land].filter(Boolean).join(' · ')}
                  badges={rec.fields.status ? (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      rec.fields.status.key === 'aktiv' ? 'bg-success/15 text-success' :
                      rec.fields.status.key === 'exit' ? 'bg-primary/15 text-primary' :
                      'bg-muted text-muted-foreground'
                    }`}>{rec.fields.status.label}</span>
                  ) : undefined}
                />
                <RecordSection title="Details" cols={2}>
                  <RecordField label="Unternehmensname" value={rec.fields.name} format="text" />
                  <RecordField label="Rechtsform" value={rec.fields.rechtsform} format="pill" />
                  <RecordField label="Branche" value={rec.fields.branche} format="pill" />
                  <RecordField label="Status" value={rec.fields.status} format="pill" />
                  <RecordField label="Beteiligungsquote (%)" value={rec.fields.beteiligungsquote != null ? String(rec.fields.beteiligungsquote) : undefined} format="text" />
                  <RecordField label="Investiertes Kapital (EUR)" value={rec.fields.investiertes_kapital != null ? String(rec.fields.investiertes_kapital) : undefined} format="text" />
                  <RecordField label="Aktueller Wert (EUR)" value={rec.fields.aktueller_wert != null ? String(rec.fields.aktueller_wert) : undefined} format="text" />
                  <RecordField label="Investitionsdatum" value={rec.fields.investitionsdatum} format="date" />
                  <RecordField label="Stadt" value={rec.fields.stadt} format="text" />
                  <RecordField label="Land" value={rec.fields.land} format="text" />
                  <RecordField label="Website" value={rec.fields.website} format="url" />
                  <RecordField label="Ansprechpartner" value={[rec.fields.ansprechpartner_vorname, rec.fields.ansprechpartner_nachname].filter(Boolean).join(' ') || undefined} format="text" />
                  <RecordField label="E-Mail" value={rec.fields.ansprechpartner_email} format="email" />
                  <RecordField label="Telefon" value={rec.fields.ansprechpartner_telefon} format="text" />
                  <RecordField label="Cockpit-Zusammenfassung" value={rec.fields.cockpit_zusammenfassung} format="longtext" className="md:col-span-2" />
                </RecordSection>

                {/* Hub satellites — all three required (check-hub gate) */}
                <SatelliteSection
                  title="Termine"
                  items={termine.filter(t => extractRecordId(t.fields.unternehmen) === rec.record_id)}
                  getKey={t => t.record_id}
                  map={t => ({ name: t.fields.terminbezeichnung ?? 'Termin', meta: t.fields.datum_uhrzeit ? formatDateTime(t.fields.datum_uhrzeit) : undefined })}
                  onOpen={t => overlay.push({ type: 'termine', id: t.record_id })}
                  onAdd={() => {
                    setTermineDefaults({ unternehmen: rec.record_id });
                    setTermineEditId(undefined);
                    setTermineDialogOpen(true);
                  }}
                />
                <SatelliteSection
                  title="Dokumente"
                  items={dokumente.filter(d => extractRecordId(d.fields.unternehmen) === rec.record_id)}
                  getKey={d => d.record_id}
                  map={d => ({ name: d.fields.dokumentenbezeichnung ?? 'Dokument', meta: d.fields.dokumentendatum ? formatDate(d.fields.dokumentendatum) : undefined })}
                  onOpen={d => overlay.push({ type: 'dokumente', id: d.record_id })}
                  onAdd={() => {
                    setDokumenteDefaults({ unternehmen: rec.record_id });
                    setDokumenteEditId(undefined);
                    setDokumenteDialogOpen(true);
                  }}
                />
                <SatelliteSection
                  title="Notizen"
                  items={notizen.filter(n => extractRecordId(n.fields.unternehmen) === rec.record_id)}
                  getKey={n => n.record_id}
                  map={n => ({ name: n.fields.notiz_titel ?? 'Notiz', meta: n.fields.notiz_datum ? formatDate(n.fields.notiz_datum) : undefined })}
                  onOpen={n => overlay.push({ type: 'notizen', id: n.record_id })}
                  onAdd={() => {
                    setNotizenDefaults({ unternehmen: rec.record_id });
                    setNotizenEditId(undefined);
                    setNotizenDialogOpen(true);
                  }}
                />

                <RecordAttachments appId={APP_IDS.UNTERNEHMEN} recordId={rec.record_id} />
              </>
            );
          }
          if (top.type === 'termine') {
            const rec = termine.find(t => t.record_id === top.id);
            if (!rec) return null;
            return (
              <>
                <RecordHeader
                  title={rec.fields.terminbezeichnung ?? '—'}
                  subtitle={[rec.fields.terminart?.label, rec.fields.datum_uhrzeit ? formatDateTime(rec.fields.datum_uhrzeit) : undefined].filter(Boolean).join(' · ')}
                  badges={rec.fields.terminstatus ? (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      rec.fields.terminstatus.key === 'stattgefunden' ? 'bg-success/15 text-success' :
                      rec.fields.terminstatus.key === 'abgesagt' ? 'bg-destructive/15 text-destructive' :
                      'bg-primary/15 text-primary'
                    }`}>{rec.fields.terminstatus.label}</span>
                  ) : undefined}
                />
                <TermineDetails
                  record={rec}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u => overlay.push({ type: 'unternehmen', id: u.record_id })}
                />
              </>
            );
          }
          if (top.type === 'dokumente') {
            const rec = dokumente.find(d => d.record_id === top.id);
            if (!rec) return null;
            return (
              <>
                <RecordHeader
                  title={rec.fields.dokumentenbezeichnung ?? '—'}
                  subtitle={[rec.fields.dokumententyp?.label, rec.fields.dokumentendatum ? formatDate(rec.fields.dokumentendatum) : undefined].filter(Boolean).join(' · ')}
                />
                <DokumenteDetails
                  record={rec}
                  unternehmenList={unternehmen}
                  onOpenUnternehmen={u => overlay.push({ type: 'unternehmen', id: u.record_id })}
                />
              </>
            );
          }
          if (top.type === 'notizen') {
            const rec = notizen.find(n => n.record_id === top.id);
            if (!rec) return null;
            return (
              <>
                <RecordHeader
                  title={rec.fields.notiz_titel ?? '—'}
                  subtitle={[rec.fields.kategorie?.label, rec.fields.notiz_datum ? formatDate(rec.fields.notiz_datum) : undefined].filter(Boolean).join(' · ')}
                  badges={rec.fields.prioritaet ? (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      rec.fields.prioritaet.key === 'hoch' ? 'bg-destructive/15 text-destructive' :
                      rec.fields.prioritaet.key === 'mittel' ? 'bg-warning/15 text-warning' :
                      'bg-muted text-muted-foreground'
                    }`}>{rec.fields.prioritaet.label}</span>
                  ) : undefined}
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
          if (top.type === 'termine') {
            const rec = termine.find(t => t.record_id === top.id);
            if (rec && rec.fields.terminstatus?.key === 'geplant') {
              return {
                label: '✓ Als stattgefunden markieren',
                onClick: () => {
                  const enriched = enrichedTermine.find(t => t.record_id === top.id);
                  if (enriched) {
                    advanceTerminStatus(enriched);
                    overlay.close();
                  }
                },
              };
            }
          }
          return undefined;
        }}
        onEdit={top => {
          if (top.type === 'termine') {
            const rec = termine.find(t => t.record_id === top.id);
            if (!rec) return;
            setTermineDefaults(undefined);
            setTermineEditId(rec.record_id);
            setTermineDialogOpen(true);
          } else if (top.type === 'dokumente') {
            const rec = dokumente.find(d => d.record_id === top.id);
            if (!rec) return;
            setDokumenteDefaults(undefined);
            setDokumenteEditId(rec.record_id);
            setDokumenteDialogOpen(true);
          } else if (top.type === 'notizen') {
            const rec = notizen.find(n => n.record_id === top.id);
            if (!rec) return;
            setNotizenDefaults(undefined);
            setNotizenEditId(rec.record_id);
            setNotizenDialogOpen(true);
          }
        }}
      />

      {/* Dialogs */}
      <UnternehmenDialog
        open={unternehmenDialogOpen}
        onClose={() => setUnternehmenDialogOpen(false)}
        onSubmit={async fields => {
          await LivingAppsService.createUnternehmenEntry(fields);
          fetchAll();
        }}
        enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
      />

      <TermineDialog
        open={termineDialogOpen}
        onClose={() => { setTermineDialogOpen(false); setTermineDefaults(undefined); setTermineEditId(undefined); }}
        onSubmit={async fields => {
          if (termineEditId) {
            await LivingAppsService.updateTermineEntry(termineEditId, fields);
          } else {
            await LivingAppsService.createTermineEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={termineEditId
          ? termine.find(t => t.record_id === termineEditId)?.fields
          : termineDefaults}
        recordId={termineEditId}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Termine']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Termine']}
      />

      <DokumenteDialog
        open={dokumenteDialogOpen}
        onClose={() => { setDokumenteDialogOpen(false); setDokumenteDefaults(undefined); setDokumenteEditId(undefined); }}
        onSubmit={async fields => {
          if (dokumenteEditId) {
            await LivingAppsService.updateDokumenteEntry(dokumenteEditId, fields);
          } else {
            await LivingAppsService.createDokumenteEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={dokumenteEditId
          ? dokumente.find(d => d.record_id === dokumenteEditId)?.fields
          : dokumenteDefaults}
        recordId={dokumenteEditId}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Dokumente']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Dokumente']}
      />

      <NotizenDialog
        open={notizenDialogOpen}
        onClose={() => { setNotizenDialogOpen(false); setNotizenDefaults(undefined); setNotizenEditId(undefined); }}
        onSubmit={async fields => {
          if (notizenEditId) {
            await LivingAppsService.updateNotizenEntry(notizenEditId, fields);
          } else {
            await LivingAppsService.createNotizenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={notizenEditId
          ? notizen.find(n => n.record_id === notizenEditId)?.fields
          : notizenDefaults}
        recordId={notizenEditId}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />
    </>
  );
}
