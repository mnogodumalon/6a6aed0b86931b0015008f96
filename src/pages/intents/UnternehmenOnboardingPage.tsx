/**
 * Unternehmen Onboarding — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen anlegen → 2) Ersten Termin anlegen → 3) Erstes Dokument ablegen → 4) Erste Notiz erfassen.
 * Reads: (keine — alle Daten werden neu erstellt).
 * Writes: unternehmen (createUnternehmenEntry), termine (createTermineEntry),
 *         dokumente (createDokumenteEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  IconBuilding,
  IconCalendarEvent,
  IconFileText,
  IconNotes,
  IconCheck,
  IconArrowRight,
  IconAlertCircle,
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

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // IDs der erstellten Datensätze (idempotency guards)
  const [unternehmenId, setUnternehmenId] = useState<string | null>(null);
  const [unternehmenName, setUnternehmenName] = useState<string>('');
  const [terminId, setTerminId] = useState<string | null>(null);
  const [dokumentId, setDokumentId] = useState<string | null>(null);
  const [notizId, setNotizId] = useState<string | null>(null);

  // Schritt 1: Unternehmen
  const [uName, setUName] = useState('');
  const [uRechtsform, setURechtsform] = useState('none');
  const [uBranche, setUBranche] = useState('none');
  const [uStatus, setUStatus] = useState(STATUS_OPTIONS[0]?.key ?? 'aktiv');
  const [uKapital, setUKapital] = useState('');
  const [uInvestDatum, setUInvestDatum] = useState('');
  const [uStadt, setUStadt] = useState('');

  // Schritt 2: Termin
  const [tBezeichnung, setTBezeichnung] = useState('');
  const [tArt, setTArt] = useState('none');
  const [tDatumUhrzeit, setTDatumUhrzeit] = useState('');
  const [tOrt, setTOrt] = useState('');
  const [tStatus, setTStatus] = useState(TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant');

  // Schritt 3: Dokument
  const [dBezeichnung, setDBezeichnung] = useState('');
  const [dTyp, setDTyp] = useState('none');
  const [dDatum, setDDatum] = useState('');
  const [dLink, setDLink] = useState('');

  // Schritt 4: Notiz
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
      let uid = unternehmenId;
      if (!uid) {
        const payload: Record<string, unknown> = { name: uName.trim(), status: uStatus };
        if (uRechtsform !== 'none') payload.rechtsform = uRechtsform;
        if (uBranche !== 'none') payload.branche = uBranche;
        if (uKapital) payload.investiertes_kapital = parseFloat(uKapital);
        if (uInvestDatum) payload.investitionsdatum = uInvestDatum;
        if (uStadt.trim()) payload.stadt = uStadt.trim();
        const result = await LivingAppsService.createUnternehmenEntry(payload);
        uid = result.record_id;
        setUnternehmenId(uid);
        setUnternehmenName(uName.trim());
        await fetchAll();
      }
      setStep(2);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTermin = async () => {
    if (!unternehmenId || !tBezeichnung.trim() || tArt === 'none' || !tDatumUhrzeit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let tid = terminId;
      if (!tid) {
        const payload: Record<string, unknown> = {
          terminbezeichnung: tBezeichnung.trim(),
          terminart: tArt,
          datum_uhrzeit: tDatumUhrzeit,
          terminstatus: tStatus,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        };
        if (tOrt.trim()) payload.ort = tOrt.trim();
        const result = await LivingAppsService.createTermineEntry(payload);
        tid = result.record_id;
        setTerminId(tid);
        await fetchAll();
      }
      setStep(3);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDokument = async () => {
    if (!unternehmenId || !dBezeichnung.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let did = dokumentId;
      if (!did) {
        const payload: Record<string, unknown> = {
          dokumentenbezeichnung: dBezeichnung.trim(),
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        };
        if (dTyp !== 'none') payload.dokumententyp = dTyp;
        if (dDatum) payload.dokumentendatum = dDatum;
        if (dLink.trim()) payload.dokumentenlink = dLink.trim();
        const result = await LivingAppsService.createDokumenteEntry(payload);
        did = result.record_id;
        setDokumentId(did);
        await fetchAll();
      }
      setStep(4);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNotiz = async () => {
    if (!unternehmenId || !nTitel.trim() || !nInhalt.trim() || !nDatum) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let nid = notizId;
      if (!nid) {
        const payload: Record<string, unknown> = {
          notiz_titel: nTitel.trim(),
          notiz_inhalt: nInhalt.trim(),
          notiz_datum: nDatum,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        };
        if (nKategorie !== 'none') payload.kategorie = nKategorie;
        if (nPrioritaet !== 'none') payload.prioritaet = nPrioritaet;
        const result = await LivingAppsService.createNotizenEntry(payload);
        nid = result.record_id;
        setNotizId(nid);
        await fetchAll();
      }
      setStep(5);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setUnternehmenId(null);
    setUnternehmenName('');
    setTerminId(null);
    setDokumentId(null);
    setNotizId(null);
    setUName('');
    setURechtsform('none');
    setUBranche('none');
    setUStatus(STATUS_OPTIONS[0]?.key ?? 'aktiv');
    setUKapital('');
    setUInvestDatum('');
    setUStadt('');
    setTBezeichnung('');
    setTArt('none');
    setTDatumUhrzeit('');
    setTOrt('');
    setTStatus(TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant');
    setDBezeichnung('');
    setDTyp('none');
    setDDatum('');
    setDLink('');
    setNTitel('');
    setNInhalt('');
    setNDatum(format(new Date(), 'yyyy-MM-dd'));
    setNKategorie('none');
    setNPrioritaet('none');
    setSubmitError(null);
  };

  const wizardTitle = unternehmenName
    ? `Onboarding: ${unternehmenName}`
    : 'Neues Portfoliounternehmen';

  return (
    <IntentWizardShell
      title={wizardTitle}
      subtitle="Neues Unternehmen in 4 Schritten vollständig anlegen"
      steps={[
        { label: 'Unternehmen' },
        { label: 'Termin' },
        { label: 'Dokument' },
        { label: 'Notiz' },
      ]}
      currentStep={step > 4 ? 4 : step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Schritt 1: Unternehmen anlegen */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-primary/10 p-2">
              <IconBuilding size={22} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Stammdaten erfassen</h2>
              <p className="text-sm text-muted-foreground">Grundlegende Informationen zum Unternehmen</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="u-name">Unternehmensname *</Label>
              <Input
                id="u-name"
                value={uName}
                onChange={e => setUName(e.target.value)}
                placeholder="z.B. Muster GmbH"
              />
            </div>

            <div className="space-y-1.5">
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

            <div className="space-y-1.5">
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
              <Label htmlFor="u-stadt">Stadt</Label>
              <Input
                id="u-stadt"
                value={uStadt}
                onChange={e => setUStadt(e.target.value)}
                placeholder="z.B. München"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-kapital">Investiertes Kapital (€)</Label>
              <Input
                id="u-kapital"
                type="number"
                value={uKapital}
                onChange={e => setUKapital(e.target.value)}
                placeholder="z.B. 500000"
                min="0"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-invest-datum">Investitionsdatum</Label>
              <Input
                id="u-invest-datum"
                type="date"
                value={uInvestDatum}
                onChange={e => setUInvestDatum(e.target.value)}
              />
            </div>
          </div>

          {submitError && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              <IconAlertCircle size={16} />
              {submitError}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleCreateUnternehmen}
              disabled={!uName.trim() || submitting}
              className="gap-2"
            >
              {submitting ? 'Wird angelegt…' : 'Unternehmen anlegen'}
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Schritt 2: Ersten Termin anlegen */}
      {step === 2 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-primary/10 p-2">
                <IconCalendarEvent size={22} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Ersten Termin anlegen</h2>
                <p className="text-sm text-muted-foreground">Für {unternehmenName}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="t-bezeichnung">Terminbezeichnung *</Label>
                <Input
                  id="t-bezeichnung"
                  value={tBezeichnung}
                  onChange={e => setTBezeichnung(e.target.value)}
                  placeholder="z.B. Kick-off Meeting"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="t-art">Terminart *</Label>
                <Select value={tArt} onValueChange={setTArt}>
                  <SelectTrigger id="t-art">
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
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                <IconAlertCircle size={16} />
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
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
                  disabled={!tBezeichnung.trim() || tArt === 'none' || !tDatumUhrzeit || submitting}
                  className="gap-2"
                >
                  {submitting ? 'Wird angelegt…' : 'Termin anlegen'}
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

      {/* Schritt 3: Erstes Dokument ablegen */}
      {step === 3 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-primary/10 p-2">
                <IconFileText size={22} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Erstes Dokument ablegen</h2>
                <p className="text-sm text-muted-foreground">Für {unternehmenName}</p>
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
                <Label htmlFor="d-typ">Dokumententyp</Label>
                <Select value={dTyp} onValueChange={setDTyp}>
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
                <Label htmlFor="d-link">Dokumentenlink</Label>
                <Input
                  id="d-link"
                  type="url"
                  value={dLink}
                  onChange={e => setDLink(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                <IconAlertCircle size={16} />
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>
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
                  disabled={!dBezeichnung.trim() || submitting}
                  className="gap-2"
                >
                  {submitting ? 'Wird gespeichert…' : 'Dokument ablegen'}
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

      {/* Schritt 4: Erste Notiz erfassen */}
      {step === 4 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-primary/10 p-2">
                <IconNotes size={22} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Erste Notiz erfassen</h2>
                <p className="text-sm text-muted-foreground">Für {unternehmenName}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="n-titel">Notiz-Titel *</Label>
                <Input
                  id="n-titel"
                  value={nTitel}
                  onChange={e => setNTitel(e.target.value)}
                  placeholder="z.B. Ersteinschätzung"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="n-inhalt">Notiz-Inhalt *</Label>
                <Textarea
                  id="n-inhalt"
                  value={nInhalt}
                  onChange={e => setNInhalt(e.target.value)}
                  placeholder="Inhalt der Notiz…"
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
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                <IconAlertCircle size={16} />
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                Zurück
              </Button>
              <Button
                onClick={handleCreateNotiz}
                disabled={!nTitel.trim() || !nInhalt.trim() || !nDatum || submitting}
                className="gap-2"
              >
                {submitting ? 'Wird gespeichert…' : 'Notiz erfassen & abschließen'}
                <IconCheck size={16} />
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

      {/* Abschluss */}
      {step === 5 && (
        <div className="text-center py-12 space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <IconCheck size={32} className="text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Onboarding abgeschlossen!</h2>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{unternehmenName}</span> wurde erfolgreich
              angelegt — mit erstem Termin, Dokument und Notiz.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={handleReset} variant="outline">
              Weiteres Unternehmen anlegen
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
