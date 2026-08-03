/**
 * Neue Portfoliobeteiligung — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen anlegen → 2) Ersttermin erfassen (optional) →
 *        3) Erstdokument erfassen (optional) → 4) Erstnotiz erfassen (optional) → Zusammenfassung.
 * Reads: (keine Auswahl aus bestehenden Daten — alle Schritte sind Neuanlage).
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
  IconChevronRight,
  IconPlayerSkipForward,
  IconPlus,
  IconAlertCircle,
  IconLoader2,
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
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';

// ── Lookup options ─────────────────────────────────────────────────────────────
const RECHTSFORM_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['rechtsform'] ?? [];
const BRANCHE_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['branche'] ?? [];
const STATUS_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['status'] ?? [];
const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

const WIZARD_STEPS = [
  { label: 'Unternehmen' },
  { label: 'Termin' },
  { label: 'Dokument' },
  { label: 'Notiz' },
];

// ── Types ──────────────────────────────────────────────────────────────────────
interface CreatedSummary {
  unternehmenId: string;
  unternehmenName: string;
  terminCreated: boolean;
  terminBezeichnung: string;
  dokumentCreated: boolean;
  dokumentBezeichnung: string;
  notizCreated: boolean;
  notizTitel: string;
}

export default function NeueBeteiligungPage() {
  // ── Wizard State ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Schritt 1: Unternehmen ───────────────────────────────────────────────────
  const [uName, setUName] = useState('');
  const [uRechtsform, setURechtsform] = useState('none');
  const [uBranche, setUBranche] = useState('none');
  const [uStatus, setUStatus] = useState(STATUS_OPTIONS[0]?.key ?? 'aktiv');
  const [uKapital, setUKapital] = useState('');
  const [uInvestitionsdatum, setUInvestitionsdatum] = useState('');
  const [uStadt, setUStadt] = useState('');

  // Gespeicherte Unternehmen-ID nach Schritt 1
  const [unternehmenId, setUnternehmenId] = useState<string | null>(null);
  const [unternehmenName, setUnternehmenName] = useState('');

  // ── Schritt 2: Termin ────────────────────────────────────────────────────────
  const [tBezeichnung, setTBezeichnung] = useState('');
  const [tArt, setTArt] = useState('none');
  const [tDatum, setTDatum] = useState('');
  const [tOrt, setTOrt] = useState('');
  const [tStatus, setTStatus] = useState(TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant');
  const [terminCreated, setTerminCreated] = useState(false);
  const [terminBezeichnung, setTerminBezeichnung] = useState('');

  // ── Schritt 3: Dokument ──────────────────────────────────────────────────────
  const [dBezeichnung, setDBezeichnung] = useState('');
  const [dTyp, setDTyp] = useState('none');
  const [dDatum, setDDatum] = useState('');
  const [dLink, setDLink] = useState('');
  const [dBereitgestellt, setDBereitgestellt] = useState('');
  const [dokumentCreated, setDokumentCreated] = useState(false);
  const [dokumentBezeichnung, setDokumentBezeichnung] = useState('');

  // ── Schritt 4: Notiz ─────────────────────────────────────────────────────────
  const [nTitel, setNTitel] = useState('');
  const [nInhalt, setNInhalt] = useState('');
  const [nDatum, setNDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [nKategorie, setNKategorie] = useState(KATEGORIE_OPTIONS[0]?.key ?? 'allgemein');
  const [nPrioritaet, setNPrioritaet] = useState('mittel');
  const [notizCreated, setNotizCreated] = useState(false);
  const [notizTitel, setNotizTitel] = useState('');

  // ── Abschluss ────────────────────────────────────────────────────────────────
  const [summary, setSummary] = useState<CreatedSummary | null>(null);

  // ── Handler: Schritt 1 ───────────────────────────────────────────────────────
  const handleCreateUnternehmen = async () => {
    if (!uName.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = { name: uName.trim(), status: uStatus };
      if (uRechtsform !== 'none') payload.rechtsform = uRechtsform;
      if (uBranche !== 'none') payload.branche = uBranche;
      if (uKapital) payload.investiertes_kapital = parseFloat(uKapital);
      if (uInvestitionsdatum) payload.investitionsdatum = uInvestitionsdatum;
      if (uStadt.trim()) payload.stadt = uStadt.trim();

      const result = await LivingAppsService.createUnternehmenEntry(payload);
      setUnternehmenId(result.record_id);
      setUnternehmenName(uName.trim());
      setStep(2);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Fehler beim Anlegen des Unternehmens.');
    } finally {
      setSaving(false);
    }
  };

  // ── Handler: Schritt 2 ───────────────────────────────────────────────────────
  const handleCreateTermin = async () => {
    if (!unternehmenId || !tBezeichnung.trim() || !tArt || tArt === 'none' || !tDatum) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        terminbezeichnung: tBezeichnung.trim(),
        terminart: tArt,
        datum_uhrzeit: tDatum,
        terminstatus: tStatus,
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
      };
      if (tOrt.trim()) payload.ort = tOrt.trim();

      await LivingAppsService.createTermineEntry(payload);
      setTerminCreated(true);
      setTerminBezeichnung(tBezeichnung.trim());
      setStep(3);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Fehler beim Anlegen des Termins.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkipTermin = () => {
    setTerminCreated(false);
    setTerminBezeichnung('');
    setStep(3);
  };

  // ── Handler: Schritt 3 ───────────────────────────────────────────────────────
  const handleCreateDokument = async () => {
    if (!unternehmenId || !dBezeichnung.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        dokumentenbezeichnung: dBezeichnung.trim(),
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
      };
      if (dTyp !== 'none') payload.dokumententyp = dTyp;
      if (dDatum) payload.dokumentendatum = dDatum;
      if (dLink.trim()) payload.dokumentenlink = dLink.trim();
      if (dBereitgestellt.trim()) payload.bereitgestellt_von = dBereitgestellt.trim();

      await LivingAppsService.createDokumenteEntry(payload);
      setDokumentCreated(true);
      setDokumentBezeichnung(dBezeichnung.trim());
      setStep(4);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Fehler beim Anlegen des Dokuments.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkipDokument = () => {
    setDokumentCreated(false);
    setDokumentBezeichnung('');
    setStep(4);
  };

  // ── Handler: Schritt 4 ───────────────────────────────────────────────────────
  const handleCreateNotiz = async () => {
    if (!unternehmenId || !nTitel.trim() || !nInhalt.trim() || !nDatum) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        notiz_titel: nTitel.trim(),
        notiz_inhalt: nInhalt.trim(),
        notiz_datum: nDatum,
        kategorie: nKategorie,
        prioritaet: nPrioritaet,
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
      };

      await LivingAppsService.createNotizenEntry(payload);
      setNotizCreated(true);
      setNotizTitel(nTitel.trim());
      finalizeSummary(true, nTitel.trim());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Fehler beim Anlegen der Notiz.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkipNotiz = () => {
    finalizeSummary(false, '');
  };

  const finalizeSummary = (notizDone: boolean, notizT: string) => {
    setSummary({
      unternehmenId: unternehmenId ?? '',
      unternehmenName: unternehmenName,
      terminCreated,
      terminBezeichnung,
      dokumentCreated,
      dokumentBezeichnung,
      notizCreated: notizDone,
      notizTitel: notizT,
    });
  };

  // ── Reset ────────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setStep(1);
    setSaveError(null);
    setUName(''); setURechtsform('none'); setUBranche('none');
    setUStatus(STATUS_OPTIONS[0]?.key ?? 'aktiv');
    setUKapital(''); setUInvestitionsdatum(''); setUStadt('');
    setUnternehmenId(null); setUnternehmenName('');
    setTBezeichnung(''); setTArt('none'); setTDatum(''); setTOrt('');
    setTStatus(TERMINSTATUS_OPTIONS[0]?.key ?? 'geplant');
    setTerminCreated(false); setTerminBezeichnung('');
    setDBezeichnung(''); setDTyp('none'); setDDatum(''); setDLink(''); setDBereitgestellt('');
    setDokumentCreated(false); setDokumentBezeichnung('');
    setNTitel(''); setNInhalt(''); setNDatum(format(new Date(), 'yyyy-MM-dd'));
    setNKategorie(KATEGORIE_OPTIONS[0]?.key ?? 'allgemein'); setNPrioritaet('mittel');
    setNotizCreated(false); setNotizTitel('');
    setSummary(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (summary) {
    const followUps = [
      summary.terminCreated && summary.terminBezeichnung,
      summary.dokumentCreated && summary.dokumentBezeichnung,
      summary.notizCreated && summary.notizTitel,
    ].filter(Boolean);

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="rounded-2xl border bg-card shadow-lg overflow-hidden">
          <div className="bg-primary/10 px-6 py-8 text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center mx-auto">
              <IconCheck size={28} className="text-primary-foreground" stroke={2.5} />
            </div>
            <h2 className="text-xl font-bold text-foreground">Beteiligung angelegt!</h2>
            <p className="text-sm text-muted-foreground">
              {summary.unternehmenName} wurde erfolgreich als neue Portfoliobeteiligung erfasst.
            </p>
          </div>

          <div className="px-6 py-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Zusammenfassung</h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-3">
                <IconBuilding size={18} className="text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{summary.unternehmenName}</p>
                  <p className="text-xs text-muted-foreground">Unternehmen angelegt</p>
                </div>
                <IconCheck size={16} className="text-primary ml-auto shrink-0" />
              </div>

              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${summary.terminCreated ? 'bg-secondary' : 'bg-muted/40'}`}>
                <IconCalendarPlus size={18} className={summary.terminCreated ? 'text-primary shrink-0' : 'text-muted-foreground shrink-0'} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {summary.terminCreated ? summary.terminBezeichnung : 'Kein Termin erfasst'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {summary.terminCreated ? 'Ersttermin angelegt' : 'Übersprungen'}
                  </p>
                </div>
                {summary.terminCreated && <IconCheck size={16} className="text-primary ml-auto shrink-0" />}
              </div>

              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${summary.dokumentCreated ? 'bg-secondary' : 'bg-muted/40'}`}>
                <IconFileText size={18} className={summary.dokumentCreated ? 'text-primary shrink-0' : 'text-muted-foreground shrink-0'} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {summary.dokumentCreated ? summary.dokumentBezeichnung : 'Kein Dokument erfasst'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {summary.dokumentCreated ? 'Erstdokument angelegt' : 'Übersprungen'}
                  </p>
                </div>
                {summary.dokumentCreated && <IconCheck size={16} className="text-primary ml-auto shrink-0" />}
              </div>

              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${summary.notizCreated ? 'bg-secondary' : 'bg-muted/40'}`}>
                <IconNotes size={18} className={summary.notizCreated ? 'text-primary shrink-0' : 'text-muted-foreground shrink-0'} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {summary.notizCreated ? summary.notizTitel : 'Keine Notiz erfasst'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {summary.notizCreated ? 'Erstnotiz angelegt' : 'Übersprungen'}
                  </p>
                </div>
                {summary.notizCreated && <IconCheck size={16} className="text-primary ml-auto shrink-0" />}
              </div>
            </div>

            {followUps.length > 0 && (
              <p className="text-xs text-muted-foreground pt-2">
                {followUps.length} Folgeeintr{followUps.length === 1 ? 'ag' : 'äge'} angelegt.
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button onClick={handleReset} className="flex-1">
                <IconPlus size={16} className="mr-2" />
                Neue Beteiligung anlegen
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <a href="#/">Zurück zum Dashboard</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <IntentWizardShell
      title="Neue Portfoliobeteiligung"
      subtitle="Lege ein neues Unternehmen an und erfasse optional Ersttermin, -dokument und -notiz."
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
    >
      {/* ── Schritt 1: Unternehmen ── */}
      {step === 1 && (
        <div className="space-y-6">
          {unternehmenId ? (
            <div className="rounded-2xl border bg-secondary px-5 py-4 text-center space-y-2">
              <IconCheck size={20} className="text-primary mx-auto" />
              <p className="text-sm font-medium text-foreground">
                Unternehmen <span className="font-bold">{unternehmenName}</span> angelegt.
              </p>
              <p className="text-xs text-muted-foreground">
                Weiter mit Ersttermin, Dokument und Notiz.
              </p>
              <Button size="sm" onClick={() => setStep(2)} className="mt-2">
                Weiter zu Schritt 2
                <IconChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b bg-secondary/40">
                <div className="flex items-center gap-2">
                  <IconBuilding size={18} className="text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Unternehmen anlegen</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Grunddaten der neuen Portfoliobeteiligung erfassen.
                </p>
              </div>

              <div className="px-5 py-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="u-name">
                    Unternehmensname <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="u-name"
                    value={uName}
                    onChange={e => setUName(e.target.value)}
                    placeholder="z. B. Innovatech GmbH"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Status <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map(o => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setUStatus(o.key)}
                        className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="u-kapital">Investiertes Kapital (€)</Label>
                    <Input
                      id="u-kapital"
                      type="number"
                      min="0"
                      step="0.01"
                      value={uKapital}
                      onChange={e => setUKapital(e.target.value)}
                      placeholder="z. B. 250000"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="u-datum">Investitionsdatum</Label>
                    <Input
                      id="u-datum"
                      type="date"
                      value={uInvestitionsdatum}
                      onChange={e => setUInvestitionsdatum(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="u-stadt">Stadt</Label>
                  <Input
                    id="u-stadt"
                    value={uStadt}
                    onChange={e => setUStadt(e.target.value)}
                    placeholder="z. B. Berlin"
                  />
                </div>

                {saveError && (
                  <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3">
                    <IconAlertCircle size={16} className="text-destructive mt-0.5 shrink-0" />
                    <p className="text-sm text-destructive">{saveError}</p>
                  </div>
                )}

                <Button
                  onClick={handleCreateUnternehmen}
                  disabled={!uName.trim() || saving}
                  className="w-full"
                >
                  {saving ? (
                    <IconLoader2 size={16} className="mr-2 animate-spin" />
                  ) : (
                    <IconBuilding size={16} className="mr-2" />
                  )}
                  {saving ? 'Wird angelegt …' : 'Unternehmen anlegen & weiter'}
                  {!saving && <IconChevronRight size={16} className="ml-1" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Schritt 2: Termin ── */}
      {step === 2 && (
        <div className="space-y-4">
          {!unternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                Dieser Schritt braucht ein Unternehmen aus Schritt 1.
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border bg-secondary/40 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Unternehmen:{' '}
                  <span className="font-semibold text-foreground">{unternehmenName}</span>
                </p>
              </div>

              <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b bg-secondary/40">
                  <div className="flex items-center gap-2">
                    <IconCalendarPlus size={18} className="text-primary" />
                    <h2 className="text-base font-semibold text-foreground">Ersttermin erfassen</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Optional — kann übersprungen werden.</p>
                </div>

                <div className="px-5 py-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="t-bezeichnung">
                      Terminbezeichnung <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="t-bezeichnung"
                      value={tBezeichnung}
                      onChange={e => setTBezeichnung(e.target.value)}
                      placeholder="z. B. Kick-off Gesellschafterversammlung"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="t-art">
                        Terminart <span className="text-destructive">*</span>
                      </Label>
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
                      <Label htmlFor="t-datum">
                        Datum & Uhrzeit <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="t-datum"
                        type="datetime-local"
                        value={tDatum}
                        onChange={e => setTDatum(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="t-ort">Ort</Label>
                    <Input
                      id="t-ort"
                      value={tOrt}
                      onChange={e => setTOrt(e.target.value)}
                      placeholder="z. B. Berlin, Konferenzraum A"
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
                          className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                            tStatus === o.key
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card text-foreground border-border hover:bg-secondary'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {saveError && (
                    <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3">
                      <IconAlertCircle size={16} className="text-destructive mt-0.5 shrink-0" />
                      <p className="text-sm text-destructive">{saveError}</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={handleCreateTermin}
                      disabled={!tBezeichnung.trim() || tArt === 'none' || !tDatum || saving}
                      className="flex-1"
                    >
                      {saving ? (
                        <IconLoader2 size={16} className="mr-2 animate-spin" />
                      ) : (
                        <IconCalendarPlus size={16} className="mr-2" />
                      )}
                      {saving ? 'Wird angelegt …' : 'Termin anlegen & weiter'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSkipTermin}
                      disabled={saving}
                      className="flex-1"
                    >
                      <IconPlayerSkipForward size={16} className="mr-2" />
                      Überspringen
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Schritt 3: Dokument ── */}
      {step === 3 && (
        <div className="space-y-4">
          {!unternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                Dieser Schritt braucht ein Unternehmen aus Schritt 1.
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border bg-secondary/40 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Unternehmen:{' '}
                  <span className="font-semibold text-foreground">{unternehmenName}</span>
                  {terminCreated && (
                    <span className="ml-2 text-xs text-primary">· Termin angelegt</span>
                  )}
                </p>
              </div>

              <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b bg-secondary/40">
                  <div className="flex items-center gap-2">
                    <IconFileText size={18} className="text-primary" />
                    <h2 className="text-base font-semibold text-foreground">Erstdokument erfassen</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Optional — kann übersprungen werden.</p>
                </div>

                <div className="px-5 py-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="d-bezeichnung">
                      Dokumentenbezeichnung <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="d-bezeichnung"
                      value={dBezeichnung}
                      onChange={e => setDBezeichnung(e.target.value)}
                      placeholder="z. B. Beteiligungsvertrag 2026"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="d-link">Dokumentenlink (URL)</Label>
                    <Input
                      id="d-link"
                      type="url"
                      value={dLink}
                      onChange={e => setDLink(e.target.value)}
                      placeholder="https://…"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="d-bereitgestellt">Bereitgestellt von</Label>
                    <Input
                      id="d-bereitgestellt"
                      value={dBereitgestellt}
                      onChange={e => setDBereitgestellt(e.target.value)}
                      placeholder="z. B. Steuerberater Müller"
                    />
                  </div>

                  {saveError && (
                    <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3">
                      <IconAlertCircle size={16} className="text-destructive mt-0.5 shrink-0" />
                      <p className="text-sm text-destructive">{saveError}</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={handleCreateDokument}
                      disabled={!dBezeichnung.trim() || saving}
                      className="flex-1"
                    >
                      {saving ? (
                        <IconLoader2 size={16} className="mr-2 animate-spin" />
                      ) : (
                        <IconFileText size={16} className="mr-2" />
                      )}
                      {saving ? 'Wird angelegt …' : 'Dokument anlegen & weiter'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSkipDokument}
                      disabled={saving}
                      className="flex-1"
                    >
                      <IconPlayerSkipForward size={16} className="mr-2" />
                      Überspringen
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Schritt 4: Notiz ── */}
      {step === 4 && (
        <div className="space-y-4">
          {!unternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                Dieser Schritt braucht ein Unternehmen aus Schritt 1.
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border bg-secondary/40 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Unternehmen:{' '}
                  <span className="font-semibold text-foreground">{unternehmenName}</span>
                  {terminCreated && (
                    <span className="ml-2 text-xs text-primary">· Termin angelegt</span>
                  )}
                  {dokumentCreated && (
                    <span className="ml-2 text-xs text-primary">· Dokument angelegt</span>
                  )}
                </p>
              </div>

              <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b bg-secondary/40">
                  <div className="flex items-center gap-2">
                    <IconNotes size={18} className="text-primary" />
                    <h2 className="text-base font-semibold text-foreground">Erstnotiz erfassen</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Optional — kann übersprungen werden.</p>
                </div>

                <div className="px-5 py-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="n-titel">
                      Titel <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="n-titel"
                      value={nTitel}
                      onChange={e => setNTitel(e.target.value)}
                      placeholder="z. B. Erste Eindrücke zur Beteiligung"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="n-inhalt">
                      Inhalt <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="n-inhalt"
                      value={nInhalt}
                      onChange={e => setNInhalt(e.target.value)}
                      placeholder="Notiz erfassen …"
                      rows={4}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="n-datum">
                      Datum <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="n-datum"
                      type="date"
                      value={nDatum}
                      onChange={e => setNDatum(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Kategorie</Label>
                      <div className="flex flex-wrap gap-2">
                        {KATEGORIE_OPTIONS.map(o => (
                          <button
                            key={o.key}
                            type="button"
                            onClick={() => setNKategorie(o.key)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                              nKategorie === o.key
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card text-foreground border-border hover:bg-secondary'
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Priorität</Label>
                      <div className="flex flex-wrap gap-2">
                        {PRIORITAET_OPTIONS.map(o => (
                          <button
                            key={o.key}
                            type="button"
                            onClick={() => setNPrioritaet(o.key)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
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

                  {saveError && (
                    <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3">
                      <IconAlertCircle size={16} className="text-destructive mt-0.5 shrink-0" />
                      <p className="text-sm text-destructive">{saveError}</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={handleCreateNotiz}
                      disabled={!nTitel.trim() || !nInhalt.trim() || !nDatum || saving}
                      className="flex-1"
                    >
                      {saving ? (
                        <IconLoader2 size={16} className="mr-2 animate-spin" />
                      ) : (
                        <IconNotes size={16} className="mr-2" />
                      )}
                      {saving ? 'Wird angelegt …' : 'Notiz anlegen & abschließen'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSkipNotiz}
                      disabled={saving}
                      className="flex-1"
                    >
                      <IconPlayerSkipForward size={16} className="mr-2" />
                      Überspringen & abschließen
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
