/**
 * Neues Unternehmen — 4-Schritt-Wizard zur Aufnahme eines Portfolio-Unternehmens.
 * Steps: 1) Stammdaten erfassen → 2) Erster Termin anlegen (optional) →
 *        3) Erstes Dokument hinterlegen (optional) → 4) Abschluss-Notiz erstellen (optional).
 * Reads: (keine bestehenden Records erforderlich — alle Steps erstellen neue Einträge).
 * Writes: unternehmen (createUnternehmenEntry), termine (createTermineEntry),
 *         dokumente (createDokumenteEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconBuilding,
  IconCalendarEvent,
  IconFileText,
  IconNotes,
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
} from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

const RECHTSFORM_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['rechtsform'] ?? [];
const BRANCHE_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['branche'] ?? [];
const STATUS_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['status'] ?? [];
const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

export default function NeuesUnternehmenPage() {
  const { loading, error, fetchAll } = useDashboardData();

  // Wizard step state
  const [step, setStep] = useState(1);

  // Step 1 — Stammdaten
  const [name, setName] = useState('');
  const [rechtsformKey, setRechtsformKey] = useState('none');
  const [brancheKey, setBrancheKey] = useState('none');
  const [statusKey, setStatusKey] = useState(STATUS_OPTIONS[0]?.key ?? 'aktiv');
  const [investiertesKapital, setInvestitertesKapital] = useState('');
  const [investitionsdatum, setInvestitionsdatum] = useState('');
  const [stadt, setStadt] = useState('');
  const [land, setLand] = useState('');
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [email, setEmail] = useState('');

  // Created record ids
  const [unternehmenId, setUnternehmenId] = useState<string | null>(null);
  const [unternehmenName, setUnternehmenName] = useState('');
  const [terminCreated, setTerminCreated] = useState(false);
  const [dokumentCreated, setDokumentCreated] = useState(false);
  const [notizCreated, setNotizCreated] = useState(false);

  // Step 2 — Erster Termin
  const [terminbezeichnung, setTerminbezeichnung] = useState('');
  const [terminartKey, setTerminartKey] = useState('none');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [terminstatusKey, setTerminstatusKey] = useState(TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant');
  const [notizenTermin, setNotizenTermin] = useState('');

  // Step 3 — Erstes Dokument
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententypKey, setDokumententypKey] = useState('none');
  const [dokumentendatum, setDokumentendatum] = useState('');
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [bereitgestelltVon, setBereitgestelltVon] = useState('');
  const [dokumentenbeschreibung, setDokumentenbeschreibung] = useState('');

  // Step 4 — Abschluss-Notiz
  const [notizTitel, setNotizTitel] = useState('');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kategorieKey, setKategorieKey] = useState('allgemein');
  const [prioritaetKey, setPrioritaetKey] = useState('mittel');

  // Saving states
  const [savingStep1, setSavingStep1] = useState(false);
  const [savingStep2, setSavingStep2] = useState(false);
  const [savingStep3, setSavingStep3] = useState(false);
  const [savingStep4, setSavingStep4] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // --- Step 1: Stammdaten speichern ---
  const handleSaveStammdaten = async () => {
    if (!name.trim()) return;
    setSavingStep1(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        status: statusKey,
      };
      if (rechtsformKey !== 'none') payload.rechtsform = rechtsformKey;
      if (brancheKey !== 'none') payload.branche = brancheKey;
      if (investiertesKapital) payload.investiertes_kapital = parseFloat(investiertesKapital);
      if (investitionsdatum) payload.investitionsdatum = investitionsdatum;
      if (stadt.trim()) payload.stadt = stadt.trim();
      if (land.trim()) payload.land = land.trim();
      if (vorname.trim()) payload.ansprechpartner_vorname = vorname.trim();
      if (nachname.trim()) payload.ansprechpartner_nachname = nachname.trim();
      if (email.trim()) payload.ansprechpartner_email = email.trim();

      const result = await LivingAppsService.createUnternehmenEntry(payload);
      setUnternehmenId(result.record_id);
      setUnternehmenName(name.trim());
      await fetchAll();
      setStep(2);
    } catch (err) {
      setSaveError('Fehler beim Speichern der Stammdaten. Bitte versuche es erneut.');
      console.error(err);
    } finally {
      setSavingStep1(false);
    }
  };

  // --- Step 2: Termin anlegen ---
  const handleSaveTermin = async () => {
    if (!unternehmenId || !terminbezeichnung.trim() || terminartKey === 'none' || !datumUhrzeit) return;
    setSavingStep2(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        terminbezeichnung: terminbezeichnung.trim(),
        terminart: terminartKey,
        datum_uhrzeit: datumUhrzeit,
        terminstatus: terminstatusKey,
      };
      if (ort.trim()) payload.ort = ort.trim();
      if (notizenTermin.trim()) payload.notizen_termin = notizenTermin.trim();

      await LivingAppsService.createTermineEntry(payload);
      setTerminCreated(true);
      await fetchAll();
      setStep(3);
    } catch (err) {
      setSaveError('Fehler beim Anlegen des Termins. Bitte versuche es erneut.');
      console.error(err);
    } finally {
      setSavingStep2(false);
    }
  };

  // --- Step 3: Dokument anlegen ---
  const handleSaveDokument = async () => {
    if (!unternehmenId || !dokumentenbezeichnung.trim()) return;
    setSavingStep3(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        dokumentenbezeichnung: dokumentenbezeichnung.trim(),
      };
      if (dokumententypKey !== 'none') payload.dokumententyp = dokumententypKey;
      if (dokumentendatum) payload.dokumentendatum = dokumentendatum;
      if (dokumentenlink.trim()) payload.dokumentenlink = dokumentenlink.trim();
      if (bereitgestelltVon.trim()) payload.bereitgestellt_von = bereitgestelltVon.trim();
      if (dokumentenbeschreibung.trim()) payload.dokumentenbeschreibung = dokumentenbeschreibung.trim();

      await LivingAppsService.createDokumenteEntry(payload);
      setDokumentCreated(true);
      await fetchAll();
      setStep(4);
    } catch (err) {
      setSaveError('Fehler beim Anlegen des Dokuments. Bitte versuche es erneut.');
      console.error(err);
    } finally {
      setSavingStep3(false);
    }
  };

  // --- Step 4: Notiz anlegen ---
  const handleSaveNotiz = async () => {
    if (!unternehmenId || !notizTitel.trim() || !notizInhalt.trim() || !notizDatum) return;
    setSavingStep4(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        notiz_titel: notizTitel.trim(),
        notiz_inhalt: notizInhalt.trim(),
        notiz_datum: notizDatum,
        kategorie: kategorieKey,
        prioritaet: prioritaetKey,
      };

      await LivingAppsService.createNotizenEntry(payload);
      setNotizCreated(true);
      await fetchAll();
      setStep(5);
    } catch (err) {
      setSaveError('Fehler beim Anlegen der Notiz. Bitte versuche es erneut.');
      console.error(err);
    } finally {
      setSavingStep4(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setName('');
    setRechtsformKey('none');
    setBrancheKey('none');
    setStatusKey(STATUS_OPTIONS[0]?.key ?? 'aktiv');
    setInvestitertesKapital('');
    setInvestitionsdatum('');
    setStadt('');
    setLand('');
    setVorname('');
    setNachname('');
    setEmail('');
    setUnternehmenId(null);
    setUnternehmenName('');
    setTerminCreated(false);
    setDokumentCreated(false);
    setNotizCreated(false);
    setTerminbezeichnung('');
    setTerminartKey('none');
    setDatumUhrzeit('');
    setOrt('');
    setTerminstatusKey(TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant');
    setNotizenTermin('');
    setDokumentenbezeichnung('');
    setDokumententypKey('none');
    setDokumentendatum('');
    setDokumentenlink('');
    setBereitgestelltVon('');
    setDokumentenbeschreibung('');
    setNotizTitel('');
    setNotizInhalt('');
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    setKategorieKey('allgemein');
    setPrioritaetKey('mittel');
    setSaveError(null);
  };

  const wizardSteps = [
    { label: 'Stammdaten' },
    { label: 'Termin' },
    { label: 'Dokument' },
    { label: 'Notiz' },
    { label: 'Fertig' },
  ];

  return (
    <IntentWizardShell
      title="Neues Unternehmen aufnehmen"
      subtitle="Schritt für Schritt zum vollständigen Portfolio-Eintrag"
      steps={wizardSteps}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Stammdaten ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <IconBuilding size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Stammdaten</h2>
              <p className="text-sm text-muted-foreground">Grundlegende Informationen zum Unternehmen</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="name">
                Unternehmensname <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="z. B. Alpha Ventures GmbH"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rechtsform">Rechtsform</Label>
              <Select value={rechtsformKey} onValueChange={setRechtsformKey}>
                <SelectTrigger id="rechtsform">
                  <SelectValue placeholder="Rechtsform wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Angabe</SelectItem>
                  {RECHTSFORM_OPTIONS.map(opt => (
                    <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branche">Branche</Label>
              <Select value={brancheKey} onValueChange={setBrancheKey}>
                <SelectTrigger id="branche">
                  <SelectValue placeholder="Branche wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Angabe</SelectItem>
                  {BRANCHE_OPTIONS.map(opt => (
                    <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">
                Status <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setStatusKey(opt.key)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      statusKey === opt.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-foreground hover:bg-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="investitionsdatum">Investitionsdatum</Label>
              <Input
                id="investitionsdatum"
                type="date"
                value={investitionsdatum}
                onChange={e => setInvestitionsdatum(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="investiertes_kapital">Investiertes Kapital (€)</Label>
              <Input
                id="investiertes_kapital"
                type="number"
                min="0"
                step="0.01"
                value={investiertesKapital}
                onChange={e => setInvestitertesKapital(e.target.value)}
                placeholder="z. B. 500000"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stadt">Stadt</Label>
              <Input
                id="stadt"
                value={stadt}
                onChange={e => setStadt(e.target.value)}
                placeholder="z. B. München"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="land">Land</Label>
              <Input
                id="land"
                value={land}
                onChange={e => setLand(e.target.value)}
                placeholder="z. B. Deutschland"
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-secondary/30 p-4 space-y-4">
            <p className="text-sm font-medium text-muted-foreground">Ansprechpartner (optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="vorname">Vorname</Label>
                <Input
                  id="vorname"
                  value={vorname}
                  onChange={e => setVorname(e.target.value)}
                  placeholder="Vorname"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nachname">Nachname</Label>
                <Input
                  id="nachname"
                  value={nachname}
                  onChange={e => setNachname(e.target.value)}
                  placeholder="Nachname"
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="kontakt@unternehmen.de"
                />
              </div>
            </div>
          </div>

          {saveError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{saveError}</p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSaveStammdaten}
              disabled={!name.trim() || savingStep1}
              className="gap-2"
            >
              {savingStep1 ? 'Wird gespeichert …' : 'Weiter zu Termin'}
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Erster Termin (optional) ──────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          {!unternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                Dieser Schritt benötigt ein gespeichertes Unternehmen aus Schritt 1.
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>
                Zurück zu Stammdaten
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <IconCalendarEvent size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Erster Termin</h2>
                  <p className="text-sm text-muted-foreground">
                    Optionaler erster Termin für <strong>{unternehmenName}</strong>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="terminbezeichnung">
                    Terminbezeichnung <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="terminbezeichnung"
                    value={terminbezeichnung}
                    onChange={e => setTerminbezeichnung(e.target.value)}
                    placeholder="z. B. Erstes Kennenlerngespräch"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="terminart">
                    Terminart <span className="text-destructive">*</span>
                  </Label>
                  <Select value={terminartKey} onValueChange={setTerminartKey}>
                    <SelectTrigger id="terminart">
                      <SelectValue placeholder="Terminart wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Bitte wählen</SelectItem>
                      {TERMINART_OPTIONS.map(opt => (
                        <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="datum_uhrzeit">
                    Datum & Uhrzeit <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="datum_uhrzeit"
                    type="datetime-local"
                    value={datumUhrzeit}
                    onChange={e => setDatumUhrzeit(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ort">Ort</Label>
                  <Input
                    id="ort"
                    value={ort}
                    onChange={e => setOrt(e.target.value)}
                    placeholder="z. B. Büro München"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Terminstatus</Label>
                  <div className="flex flex-wrap gap-2">
                    {TERMINSTATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setTerminstatusKey(opt.key)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                          terminstatusKey === opt.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border text-foreground hover:bg-secondary'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="notizen_termin">Notizen zum Termin</Label>
                  <Textarea
                    id="notizen_termin"
                    value={notizenTermin}
                    onChange={e => setNotizenTermin(e.target.value)}
                    placeholder="Agenda, Anmerkungen …"
                    rows={3}
                  />
                </div>
              </div>

              {saveError && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{saveError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                  <IconArrowLeft size={16} />
                  Zurück
                </Button>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(3)}
                    className="text-muted-foreground"
                  >
                    Überspringen
                  </Button>
                  <Button
                    onClick={handleSaveTermin}
                    disabled={
                      !terminbezeichnung.trim() ||
                      terminartKey === 'none' ||
                      !datumUhrzeit ||
                      savingStep2
                    }
                    className="gap-2"
                  >
                    {savingStep2 ? 'Wird gespeichert …' : 'Termin anlegen & weiter'}
                    <IconArrowRight size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 3: Erstes Dokument (optional) ────────────────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          {!unternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                Dieser Schritt benötigt ein gespeichertes Unternehmen aus Schritt 1.
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>
                Neu starten
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <IconFileText size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Erstes Dokument</h2>
                  <p className="text-sm text-muted-foreground">
                    Optionales Dokument für <strong>{unternehmenName}</strong>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="dokumentenbezeichnung">
                    Dokumentenbezeichnung <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="dokumentenbezeichnung"
                    value={dokumentenbezeichnung}
                    onChange={e => setDokumentenbezeichnung(e.target.value)}
                    placeholder="z. B. Gesellschaftsvertrag 2024"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dokumententyp">Dokumententyp</Label>
                  <Select value={dokumententypKey} onValueChange={setDokumententypKey}>
                    <SelectTrigger id="dokumententyp">
                      <SelectValue placeholder="Typ wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keine Angabe</SelectItem>
                      {DOKUMENTENTYP_OPTIONS.map(opt => (
                        <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dokumentendatum">Dokumentendatum</Label>
                  <Input
                    id="dokumentendatum"
                    type="date"
                    value={dokumentendatum}
                    onChange={e => setDokumentendatum(e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="dokumentenlink">Link zum Dokument</Label>
                  <Input
                    id="dokumentenlink"
                    type="url"
                    value={dokumentenlink}
                    onChange={e => setDokumentenlink(e.target.value)}
                    placeholder="https://drive.google.com/…"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="bereitgestellt_von">Bereitgestellt von</Label>
                  <Input
                    id="bereitgestellt_von"
                    value={bereitgestelltVon}
                    onChange={e => setBereitgestelltVon(e.target.value)}
                    placeholder="z. B. Rechtsabteilung"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="dokumentenbeschreibung">Beschreibung</Label>
                  <Textarea
                    id="dokumentenbeschreibung"
                    value={dokumentenbeschreibung}
                    onChange={e => setDokumentenbeschreibung(e.target.value)}
                    placeholder="Kurze Beschreibung des Inhalts …"
                    rows={3}
                  />
                </div>
              </div>

              {saveError && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{saveError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                  <IconArrowLeft size={16} />
                  Zurück
                </Button>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(4)}
                    className="text-muted-foreground"
                  >
                    Überspringen
                  </Button>
                  <Button
                    onClick={handleSaveDokument}
                    disabled={!dokumentenbezeichnung.trim() || savingStep3}
                    className="gap-2"
                  >
                    {savingStep3 ? 'Wird gespeichert …' : 'Dokument anlegen & weiter'}
                    <IconArrowRight size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 4: Abschluss-Notiz (optional) ────────────────────────── */}
      {step === 4 && (
        <div className="space-y-6">
          {!unternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                Dieser Schritt benötigt ein gespeichertes Unternehmen aus Schritt 1.
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>
                Neu starten
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <IconNotes size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Abschluss-Notiz</h2>
                  <p className="text-sm text-muted-foreground">
                    Optionale erste Notiz zu <strong>{unternehmenName}</strong>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="notiz_titel">
                    Notiz-Titel <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="notiz_titel"
                    value={notizTitel}
                    onChange={e => setNotizTitel(e.target.value)}
                    placeholder="z. B. Erste Einschätzung"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="notiz_inhalt">
                    Notiz-Inhalt <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="notiz_inhalt"
                    value={notizInhalt}
                    onChange={e => setNotizInhalt(e.target.value)}
                    placeholder="Deine Einschätzung, erste Gedanken …"
                    rows={5}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notiz_datum">
                    Datum <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="notiz_datum"
                    type="date"
                    value={notizDatum}
                    onChange={e => setNotizDatum(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kategorie">Kategorie</Label>
                  <Select value={kategorieKey} onValueChange={setKategorieKey}>
                    <SelectTrigger id="kategorie">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KATEGORIE_OPTIONS.map(opt => (
                        <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Priorität</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRIORITAET_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setPrioritaetKey(opt.key)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                          prioritaetKey === opt.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border text-foreground hover:bg-secondary'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {saveError && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{saveError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <Button variant="outline" onClick={() => setStep(3)} className="gap-2">
                  <IconArrowLeft size={16} />
                  Zurück
                </Button>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(5)}
                    className="text-muted-foreground"
                  >
                    Überspringen
                  </Button>
                  <Button
                    onClick={handleSaveNotiz}
                    disabled={
                      !notizTitel.trim() ||
                      !notizInhalt.trim() ||
                      !notizDatum ||
                      savingStep4
                    }
                    className="gap-2"
                  >
                    {savingStep4 ? 'Wird gespeichert …' : 'Notiz anlegen & abschließen'}
                    <IconCheck size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 5: Fertig ────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-6">
          {!unternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                Kein Unternehmen gefunden. Bitte starte den Wizard neu.
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>
                Neu starten
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <IconCheck size={28} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Unternehmen erfolgreich aufgenommen!</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    <strong>{unternehmenName}</strong> wurde in dein Portfolio eingetragen.
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-secondary/30 border-b">
                  <p className="text-sm font-semibold text-muted-foreground">Zusammenfassung</p>
                </div>
                <div className="divide-y">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <IconBuilding size={16} className="text-muted-foreground" />
                      <span>Unternehmen</span>
                    </div>
                    <span className="text-sm font-medium text-primary">{unternehmenName}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <IconCalendarEvent size={16} className="text-muted-foreground" />
                      <span>Erster Termin</span>
                    </div>
                    <span className={`text-sm font-medium ${terminCreated ? 'text-primary' : 'text-muted-foreground'}`}>
                      {terminCreated ? 'Angelegt' : 'Nicht angelegt'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <IconFileText size={16} className="text-muted-foreground" />
                      <span>Erstes Dokument</span>
                    </div>
                    <span className={`text-sm font-medium ${dokumentCreated ? 'text-primary' : 'text-muted-foreground'}`}>
                      {dokumentCreated ? 'Angelegt' : 'Nicht angelegt'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <IconNotes size={16} className="text-muted-foreground" />
                      <span>Abschluss-Notiz</span>
                    </div>
                    <span className={`text-sm font-medium ${notizCreated ? 'text-primary' : 'text-muted-foreground'}`}>
                      {notizCreated ? 'Angelegt' : 'Nicht angelegt'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleReset} variant="outline" className="flex-1">
                  Weiteres Unternehmen aufnehmen
                </Button>
                <Button asChild className="flex-1">
                  <a href="#/">Zurück zum Dashboard</a>
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
