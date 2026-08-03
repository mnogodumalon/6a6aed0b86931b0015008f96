import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isBefore, isAfter, addDays, startOfToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine, enrichDokumente, enrichNotizen } from '@/lib/enrich';
import type { EnrichedTermine } from '@/types/enriched';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  useRecordOverlayStack,
  RecordOverlayHost,
  RecordHeader,
  RecordSection,
  RecordField,
  RecordAttachments,
} from '@/components/widgets/RecordView';
import {
  CalendarWidget,
  type CalendarEvent,
} from '@/components/widgets/CalendarWidget';
import { TermineDetails } from '@/components/details/TermineDetails';
import { DokumenteDetails } from '@/components/details/DokumenteDetails';
import { NotizenDetails } from '@/components/details/NotizenDetails';
import { SatelliteSection } from '@/components/SatelliteSection';
import { UnternehmenDialog, type UnternehmenDialogDefaults } from '@/components/dialogs/UnternehmenDialog';
import { TermineDialog, type TermineDialogDefaults } from '@/components/dialogs/TermineDialog';
import { DokumenteDialog, type DokumenteDialogDefaults } from '@/components/dialogs/DokumenteDialog';
import { NotizenDialog, type NotizenDialogDefaults } from '@/components/dialogs/NotizenDialog';
import {
  IconBuilding,
  IconCalendar,
  IconAlertTriangle,
  IconPlus,
  IconCurrencyEuro,
  IconChartBar,
  IconBriefcase,
  IconNotes,
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
  const overlay = useRecordOverlayStack<OverlayItem>();

  // Dialog state
  const [unternehmenDialog, setUnternehmenDialog] = useState(false);
  const [unternehmenDefaults, setUnternehmenDefaults] = useState<UnternehmenDialogDefaults | undefined>();
  const [editingUnternehmen, setEditingUnternehmen] = useState<Unternehmen | undefined>();

  const [termineDialog, setTermineDialog] = useState(false);
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>();
  const [editingTermin, setEditingTermin] = useState<Termine | undefined>();

  const [dokumenteDialog, setDokumenteDialog] = useState(false);
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>();
  const [editingDokument, setEditingDokument] = useState<Dokumente | undefined>();

  const [notizenDialog, setNotizenDialog] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>();
  const [editingNotiz, setEditingNotiz] = useState<Notizen | undefined>();

  const enrichedTermine = useMemo(() => enrichTermine(termine, { unternehmenMap }), [termine, unternehmenMap]);
  const enrichedDokumente = useMemo(() => enrichDokumente(dokumente, { unternehmenMap }), [dokumente, unternehmenMap]);
  const enrichedNotizen = useMemo(() => enrichNotizen(notizen, { unternehmenMap }), [notizen, unternehmenMap]);

  const today = useMemo(() => format(clock, 'yyyy-MM-dd'), [clock]);

  // Termine: upcoming (geplant, in next 30 days) and overdue (geplant, past)
  const anstehendeTermine = useMemo(() =>
    enrichedTermine
      .filter(t => t.fields.terminstatus?.key === 'geplant' && t.fields.datum_uhrzeit && t.fields.datum_uhrzeit >= today)
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedTermine, today]
  );

  const ueberfaelligeTermine = useMemo(() =>
    enrichedTermine
      .filter(t => t.fields.terminstatus?.key === 'geplant' && t.fields.datum_uhrzeit && t.fields.datum_uhrzeit < today)
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedTermine, today]
  );

  const nahAnstehendeTermine = useMemo(() =>
    anstehendeTermine.filter(t => {
      if (!t.fields.datum_uhrzeit) return false;
      const in7 = format(addDays(clock, 7), 'yyyy-MM-dd');
      return t.fields.datum_uhrzeit <= in7;
    }),
    [anstehendeTermine, clock]
  );

  // Portfolio KPIs
  const aktiveUnternehmen = useMemo(() =>
    unternehmen.filter(u => u.fields.status?.key === 'aktiv'),
    [unternehmen]
  );

  const gesamtPortfolioWert = useMemo(() =>
    unternehmen.reduce((sum, u) => sum + (u.fields.aktueller_wert ?? 0), 0),
    [unternehmen]
  );

  // Calendar events
  const calendarEvents = useMemo<CalendarEvent[]>(() =>
    enrichedTermine
      .filter(t => !!t.fields.datum_uhrzeit)
      .map(t => ({
        id: `termin:${t.record_id}`,
        start: t.fields.datum_uhrzeit!,
        title: t.fields.terminbezeichnung ?? 'Termin',
        subtitle: t.unternehmenName || undefined,
        tone: t.fields.terminstatus?.key === 'abgesagt' ? 'default'
          : t.fields.terminstatus?.key === 'stattgefunden' ? 'success'
          : (t.fields.datum_uhrzeit ?? '') < today ? 'destructive'
          : 'primary',
      })),
    [enrichedTermine, today]
  );

  // Context line for greeting
  const contextLine = useMemo(() => {
    if (ueberfaelligeTermine.length > 0) {
      const names = namen(ueberfaelligeTermine.map(t => t.unternehmenName || t.fields.terminbezeichnung || ''));
      return `${ueberfaelligeTermine.length} überfällige Termine — ${names} warten auf Nachverfolgung.`;
    }
    if (nahAnstehendeTermine.length > 0) {
      const next = nahAnstehendeTermine[0];
      return `Nächster Termin: ${next.fields.terminbezeichnung} bei ${next.unternehmenName || 'Unbekannt'} — ${formatDate(next.fields.datum_uhrzeit)}.`;
    }
    if (aktiveUnternehmen.length > 0) {
      const names = namen(aktiveUnternehmen.slice(0, 3).map(u => u.fields.name || ''));
      return `${aktiveUnternehmen.length} aktive Beteiligungen — ${names}.`;
    }
    return 'Füge dein erstes Portfoliounternehmen hinzu, um loszulegen.';
  }, [ueberfaelligeTermine, nahAnstehendeTermine, aktiveUnternehmen]);

  // Advance termin status
  const confirmTermin = useCallback((t: EnrichedTermine) => {
    const prev = t.fields.terminstatus;
    setTermine(ts => ts.map(x => x.record_id === t.record_id
      ? { ...x, fields: { ...x.fields, terminstatus: { key: 'stattgefunden', label: 'Stattgefunden' } } }
      : x
    ));
    LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: 'stattgefunden' }).catch(() => fetchAll());
    undoToast(`„${t.fields.terminbezeichnung}" als stattgefunden markiert`, () => {
      setTermine(ts => ts.map(x => x.record_id === t.record_id
        ? { ...x, fields: { ...x.fields, terminstatus: prev } }
        : x
      ));
      LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: prev?.key ?? undefined }).catch(() => fetchAll());
    });
  }, [setTermine, fetchAll]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Overlay helpers
  const openTermineForUnternehmen = (u: Unternehmen) => {
    setTermineDefaults({ unternehmen: u.record_id });
    setEditingTermin(undefined);
    setTermineDialog(true);
  };
  const openDokumenteForUnternehmen = (u: Unternehmen) => {
    setDokumenteDefaults({ unternehmen: u.record_id });
    setEditingDokument(undefined);
    setDokumenteDialog(true);
  };
  const openNotizenForUnternehmen = (u: Unternehmen) => {
    setNotizenDefaults({ unternehmen: u.record_id });
    setEditingNotiz(undefined);
    setNotizenDialog(true);
  };

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {gruss(clock)} Dein Portfolio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground truncate">{contextLine}</p>
        </div>
        <button
          onClick={() => { setEditingUnternehmen(undefined); setUnternehmenDefaults(undefined); setUnternehmenDialog(true); }}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <IconPlus size={16} className="shrink-0" />
          <span className="hidden sm:inline">Beteiligung</span>
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={ueberfaelligeTermine.length > 0 ? (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: '✓ Stattgefunden',
              onClick: () => confirmTermin(ueberfaelligeTermine[0]),
            }}
          >
            <b>{namen(ueberfaelligeTermine.map(t => t.fields.terminbezeichnung ?? ''))}</b>{' '}
            — {ueberfaelligeTermine.length === 1 ? 'Dieser Termin ist' : `${ueberfaelligeTermine.length} Termine sind`} überfällig und noch nicht abgehakt.
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatStrip>
            <StatStripItem
              title="Aktive Beteiligungen"
              value={aktiveUnternehmen.length}
              icon={<IconBuilding size={16} className="shrink-0" />}
              tone={aktiveUnternehmen.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Portfolio-Wert"
              value={gesamtPortfolioWert > 0 ? formatCurrency(gesamtPortfolioWert) : '—'}
              icon={<IconCurrencyEuro size={16} className="shrink-0" />}
            />
            <StatStripItem
              title="Im Portfolio"
              value={unternehmen.length}
              icon={<IconChartBar size={16} className="shrink-0" />}
            />
            <StatStripItem
              title="Anstehende Termine"
              value={anstehendeTermine.length}
              icon={<IconCalendar size={16} className="shrink-0" />}
              tone={ueberfaelligeTermine.length > 0 ? 'warning' : 'default'}
            />
          </StatStrip>
        }
        primary={
          unternehmen.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 gap-4">
              <IconBriefcase size={48} className="text-muted-foreground" stroke={1.5} />
              <div className="text-center">
                <p className="text-base font-semibold text-foreground">Noch keine Beteiligungen</p>
                <p className="mt-1 text-sm text-muted-foreground">Füge deine erste Beteiligung hinzu und behalte dein Portfolio im Blick.</p>
              </div>
              <button
                onClick={() => { setEditingUnternehmen(undefined); setUnternehmenDefaults(undefined); setUnternehmenDialog(true); }}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <IconPlus size={16} className="shrink-0" />
                Erste Beteiligung aufnehmen
              </button>
            </div>
          ) : (
            <CalendarWidget
              events={calendarEvents}
              locale={de}
              onEventClick={ev => {
                const id = ev.id.split(':')[1];
                if (id) overlay.replace({ type: 'termin', id });
              }}
              onEmptyClick={date => {
                setTermineDefaults({ datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm") });
                setEditingTermin(undefined);
                setTermineDialog(true);
              }}
              onEventDrop={(eventId, newStart) => {
                const id = eventId.split(':')[1];
                if (!id) return;
                setTermine(ts => ts.map(t => t.record_id === id
                  ? { ...t, fields: { ...t.fields, datum_uhrzeit: newStart } }
                  : t
                ));
                LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: newStart }).catch(() => fetchAll());
                undoToast('Termin verschoben');
              }}
            />
          )
        }
        aside={
          <>
            <WorkList
              title="Bald anstehend"
              items={nahAnstehendeTermine.slice(0, 8).map(t => ({
                id: t.record_id,
                title: t.fields.terminbezeichnung ?? 'Termin',
                secondLine: (
                  <>
                    <span className="font-medium text-foreground truncate">{t.unternehmenName || 'Kein Unternehmen'}</span>
                    <span className="text-muted-foreground shrink-0"> · {formatDate(t.fields.datum_uhrzeit)}</span>
                  </>
                ),
                action: {
                  label: '✓',
                  onClick: () => confirmTermin(t),
                },
              }))}
              onItemClick={id => overlay.replace({ type: 'termin', id })}
              empty={{
                text: anstehendeTermine.length > 0
                  ? `Nächster Termin: ${formatDate(anstehendeTermine[0].fields.datum_uhrzeit)}`
                  : 'Keine Termine in den nächsten 7 Tagen',
                action: { label: 'Termin anlegen', onClick: () => { setTermineDefaults(undefined); setEditingTermin(undefined); setTermineDialog(true); } },
              }}
            />
            <WorkList
              title="Letzte Notizen"
              items={enrichedNotizen
                .sort((a, b) => (b.fields.notiz_datum ?? '').localeCompare(a.fields.notiz_datum ?? ''))
                .slice(0, 6)
                .map(n => ({
                  id: n.record_id,
                  title: n.fields.notiz_titel ?? 'Notiz',
                  secondLine: (
                    <>
                      <span className="font-medium text-foreground truncate">{n.unternehmenName || 'Kein Unternehmen'}</span>
                      {n.fields.prioritaet?.key === 'hoch' && (
                        <span className="ml-1.5 shrink-0 text-xs font-medium text-destructive">Hoch</span>
                      )}
                    </>
                  ),
                }))}
              onItemClick={id => overlay.replace({ type: 'notiz', id })}
              empty={{
                text: 'Noch keine Notizen',
                action: {
                  label: 'Notiz anlegen',
                  onClick: () => { setNotizenDefaults(undefined); setEditingNotiz(undefined); setNotizenDialog(true); },
                },
              }}
            />
          </>
        }
      />

      {/* ─── Overlays ─────────────────────────────────────────────────────── */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'unternehmen') {
            const u = unternehmen.find(x => x.record_id === top.id);
            if (!u) return null;
            return (
              <>
                <RecordHeader
                  title={u.fields.name ?? 'Unternehmen'}
                  subtitle={[u.fields.branche?.label, u.fields.stadt, u.fields.land].filter(Boolean).join(' · ') || undefined}
                  badges={
                    u.fields.status ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.fields.status.key === 'aktiv' ? 'bg-success/10 text-success'
                        : u.fields.status.key === 'exit' ? 'bg-muted text-muted-foreground'
                        : 'bg-warning/10 text-warning'
                      }`}>{u.fields.status.label}</span>
                    ) : undefined
                  }
                />
                <RecordSection title="Details" cols={2}>
                  <RecordField label="Unternehmensname" value={u.fields.name} format="text" />
                  <RecordField label="Rechtsform" value={u.fields.rechtsform} format="pill" />
                  <RecordField label="Branche" value={u.fields.branche} format="pill" />
                  <RecordField label="Status" value={u.fields.status} format="pill" />
                  <RecordField label="Beteiligungsquote" value={u.fields.beteiligungsquote != null ? `${u.fields.beteiligungsquote} %` : undefined} />
                  <RecordField label="Investiertes Kapital" value={u.fields.investiertes_kapital != null ? formatCurrency(u.fields.investiertes_kapital) : undefined} />
                  <RecordField label="Aktueller Wert" value={u.fields.aktueller_wert != null ? formatCurrency(u.fields.aktueller_wert) : undefined} />
                  <RecordField label="Investitionsdatum" value={u.fields.investitionsdatum} format="date" />
                  <RecordField label="Stadt" value={u.fields.stadt} />
                  <RecordField label="Land" value={u.fields.land} />
                  <RecordField label="Website" value={u.fields.website} format="url" />
                  <RecordField label="Ansprechpartner" value={[u.fields.ansprechpartner_vorname, u.fields.ansprechpartner_nachname].filter(Boolean).join(' ') || undefined} />
                  <RecordField label="E-Mail" value={u.fields.ansprechpartner_email} format="email" />
                  <RecordField label="Telefon" value={u.fields.ansprechpartner_telefon} />
                  {u.fields.cockpit_zusammenfassung && (
                    <RecordField label="Zusammenfassung" value={u.fields.cockpit_zusammenfassung} format="longtext" className="md:col-span-2" />
                  )}
                </RecordSection>
                <SatelliteSection
                  title="Termine"
                  items={termine.filter(t => extractRecordId(t.fields.unternehmen) === u.record_id)}
                  map={t => ({ name: t.fields.terminbezeichnung ?? 'Termin', meta: t.fields.datum_uhrzeit ? formatDate(t.fields.datum_uhrzeit) : undefined })}
                  onOpen={t => overlay.push({ type: 'termin', id: t.record_id })}
                  onAdd={() => openTermineForUnternehmen(u)}
                  getKey={t => t.record_id}
                />
                <SatelliteSection
                  title="Dokumente"
                  items={dokumente.filter(d => extractRecordId(d.fields.unternehmen) === u.record_id)}
                  map={d => ({ name: d.fields.dokumentenbezeichnung ?? 'Dokument', meta: d.fields.dokumentendatum ? formatDate(d.fields.dokumentendatum) : undefined })}
                  onOpen={d => overlay.push({ type: 'dokument', id: d.record_id })}
                  onAdd={() => openDokumenteForUnternehmen(u)}
                  getKey={d => d.record_id}
                />
                <SatelliteSection
                  title="Notizen"
                  items={notizen.filter(n => extractRecordId(n.fields.unternehmen) === u.record_id)}
                  map={n => ({ name: n.fields.notiz_titel ?? 'Notiz', meta: n.fields.notiz_datum ? formatDate(n.fields.notiz_datum) : undefined })}
                  onOpen={n => overlay.push({ type: 'notiz', id: n.record_id })}
                  onAdd={() => openNotizenForUnternehmen(u)}
                  getKey={n => n.record_id}
                />
                <RecordAttachments appId={APP_IDS.UNTERNEHMEN} recordId={u.record_id} />
              </>
            );
          }
          if (top.type === 'termin') {
            const t = termine.find(x => x.record_id === top.id);
            if (!t) return null;
            const enriched = enrichedTermine.find(x => x.record_id === top.id);
            return (
              <>
                <RecordHeader
                  title={t.fields.terminbezeichnung ?? 'Termin'}
                  subtitle={[t.fields.terminart?.label, enriched?.unternehmenName].filter(Boolean).join(' · ') || undefined}
                  meta={t.fields.datum_uhrzeit ? formatDate(t.fields.datum_uhrzeit) : undefined}
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
            const enriched = enrichedDokumente.find(x => x.record_id === top.id);
            return (
              <>
                <RecordHeader
                  title={d.fields.dokumentenbezeichnung ?? 'Dokument'}
                  subtitle={[d.fields.dokumententyp?.label, enriched?.unternehmenName].filter(Boolean).join(' · ') || undefined}
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
            const n = notizen.find(x => x.record_id === top.id);
            if (!n) return null;
            const enriched = enrichedNotizen.find(x => x.record_id === top.id);
            return (
              <>
                <RecordHeader
                  title={n.fields.notiz_titel ?? 'Notiz'}
                  subtitle={[n.fields.kategorie?.label, enriched?.unternehmenName].filter(Boolean).join(' · ') || undefined}
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
            const u = unternehmen.find(x => x.record_id === top.id);
            if (u) { setEditingUnternehmen(u); setUnternehmenDefaults(u.fields as UnternehmenDialogDefaults); setUnternehmenDialog(true); }
          } else if (top.type === 'termin') {
            const t = termine.find(x => x.record_id === top.id);
            if (t) { setEditingTermin(t); setTermineDefaults(t.fields as TermineDialogDefaults); setTermineDialog(true); }
          } else if (top.type === 'dokument') {
            const d = dokumente.find(x => x.record_id === top.id);
            if (d) { setEditingDokument(d); setDokumenteDefaults(d.fields as DokumenteDialogDefaults); setDokumenteDialog(true); }
          } else if (top.type === 'notiz') {
            const n = notizen.find(x => x.record_id === top.id);
            if (n) { setEditingNotiz(n); setNotizenDefaults(n.fields as NotizenDialogDefaults); setNotizenDialog(true); }
          }
        }}
        footer={top => {
          if (top.type === 'termin') {
            const t = enrichedTermine.find(x => x.record_id === top.id);
            if (t && t.fields.terminstatus?.key === 'geplant') {
              return { label: '✓ Als stattgefunden markieren', onClick: () => { confirmTermin(t); overlay.close(); } };
            }
          }
          return undefined;
        }}
      />

      {/* ─── Dialoge ─────────────────────────────────────────────────────── */}
      <UnternehmenDialog
        open={unternehmenDialog}
        onClose={() => setUnternehmenDialog(false)}
        defaultValues={unternehmenDefaults}
        recordId={editingUnternehmen?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
        onSubmit={async fields => {
          if (editingUnternehmen) {
            await LivingAppsService.updateUnternehmenEntry(editingUnternehmen.record_id, fields);
            undoToast('Beteiligung aktualisiert');
          } else {
            await LivingAppsService.createUnternehmenEntry(fields);
            undoToast('Beteiligung hinzugefügt');
          }
          fetchAll();
        }}
      />
      <TermineDialog
        open={termineDialog}
        onClose={() => setTermineDialog(false)}
        defaultValues={termineDefaults}
        recordId={editingTermin?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Termine']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Termine']}
        onSubmit={async fields => {
          if (editingTermin) {
            await LivingAppsService.updateTermineEntry(editingTermin.record_id, fields);
            undoToast('Termin aktualisiert');
          } else {
            await LivingAppsService.createTermineEntry(fields);
            undoToast('Termin angelegt');
          }
          fetchAll();
        }}
      />
      <DokumenteDialog
        open={dokumenteDialog}
        onClose={() => setDokumenteDialog(false)}
        defaultValues={dokumenteDefaults}
        recordId={editingDokument?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Dokumente']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Dokumente']}
        onSubmit={async fields => {
          if (editingDokument) {
            await LivingAppsService.updateDokumenteEntry(editingDokument.record_id, fields);
            undoToast('Dokument aktualisiert');
          } else {
            await LivingAppsService.createDokumenteEntry(fields);
            undoToast('Dokument hinzugefügt');
          }
          fetchAll();
        }}
      />
      <NotizenDialog
        open={notizenDialog}
        onClose={() => setNotizenDialog(false)}
        defaultValues={notizenDefaults}
        recordId={editingNotiz?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
        onSubmit={async fields => {
          if (editingNotiz) {
            await LivingAppsService.updateNotizenEntry(editingNotiz.record_id, fields);
            undoToast('Notiz aktualisiert');
          } else {
            await LivingAppsService.createNotizenEntry(fields);
            undoToast('Notiz hinzugefügt');
          }
          fetchAll();
        }}
      />
    </>
  );
}
