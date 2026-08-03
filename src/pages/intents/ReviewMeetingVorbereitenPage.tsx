/**
 * Review-Meeting vorbereiten — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen wählen (nur aktive) → 2) Termin anlegen → 3) Dokument verlinken (optional) → 4) Meeting-Notiz erfassen → 5) Zusammenfassung.
 * Reads: unternehmen. Writes: termine (createTermineEntry), dokumente (createDokumenteEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Unternehmen } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  IconBuilding,
  IconCalendar,
  IconFileText,
  IconNotes,
  IconCheck,
  IconChevronRight,
  IconPlayerSkipForward,
} from '@tabler/icons-react';

const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

export default function ReviewMeetingVorbereitenPage() {
  const [searchParams] = useSearchParams();
  const initialStep = parseInt(searchParams.get('step') ?? '1', 10);
  const initialUnternehmenId = searchParams.get('unternehmenId') ?? null;

  const { unternehmen, loading, error, fetchAll } = useDashboardData();

  // Step state
  const [step, setStep] = useState(initialUnternehmenId ? Math.max(initialStep, 2) : initialStep);
  const [selectedUnternehmenId, setSelectedUnternehmenId] = useState<string | null>(initialUnternehmenId);

  // Step 2 — Termin
  const [terminbezeichnung, setTerminbezeichnung] = useState('Review-Meeting');
  const [terminart, setTerminart] = useState(TERMINART_OPTIONS.find(o => o.key === 'strategiemeeting')?.key ?? TERMINART_OPTIONS[0]?.key ?? '');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [terminstatus, setTerminstatus] = useState(TERMINSTATUS_OPTIONS.find(o => o.key === 'geplant')?.key ?? TERMINSTATUS_OPTIONS[0]?.key ?? '');
  const [notizenTermin, setNotizenTermin] = useState('');
  const [terminSubmitting, setTerminSubmitting] = useState(false);
  const [terminError, setTerminError] = useState<string | null>(null);
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);

  // Step 3 — Dokument (optional)
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententyp, setDokumententyp] = useState(DOKUMENTENTYP_OPTIONS.find(o => o.key === 'praesentation')?.key ?? DOKUMENTENTYP_OPTIONS[0]?.key ?? '');
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [dokumentendatum, setDokumentendatum] = useState('');
  const [bereitgestelltVon, setBereitgestelltVon] = useState('');
  const [dokSubmitting, setDokSubmitting] = useState(false);
  const [dokError, setDokError] = useState<string | null>(null);
  const [createdDokumentId, setCreatedDokumentId] = useState<string | null>(null);

  // Step 4 — Notiz
  const [notizTitel, setNotizTitel] = useState('Review-Meeting Notizen');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kategorie, setKategorie] = useState(KATEGORIE_OPTIONS.find(o => o.key === 'meeting')?.key ?? KATEGORIE_OPTIONS[0]?.key ?? '');
  const [prioritaet, setPrioritaet] = useState(PRIORITAET_OPTIONS.find(o => o.key === 'mittel')?.key ?? PRIORITAET_OPTIONS[0]?.key ?? '');
  const [notizSubmitting, setNotizSubmitting] = useState(false);
  const [notizError, setNotizError] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);

  const activeUnternehmen = (unternehmen as Unternehmen[]).filter(
    u => u.fields.status?.key === 'aktiv'
  );

  const selectedUnternehmen = selectedUnternehmenId
    ? (unternehmen as Unternehmen[]).find(u => u.record_id === selectedUnternehmenId) ?? null
    : null;

  const formatCurrency = (val?: number) =>
    val != null
      ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val)
      : '—';

  const handleTerminSubmit = async () => {
    if (!selectedUnternehmenId || !terminbezeichnung || !datumUhrzeit) return;
    setTerminSubmitting(true);
    setTerminError(null);
    try {
      let tid = createdTerminId;
      if (!tid) {
        const result = await LivingAppsService.createTermineEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          terminbezeichnung,
          terminart,
          datum_uhrzeit: datumUhrzeit,
          ort: ort || undefined,
          terminstatus,
          notizen_termin: notizenTermin || undefined,
        });
        tid = result.record_id;
        setCreatedTerminId(tid);
      }
      await fetchAll();
      setStep(3);
    } catch (e) {
      setTerminError('Fehler beim Anlegen des Termins. Bitte erneut versuchen.');
    } finally {
      setTerminSubmitting(false);
    }
  };

  const handleDokumentSubmit = async () => {
    if (!selectedUnternehmenId || !dokumentenbezeichnung) return;
    setDokSubmitting(true);
    setDokError(null);
    try {
      let did = createdDokumentId;
      if (!did) {
        const result = await LivingAppsService.createDokumenteEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          dokumentenbezeichnung,
          dokumententyp,
          dokumentenlink: dokumentenlink || undefined,
          dokumentendatum: dokumentendatum || undefined,
          bereitgestellt_von: bereitgestelltVon || undefined,
        });
        did = result.record_id;
        setCreatedDokumentId(did);
      }
      await fetchAll();
      setStep(4);
    } catch (e) {
      setDokError('Fehler beim Speichern des Dokuments. Bitte erneut versuchen.');
    } finally {
      setDokSubmitting(false);
    }
  };

  const handleNotizSubmit = async () => {
    if (!selectedUnternehmenId || !notizTitel || !notizInhalt || !notizDatum) return;
    setNotizSubmitting(true);
    setNotizError(null);
    try {
      let nid = createdNotizId;
      if (!nid) {
        const result = await LivingAppsService.createNotizenEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          notiz_titel: notizTitel,
          notiz_inhalt: notizInhalt,
          notiz_datum: notizDatum,
          kategorie,
          prioritaet,
        });
        nid = result.record_id;
        setCreatedNotizId(nid);
      }
      await fetchAll();
      setStep(5);
    } catch (e) {
      setNotizError('Fehler beim Speichern der Notiz. Bitte erneut versuchen.');
    } finally {
      setNotizSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedUnternehmenId(null);
    setTerminbezeichnung('Review-Meeting');
    setTerminart(TERMINART_OPTIONS.find(o => o.key === 'strategiemeeting')?.key ?? TERMINART_OPTIONS[0]?.key ?? '');
    setDatumUhrzeit('');
    setOrt('');
    setTerminstatus(TERMINSTATUS_OPTIONS.find(o => o.key === 'geplant')?.key ?? TERMINSTATUS_OPTIONS[0]?.key ?? '');
    setNotizenTermin('');
    setCreatedTerminId(null);
    setDokumentenbezeichnung('');
    setDokumententyp(DOKUMENTENTYP_OPTIONS.find(o => o.key === 'praesentation')?.key ?? DOKUMENTENTYP_OPTIONS[0]?.key ?? '');
    setDokumentenlink('');
    setDokumentendatum('');
    setBereitgestelltVon('');
    setCreatedDokumentId(null);
    setNotizTitel('Review-Meeting Notizen');
    setNotizInhalt('');
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    setKategorie(KATEGORIE_OPTIONS.find(o => o.key === 'meeting')?.key ?? KATEGORIE_OPTIONS[0]?.key ?? '');
    setPrioritaet(PRIORITAET_OPTIONS.find(o => o.key === 'mittel')?.key ?? PRIORITAET_OPTIONS[0]?.key ?? '');
    setCreatedNotizId(null);
    setTerminError(null);
    setDokError(null);
    setNotizError(null);
  };

  const contextBar = selectedUnternehmen ? (
    <div className="flex flex-wrap gap-4 px-4 py-3 bg-secondary/60 rounded-xl text-sm mb-2">
      <span className="font-semibold text-foreground">{selectedUnternehmen.fields.name}</span>
      {selectedUnternehmen.fields.branche && (
        <span className="text-muted-foreground">{selectedUnternehmen.fields.branche.label}</span>
      )}
      {selectedUnternehmen.fields.beteiligungsquote != null && (
        <span className="text-muted-foreground">Beteiligung: {selectedUnternehmen.fields.beteiligungsquote} %</span>
      )}
      {selectedUnternehmen.fields.investiertes_kapital != null && (
        <span className="text-muted-foreground">Investiert: {formatCurrency(selectedUnternehmen.fields.investiertes_kapital)}</span>
      )}
      {selectedUnternehmen.fields.aktueller_wert != null && (
        <span className="text-muted-foreground">Aktueller Wert: {formatCurrency(selectedUnternehmen.fields.aktueller_wert)}</span>
      )}
    </div>
  ) : null;

  return (
    <IntentWizardShell
      title="Review-Meeting vorbereiten"
      subtitle="Termin, Dokument und Notiz in einem Ablauf anlegen"
      steps={[
        { label: 'Unternehmen' },
        { label: 'Termin' },
        { label: 'Dokument' },
        { label: 'Notiz' },
        { label: 'Fertig' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Schritt 1: Unternehmen wählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={activeUnternehmen.map(u => ({
            id: u.record_id,
            title: u.fields.name ?? '(ohne Name)',
            subtitle: [
              u.fields.branche?.label,
              u.fields.investiertes_kapital != null ? `Investiert: ${formatCurrency(u.fields.investiertes_kapital)}` : null,
            ].filter(Boolean).join(' · '),
            status: u.fields.status
              ? { key: u.fields.status.key, label: u.fields.status.label }
              : undefined,
            icon: <IconBuilding size={20} className="text-primary" />,
          }))}
          onSelect={(id) => {
            setSelectedUnternehmenId(id);
            setStep(2);
          }}
          searchPlaceholder="Unternehmen suchen …"
          emptyText="Keine aktiven Unternehmen gefunden."
          emptyIcon={<IconBuilding size={32} className="text-muted-foreground" />}
        />
      )}

      {/* ── Schritt 2: Termin anlegen ── */}
      {step === 2 && (
        selectedUnternehmenId ? (
          <div className="space-y-4">
            {contextBar}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2 text-base font-semibold">
                <IconCalendar size={20} className="text-primary" />
                Termin anlegen
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Terminbezeichnung *</label>
                <Input
                  value={terminbezeichnung}
                  onChange={e => setTerminbezeichnung(e.target.value)}
                  placeholder="z. B. Review-Meeting"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Terminart *</label>
                <Select value={terminart} onValueChange={setTerminart}>
                  <SelectTrigger>
                    <SelectValue placeholder="Terminart wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {TERMINART_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Datum & Uhrzeit *</label>
                <Input
                  type="datetime-local"
                  value={datumUhrzeit}
                  onChange={e => setDatumUhrzeit(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Ort</label>
                <Input
                  value={ort}
                  onChange={e => setOrt(e.target.value)}
                  placeholder="z. B. Konferenzraum B"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Status</label>
                <div className="flex flex-wrap gap-2">
                  {TERMINSTATUS_OPTIONS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setTerminstatus(o.key)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                        terminstatus === o.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:bg-secondary'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Notizen</label>
                <Textarea
                  value={notizenTermin}
                  onChange={e => setNotizenTermin(e.target.value)}
                  placeholder="Agenda, Vorbereitung, Hinweise …"
                  rows={3}
                />
              </div>

              {terminError && (
                <p className="text-sm text-destructive">{terminError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>Zurück</Button>
                <Button
                  onClick={handleTerminSubmit}
                  disabled={terminSubmitting || !terminbezeichnung || !datumUhrzeit}
                  className="flex-1"
                >
                  {terminSubmitting ? 'Wird gespeichert …' : (
                    <span className="flex items-center gap-1">
                      Termin anlegen <IconChevronRight size={16} />
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Schritt 3: Dokument verlinken (optional) ── */}
      {step === 3 && (
        selectedUnternehmenId ? (
          <div className="space-y-4">
            {contextBar}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <IconFileText size={20} className="text-primary" />
                  Dokument verlinken
                </div>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-lg">Optional</span>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Dokumentenbezeichnung *</label>
                <Input
                  value={dokumentenbezeichnung}
                  onChange={e => setDokumentenbezeichnung(e.target.value)}
                  placeholder="z. B. Quartalspräsentation Q2 2026"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Dokumententyp</label>
                <Select value={dokumententyp} onValueChange={setDokumententyp}>
                  <SelectTrigger>
                    <SelectValue placeholder="Typ wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOKUMENTENTYP_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Link</label>
                <Input
                  type="url"
                  value={dokumentenlink}
                  onChange={e => setDokumentenlink(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Datum</label>
                  <Input
                    type="date"
                    value={dokumentendatum}
                    onChange={e => setDokumentendatum(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Bereitgestellt von</label>
                  <Input
                    value={bereitgestelltVon}
                    onChange={e => setBereitgestelltVon(e.target.value)}
                    placeholder="Name oder Abteilung"
                  />
                </div>
              </div>

              {dokError && (
                <p className="text-sm text-destructive">{dokError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>Zurück</Button>
                <Button
                  variant="outline"
                  onClick={() => setStep(4)}
                  className="flex items-center gap-1"
                >
                  <IconPlayerSkipForward size={16} />
                  Überspringen
                </Button>
                <Button
                  onClick={handleDokumentSubmit}
                  disabled={dokSubmitting || !dokumentenbezeichnung}
                  className="flex-1"
                >
                  {dokSubmitting ? 'Wird gespeichert …' : (
                    <span className="flex items-center gap-1">
                      Dokument speichern <IconChevronRight size={16} />
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Schritt 4: Meeting-Notiz ── */}
      {step === 4 && (
        selectedUnternehmenId ? (
          <div className="space-y-4">
            {contextBar}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2 text-base font-semibold">
                <IconNotes size={20} className="text-primary" />
                Meeting-Notiz erfassen
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Titel *</label>
                <Input
                  value={notizTitel}
                  onChange={e => setNotizTitel(e.target.value)}
                  placeholder="z. B. Review-Meeting Notizen"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Inhalt *</label>
                <Textarea
                  value={notizInhalt}
                  onChange={e => setNotizInhalt(e.target.value)}
                  placeholder="Ergebnisse, Beschlüsse, Maßnahmen …"
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Datum *</label>
                  <Input
                    type="date"
                    value={notizDatum}
                    onChange={e => setNotizDatum(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Kategorie</label>
                  <Select value={kategorie} onValueChange={setKategorie}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategorie wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {KATEGORIE_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Priorität</label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITAET_OPTIONS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setPrioritaet(o.key)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                        prioritaet === o.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:bg-secondary'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {notizError && (
                <p className="text-sm text-destructive">{notizError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(3)}>Zurück</Button>
                <Button
                  onClick={handleNotizSubmit}
                  disabled={notizSubmitting || !notizTitel || !notizInhalt || !notizDatum}
                  className="flex-1"
                >
                  {notizSubmitting ? 'Wird gespeichert …' : (
                    <span className="flex items-center gap-1">
                      Notiz speichern <IconChevronRight size={16} />
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Schritt 5: Zusammenfassung ── */}
      {step === 5 && (
        selectedUnternehmen ? (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <IconCheck size={20} className="text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-base">Review-Meeting vorbereitet</div>
                  <div className="text-sm text-muted-foreground">Alle Schritte abgeschlossen</div>
                </div>
              </div>

              <div className="divide-y">
                <div className="py-3 flex items-start gap-3">
                  <IconBuilding size={18} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Unternehmen</div>
                    <div className="font-medium truncate">{selectedUnternehmen.fields.name}</div>
                    {selectedUnternehmen.fields.branche && (
                      <div className="text-sm text-muted-foreground">{selectedUnternehmen.fields.branche.label}</div>
                    )}
                  </div>
                </div>

                <div className="py-3 flex items-start gap-3">
                  <IconCalendar size={18} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Termin</div>
                    <div className="font-medium truncate">{terminbezeichnung}</div>
                    <div className="text-sm text-muted-foreground">
                      {TERMINART_OPTIONS.find(o => o.key === terminart)?.label ?? terminart}
                      {datumUhrzeit ? ` · ${datumUhrzeit.replace('T', ' ')}` : ''}
                      {ort ? ` · ${ort}` : ''}
                    </div>
                  </div>
                </div>

                <div className="py-3 flex items-start gap-3">
                  <IconFileText size={18} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Dokument</div>
                    {createdDokumentId ? (
                      <div className="font-medium truncate">{dokumentenbezeichnung}</div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">Kein Dokument verlinkt</div>
                    )}
                  </div>
                </div>

                <div className="py-3 flex items-start gap-3">
                  <IconNotes size={18} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Notiz</div>
                    <div className="font-medium truncate">{notizTitel}</div>
                    <div className="text-sm text-muted-foreground">
                      {KATEGORIE_OPTIONS.find(o => o.key === kategorie)?.label ?? kategorie}
                      {' · '}
                      {PRIORITAET_OPTIONS.find(o => o.key === prioritaet)?.label ?? prioritaet}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                Neues Review-Meeting vorbereiten
              </Button>
              <a href="#/" className="flex-1">
                <Button className="w-full">Zurück zum Dashboard</Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
