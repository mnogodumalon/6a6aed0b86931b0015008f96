/**
 * Neuaufnahme — 4-Schritt-Wizard zum vollständigen Anlegen eines Portfoliounternehmens.
 * Steps: 1) Stammdaten erfassen → 2) Ersten Termin anlegen (optional) →
 *        3) Erstes Dokument hochladen (optional) → 4) Einstiegsnotiz verfassen (optional) → Abschluss.
 * Reads: keine (reine Neuanlage).
 * Writes: unternehmen (createUnternehmenEntry), termine (createTermineEntry),
 *         dokumente (createDokumenteEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconBuildingFactory2,
  IconCalendarPlus,
  IconFileText,
  IconNotes,
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
  IconPlayerSkipForward,
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

export default function NeuaufnahmePage() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Schritt 1 — Stammdaten
  const [name, setName] = useState('');
  const [rechtsformKey, setRechtsformKey] = useState('');
  const [brancheKey, setBrancheKey] = useState('');
  const [statusKey, setStatusKey] = useState(STATUS_OPTIONS[0]?.key ?? 'aktiv');
  const [investiertesKapital, setInvestiertesKapital] = useState('');
  const [investitionsdatum, setInvestitionsdatum] = useState('');
  const [stadt, setStadt] = useState('');
  const [ansprechpartnerVorname, setAnsprechpartnerVorname] = useState('');
  const [ansprechpartnerNachname, setAnsprechpartnerNachname] = useState('');
  const [ansprechpartnerEmail, setAnsprechpartnerEmail] = useState('');

  // Ergebnis-IDs
  const [unternehmenId, setUnternehmenId] = useState<string | null>(null);
  const [terminErstellt, setTerminErstellt] = useState(false);
  const [dokumentErstellt, setDokumentErstellt] = useState(false);
  const [notizErstellt, setNotizErstellt] = useState(false);

  // Schritt 2 — Erster Termin
  const [terminbezeichnung, setTerminbezeichnung] = useState('');
  const [terminartKey, setTerminartKey] = useState('');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [terminOrt, setTerminOrt] = useState('');
  const [terminstatusKey, setTerminstatusKey] = useState(TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant');

  // Schritt 3 — Erstes Dokument
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententypKey, setDokumententypKey] = useState('');
  const [dokumentendatum, setDokumentendatum] = useState('');
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [bereitgestelltVon, setBereitgestelltVon] = useState('');

  // Schritt 4 — Einstiegsnotiz
  const [notizTitel, setNotizTitel] = useState('');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kategorieKey, setKategorieKey] = useState(KATEGORIE_OPTIONS[0]?.key ?? 'allgemein');
  const [prioritaetKey, setPrioritaetKey] = useState(
    PRIORITAET_OPTIONS.find((o) => o.key === 'mittel')?.key ?? PRIORITAET_OPTIONS[0]?.key ?? 'mittel'
  );

  // Schritt 1: Unternehmen anlegen
  const handleCreateUnternehmen = async () => {
    if (!name) return;
    setSaving(true);
    setSaveError(null);
    try {
      let pid = unternehmenId;
      if (!pid) {
        const payload: Record<string, unknown> = { name, status: statusKey };
        if (rechtsformKey && rechtsformKey !== 'none') payload.rechtsform = rechtsformKey;
        if (brancheKey && brancheKey !== 'none') payload.branche = brancheKey;
        if (investiertesKapital) payload.investiertes_kapital = parseFloat(investiertesKapital);
        if (investitionsdatum) payload.investitionsdatum = investitionsdatum;
        if (stadt) payload.stadt = stadt;
        if (ansprechpartnerVorname) payload.ansprechpartner_vorname = ansprechpartnerVorname;
        if (ansprechpartnerNachname) payload.ansprechpartner_nachname = ansprechpartnerNachname;
        if (ansprechpartnerEmail) payload.ansprechpartner_email = ansprechpartnerEmail;

        const result = await LivingAppsService.createUnternehmenEntry(payload as Parameters<typeof LivingAppsService.createUnternehmenEntry>[0]);
        pid = result.record_id;
        setUnternehmenId(pid);
      }
      setStep(2);
    } catch (e) {
      setSaveError('Fehler beim Anlegen des Unternehmens. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  };

  // Schritt 2: Termin anlegen
  const handleCreateTermin = async () => {
    if (!unternehmenId || !terminbezeichnung || !terminartKey || terminartKey === 'none' || !datumUhrzeit) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        terminbezeichnung,
        terminart: terminartKey,
        datum_uhrzeit: datumUhrzeit,
        terminstatus: terminstatusKey,
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
      };
      if (terminOrt) payload.ort = terminOrt;
      await LivingAppsService.createTermineEntry(payload as Parameters<typeof LivingAppsService.createTermineEntry>[0]);
      setTerminErstellt(true);
      setStep(3);
    } catch (e) {
      setSaveError('Fehler beim Anlegen des Termins. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  };

  // Schritt 3: Dokument anlegen
  const handleCreateDokument = async () => {
    if (!unternehmenId || !dokumentenbezeichnung) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        dokumentenbezeichnung,
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
      };
      if (dokumententypKey && dokumententypKey !== 'none') payload.dokumententyp = dokumententypKey;
      if (dokumentendatum) payload.dokumentendatum = dokumentendatum;
      if (dokumentenlink) payload.dokumentenlink = dokumentenlink;
      if (bereitgestelltVon) payload.bereitgestellt_von = bereitgestelltVon;
      await LivingAppsService.createDokumenteEntry(payload as Parameters<typeof LivingAppsService.createDokumenteEntry>[0]);
      setDokumentErstellt(true);
      setStep(4);
    } catch (e) {
      setSaveError('Fehler beim Anlegen des Dokuments. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  };

  // Schritt 4: Notiz anlegen
  const handleCreateNotiz = async () => {
    if (!unternehmenId || !notizTitel || !notizInhalt || !notizDatum) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        notiz_titel: notizTitel,
        notiz_inhalt: notizInhalt,
        notiz_datum: notizDatum,
        kategorie: kategorieKey,
        prioritaet: prioritaetKey,
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
      };
      await LivingAppsService.createNotizenEntry(payload as Parameters<typeof LivingAppsService.createNotizenEntry>[0]);
      setNotizErstellt(true);
      setStep(5);
    } catch (e) {
      setSaveError('Fehler beim Anlegen der Notiz. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setName('');
    setRechtsformKey('');
    setBrancheKey('');
    setStatusKey(STATUS_OPTIONS[0]?.key ?? 'aktiv');
    setInvestiertesKapital('');
    setInvestitionsdatum('');
    setStadt('');
    setAnsprechpartnerVorname('');
    setAnsprechpartnerNachname('');
    setAnsprechpartnerEmail('');
    setUnternehmenId(null);
    setTerminErstellt(false);
    setDokumentErstellt(false);
    setNotizErstellt(false);
    setTerminbezeichnung('');
    setTerminartKey('');
    setDatumUhrzeit('');
    setTerminOrt('');
    setTerminstatusKey(TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant');
    setDokumentenbezeichnung('');
    setDokumententypKey('');
    setDokumentendatum('');
    setDokumentenlink('');
    setBereitgestelltVon('');
    setNotizTitel('');
    setNotizInhalt('');
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    setKategorieKey(KATEGORIE_OPTIONS[0]?.key ?? 'allgemein');
    setPrioritaetKey(PRIORITAET_OPTIONS.find((o) => o.key === 'mittel')?.key ?? PRIORITAET_OPTIONS[0]?.key ?? 'mittel');
    setSaveError(null);
  };

  const erstellteEintraege = [
    terminErstellt && 'Termin',
    dokumentErstellt && 'Dokument',
    notizErstellt && 'Notiz',
  ].filter(Boolean) as string[];

  return (
    <IntentWizardShell
      title="Neuaufnahme"
      subtitle="Neues Portfoliounternehmen vollständig aufnehmen"
      steps={[
        { label: 'Stammdaten' },
        { label: 'Termin' },
        { label: 'Dokument' },
        { label: 'Notiz' },
        { label: 'Abschluss' },
      ]}
      currentStep={step}
      onStepChange={setStep}
    >
      {/* Schritt 1: Stammdaten */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2">
              <IconBuildingFactory2 size={24} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Stammdaten erfassen</h2>
              <p className="text-sm text-muted-foreground">Grundinformationen zum Portfoliounternehmen</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4 overflow-hidden">
            <p className="text-sm font-medium text-foreground">Pflichtfelder</p>

            <div className="space-y-2">
              <Label htmlFor="name">Unternehmensname *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Muster GmbH"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rechtsform</Label>
                <Select value={rechtsformKey} onValueChange={setRechtsformKey}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Rechtsform wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Angabe</SelectItem>
                    {RECHTSFORM_OPTIONS.map((o) => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Branche</Label>
                <Select value={brancheKey} onValueChange={setBrancheKey}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Branche wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Angabe</SelectItem>
                    {BRANCHE_OPTIONS.map((o) => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status *</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setStatusKey(o.key)}
                    className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                      statusKey === o.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:bg-secondary'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4 overflow-hidden">
            <p className="text-sm font-medium text-foreground">Investitionsdaten</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kapital">Investiertes Kapital (€)</Label>
                <Input
                  id="kapital"
                  type="number"
                  min="0"
                  step="1000"
                  value={investiertesKapital}
                  onChange={(e) => setInvestiertesKapital(e.target.value)}
                  placeholder="z. B. 500000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="investitionsdatum">Investitionsdatum</Label>
                <Input
                  id="investitionsdatum"
                  type="date"
                  value={investitionsdatum}
                  onChange={(e) => setInvestitionsdatum(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stadt">Stadt</Label>
              <Input
                id="stadt"
                value={stadt}
                onChange={(e) => setStadt(e.target.value)}
                placeholder="z. B. Berlin"
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4 overflow-hidden">
            <p className="text-sm font-medium text-foreground">Ansprechpartner</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vorname">Vorname</Label>
                <Input
                  id="vorname"
                  value={ansprechpartnerVorname}
                  onChange={(e) => setAnsprechpartnerVorname(e.target.value)}
                  placeholder="Vorname"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nachname">Nachname</Label>
                <Input
                  id="nachname"
                  value={ansprechpartnerNachname}
                  onChange={(e) => setAnsprechpartnerNachname(e.target.value)}
                  placeholder="Nachname"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                type="email"
                value={ansprechpartnerEmail}
                onChange={(e) => setAnsprechpartnerEmail(e.target.value)}
                placeholder="kontakt@beispiel.de"
              />
            </div>
          </div>

          {saveError && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {saveError}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!name || saving}
            onClick={handleCreateUnternehmen}
          >
            {saving ? 'Wird angelegt …' : (
              <>
                Unternehmen anlegen & weiter
                <IconArrowRight size={16} className="ml-2" />
              </>
            )}
          </Button>
        </div>
      )}

      {/* Schritt 2: Erster Termin */}
      {step === 2 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2">
                <IconCalendarPlus size={24} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Ersten Termin anlegen</h2>
                <p className="text-sm text-muted-foreground">Optional — du kannst diesen Schritt überspringen</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4 overflow-hidden">
              <div className="space-y-2">
                <Label htmlFor="terminbezeichnung">Terminbezeichnung *</Label>
                <Input
                  id="terminbezeichnung"
                  value={terminbezeichnung}
                  onChange={(e) => setTerminbezeichnung(e.target.value)}
                  placeholder="z. B. Erstes Kennenlerngespräch"
                />
              </div>

              <div className="space-y-2">
                <Label>Terminart *</Label>
                <Select value={terminartKey} onValueChange={setTerminartKey}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Terminart wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bitte wählen</SelectItem>
                    {TERMINART_OPTIONS.map((o) => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="datumuhrzeit">Datum & Uhrzeit *</Label>
                  <Input
                    id="datumuhrzeit"
                    type="datetime-local"
                    value={datumUhrzeit}
                    onChange={(e) => setDatumUhrzeit(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terminort">Ort</Label>
                  <Input
                    id="terminort"
                    value={terminOrt}
                    onChange={(e) => setTerminOrt(e.target.value)}
                    placeholder="z. B. Büro Berlin"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2">
                  {TERMINSTATUS_OPTIONS.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setTerminstatusKey(o.key)}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                        terminstatusKey === o.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:bg-secondary'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {saveError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {saveError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="sm:flex-1"
                onClick={() => { setSaveError(null); setStep(1); }}
              >
                <IconArrowLeft size={16} className="mr-2" />
                Zurück
              </Button>
              <Button
                variant="outline"
                className="sm:flex-1"
                onClick={() => { setSaveError(null); setStep(3); }}
              >
                <IconPlayerSkipForward size={16} className="mr-2" />
                Überspringen
              </Button>
              <Button
                className="sm:flex-1"
                disabled={!terminbezeichnung || !terminartKey || terminartKey === 'none' || !datumUhrzeit || saving}
                onClick={handleCreateTermin}
              >
                {saving ? 'Wird angelegt …' : (
                  <>
                    Termin anlegen & weiter
                    <IconArrowRight size={16} className="ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht ein Unternehmen aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* Schritt 3: Erstes Dokument */}
      {step === 3 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2">
                <IconFileText size={24} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Erstes Dokument erfassen</h2>
                <p className="text-sm text-muted-foreground">Optional — du kannst diesen Schritt überspringen</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4 overflow-hidden">
              <div className="space-y-2">
                <Label htmlFor="dokumentenbezeichnung">Dokumentenbezeichnung *</Label>
                <Input
                  id="dokumentenbezeichnung"
                  value={dokumentenbezeichnung}
                  onChange={(e) => setDokumentenbezeichnung(e.target.value)}
                  placeholder="z. B. Beteiligungsvertrag 2026"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dokumententyp</Label>
                  <Select value={dokumententypKey} onValueChange={setDokumententypKey}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Typ wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keine Angabe</SelectItem>
                      {DOKUMENTENTYP_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dokumentendatum">Dokumentendatum</Label>
                  <Input
                    id="dokumentendatum"
                    type="date"
                    value={dokumentendatum}
                    onChange={(e) => setDokumentendatum(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dokumentenlink">Link zum Dokument</Label>
                <Input
                  id="dokumentenlink"
                  type="url"
                  value={dokumentenlink}
                  onChange={(e) => setDokumentenlink(e.target.value)}
                  placeholder="https://drive.example.com/…"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bereitgestelltvon">Bereitgestellt von</Label>
                <Input
                  id="bereitgestelltvon"
                  value={bereitgestelltVon}
                  onChange={(e) => setBereitgestelltVon(e.target.value)}
                  placeholder="z. B. Geschäftsführung"
                />
              </div>
            </div>

            {saveError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {saveError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="sm:flex-1"
                onClick={() => { setSaveError(null); setStep(2); }}
              >
                <IconArrowLeft size={16} className="mr-2" />
                Zurück
              </Button>
              <Button
                variant="outline"
                className="sm:flex-1"
                onClick={() => { setSaveError(null); setStep(4); }}
              >
                <IconPlayerSkipForward size={16} className="mr-2" />
                Überspringen
              </Button>
              <Button
                className="sm:flex-1"
                disabled={!dokumentenbezeichnung || saving}
                onClick={handleCreateDokument}
              >
                {saving ? 'Wird angelegt …' : (
                  <>
                    Dokument anlegen & weiter
                    <IconArrowRight size={16} className="ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht ein Unternehmen aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* Schritt 4: Einstiegsnotiz */}
      {step === 4 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2">
                <IconNotes size={24} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Einstiegsnotiz verfassen</h2>
                <p className="text-sm text-muted-foreground">Optional — du kannst diesen Schritt überspringen</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4 overflow-hidden">
              <div className="space-y-2">
                <Label htmlFor="notizTitel">Titel *</Label>
                <Input
                  id="notizTitel"
                  value={notizTitel}
                  onChange={(e) => setNotizTitel(e.target.value)}
                  placeholder="z. B. Erste Eindrücke nach dem Kick-off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notizInhalt">Inhalt *</Label>
                <Textarea
                  id="notizInhalt"
                  value={notizInhalt}
                  onChange={(e) => setNotizInhalt(e.target.value)}
                  placeholder="Deine Beobachtungen, Chancen und offene Punkte …"
                  rows={5}
                  className="resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="notizDatum">Datum *</Label>
                  <Input
                    id="notizDatum"
                    type="date"
                    value={notizDatum}
                    onChange={(e) => setNotizDatum(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Kategorie</Label>
                <div className="flex flex-wrap gap-2">
                  {KATEGORIE_OPTIONS.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setKategorieKey(o.key)}
                      className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${
                        kategorieKey === o.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:bg-secondary'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Priorität</Label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITAET_OPTIONS.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setPrioritaetKey(o.key)}
                      className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${
                        prioritaetKey === o.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:bg-secondary'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {saveError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {saveError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="sm:flex-1"
                onClick={() => { setSaveError(null); setStep(3); }}
              >
                <IconArrowLeft size={16} className="mr-2" />
                Zurück
              </Button>
              <Button
                variant="outline"
                className="sm:flex-1"
                onClick={() => { setSaveError(null); setStep(5); }}
              >
                <IconPlayerSkipForward size={16} className="mr-2" />
                Überspringen
              </Button>
              <Button
                className="sm:flex-1"
                disabled={!notizTitel || !notizInhalt || !notizDatum || saving}
                onClick={handleCreateNotiz}
              >
                {saving ? 'Wird angelegt …' : (
                  <>
                    Notiz anlegen & abschließen
                    <IconArrowRight size={16} className="ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht ein Unternehmen aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* Schritt 5: Abschluss */}
      {step === 5 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center space-y-3 py-4">
              <div className="rounded-full bg-primary/10 p-4">
                <IconCheck size={32} className="text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Neuaufnahme abgeschlossen</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Das Portfoliounternehmen wurde erfolgreich angelegt.
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4 overflow-hidden">
              <p className="text-sm font-medium text-foreground">Zusammenfassung</p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl bg-secondary p-3">
                  <IconBuildingFactory2 size={18} className="text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">Unternehmen angelegt</p>
                  </div>
                  <IconCheck size={16} className="text-primary ml-auto flex-shrink-0" />
                </div>

                <div className={`flex items-center gap-3 rounded-xl p-3 ${terminErstellt ? 'bg-secondary' : 'bg-muted/40'}`}>
                  <IconCalendarPlus size={18} className={terminErstellt ? 'text-primary flex-shrink-0' : 'text-muted-foreground flex-shrink-0'} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Erster Termin</p>
                    <p className="text-xs text-muted-foreground">{terminErstellt ? 'Angelegt' : 'Übersprungen'}</p>
                  </div>
                  {terminErstellt && <IconCheck size={16} className="text-primary ml-auto flex-shrink-0" />}
                </div>

                <div className={`flex items-center gap-3 rounded-xl p-3 ${dokumentErstellt ? 'bg-secondary' : 'bg-muted/40'}`}>
                  <IconFileText size={18} className={dokumentErstellt ? 'text-primary flex-shrink-0' : 'text-muted-foreground flex-shrink-0'} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Erstes Dokument</p>
                    <p className="text-xs text-muted-foreground">{dokumentErstellt ? 'Erfasst' : 'Übersprungen'}</p>
                  </div>
                  {dokumentErstellt && <IconCheck size={16} className="text-primary ml-auto flex-shrink-0" />}
                </div>

                <div className={`flex items-center gap-3 rounded-xl p-3 ${notizErstellt ? 'bg-secondary' : 'bg-muted/40'}`}>
                  <IconNotes size={18} className={notizErstellt ? 'text-primary flex-shrink-0' : 'text-muted-foreground flex-shrink-0'} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Einstiegsnotiz</p>
                    <p className="text-xs text-muted-foreground">{notizErstellt ? 'Verfasst' : 'Übersprungen'}</p>
                  </div>
                  {notizErstellt && <IconCheck size={16} className="text-primary ml-auto flex-shrink-0" />}
                </div>
              </div>

              {erstellteEintraege.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {erstellteEintraege.length === 1
                    ? `${erstellteEintraege[0]} wurde zusätzlich angelegt.`
                    : `${erstellteEintraege.join(', ')} wurden zusätzlich angelegt.`}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" className="sm:flex-1" onClick={handleReset}>
                Weitere Neuaufnahme starten
              </Button>
              <Button asChild className="sm:flex-1">
                <a href="#/">Zurück zum Dashboard</a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Kein Unternehmen gefunden. Bitte von vorne beginnen.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
