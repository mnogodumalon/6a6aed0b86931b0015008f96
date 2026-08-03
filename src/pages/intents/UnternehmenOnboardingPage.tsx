/**
 * Unternehmen Onboarding — 5-Schritt-Wizard.
 * Steps: 1) Unternehmen anlegen → 2) Ersten Termin planen → 3) Erstes Dokument erfassen (optional) → 4) Erste Notiz schreiben (optional) → 5) Zusammenfassung.
 * Reads: (keine vorhandenen Datensätze nötig, da alles neu angelegt wird).
 * Writes: unternehmen (createUnternehmenEntry), termine (createTermineEntry), dokumente (createDokumenteEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import {
  IconBuildingSkyscraper,
  IconCalendarPlus,
  IconFileText,
  IconNote,
  IconCircleCheck,
  IconChevronRight,
  IconPlayerSkipForward,
} from '@tabler/icons-react';

const RECHTSFORM_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['rechtsform'] ?? [];
const BRANCHE_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['branche'] ?? [];
const STATUS_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['status'] ?? [];
const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

export default function UnternehmenOnboardingPage() {
  const { loading, error, fetchAll } = useDashboardData();

  // Wizard step
  const [step, setStep] = useState(1);

  // IDs created
  const [unternehmenId, setUnternehmenId] = useState<string | null>(null);
  const [terminId, setTerminId] = useState<string | null>(null);
  const [dokumentId, setDokumentId] = useState<string | null>(null);
  const [notizId, setNotizId] = useState<string | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1 — Unternehmen
  const [uName, setUName] = useState('');
  const [uStatus, setUStatus] = useState(STATUS_OPTIONS[0]?.key ?? 'aktiv');
  const [uRechtsform, setURechtsform] = useState('none');
  const [uBranche, setUBranche] = useState('none');
  const [uKapital, setUKapital] = useState('');
  const [uInvestitionsdatum, setUInvestitionsdatum] = useState('');
  const [uStadt, setUStadt] = useState('');
  const [uVorname, setUVorname] = useState('');
  const [uNachname, setUNachname] = useState('');
  const [uEmail, setUEmail] = useState('');

  // Summary labels for Step 1
  const [savedUnternehmenName, setSavedUnternehmenName] = useState('');

  // Step 2 — Termin
  const [tBezeichnung, setTBezeichnung] = useState('');
  const [tTerminart, setTTerminart] = useState('none');
  const [tDatumUhrzeit, setTDatumUhrzeit] = useState('');
  const [tOrt, setTOrt] = useState('');
  const [tStatus, setTStatus] = useState(TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant');

  // Summary labels for Step 2
  const [savedTerminBezeichnung, setSavedTerminBezeichnung] = useState('');
  const [savedTerminDatum, setSavedTerminDatum] = useState('');

  // Step 3 — Dokument
  const [dBezeichnung, setDBezeichnung] = useState('');
  const [dTypKey, setDTypKey] = useState('none');
  const [dDatum, setDDatum] = useState('');
  const [dLink, setDLink] = useState('');
  const [dBereitgestellt, setDBereitgestellt] = useState('');

  // Summary label for Step 3
  const [savedDokumentBezeichnung, setSavedDokumentBezeichnung] = useState('');

  // Step 4 — Notiz
  const [nTitel, setNTitel] = useState('');
  const [nInhalt, setNInhalt] = useState('');
  const [nDatum, setNDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [nKategorieKey, setNKategorieKey] = useState('none');
  const [nPrioritaetKey, setNPrioritaetKey] = useState(PRIORITAET_OPTIONS.find(o => o.key === 'mittel')?.key ?? PRIORITAET_OPTIONS[0]?.key ?? 'mittel');

  // Summary label for Step 4
  const [savedNotizTitel, setSavedNotizTitel] = useState('');

  // ---- Handlers ----

  const handleCreateUnternehmen = async () => {
    if (!uName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        name: uName.trim(),
        status: uStatus,
      };
      if (uRechtsform !== 'none') payload.rechtsform = uRechtsform;
      if (uBranche !== 'none') payload.branche = uBranche;
      if (uKapital) payload.investiertes_kapital = parseFloat(uKapital);
      if (uInvestitionsdatum) payload.investitionsdatum = uInvestitionsdatum;
      if (uStadt.trim()) payload.stadt = uStadt.trim();
      if (uVorname.trim()) payload.ansprechpartner_vorname = uVorname.trim();
      if (uNachname.trim()) payload.ansprechpartner_nachname = uNachname.trim();
      if (uEmail.trim()) payload.ansprechpartner_email = uEmail.trim();

      const result = await LivingAppsService.createUnternehmenEntry(payload as Parameters<typeof LivingAppsService.createUnternehmenEntry>[0]);
      await fetchAll();
      setUnternehmenId(result.record_id);
      setSavedUnternehmenName(uName.trim());
      setStep(2);
    } catch (e) {
      setSubmitError('Fehler beim Anlegen des Unternehmens. Bitte erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTermin = async () => {
    if (!unternehmenId || !tBezeichnung.trim() || !tDatumUhrzeit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        terminbezeichnung: tBezeichnung.trim(),
        datum_uhrzeit: tDatumUhrzeit,
        terminstatus: tStatus,
      };
      if (tTerminart !== 'none') payload.terminart = tTerminart;
      if (tOrt.trim()) payload.ort = tOrt.trim();

      const result = await LivingAppsService.createTermineEntry(payload as Parameters<typeof LivingAppsService.createTermineEntry>[0]);
      await fetchAll();
      setTerminId(result.record_id);
      setSavedTerminBezeichnung(tBezeichnung.trim());
      setSavedTerminDatum(tDatumUhrzeit);
      setStep(3);
    } catch (e) {
      setSubmitError('Fehler beim Anlegen des Termins. Bitte erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDokument = async () => {
    if (!unternehmenId || !dBezeichnung.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Guard against duplicate on retry
      let did = dokumentId;
      if (!did) {
        const payload: Record<string, unknown> = {
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
          dokumentenbezeichnung: dBezeichnung.trim(),
        };
        if (dTypKey !== 'none') payload.dokumententyp = dTypKey;
        if (dDatum) payload.dokumentendatum = dDatum;
        if (dLink.trim()) payload.dokumentenlink = dLink.trim();
        if (dBereitgestellt.trim()) payload.bereitgestellt_von = dBereitgestellt.trim();

        const result = await LivingAppsService.createDokumenteEntry(payload as Parameters<typeof LivingAppsService.createDokumenteEntry>[0]);
        await fetchAll();
        did = result.record_id;
        setDokumentId(did);
        setSavedDokumentBezeichnung(dBezeichnung.trim());
      }
      setStep(4);
    } catch (e) {
      setSubmitError('Fehler beim Anlegen des Dokuments. Bitte erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipDokument = () => {
    setStep(4);
  };

  const handleCreateNotiz = async () => {
    if (!unternehmenId || !nTitel.trim() || !nInhalt.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Guard against duplicate on retry
      let nid = notizId;
      if (!nid) {
        const payload: Record<string, unknown> = {
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
          notiz_titel: nTitel.trim(),
          notiz_inhalt: nInhalt.trim(),
          notiz_datum: nDatum,
          prioritaet: nPrioritaetKey,
        };
        if (nKategorieKey !== 'none') payload.kategorie = nKategorieKey;

        const result = await LivingAppsService.createNotizenEntry(payload as Parameters<typeof LivingAppsService.createNotizenEntry>[0]);
        await fetchAll();
        nid = result.record_id;
        setNotizId(nid);
        setSavedNotizTitel(nTitel.trim());
      }
      setStep(5);
    } catch (e) {
      setSubmitError('Fehler beim Anlegen der Notiz. Bitte erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipNotiz = () => {
    setStep(5);
  };

  const handleReset = () => {
    setStep(1);
    setUnternehmenId(null);
    setTerminId(null);
    setDokumentId(null);
    setNotizId(null);
    setSubmitError(null);
    setSavedUnternehmenName('');
    setSavedTerminBezeichnung('');
    setSavedTerminDatum('');
    setSavedDokumentBezeichnung('');
    setSavedNotizTitel('');
    setUName(''); setUStatus(STATUS_OPTIONS[0]?.key ?? 'aktiv'); setURechtsform('none');
    setUBranche('none'); setUKapital(''); setUInvestitionsdatum(''); setUStadt('');
    setUVorname(''); setUNachname(''); setUEmail('');
    setTBezeichnung(''); setTTerminart('none'); setTDatumUhrzeit(''); setTOrt('');
    setTStatus(TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant');
    setDBezeichnung(''); setDTypKey('none'); setDDatum(''); setDLink(''); setDBereitgestellt('');
    setNTitel(''); setNInhalt(''); setNDatum(format(new Date(), 'yyyy-MM-dd'));
    setNKategorieKey('none'); setNPrioritaetKey(PRIORITAET_OPTIONS.find(o => o.key === 'mittel')?.key ?? PRIORITAET_OPTIONS[0]?.key ?? 'mittel');
  };

  return (
    <IntentWizardShell
      title="Unternehmen onboarden"
      subtitle="Neues Portfolio-Unternehmen Schritt für Schritt einrichten"
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
      {/* ---- Step 1: Unternehmen anlegen ---- */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <IconBuildingSkyscraper size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Unternehmen anlegen</h2>
              <p className="text-sm text-muted-foreground">Grunddaten und Ansprechpartner erfassen</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-medium text-foreground">Grunddaten</h3>

            <div className="space-y-2">
              <Label htmlFor="u-name">Unternehmensname *</Label>
              <Input
                id="u-name"
                value={uName}
                onChange={e => setUName(e.target.value)}
                placeholder="z.B. Muster GmbH"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status *</Label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setUStatus(opt.key)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        uStatus === opt.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:bg-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="u-rechtsform">Rechtsform</Label>
                <Select value={uRechtsform} onValueChange={setURechtsform}>
                  <SelectTrigger id="u-rechtsform">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Angabe</SelectItem>
                    {RECHTSFORM_OPTIONS.map(opt => (
                      <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="u-branche">Branche</Label>
              <Select value={uBranche} onValueChange={setUBranche}>
                <SelectTrigger id="u-branche">
                  <SelectValue placeholder="Bitte wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Angabe</SelectItem>
                  {BRANCHE_OPTIONS.map(opt => (
                    <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="u-kapital">Investiertes Kapital (€)</Label>
                <Input
                  id="u-kapital"
                  type="number"
                  min="0"
                  step="0.01"
                  value={uKapital}
                  onChange={e => setUKapital(e.target.value)}
                  placeholder="z.B. 500000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="u-investitionsdatum">Investitionsdatum</Label>
                <Input
                  id="u-investitionsdatum"
                  type="date"
                  value={uInvestitionsdatum}
                  onChange={e => setUInvestitionsdatum(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="u-stadt">Stadt</Label>
              <Input
                id="u-stadt"
                value={uStadt}
                onChange={e => setUStadt(e.target.value)}
                placeholder="z.B. Berlin"
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-medium text-foreground">Ansprechpartner</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="u-vorname">Vorname</Label>
                <Input
                  id="u-vorname"
                  value={uVorname}
                  onChange={e => setUVorname(e.target.value)}
                  placeholder="Vorname"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="u-nachname">Nachname</Label>
                <Input
                  id="u-nachname"
                  value={uNachname}
                  onChange={e => setUNachname(e.target.value)}
                  placeholder="Nachname"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="u-email">E-Mail</Label>
              <Input
                id="u-email"
                type="email"
                value={uEmail}
                onChange={e => setUEmail(e.target.value)}
                placeholder="ansprechpartner@beispiel.de"
              />
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <Button
            className="w-full"
            disabled={!uName.trim() || submitting}
            onClick={handleCreateUnternehmen}
          >
            {submitting ? 'Wird angelegt…' : 'Unternehmen anlegen'}
            {!submitting && <IconChevronRight size={16} className="ml-1" />}
          </Button>
        </div>
      )}

      {/* ---- Step 2: Ersten Termin anlegen ---- */}
      {step === 2 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <IconCalendarPlus size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Ersten Termin planen</h2>
                <p className="text-sm text-muted-foreground">
                  Für <span className="font-medium text-foreground">{savedUnternehmenName}</span>
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="t-bezeichnung">Terminbezeichnung *</Label>
                <Input
                  id="t-bezeichnung"
                  value={tBezeichnung}
                  onChange={e => setTBezeichnung(e.target.value)}
                  placeholder="z.B. Kick-off Meeting"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="t-terminart">Terminart</Label>
                <Select value={tTerminart} onValueChange={setTTerminart}>
                  <SelectTrigger id="t-terminart">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Angabe</SelectItem>
                    {TERMINART_OPTIONS.map(opt => (
                      <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="t-datum">Datum & Uhrzeit *</Label>
                <Input
                  id="t-datum"
                  type="datetime-local"
                  value={tDatumUhrzeit}
                  onChange={e => setTDatumUhrzeit(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="t-ort">Ort</Label>
                <Input
                  id="t-ort"
                  value={tOrt}
                  onChange={e => setTOrt(e.target.value)}
                  placeholder="z.B. Büro Berlin"
                />
              </div>

              <div className="space-y-2">
                <Label>Terminstatus</Label>
                <div className="flex flex-wrap gap-2">
                  {TERMINSTATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setTStatus(opt.key)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        tStatus === opt.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:bg-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            <Button
              className="w-full"
              disabled={!tBezeichnung.trim() || !tDatumUhrzeit || submitting}
              onClick={handleCreateTermin}
            >
              {submitting ? 'Wird angelegt…' : 'Termin anlegen'}
              {!submitting && <IconChevronRight size={16} className="ml-1" />}
            </Button>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht ein angelegtes Unternehmen aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ---- Step 3: Erstes Dokument erfassen (optional) ---- */}
      {step === 3 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <IconFileText size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Erstes Dokument erfassen</h2>
                <p className="text-sm text-muted-foreground">
                  Für <span className="font-medium text-foreground">{savedUnternehmenName}</span> — optional
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="d-bezeichnung">Dokumentenbezeichnung *</Label>
                <Input
                  id="d-bezeichnung"
                  value={dBezeichnung}
                  onChange={e => setDBezeichnung(e.target.value)}
                  placeholder="z.B. Beteiligungsvertrag 2026"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="d-typ">Dokumententyp</Label>
                <Select value={dTypKey} onValueChange={setDTypKey}>
                  <SelectTrigger id="d-typ">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Angabe</SelectItem>
                    {DOKUMENTENTYP_OPTIONS.map(opt => (
                      <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="d-datum">Dokumentendatum</Label>
                <Input
                  id="d-datum"
                  type="date"
                  value={dDatum}
                  onChange={e => setDDatum(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="d-link">Dokumentenlink (URL)</Label>
                <Input
                  id="d-link"
                  type="url"
                  value={dLink}
                  onChange={e => setDLink(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="d-bereitgestellt">Bereitgestellt von</Label>
                <Input
                  id="d-bereitgestellt"
                  value={dBereitgestellt}
                  onChange={e => setDBereitgestellt(e.target.value)}
                  placeholder="z.B. Max Mustermann"
                />
              </div>
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            <div className="flex flex-col gap-3">
              <Button
                className="w-full"
                disabled={!dBezeichnung.trim() || submitting}
                onClick={handleCreateDokument}
              >
                {submitting ? 'Wird erfasst…' : 'Dokument erfassen'}
                {!submitting && <IconChevronRight size={16} className="ml-1" />}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSkipDokument}
                disabled={submitting}
              >
                <IconPlayerSkipForward size={16} className="mr-2" />
                Schritt überspringen
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht ein angelegtes Unternehmen aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ---- Step 4: Erste Notiz schreiben (optional) ---- */}
      {step === 4 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <IconNote size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Erste Notiz schreiben</h2>
                <p className="text-sm text-muted-foreground">
                  Für <span className="font-medium text-foreground">{savedUnternehmenName}</span> — optional
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="n-titel">Titel *</Label>
                <Input
                  id="n-titel"
                  value={nTitel}
                  onChange={e => setNTitel(e.target.value)}
                  placeholder="z.B. Erste Eindrücke zum Unternehmen"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="n-inhalt">Inhalt *</Label>
                <Textarea
                  id="n-inhalt"
                  value={nInhalt}
                  onChange={e => setNInhalt(e.target.value)}
                  placeholder="Notiz hier eingeben…"
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="n-datum">Datum</Label>
                <Input
                  id="n-datum"
                  type="date"
                  value={nDatum}
                  onChange={e => setNDatum(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="n-kategorie">Kategorie</Label>
                <Select value={nKategorieKey} onValueChange={setNKategorieKey}>
                  <SelectTrigger id="n-kategorie">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Angabe</SelectItem>
                    {KATEGORIE_OPTIONS.map(opt => (
                      <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priorität</Label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITAET_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setNPrioritaetKey(opt.key)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        nPrioritaetKey === opt.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:bg-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            <div className="flex flex-col gap-3">
              <Button
                className="w-full"
                disabled={!nTitel.trim() || !nInhalt.trim() || submitting}
                onClick={handleCreateNotiz}
              >
                {submitting ? 'Wird gespeichert…' : 'Notiz speichern'}
                {!submitting && <IconChevronRight size={16} className="ml-1" />}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSkipNotiz}
                disabled={submitting}
              >
                <IconPlayerSkipForward size={16} className="mr-2" />
                Schritt überspringen
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht ein angelegtes Unternehmen aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ---- Step 5: Zusammenfassung ---- */}
      {step === 5 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <IconCircleCheck size={22} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Onboarding abgeschlossen!</h2>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{savedUnternehmenName}</span> wurde erfolgreich eingerichtet.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b">
                <h3 className="text-sm font-medium text-foreground">Was wurde angelegt</h3>
              </div>
              <ul className="divide-y">
                <li className="flex items-center gap-3 px-5 py-3">
                  <IconBuildingSkyscraper size={18} className="text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{savedUnternehmenName}</p>
                    <p className="text-xs text-muted-foreground">Unternehmen</p>
                  </div>
                  <IconCircleCheck size={16} className="ml-auto text-green-500 flex-shrink-0" />
                </li>

                {terminId && (
                  <li className="flex items-center gap-3 px-5 py-3">
                    <IconCalendarPlus size={18} className="text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{savedTerminBezeichnung}</p>
                      <p className="text-xs text-muted-foreground">
                        Termin{savedTerminDatum ? ` · ${savedTerminDatum}` : ''}
                      </p>
                    </div>
                    <IconCircleCheck size={16} className="ml-auto text-green-500 flex-shrink-0" />
                  </li>
                )}

                {dokumentId && (
                  <li className="flex items-center gap-3 px-5 py-3">
                    <IconFileText size={18} className="text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{savedDokumentBezeichnung}</p>
                      <p className="text-xs text-muted-foreground">Dokument</p>
                    </div>
                    <IconCircleCheck size={16} className="ml-auto text-green-500 flex-shrink-0" />
                  </li>
                )}

                {notizId && (
                  <li className="flex items-center gap-3 px-5 py-3">
                    <IconNote size={18} className="text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{savedNotizTitel}</p>
                      <p className="text-xs text-muted-foreground">Notiz</p>
                    </div>
                    <IconCircleCheck size={16} className="ml-auto text-green-500 flex-shrink-0" />
                  </li>
                )}

                {!dokumentId && !notizId && (
                  <li className="px-5 py-3">
                    <p className="text-xs text-muted-foreground">Dokument und Notiz wurden übersprungen — können später ergänzt werden.</p>
                  </li>
                )}
                {!dokumentId && notizId && (
                  <li className="px-5 py-2">
                    <p className="text-xs text-muted-foreground">Kein Dokument erfasst — kann später ergänzt werden.</p>
                  </li>
                )}
                {dokumentId && !notizId && (
                  <li className="px-5 py-2">
                    <p className="text-xs text-muted-foreground">Keine Notiz geschrieben — kann später ergänzt werden.</p>
                  </li>
                )}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Button className="w-full" onClick={handleReset}>
                Weiteres Unternehmen onboarden
              </Button>
              <a href="#/" className="block">
                <Button variant="outline" className="w-full">
                  Zurück zum Dashboard
                </Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht ein abgeschlossenes Onboarding aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
