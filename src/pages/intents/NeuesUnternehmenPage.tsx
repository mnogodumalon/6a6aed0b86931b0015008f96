/**
 * Neues Portfolio-Unternehmen — 4-Schritt-Wizard.
 * Steps: 1) Stammdaten erfassen → 2) Ersttermin anlegen (optional) →
 *         3) Erstdokument hinzufügen (optional) → 4) Einstiegsnotiz erfassen (optional) → Abschluss.
 * Reads: (keine — alle Datensätze werden neu erstellt).
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
  IconArrowLeft,
  IconCircleCheck,
} from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
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
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';

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

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Created record IDs
  const [unternehmenId, setUnternehmenId] = useState<string | null>(null);
  const [unternehmenName, setUnternehmenName] = useState('');
  const [terminCreated, setTerminCreated] = useState(false);
  const [dokumentCreated, setDokumentCreated] = useState(false);
  const [notizCreated, setNotizCreated] = useState(false);

  // Step 1 — Stammdaten
  const [name, setName] = useState('');
  const [rechtsformKey, setRechtsformKey] = useState('none');
  const [brancheKey, setBrancheKey] = useState('none');
  const [statusKey, setStatusKey] = useState(STATUS_OPTIONS[0]?.key ?? 'aktiv');
  const [investiertesKapital, setInvestiertesKapital] = useState('');
  const [aktuellerWert, setAktuellerWert] = useState('');
  const [investitionsdatum, setInvestitionsdatum] = useState('');
  const [stadt, setStadt] = useState('');

  // Step 2 — Ersttermin
  const [terminbezeichnung, setTerminbezeichnung] = useState('Erstgespräch');
  const [terminartKey, setTerminartKey] = useState('none');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [terminstatusKey, setTerminstatusKey] = useState(TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant');

  // Step 3 — Erstdokument
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententypKey, setDokumententypKey] = useState('none');
  const [dokumentendatum, setDokumendatum] = useState('');
  const [dokumentenlink, setDokumenlink] = useState('');
  const [bereitgestelltVon, setBereitgestelltVon] = useState('');

  // Step 4 — Einstiegsnotiz
  const [notizTitel, setNotizTitel] = useState('Erstkontakt');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kategorieKey, setKategorieKey] = useState('none');
  const [prioritaetKey, setPrioritaetKey] = useState(
    PRIORITAET_OPTIONS.find(o => o.key === 'mittel')?.key ?? PRIORITAET_OPTIONS[0]?.key ?? 'mittel'
  );

  const handleCreateUnternehmen = async () => {
    if (!name.trim()) return;
    // idempotency: already created
    if (unternehmenId) { setStep(2); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = { name: name.trim(), status: statusKey };
      if (rechtsformKey !== 'none') payload.rechtsform = rechtsformKey;
      if (brancheKey !== 'none') payload.branche = brancheKey;
      if (investiertesKapital) payload.investiertes_kapital = parseFloat(investiertesKapital);
      if (aktuellerWert) payload.aktueller_wert = parseFloat(aktuellerWert);
      if (investitionsdatum) payload.investitionsdatum = investitionsdatum;
      if (stadt.trim()) payload.stadt = stadt.trim();

      const result = await LivingAppsService.createUnternehmenEntry(payload);
      setUnternehmenId(result.record_id);
      setUnternehmenName(name.trim());
      await fetchAll();
      setStep(2);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Unternehmens.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTermin = async () => {
    if (!unternehmenId || !terminbezeichnung.trim() || terminartKey === 'none' || !datumUhrzeit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        terminbezeichnung: terminbezeichnung.trim(),
        terminart: terminartKey,
        datum_uhrzeit: datumUhrzeit,
        terminstatus: terminstatusKey,
      };
      if (ort.trim()) payload.ort = ort.trim();

      await LivingAppsService.createTermineEntry(payload);
      setTerminCreated(true);
      await fetchAll();
      setStep(3);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Termins.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDokument = async () => {
    if (!unternehmenId || !dokumentenbezeichnung.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        dokumentenbezeichnung: dokumentenbezeichnung.trim(),
      };
      if (dokumententypKey !== 'none') payload.dokumententyp = dokumententypKey;
      if (dokumentendatum) payload.dokumentendatum = dokumentendatum;
      if (dokumentenlink.trim()) payload.dokumentenlink = dokumentenlink.trim();
      if (bereitgestelltVon.trim()) payload.bereitgestellt_von = bereitgestelltVon.trim();

      await LivingAppsService.createDokumenteEntry(payload);
      setDokumentCreated(true);
      await fetchAll();
      setStep(4);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Dokuments.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNotiz = async () => {
    if (!unternehmenId || !notizTitel.trim() || !notizInhalt.trim() || !notizDatum) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        notiz_titel: notizTitel.trim(),
        notiz_inhalt: notizInhalt.trim(),
        notiz_datum: notizDatum,
        prioritaet: prioritaetKey,
      };
      if (kategorieKey !== 'none') payload.kategorie = kategorieKey;

      await LivingAppsService.createNotizenEntry(payload);
      setNotizCreated(true);
      await fetchAll();
      setStep(5);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen der Notiz.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setUnternehmenId(null);
    setUnternehmenName('');
    setTerminCreated(false);
    setDokumentCreated(false);
    setNotizCreated(false);
    setName('');
    setRechtsformKey('none');
    setBrancheKey('none');
    setStatusKey(STATUS_OPTIONS[0]?.key ?? 'aktiv');
    setInvestiertesKapital('');
    setAktuellerWert('');
    setInvestitionsdatum('');
    setStadt('');
    setTerminbezeichnung('Erstgespräch');
    setTerminartKey('none');
    setDatumUhrzeit('');
    setOrt('');
    setTerminstatusKey(TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant');
    setDokumentenbezeichnung('');
    setDokumententypKey('none');
    setDokumendatum('');
    setDokumenlink('');
    setBereitgestelltVon('');
    setNotizTitel('Erstkontakt');
    setNotizInhalt('');
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    setKategorieKey('none');
    setPrioritaetKey(
      PRIORITAET_OPTIONS.find(o => o.key === 'mittel')?.key ?? PRIORITAET_OPTIONS[0]?.key ?? 'mittel'
    );
    setSubmitError(null);
  };

  return (
    <IntentWizardShell
      title="Neues Unternehmen"
      subtitle="Portfolio-Unternehmen in 4 Schritten anlegen"
      steps={[
        { label: 'Stammdaten' },
        { label: 'Ersttermin' },
        { label: 'Erstdokument' },
        { label: 'Einstiegsnotiz' },
        { label: 'Fertig' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Stammdaten ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2">
              <IconBuilding size={22} className="text-primary" stroke={1.5} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Stammdaten erfassen</h2>
              <p className="text-sm text-muted-foreground">Grundlegende Informationen zum Unternehmen</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="name">Unternehmensname *</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="z. B. Muster GmbH"
              />
            </div>

            <div className="space-y-1">
              <Label>Rechtsform</Label>
              <Select value={rechtsformKey} onValueChange={setRechtsformKey}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Bitte wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Angabe</SelectItem>
                  {RECHTSFORM_OPTIONS.map(o => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Branche</Label>
              <Select value={brancheKey} onValueChange={setBrancheKey}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Bitte wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Angabe</SelectItem>
                  {BRANCHE_OPTIONS.map(o => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Status *</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setStatusKey(o.key)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
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

            <div className="space-y-1">
              <Label htmlFor="investitionsdatum">Investitionsdatum</Label>
              <Input
                id="investitionsdatum"
                type="date"
                value={investitionsdatum}
                onChange={e => setInvestitionsdatum(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="investiertesKapital">Investiertes Kapital (€)</Label>
              <Input
                id="investiertesKapital"
                type="number"
                min="0"
                step="0.01"
                value={investiertesKapital}
                onChange={e => setInvestiertesKapital(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="aktuellerWert">Aktueller Wert (€)</Label>
              <Input
                id="aktuellerWert"
                type="number"
                min="0"
                step="0.01"
                value={aktuellerWert}
                onChange={e => setAktuellerWert(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="stadt">Stadt</Label>
              <Input
                id="stadt"
                value={stadt}
                onChange={e => setStadt(e.target.value)}
                placeholder="z. B. Berlin"
              />
            </div>
          </div>

          {submitError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{submitError}</p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleCreateUnternehmen}
              disabled={!name.trim() || submitting}
            >
              {submitting ? 'Wird angelegt…' : 'Unternehmen anlegen'}
              <IconArrowRight size={16} stroke={1.5} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Ersttermin ─────────────────────────────────────────── */}
      {step === 2 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2">
                <IconCalendarPlus size={22} className="text-primary" stroke={1.5} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Ersttermin erfassen</h2>
                <p className="text-sm text-muted-foreground">Ersten Termin für <strong>{unternehmenName}</strong> anlegen</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="terminbezeichnung">Bezeichnung *</Label>
                <Input
                  id="terminbezeichnung"
                  value={terminbezeichnung}
                  onChange={e => setTerminbezeichnung(e.target.value)}
                  placeholder="z. B. Erstgespräch"
                />
              </div>

              <div className="space-y-1">
                <Label>Terminart *</Label>
                <Select value={terminartKey} onValueChange={setTerminartKey}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bitte wählen</SelectItem>
                    {TERMINART_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="datumUhrzeit">Datum & Uhrzeit *</Label>
                <Input
                  id="datumUhrzeit"
                  type="datetime-local"
                  value={datumUhrzeit}
                  onChange={e => setDatumUhrzeit(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="ort">Ort</Label>
                <Input
                  id="ort"
                  value={ort}
                  onChange={e => setOrt(e.target.value)}
                  placeholder="z. B. Büro München"
                />
              </div>

              <div className="space-y-1">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2">
                  {TERMINSTATUS_OPTIONS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setTerminstatusKey(o.key)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
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

            {submitError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{submitError}</p>
            )}

            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                <IconArrowLeft size={16} stroke={1.5} className="mr-1" />
                Zurück
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setStep(3)}
                >
                  Überspringen
                </Button>
                <Button
                  onClick={handleCreateTermin}
                  disabled={!terminbezeichnung.trim() || terminartKey === 'none' || !datumUhrzeit || submitting}
                >
                  {submitting ? 'Wird gespeichert…' : 'Termin anlegen'}
                  <IconArrowRight size={16} stroke={1.5} className="ml-1" />
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

      {/* ── Step 3: Erstdokument ───────────────────────────────────────── */}
      {step === 3 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2">
                <IconFileText size={22} className="text-primary" stroke={1.5} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Erstdokument hinzufügen</h2>
                <p className="text-sm text-muted-foreground">Erstes Dokument für <strong>{unternehmenName}</strong> erfassen</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="dokumentenbezeichnung">Dokumentenbezeichnung *</Label>
                <Input
                  id="dokumentenbezeichnung"
                  value={dokumentenbezeichnung}
                  onChange={e => setDokumentenbezeichnung(e.target.value)}
                  placeholder="z. B. Gesellschaftsvertrag"
                />
              </div>

              <div className="space-y-1">
                <Label>Dokumententyp</Label>
                <Select value={dokumententypKey} onValueChange={setDokumententypKey}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Angabe</SelectItem>
                    {DOKUMENTENTYP_OPTIONS.map(o => (
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
                  onChange={e => setDokumendatum(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="dokumentenlink">Dokumentenlink (URL)</Label>
                <Input
                  id="dokumentenlink"
                  type="url"
                  value={dokumentenlink}
                  onChange={e => setDokumenlink(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="bereitgestelltVon">Bereitgestellt von</Label>
                <Input
                  id="bereitgestelltVon"
                  value={bereitgestelltVon}
                  onChange={e => setBereitgestelltVon(e.target.value)}
                  placeholder="z. B. Max Mustermann"
                />
              </div>
            </div>

            {submitError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{submitError}</p>
            )}

            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>
                <IconArrowLeft size={16} stroke={1.5} className="mr-1" />
                Zurück
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setStep(4)}
                >
                  Überspringen
                </Button>
                <Button
                  onClick={handleCreateDokument}
                  disabled={!dokumentenbezeichnung.trim() || submitting}
                >
                  {submitting ? 'Wird gespeichert…' : 'Dokument hinzufügen'}
                  <IconArrowRight size={16} stroke={1.5} className="ml-1" />
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

      {/* ── Step 4: Einstiegsnotiz ─────────────────────────────────────── */}
      {step === 4 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2">
                <IconNotes size={22} className="text-primary" stroke={1.5} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Einstiegsnotiz erfassen</h2>
                <p className="text-sm text-muted-foreground">Erste Notiz für <strong>{unternehmenName}</strong> anlegen</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="notizTitel">Titel *</Label>
                <Input
                  id="notizTitel"
                  value={notizTitel}
                  onChange={e => setNotizTitel(e.target.value)}
                  placeholder="z. B. Erstkontakt"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="notizInhalt">Inhalt *</Label>
                <Textarea
                  id="notizInhalt"
                  value={notizInhalt}
                  onChange={e => setNotizInhalt(e.target.value)}
                  placeholder="Notiz eingeben…"
                  rows={4}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="notizDatum">Datum *</Label>
                <Input
                  id="notizDatum"
                  type="date"
                  value={notizDatum}
                  onChange={e => setNotizDatum(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Kategorie</Label>
                <Select value={kategorieKey} onValueChange={setKategorieKey}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Angabe</SelectItem>
                    {KATEGORIE_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label>Priorität</Label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITAET_OPTIONS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setPrioritaetKey(o.key)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
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

            {submitError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{submitError}</p>
            )}

            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setStep(3)}>
                <IconArrowLeft size={16} stroke={1.5} className="mr-1" />
                Zurück
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setStep(5)}
                >
                  Überspringen
                </Button>
                <Button
                  onClick={handleCreateNotiz}
                  disabled={!notizTitel.trim() || !notizInhalt.trim() || !notizDatum || submitting}
                >
                  {submitting ? 'Wird gespeichert…' : 'Notiz anlegen'}
                  <IconArrowRight size={16} stroke={1.5} className="ml-1" />
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

      {/* ── Step 5: Abschluss ─────────────────────────────────────────── */}
      {step === 5 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-2">
                <IconCircleCheck size={32} className="text-primary" stroke={1.5} />
              </div>
              <h2 className="text-xl font-semibold">Unternehmen angelegt!</h2>
              <p className="text-muted-foreground text-sm">
                <strong>{unternehmenName}</strong> wurde erfolgreich in deinem Portfolio erfasst.
              </p>
            </div>

            <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b bg-secondary/40">
                <p className="text-sm font-medium text-muted-foreground">Übersicht</p>
              </div>
              <ul className="divide-y">
                <li className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <IconBuilding size={16} className="text-muted-foreground" stroke={1.5} />
                    <span className="text-sm">Unternehmen</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
                    <IconCheck size={15} stroke={2} />
                    Angelegt
                  </div>
                </li>
                <li className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <IconCalendarPlus size={16} className="text-muted-foreground" stroke={1.5} />
                    <span className="text-sm">Ersttermin</span>
                  </div>
                  {terminCreated ? (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
                      <IconCheck size={15} stroke={2} />
                      Angelegt
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Übersprungen</span>
                  )}
                </li>
                <li className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <IconFileText size={16} className="text-muted-foreground" stroke={1.5} />
                    <span className="text-sm">Erstdokument</span>
                  </div>
                  {dokumentCreated ? (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
                      <IconCheck size={15} stroke={2} />
                      Hinzugefügt
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Übersprungen</span>
                  )}
                </li>
                <li className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <IconNotes size={16} className="text-muted-foreground" stroke={1.5} />
                    <span className="text-sm">Einstiegsnotiz</span>
                  </div>
                  {notizCreated ? (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
                      <IconCheck size={15} stroke={2} />
                      Erfasst
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Übersprungen</span>
                  )}
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={handleReset}>
                Weiteres Unternehmen anlegen
              </Button>
              <a href="#/">
                <Button className="w-full sm:w-auto">
                  Zurück zum Dashboard
                </Button>
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
