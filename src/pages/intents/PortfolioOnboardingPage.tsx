/**
 * Portfolio-Onboarding — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen anlegen → 2) Ersttermin planen (optional) →
 *        3) Erstdokument erfassen (optional) → 4) Erstnotiz (optional) → 5) Abschluss.
 * Reads: (keine bestehenden Daten nötig — alle Schritte legen neue Datensätze an).
 * Writes: unternehmen (createUnternehmenEntry), termine (createTermineEntry),
 *         dokumente (createDokumenteEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconBuilding,
  IconCalendarPlus,
  IconFileText,
  IconNotes,
  IconCheck,
  IconArrowRight,
  IconPlayerSkipForward,
} from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { useDashboardData } from '@/hooks/useDashboardData';

const RECHTSFORM_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['rechtsform'] ?? [];
const BRANCHE_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['branche'] ?? [];
const STATUS_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['status'] ?? [];
const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

export default function PortfolioOnboardingPage() {
  const { loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);

  // Step 1 — Unternehmen
  const [name, setName] = useState('');
  const [rechtsform, setRechtsform] = useState('');
  const [branche, setBranche] = useState('');
  const [unternehmenStatus, setUnternehmenStatus] = useState('aktiv');
  const [investiertesKapital, setInvestiertesKapital] = useState('');
  const [investitionsdatum, setInvestitionsdatum] = useState('');
  const [stadt, setStadt] = useState('');
  const [ansprechpartnerVorname, setAnsprechpartnerVorname] = useState('');
  const [ansprechpartnerNachname, setAnsprechpartnerNachname] = useState('');
  const [ansprechpartnerEmail, setAnsprechpartnerEmail] = useState('');
  const [createdUnternehmenId, setCreatedUnternehmenId] = useState<string | null>(null);
  const [savingUnternehmen, setSavingUnternehmen] = useState(false);
  const [unternehmenError, setUnternehmenError] = useState('');

  // Step 2 — Termin
  const [terminbezeichnung, setTerminbezeichnung] = useState('');
  const [terminart, setTerminart] = useState('strategiemeeting');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [terminstatus, setTerminstatus] = useState('geplant');
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);
  const [savingTermin, setSavingTermin] = useState(false);
  const [terminError, setTerminError] = useState('');

  // Step 3 — Dokument
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententyp, setDokumententyp] = useState('beteiligungsvertrag');
  const [dokumentendatum, setDokumentendatum] = useState('');
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [bereitgestelltVon, setBereitgestelltVon] = useState('');
  const [createdDokumentId, setCreatedDokumentId] = useState<string | null>(null);
  const [savingDokument, setSavingDokument] = useState(false);
  const [dokumentError, setDokumentError] = useState('');

  // Step 4 — Notiz
  const [notizTitel, setNotizTitel] = useState('');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kategorie, setKategorie] = useState('allgemein');
  const [prioritaet, setPrioritaet] = useState('mittel');
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);
  const [savingNotiz, setSavingNotiz] = useState(false);
  const [notizError, setNotizError] = useState('');

  const handleCreateUnternehmen = async () => {
    if (!name.trim()) {
      setUnternehmenError('Bitte gib einen Unternehmensnamen ein.');
      return;
    }
    setUnternehmenError('');
    setSavingUnternehmen(true);
    try {
      let existingId = createdUnternehmenId;
      if (!existingId) {
        const payload: Record<string, unknown> = { name: name.trim(), status: unternehmenStatus };
        if (rechtsform && rechtsform !== 'none') payload.rechtsform = rechtsform;
        if (branche && branche !== 'none') payload.branche = branche;
        if (investiertesKapital) payload.investiertes_kapital = parseFloat(investiertesKapital);
        if (investitionsdatum) payload.investitionsdatum = investitionsdatum;
        if (stadt.trim()) payload.stadt = stadt.trim();
        if (ansprechpartnerVorname.trim()) payload.ansprechpartner_vorname = ansprechpartnerVorname.trim();
        if (ansprechpartnerNachname.trim()) payload.ansprechpartner_nachname = ansprechpartnerNachname.trim();
        if (ansprechpartnerEmail.trim()) payload.ansprechpartner_email = ansprechpartnerEmail.trim();
        const result = await LivingAppsService.createUnternehmenEntry(payload);
        existingId = result.record_id;
        setCreatedUnternehmenId(existingId);
        await fetchAll();
      }
      setStep(2);
    } catch {
      setUnternehmenError('Fehler beim Anlegen des Unternehmens. Bitte versuche es erneut.');
    } finally {
      setSavingUnternehmen(false);
    }
  };

  const handleCreateTermin = async () => {
    if (!terminbezeichnung.trim()) {
      setTerminError('Bitte gib eine Terminbezeichnung ein.');
      return;
    }
    if (!datumUhrzeit) {
      setTerminError('Bitte wähle Datum und Uhrzeit aus.');
      return;
    }
    setTerminError('');
    setSavingTermin(true);
    try {
      let existingId = createdTerminId;
      if (!existingId && createdUnternehmenId) {
        const payload: Record<string, unknown> = {
          terminbezeichnung: terminbezeichnung.trim(),
          terminart,
          datum_uhrzeit: datumUhrzeit,
          terminstatus,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, createdUnternehmenId),
        };
        if (ort.trim()) payload.ort = ort.trim();
        const result = await LivingAppsService.createTermineEntry(payload);
        existingId = result.record_id;
        setCreatedTerminId(existingId);
        await fetchAll();
      }
      setStep(3);
    } catch {
      setTerminError('Fehler beim Anlegen des Termins. Bitte versuche es erneut.');
    } finally {
      setSavingTermin(false);
    }
  };

  const handleCreateDokument = async () => {
    if (!dokumentenbezeichnung.trim()) {
      setDokumentError('Bitte gib eine Dokumentenbezeichnung ein.');
      return;
    }
    setDokumentError('');
    setSavingDokument(true);
    try {
      let existingId = createdDokumentId;
      if (!existingId && createdUnternehmenId) {
        const payload: Record<string, unknown> = {
          dokumentenbezeichnung: dokumentenbezeichnung.trim(),
          dokumententyp,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, createdUnternehmenId),
        };
        if (dokumentendatum) payload.dokumentendatum = dokumentendatum;
        if (dokumentenlink.trim()) payload.dokumentenlink = dokumentenlink.trim();
        if (bereitgestelltVon.trim()) payload.bereitgestellt_von = bereitgestelltVon.trim();
        const result = await LivingAppsService.createDokumenteEntry(payload);
        existingId = result.record_id;
        setCreatedDokumentId(existingId);
        await fetchAll();
      }
      setStep(4);
    } catch {
      setDokumentError('Fehler beim Anlegen des Dokuments. Bitte versuche es erneut.');
    } finally {
      setSavingDokument(false);
    }
  };

  const handleCreateNotiz = async () => {
    if (!notizTitel.trim()) {
      setNotizError('Bitte gib einen Titel für die Notiz ein.');
      return;
    }
    if (!notizInhalt.trim()) {
      setNotizError('Bitte gib einen Inhalt für die Notiz ein.');
      return;
    }
    setNotizError('');
    setSavingNotiz(true);
    try {
      let existingId = createdNotizId;
      if (!existingId && createdUnternehmenId) {
        const payload: Record<string, unknown> = {
          notiz_titel: notizTitel.trim(),
          notiz_inhalt: notizInhalt.trim(),
          notiz_datum: notizDatum,
          kategorie,
          prioritaet,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, createdUnternehmenId),
        };
        const result = await LivingAppsService.createNotizenEntry(payload);
        existingId = result.record_id;
        setCreatedNotizId(existingId);
        await fetchAll();
      }
      setStep(5);
    } catch {
      setNotizError('Fehler beim Anlegen der Notiz. Bitte versuche es erneut.');
    } finally {
      setSavingNotiz(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setName('');
    setRechtsform('');
    setBranche('');
    setUnternehmenStatus('aktiv');
    setInvestiertesKapital('');
    setInvestitionsdatum('');
    setStadt('');
    setAnsprechpartnerVorname('');
    setAnsprechpartnerNachname('');
    setAnsprechpartnerEmail('');
    setCreatedUnternehmenId(null);
    setUnternehmenError('');
    setTerminbezeichnung('');
    setTerminart('strategiemeeting');
    setDatumUhrzeit('');
    setOrt('');
    setTerminstatus('geplant');
    setCreatedTerminId(null);
    setTerminError('');
    setDokumentenbezeichnung('');
    setDokumententyp('beteiligungsvertrag');
    setDokumentendatum('');
    setDokumentenlink('');
    setBereitgestelltVon('');
    setCreatedDokumentId(null);
    setDokumentError('');
    setNotizTitel('');
    setNotizInhalt('');
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    setKategorie('allgemein');
    setPrioritaet('mittel');
    setCreatedNotizId(null);
    setNotizError('');
  };

  const wizardSteps = [
    { label: 'Unternehmen' },
    { label: 'Ersttermin' },
    { label: 'Dokument' },
    { label: 'Notiz' },
    { label: 'Abschluss' },
  ];

  return (
    <IntentWizardShell
      title="Portfolio-Onboarding"
      subtitle="Neues Unternehmen in 4 Schritten vollständig aufnehmen"
      steps={wizardSteps}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Schritt 1: Unternehmen anlegen ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <IconBuilding size={22} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Unternehmen anlegen</h2>
              <p className="text-sm text-muted-foreground">Stammdaten des neuen Portfolio-Unternehmens</p>
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
                placeholder="z. B. Musterfirma GmbH"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rechtsform">Rechtsform</Label>
              <Select value={rechtsform || 'none'} onValueChange={v => setRechtsform(v === 'none' ? '' : v)}>
                <SelectTrigger id="rechtsform">
                  <SelectValue placeholder="Rechtsform wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Angabe</SelectItem>
                  {RECHTSFORM_OPTIONS.map(o => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branche">Branche</Label>
              <Select value={branche || 'none'} onValueChange={v => setBranche(v === 'none' ? '' : v)}>
                <SelectTrigger id="branche">
                  <SelectValue placeholder="Branche wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Angabe</SelectItem>
                  {BRANCHE_OPTIONS.map(o => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unternehmenStatus">
                Status <span className="text-destructive">*</span>
              </Label>
              <Select value={unternehmenStatus} onValueChange={setUnternehmenStatus}>
                <SelectTrigger id="unternehmenStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label htmlFor="investiertesKapital">Investiertes Kapital (€)</Label>
              <Input
                id="investiertesKapital"
                type="number"
                value={investiertesKapital}
                onChange={e => setInvestiertesKapital(e.target.value)}
                placeholder="z. B. 500000"
                min="0"
              />
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
          </div>

          <div className="rounded-2xl border p-4 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Ansprechpartner
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ansprechpartnerVorname">Vorname</Label>
                <Input
                  id="ansprechpartnerVorname"
                  value={ansprechpartnerVorname}
                  onChange={e => setAnsprechpartnerVorname(e.target.value)}
                  placeholder="Vorname"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ansprechpartnerNachname">Nachname</Label>
                <Input
                  id="ansprechpartnerNachname"
                  value={ansprechpartnerNachname}
                  onChange={e => setAnsprechpartnerNachname(e.target.value)}
                  placeholder="Nachname"
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="ansprechpartnerEmail">E-Mail</Label>
                <Input
                  id="ansprechpartnerEmail"
                  type="email"
                  value={ansprechpartnerEmail}
                  onChange={e => setAnsprechpartnerEmail(e.target.value)}
                  placeholder="email@beispiel.de"
                />
              </div>
            </div>
          </div>

          {unternehmenError && (
            <p className="text-sm text-destructive">{unternehmenError}</p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleCreateUnternehmen}
              disabled={savingUnternehmen || !name.trim()}
              className="gap-2"
            >
              {savingUnternehmen ? 'Wird angelegt…' : 'Unternehmen anlegen'}
              {!savingUnternehmen && <IconArrowRight size={16} />}
            </Button>
          </div>
        </div>
      )}

      {/* ── Schritt 2: Ersttermin planen ── */}
      {step === 2 && (
        createdUnternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <IconCalendarPlus size={22} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Ersttermin planen</h2>
                <p className="text-sm text-muted-foreground">Optionaler erster Termin mit dem Unternehmen</p>
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
                  placeholder="z. B. Kick-off Meeting"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="terminart">
                  Terminart <span className="text-destructive">*</span>
                </Label>
                <Select value={terminart} onValueChange={setTerminart}>
                  <SelectTrigger id="terminart">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TERMINART_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="terminstatus">Status</Label>
                <Select value={terminstatus} onValueChange={setTerminstatus}>
                  <SelectTrigger id="terminstatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TERMINSTATUS_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="datumUhrzeit">
                  Datum & Uhrzeit <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="datumUhrzeit"
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
            </div>

            {terminError && (
              <p className="text-sm text-destructive">{terminError}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(3)}
                className="gap-2"
              >
                <IconPlayerSkipForward size={16} />
                Überspringen
              </Button>
              <Button
                onClick={handleCreateTermin}
                disabled={savingTermin || !terminbezeichnung.trim() || !datumUhrzeit}
                className="gap-2"
              >
                {savingTermin ? 'Wird angelegt…' : 'Termin anlegen'}
                {!savingTermin && <IconArrowRight size={16} />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt benötigt ein angelegtes Unternehmen aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Schritt 3: Erstdokument erfassen ── */}
      {step === 3 && (
        createdUnternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <IconFileText size={22} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Erstdokument erfassen</h2>
                <p className="text-sm text-muted-foreground">Optionales erstes Dokument zum Unternehmen</p>
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
                  placeholder="z. B. Beteiligungsvertrag 2026"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dokumententyp">Dokumententyp</Label>
                <Select value={dokumententyp} onValueChange={setDokumententyp}>
                  <SelectTrigger id="dokumententyp">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOKUMENTENTYP_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
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
                <Label htmlFor="dokumentenlink">Dokumentenlink (URL)</Label>
                <Input
                  id="dokumentenlink"
                  type="url"
                  value={dokumentenlink}
                  onChange={e => setDokumentenlink(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="bereitgestelltVon">Bereitgestellt von</Label>
                <Input
                  id="bereitgestelltVon"
                  value={bereitgestelltVon}
                  onChange={e => setBereitgestelltVon(e.target.value)}
                  placeholder="z. B. Notar Müller"
                />
              </div>
            </div>

            {dokumentError && (
              <p className="text-sm text-destructive">{dokumentError}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(4)}
                className="gap-2"
              >
                <IconPlayerSkipForward size={16} />
                Überspringen
              </Button>
              <Button
                onClick={handleCreateDokument}
                disabled={savingDokument || !dokumentenbezeichnung.trim()}
                className="gap-2"
              >
                {savingDokument ? 'Wird angelegt…' : 'Dokument anlegen'}
                {!savingDokument && <IconArrowRight size={16} />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt benötigt ein angelegtes Unternehmen aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Schritt 4: Erstnotiz ── */}
      {step === 4 && (
        createdUnternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <IconNotes size={22} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Erstnotiz anlegen</h2>
                <p className="text-sm text-muted-foreground">Optionale erste Notiz zum Unternehmen</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="notizTitel">
                  Titel <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="notizTitel"
                  value={notizTitel}
                  onChange={e => setNotizTitel(e.target.value)}
                  placeholder="z. B. Erste Einschätzung"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="notizInhalt">
                  Inhalt <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="notizInhalt"
                  value={notizInhalt}
                  onChange={e => setNotizInhalt(e.target.value)}
                  placeholder="Deine Notiz zum Unternehmen…"
                  rows={4}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notizDatum">
                  Datum <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="notizDatum"
                  type="date"
                  value={notizDatum}
                  onChange={e => setNotizDatum(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="kategorie">Kategorie</Label>
                <Select value={kategorie} onValueChange={setKategorie}>
                  <SelectTrigger id="kategorie">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KATEGORIE_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prioritaet">Priorität</Label>
                <Select value={prioritaet} onValueChange={setPrioritaet}>
                  <SelectTrigger id="prioritaet">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITAET_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {notizError && (
              <p className="text-sm text-destructive">{notizError}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(5)}
                className="gap-2"
              >
                <IconPlayerSkipForward size={16} />
                Überspringen
              </Button>
              <Button
                onClick={handleCreateNotiz}
                disabled={savingNotiz || !notizTitel.trim() || !notizInhalt.trim()}
                className="gap-2"
              >
                {savingNotiz ? 'Wird angelegt…' : 'Notiz anlegen'}
                {!savingNotiz && <IconArrowRight size={16} />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt benötigt ein angelegtes Unternehmen aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Schritt 5: Abschluss / Zusammenfassung ── */}
      {step === 5 && (
        createdUnternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <IconCheck size={22} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Onboarding abgeschlossen</h2>
                <p className="text-sm text-muted-foreground">Folgendes wurde für <strong>{name}</strong> angelegt:</p>
              </div>
            </div>

            <div className="rounded-2xl border overflow-hidden divide-y">
              <SummaryRow
                icon={<IconBuilding size={18} className="text-primary" />}
                label="Unternehmen"
                value={name}
                done
              />
              <SummaryRow
                icon={<IconCalendarPlus size={18} className={createdTerminId ? 'text-primary' : 'text-muted-foreground'} />}
                label="Ersttermin"
                value={createdTerminId ? terminbezeichnung : undefined}
                skipped={!createdTerminId}
              />
              <SummaryRow
                icon={<IconFileText size={18} className={createdDokumentId ? 'text-primary' : 'text-muted-foreground'} />}
                label="Dokument"
                value={createdDokumentId ? dokumentenbezeichnung : undefined}
                skipped={!createdDokumentId}
              />
              <SummaryRow
                icon={<IconNotes size={18} className={createdNotizId ? 'text-primary' : 'text-muted-foreground'} />}
                label="Notiz"
                value={createdNotizId ? notizTitel : undefined}
                skipped={!createdNotizId}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleReset}
                className="gap-2"
              >
                Weiteres Unternehmen aufnehmen
              </Button>
              <Button asChild className="gap-2">
                <a href="#/">
                  Zurück zum Dashboard
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Kein Unternehmen angelegt. Bitte starte von vorne.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  done,
  skipped,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  done?: boolean;
  skipped?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        {value && <p className="text-xs text-muted-foreground truncate">{value}</p>}
        {skipped && <p className="text-xs text-muted-foreground italic">Übersprungen</p>}
      </div>
      {(done || value) && !skipped && (
        <IconCheck size={16} className="text-primary shrink-0" />
      )}
    </div>
  );
}
