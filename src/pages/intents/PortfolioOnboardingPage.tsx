/**
 * Portfolio Onboarding — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen anlegen → 2) Ersten Termin planen → 3) Eröffnungsnotiz erstellen → 4) Abschluss & Zusammenfassung.
 * Reads: keine (alle Records werden neu angelegt).
 * Writes: unternehmen (createUnternehmenEntry), termine (createTermineEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell.
 */
import { useState } from 'react';
import { format } from 'date-fns';
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
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import {
  IconBuilding,
  IconCalendarEvent,
  IconCheck,
  IconFileText,
  IconAlertCircle,
} from '@tabler/icons-react';

const RECHTSFORM_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['rechtsform'] ?? [];
const BRANCHE_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['branche'] ?? [];
const STATUS_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['status'] ?? [];
const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

const WIZARD_STEPS = [
  { label: 'Unternehmen' },
  { label: 'Termin' },
  { label: 'Notiz' },
  { label: 'Abschluss' },
];

export default function PortfolioOnboardingPage() {
  const { loading, error, fetchAll } = useDashboardData();

  // Wizard navigation
  const [step, setStep] = useState(1);

  // Created record IDs (used for chained writes and summary)
  const [unternehmenId, setUnternehmenId] = useState('');
  const [unternehmenName, setUnternehmenName] = useState('');
  const [terminBezeichnung, setTerminBezeichnung] = useState('');
  const [terminDatum, setTerminDatum] = useState('');
  const [notizTitel, setNotizTitel] = useState('');

  // Step 1 — Unternehmen
  const [u_name, setUName] = useState('');
  const [u_rechtsform, setURechtsform] = useState('');
  const [u_branche, setUBranche] = useState('');
  const [u_status] = useState(STATUS_OPTIONS[0]?.key ?? 'aktiv');
  const [u_beteiligungsquote, setUBeteiligungsquote] = useState('');
  const [u_investiertes_kapital, setUInvestiertesKapital] = useState('');
  const [u_investitionsdatum, setUInvestitionsdatum] = useState('');
  const [u_stadt, setUStadt] = useState('');
  const [u_ap_vorname, setUApVorname] = useState('');
  const [u_ap_nachname, setUApNachname] = useState('');
  const [u_ap_email, setUApEmail] = useState('');
  const [step1Submitting, setStep1Submitting] = useState(false);
  const [step1Error, setStep1Error] = useState('');

  // Step 2 — Termin
  const [t_bezeichnung, setTBezeichnung] = useState('');
  const [t_terminart, setTTerminart] = useState('');
  const [t_datum_uhrzeit, setTDatumUhrzeit] = useState('');
  const [t_ort, setTOrt] = useState('');
  const [step2Submitting, setStep2Submitting] = useState(false);
  const [step2Error, setStep2Error] = useState('');

  // Step 3 — Notiz
  const [n_titel, setNTitel] = useState('');
  const [n_inhalt, setNInhalt] = useState('');
  const [n_datum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [n_kategorie, setNKategorie] = useState('');
  const [n_prioritaet, setNPrioitaet] = useState('');
  const [step3Submitting, setStep3Submitting] = useState(false);
  const [step3Error, setStep3Error] = useState('');

  // ── Step 1: Unternehmen anlegen ──────────────────────────────────────────
  async function handleCreateUnternehmen() {
    if (!u_name.trim()) {
      setStep1Error('Der Unternehmensname ist erforderlich.');
      return;
    }
    setStep1Submitting(true);
    setStep1Error('');
    try {
      const payload: Record<string, unknown> = {
        name: u_name.trim(),
        status: u_status,
      };
      if (u_rechtsform && u_rechtsform !== 'none') payload.rechtsform = u_rechtsform;
      if (u_branche && u_branche !== 'none') payload.branche = u_branche;
      if (u_beteiligungsquote) payload.beteiligungsquote = parseFloat(u_beteiligungsquote);
      if (u_investiertes_kapital) payload.investiertes_kapital = parseFloat(u_investiertes_kapital);
      if (u_investitionsdatum) payload.investitionsdatum = u_investitionsdatum;
      if (u_stadt.trim()) payload.stadt = u_stadt.trim();
      if (u_ap_vorname.trim()) payload.ansprechpartner_vorname = u_ap_vorname.trim();
      if (u_ap_nachname.trim()) payload.ansprechpartner_nachname = u_ap_nachname.trim();
      if (u_ap_email.trim()) payload.ansprechpartner_email = u_ap_email.trim();

      const result = await LivingAppsService.createUnternehmenEntry(payload);
      setUnternehmenId(result.record_id);
      setUnternehmenName(u_name.trim());
      await fetchAll();
      setStep(2);
    } catch (e) {
      setStep1Error(e instanceof Error ? e.message : 'Fehler beim Anlegen des Unternehmens.');
    } finally {
      setStep1Submitting(false);
    }
  }

  // ── Step 2: Ersten Termin planen ─────────────────────────────────────────
  async function handleCreateTermin() {
    if (!t_bezeichnung.trim()) {
      setStep2Error('Die Terminbezeichnung ist erforderlich.');
      return;
    }
    if (!t_terminart || t_terminart === 'none') {
      setStep2Error('Bitte wähle eine Terminart aus.');
      return;
    }
    if (!t_datum_uhrzeit) {
      setStep2Error('Bitte gib Datum und Uhrzeit ein.');
      return;
    }
    setStep2Submitting(true);
    setStep2Error('');
    try {
      const payload: Record<string, unknown> = {
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        terminbezeichnung: t_bezeichnung.trim(),
        terminart: t_terminart,
        datum_uhrzeit: t_datum_uhrzeit,
        terminstatus: TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant',
      };
      if (t_ort.trim()) payload.ort = t_ort.trim();

      await LivingAppsService.createTermineEntry(payload);
      setTerminBezeichnung(t_bezeichnung.trim());
      setTerminDatum(t_datum_uhrzeit);
      await fetchAll();
      setStep(3);
    } catch (e) {
      setStep2Error(e instanceof Error ? e.message : 'Fehler beim Anlegen des Termins.');
    } finally {
      setStep2Submitting(false);
    }
  }

  // ── Step 3: Eröffnungsnotiz erstellen ────────────────────────────────────
  async function handleCreateNotiz() {
    if (!n_titel.trim()) {
      setStep3Error('Der Notiztitel ist erforderlich.');
      return;
    }
    if (!n_inhalt.trim()) {
      setStep3Error('Der Notizinhalt ist erforderlich.');
      return;
    }
    setStep3Submitting(true);
    setStep3Error('');
    try {
      const payload: Record<string, unknown> = {
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        notiz_titel: n_titel.trim(),
        notiz_inhalt: n_inhalt.trim(),
        notiz_datum: n_datum,
      };
      if (n_kategorie && n_kategorie !== 'none') payload.kategorie = n_kategorie;
      if (n_prioritaet && n_prioritaet !== 'none') payload.prioritaet = n_prioritaet;

      await LivingAppsService.createNotizenEntry(payload);
      setNotizTitel(n_titel.trim());
      await fetchAll();
      setStep(4);
    } catch (e) {
      setStep3Error(e instanceof Error ? e.message : 'Fehler beim Anlegen der Notiz.');
    } finally {
      setStep3Submitting(false);
    }
  }

  function handleReset() {
    setStep(1);
    setUnternehmenId('');
    setUnternehmenName('');
    setTerminBezeichnung('');
    setTerminDatum('');
    setNotizTitel('');
    setUName('');
    setURechtsform('');
    setUBranche('');
    setUBeteiligungsquote('');
    setUInvestiertesKapital('');
    setUInvestitionsdatum('');
    setUStadt('');
    setUApVorname('');
    setUApNachname('');
    setUApEmail('');
    setStep1Error('');
    setTBezeichnung('');
    setTTerminart('');
    setTDatumUhrzeit('');
    setTOrt('');
    setStep2Error('');
    setNTitel('');
    setNInhalt('');
    setNKategorie('');
    setNPrioitaet('');
    setStep3Error('');
  }

  return (
    <IntentWizardShell
      title="Portfolio-Onboarding"
      subtitle="Neues Portfoliounternehmen in drei Schritten vollständig anlegen"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Schritt 1: Unternehmen anlegen ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <IconBuilding size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Unternehmen anlegen</h2>
              <p className="text-sm text-muted-foreground">Stammdaten des neuen Portfoliounternehmens</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Stammdaten</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="u_name">Unternehmensname *</Label>
                <Input
                  id="u_name"
                  value={u_name}
                  onChange={e => setUName(e.target.value)}
                  placeholder="z. B. TechVenture GmbH"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="u_rechtsform">Rechtsform</Label>
                <Select value={u_rechtsform} onValueChange={setURechtsform}>
                  <SelectTrigger id="u_rechtsform">
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
                <Label htmlFor="u_branche">Branche</Label>
                <Select value={u_branche} onValueChange={setUBranche}>
                  <SelectTrigger id="u_branche">
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
                <Label htmlFor="u_beteiligungsquote">Beteiligungsquote (%)</Label>
                <Input
                  id="u_beteiligungsquote"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={u_beteiligungsquote}
                  onChange={e => setUBeteiligungsquote(e.target.value)}
                  placeholder="z. B. 25.5"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="u_investiertes_kapital">Investiertes Kapital (€)</Label>
                <Input
                  id="u_investiertes_kapital"
                  type="number"
                  min="0"
                  step="0.01"
                  value={u_investiertes_kapital}
                  onChange={e => setUInvestiertesKapital(e.target.value)}
                  placeholder="z. B. 500000"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="u_investitionsdatum">Investitionsdatum</Label>
                <Input
                  id="u_investitionsdatum"
                  type="date"
                  value={u_investitionsdatum}
                  onChange={e => setUInvestitionsdatum(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="u_stadt">Stadt</Label>
                <Input
                  id="u_stadt"
                  value={u_stadt}
                  onChange={e => setUStadt(e.target.value)}
                  placeholder="z. B. Berlin"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Ansprechpartner</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="u_ap_vorname">Vorname</Label>
                <Input
                  id="u_ap_vorname"
                  value={u_ap_vorname}
                  onChange={e => setUApVorname(e.target.value)}
                  placeholder="Vorname"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="u_ap_nachname">Nachname</Label>
                <Input
                  id="u_ap_nachname"
                  value={u_ap_nachname}
                  onChange={e => setUApNachname(e.target.value)}
                  placeholder="Nachname"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="u_ap_email">E-Mail</Label>
                <Input
                  id="u_ap_email"
                  type="email"
                  value={u_ap_email}
                  onChange={e => setUApEmail(e.target.value)}
                  placeholder="ansprechpartner@unternehmen.de"
                />
              </div>
            </div>
          </div>

          {step1Error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl p-3">
              <IconAlertCircle size={16} className="shrink-0" />
              {step1Error}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleCreateUnternehmen}
              disabled={step1Submitting || !u_name.trim()}
              className="gap-2"
            >
              {step1Submitting ? 'Wird angelegt…' : 'Weiter: Termin planen'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Schritt 2: Ersten Termin planen ── */}
      {step === 2 && (
        <div className="space-y-6">
          {!unternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht das Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconCalendarEvent size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Ersten Termin planen</h2>
                  <p className="text-sm text-muted-foreground">Für <span className="font-medium text-foreground">{unternehmenName}</span></p>
                </div>
              </div>

              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="t_bezeichnung">Terminbezeichnung *</Label>
                    <Input
                      id="t_bezeichnung"
                      value={t_bezeichnung}
                      onChange={e => setTBezeichnung(e.target.value)}
                      placeholder="z. B. Kick-off Meeting"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="t_terminart">Terminart *</Label>
                    <Select value={t_terminart} onValueChange={setTTerminart}>
                      <SelectTrigger id="t_terminart">
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
                    <Label htmlFor="t_datum_uhrzeit">Datum & Uhrzeit *</Label>
                    <Input
                      id="t_datum_uhrzeit"
                      type="datetime-local"
                      value={t_datum_uhrzeit}
                      onChange={e => setTDatumUhrzeit(e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="t_ort">Ort</Label>
                    <Input
                      id="t_ort"
                      value={t_ort}
                      onChange={e => setTOrt(e.target.value)}
                      placeholder="z. B. Büro Berlin"
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
                  Status wird automatisch auf <span className="font-medium">Geplant</span> gesetzt.
                </div>
              </div>

              {step2Error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl p-3">
                  <IconAlertCircle size={16} className="shrink-0" />
                  {step2Error}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Zurück
                </Button>
                <Button
                  onClick={handleCreateTermin}
                  disabled={step2Submitting || !t_bezeichnung.trim() || !t_terminart || t_terminart === 'none' || !t_datum_uhrzeit}
                  className="gap-2"
                >
                  {step2Submitting ? 'Wird gespeichert…' : 'Weiter: Notiz erstellen'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Schritt 3: Eröffnungsnotiz erstellen ── */}
      {step === 3 && (
        <div className="space-y-6">
          {!unternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht das Unternehmen aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconFileText size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Eröffnungsnotiz erstellen</h2>
                  <p className="text-sm text-muted-foreground">Erste Notiz für <span className="font-medium text-foreground">{unternehmenName}</span></p>
                </div>
              </div>

              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="n_titel">Notiztitel *</Label>
                    <Input
                      id="n_titel"
                      value={n_titel}
                      onChange={e => setNTitel(e.target.value)}
                      placeholder="z. B. Onboarding-Zusammenfassung"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="n_inhalt">Notizinhalt *</Label>
                    <textarea
                      id="n_inhalt"
                      value={n_inhalt}
                      onChange={e => setNInhalt(e.target.value)}
                      placeholder="Halte hier erste Eindrücke, Ziele oder wichtige Informationen fest…"
                      rows={5}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="n_kategorie">Kategorie</Label>
                    <Select value={n_kategorie} onValueChange={setNKategorie}>
                      <SelectTrigger id="n_kategorie">
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

                  <div className="space-y-1.5">
                    <Label>Priorität</Label>
                    <div className="flex gap-2 flex-wrap">
                      {PRIORITAET_OPTIONS.map(o => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => setNPrioitaet(n_prioritaet === o.key ? '' : o.key)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                            n_prioritaet === o.key
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card border-input text-foreground hover:bg-accent'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">
                      Datum wird automatisch auf <span className="font-medium">{n_datum}</span> gesetzt.
                    </p>
                  </div>
                </div>
              </div>

              {step3Error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl p-3">
                  <IconAlertCircle size={16} className="shrink-0" />
                  {step3Error}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Zurück
                </Button>
                <Button
                  onClick={handleCreateNotiz}
                  disabled={step3Submitting || !n_titel.trim() || !n_inhalt.trim()}
                  className="gap-2"
                >
                  {step3Submitting ? 'Wird gespeichert…' : 'Onboarding abschließen'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Schritt 4: Abschluss & Zusammenfassung ── */}
      {step === 4 && (
        <div className="space-y-6">
          {!unternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Kein abgeschlossenes Onboarding gefunden.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center py-6 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <IconCheck size={28} className="text-primary" stroke={2.5} />
                </div>
                <h2 className="text-xl font-bold">Onboarding abgeschlossen!</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Das Portfoliounternehmen wurde erfolgreich angelegt und mit ersten Daten befüllt.
                </p>
              </div>

              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Zusammenfassung</h3>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/50">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <IconBuilding size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">Unternehmen</p>
                      <p className="text-sm font-semibold text-foreground truncate">{unternehmenName}</p>
                      <p className="text-xs text-muted-foreground">Status: Aktiv</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/50">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <IconCalendarEvent size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">Erster Termin</p>
                      <p className="text-sm font-semibold text-foreground truncate">{terminBezeichnung}</p>
                      {terminDatum && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(terminDatum.replace('T', ' ')), 'dd.MM.yyyy HH:mm')} Uhr
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/50">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <IconFileText size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">Eröffnungsnotiz</p>
                      <p className="text-sm font-semibold text-foreground truncate">{notizTitel}</p>
                      <p className="text-xs text-muted-foreground">Datum: {n_datum}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  Weiteres Unternehmen onboarden
                </Button>
                <a href="#/">
                  <Button className="w-full sm:w-auto gap-2">
                    Zurück zum Dashboard
                  </Button>
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
