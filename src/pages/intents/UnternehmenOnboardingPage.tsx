/**
 * Unternehmen Onboarding — 4-Schritt-Wizard.
 * Steps: 1) Stammdaten anlegen → 2) Ersten Termin anlegen → 3) Erstes Dokument hinterlegen (überspringbar) → 4) Erste Notiz anlegen (überspringbar) → Abschluss.
 * Reads: keine bestehenden Datensätze notwendig. Writes: unternehmen (createUnternehmenEntry), termine (createTermineEntry), dokumente (createDokumenteEntry), notizen (createNotizenEntry).
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
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { IconBuildingSkyscraper, IconCalendarPlus, IconFileText, IconNotes, IconCheck, IconArrowRight } from '@tabler/icons-react';
import { useDashboardData } from '@/hooks/useDashboardData';

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
  const [uName, setUName] = useState('');
  const [uStatus, setUStatus] = useState(STATUS_OPTIONS[0]?.key ?? 'aktiv');
  const [uRechtsform, setURechtsform] = useState('none');
  const [uBranche, setUBranche] = useState('none');
  const [uKapital, setUKapital] = useState('');
  const [uInvestitionsdatum, setUInvestitionsdatum] = useState('');
  const [uStadt, setUStadt] = useState('');

  // Created IDs — used to chain dependent records
  const [unternehmenId, setUnternehmenId] = useState<string | null>(null);
  const [unternehmenName, setUnternehmenName] = useState('');

  // Step 2 — Termin
  const [tBezeichnung, setTBezeichnung] = useState('');
  const [tArt, setTArt] = useState('none');
  const [tDatumUhrzeit, setTDatumUhrzeit] = useState('');
  const [tOrt, setTOrt] = useState('');
  const [terminId, setTerminId] = useState<string | null>(null);

  // Step 3 — Dokument (optional)
  const [dBezeichnung, setDBezeichnung] = useState('');
  const [dTypKey, setDTypKey] = useState('none');
  const [dDatum, setDDatum] = useState('');
  const [dLink, setDLink] = useState('');
  const [dBereitgestellt, setDBereitgestellt] = useState('');
  const [dokumentCreated, setDokumentCreated] = useState(false);

  // Step 4 — Notiz (optional)
  const [nTitel, setNTitel] = useState('');
  const [nInhalt, setNInhalt] = useState('');
  const [nDatum, setNDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [nKategorieKey, setNKategorieKey] = useState('none');
  const [nPrioritaetKey, setNPrioritaetKey] = useState('none');
  const [notizCreated, setNotizCreated] = useState(false);

  // Summary counts
  const [createdCount, setCreatedCount] = useState(0);

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

      const result = await LivingAppsService.createUnternehmenEntry(payload);
      setUnternehmenId(result.record_id);
      setUnternehmenName(uName.trim());
      setCreatedCount(c => c + 1);
      await fetchAll();
      setStep(2);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen');
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
          terminstatus: 'geplant',
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        };
        if (tOrt.trim()) payload.ort = tOrt.trim();
        const result = await LivingAppsService.createTermineEntry(payload);
        tid = result.record_id;
        setTerminId(tid);
        setCreatedCount(c => c + 1);
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
    if (!unternehmenId || !dBezeichnung.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        dokumentenbezeichnung: dBezeichnung.trim(),
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
      };
      if (dTypKey !== 'none') payload.dokumententyp = dTypKey;
      if (dDatum) payload.dokumentendatum = dDatum;
      if (dLink.trim()) payload.dokumentenlink = dLink.trim();
      if (dBereitgestellt.trim()) payload.bereitgestellt_von = dBereitgestellt.trim();
      await LivingAppsService.createDokumenteEntry(payload);
      setDokumentCreated(true);
      setCreatedCount(c => c + 1);
      await fetchAll();
      setStep(4);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Dokuments');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNotiz = async () => {
    if (!unternehmenId || !nTitel.trim() || !nInhalt.trim() || !nDatum) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        notiz_titel: nTitel.trim(),
        notiz_inhalt: nInhalt.trim(),
        notiz_datum: nDatum,
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
      };
      if (nKategorieKey !== 'none') payload.kategorie = nKategorieKey;
      if (nPrioritaetKey !== 'none') payload.prioritaet = nPrioritaetKey;
      await LivingAppsService.createNotizenEntry(payload);
      setNotizCreated(true);
      setCreatedCount(c => c + 1);
      await fetchAll();
      setStep(5);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Anlegen der Notiz');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setUName(''); setUStatus(STATUS_OPTIONS[0]?.key ?? 'aktiv'); setURechtsform('none');
    setUBranche('none'); setUKapital(''); setUInvestitionsdatum(''); setUStadt('');
    setUnternehmenId(null); setUnternehmenName('');
    setTBezeichnung(''); setTArt('none'); setTDatumUhrzeit(''); setTOrt(''); setTerminId(null);
    setDBezeichnung(''); setDTypKey('none'); setDDatum(''); setDLink(''); setDBereitgestellt(''); setDokumentCreated(false);
    setNTitel(''); setNInhalt(''); setNDatum(format(new Date(), 'yyyy-MM-dd')); setNKategorieKey('none'); setNPrioritaetKey('none'); setNotizCreated(false);
    setCreatedCount(0); setSubmitError(null);
  };

  return (
    <IntentWizardShell
      title="Neues Portfoliounternehmen"
      subtitle="Stammdaten, Termin, Dokument und Notiz in einem geführten Ablauf anlegen"
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
      {/* Step 1 — Unternehmen */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <IconBuildingSkyscraper size={22} className="text-primary" stroke={1.5} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Stammdaten erfassen</h2>
              <p className="text-sm text-muted-foreground">Lege das neue Portfoliounternehmen an.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="u-name">Unternehmensname *</Label>
              <Input
                id="u-name"
                value={uName}
                onChange={e => setUName(e.target.value)}
                placeholder="z. B. Innovatech GmbH"
              />
            </div>

            <div className="space-y-1">
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
                        : 'bg-card border-border text-foreground hover:bg-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
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

            <div className="space-y-1">
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

            <div className="space-y-1">
              <Label htmlFor="u-kapital">Investiertes Kapital (€)</Label>
              <Input
                id="u-kapital"
                type="number"
                min="0"
                step="1000"
                value={uKapital}
                onChange={e => setUKapital(e.target.value)}
                placeholder="z. B. 500000"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="u-datum">Investitionsdatum</Label>
              <Input
                id="u-datum"
                type="date"
                value={uInvestitionsdatum}
                onChange={e => setUInvestitionsdatum(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="u-stadt">Stadt</Label>
              <Input
                id="u-stadt"
                value={uStadt}
                onChange={e => setUStadt(e.target.value)}
                placeholder="z. B. Berlin"
              />
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
              Unternehmen anlegen <IconArrowRight size={16} stroke={2} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 — Termin */}
      {step === 2 && (
        <div className="space-y-6">
          {unternehmenId ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-primary/10">
                  <IconCalendarPlus size={22} className="text-primary" stroke={1.5} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Ersten Termin anlegen</h2>
                  <p className="text-sm text-muted-foreground">Plane einen ersten Termin für <strong>{unternehmenName}</strong>.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="t-bezeichnung">Terminbezeichnung *</Label>
                  <Input
                    id="t-bezeichnung"
                    value={tBezeichnung}
                    onChange={e => setTBezeichnung(e.target.value)}
                    placeholder="z. B. Kick-off Meeting"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="t-art">Terminart *</Label>
                  <Select value={tArt} onValueChange={setTArt}>
                    <SelectTrigger id="t-art">
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

                <div className="space-y-1">
                  <Label htmlFor="t-datum">Datum & Uhrzeit *</Label>
                  <Input
                    id="t-datum"
                    type="datetime-local"
                    value={tDatumUhrzeit}
                    onChange={e => setTDatumUhrzeit(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {TERMINSTATUS_OPTIONS.map(opt => (
                      <div
                        key={opt.key}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                          opt.key === 'geplant'
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-secondary border-border text-muted-foreground'
                        }`}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Vorbelegt mit "Geplant"</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="t-ort">Ort</Label>
                  <Input
                    id="t-ort"
                    value={tOrt}
                    onChange={e => setTOrt(e.target.value)}
                    placeholder="z. B. Konferenzraum A"
                  />
                </div>
              </div>

              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  onClick={handleCreateTermin}
                  disabled={!tBezeichnung.trim() || tArt === 'none' || !tDatumUhrzeit || submitting}
                  className="gap-2"
                >
                  Termin anlegen <IconArrowRight size={16} stroke={2} />
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt benötigt ein angelegtes Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Dokument (optional) */}
      {step === 3 && (
        <div className="space-y-6">
          {unternehmenId ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-primary/10">
                  <IconFileText size={22} className="text-primary" stroke={1.5} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Erstes Dokument hinterlegen</h2>
                  <p className="text-sm text-muted-foreground">Optional: Hinterlege ein Dokument für <strong>{unternehmenName}</strong>.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="d-bezeichnung">Dokumentenbezeichnung *</Label>
                  <Input
                    id="d-bezeichnung"
                    value={dBezeichnung}
                    onChange={e => setDBezeichnung(e.target.value)}
                    placeholder="z. B. Beteiligungsvertrag 2024"
                  />
                </div>

                <div className="space-y-1">
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
                    placeholder="https://..."
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="d-bereitgestellt">Bereitgestellt von</Label>
                  <Input
                    id="d-bereitgestellt"
                    value={dBereitgestellt}
                    onChange={e => setDBereitgestellt(e.target.value)}
                    placeholder="z. B. Steuerberater Müller"
                  />
                </div>
              </div>

              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}

              <div className="flex justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(4)}
                >
                  Überspringen
                </Button>
                <Button
                  onClick={handleCreateDokument}
                  disabled={!dBezeichnung.trim() || submitting}
                  className="gap-2"
                >
                  Dokument anlegen <IconArrowRight size={16} stroke={2} />
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt benötigt ein angelegtes Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          )}
        </div>
      )}

      {/* Step 4 — Notiz (optional) */}
      {step === 4 && (
        <div className="space-y-6">
          {unternehmenId ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-primary/10">
                  <IconNotes size={22} className="text-primary" stroke={1.5} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Erste Notiz anlegen</h2>
                  <p className="text-sm text-muted-foreground">Optional: Erfasse eine erste Notiz zu <strong>{unternehmenName}</strong>.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="n-titel">Titel *</Label>
                  <Input
                    id="n-titel"
                    value={nTitel}
                    onChange={e => setNTitel(e.target.value)}
                    placeholder="z. B. Erste Eindrücke"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="n-inhalt">Inhalt *</Label>
                  <Textarea
                    id="n-inhalt"
                    value={nInhalt}
                    onChange={e => setNInhalt(e.target.value)}
                    placeholder="Notizinhalt…"
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

                <div className="space-y-1">
                  <Label>Priorität</Label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setNPrioritaetKey('none')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        nPrioritaetKey === 'none'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-foreground hover:bg-secondary'
                      }`}
                    >
                      Keine
                    </button>
                    {PRIORITAET_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setNPrioritaetKey(opt.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          nPrioritaetKey === opt.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border text-foreground hover:bg-secondary'
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

              <div className="flex justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(5)}
                >
                  Überspringen
                </Button>
                <Button
                  onClick={handleCreateNotiz}
                  disabled={!nTitel.trim() || !nInhalt.trim() || !nDatum || submitting}
                  className="gap-2"
                >
                  Notiz anlegen <IconArrowRight size={16} stroke={2} />
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt benötigt ein angelegtes Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          )}
        </div>
      )}

      {/* Step 5 — Abschluss */}
      {step === 5 && (
        <div className="space-y-6">
          {unternehmenId ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-green-500/10">
                  <IconCheck size={22} className="text-green-600" stroke={2} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Onboarding abgeschlossen!</h2>
                  <p className="text-sm text-muted-foreground">
                    <strong>{unternehmenName}</strong> wurde erfolgreich angelegt.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border bg-card p-4 text-center overflow-hidden">
                  <div className="text-3xl font-bold text-primary">{createdCount}</div>
                  <div className="text-sm text-muted-foreground mt-1">Datensätze angelegt</div>
                </div>
                <div className="rounded-2xl border bg-card p-4 overflow-hidden">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Unternehmen</div>
                  <div className="font-semibold truncate">{unternehmenName}</div>
                  <div className="text-xs text-green-600 mt-1">Angelegt</div>
                </div>
                <div className="rounded-2xl border bg-card p-4 overflow-hidden">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Verknüpft</div>
                  <div className="space-y-1">
                    {terminId && <div className="text-sm flex items-center gap-1"><IconCalendarPlus size={14} stroke={2} className="text-primary" /> Termin</div>}
                    {dokumentCreated && <div className="text-sm flex items-center gap-1"><IconFileText size={14} stroke={2} className="text-primary" /> Dokument</div>}
                    {notizCreated && <div className="text-sm flex items-center gap-1"><IconNotes size={14} stroke={2} className="text-primary" /> Notiz</div>}
                    {!terminId && !dokumentCreated && !notizCreated && (
                      <div className="text-xs text-muted-foreground">Nur Stammdaten</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  <IconBuildingSkyscraper size={16} stroke={1.5} />
                  Weiteres Unternehmen onboarden
                </Button>
                <a href="#/" className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium border bg-card px-4 py-2 hover:bg-secondary transition-colors">
                  Zurück zum Dashboard
                </a>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Kein Unternehmen gefunden. Bitte starte den Wizard neu.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
