/**
 * Portfolio-Onboarding — 4-Schritt-Wizard für neue Portfoliounternehmen.
 * Steps: 1) Stammdaten erfassen → 2) Ersttermin buchen → 3) Eröffnungsdokument erfassen (optional) → 4) Begrüßungsnotiz anlegen & Abschluss.
 * Reads: unternehmen (für Kontextanzeige). Writes: unternehmen (createUnternehmenEntry), termine (createTermineEntry), dokumente (createDokumenteEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconBuilding,
  IconCalendar,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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

export default function PortfolioOnboardingPage() {
  const { loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // IDs created during the wizard (idempotency guards)
  const [createdUnternehmenId, setCreatedUnternehmenId] = useState<string | null>(null);
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);
  const [createdDokumentId, setCreatedDokumentId] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);

  // Step 1 — Stammdaten
  const [uName, setUName] = useState('');
  const [uRechtsform, setURechtsform] = useState('');
  const [uBranche, setUBranche] = useState('');
  const [uStatus, setUStatus] = useState(STATUS_OPTIONS[0]?.key ?? 'aktiv');
  const [uKapital, setUKapital] = useState('');
  const [uInvDatum, setUInvDatum] = useState('');
  const [uStadt, setUStadt] = useState('');
  const [uVorname, setUVorname] = useState('');
  const [uNachname, setUNachname] = useState('');
  const [uEmail, setUEmail] = useState('');

  // Step 2 — Termin
  const [tBezeichnung, setTBezeichnung] = useState('Erstgespräch');
  const [tArt, setTArt] = useState('');
  const [tDatum, setTDatum] = useState('');
  const [tOrt, setTOrt] = useState('');
  const [tStatus, setTStatus] = useState('geplant');

  // Step 3 — Dokument (optional)
  const [dBezeichnung, setDBezeichnung] = useState('');
  const [dTyp, setDTyp] = useState('');
  const [dDatum, setDDatum] = useState('');
  const [dLink, setDLink] = useState('');
  const [dBereitgestellt, setDBereitgestellt] = useState('');
  const [skipDokument, setSkipDokument] = useState(false);

  // Step 4 — Notiz
  const [nTitel, setNTitel] = useState('Onboarding-Notiz');
  const [nInhalt, setNInhalt] = useState('');
  const [nDatum, setNDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [nKategorie, setNKategorie] = useState('allgemein');
  const [nPrioritaet, setNPrioritaet] = useState('mittel');

  const handleCreateUnternehmen = async () => {
    if (!uName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let uid = createdUnternehmenId;
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
        setCreatedUnternehmenId(uid);
        await fetchAll();
      }
      setStep(2);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Unternehmens.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTermin = async () => {
    if (!tBezeichnung.trim() || !tDatum || !createdUnternehmenId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let tid = createdTerminId;
      if (!tid) {
        const payload: Record<string, unknown> = {
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, createdUnternehmenId),
          terminbezeichnung: tBezeichnung.trim(),
          datum_uhrzeit: tDatum,
          terminstatus: tStatus,
        };
        if (tArt && tArt !== 'none') payload.terminart = tArt;
        if (tOrt.trim()) payload.ort = tOrt.trim();

        const result = await LivingAppsService.createTermineEntry(payload);
        tid = result.record_id;
        setCreatedTerminId(tid);
        await fetchAll();
      }
      setStep(3);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Termins.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipOrCreateDokument = async (skip: boolean) => {
    if (skip) {
      setSkipDokument(true);
      setStep(4);
      return;
    }
    if (!dBezeichnung.trim() || !createdUnternehmenId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let did = createdDokumentId;
      if (!did) {
        const payload: Record<string, unknown> = {
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, createdUnternehmenId),
          dokumentenbezeichnung: dBezeichnung.trim(),
        };
        if (dTyp && dTyp !== 'none') payload.dokumententyp = dTyp;
        if (dDatum) payload.dokumentendatum = dDatum;
        if (dLink.trim()) payload.dokumentenlink = dLink.trim();
        if (dBereitgestellt.trim()) payload.bereitgestellt_von = dBereitgestellt.trim();

        const result = await LivingAppsService.createDokumenteEntry(payload);
        did = result.record_id;
        setCreatedDokumentId(did);
        await fetchAll();
      }
      setStep(4);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Dokuments.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNotiz = async () => {
    if (!nTitel.trim() || !nInhalt.trim() || !createdUnternehmenId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let nid = createdNotizId;
      if (!nid) {
        const payload: Record<string, unknown> = {
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, createdUnternehmenId),
          notiz_titel: nTitel.trim(),
          notiz_inhalt: nInhalt.trim(),
          notiz_datum: nDatum,
          kategorie: nKategorie,
          prioritaet: nPrioritaet,
        };

        const result = await LivingAppsService.createNotizenEntry(payload);
        nid = result.record_id;
        setCreatedNotizId(nid);
        await fetchAll();
      }
      setStep(5);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen der Notiz.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setCreatedUnternehmenId(null);
    setCreatedTerminId(null);
    setCreatedDokumentId(null);
    setCreatedNotizId(null);
    setSubmitError(null);
    setUName('');
    setURechtsform('');
    setUBranche('');
    setUStatus(STATUS_OPTIONS[0]?.key ?? 'aktiv');
    setUKapital('');
    setUInvDatum('');
    setUStadt('');
    setUVorname('');
    setUNachname('');
    setUEmail('');
    setTBezeichnung('Erstgespräch');
    setTArt('');
    setTDatum('');
    setTOrt('');
    setTStatus('geplant');
    setDBezeichnung('');
    setDTyp('');
    setDDatum('');
    setDLink('');
    setDBereitgestellt('');
    setSkipDokument(false);
    setNTitel('Onboarding-Notiz');
    setNInhalt('');
    setNDatum(format(new Date(), 'yyyy-MM-dd'));
    setNKategorie('allgemein');
    setNPrioritaet('mittel');
  };

  const wizardSteps = [
    { label: 'Stammdaten' },
    { label: 'Ersttermin' },
    { label: 'Dokument' },
    { label: 'Notiz' },
    { label: 'Fertig' },
  ];

  return (
    <IntentWizardShell
      title="Neues Portfoliounternehmen"
      subtitle={
        createdUnternehmenId && uName
          ? `Onboarding: ${uName}`
          : 'Schritt für Schritt zum vollständigen Eintrag'
      }
      steps={wizardSteps}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Stammdaten ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-primary/10 p-2">
              <IconBuilding size={22} className="text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Unternehmen anlegen</h2>
              <p className="text-sm text-muted-foreground">Stammdaten des neuen Portfoliounternehmens</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="u-name">Unternehmensname *</Label>
              <Input
                id="u-name"
                value={uName}
                onChange={e => setUName(e.target.value)}
                placeholder="z. B. Muster GmbH"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="u-rechtsform">Rechtsform</Label>
              <Select value={uRechtsform || 'none'} onValueChange={v => setURechtsform(v === 'none' ? '' : v)}>
                <SelectTrigger id="u-rechtsform">
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

            <div className="space-y-1">
              <Label htmlFor="u-branche">Branche</Label>
              <Select value={uBranche || 'none'} onValueChange={v => setUBranche(v === 'none' ? '' : v)}>
                <SelectTrigger id="u-branche">
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

            <div className="space-y-1">
              <Label htmlFor="u-status">Status *</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setUStatus(o.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      uStatus === o.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-foreground hover:bg-secondary'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="u-stadt">Stadt</Label>
              <Input
                id="u-stadt"
                value={uStadt}
                onChange={e => setUStadt(e.target.value)}
                placeholder="z. B. Berlin"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="u-kapital">Investiertes Kapital (€)</Label>
              <Input
                id="u-kapital"
                type="number"
                value={uKapital}
                onChange={e => setUKapital(e.target.value)}
                placeholder="z. B. 500000"
                min={0}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="u-invdatum">Investitionsdatum</Label>
              <Input
                id="u-invdatum"
                type="date"
                value={uInvDatum}
                onChange={e => setUInvDatum(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-secondary/30 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Ansprechpartner</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="u-vorname">Vorname</Label>
                <Input
                  id="u-vorname"
                  value={uVorname}
                  onChange={e => setUVorname(e.target.value)}
                  placeholder="Vorname"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-nachname">Nachname</Label>
                <Input
                  id="u-nachname"
                  value={uNachname}
                  onChange={e => setUNachname(e.target.value)}
                  placeholder="Nachname"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="u-email">E-Mail</Label>
                <Input
                  id="u-email"
                  type="email"
                  value={uEmail}
                  onChange={e => setUEmail(e.target.value)}
                  placeholder="kontakt@unternehmen.de"
                />
              </div>
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{submitError}</p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleCreateUnternehmen}
              disabled={!uName.trim() || submitting}
              className="gap-2"
            >
              {submitting ? 'Wird angelegt …' : 'Unternehmen anlegen'}
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Ersttermin ─────────────────────────────────────────────── */}
      {step === 2 && (
        createdUnternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-primary/10 p-2">
                <IconCalendar size={22} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Ersttermin buchen</h2>
                <p className="text-sm text-muted-foreground">
                  Termin für <span className="font-medium text-foreground">{uName}</span> anlegen
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="t-bezeichnung">Terminbezeichnung *</Label>
                <Input
                  id="t-bezeichnung"
                  value={tBezeichnung}
                  onChange={e => setTBezeichnung(e.target.value)}
                  placeholder="z. B. Erstgespräch"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="t-art">Terminart</Label>
                <Select value={tArt || 'none'} onValueChange={v => setTArt(v === 'none' ? '' : v)}>
                  <SelectTrigger id="t-art">
                    <SelectValue placeholder="Art wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Angabe</SelectItem>
                    {TERMINART_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="t-ort">Ort</Label>
                <Input
                  id="t-ort"
                  value={tOrt}
                  onChange={e => setTOrt(e.target.value)}
                  placeholder="z. B. Büro Berlin"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="t-datum">Datum & Uhrzeit *</Label>
                <Input
                  id="t-datum"
                  type="datetime-local"
                  value={tDatum}
                  onChange={e => setTDatum(e.target.value)}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label>Terminstatus</Label>
                <div className="flex flex-wrap gap-2">
                  {TERMINSTATUS_OPTIONS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setTStatus(o.key)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        tStatus === o.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-foreground hover:bg-secondary'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {submitError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{submitError}</p>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <IconArrowLeft size={16} />
                Zurück
              </Button>
              <Button
                onClick={handleCreateTermin}
                disabled={!tBezeichnung.trim() || !tDatum || submitting}
                className="gap-2"
              >
                {submitting ? 'Wird angelegt …' : 'Termin anlegen'}
                <IconArrowRight size={16} />
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht das Unternehmen aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Step 3: Eröffnungsdokument (optional) ──────────────────────────── */}
      {step === 3 && (
        createdUnternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-primary/10 p-2">
                <IconFileText size={22} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Eröffnungsdokument erfassen</h2>
                <p className="text-sm text-muted-foreground">
                  Optional — du kannst diesen Schritt überspringen.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="d-bezeichnung">Dokumentenbezeichnung *</Label>
                <Input
                  id="d-bezeichnung"
                  value={dBezeichnung}
                  onChange={e => setDBezeichnung(e.target.value)}
                  placeholder="z. B. Beteiligungsvertrag 2025"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="d-typ">Dokumententyp</Label>
                <Select value={dTyp || 'none'} onValueChange={v => setDTyp(v === 'none' ? '' : v)}>
                  <SelectTrigger id="d-typ">
                    <SelectValue placeholder="Typ wählen" />
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
                <Label htmlFor="d-datum">Dokumentendatum</Label>
                <Input
                  id="d-datum"
                  type="date"
                  value={dDatum}
                  onChange={e => setDDatum(e.target.value)}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="d-link">Dokumentenlink (URL)</Label>
                <Input
                  id="d-link"
                  type="url"
                  value={dLink}
                  onChange={e => setDLink(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="d-bereitgestellt">Bereitgestellt von</Label>
                <Input
                  id="d-bereitgestellt"
                  value={dBereitgestellt}
                  onChange={e => setDBereitgestellt(e.target.value)}
                  placeholder="Name oder Abteilung"
                />
              </div>
            </div>

            {submitError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{submitError}</p>
            )}

            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                <IconArrowLeft size={16} />
                Zurück
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSkipOrCreateDokument(true)}
                  disabled={submitting}
                  className="gap-2"
                >
                  <IconPlayerSkipForward size={16} />
                  Überspringen
                </Button>
                <Button
                  onClick={() => handleSkipOrCreateDokument(false)}
                  disabled={!dBezeichnung.trim() || submitting}
                  className="gap-2"
                >
                  {submitting ? 'Wird angelegt …' : 'Dokument anlegen'}
                  <IconArrowRight size={16} />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht das Unternehmen aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Step 4: Begrüßungsnotiz ────────────────────────────────────────── */}
      {step === 4 && (
        createdUnternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-primary/10 p-2">
                <IconNotes size={22} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Begrüßungsnotiz anlegen</h2>
                <p className="text-sm text-muted-foreground">
                  Erste Notiz für <span className="font-medium text-foreground">{uName}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="n-titel">Notiz-Titel *</Label>
                <Input
                  id="n-titel"
                  value={nTitel}
                  onChange={e => setNTitel(e.target.value)}
                  placeholder="z. B. Onboarding-Notiz"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="n-inhalt">Notiz-Inhalt *</Label>
                <Textarea
                  id="n-inhalt"
                  value={nInhalt}
                  onChange={e => setNInhalt(e.target.value)}
                  placeholder="Erste Eindrücke, Ziele, wichtige Vereinbarungen …"
                  rows={4}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="n-datum">Datum *</Label>
                <Input
                  id="n-datum"
                  type="date"
                  value={nDatum}
                  onChange={e => setNDatum(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="n-kategorie">Kategorie</Label>
                <Select value={nKategorie} onValueChange={setNKategorie}>
                  <SelectTrigger id="n-kategorie">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KATEGORIE_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label>Priorität</Label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITAET_OPTIONS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setNPrioritaet(o.key)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        nPrioritaet === o.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-foreground hover:bg-secondary'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {submitError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{submitError}</p>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)} className="gap-2">
                <IconArrowLeft size={16} />
                Zurück
              </Button>
              <Button
                onClick={handleCreateNotiz}
                disabled={!nTitel.trim() || !nInhalt.trim() || !nDatum || submitting}
                className="gap-2"
              >
                {submitting ? 'Wird angelegt …' : 'Notiz anlegen & abschließen'}
                <IconArrowRight size={16} />
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht das Unternehmen aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Step 5: Abschluss ─────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3 text-center py-4">
            <div className="rounded-full bg-primary/10 p-4">
              <IconCheck size={32} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Onboarding abgeschlossen!</h2>
            <p className="text-muted-foreground max-w-md">
              <span className="font-semibold text-foreground">{uName}</span> wurde erfolgreich als
              Portfoliounternehmen aufgenommen.
            </p>
          </div>

          <div className="rounded-2xl border bg-card overflow-hidden divide-y divide-border">
            <div className="px-4 py-3 bg-secondary/30">
              <p className="text-sm font-semibold text-foreground">Angelegte Einträge</p>
            </div>

            {createdUnternehmenId && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="rounded-lg bg-primary/10 p-1.5">
                  <IconBuilding size={16} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">Unternehmen: {uName}</p>
                  <p className="text-xs text-muted-foreground">Stammdaten erfasst</p>
                </div>
                <IconCheck size={16} className="text-primary ml-auto shrink-0" />
              </div>
            )}

            {createdTerminId && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="rounded-lg bg-primary/10 p-1.5">
                  <IconCalendar size={16} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">Termin: {tBezeichnung}</p>
                  <p className="text-xs text-muted-foreground">{tDatum ? tDatum.replace('T', ' ') : ''}</p>
                </div>
                <IconCheck size={16} className="text-primary ml-auto shrink-0" />
              </div>
            )}

            {createdDokumentId && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="rounded-lg bg-primary/10 p-1.5">
                  <IconFileText size={16} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">Dokument: {dBezeichnung}</p>
                  <p className="text-xs text-muted-foreground">Eröffnungsdokument registriert</p>
                </div>
                <IconCheck size={16} className="text-primary ml-auto shrink-0" />
              </div>
            )}

            {skipDokument && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="rounded-lg bg-secondary p-1.5">
                  <IconFileText size={16} className="text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Dokument übersprungen</p>
                </div>
                <IconPlayerSkipForward size={16} className="text-muted-foreground ml-auto shrink-0" />
              </div>
            )}

            {createdNotizId && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="rounded-lg bg-primary/10 p-1.5">
                  <IconNotes size={16} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">Notiz: {nTitel}</p>
                  <p className="text-xs text-muted-foreground">Begrüßungsnotiz angelegt</p>
                </div>
                <IconCheck size={16} className="text-primary ml-auto shrink-0" />
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <IconBuilding size={16} />
              Weiteres Unternehmen aufnehmen
            </Button>
            <a href="#/">
              <Button className="w-full sm:w-auto gap-2">
                Zurück zum Dashboard
              </Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
