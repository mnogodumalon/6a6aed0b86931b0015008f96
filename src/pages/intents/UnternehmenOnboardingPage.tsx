/**
 * Intent: Unternehmen onboarden
 * Beschreibung: Neues Portfoliounternehmen in 4 Schritten aufnehmen – Stammdaten, Ersttermin, Dokument und Abschluss.
 * Steps: 1) Stammdaten erfassen → 2) Ersttermin anlegen (optional) → 3) Erstdokument hochladen (optional) → 4) Abschluss & Bestätigung.
 * Reads: (keine — reine Erstellungsseite).
 * Writes: unternehmen (createUnternehmenEntry), termine (createTermineEntry), dokumente (createDokumenteEntry).
 * Composes: IntentWizardShell, StatusBadge.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import {
  IconBuilding,
  IconCalendarEvent,
  IconFile,
  IconCheck,
  IconCircle,
  IconArrowRight,
  IconRefresh,
} from '@tabler/icons-react';

// ---- Lookup options (from schema) ----
const rechtsformOptions = LOOKUP_OPTIONS['unternehmen']?.['rechtsform'] ?? [];
const brancheOptions = LOOKUP_OPTIONS['unternehmen']?.['branche'] ?? [];
const statusOptions = LOOKUP_OPTIONS['unternehmen']?.['status'] ?? [];
const terminartOptions = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const terminstatusOptions = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const dokumententypOptions = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];

// ---- Wizard steps ----
const WIZARD_STEPS = [
  { label: 'Stammdaten' },
  { label: 'Ersttermin' },
  { label: 'Erstdokument' },
  { label: 'Abschluss' },
];

export default function UnternehmenOnboardingPage() {
  const navigate = useNavigate();

  // Wizard state
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Step 1 — Stammdaten
  const [name, setName] = useState('');
  const [rechtsform, setRechtsform] = useState('');
  const [branche, setBranche] = useState('');
  const [status, setStatus] = useState(statusOptions[0]?.key ?? 'aktiv');
  const [beteiligungsquote, setBeteiligungsquote] = useState('');
  const [investiertesKapital, setInvestiertesKapital] = useState('');
  const [investitionsdatum, setInvestitionsdatum] = useState('');
  const [stadt, setStadt] = useState('');
  const [land, setLand] = useState('');
  const [apVorname, setApVorname] = useState('');
  const [apNachname, setApNachname] = useState('');
  const [apEmail, setApEmail] = useState('');

  // Created records
  const [unternehmenId, setUnternehmenId] = useState<string | null>(null);

  // Step 2 — Ersttermin
  const [terminbezeichnung, setTerminbezeichnung] = useState('Erstgespräch');
  const [terminart, setTerminart] = useState('');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [terminstatus, setTerminstatus] = useState(terminstatusOptions[0]?.key ?? 'geplant');
  const [terminSkipped, setTerminSkipped] = useState(false);
  const [terminCreated, setTerminCreated] = useState(false);

  // Step 3 — Erstdokument
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententyp, setDokumententyp] = useState('');
  const [dokumentendatum, setDokumentendatum] = useState('');
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [bereitgestelltVon, setBereitgestelltVon] = useState('');
  const [dokumentSkipped, setDokumentSkipped] = useState(false);
  const [dokumentCreated, setDokumentCreated] = useState(false);

  // ---- Handlers ----

  async function handleStammdatenWeiter() {
    if (!name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await LivingAppsService.createUnternehmenEntry({
        name: name.trim(),
        rechtsform: rechtsform || undefined,
        branche: branche || undefined,
        status: status || undefined,
        beteiligungsquote: beteiligungsquote ? parseFloat(beteiligungsquote) : undefined,
        investiertes_kapital: investiertesKapital ? parseFloat(investiertesKapital) : undefined,
        investitionsdatum: investitionsdatum || undefined,
        stadt: stadt.trim() || undefined,
        land: land.trim() || undefined,
        ansprechpartner_vorname: apVorname.trim() || undefined,
        ansprechpartner_nachname: apNachname.trim() || undefined,
        ansprechpartner_email: apEmail.trim() || undefined,
      });
      setUnternehmenId(result.record_id);
      setStep(2);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setSaving(false);
    }
  }

  async function handleTerminWeiter() {
    if (!unternehmenId) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (datumUhrzeit && terminbezeichnung.trim()) {
        await LivingAppsService.createTermineEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
          terminbezeichnung: terminbezeichnung.trim(),
          terminart: terminart || undefined,
          datum_uhrzeit: datumUhrzeit,
          ort: ort.trim() || undefined,
          terminstatus: terminstatus || undefined,
        });
        setTerminCreated(true);
      } else {
        setTerminSkipped(true);
      }
      setStep(3);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setSaving(false);
    }
  }

  function handleTerminSkip() {
    setTerminSkipped(true);
    setTerminCreated(false);
    setStep(3);
  }

  async function handleDokumentWeiter() {
    if (!unternehmenId) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (dokumentenbezeichnung.trim()) {
        await LivingAppsService.createDokumenteEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
          dokumentenbezeichnung: dokumentenbezeichnung.trim(),
          dokumententyp: dokumententyp || undefined,
          dokumentendatum: dokumentendatum || undefined,
          dokumentenlink: dokumentenlink.trim() || undefined,
          bereitgestellt_von: bereitgestelltVon.trim() || undefined,
        });
        setDokumentCreated(true);
      } else {
        setDokumentSkipped(true);
      }
      setStep(4);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setSaving(false);
    }
  }

  function handleDokumentSkip() {
    setDokumentSkipped(true);
    setDokumentCreated(false);
    setStep(4);
  }

  function handleReset() {
    setStep(1);
    setSaveError(null);
    setName('');
    setRechtsform('');
    setBranche('');
    setStatus(statusOptions[0]?.key ?? 'aktiv');
    setBeteiligungsquote('');
    setInvestiertesKapital('');
    setInvestitionsdatum('');
    setStadt('');
    setLand('');
    setApVorname('');
    setApNachname('');
    setApEmail('');
    setUnternehmenId(null);
    setTerminbezeichnung('Erstgespräch');
    setTerminart('');
    setDatumUhrzeit('');
    setOrt('');
    setTerminstatus(terminstatusOptions[0]?.key ?? 'geplant');
    setTerminSkipped(false);
    setTerminCreated(false);
    setDokumentenbezeichnung('');
    setDokumententyp('');
    setDokumentendatum('');
    setDokumentenlink('');
    setBereitgestelltVon('');
    setDokumentSkipped(false);
    setDokumentCreated(false);
  }

  // ---- Progress card ----
  const createdCount = (unternehmenId ? 1 : 0) + (terminCreated ? 1 : 0) + (dokumentCreated ? 1 : 0);

  function ProgressCard() {
    if (!name) return null;
    return (
      <div className="rounded-2xl border bg-card overflow-hidden p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <IconBuilding size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{name}</p>
            {investiertesKapital && (
              <p className="text-xs text-muted-foreground">
                {parseFloat(investiertesKapital).toLocaleString('de-DE')} € investiert
              </p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">Erstellt</p>
          <p className="text-sm font-semibold">{createdCount} Einträge</p>
        </div>
      </div>
    );
  }

  // ---- Render ----
  return (
    <IntentWizardShell
      title="Unternehmen onboarden"
      subtitle="Neues Portfoliounternehmen Schritt für Schritt aufnehmen"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
    >
      {/* ===== STEP 1: STAMMDATEN ===== */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card overflow-hidden p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconBuilding size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Stammdaten</h2>
                <p className="text-sm text-muted-foreground">Grundlegende Informationen zum Unternehmen</p>
              </div>
            </div>

            {/* Pflichtfelder */}
            <div className="space-y-1">
              <Label htmlFor="name">Unternehmensname *</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="z. B. MusterTech GmbH"
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="rechtsform">Rechtsform</Label>
                <Select value={rechtsform} onValueChange={setRechtsform}>
                  <SelectTrigger id="rechtsform" className="w-full">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {rechtsformOptions.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="branche">Branche</Label>
                <Select value={branche} onValueChange={setBranche}>
                  <SelectTrigger id="branche" className="w-full">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {brancheOptions.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status radio-style tiles */}
            <div className="space-y-1">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map(o => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setStatus(o.key)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      status === o.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Finanzdaten */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="beteiligungsquote">Beteiligung (%)</Label>
                <Input
                  id="beteiligungsquote"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={beteiligungsquote}
                  onChange={e => setBeteiligungsquote(e.target.value)}
                  placeholder="0,00"
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="investiertesKapital">Investiertes Kapital (€)</Label>
                <Input
                  id="investiertesKapital"
                  type="number"
                  min="0"
                  step="1"
                  value={investiertesKapital}
                  onChange={e => setInvestiertesKapital(e.target.value)}
                  placeholder="0"
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="investitionsdatum">Investitionsdatum</Label>
                <Input
                  id="investitionsdatum"
                  type="date"
                  value={investitionsdatum}
                  onChange={e => setInvestitionsdatum(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            {/* Standort */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="stadt">Stadt</Label>
                <Input
                  id="stadt"
                  value={stadt}
                  onChange={e => setStadt(e.target.value)}
                  placeholder="z. B. München"
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="land">Land</Label>
                <Input
                  id="land"
                  value={land}
                  onChange={e => setLand(e.target.value)}
                  placeholder="z. B. Deutschland"
                  className="w-full"
                />
              </div>
            </div>

            {/* Ansprechpartner */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-3">Ansprechpartner</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="apVorname">Vorname</Label>
                  <Input
                    id="apVorname"
                    value={apVorname}
                    onChange={e => setApVorname(e.target.value)}
                    placeholder="Vorname"
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="apNachname">Nachname</Label>
                  <Input
                    id="apNachname"
                    value={apNachname}
                    onChange={e => setApNachname(e.target.value)}
                    placeholder="Nachname"
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="apEmail">E-Mail</Label>
                  <Input
                    id="apEmail"
                    type="email"
                    value={apEmail}
                    onChange={e => setApEmail(e.target.value)}
                    placeholder="email@beispiel.de"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {saveError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {saveError}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleStammdatenWeiter}
              disabled={!name.trim() || saving}
              className="gap-2"
            >
              {saving ? 'Wird gespeichert…' : 'Weiter zu Ersttermin'}
              {!saving && <IconArrowRight size={16} stroke={2} />}
            </Button>
          </div>
        </div>
      )}

      {/* ===== STEP 2: ERSTTERMIN ===== */}
      {step === 2 && (
        <div className="space-y-6">
          <ProgressCard />

          <div className="rounded-2xl border bg-card overflow-hidden p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconCalendarEvent size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Ersttermin</h2>
                <p className="text-sm text-muted-foreground">
                  Erstes Meeting mit <span className="font-medium text-foreground">{name}</span> anlegen (optional)
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="terminbezeichnung">Terminbezeichnung</Label>
              <Input
                id="terminbezeichnung"
                value={terminbezeichnung}
                onChange={e => setTerminbezeichnung(e.target.value)}
                placeholder="z. B. Erstgespräch"
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="terminart">Terminart</Label>
                <Select value={terminart} onValueChange={setTerminart}>
                  <SelectTrigger id="terminart" className="w-full">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {terminartOptions.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="datumUhrzeit">Datum & Uhrzeit</Label>
                <Input
                  id="datumUhrzeit"
                  type="datetime-local"
                  value={datumUhrzeit}
                  onChange={e => setDatumUhrzeit(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ort">Ort</Label>
              <Input
                id="ort"
                value={ort}
                onChange={e => setOrt(e.target.value)}
                placeholder="z. B. Büro oder Online"
                className="w-full"
              />
            </div>

            {/* Terminstatus radio-style tiles */}
            <div className="space-y-1">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-2">
                {terminstatusOptions.map(o => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setTerminstatus(o.key)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      terminstatus === o.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {saveError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {saveError}
            </div>
          )}

          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={handleTerminSkip} disabled={saving}>
              Überspringen
            </Button>
            <Button
              onClick={handleTerminWeiter}
              disabled={saving || !datumUhrzeit || !terminbezeichnung.trim()}
              className="gap-2"
            >
              {saving ? 'Wird gespeichert…' : 'Termin anlegen & weiter'}
              {!saving && <IconArrowRight size={16} stroke={2} />}
            </Button>
          </div>
        </div>
      )}

      {/* ===== STEP 3: ERSTDOKUMENT ===== */}
      {step === 3 && (
        <div className="space-y-6">
          <ProgressCard />

          <div className="rounded-2xl border bg-card overflow-hidden p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconFile size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Erstdokument</h2>
                <p className="text-sm text-muted-foreground">
                  Erstes Dokument zu <span className="font-medium text-foreground">{name}</span> erfassen (optional)
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dokumentenbezeichnung">Dokumentenbezeichnung</Label>
              <Input
                id="dokumentenbezeichnung"
                value={dokumentenbezeichnung}
                onChange={e => setDokumentenbezeichnung(e.target.value)}
                placeholder="z. B. Beteiligungsvertrag"
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="dokumententyp">Dokumententyp</Label>
                <Select value={dokumententyp} onValueChange={setDokumententyp}>
                  <SelectTrigger id="dokumententyp" className="w-full">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {dokumententypOptions.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="dokumentendatum">Dokumentendatum</Label>
                <Input
                  id="dokumentendatum"
                  type="date"
                  value={dokumentendatum}
                  onChange={e => setDokumentendatum(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dokumentenlink">Link zum Dokument</Label>
              <Input
                id="dokumentenlink"
                type="url"
                value={dokumentenlink}
                onChange={e => setDokumentenlink(e.target.value)}
                placeholder="https://…"
                className="w-full"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="bereitgestelltVon">Bereitgestellt von</Label>
              <Input
                id="bereitgestelltVon"
                value={bereitgestelltVon}
                onChange={e => setBereitgestelltVon(e.target.value)}
                placeholder="z. B. Rechtsabteilung"
                className="w-full"
              />
            </div>
          </div>

          {saveError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {saveError}
            </div>
          )}

          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={handleDokumentSkip} disabled={saving}>
              Überspringen
            </Button>
            <Button
              onClick={handleDokumentWeiter}
              disabled={saving || !dokumentenbezeichnung.trim()}
              className="gap-2"
            >
              {saving ? 'Wird gespeichert…' : 'Dokument anlegen & weiter'}
              {!saving && <IconArrowRight size={16} stroke={2} />}
            </Button>
          </div>
        </div>
      )}

      {/* ===== STEP 4: ABSCHLUSS ===== */}
      {step === 4 && (
        <div className="space-y-6">
          {/* Erfolgskarte */}
          <div className="rounded-2xl border bg-card overflow-hidden p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                <IconCheck size={18} className="text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Onboarding abgeschlossen</h2>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{name}</span> wurde erfolgreich aufgenommen.
                </p>
              </div>
            </div>

            {/* Zusammenfassung */}
            <div className="rounded-xl border bg-secondary/30 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zusammenfassung</p>

              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <IconBuilding size={15} className="text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{name}</span>
                </div>
                <StatusBadge statusKey={status} label={statusOptions.find(o => o.key === status)?.label ?? status} />
              </div>

              {investiertesKapital && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Investiertes Kapital</span>
                  <span className="font-medium">{parseFloat(investiertesKapital).toLocaleString('de-DE')} €</span>
                </div>
              )}

              {beteiligungsquote && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Beteiligung</span>
                  <span className="font-medium">{beteiligungsquote} %</span>
                </div>
              )}

              {(apVorname || apNachname) && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Ansprechpartner</span>
                  <span className="font-medium truncate">{[apVorname, apNachname].filter(Boolean).join(' ')}</span>
                </div>
              )}
            </div>

            {/* Checkliste */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Was wurde angelegt?</p>

              <ChecklistItem
                done={!!unternehmenId}
                label={`Unternehmen: ${name}`}
              />
              <ChecklistItem
                done={terminCreated}
                label={terminCreated ? `Termin: ${terminbezeichnung}` : 'Ersttermin (übersprungen)'}
              />
              <ChecklistItem
                done={dokumentCreated}
                label={dokumentCreated ? `Dokument: ${dokumentenbezeichnung}` : 'Erstdokument (übersprungen)'}
              />
            </div>
          </div>

          {/* Aktionsbuttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              className="gap-2 w-full sm:w-auto"
            >
              <IconRefresh size={16} stroke={2} />
              Weiteres Unternehmen onboarden
            </Button>
            <Button
              onClick={() => navigate('/')}
              className="gap-2 w-full sm:w-auto"
            >
              Zurück zum Dashboard
              <IconArrowRight size={16} stroke={2} />
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}

// ---- Helper component ----
function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <div className="w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
          <IconCheck size={12} className="text-green-600" stroke={2.5} />
        </div>
      ) : (
        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
          <IconCircle size={12} className="text-muted-foreground" stroke={1.5} />
        </div>
      )}
      <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}
