/**
 * Neue Beteiligung — 3-Schritt-Wizard.
 * Steps: 1) Unternehmen anlegen → 2) Ersttermin buchen → 3) Erstes Dokument erfassen (optional).
 * Reads: (keine Vorauswahl nötig — alle Daten werden neu erstellt).
 * Writes: unternehmen (createUnternehmenEntry), termine (createTermineEntry), dokumente (createDokumenteEntry).
 * Composes: IntentWizardShell.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconBuilding,
  IconCalendarEvent,
  IconFileText,
  IconCheck,
  IconChevronRight,
  IconAlertCircle,
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
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { useDashboardData } from '@/hooks/useDashboardData';

const RECHTSFORM_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['rechtsform'] ?? [];
const BRANCHE_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['branche'] ?? [];
const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];

export default function NeueBeteiligungPage() {
  const { loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);

  // Step 1: Unternehmen
  const [name, setName] = useState('');
  const [rechtsform, setRechtsform] = useState('');
  const [branche, setBranche] = useState('');
  const [investiertesKapital, setInvestiertesKapital] = useState('');
  const [investitionsdatum, setInvestitionsdatum] = useState('');
  const [stadt, setStadt] = useState('');
  const [website, setWebsite] = useState('');
  const [ansprechpartnerVorname, setAnsprechpartnerVorname] = useState('');
  const [ansprechpartnerNachname, setAnsprechpartnerNachname] = useState('');
  const [ansprechpartnerEmail, setAnsprechpartnerEmail] = useState('');
  const [step1Saving, setStep1Saving] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [newUnternehmenId, setNewUnternehmenId] = useState<string | null>(null);
  const [newUnternehmenName, setNewUnternehmenName] = useState('');

  // Step 2: Termin
  const [terminbezeichnung, setTerminbezeichnung] = useState('Erstgespräch');
  const [terminart, setTerminart] = useState('strategiemeeting');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [terminstatus, setTerminstatus] = useState('geplant');
  const [notizenTermin, setNotizenTermin] = useState('');
  const [step2Saving, setStep2Saving] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [newTerminId, setNewTerminId] = useState<string | null>(null);
  const [newTerminDatum, setNewTerminDatum] = useState('');

  // Step 3: Dokument
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententyp, setDokumententyp] = useState('');
  const [dokumentendatum, setDokumentendatum] = useState('');
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [bereitgestelltVon, setBereitgestelltVon] = useState('');
  const [dokumentenbeschreibung, setDokumentenbeschreibung] = useState('');
  const [step3Saving, setStep3Saving] = useState(false);
  const [step3Error, setStep3Error] = useState<string | null>(null);
  const [newDokumentName, setNewDokumentName] = useState<string | null>(null);
  const [dokumentSkipped, setDokumentSkipped] = useState(false);

  const handleStep1Submit = async () => {
    if (!name.trim()) return;
    if (newUnternehmenId) {
      setStep(2);
      return;
    }
    setStep1Saving(true);
    setStep1Error(null);
    try {
      const fields: Record<string, unknown> = { name: name.trim(), status: 'aktiv' };
      if (rechtsform && rechtsform !== 'none') fields.rechtsform = rechtsform;
      if (branche && branche !== 'none') fields.branche = branche;
      if (investiertesKapital) fields.investiertes_kapital = parseFloat(investiertesKapital);
      if (investitionsdatum) fields.investitionsdatum = investitionsdatum;
      if (stadt.trim()) fields.stadt = stadt.trim();
      if (website.trim()) fields.website = website.trim();
      if (ansprechpartnerVorname.trim()) fields.ansprechpartner_vorname = ansprechpartnerVorname.trim();
      if (ansprechpartnerNachname.trim()) fields.ansprechpartner_nachname = ansprechpartnerNachname.trim();
      if (ansprechpartnerEmail.trim()) fields.ansprechpartner_email = ansprechpartnerEmail.trim();

      const result = await LivingAppsService.createUnternehmenEntry(fields);
      await fetchAll();
      setNewUnternehmenId(result.record_id);
      setNewUnternehmenName(name.trim());
      setStep(2);
    } catch (err) {
      setStep1Error(err instanceof Error ? err.message : 'Fehler beim Anlegen des Unternehmens.');
    } finally {
      setStep1Saving(false);
    }
  };

  const handleStep2Submit = async () => {
    if (!newUnternehmenId || !terminbezeichnung.trim() || !datumUhrzeit) return;
    if (newTerminId) {
      setStep(3);
      return;
    }
    setStep2Saving(true);
    setStep2Error(null);
    try {
      const fields: Record<string, unknown> = {
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, newUnternehmenId),
        terminbezeichnung: terminbezeichnung.trim(),
        terminart: terminart !== 'none' ? terminart : undefined,
        datum_uhrzeit: datumUhrzeit,
        terminstatus: terminstatus !== 'none' ? terminstatus : undefined,
      };
      if (ort.trim()) fields.ort = ort.trim();
      if (notizenTermin.trim()) fields.notizen_termin = notizenTermin.trim();

      const result = await LivingAppsService.createTermineEntry(fields);
      await fetchAll();
      setNewTerminId(result.record_id);
      setNewTerminDatum(datumUhrzeit);
      setStep(3);
    } catch (err) {
      setStep2Error(err instanceof Error ? err.message : 'Fehler beim Buchen des Termins.');
    } finally {
      setStep2Saving(false);
    }
  };

  const handleStep3Submit = async () => {
    if (!newUnternehmenId || !dokumentenbezeichnung.trim()) return;
    setStep3Saving(true);
    setStep3Error(null);
    try {
      const fields: Record<string, unknown> = {
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, newUnternehmenId),
        dokumentenbezeichnung: dokumentenbezeichnung.trim(),
      };
      if (dokumententyp && dokumententyp !== 'none') fields.dokumententyp = dokumententyp;
      if (dokumentendatum) fields.dokumentendatum = dokumentendatum;
      if (dokumentenlink.trim()) fields.dokumentenlink = dokumentenlink.trim();
      if (bereitgestelltVon.trim()) fields.bereitgestellt_von = bereitgestelltVon.trim();
      if (dokumentenbeschreibung.trim()) fields.dokumentenbeschreibung = dokumentenbeschreibung.trim();

      await LivingAppsService.createDokumenteEntry(fields);
      await fetchAll();
      setNewDokumentName(dokumentenbezeichnung.trim());
      setStep(4);
    } catch (err) {
      setStep3Error(err instanceof Error ? err.message : 'Fehler beim Erfassen des Dokuments.');
    } finally {
      setStep3Saving(false);
    }
  };

  const handleSkipStep3 = () => {
    setDokumentSkipped(true);
    setStep(4);
  };

  const handleReset = () => {
    setStep(1);
    setName('');
    setRechtsform('');
    setBranche('');
    setInvestiertesKapital('');
    setInvestitionsdatum('');
    setStadt('');
    setWebsite('');
    setAnsprechpartnerVorname('');
    setAnsprechpartnerNachname('');
    setAnsprechpartnerEmail('');
    setStep1Error(null);
    setNewUnternehmenId(null);
    setNewUnternehmenName('');
    setTerminbezeichnung('Erstgespräch');
    setTerminart('strategiemeeting');
    setDatumUhrzeit('');
    setOrt('');
    setTerminstatus('geplant');
    setNotizenTermin('');
    setStep2Error(null);
    setNewTerminId(null);
    setNewTerminDatum('');
    setDokumentenbezeichnung('');
    setDokumententyp('');
    setDokumentendatum('');
    setDokumentenlink('');
    setBereitgestelltVon('');
    setDokumentenbeschreibung('');
    setStep3Error(null);
    setNewDokumentName(null);
    setDokumentSkipped(false);
  };

  const formatTerminDatum = (raw: string) => {
    if (!raw) return '—';
    try {
      const [datePart, timePart] = raw.split('T');
      if (timePart) {
        return `${datePart} um ${timePart} Uhr`;
      }
      return datePart;
    } catch {
      return raw;
    }
  };

  const brancheLabel = BRANCHE_OPTIONS.find(o => o.key === branche)?.label ?? branche;
  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <IntentWizardShell
      title="Neue Beteiligung aufnehmen"
      subtitle="Unternehmen anlegen, Ersttermin buchen und erstes Dokument erfassen"
      steps={[
        { label: 'Unternehmen' },
        { label: 'Ersttermin' },
        { label: 'Dokument' },
        { label: 'Fertig' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Unternehmen anlegen ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2">
              <IconBuilding size={22} className="text-primary" stroke={1.5} />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Unternehmen anlegen</h2>
              <p className="text-sm text-muted-foreground">Grunddaten des Portfoliounternehmens erfassen</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unternehmensdaten</p>

            <div className="space-y-2">
              <Label htmlFor="u-name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="u-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="z. B. TechVision GmbH"
                disabled={!!newUnternehmenId}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="u-rechtsform">Rechtsform</Label>
                <Select value={rechtsform || 'none'} onValueChange={v => setRechtsform(v === 'none' ? '' : v)} disabled={!!newUnternehmenId}>
                  <SelectTrigger id="u-rechtsform">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nicht angegeben</SelectItem>
                    {RECHTSFORM_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="u-branche">Branche</Label>
                <Select value={branche || 'none'} onValueChange={v => setBranche(v === 'none' ? '' : v)} disabled={!!newUnternehmenId}>
                  <SelectTrigger id="u-branche">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nicht angegeben</SelectItem>
                    {BRANCHE_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="u-kapital">Investiertes Kapital (€)</Label>
                <Input
                  id="u-kapital"
                  type="number"
                  min="0"
                  step="1000"
                  value={investiertesKapital}
                  onChange={e => setInvestiertesKapital(e.target.value)}
                  placeholder="z. B. 500000"
                  disabled={!!newUnternehmenId}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="u-datum">Investitionsdatum</Label>
                <Input
                  id="u-datum"
                  type="date"
                  value={investitionsdatum}
                  max={today}
                  onChange={e => setInvestitionsdatum(e.target.value)}
                  disabled={!!newUnternehmenId}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="u-stadt">Stadt</Label>
                <Input
                  id="u-stadt"
                  value={stadt}
                  onChange={e => setStadt(e.target.value)}
                  placeholder="z. B. Berlin"
                  disabled={!!newUnternehmenId}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="u-website">Website</Label>
                <Input
                  id="u-website"
                  type="url"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="https://..."
                  disabled={!!newUnternehmenId}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ansprechpartner (optional)</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="u-vorname">Vorname</Label>
                <Input
                  id="u-vorname"
                  value={ansprechpartnerVorname}
                  onChange={e => setAnsprechpartnerVorname(e.target.value)}
                  placeholder="Vorname"
                  disabled={!!newUnternehmenId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-nachname">Nachname</Label>
                <Input
                  id="u-nachname"
                  value={ansprechpartnerNachname}
                  onChange={e => setAnsprechpartnerNachname(e.target.value)}
                  placeholder="Nachname"
                  disabled={!!newUnternehmenId}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-email">E-Mail</Label>
              <Input
                id="u-email"
                type="email"
                value={ansprechpartnerEmail}
                onChange={e => setAnsprechpartnerEmail(e.target.value)}
                placeholder="kontakt@unternehmen.de"
                disabled={!!newUnternehmenId}
              />
            </div>
          </div>

          {step1Error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <IconAlertCircle size={16} stroke={1.5} />
              {step1Error}
            </div>
          )}

          {newUnternehmenId && (
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <IconCheck size={16} stroke={2} />
              Unternehmen <strong className="mx-1">{newUnternehmenName}</strong> erfolgreich angelegt.
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleStep1Submit}
              disabled={!name.trim() || step1Saving}
              className="gap-2"
            >
              {step1Saving ? 'Wird angelegt…' : newUnternehmenId ? 'Weiter zu Ersttermin' : 'Unternehmen anlegen'}
              <IconChevronRight size={16} stroke={2} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Ersttermin buchen ── */}
      {step === 2 && (
        newUnternehmenId ? (
          <div className="space-y-6">
            {/* Live summary card */}
            <div className="rounded-2xl border bg-secondary/40 px-4 py-3 flex flex-wrap gap-4 items-center text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <IconBuilding size={16} className="text-primary shrink-0" stroke={1.5} />
                <span className="font-medium truncate">{newUnternehmenName}</span>
              </div>
              {brancheLabel && (
                <span className="text-muted-foreground truncate">{brancheLabel}</span>
              )}
              {investiertesKapital && (
                <span className="text-muted-foreground">
                  {parseFloat(investiertesKapital).toLocaleString('de-DE')} €
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2">
                <IconCalendarEvent size={22} className="text-primary" stroke={1.5} />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Ersttermin buchen</h2>
                <p className="text-sm text-muted-foreground">Ersten Termin für <strong>{newUnternehmenName}</strong> erfassen</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="t-bezeichnung">Terminbezeichnung <span className="text-destructive">*</span></Label>
                <Input
                  id="t-bezeichnung"
                  value={terminbezeichnung}
                  onChange={e => setTerminbezeichnung(e.target.value)}
                  placeholder="z. B. Erstgespräch"
                  disabled={!!newTerminId}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="t-art">Terminart <span className="text-destructive">*</span></Label>
                  <Select value={terminart} onValueChange={setTerminart} disabled={!!newTerminId}>
                    <SelectTrigger id="t-art">
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMINART_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="t-status">Status</Label>
                  <Select value={terminstatus} onValueChange={setTerminstatus} disabled={!!newTerminId}>
                    <SelectTrigger id="t-status">
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMINSTATUS_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="t-datum">Datum & Uhrzeit <span className="text-destructive">*</span></Label>
                <Input
                  id="t-datum"
                  type="datetime-local"
                  value={datumUhrzeit}
                  onChange={e => setDatumUhrzeit(e.target.value)}
                  disabled={!!newTerminId}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="t-ort">Ort</Label>
                <Input
                  id="t-ort"
                  value={ort}
                  onChange={e => setOrt(e.target.value)}
                  placeholder="z. B. Büro Berlin oder Online"
                  disabled={!!newTerminId}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="t-notizen">Notizen zum Termin</Label>
                <Textarea
                  id="t-notizen"
                  value={notizenTermin}
                  onChange={e => setNotizenTermin(e.target.value)}
                  placeholder="Themen, Vorbereitung, Teilnehmer…"
                  rows={3}
                  disabled={!!newTerminId}
                />
              </div>
            </div>

            {step2Error && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <IconAlertCircle size={16} stroke={1.5} />
                {step2Error}
              </div>
            )}

            {newTerminId && (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                <IconCheck size={16} stroke={2} />
                Termin <strong className="mx-1">{terminbezeichnung}</strong> erfolgreich gebucht.
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleStep2Submit}
                disabled={!terminbezeichnung.trim() || !datumUhrzeit || step2Saving}
                className="gap-2"
              >
                {step2Saving ? 'Wird gespeichert…' : newTerminId ? 'Weiter zu Dokument' : 'Termin buchen'}
                <IconChevronRight size={16} stroke={2} />
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Daten aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Step 3: Erstes Dokument erfassen ── */}
      {step === 3 && (
        newUnternehmenId ? (
          <div className="space-y-6">
            {/* Live summary card */}
            <div className="rounded-2xl border bg-secondary/40 px-4 py-3 flex flex-wrap gap-4 items-center text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <IconBuilding size={16} className="text-primary shrink-0" stroke={1.5} />
                <span className="font-medium truncate">{newUnternehmenName}</span>
              </div>
              {newTerminDatum && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <IconCalendarEvent size={14} stroke={1.5} />
                  <span>{formatTerminDatum(newTerminDatum)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2">
                <IconFileText size={22} className="text-primary" stroke={1.5} />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Erstes Dokument erfassen</h2>
                <p className="text-sm text-muted-foreground">Optional — du kannst diesen Schritt überspringen</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="d-bezeichnung">Dokumentenbezeichnung <span className="text-destructive">*</span></Label>
                <Input
                  id="d-bezeichnung"
                  value={dokumentenbezeichnung}
                  onChange={e => setDokumentenbezeichnung(e.target.value)}
                  placeholder="z. B. Beteiligungsvertrag 2026"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="d-typ">Dokumententyp</Label>
                  <Select value={dokumententyp || 'none'} onValueChange={v => setDokumententyp(v === 'none' ? '' : v)}>
                    <SelectTrigger id="d-typ">
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nicht angegeben</SelectItem>
                      {DOKUMENTENTYP_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="d-datum">Dokumentendatum</Label>
                  <Input
                    id="d-datum"
                    type="date"
                    value={dokumentendatum}
                    onChange={e => setDokumentendatum(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="d-link">Dokumentenlink (URL)</Label>
                <Input
                  id="d-link"
                  type="url"
                  value={dokumentenlink}
                  onChange={e => setDokumentenlink(e.target.value)}
                  placeholder="https://drive.google.com/..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="d-von">Bereitgestellt von</Label>
                <Input
                  id="d-von"
                  value={bereitgestelltVon}
                  onChange={e => setBereitgestelltVon(e.target.value)}
                  placeholder="z. B. Rechtsanwalt Müller"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="d-beschreibung">Beschreibung</Label>
                <Textarea
                  id="d-beschreibung"
                  value={dokumentenbeschreibung}
                  onChange={e => setDokumentenbeschreibung(e.target.value)}
                  placeholder="Kurze Beschreibung des Dokuments…"
                  rows={3}
                />
              </div>
            </div>

            {step3Error && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <IconAlertCircle size={16} stroke={1.5} />
                {step3Error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <Button variant="outline" onClick={handleSkipStep3} disabled={step3Saving}>
                Schritt überspringen
              </Button>
              <Button
                onClick={handleStep3Submit}
                disabled={!dokumentenbezeichnung.trim() || step3Saving}
                className="gap-2"
              >
                {step3Saving ? 'Wird gespeichert…' : 'Dokument erfassen'}
                <IconChevronRight size={16} stroke={2} />
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Daten aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Step 4: Erfolg ── */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="text-center py-4">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <IconCheck size={28} className="text-green-600" stroke={2.5} />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Beteiligung erfolgreich aufgenommen!</h2>
            <p className="mt-1 text-sm text-muted-foreground">Alle Daten wurden gespeichert.</p>
          </div>

          <div className="rounded-2xl border bg-card divide-y overflow-hidden">
            <div className="flex items-start gap-3 px-4 py-3">
              <IconBuilding size={18} className="text-primary mt-0.5 shrink-0" stroke={1.5} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Unternehmen</p>
                <p className="font-medium truncate">{newUnternehmenName || name}</p>
                {brancheLabel && (
                  <p className="text-sm text-muted-foreground">{brancheLabel}</p>
                )}
                {investiertesKapital && (
                  <p className="text-sm text-muted-foreground">
                    {parseFloat(investiertesKapital).toLocaleString('de-DE')} € investiert
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 px-4 py-3">
              <IconCalendarEvent size={18} className="text-primary mt-0.5 shrink-0" stroke={1.5} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Ersttermin</p>
                <p className="font-medium truncate">{terminbezeichnung}</p>
                {newTerminDatum && (
                  <p className="text-sm text-muted-foreground">{formatTerminDatum(newTerminDatum)}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 px-4 py-3">
              <IconFileText size={18} className="text-primary mt-0.5 shrink-0" stroke={1.5} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Dokument</p>
                {newDokumentName ? (
                  <p className="font-medium truncate">{newDokumentName}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">{dokumentSkipped ? 'Übersprungen' : '—'}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <IconBuilding size={16} stroke={1.5} />
              Neue Beteiligung aufnehmen
            </Button>
            <Button asChild>
              <a href="#/">Zurück zum Dashboard</a>
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
