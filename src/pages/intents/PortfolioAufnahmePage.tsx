/**
 * Portfolio-Aufnahme — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen anlegen → 2) Ersten Termin planen → 3) Gründungsdokument hinterlegen → 4) Erste Notiz erfassen.
 * Reads: (kein Vorauswahl nötig — alle Schritte erstellen neue Datensätze).
 * Writes: unternehmen (createUnternehmenEntry), termine (createTermineEntry),
 *         dokumente (createDokumenteEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  IconBuilding,
  IconCalendarEvent,
  IconFileDescription,
  IconNotes,
  IconCheck,
  IconChevronRight,
} from '@tabler/icons-react';

const RECHTSFORM_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['rechtsform'] ?? [];
const BRANCHE_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['branche'] ?? [];
const STATUS_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['status'] ?? [];
const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

export default function PortfolioAufnahmePage() {
  const { loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Created IDs for chaining
  const [unternehmenId, setUnternehmenId] = useState<string | null>(null);
  const [unternehmenName, setUnternehmenName] = useState<string>('');
  const [terminId, setTerminId] = useState<string | null>(null);
  const [terminBezeichnung, setTerminBezeichnung] = useState<string>('');
  const [terminDatum, setTerminDatum] = useState<string>('');
  const [dokumentId, setDokumentId] = useState<string | null>(null);
  const [dokumentBezeichnung, setDokumentBezeichnung] = useState<string>('');
  const [notizId, setNotizId] = useState<string | null>(null);
  const [notizTitel, setNotizTitel] = useState<string>('');

  // Step 1: Unternehmen
  const [uName, setUName] = useState('');
  const [uRechtsform, setURechtsform] = useState('none');
  const [uBranche, setUBranche] = useState('none');
  const [uStatus, setUStatus] = useState(STATUS_OPTIONS[0]?.key ?? 'aktiv');
  const [uKapital, setUKapital] = useState('');
  const [uInvestitionsdatum, setUInvestitionsdatum] = useState('');
  const [uStadt, setUStadt] = useState('');
  const [uLand, setULand] = useState('');
  const [uVorname, setUVorname] = useState('');
  const [uNachname, setUNachname] = useState('');
  const [uEmail, setUEmail] = useState('');

  // Step 2: Termin
  const [tBezeichnung, setTBezeichnung] = useState('');
  const [tArt, setTArt] = useState('strategiemeeting');
  const [tDatumUhrzeit, setTDatumUhrzeit] = useState('');
  const [tOrt, setTOrt] = useState('');
  const [tStatus, setTStatus] = useState('geplant');

  // Step 3: Dokument
  const [dBezeichnung, setDBezeichnung] = useState('');
  const [dTyp, setDTyp] = useState('gesellschaftsvertrag');
  const [dDatum, setDDatum] = useState('');
  const [dLink, setDLink] = useState('');
  const [dBereitgestellt, setDBereitgestellt] = useState('');

  // Step 4: Notiz
  const [nTitel, setNTitel] = useState('');
  const [nInhalt, setNInhalt] = useState('');
  const [nDatum, setNDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [nKategorie, setNKategorie] = useState('allgemein');
  const [nPrioritaet, setNPrioritaet] = useState('mittel');

  const handleCreateUnternehmen = async () => {
    if (!uName || !uStatus) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        name: uName,
        status: uStatus,
      };
      if (uRechtsform !== 'none') payload.rechtsform = uRechtsform;
      if (uBranche !== 'none') payload.branche = uBranche;
      if (uKapital) payload.investiertes_kapital = parseFloat(uKapital);
      if (uInvestitionsdatum) payload.investitionsdatum = uInvestitionsdatum;
      if (uStadt) payload.stadt = uStadt;
      if (uLand) payload.land = uLand;
      if (uVorname) payload.ansprechpartner_vorname = uVorname;
      if (uNachname) payload.ansprechpartner_nachname = uNachname;
      if (uEmail) payload.ansprechpartner_email = uEmail;

      const result = await LivingAppsService.createUnternehmenEntry(payload);
      await fetchAll();
      setUnternehmenId(result.record_id);
      setUnternehmenName(uName);
      setStep(2);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Unternehmens');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTermin = async () => {
    if (!unternehmenId || !tBezeichnung || !tDatumUhrzeit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let tid = terminId;
      if (!tid) {
        const result = await LivingAppsService.createTermineEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
          terminbezeichnung: tBezeichnung,
          terminart: tArt,
          datum_uhrzeit: tDatumUhrzeit,
          ort: tOrt || undefined,
          terminstatus: tStatus,
        });
        tid = result.record_id;
        setTerminId(tid);
        setTerminBezeichnung(tBezeichnung);
        setTerminDatum(tDatumUhrzeit);
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
    if (!unternehmenId || !dBezeichnung) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let did = dokumentId;
      if (!did) {
        const result = await LivingAppsService.createDokumenteEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
          dokumentenbezeichnung: dBezeichnung,
          dokumententyp: dTyp,
          dokumentendatum: dDatum || undefined,
          dokumentenlink: dLink || undefined,
          bereitgestellt_von: dBereitgestellt || undefined,
        });
        did = result.record_id;
        setDokumentId(did);
        setDokumentBezeichnung(dBezeichnung);
        await fetchAll();
      }
      setStep(4);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Hinterlegen des Dokuments');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNotiz = async () => {
    if (!unternehmenId || !nTitel || !nInhalt || !nDatum) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let nid = notizId;
      if (!nid) {
        const result = await LivingAppsService.createNotizenEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
          notiz_titel: nTitel,
          notiz_inhalt: nInhalt,
          notiz_datum: nDatum,
          kategorie: nKategorie,
          prioritaet: nPrioritaet,
        });
        nid = result.record_id;
        setNotizId(nid);
        setNotizTitel(nTitel);
        await fetchAll();
      }
      setStep(5);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Erfassen der Notiz');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setUnternehmenId(null);
    setUnternehmenName('');
    setTerminId(null);
    setTerminBezeichnung('');
    setTerminDatum('');
    setDokumentId(null);
    setDokumentBezeichnung('');
    setNotizId(null);
    setNotizTitel('');
    setUName(''); setURechtsform('none'); setUBranche('none');
    setUStatus(STATUS_OPTIONS[0]?.key ?? 'aktiv');
    setUKapital(''); setUInvestitionsdatum(''); setUStadt(''); setULand('');
    setUVorname(''); setUNachname(''); setUEmail('');
    setTBezeichnung(''); setTArt('strategiemeeting'); setTDatumUhrzeit('');
    setTOrt(''); setTStatus('geplant');
    setDBezeichnung(''); setDTyp('gesellschaftsvertrag');
    setDDatum(''); setDLink(''); setDBereitgestellt('');
    setNTitel(''); setNInhalt('');
    setNDatum(format(new Date(), 'yyyy-MM-dd'));
    setNKategorie('allgemein'); setNPrioritaet('mittel');
    setSubmitError(null);
  };

  const companyBanner = unternehmenName ? (
    <div className="flex items-center gap-2 px-4 py-2 mb-4 bg-primary/10 rounded-xl text-sm font-medium text-primary">
      <IconBuilding size={16} stroke={2} />
      <span>Unternehmen: {unternehmenName}</span>
    </div>
  ) : null;

  return (
    <IntentWizardShell
      title="Portfolio-Aufnahme"
      subtitle="Neues Portfoliounternehmen in 4 Schritten aufnehmen"
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
      {/* Step 1: Unternehmen anlegen */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <IconBuilding size={20} stroke={2} className="text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Unternehmen anlegen</h2>
              <p className="text-sm text-muted-foreground">Stammdaten des neuen Portfoliounternehmens</p>
            </div>
          </div>

          {submitError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Unternehmensname *</label>
              <Input
                value={uName}
                onChange={e => setUName(e.target.value)}
                placeholder="z. B. Mustermann GmbH"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Rechtsform</label>
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

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Branche</label>
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

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status *</label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setUStatus(o.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      uStatus === o.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-foreground hover:border-primary/50'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Investiertes Kapital (€)</label>
              <Input
                type="number"
                value={uKapital}
                onChange={e => setUKapital(e.target.value)}
                placeholder="z. B. 500000"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Investitionsdatum</label>
              <Input
                type="date"
                value={uInvestitionsdatum}
                onChange={e => setUInvestitionsdatum(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Stadt</label>
              <Input
                value={uStadt}
                onChange={e => setUStadt(e.target.value)}
                placeholder="z. B. München"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Land</label>
              <Input
                value={uLand}
                onChange={e => setULand(e.target.value)}
                placeholder="z. B. Deutschland"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Ansprechpartner (optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Vorname</label>
                <Input
                  value={uVorname}
                  onChange={e => setUVorname(e.target.value)}
                  placeholder="Vorname"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nachname</label>
                <Input
                  value={uNachname}
                  onChange={e => setUNachname(e.target.value)}
                  placeholder="Nachname"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">E-Mail</label>
                <Input
                  type="email"
                  value={uEmail}
                  onChange={e => setUEmail(e.target.value)}
                  placeholder="email@beispiel.de"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleCreateUnternehmen}
              disabled={!uName || !uStatus || submitting}
              className="gap-2"
            >
              {submitting ? 'Wird angelegt …' : 'Unternehmen anlegen'}
              <IconChevronRight size={16} stroke={2} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Ersten Termin planen */}
      {step === 2 && (
        <div className="space-y-5">
          {companyBanner}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <IconCalendarEvent size={20} stroke={2} className="text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Ersten Termin planen</h2>
              <p className="text-sm text-muted-foreground">Erstes Meeting mit dem Unternehmen terminieren</p>
            </div>
          </div>

          {!unternehmenId && (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt benötigt ein angelegtes Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          )}

          {unternehmenId && (
            <>
              {submitError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Terminbezeichnung *</label>
                  <Input
                    value={tBezeichnung}
                    onChange={e => setTBezeichnung(e.target.value)}
                    placeholder="z. B. Erstgespräch Portfolioaufnahme"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Terminart *</label>
                  <Select value={tArt} onValueChange={setTArt}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMINART_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Datum & Uhrzeit *</label>
                  <Input
                    type="datetime-local"
                    value={tDatumUhrzeit}
                    onChange={e => setTDatumUhrzeit(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Ort</label>
                  <Input
                    value={tOrt}
                    onChange={e => setTOrt(e.target.value)}
                    placeholder="z. B. Büro Berlin"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {TERMINSTATUS_OPTIONS.map(o => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setTStatus(o.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          tStatus === o.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border text-foreground hover:border-primary/50'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleCreateTermin}
                  disabled={!tBezeichnung || !tDatumUhrzeit || submitting}
                  className="gap-2"
                >
                  {submitting ? 'Wird angelegt …' : 'Termin anlegen'}
                  <IconChevronRight size={16} stroke={2} />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3: Gründungsdokument hinterlegen */}
      {step === 3 && (
        <div className="space-y-5">
          {companyBanner}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <IconFileDescription size={20} stroke={2} className="text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Gründungsdokument hinterlegen</h2>
              <p className="text-sm text-muted-foreground">Erstes Dokument zum Unternehmen erfassen</p>
            </div>
          </div>

          {!unternehmenId && (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt benötigt ein angelegtes Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          )}

          {unternehmenId && (
            <>
              {submitError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Dokumentenbezeichnung *</label>
                  <Input
                    value={dBezeichnung}
                    onChange={e => setDBezeichnung(e.target.value)}
                    placeholder="z. B. Gesellschaftsvertrag Mustermann GmbH"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Dokumententyp</label>
                  <Select value={dTyp} onValueChange={setDTyp}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOKUMENTENTYP_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Dokumentendatum</label>
                  <Input
                    type="date"
                    value={dDatum}
                    onChange={e => setDDatum(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Dokumentenlink (URL)</label>
                  <Input
                    type="url"
                    value={dLink}
                    onChange={e => setDLink(e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Bereitgestellt von</label>
                  <Input
                    value={dBereitgestellt}
                    onChange={e => setDBereitgestellt(e.target.value)}
                    placeholder="z. B. Notar Meier"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleCreateDokument}
                  disabled={!dBezeichnung || submitting}
                  className="gap-2"
                >
                  {submitting ? 'Wird hinterlegt …' : 'Dokument hinterlegen'}
                  <IconChevronRight size={16} stroke={2} />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 4: Erste Notiz erfassen */}
      {step === 4 && (
        <div className="space-y-5">
          {companyBanner}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <IconNotes size={20} stroke={2} className="text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Erste Notiz erfassen</h2>
              <p className="text-sm text-muted-foreground">Erste Einschätzung oder Erkenntnisse festhalten</p>
            </div>
          </div>

          {!unternehmenId && (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt benötigt ein angelegtes Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          )}

          {unternehmenId && (
            <>
              {submitError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Titel *</label>
                  <Input
                    value={nTitel}
                    onChange={e => setNTitel(e.target.value)}
                    placeholder="z. B. Erste Einschätzung nach Onboarding"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Inhalt *</label>
                  <Textarea
                    value={nInhalt}
                    onChange={e => setNInhalt(e.target.value)}
                    placeholder="Notizen, Erkenntnisse, nächste Schritte …"
                    className="min-h-[100px]"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Datum *</label>
                  <Input
                    type="date"
                    value={nDatum}
                    onChange={e => setNDatum(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Kategorie</label>
                  <Select value={nKategorie} onValueChange={setNKategorie}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KATEGORIE_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Priorität</label>
                  <div className="flex flex-wrap gap-2">
                    {PRIORITAET_OPTIONS.map(o => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setNPrioritaet(o.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          nPrioritaet === o.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border text-foreground hover:border-primary/50'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleCreateNotiz}
                  disabled={!nTitel || !nInhalt || !nDatum || submitting}
                  className="gap-2"
                >
                  {submitting ? 'Wird erfasst …' : 'Notiz erfassen & abschließen'}
                  <IconChevronRight size={16} stroke={2} />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 5: Zusammenfassung */}
      {step === 5 && (
        <div className="space-y-5">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mx-auto">
            <IconCheck size={28} stroke={2} className="text-primary" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground">Aufnahme abgeschlossen!</h2>
            <p className="text-sm text-muted-foreground mt-1">Das Portfoliounternehmen wurde erfolgreich aufgenommen.</p>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4 overflow-hidden">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zusammenfassung</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary p-3 space-y-0.5 overflow-hidden">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <IconBuilding size={13} stroke={2} /> Unternehmen
                </p>
                <p className="font-semibold text-foreground truncate">{unternehmenName || '—'}</p>
              </div>

              <div className="rounded-xl bg-secondary p-3 space-y-0.5 overflow-hidden">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <IconCalendarEvent size={13} stroke={2} /> Erster Termin
                </p>
                <p className="font-semibold text-foreground truncate">{terminBezeichnung || '—'}</p>
                {terminDatum && (
                  <p className="text-xs text-muted-foreground">{terminDatum.replace('T', ' ')}</p>
                )}
              </div>

              <div className="rounded-xl bg-secondary p-3 space-y-0.5 overflow-hidden">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <IconFileDescription size={13} stroke={2} /> Dokument
                </p>
                <p className="font-semibold text-foreground truncate">{dokumentBezeichnung || '—'}</p>
              </div>

              <div className="rounded-xl bg-secondary p-3 space-y-0.5 overflow-hidden">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <IconNotes size={13} stroke={2} /> Erste Notiz
                </p>
                <p className="font-semibold text-foreground truncate">{notizTitel || '—'}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">
              Weiteres Unternehmen aufnehmen
            </Button>
            <a href="#/" className="w-full sm:w-auto">
              <Button className="w-full gap-2">
                Zurück zum Dashboard
              </Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
