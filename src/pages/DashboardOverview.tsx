import { useState, useMemo, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTermine, enrichDokumente, enrichNotizen } from '@/lib/enrich';
import type { EnrichedTermine, EnrichedDokumente, EnrichedNotizen } from '@/types/enriched';
import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { CalendarWidget } from '@/components/widgets/CalendarWidget';
import type { CalendarEvent } from '@/components/widgets/CalendarWidget';
import {
  RecordOverlayHost,
  RecordHeader,
  RecordAttachments,
  RecordSection,
  RecordField,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { TermineDetails } from '@/components/details/TermineDetails';
import { DokumenteDetails } from '@/components/details/DokumenteDetails';
import { NotizenDetails } from '@/components/details/NotizenDetails';
import { SatelliteSection } from '@/components/SatelliteSection';
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
  IconBuildingSkyscraper,
  IconCalendar,
  IconFileText,
  IconNotes,
  IconPlus,
  IconAlertTriangle,
  IconTrendingUp,
} from '@tabler/icons-react';

// ─── Overlay stack item types ─────────────────────────────────────────────────
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

  // ─── Enrichment (BEFORE early returns) ─────────────────────────────────────
  const enrichedTermine = useMemo(
    () => enrichTermine(termine, { unternehmenMap }),
    [termine, unternehmenMap]
  );
  const enrichedDokumente = useMemo(
    () => enrichDokumente(dokumente, { unternehmenMap }),
    [dokumente, unternehmenMap]
  );
  const enrichedNotizen = useMemo(
    () => enrichNotizen(notizen, { unternehmenMap }),
    [notizen, unternehmenMap]
  );

  // ─── Dialog state (BEFORE early returns) ───────────────────────────────────
  const [unternehmenDialogOpen, setUnternehmenDialogOpen] = useState(false);
  const [unternehmenDefaults, setUnternehmenDefaults] = useState<UnternehmenDialogDefaults | undefined>();
  const [editUnternehmen, setEditUnternehmen] = useState<Unternehmen | null>(null);

  const [termineDialogOpen, setTermineDialogOpen] = useState(false);
  const [termineDefaults, setTermineDefaults] = useState<TermineDialogDefaults | undefined>();
  const [editTermine, setEditTermine] = useState<Termine | null>(null);

  const [dokumenteDialogOpen, setDokumenteDialogOpen] = useState(false);
  const [dokumenteDefaults, setDokumenteDefaults] = useState<DokumenteDialogDefaults | undefined>();
  const [editDokumente, setEditDokumente] = useState<Dokumente | null>(null);

  const [notizenDialogOpen, setNotizenDialogOpen] = useState(false);
  const [notizenDefaults, setNotizenDefaults] = useState<NotizenDialogDefaults | undefined>();
  const [editNotizen, setEditNotizen] = useState<Notizen | null>(null);

  // ─── Overlay stack (BEFORE early returns) ──────────────────────────────────
  const overlay = useRecordOverlayStack<OverlayItem>();

  // ─── Derived data (BEFORE early returns) ───────────────────────────────────
  const today = format(clock, 'yyyy-MM-dd');
  const in7Days = format(addDays(clock, 7), 'yyyy-MM-dd');

  const aktiveUnternehmen = useMemo(
    () => unternehmen.filter(u => u.fields.status?.key === 'aktiv'),
    [unternehmen]
  );

  const upcomingTermine = useMemo(
    () => enrichedTermine.filter(t => {
      if (!t.fields.datum_uhrzeit) return false;
      const d = t.fields.datum_uhrzeit.slice(0, 10);
      return d >= today && t.fields.terminstatus?.key !== 'abgesagt';
    }).sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedTermine, today]
  );

  const bevorstehendNaechste7Tage = useMemo(
    () => upcomingTermine.filter(t => (t.fields.datum_uhrzeit?.slice(0, 10) ?? '') <= in7Days),
    [upcomingTermine, in7Days]
  );

  const hochprioNotizen = useMemo(
    () => enrichedNotizen
      .filter(n => n.fields.prioritaet?.key === 'hoch')
      .sort((a, b) => (b.fields.notiz_datum ?? '').localeCompare(a.fields.notiz_datum ?? '')),
    [enrichedNotizen]
  );

  const gesamtKapital = useMemo(
    () => aktiveUnternehmen.reduce((sum, u) => sum + (u.fields.investiertes_kapital ?? 0), 0),
    [aktiveUnternehmen]
  );

  const gesamtWert = useMemo(
    () => aktiveUnternehmen.reduce((sum, u) => sum + (u.fields.aktueller_wert ?? 0), 0),
    [aktiveUnternehmen]
  );

  // Termine ohne Unternehmen (verwaist) — kein Urgent-Signal aber hilfreich
  const termineOhneUnternehmen = useMemo(
    () => upcomingTermine.filter(t => !t.fields.unternehmen),
    [upcomingTermine]
  );

  // ─── Calendar events ───────────────────────────────────────────────────────
  const calendarEvents = useMemo((): CalendarEvent[] =>
    termine
      .filter(t => t.fields.datum_uhrzeit && t.fields.terminstatus?.key !== 'abgesagt')
      .map(t => ({
        id: `termin:${t.record_id}`,
        start: t.fields.datum_uhrzeit!,
        title: t.fields.terminbezeichnung ?? 'Termin',
        subtitle: unternehmenMap.get(extractRecordId(t.fields.unternehmen) ?? '')?.fields.name,
        tone: t.fields.terminstatus?.key === 'stattgefunden'
          ? 'success' as const
          : (t.fields.datum_uhrzeit?.slice(0, 10) ?? '') < today
            ? 'destructive' as const
            : 'default' as const,
      })),
    [termine, unternehmenMap, today]
  );

  // ─── Write helpers ─────────────────────────────────────────────────────────
  const markTerminDone = useCallback(async (t: Termine) => {
    const prev = termine.map(x => x);
    setTermine(termine.map(x => x.record_id === t.record_id
      ? { ...x, fields: { ...x.fields, terminstatus: { key: 'stattgefunden', label: 'Stattgefunden' } } }
      : x
    ));
    undoToast(`Termin "${t.fields.terminbezeichnung}" als stattgefunden markiert`, async () => {
      setTermine(prev);
      await LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: t.fields.terminstatus?.key ?? null as any });
    });
    LivingAppsService.updateTermineEntry(t.record_id, { terminstatus: 'stattgefunden' }).catch(() => {
      setTermine(prev);
      fetchAll();
    });
  }, [termine, setTermine, fetchAll]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Context line ───────────────────────────────────────────────────────────
  const naechsterTermin = upcomingTermine[0];
  const naechsterUnternehmenName = naechsterTermin
    ? (unternehmenMap.get(extractRecordId(naechsterTermin.fields.unternehmen) ?? '')?.fields.name ?? '')
    : '';

  const contextLine = unternehmen.length === 0
    ? 'Füge deine erste Beteiligung hinzu, um loszulegen.'
    : naechsterTermin
      ? `Nächster Termin: ${naechsterTermin.fields.terminbezeichnung}${naechsterUnternehmenName ? ` – ${naechsterUnternehmenName}` : ''} am ${formatDate(naechsterTermin.fields.datum_uhrzeit)}.`
      : `${aktiveUnternehmen.length} aktive Beteiligungen – keine bevorstehenden Termine.`;

  // ─── Hero: Termine ohne Unternehmen ────────────────────────────────────────
  const heroContent = termineOhneUnternehmen.length > 0
    ? (
      <HeroBanner
        icon={<IconAlertTriangle size={18} />}
        action={{
          label: 'Termin bearbeiten',
          onClick: () => {
            setEditTermine(termineOhneUnternehmen[0]);
            setTermineDefaults(termineOhneUnternehmen[0].fields as TermineDialogDefaults);
            setTermineDialogOpen(true);
          },
        }}
      >
        <b>{namen(termineOhneUnternehmen.map(t => t.fields.terminbezeichnung ?? ''))}</b>
        {' '}ohne verknüpftes Unternehmen – bitte zuordnen.
      </HeroBanner>
    )
    : undefined;

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const kpisContent = (
    <StatStrip>
      <StatStripItem
        title="Aktive Beteiligungen"
        value={aktiveUnternehmen.length}
        icon={<IconBuildingSkyscraper size={16} />}
        tone="default"
      />
      <StatStripItem
        title="Termine (7 Tage)"
        value={bevorstehendNaechste7Tage.length}
        icon={<IconCalendar size={16} />}
        tone={bevorstehendNaechste7Tage.length > 0 ? 'primary' : 'default'}
      />
      <StatStripItem
        title="Dokumente"
        value={dokumente.length}
        icon={<IconFileText size={16} />}
      />
      <StatStripItem
        title="Notizen (Hoch)"
        value={hochprioNotizen.length}
        icon={<IconNotes size={16} />}
        tone={hochprioNotizen.length > 0 ? 'warning' : 'default'}
      />
    </StatStrip>
  );

  // ─── Primary: Calendar of Termine ─────────────────────────────────────────
  const primaryContent = (
    <CalendarWidget
      events={calendarEvents}
      locale={de}
      defaultView="week"
      weekDays={5}
      onEventClick={ev => {
        const id = ev.id.split(':')[1];
        const termin = termine.find(t => t.record_id === id);
        if (termin) overlay.replace({ type: 'termin', record: termin });
      }}
      onEmptyClick={date => {
        setTermineDefaults({ datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm") });
        setEditTermine(null);
        setTermineDialogOpen(true);
      }}
      onEventDrop={async (eventId, newStart) => {
        const id = eventId.split(':')[1];
        const prev = termine.map(x => x);
        setTermine(termine.map(t => t.record_id === id
          ? { ...t, fields: { ...t.fields, datum_uhrzeit: newStart } }
          : t
        ));
        undoToast('Termin verschoben', async () => {
          setTermine(prev);
          const orig = prev.find(t => t.record_id === id);
          if (orig) await LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: orig.fields.datum_uhrzeit });
        });
        LivingAppsService.updateTermineEntry(id, { datum_uhrzeit: newStart }).catch(() => {
          setTermine(prev);
          fetchAll();
        });
      }}
    />
  );

  // ─── Aside ─────────────────────────────────────────────────────────────────
  const asideContent = (
    <>
      {/* Upcoming termine as action list */}
      <WorkList
        title="Bevorstehende Termine"
        items={upcomingTermine.slice(0, 8).map(t => ({
          id: t.record_id,
          title: t.fields.terminbezeichnung ?? 'Termin',
          secondLine: (
            <>
              <span className="text-muted-foreground">
                {t.unternehmenName || 'Kein Unternehmen'}
              </span>
              <span className="text-muted-foreground"> · {formatDate(t.fields.datum_uhrzeit)}</span>
            </>
          ),
          action: t.fields.terminstatus?.key !== 'stattgefunden'
            ? { label: '✓ Erledigt', onClick: () => markTerminDone(t) }
            : undefined,
        }))}
        onItemClick={id => {
          const t = termine.find(x => x.record_id === id);
          if (t) overlay.replace({ type: 'termin', record: t });
        }}
        empty={{
          text: 'Keine bevorstehenden Termine',
          action: { label: 'Termin erstellen', onClick: () => setTermineDialogOpen(true) },
        }}
      />

      {/* High-priority Notizen */}
      <WorkList
        title="Wichtige Notizen"
        items={hochprioNotizen.slice(0, 6).map(n => ({
          id: n.record_id,
          title: n.fields.notiz_titel ?? 'Notiz',
          secondLine: (
            <>
              <span className="font-medium text-warning-foreground" style={{ color: 'var(--color-warning)' }}>Hoch</span>
              <span className="text-muted-foreground"> · {n.unternehmenName || 'Kein Unternehmen'}</span>
            </>
          ),
        }))}
        onItemClick={id => {
          const n = notizen.find(x => x.record_id === id);
          if (n) overlay.replace({ type: 'notiz', record: n });
        }}
        empty={{
          text: 'Keine hochpriorisierten Notizen',
          action: { label: 'Notiz erstellen', onClick: () => setNotizenDialogOpen(true) },
        }}
      />
    </>
  );

  // ─── Portfolio cockpit cards (Unternehmen) shown above if no records yet ───
  const emptyState = unternehmen.length === 0 && (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <IconBuildingSkyscraper size={48} className="text-muted-foreground" />
      <div>
        <h2 className="font-semibold text-lg">Richte dein Portfolio ein</h2>
        <p className="text-muted-foreground text-sm mt-1">Füge deine erste Beteiligung hinzu, um loszulegen.</p>
      </div>
      <button
        onClick={() => { setEditUnternehmen(null); setUnternehmenDefaults(undefined); setUnternehmenDialogOpen(true); }}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <IconPlus size={16} />
        Erste Beteiligung hinzufügen
      </button>
    </div>
  );

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {gruss(clock)} Dein Portfolio-Cockpit
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{contextLine}</p>
        </div>
        <button
          onClick={() => { setEditUnternehmen(null); setUnternehmenDefaults(undefined); setUnternehmenDialogOpen(true); }}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors mt-2 sm:mt-0"
        >
          <IconPlus size={16} />
          Neue Beteiligung
        </button>
      </div>

      {emptyState || (
        <>
          {/* Portfolio company cards */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unternehmen.map(u => {
              const termineCount = termine.filter(t => extractRecordId(t.fields.unternehmen) === u.record_id).length;
              const dokCount = dokumente.filter(d => extractRecordId(d.fields.unternehmen) === u.record_id).length;
              const notizCount = notizen.filter(n => extractRecordId(n.fields.unternehmen) === u.record_id).length;
              const wert = u.fields.aktueller_wert;
              const kapital = u.fields.investiertes_kapital;
              const rendite = wert && kapital && kapital > 0 ? ((wert - kapital) / kapital * 100) : null;
              const statusKey = u.fields.status?.key;

              return (
                <button
                  key={u.record_id}
                  onClick={() => overlay.replace({ type: 'unternehmen', record: u })}
                  className="text-left rounded-xl border border-border bg-card p-4 hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-semibold text-foreground truncate min-w-0">{u.fields.name ?? '—'}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      statusKey === 'aktiv' ? 'bg-success/10 text-success-foreground' :
                      statusKey === 'exit' ? 'bg-muted text-muted-foreground' :
                      'bg-warning/10 text-warning-foreground'
                    }`}
                    style={{
                      color: statusKey === 'aktiv' ? 'var(--color-success)' :
                             statusKey === 'exit' ? undefined :
                             'var(--color-warning)',
                    }}
                    >
                      {u.fields.status?.label ?? '—'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-3 flex gap-2 flex-wrap">
                    {u.fields.branche && <span>{u.fields.branche.label}</span>}
                    {u.fields.stadt && <span>· {u.fields.stadt}</span>}
                  </div>
                  {wert != null && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">{formatCurrency(wert)}</span>
                      {rendite != null && (
                        <span className={`text-xs flex items-center gap-0.5 ${rendite >= 0 ? 'text-success-foreground' : 'text-destructive'}`}
                          style={{ color: rendite >= 0 ? 'var(--color-success)' : undefined }}
                        >
                          <IconTrendingUp size={12} />
                          {rendite >= 0 ? '+' : ''}{rendite.toFixed(1)} %
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><IconCalendar size={12} />{termineCount}</span>
                    <span className="flex items-center gap-1"><IconFileText size={12} />{dokCount}</span>
                    <span className="flex items-center gap-1"><IconNotes size={12} />{notizCount}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <DashboardGrid
            variant="wide"
            hero={heroContent}
            kpis={kpisContent}
            primary={primaryContent}
            aside={asideContent}
          />
        </>
      )}

      {/* ─── RecordOverlayHost — one shell, whole stack ─── */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'unternehmen') {
            const u = top.record;
            return (
              <>
                <RecordHeader
                  title={u.fields.name ?? '—'}
                  subtitle={[u.fields.branche?.label, u.fields.stadt, u.fields.land].filter(Boolean).join(' · ')}
                  badges={
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-muted">
                      {u.fields.status?.label ?? '—'}
                    </span>
                  }
                  actions={
                    <button
                      onClick={() => { setEditUnternehmen(u); setUnternehmenDefaults(u.fields as UnternehmenDialogDefaults); setUnternehmenDialogOpen(true); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
                />
                <RecordSection title="Details" cols={2}>
                  <RecordField label="Rechtsform" value={u.fields.rechtsform} format="pill" />
                  <RecordField label="Branche" value={u.fields.branche} format="pill" />
                  <RecordField label="Status" value={u.fields.status} format="pill" />
                  <RecordField label="Beteiligungsquote" value={u.fields.beteiligungsquote != null ? `${u.fields.beteiligungsquote} %` : undefined} />
                  <RecordField label="Investiertes Kapital" value={formatCurrency(u.fields.investiertes_kapital)} />
                  <RecordField label="Aktueller Wert" value={formatCurrency(u.fields.aktueller_wert)} />
                  <RecordField label="Investitionsdatum" value={u.fields.investitionsdatum} format="date" />
                  <RecordField label="Stadt" value={u.fields.stadt} />
                  <RecordField label="Land" value={u.fields.land} />
                  <RecordField label="Website" value={u.fields.website} format="url" />
                  <RecordField label="Ansprechpartner" value={[u.fields.ansprechpartner_vorname, u.fields.ansprechpartner_nachname].filter(Boolean).join(' ')} />
                  <RecordField label="E-Mail" value={u.fields.ansprechpartner_email} format="email" />
                  <RecordField label="Telefon" value={u.fields.ansprechpartner_telefon} />
                  <RecordField label="Zusammenfassung" value={u.fields.cockpit_zusammenfassung} format="longtext" className="md:col-span-2" />
                </RecordSection>

                <SatelliteSection
                  title="Termine"
                  items={termine.filter(t => extractRecordId(t.fields.unternehmen) === u.record_id)}
                  map={t => ({ name: t.fields.terminbezeichnung ?? 'Termin', meta: formatDate(t.fields.datum_uhrzeit), icon: IconCalendar })}
                  onOpen={t => overlay.push({ type: 'termin', record: t })}
                  onAdd={() => { setEditTermine(null); setTermineDefaults({ unternehmen: u.record_id }); setTermineDialogOpen(true); }}
                  getKey={t => t.record_id}
                />

                <SatelliteSection
                  title="Dokumente"
                  items={dokumente.filter(d => extractRecordId(d.fields.unternehmen) === u.record_id)}
                  map={d => ({ name: d.fields.dokumentenbezeichnung ?? 'Dokument', meta: d.fields.dokumententyp?.label, icon: IconFileText })}
                  onOpen={d => overlay.push({ type: 'dokument', record: d })}
                  onAdd={() => { setEditDokumente(null); setDokumenteDefaults({ unternehmen: u.record_id }); setDokumenteDialogOpen(true); }}
                  getKey={d => d.record_id}
                />

                <SatelliteSection
                  title="Notizen"
                  items={notizen.filter(n => extractRecordId(n.fields.unternehmen) === u.record_id)}
                  map={n => ({ name: n.fields.notiz_titel ?? 'Notiz', meta: n.fields.prioritaet?.label, icon: IconNotes })}
                  onOpen={n => overlay.push({ type: 'notiz', record: n })}
                  onAdd={() => { setEditNotizen(null); setNotizenDefaults({ unternehmen: u.record_id }); setNotizenDialogOpen(true); }}
                  getKey={n => n.record_id}
                />

                <RecordAttachments appId={APP_IDS.UNTERNEHMEN} recordId={u.record_id} />
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
                  actions={
                    <button
                      onClick={() => { setEditTermine(t); setTermineDefaults(t.fields as TermineDialogDefaults); setTermineDialogOpen(true); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
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
                  actions={
                    <button
                      onClick={() => { setEditDokumente(d); setDokumenteDefaults(d.fields as DokumenteDialogDefaults); setDokumenteDialogOpen(true); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
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
                  actions={
                    <button
                      onClick={() => { setEditNotizen(n); setNotizenDefaults(n.fields as NotizenDialogDefaults); setNotizenDialogOpen(true); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Bearbeiten
                    </button>
                  }
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
          if (top.type === 'termin' && top.record.fields.terminstatus?.key !== 'stattgefunden') {
            return {
              label: '✓ Als stattgefunden markieren',
              onClick: () => { markTerminDone(top.record); overlay.close(); },
            };
          }
          return undefined;
        }}
      />

      {/* ─── Dialogs ─── */}
      <UnternehmenDialog
        open={unternehmenDialogOpen}
        onClose={() => { setUnternehmenDialogOpen(false); setEditUnternehmen(null); setUnternehmenDefaults(undefined); }}
        onSubmit={async fields => {
          if (editUnternehmen) {
            await LivingAppsService.updateUnternehmenEntry(editUnternehmen.record_id, fields);
          } else {
            await LivingAppsService.createUnternehmenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={unternehmenDefaults}
        recordId={editUnternehmen?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
      />

      <TermineDialog
        open={termineDialogOpen}
        onClose={() => { setTermineDialogOpen(false); setEditTermine(null); setTermineDefaults(undefined); }}
        onSubmit={async fields => {
          if (editTermine) {
            await LivingAppsService.updateTermineEntry(editTermine.record_id, fields);
          } else {
            await LivingAppsService.createTermineEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={termineDefaults}
        recordId={editTermine?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Termine']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Termine']}
      />

      <DokumenteDialog
        open={dokumenteDialogOpen}
        onClose={() => { setDokumenteDialogOpen(false); setEditDokumente(null); setDokumenteDefaults(undefined); }}
        onSubmit={async fields => {
          if (editDokumente) {
            await LivingAppsService.updateDokumenteEntry(editDokumente.record_id, fields);
          } else {
            await LivingAppsService.createDokumenteEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={dokumenteDefaults}
        recordId={editDokumente?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Dokumente']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Dokumente']}
      />

      <NotizenDialog
        open={notizenDialogOpen}
        onClose={() => { setNotizenDialogOpen(false); setEditNotizen(null); setNotizenDefaults(undefined); }}
        onSubmit={async fields => {
          if (editNotizen) {
            await LivingAppsService.updateNotizenEntry(editNotizen.record_id, fields);
          } else {
            await LivingAppsService.createNotizenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={notizenDefaults}
        recordId={editNotizen?.record_id}
        unternehmenList={unternehmen}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />
    </>
  );
}
