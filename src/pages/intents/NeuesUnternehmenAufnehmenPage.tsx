/**
 * Neues Unternehmen aufnehmen — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen anlegen → 2) Ersten Termin planen (optional) →
 *        3) Erstes Dokument hinzufügen (optional) → 4) Erste Notiz erfassen (optional) → Abschluss.
 * Reads: (keine bestehenden Datensätze nötig). Writes: unternehmen (createUnternehmenEntry),
 *        termine (createTermineEntry), dokumente (createDokumenteEntry), notizen (createNotizenEntry).
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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

export default function NeuesUnternehmenAufnehmenPage() {
  const { loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Created record ids (idempotency guards)
  const [createdUnternehmenId, setCreatedUnternehmenId] = useState<string | null>(null);
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);
  const [createdDokumentId, setCreatedDokumentId] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);

  // Summary tracking
  const [unternehmenName, setUnternehmenName] = useState('');
  const [terminCreated, setTerminCreated] = useState(false);
  const [dokumentCreated, setDokumentCreated] = useState(false);
  const [notizCreated, setNotizCreated] = useState(false);

  // Step 1 — Unternehmen
  const [uName, setUName] = useState('');
  const [uRechtsform, setURechtsform] = useState('none');
  const [uBranche, setUBranche] = useState('none');
  const [uStatus, setUStatus] = useState(STATUS_OPTIONS[0]?.key ?? 'aktiv');
  const [uKapital, setUKapital] = useState('');
  const [uQuote, setUQuote] = useState('');
  const [uInvDatum, setUInvDatum] = useState('');
  const [uStadt, setUStadt] = useState('');
  const [uLand, setULand] = useState('');
  const [uVorname, setUVorname] = useState('');
  const [uNachname, setUNachname] = useState('');
  const [uEmail, setUEmail] = useState('');

  // Step 2 — Termin
  const [tBezeichnung, setTBezeichnung] = useState('');
  const [tArt, setTArt] = useState('none');
  const [tDatumUhrzeit, setTDatumUhrzeit] = useState('');
  const [tOrt, setTOrt] = useState('');
  const [tStatus, setTStatus] = useState(TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant');

  // Step 3 — Dokument
  const [dBezeichnung, setDBezeichnung] = useState('');
  const [dTyp, setDTyp] = useState('none');
  const [dLink, setDLink] = useState('');
  const [dDatum, setDDatum] = useState('');
  const [dBereitgestellt, setDBereitgestellt] = useState('');

  // Step 4 — Notiz
  const [nTitel, setNTitel] = useState('');
  const [nInhalt, setNInhalt] = useState('');
  const [nDatum, setNDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [nKategorie, setNKategorie] = useState('none');
  const [nPrioritaet, setNPrioritaet] = useState('none');

  const handleCreateUnternehmen = async () => {
    if (!uName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let uid = createdUnternehmenId;
      if (!uid) {
        const payload: Record<string, unknown> = { name: uName.trim(), status: uStatus };
        if (uRechtsform !== 'none') payload.rechtsform = uRechtsform;
        if (uBranche !== 'none') payload.branche = uBranche;
        if (uKapital) payload.investiertes_kapital = parseFloat(uKapital);
        if (uQuote) payload.beteiligungsquote = parseFloat(uQuote);
        if (uInvDatum) payload.investitionsdatum = uInvDatum;
        if (uStadt.trim()) payload.stadt = uStadt.trim();
        if (uLand.trim()) payload.land = uLand.trim();
        if (uVorname.trim()) payload.ansprechpartner_vorname = uVorname.trim();
        if (uNachname.trim()) payload.ansprechpartner_nachname = uNachname.trim();
        if (uEmail.trim()) payload.ansprechpartner_email = uEmail.trim();
        const result = await LivingAppsService.createUnternehmenEntry(payload as Parameters<typeof LivingAppsService.createUnternehmenEntry>[0]);
        uid = result.record_id;
        setCreatedUnternehmenId(uid);
        setUnternehmenName(uName.trim());
        await fetchAll();
      }
      setStep(2);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Unternehmens');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTermin = async () => {
    if (!tBezeichnung.trim() || tArt === 'none' || !tDatumUhrzeit) return;
    if (!createdUnternehmenId) { setStep(1); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      let tid = createdTerminId;
      if (!tid) {
        const payload: Record<string, unknown> = {
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, createdUnternehmenId),
          terminbezeichnung: tBezeichnung.trim(),
          terminart: tArt,
          datum_uhrzeit: tDatumUhrzeit,
          terminstatus: tStatus,
        };
        if (tOrt.trim()) payload.ort = tOrt.trim();
        const result = await LivingAppsService.createTermineEntry(payload as Parameters<typeof LivingAppsService.createTermineEntry>[0]);
        tid = result.record_id;
        setCreatedTerminId(tid);
        setTerminCreated(true);
        await fetchAll();
      }
      setStep(3);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Termins');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDokument = async () => {
    if (!dBezeichnung.trim()) return;
    if (!createdUnternehmenId) { setStep(1); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      let did = createdDokumentId;
      if (!did) {
        const payload: Record<string, unknown> = {
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, createdUnternehmenId),
          dokumentenbezeichnung: dBezeichnung.trim(),
        };
        if (dTyp !== 'none') payload.dokumententyp = dTyp;
        if (dLink.trim()) payload.dokumentenlink = dLink.trim();
        if (dDatum) payload.dokumentendatum = dDatum;
        if (dBereitgestellt.trim()) payload.bereitgestellt_von = dBereitgestellt.trim();
        const result = await LivingAppsService.createDokumenteEntry(payload as Parameters<typeof LivingAppsService.createDokumenteEntry>[0]);
        did = result.record_id;
        setCreatedDokumentId(did);
        setDokumentCreated(true);
        await fetchAll();
      }
      setStep(4);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Dokuments');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNotiz = async () => {
    if (!nTitel.trim() || !nInhalt.trim() || !nDatum) return;
    if (!createdUnternehmenId) { setStep(1); return; }
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
        };
        if (nKategorie !== 'none') payload.kategorie = nKategorie;
        if (nPrioritaet !== 'none') payload.prioritaet = nPrioritaet;
        const result = await LivingAppsService.createNotizenEntry(payload as Parameters<typeof LivingAppsService.createNotizenEntry>[0]);
        nid = result.record_id;
        setCreatedNotizId(nid);
        setNotizCreated(true);
        await fetchAll();
      }
      setStep(5);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen der Notiz');
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
    setUnternehmenName('');
    setTerminCreated(false);
    setDokumentCreated(false);
    setNotizCreated(false);
    setUName(''); setURechtsform('none'); setUBranche('none');
    setUStatus(STATUS_OPTIONS[0]?.key ?? 'aktiv');
    setUKapital(''); setUQuote(''); setUInvDatum('');
    setUStadt(''); setULand(''); setUVorname(''); setUNachname(''); setUEmail('');
    setTBezeichnung(''); setTArt('none'); setTDatumUhrzeit(''); setTOrt('');
    setTStatus(TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant');
    setDBezeichnung(''); setDTyp('none'); setDLink(''); setDDatum(''); setDBereitgestellt('');
    setNTitel(''); setNInhalt(''); setNDatum(format(new Date(), 'yyyy-MM-dd'));
    setNKategorie('none'); setNPrioritaet('none');
    setSubmitError(null);
  };

  return (
    <IntentWizardShell
      title="Neues Unternehmen aufnehmen"
      subtitle="Stammdaten, Termin, Dokument und Notiz in einem Ablauf"
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
      {/* Step 1 — Unternehmen anlegen */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <IconBuilding size={22} className="text-primary" stroke={1.5} />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Unternehmen anlegen</h2>
              <p className="text-sm text-muted-foreground">Stammdaten des neuen Portfolio-Unternehmens</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="u-name">Name *</Label>
              <Input
                id="u-name"
                value={uName}
                onChange={e => setUName(e.target.value)}
                placeholder="Unternehmensname"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Rechtsform</Label>
              <Select value={uRechtsform} onValueChange={setURechtsform}>
                <SelectTrigger className="w-full">
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
              <Label>Branche</Label>
              <Select value={uBranche} onValueChange={setUBranche}>
                <SelectTrigger className="w-full">
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
              <Label>Status *</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setUStatus(o.key)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
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
              <Label htmlFor="u-kapital">Investiertes Kapital (€)</Label>
              <Input
                id="u-kapital"
                type="number"
                value={uKapital}
                onChange={e => setUKapital(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-quote">Beteiligungsquote (%)</Label>
              <Input
                id="u-quote"
                type="number"
                value={uQuote}
                onChange={e => setUQuote(e.target.value)}
                placeholder="0"
                min="0"
                max="100"
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

            <div className="space-y-1.5">
              <Label htmlFor="u-land">Land</Label>
              <Input
                id="u-land"
                value={uLand}
                onChange={e => setULand(e.target.value)}
                placeholder="z.B. Deutschland"
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-secondary/30 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Ansprechpartner (optional)</p>
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
                  placeholder="name@beispiel.de"
                />
              </div>
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleCreateUnternehmen}
              disabled={!uName.trim() || submitting}
              className="gap-2"
            >
              {submitting ? 'Wird angelegt…' : 'Unternehmen anlegen'}
              <IconArrowRight size={16} stroke={2} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 — Ersten Termin planen */}
      {step === 2 && (
        <div className="space-y-6">
          {!createdUnternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht ein Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <IconCalendarPlus size={22} className="text-primary" stroke={1.5} />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Ersten Termin planen</h2>
                  <p className="text-sm text-muted-foreground">Optionaler Schritt — du kannst ihn überspringen</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="t-bezeichnung">Terminbezeichnung *</Label>
                  <Input
                    id="t-bezeichnung"
                    value={tBezeichnung}
                    onChange={e => setTBezeichnung(e.target.value)}
                    placeholder="z.B. Erstgespräch Q3"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Terminart *</Label>
                  <Select value={tArt} onValueChange={setTArt}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Terminart wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Bitte wählen</SelectItem>
                      {TERMINART_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="t-datum">Datum & Uhrzeit *</Label>
                  <Input
                    id="t-datum"
                    type="datetime-local"
                    value={tDatumUhrzeit}
                    onChange={e => setTDatumUhrzeit(e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="t-ort">Ort</Label>
                  <Input
                    id="t-ort"
                    value={tOrt}
                    onChange={e => setTOrt(e.target.value)}
                    placeholder="z.B. Büro München"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Terminstatus</Label>
                  <div className="flex flex-wrap gap-2">
                    {TERMINSTATUS_OPTIONS.map(o => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setTStatus(o.key)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
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
                <p className="text-sm text-destructive">{submitError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(3)}
                  className="gap-2"
                >
                  <IconPlayerSkipForward size={16} stroke={2} />
                  Schritt überspringen
                </Button>
                <Button
                  onClick={handleCreateTermin}
                  disabled={!tBezeichnung.trim() || tArt === 'none' || !tDatumUhrzeit || submitting}
                  className="gap-2"
                >
                  {submitting ? 'Wird angelegt…' : 'Termin anlegen'}
                  <IconArrowRight size={16} stroke={2} />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3 — Erstes Dokument hinzufügen */}
      {step === 3 && (
        <div className="space-y-6">
          {!createdUnternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht ein Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <IconFileText size={22} className="text-primary" stroke={1.5} />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Erstes Dokument hinzufügen</h2>
                  <p className="text-sm text-muted-foreground">Optionaler Schritt — du kannst ihn überspringen</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="d-bezeichnung">Dokumentenbezeichnung *</Label>
                  <Input
                    id="d-bezeichnung"
                    value={dBezeichnung}
                    onChange={e => setDBezeichnung(e.target.value)}
                    placeholder="z.B. Gesellschaftsvertrag 2024"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Dokumententyp</Label>
                  <Select value={dTyp} onValueChange={setDTyp}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Typ wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Typ</SelectItem>
                      {DOKUMENTENTYP_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
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
                  <Label htmlFor="d-bereit">Bereitgestellt von</Label>
                  <Input
                    id="d-bereit"
                    value={dBereitgestellt}
                    onChange={e => setDBereitgestellt(e.target.value)}
                    placeholder="Name oder Abteilung"
                  />
                </div>
              </div>

              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(4)}
                  className="gap-2"
                >
                  <IconPlayerSkipForward size={16} stroke={2} />
                  Schritt überspringen
                </Button>
                <Button
                  onClick={handleCreateDokument}
                  disabled={!dBezeichnung.trim() || submitting}
                  className="gap-2"
                >
                  {submitting ? 'Wird angelegt…' : 'Dokument anlegen'}
                  <IconArrowRight size={16} stroke={2} />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 4 — Erste Notiz erfassen */}
      {step === 4 && (
        <div className="space-y-6">
          {!createdUnternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht ein Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <IconNotes size={22} className="text-primary" stroke={1.5} />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Erste Notiz erfassen</h2>
                  <p className="text-sm text-muted-foreground">Optionaler Schritt — du kannst ihn überspringen</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="n-titel">Titel *</Label>
                  <Input
                    id="n-titel"
                    value={nTitel}
                    onChange={e => setNTitel(e.target.value)}
                    placeholder="Notiz-Titel"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="n-inhalt">Inhalt *</Label>
                  <Textarea
                    id="n-inhalt"
                    value={nInhalt}
                    onChange={e => setNInhalt(e.target.value)}
                    placeholder="Notizinhalt…"
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
                  <Label>Kategorie</Label>
                  <Select value={nKategorie} onValueChange={setNKategorie}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Kategorie wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keine Kategorie</SelectItem>
                      {KATEGORIE_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Priorität</Label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setNPrioritaet('none')}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                        nPrioritaet === 'none'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-foreground hover:bg-secondary'
                      }`}
                    >
                      Keine
                    </button>
                    {PRIORITAET_OPTIONS.map(o => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setNPrioritaet(o.key)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
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
                <p className="text-sm text-destructive">{submitError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(5)}
                  className="gap-2"
                >
                  <IconPlayerSkipForward size={16} stroke={2} />
                  Schritt überspringen
                </Button>
                <Button
                  onClick={handleCreateNotiz}
                  disabled={!nTitel.trim() || !nInhalt.trim() || !nDatum || submitting}
                  className="gap-2"
                >
                  {submitting ? 'Wird angelegt…' : 'Notiz anlegen'}
                  <IconArrowRight size={16} stroke={2} />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 5 — Abschluss */}
      {step === 5 && (
        <div className="space-y-6">
          {!createdUnternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Kein Unternehmen gefunden. Bitte von vorne beginnen.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-500/10">
                  <IconCheck size={22} className="text-green-600" stroke={2} />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Unternehmen erfolgreich aufgenommen</h2>
                  <p className="text-sm text-muted-foreground">Alle gewählten Datensätze wurden angelegt</p>
                </div>
              </div>

              <div className="rounded-2xl border bg-card shadow-lg overflow-hidden">
                <div className="p-5 border-b bg-secondary/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Zusammenfassung</p>
                  <p className="text-xl font-bold text-foreground mt-1">{unternehmenName}</p>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className={`rounded-xl p-4 text-center border ${terminCreated ? 'bg-green-500/10 border-green-200' : 'bg-secondary/30 border-border'}`}>
                    <IconCalendarPlus size={20} className={terminCreated ? 'text-green-600 mx-auto' : 'text-muted-foreground mx-auto'} stroke={1.5} />
                    <p className="text-sm font-medium mt-2">{terminCreated ? '1 Termin' : 'Kein Termin'}</p>
                    <p className="text-xs text-muted-foreground">angelegt</p>
                  </div>
                  <div className={`rounded-xl p-4 text-center border ${dokumentCreated ? 'bg-green-500/10 border-green-200' : 'bg-secondary/30 border-border'}`}>
                    <IconFileText size={20} className={dokumentCreated ? 'text-green-600 mx-auto' : 'text-muted-foreground mx-auto'} stroke={1.5} />
                    <p className="text-sm font-medium mt-2">{dokumentCreated ? '1 Dokument' : 'Kein Dokument'}</p>
                    <p className="text-xs text-muted-foreground">angelegt</p>
                  </div>
                  <div className={`rounded-xl p-4 text-center border ${notizCreated ? 'bg-green-500/10 border-green-200' : 'bg-secondary/30 border-border'}`}>
                    <IconNotes size={20} className={notizCreated ? 'text-green-600 mx-auto' : 'text-muted-foreground mx-auto'} stroke={1.5} />
                    <p className="text-sm font-medium mt-2">{notizCreated ? '1 Notiz' : 'Keine Notiz'}</p>
                    <p className="text-xs text-muted-foreground">angelegt</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  Weiteres Unternehmen aufnehmen
                </Button>
                <a href="#/" className="flex-1">
                  <Button className="w-full">Zurück zum Dashboard</Button>
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
