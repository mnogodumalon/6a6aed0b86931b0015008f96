/**
 * Unternehmen Onboarding — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen anlegen → 2) Ersten Termin anlegen → 3) Erstes Dokument ablegen → 4) Erste Notiz erfassen.
 * Reads: (keine Vorselektion nötig). Writes: unternehmen (createUnternehmenEntry),
 *   termine (createTermineEntry), dokumente (createDokumenteEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IconBuilding, IconCalendarPlus, IconFileText, IconNotes, IconCheck, IconCircleCheck } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const { loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1 — Unternehmen
  const [createdUnternehmenId, setCreatedUnternehmenId] = useState<string | null>(null);
  const [createdUnternehmenName, setCreatedUnternehmenName] = useState('');
  const [uName, setUName] = useState('');
  const [uRechtsform, setURechtsform] = useState('');
  const [uBranche, setUBranche] = useState('');
  const [uStatus, setUStatus] = useState(STATUS_OPTIONS[0]?.key ?? '');
  const [uBeteiligungsquote, setUBeteiligungsquote] = useState('');
  const [uInvestiertesKapital, setUInvestiertesKapital] = useState('');
  const [uInvestitionsdatum, setUInvestitionsdatum] = useState('');
  const [uStadt, setUStadt] = useState('');

  // Step 2 — Termin
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);
  const [tBezeichnung, setTBezeichnung] = useState('');
  const [tTerminart, setTTerminart] = useState('');
  const [tDatumUhrzeit, setTDatumUhrzeit] = useState('');
  const [tOrt, setTOrt] = useState('');
  const [tTerminstatus, setTTerminstatus] = useState('geplant');

  // Step 3 — Dokument
  const [createdDokumentId, setCreatedDokumentId] = useState<string | null>(null);
  const [dBezeichnung, setDBezeichnung] = useState('');
  const [dDokumententyp, setDDokumententyp] = useState('');
  const [dLink, setDLink] = useState('');
  const [dDatum, setDDatum] = useState('');
  const [dBereitgestelltVon, setDBereitgestelltVon] = useState('');

  // Step 4 — Notiz
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);
  const [nTitel, setNTitel] = useState('');
  const [nInhalt, setNInhalt] = useState('');
  const [nDatum, setNDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [nKategorie, setNKategorie] = useState('');
  const [nPrioritaet, setNPrioritaet] = useState('');

  const handleCreateUnternehmen = async () => {
    if (!uName || !uStatus) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let uid = createdUnternehmenId;
      if (!uid) {
        const payload: Record<string, unknown> = {
          name: uName,
          status: uStatus,
        };
        if (uRechtsform && uRechtsform !== 'none') payload.rechtsform = uRechtsform;
        if (uBranche && uBranche !== 'none') payload.branche = uBranche;
        if (uBeteiligungsquote) payload.beteiligungsquote = parseFloat(uBeteiligungsquote);
        if (uInvestiertesKapital) payload.investiertes_kapital = parseFloat(uInvestiertesKapital);
        if (uInvestitionsdatum) payload.investitionsdatum = uInvestitionsdatum;
        if (uStadt) payload.stadt = uStadt;
        const result = await LivingAppsService.createUnternehmenEntry(payload);
        uid = result.record_id;
        setCreatedUnternehmenId(uid);
        setCreatedUnternehmenName(uName);
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
    if (!tBezeichnung || !tTerminart || !tDatumUhrzeit || !createdUnternehmenId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let tid = createdTerminId;
      if (!tid) {
        const payload: Record<string, unknown> = {
          terminbezeichnung: tBezeichnung,
          terminart: tTerminart,
          datum_uhrzeit: tDatumUhrzeit,
          terminstatus: tTerminstatus,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, createdUnternehmenId),
        };
        if (tOrt) payload.ort = tOrt;
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

  const handleCreateDokument = async () => {
    if (!dBezeichnung || !createdUnternehmenId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let did = createdDokumentId;
      if (!did) {
        const payload: Record<string, unknown> = {
          dokumentenbezeichnung: dBezeichnung,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, createdUnternehmenId),
        };
        if (dDokumententyp && dDokumententyp !== 'none') payload.dokumententyp = dDokumententyp;
        if (dLink) payload.dokumentenlink = dLink;
        if (dDatum) payload.dokumentendatum = dDatum;
        if (dBereitgestelltVon) payload.bereitgestellt_von = dBereitgestelltVon;
        const result = await LivingAppsService.createDokumenteEntry(payload);
        did = result.record_id;
        setCreatedDokumentId(did);
        await fetchAll();
      }
      setStep(4);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Ablegen des Dokuments.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNotiz = async () => {
    if (!nTitel || !nInhalt || !nDatum || !createdUnternehmenId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let nid = createdNotizId;
      if (!nid) {
        const payload: Record<string, unknown> = {
          notiz_titel: nTitel,
          notiz_inhalt: nInhalt,
          notiz_datum: nDatum,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, createdUnternehmenId),
        };
        if (nKategorie && nKategorie !== 'none') payload.kategorie = nKategorie;
        if (nPrioritaet && nPrioritaet !== 'none') payload.prioritaet = nPrioritaet;
        const result = await LivingAppsService.createNotizenEntry(payload);
        nid = result.record_id;
        setCreatedNotizId(nid);
        await fetchAll();
      }
      setStep(5);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Erfassen der Notiz.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setCreatedUnternehmenId(null);
    setCreatedUnternehmenName('');
    setUName(''); setURechtsform(''); setUBranche('');
    setUStatus(STATUS_OPTIONS[0]?.key ?? '');
    setUBeteiligungsquote(''); setUInvestiertesKapital('');
    setUInvestitionsdatum(''); setUStadt('');
    setCreatedTerminId(null);
    setTBezeichnung(''); setTTerminart(''); setTDatumUhrzeit('');
    setTOrt(''); setTTerminstatus('geplant');
    setCreatedDokumentId(null);
    setDBezeichnung(''); setDDokumententyp(''); setDLink('');
    setDDatum(''); setDBereitgestelltVon('');
    setCreatedNotizId(null);
    setNTitel(''); setNInhalt('');
    setNDatum(format(new Date(), 'yyyy-MM-dd'));
    setNKategorie(''); setNPrioritaet('');
    setSubmitError(null);
  };

  return (
    <IntentWizardShell
      title="Unternehmen Onboarding"
      subtitle="Neues Portfolio-Unternehmen Schritt für Schritt vollständig anlegen"
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
          <div className="flex items-center gap-3 pb-2 border-b">
            <div className="rounded-full bg-primary/10 p-2">
              <IconBuilding size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Unternehmen anlegen</h2>
              <p className="text-sm text-muted-foreground">Grunddaten des neuen Portfolio-Unternehmens</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="u-name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="u-name"
                value={uName}
                onChange={e => setUName(e.target.value)}
                placeholder="Unternehmensname"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="u-rechtsform">Rechtsform</Label>
              <Select value={uRechtsform} onValueChange={setURechtsform}>
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
              <Select value={uBranche} onValueChange={setUBranche}>
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
              <Label>Status <span className="text-destructive">*</span></Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setUStatus(o.key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      uStatus === o.key
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
              <Label htmlFor="u-stadt">Stadt</Label>
              <Input
                id="u-stadt"
                value={uStadt}
                onChange={e => setUStadt(e.target.value)}
                placeholder="z.B. Berlin"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="u-beteiligungsquote">Beteiligungsquote (%)</Label>
              <Input
                id="u-beteiligungsquote"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={uBeteiligungsquote}
                onChange={e => setUBeteiligungsquote(e.target.value)}
                placeholder="z.B. 25.5"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="u-kapital">Investiertes Kapital (€)</Label>
              <Input
                id="u-kapital"
                type="number"
                min="0"
                value={uInvestiertesKapital}
                onChange={e => setUInvestiertesKapital(e.target.value)}
                placeholder="z.B. 500000"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="u-investitionsdatum">Investitionsdatum</Label>
              <Input
                id="u-investitionsdatum"
                type="date"
                value={uInvestitionsdatum}
                onChange={e => setUInvestitionsdatum(e.target.value)}
              />
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">{submitError}</p>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleCreateUnternehmen}
              disabled={!uName || !uStatus || submitting}
            >
              {submitting ? 'Wird angelegt …' : 'Weiter: Termin anlegen'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 — Ersten Termin anlegen */}
      {step === 2 && (
        <div className="space-y-6">
          {createdUnternehmenId ? (
            <>
              <div className="flex items-center gap-3 pb-2 border-b">
                <div className="rounded-full bg-primary/10 p-2">
                  <IconCalendarPlus size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Ersten Termin anlegen</h2>
                  <p className="text-sm text-muted-foreground">
                    Für <span className="font-medium text-foreground">{createdUnternehmenName}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="t-bezeichnung">Terminbezeichnung <span className="text-destructive">*</span></Label>
                  <Input
                    id="t-bezeichnung"
                    value={tBezeichnung}
                    onChange={e => setTBezeichnung(e.target.value)}
                    placeholder="z.B. Kick-Off Meeting"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="t-terminart">Terminart <span className="text-destructive">*</span></Label>
                  <Select value={tTerminart} onValueChange={setTTerminart}>
                    <SelectTrigger id="t-terminart">
                      <SelectValue placeholder="Terminart wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMINART_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="t-datum">Datum & Uhrzeit <span className="text-destructive">*</span></Label>
                  <Input
                    id="t-datum"
                    type="datetime-local"
                    value={tDatumUhrzeit}
                    onChange={e => setTDatumUhrzeit(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="t-ort">Ort</Label>
                  <Input
                    id="t-ort"
                    value={tOrt}
                    onChange={e => setTOrt(e.target.value)}
                    placeholder="z.B. Konferenzraum A"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Terminstatus</Label>
                  <div className="flex flex-wrap gap-2">
                    {TERMINSTATUS_OPTIONS.map(o => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setTTerminstatus(o.key)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          tTerminstatus === o.key
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
                <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">{submitError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>Zurück</Button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(3)}
                  >
                    Überspringen
                  </Button>
                  <Button
                    onClick={handleCreateTermin}
                    disabled={!tBezeichnung || !tTerminart || !tDatumUhrzeit || submitting}
                  >
                    {submitting ? 'Wird angelegt …' : 'Weiter: Dokument ablegen'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht ein angelegtes Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Erstes Dokument ablegen */}
      {step === 3 && (
        <div className="space-y-6">
          {createdUnternehmenId ? (
            <>
              <div className="flex items-center gap-3 pb-2 border-b">
                <div className="rounded-full bg-primary/10 p-2">
                  <IconFileText size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Erstes Dokument ablegen</h2>
                  <p className="text-sm text-muted-foreground">
                    Für <span className="font-medium text-foreground">{createdUnternehmenName}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="d-bezeichnung">Dokumentenbezeichnung <span className="text-destructive">*</span></Label>
                  <Input
                    id="d-bezeichnung"
                    value={dBezeichnung}
                    onChange={e => setDBezeichnung(e.target.value)}
                    placeholder="z.B. Gesellschaftsvertrag 2024"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="d-typ">Dokumententyp</Label>
                  <Select value={dDokumententyp} onValueChange={setDDokumententyp}>
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

                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="d-link">Dokumentenlink (URL)</Label>
                  <Input
                    id="d-link"
                    type="url"
                    value={dLink}
                    onChange={e => setDLink(e.target.value)}
                    placeholder="https://…"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="d-bereitgestellt">Bereitgestellt von</Label>
                  <Input
                    id="d-bereitgestellt"
                    value={dBereitgestelltVon}
                    onChange={e => setDBereitgestelltVon(e.target.value)}
                    placeholder="z.B. Notariat Müller"
                  />
                </div>
              </div>

              {submitError && (
                <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">{submitError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>Zurück</Button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(4)}
                  >
                    Überspringen
                  </Button>
                  <Button
                    onClick={handleCreateDokument}
                    disabled={!dBezeichnung || submitting}
                  >
                    {submitting ? 'Wird abgelegt …' : 'Weiter: Notiz erfassen'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht ein angelegtes Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          )}
        </div>
      )}

      {/* Step 4 — Erste Notiz erfassen */}
      {step === 4 && (
        <div className="space-y-6">
          {createdUnternehmenId ? (
            <>
              <div className="flex items-center gap-3 pb-2 border-b">
                <div className="rounded-full bg-primary/10 p-2">
                  <IconNotes size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Erste Notiz erfassen</h2>
                  <p className="text-sm text-muted-foreground">
                    Für <span className="font-medium text-foreground">{createdUnternehmenName}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="n-titel">Notiz-Titel <span className="text-destructive">*</span></Label>
                  <Input
                    id="n-titel"
                    value={nTitel}
                    onChange={e => setNTitel(e.target.value)}
                    placeholder="z.B. Erstgespräch — erste Eindrücke"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="n-inhalt">Notiz-Inhalt <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="n-inhalt"
                    value={nInhalt}
                    onChange={e => setNInhalt(e.target.value)}
                    placeholder="Wichtige Erkenntnisse, offene Punkte, nächste Schritte …"
                    rows={5}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="n-datum">Datum <span className="text-destructive">*</span></Label>
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
                      <SelectValue placeholder="Kategorie wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keine Angabe</SelectItem>
                      {KATEGORIE_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Priorität</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRIORITAET_OPTIONS.map(o => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setNPrioritaet(prev => prev === o.key ? '' : o.key)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          nPrioritaet === o.key
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
                <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">{submitError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(3)}>Zurück</Button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(5)}
                  >
                    Überspringen
                  </Button>
                  <Button
                    onClick={handleCreateNotiz}
                    disabled={!nTitel || !nInhalt || !nDatum || submitting}
                  >
                    {submitting ? 'Wird gespeichert …' : 'Onboarding abschließen'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht ein angelegtes Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          )}
        </div>
      )}

      {/* Step 5 — Zusammenfassung */}
      {step === 5 && (
        <div className="space-y-6">
          {createdUnternehmenId ? (
            <>
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="rounded-full bg-primary/10 p-4">
                  <IconCircleCheck size={36} className="text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Onboarding abgeschlossen!</h2>
                <p className="text-muted-foreground max-w-md">
                  <span className="font-medium text-foreground">{createdUnternehmenName}</span> wurde erfolgreich angelegt und eingerichtet.
                </p>
              </div>

              <div className="rounded-2xl border overflow-hidden">
                <div className="bg-secondary px-4 py-3">
                  <h3 className="font-medium text-sm text-foreground">Angelegte Einträge</h3>
                </div>
                <div className="divide-y">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <IconBuilding size={18} className="text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">Unternehmen</p>
                      <p className="text-xs text-muted-foreground truncate">{createdUnternehmenName}</p>
                    </div>
                    <IconCheck size={16} className="text-primary ml-auto shrink-0" />
                  </div>

                  <div className="flex items-center gap-3 px-4 py-3">
                    <IconCalendarPlus size={18} className={createdTerminId ? 'text-primary shrink-0' : 'text-muted-foreground shrink-0'} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">Erster Termin</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {createdTerminId ? tBezeichnung || 'Angelegt' : 'Übersprungen'}
                      </p>
                    </div>
                    {createdTerminId && <IconCheck size={16} className="text-primary ml-auto shrink-0" />}
                  </div>

                  <div className="flex items-center gap-3 px-4 py-3">
                    <IconFileText size={18} className={createdDokumentId ? 'text-primary shrink-0' : 'text-muted-foreground shrink-0'} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">Erstes Dokument</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {createdDokumentId ? dBezeichnung || 'Angelegt' : 'Übersprungen'}
                      </p>
                    </div>
                    {createdDokumentId && <IconCheck size={16} className="text-primary ml-auto shrink-0" />}
                  </div>

                  <div className="flex items-center gap-3 px-4 py-3">
                    <IconNotes size={18} className={createdNotizId ? 'text-primary shrink-0' : 'text-muted-foreground shrink-0'} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">Erste Notiz</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {createdNotizId ? nTitel || 'Angelegt' : 'Übersprungen'}
                      </p>
                    </div>
                    {createdNotizId && <IconCheck size={16} className="text-primary ml-auto shrink-0" />}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button onClick={handleReset} variant="outline">
                  Weiteres Unternehmen anlegen
                </Button>
                <a href="#/">
                  <Button className="w-full sm:w-auto">Zurück zum Dashboard</Button>
                </a>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Kein Unternehmen angelegt. Bitte starte von vorne.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
