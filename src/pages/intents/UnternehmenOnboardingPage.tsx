/**
 * Unternehmen Onboarding — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen anlegen → 2) Ersttermin anlegen → 3) Erstes Dokument erfassen → 4) Eröffnungsnotiz erstellen.
 * Reads: (keine Auswahl aus bestehenden Datensätzen — alle Schritte legen neue Records an).
 * Writes: unternehmen (createUnternehmenEntry), termine (createTermineEntry),
 *         dokumente (createDokumenteEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  IconBuilding,
  IconCalendarPlus,
  IconFileText,
  IconNotes,
  IconCheck,
  IconChevronRight,
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

export default function UnternehmenOnboardingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { loading, error, fetchAll } = useDashboardData();

  const initialStep = parseInt(searchParams.get('step') ?? '1', 10);
  const initialUnternehmenId = searchParams.get('unternehmenId') ?? '';

  const [step, setStep] = useState(isNaN(initialStep) || initialStep < 1 || initialStep > 4 ? 1 : initialStep);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Created record IDs — used for chained creates and idempotency
  const [unternehmenId, setUnternehmenId] = useState(initialUnternehmenId);
  const [terminId, setTerminId] = useState('');
  const [dokumentId, setDokumentId] = useState('');
  const [notizId, setNotizId] = useState('');

  // Summaries for live feedback panel
  const [unternehmenName, setUnternehmenName] = useState('');
  const [terminDatum, setTerminDatum] = useState('');
  const [terminBezeichnung, setTerminBezeichnung] = useState('');
  const [dokumentBezeichnung, setDokumentBezeichnung] = useState('');

  // Step 1: Unternehmen
  const [uName, setUName] = useState('');
  const [uStatus, setUStatus] = useState(STATUS_OPTIONS[0]?.key ?? 'aktiv');
  const [uRechtsform, setURechtsform] = useState('none');
  const [uBranche, setUBranche] = useState('none');
  const [uKapital, setUKapital] = useState('');
  const [uInvDatum, setUInvDatum] = useState('');
  const [uStadt, setUStadt] = useState('');
  const [uVorname, setUVorname] = useState('');
  const [uNachname, setUNachname] = useState('');
  const [uEmail, setUEmail] = useState('');

  // Step 2: Termine
  const [tBezeichnung, setTBezeichnung] = useState('');
  const [tArt, setTArt] = useState('none');
  const [tDatum, setTDatum] = useState('');
  const [tOrt, setTOrt] = useState('');
  const [tStatus, setTStatus] = useState(TERMINSTATUS_OPTIONS.find(o => o.key === 'geplant')?.key ?? TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant');

  // Step 3: Dokumente
  const [dBezeichnung, setDBezeichnung] = useState('');
  const [dTyp, setDTyp] = useState('none');
  const [dDatum, setDDatum] = useState('');
  const [dLink, setDLink] = useState('');
  const [dBereitgestellt, setDBereitgestellt] = useState('');

  // Step 4: Notizen
  const [nTitel, setNTitel] = useState('');
  const [nInhalt, setNInhalt] = useState('');
  const [nDatum, setNDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [nKategorie, setNKategorie] = useState(KATEGORIE_OPTIONS.find(o => o.key === 'allgemein')?.key ?? KATEGORIE_OPTIONS[0]?.key ?? 'allgemein');
  const [nPrioritaet, setNPrioritaet] = useState(PRIORITAET_OPTIONS.find(o => o.key === 'mittel')?.key ?? PRIORITAET_OPTIONS[0]?.key ?? 'mittel');

  function handleStepChange(newStep: number) {
    setStep(newStep);
    const params: Record<string, string> = { step: String(newStep) };
    if (unternehmenId) params.unternehmenId = unternehmenId;
    setSearchParams(params);
  }

  async function handleStep1() {
    if (!uName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let uid = unternehmenId;
      if (!uid) {
        const payload: Record<string, unknown> = {
          name: uName.trim(),
          status: uStatus,
        };
        if (uRechtsform && uRechtsform !== 'none') payload.rechtsform = uRechtsform;
        if (uBranche && uBranche !== 'none') payload.branche = uBranche;
        if (uKapital) payload.investiertes_kapital = parseFloat(uKapital);
        if (uInvDatum) payload.investitionsdatum = uInvDatum;
        if (uStadt.trim()) payload.stadt = uStadt.trim();
        if (uVorname.trim()) payload.ansprechpartner_vorname = uVorname.trim();
        if (uNachname.trim()) payload.ansprechpartner_nachname = uNachname.trim();
        if (uEmail.trim()) payload.ansprechpartner_email = uEmail.trim();

        const result = await LivingAppsService.createUnternehmenEntry(payload);
        uid = result.record_id;
        setUnternehmenId(uid);
        setUnternehmenName(uName.trim());
        // Pre-fill Termin-Bezeichnung with company name
        setTBezeichnung(`Ersttermin – ${uName.trim()}`);
        await fetchAll();
      }
      const params: Record<string, string> = { step: '2', unternehmenId: uid };
      setSearchParams(params);
      setStep(2);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Unternehmens.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep2() {
    if (!tBezeichnung.trim() || tArt === 'none' || !tDatum) return;
    if (!unternehmenId) { setStep(1); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      let tid = terminId;
      if (!tid) {
        const payload: Record<string, unknown> = {
          terminbezeichnung: tBezeichnung.trim(),
          terminart: tArt,
          datum_uhrzeit: tDatum,
          terminstatus: tStatus,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        };
        if (tOrt.trim()) payload.ort = tOrt.trim();

        const result = await LivingAppsService.createTermineEntry(payload);
        tid = result.record_id;
        setTerminId(tid);
        setTerminBezeichnung(tBezeichnung.trim());
        setTerminDatum(tDatum);
        await fetchAll();
      }
      handleStepChange(3);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Termins.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep3() {
    if (!dBezeichnung.trim()) return;
    if (!unternehmenId) { setStep(1); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      let did = dokumentId;
      if (!did) {
        const payload: Record<string, unknown> = {
          dokumentenbezeichnung: dBezeichnung.trim(),
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        };
        if (dTyp && dTyp !== 'none') payload.dokumententyp = dTyp;
        if (dDatum) payload.dokumentendatum = dDatum;
        if (dLink.trim()) payload.dokumentenlink = dLink.trim();
        if (dBereitgestellt.trim()) payload.bereitgestellt_von = dBereitgestellt.trim();

        const result = await LivingAppsService.createDokumenteEntry(payload);
        did = result.record_id;
        setDokumentId(did);
        setDokumentBezeichnung(dBezeichnung.trim());
        await fetchAll();
      }
      handleStepChange(4);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Dokuments.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep4() {
    if (!nTitel.trim() || !nInhalt.trim() || !nDatum) return;
    if (!unternehmenId) { setStep(1); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      let nid = notizId;
      if (!nid) {
        const payload: Record<string, unknown> = {
          notiz_titel: nTitel.trim(),
          notiz_inhalt: nInhalt.trim(),
          notiz_datum: nDatum,
          kategorie: nKategorie,
          prioritaet: nPrioritaet,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        };

        const result = await LivingAppsService.createNotizenEntry(payload);
        nid = result.record_id;
        setNotizId(nid);
        await fetchAll();
      }
      handleStepChange(5 as unknown as number);
      setStep(5 as unknown as number);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen der Notiz.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setStep(1);
    setUnternehmenId('');
    setTerminId('');
    setDokumentId('');
    setNotizId('');
    setUnternehmenName('');
    setTerminDatum('');
    setTerminBezeichnung('');
    setDokumentBezeichnung('');
    setUName(''); setUStatus(STATUS_OPTIONS[0]?.key ?? 'aktiv');
    setURechtsform('none'); setUBranche('none');
    setUKapital(''); setUInvDatum(''); setUStadt('');
    setUVorname(''); setUNachname(''); setUEmail('');
    setTBezeichnung(''); setTArt('none'); setTDatum(''); setTOrt('');
    setTStatus(TERMINSTATUS_OPTIONS.find(o => o.key === 'geplant')?.key ?? 'geplant');
    setDBezeichnung(''); setDTyp('none'); setDDatum(''); setDLink(''); setDBereitgestellt('');
    setNTitel(''); setNInhalt('');
    setNDatum(format(new Date(), 'yyyy-MM-dd'));
    setNKategorie(KATEGORIE_OPTIONS.find(o => o.key === 'allgemein')?.key ?? 'allgemein');
    setNPrioritaet(PRIORITAET_OPTIONS.find(o => o.key === 'mittel')?.key ?? 'mittel');
    setSubmitError(null);
    setSearchParams({ step: '1' });
  }

  const wizardSteps = [
    { label: 'Unternehmen' },
    { label: 'Ersttermin' },
    { label: 'Dokument' },
    { label: 'Notiz' },
  ];

  // Live feedback sidebar component
  const LiveSummary = () => {
    const hasAny = unternehmenName || terminBezeichnung || dokumentBezeichnung;
    if (!hasAny) return null;
    return (
      <div className="rounded-2xl border bg-card p-4 space-y-3 overflow-hidden">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bisheriger Fortschritt</p>
        {unternehmenName && (
          <div className="flex items-start gap-2">
            <IconBuilding size={16} className="text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Unternehmen</p>
              <p className="text-sm font-medium truncate">{unternehmenName}</p>
            </div>
          </div>
        )}
        {terminBezeichnung && (
          <div className="flex items-start gap-2">
            <IconCalendarPlus size={16} className="text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Ersttermin</p>
              <p className="text-sm font-medium truncate">{terminBezeichnung}</p>
              {terminDatum && <p className="text-xs text-muted-foreground">{terminDatum.replace('T', ' ')}</p>}
            </div>
          </div>
        )}
        {dokumentBezeichnung && (
          <div className="flex items-start gap-2">
            <IconFileText size={16} className="text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Dokument</p>
              <p className="text-sm font-medium truncate">{dokumentBezeichnung}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Success step (step 5)
  if (step === 5) {
    return (
      <IntentWizardShell
        title="Unternehmen Onboarding"
        subtitle="Neues Portfoliounternehmen vollständig eingerichtet"
        steps={wizardSteps}
        currentStep={4}
        onStepChange={handleStepChange}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        <div className="flex flex-col items-center py-12 space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <IconCheck size={32} className="text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Onboarding abgeschlossen!</h2>
            <p className="text-muted-foreground max-w-sm">
              <strong>{unternehmenName}</strong> wurde erfolgreich mit Ersttermin, Dokument und Eröffnungsnotiz angelegt.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleReset} variant="outline">
              Weiteres Unternehmen onboarden
            </Button>
            <a href="#/">
              <Button>Zurück zum Dashboard</Button>
            </a>
          </div>
        </div>
      </IntentWizardShell>
    );
  }

  return (
    <IntentWizardShell
      title="Unternehmen Onboarding"
      subtitle="Neues Portfoliounternehmen in 4 Schritten vollständig einrichten"
      steps={wizardSteps}
      currentStep={step}
      onStepChange={handleStepChange}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Unternehmen anlegen */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <IconBuilding size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Unternehmen anlegen</h2>
              <p className="text-sm text-muted-foreground">Stammdaten des neuen Portfoliounternehmens</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="u-name">Unternehmensname *</Label>
              <Input
                id="u-name"
                value={uName}
                onChange={e => setUName(e.target.value)}
                placeholder="z.B. TechVenture GmbH"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status *</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setUStatus(opt.key)}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      uStatus === opt.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border hover:bg-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-rechtsform">Rechtsform</Label>
              <Select value={uRechtsform} onValueChange={setURechtsform}>
                <SelectTrigger id="u-rechtsform" className="w-full">
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

            <div className="space-y-1.5">
              <Label htmlFor="u-branche">Branche</Label>
              <Select value={uBranche} onValueChange={setUBranche}>
                <SelectTrigger id="u-branche" className="w-full">
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

            <div className="space-y-1.5">
              <Label htmlFor="u-kapital">Investiertes Kapital (€)</Label>
              <Input
                id="u-kapital"
                type="number"
                value={uKapital}
                onChange={e => setUKapital(e.target.value)}
                placeholder="z.B. 500000"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-invdatum">Investitionsdatum</Label>
              <Input
                id="u-invdatum"
                type="date"
                value={uInvDatum}
                onChange={e => setUInvDatum(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-stadt">Stadt</Label>
              <Input
                id="u-stadt"
                value={uStadt}
                onChange={e => setUStadt(e.target.value)}
                placeholder="z.B. Berlin"
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-secondary/30 p-4 space-y-3">
            <p className="text-sm font-medium">Ansprechpartner</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="u-vorname">Vorname</Label>
                <Input
                  id="u-vorname"
                  value={uVorname}
                  onChange={e => setUVorname(e.target.value)}
                  placeholder="Vorname"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-nachname">Nachname</Label>
                <Input
                  id="u-nachname"
                  value={uNachname}
                  onChange={e => setUNachname(e.target.value)}
                  placeholder="Nachname"
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="u-email">E-Mail</Label>
                <Input
                  id="u-email"
                  type="email"
                  value={uEmail}
                  onChange={e => setUEmail(e.target.value)}
                  placeholder="email@beispiel.de"
                />
              </div>
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleStep1}
              disabled={!uName.trim() || submitting}
              className="gap-2"
            >
              Weiter zu Ersttermin
              <IconChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Ersttermin anlegen */}
      {step === 2 && (
        <div className="space-y-6">
          {!unternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht das Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => handleStepChange(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <IconCalendarPlus size={18} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">Ersttermin anlegen</h2>
                  <p className="text-sm text-muted-foreground">Erster Termin für <strong>{unternehmenName}</strong></p>
                </div>
              </div>

              <LiveSummary />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="t-bezeichnung">Terminbezeichnung *</Label>
                  <Input
                    id="t-bezeichnung"
                    value={tBezeichnung}
                    onChange={e => setTBezeichnung(e.target.value)}
                    placeholder={`Ersttermin – ${unternehmenName}`}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="t-art">Terminart *</Label>
                  <Select value={tArt} onValueChange={setTArt}>
                    <SelectTrigger id="t-art" className="w-full">
                      <SelectValue placeholder="Bitte wählen" />
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
                  <Label htmlFor="t-datum">Datum & Uhrzeit *</Label>
                  <Input
                    id="t-datum"
                    type="datetime-local"
                    value={tDatum}
                    onChange={e => setTDatum(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="t-ort">Ort</Label>
                  <Input
                    id="t-ort"
                    value={tOrt}
                    onChange={e => setTOrt(e.target.value)}
                    placeholder="z.B. Büro Berlin"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Terminstatus</Label>
                  <div className="flex flex-wrap gap-2">
                    {TERMINSTATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setTStatus(opt.key)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                          tStatus === opt.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border hover:bg-secondary'
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

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleStepChange(1)}>
                  Zurück
                </Button>
                <Button
                  onClick={handleStep2}
                  disabled={!tBezeichnung.trim() || tArt === 'none' || !tDatum || submitting}
                  className="gap-2"
                >
                  Weiter zu Dokument
                  <IconChevronRight size={16} />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3: Erstes Dokument */}
      {step === 3 && (
        <div className="space-y-6">
          {!unternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht das Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => handleStepChange(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <IconFileText size={18} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">Erstes Dokument erfassen</h2>
                  <p className="text-sm text-muted-foreground">Dokument für <strong>{unternehmenName}</strong> anlegen</p>
                </div>
              </div>

              <LiveSummary />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="d-bezeichnung">Dokumentenbezeichnung *</Label>
                  <Input
                    id="d-bezeichnung"
                    value={dBezeichnung}
                    onChange={e => setDBezeichnung(e.target.value)}
                    placeholder="z.B. Beteiligungsvertrag 2026"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="d-typ">Dokumententyp</Label>
                  <Select value={dTyp} onValueChange={setDTyp}>
                    <SelectTrigger id="d-typ" className="w-full">
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

                <div className="space-y-1.5">
                  <Label htmlFor="d-datum">Dokumentendatum</Label>
                  <Input
                    id="d-datum"
                    type="date"
                    value={dDatum}
                    onChange={e => setDDatum(e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="d-link">Dokumentenlink (URL)</Label>
                  <Input
                    id="d-link"
                    type="url"
                    value={dLink}
                    onChange={e => setDLink(e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
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

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleStepChange(2)}>
                  Zurück
                </Button>
                <Button
                  onClick={handleStep3}
                  disabled={!dBezeichnung.trim() || submitting}
                  className="gap-2"
                >
                  Weiter zu Notiz
                  <IconChevronRight size={16} />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 4: Eröffnungsnotiz */}
      {step === 4 && (
        <div className="space-y-6">
          {!unternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht das Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => handleStepChange(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <IconNotes size={18} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">Eröffnungsnotiz erstellen</h2>
                  <p className="text-sm text-muted-foreground">Erste Notiz für <strong>{unternehmenName}</strong></p>
                </div>
              </div>

              <LiveSummary />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="n-titel">Notiz-Titel *</Label>
                  <Input
                    id="n-titel"
                    value={nTitel}
                    onChange={e => setNTitel(e.target.value)}
                    placeholder={`Onboarding – ${unternehmenName}`}
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="n-inhalt">Notiz-Inhalt *</Label>
                  <Textarea
                    id="n-inhalt"
                    value={nInhalt}
                    onChange={e => setNInhalt(e.target.value)}
                    placeholder="Erster Eindruck, wichtige Punkte, nächste Schritte …"
                    rows={4}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="n-datum">Datum *</Label>
                  <Input
                    id="n-datum"
                    type="date"
                    value={nDatum}
                    onChange={e => setNDatum(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="n-kategorie">Kategorie</Label>
                  <Select value={nKategorie} onValueChange={setNKategorie}>
                    <SelectTrigger id="n-kategorie" className="w-full">
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {KATEGORIE_OPTIONS.map(opt => (
                        <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Priorität</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRIORITAET_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setNPrioritaet(opt.key)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                          nPrioritaet === opt.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border hover:bg-secondary'
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

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleStepChange(3)}>
                  Zurück
                </Button>
                <Button
                  onClick={handleStep4}
                  disabled={!nTitel.trim() || !nInhalt.trim() || !nDatum || submitting}
                  className="gap-2"
                >
                  <IconCheck size={16} />
                  Onboarding abschließen
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
