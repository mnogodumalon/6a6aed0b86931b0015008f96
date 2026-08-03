/**
 * Portfolio-Review — 5-Schritt-Wizard.
 * Steps: 1) Unternehmen auswählen (nur aktive) → 2) Review-Termin anlegen →
 *        3) Meeting-Notiz erfassen → 4) Dokument verknüpfen (optional) → 5) Abschluss & Zusammenfassung.
 * Reads: unternehmen (gefiltert: status === 'aktiv').
 * Writes: termine (createTermineEntry), notizen (createNotizenEntry), dokumente (createDokumenteEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  IconBuilding,
  IconCalendarEvent,
  IconNotes,
  IconFileText,
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
  IconRefresh,
} from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Unternehmen } from '@/types/app';

const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];

const TODAY = format(new Date(), 'yyyy-MM-dd');

export default function PortfolioReviewPage() {
  const { unternehmen: unternehmenMap, loading, error, fetchAll } = useDashboardData();

  // Wizard step state
  const [step, setStep] = useState(1);

  // Step 1 — selected company
  const [selectedUnternehmen, setSelectedUnternehmen] = useState<Unternehmen | null>(null);

  // Step 2 — Termin fields
  const [terminbezeichnung, setTerminbezeichnung] = useState('');
  const [terminart, setTerminart] = useState('strategiemeeting');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [terminstatus, setTerminstatus] = useState('geplant');
  const [erinnerungTage, setErinnerungTage] = useState('');
  const [notizenTermin, setNotizenTermin] = useState('');
  const [terminSaving, setTerminSaving] = useState(false);
  const [terminError, setTerminError] = useState<string | null>(null);
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);

  // Step 3 — Notiz fields
  const [notizTitel, setNotizTitel] = useState('');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(TODAY);
  const [kategorie, setKategorie] = useState('meeting');
  const [prioritaet, setPrioritaet] = useState('mittel');
  const [schlagwoerter, setSchlagwoerter] = useState('');
  const [notizSaving, setNotizSaving] = useState(false);
  const [notizError, setNotizError] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);

  // Step 4 — Dokument fields
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententyp, setDokumententyp] = useState('protokoll');
  const [dokumentendatum, setDokumentendatum] = useState(TODAY);
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [bereitgestelltVon, setBereitgestelltVon] = useState('');
  const [dokumentenbeschreibung, setDokumentenbeschreibung] = useState('');
  const [dokSaving, setDokSaving] = useState(false);
  const [dokError, setDokError] = useState<string | null>(null);
  const [createdDokId, setCreatedDokId] = useState<string | null>(null);
  const [dokSkipped, setDokSkipped] = useState(false);

  // Prefill helpers — called when company is selected
  const prefillForUnternehmen = useCallback((u: Unternehmen) => {
    const name = u.fields.name ?? '';
    setTerminbezeichnung(`Portfolio-Review ${name}`);
    setNotizTitel(`Review-Notiz ${name}`);
    setDokumentenbezeichnung(`Review-Protokoll ${name}`);
  }, []);

  // Filter active companies
  const aktiveUnternehmen = Object.values(unternehmenMap ?? {}).filter(
    (u) => u.fields.status?.key === 'aktiv'
  );

  // Format currency helper
  const formatEur = (val?: number) =>
    val !== undefined && val !== null
      ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val)
      : '—';

  // Step 1: select company
  const handleSelectUnternehmen = (id: string) => {
    const u = Object.values(unternehmenMap ?? {}).find((r) => r.record_id === id);
    if (!u) return;
    setSelectedUnternehmen(u);
    prefillForUnternehmen(u);
    setStep(2);
  };

  // Step 2: save Termin
  const handleSaveTermin = async () => {
    if (!selectedUnternehmen || !datumUhrzeit || !terminbezeichnung) return;
    setTerminSaving(true);
    setTerminError(null);
    try {
      let tid = createdTerminId;
      if (!tid) {
        const result = await LivingAppsService.createTermineEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmen.record_id),
          terminbezeichnung,
          terminart,
          datum_uhrzeit: datumUhrzeit,
          ort: ort || undefined,
          terminstatus,
          erinnerung_tage: erinnerungTage ? Number(erinnerungTage) : undefined,
          notizen_termin: notizenTermin || undefined,
        });
        tid = result.record_id;
        setCreatedTerminId(tid);
      }
      await fetchAll();
      setStep(3);
    } catch (e) {
      setTerminError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Termins.');
    } finally {
      setTerminSaving(false);
    }
  };

  // Step 3: save Notiz
  const handleSaveNotiz = async () => {
    if (!selectedUnternehmen || !notizTitel || !notizInhalt || !notizDatum) return;
    setNotizSaving(true);
    setNotizError(null);
    try {
      let nid = createdNotizId;
      if (!nid) {
        const result = await LivingAppsService.createNotizenEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmen.record_id),
          notiz_titel: notizTitel,
          notiz_inhalt: notizInhalt,
          notiz_datum: notizDatum,
          kategorie,
          prioritaet,
          schlagwoerter: schlagwoerter || undefined,
        });
        nid = result.record_id;
        setCreatedNotizId(nid);
      }
      await fetchAll();
      setStep(4);
    } catch (e) {
      setNotizError(e instanceof Error ? e.message : 'Fehler beim Anlegen der Notiz.');
    } finally {
      setNotizSaving(false);
    }
  };

  // Step 4: save Dokument
  const handleSaveDokument = async () => {
    if (!selectedUnternehmen || !dokumentenbezeichnung) return;
    setDokSaving(true);
    setDokError(null);
    try {
      let did = createdDokId;
      if (!did) {
        const result = await LivingAppsService.createDokumenteEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmen.record_id),
          dokumentenbezeichnung,
          dokumententyp,
          dokumentendatum,
          dokumentenlink: dokumentenlink || undefined,
          bereitgestellt_von: bereitgestelltVon || undefined,
          dokumentenbeschreibung: dokumentenbeschreibung || undefined,
        });
        did = result.record_id;
        setCreatedDokId(did);
      }
      await fetchAll();
      setStep(5);
    } catch (e) {
      setDokError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Dokuments.');
    } finally {
      setDokSaving(false);
    }
  };

  // Skip Dokument step
  const handleSkipDokument = () => {
    setDokSkipped(true);
    setStep(5);
  };

  // Reset wizard
  const handleReset = () => {
    setStep(1);
    setSelectedUnternehmen(null);
    setTerminbezeichnung('');
    setTerminart('strategiemeeting');
    setDatumUhrzeit('');
    setOrt('');
    setTerminstatus('geplant');
    setErinnerungTage('');
    setNotizenTermin('');
    setTerminSaving(false);
    setTerminError(null);
    setCreatedTerminId(null);
    setNotizTitel('');
    setNotizInhalt('');
    setNotizDatum(TODAY);
    setKategorie('meeting');
    setPrioritaet('mittel');
    setSchlagwoerter('');
    setNotizSaving(false);
    setNotizError(null);
    setCreatedNotizId(null);
    setDokumentenbezeichnung('');
    setDokumententyp('protokoll');
    setDokumentendatum(TODAY);
    setDokumentenlink('');
    setBereitgestelltVon('');
    setDokumentenbeschreibung('');
    setDokSaving(false);
    setDokError(null);
    setCreatedDokId(null);
    setDokSkipped(false);
  };

  const STEPS = [
    { label: 'Unternehmen' },
    { label: 'Termin' },
    { label: 'Notiz' },
    { label: 'Dokument' },
    { label: 'Abschluss' },
  ];

  return (
    <IntentWizardShell
      title="Portfolio-Review"
      subtitle="Schritt-für-Schritt durch die Review-Dokumentation"
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ───────────────────────── STEP 1: Unternehmen ───────────────────────── */}
      {step === 1 && (
        <EntitySelectStep
          items={aktiveUnternehmen.map((u) => ({
            id: u.record_id,
            title: u.fields.name ?? '(Kein Name)',
            subtitle: [
              u.fields.branche?.label,
              u.fields.stadt,
            ]
              .filter(Boolean)
              .join(' · '),
            status: u.fields.status
              ? { key: u.fields.status.key, label: u.fields.status.label }
              : undefined,
            stats: [
              {
                label: 'Aktueller Wert',
                value: formatEur(u.fields.aktueller_wert),
              },
              {
                label: 'Investiert',
                value: formatEur(u.fields.investiertes_kapital),
              },
            ],
            icon: <IconBuilding size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectUnternehmen}
          searchPlaceholder="Unternehmen suchen …"
          emptyText="Keine aktiven Unternehmen gefunden."
          emptyIcon={<IconBuilding size={32} className="text-muted-foreground" />}
        />
      )}

      {/* ───────────────────────── STEP 2: Termin ───────────────────────────── */}
      {step === 2 && (
        selectedUnternehmen ? (
          <div className="space-y-5">
            {/* Context card */}
            <div className="rounded-2xl border bg-secondary/40 px-4 py-3 flex items-center gap-3">
              <IconBuilding size={18} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium truncate">{selectedUnternehmen.fields.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedUnternehmen.fields.branche?.label ?? ''}
                </p>
              </div>
              <StatusBadge
                statusKey={selectedUnternehmen.fields.status?.key}
                label={selectedUnternehmen.fields.status?.label}
                className="ml-auto shrink-0"
              />
            </div>

            <div className="rounded-2xl border p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <IconCalendarEvent size={18} className="text-primary" />
                <h3 className="font-semibold">Review-Termin anlegen</h3>
              </div>

              <div className="space-y-1">
                <Label htmlFor="terminbezeichnung">Terminbezeichnung *</Label>
                <Input
                  id="terminbezeichnung"
                  value={terminbezeichnung}
                  onChange={(e) => setTerminbezeichnung(e.target.value)}
                  placeholder="z. B. Portfolio-Review Muster GmbH"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="terminart">Terminart *</Label>
                  <Select value={terminart} onValueChange={setTerminart}>
                    <SelectTrigger id="terminart">
                      <SelectValue placeholder="Terminart wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMINART_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="terminstatus">Status</Label>
                  <Select value={terminstatus} onValueChange={setTerminstatus}>
                    <SelectTrigger id="terminstatus">
                      <SelectValue placeholder="Status wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMINSTATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="datum_uhrzeit">Datum & Uhrzeit *</Label>
                <Input
                  id="datum_uhrzeit"
                  type="datetime-local"
                  value={datumUhrzeit}
                  onChange={(e) => setDatumUhrzeit(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="ort">Ort</Label>
                  <Input
                    id="ort"
                    value={ort}
                    onChange={(e) => setOrt(e.target.value)}
                    placeholder="z. B. Konferenzraum Berlin"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="erinnerung_tage">Erinnerung (Tage vorher)</Label>
                  <Input
                    id="erinnerung_tage"
                    type="number"
                    min={0}
                    value={erinnerungTage}
                    onChange={(e) => setErinnerungTage(e.target.value)}
                    placeholder="z. B. 3"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="notizen_termin">Notizen zum Termin</Label>
                <Textarea
                  id="notizen_termin"
                  value={notizenTermin}
                  onChange={(e) => setNotizenTermin(e.target.value)}
                  placeholder="Agenda, Vorbereitung, Teilnehmer …"
                  rows={3}
                />
              </div>

              {terminError && (
                <p className="text-sm text-destructive">{terminError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1"
                >
                  <IconArrowLeft size={16} />
                  Zurück
                </Button>
                <Button
                  onClick={handleSaveTermin}
                  disabled={terminSaving || !terminbezeichnung || !datumUhrzeit}
                  className="flex items-center gap-1"
                >
                  {terminSaving ? 'Speichern …' : 'Termin anlegen'}
                  {!terminSaving && <IconArrowRight size={16} />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt braucht die Unternehmensauswahl aus Schritt 1.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Neu starten
            </Button>
          </div>
        )
      )}

      {/* ───────────────────────── STEP 3: Notiz ────────────────────────────── */}
      {step === 3 && (
        selectedUnternehmen ? (
          <div className="space-y-5">
            {/* Context card */}
            <div className="rounded-2xl border bg-secondary/40 px-4 py-3 flex items-center gap-3">
              <IconBuilding size={18} className="text-primary shrink-0" />
              <p className="font-medium truncate min-w-0">{selectedUnternehmen.fields.name}</p>
              {createdTerminId && (
                <span className="ml-auto text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                  <IconCheck size={14} className="text-green-600" />
                  Termin angelegt
                </span>
              )}
            </div>

            <div className="rounded-2xl border p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <IconNotes size={18} className="text-primary" />
                <h3 className="font-semibold">Meeting-Notiz erfassen</h3>
              </div>

              <div className="space-y-1">
                <Label htmlFor="notiz_titel">Notiz-Titel *</Label>
                <Input
                  id="notiz_titel"
                  value={notizTitel}
                  onChange={(e) => setNotizTitel(e.target.value)}
                  placeholder="z. B. Review-Notiz Muster GmbH"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="notiz_inhalt">Inhalt *</Label>
                <Textarea
                  id="notiz_inhalt"
                  value={notizInhalt}
                  onChange={(e) => setNotizInhalt(e.target.value)}
                  placeholder="Besprochene Punkte, Entscheidungen, nächste Schritte …"
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="notiz_datum">Datum *</Label>
                  <Input
                    id="notiz_datum"
                    type="date"
                    value={notizDatum}
                    onChange={(e) => setNotizDatum(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="kategorie">Kategorie</Label>
                  <Select value={kategorie} onValueChange={setKategorie}>
                    <SelectTrigger id="kategorie">
                      <SelectValue placeholder="Kategorie wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {KATEGORIE_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="prioritaet">Priorität</Label>
                  <Select value={prioritaet} onValueChange={setPrioritaet}>
                    <SelectTrigger id="prioritaet">
                      <SelectValue placeholder="Priorität wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITAET_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="schlagwoerter">Schlagwörter</Label>
                <Input
                  id="schlagwoerter"
                  value={schlagwoerter}
                  onChange={(e) => setSchlagwoerter(e.target.value)}
                  placeholder="z. B. Wachstum, Finanzierung, Q3"
                />
              </div>

              {notizError && (
                <p className="text-sm text-destructive">{notizError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1"
                >
                  <IconArrowLeft size={16} />
                  Zurück
                </Button>
                <Button
                  onClick={handleSaveNotiz}
                  disabled={notizSaving || !notizTitel || !notizInhalt || !notizDatum}
                  className="flex items-center gap-1"
                >
                  {notizSaving ? 'Speichern …' : 'Notiz anlegen'}
                  {!notizSaving && <IconArrowRight size={16} />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt braucht die Unternehmensauswahl aus Schritt 1.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Neu starten
            </Button>
          </div>
        )
      )}

      {/* ───────────────────────── STEP 4: Dokument ─────────────────────────── */}
      {step === 4 && (
        selectedUnternehmen ? (
          <div className="space-y-5">
            {/* Context card */}
            <div className="rounded-2xl border bg-secondary/40 px-4 py-3 flex items-center gap-3">
              <IconBuilding size={18} className="text-primary shrink-0" />
              <p className="font-medium truncate min-w-0">{selectedUnternehmen.fields.name}</p>
              <span className="ml-auto text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                <IconCheck size={14} className="text-green-600" />
                Termin &amp; Notiz angelegt
              </span>
            </div>

            <div className="rounded-2xl border p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <IconFileText size={18} className="text-primary" />
                <h3 className="font-semibold">Dokument verknüpfen</h3>
                <span className="text-xs text-muted-foreground ml-auto">optional</span>
              </div>

              <div className="space-y-1">
                <Label htmlFor="dokumentenbezeichnung">Bezeichnung *</Label>
                <Input
                  id="dokumentenbezeichnung"
                  value={dokumentenbezeichnung}
                  onChange={(e) => setDokumentenbezeichnung(e.target.value)}
                  placeholder="z. B. Review-Protokoll Muster GmbH"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="dokumententyp">Dokumententyp</Label>
                  <Select value={dokumententyp} onValueChange={setDokumententyp}>
                    <SelectTrigger id="dokumententyp">
                      <SelectValue placeholder="Typ wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOKUMENTENTYP_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="dokumentendatum">Dokumentdatum</Label>
                  <Input
                    id="dokumentendatum"
                    type="date"
                    value={dokumentendatum}
                    onChange={(e) => setDokumentendatum(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="dokumentenlink">Link zum Dokument</Label>
                <Input
                  id="dokumentenlink"
                  type="url"
                  value={dokumentenlink}
                  onChange={(e) => setDokumentenlink(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="bereitgestellt_von">Bereitgestellt von</Label>
                <Input
                  id="bereitgestellt_von"
                  value={bereitgestelltVon}
                  onChange={(e) => setBereitgestelltVon(e.target.value)}
                  placeholder="Name oder Organisation"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="dokumentenbeschreibung">Beschreibung</Label>
                <Textarea
                  id="dokumentenbeschreibung"
                  value={dokumentenbeschreibung}
                  onChange={(e) => setDokumentenbeschreibung(e.target.value)}
                  placeholder="Kurze Beschreibung des Inhalts …"
                  rows={3}
                />
              </div>

              {dokError && (
                <p className="text-sm text-destructive">{dokError}</p>
              )}

              <div className="flex flex-wrap gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setStep(3)}
                  className="flex items-center gap-1"
                >
                  <IconArrowLeft size={16} />
                  Zurück
                </Button>
                <Button
                  onClick={handleSaveDokument}
                  disabled={dokSaving || !dokumentenbezeichnung}
                  className="flex items-center gap-1"
                >
                  {dokSaving ? 'Speichern …' : 'Dokument anlegen'}
                  {!dokSaving && <IconArrowRight size={16} />}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleSkipDokument}
                  className="text-muted-foreground"
                >
                  Überspringen
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt braucht die Unternehmensauswahl aus Schritt 1.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Neu starten
            </Button>
          </div>
        )
      )}

      {/* ───────────────────────── STEP 5: Abschluss ─────────────────────────── */}
      {step === 5 && (
        selectedUnternehmen ? (
          <div className="space-y-5">
            {/* Success header */}
            <div className="rounded-2xl border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 p-5 text-center space-y-1">
              <div className="flex justify-center mb-2">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40">
                  <IconCheck size={28} className="text-green-600" />
                </span>
              </div>
              <h3 className="font-semibold text-lg">Portfolio-Review abgeschlossen</h3>
              <p className="text-sm text-muted-foreground">
                Alle Informationen wurden erfolgreich gespeichert.
              </p>
            </div>

            {/* Summary */}
            <div className="rounded-2xl border p-5 space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Zusammenfassung
              </h4>

              {/* Company */}
              <div className="flex items-start gap-3 pb-3 border-b">
                <IconBuilding size={18} className="text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Unternehmen</p>
                  <p className="font-medium truncate">{selectedUnternehmen.fields.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedUnternehmen.fields.branche?.label ?? ''}
                  </p>
                  <div className="flex gap-4 mt-1 text-sm">
                    <span>
                      <span className="text-muted-foreground">Aktueller Wert: </span>
                      {formatEur(selectedUnternehmen.fields.aktueller_wert)}
                    </span>
                    <span>
                      <span className="text-muted-foreground">Investiert: </span>
                      {formatEur(selectedUnternehmen.fields.investiertes_kapital)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Termin */}
              <div className="flex items-start gap-3 pb-3 border-b">
                <IconCalendarEvent size={18} className="text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Review-Termin</p>
                  <p className="font-medium truncate">{terminbezeichnung}</p>
                  <p className="text-sm text-muted-foreground">
                    {datumUhrzeit
                      ? datumUhrzeit.replace('T', ' ').slice(0, 16) + ' Uhr'
                      : '—'}
                    {ort ? ` · ${ort}` : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {TERMINART_OPTIONS.find((o) => o.key === terminart)?.label ?? terminart}
                  </p>
                </div>
              </div>

              {/* Notiz */}
              <div className="flex items-start gap-3 pb-3 border-b">
                <IconNotes size={18} className="text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Meeting-Notiz</p>
                  <p className="font-medium truncate">{notizTitel}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{notizInhalt}</p>
                </div>
              </div>

              {/* Dokument */}
              <div className="flex items-start gap-3">
                <IconFileText size={18} className="text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Dokument</p>
                  {dokSkipped && !createdDokId ? (
                    <p className="text-sm text-muted-foreground italic">Kein Dokument angelegt</p>
                  ) : (
                    <p className="font-medium truncate">{dokumentenbezeichnung}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleReset}
                className="flex items-center gap-2"
              >
                <IconRefresh size={16} />
                Weiteren Review starten
              </Button>
              <a href="#/">
                <Button variant="outline">
                  Zurück zum Dashboard
                </Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Kein Review gefunden. Bitte starte den Prozess neu.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Neu starten
            </Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
