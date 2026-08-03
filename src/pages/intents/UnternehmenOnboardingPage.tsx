/**
 * Unternehmen Onboarding — 4-Schritt-Wizard.
 * Steps: 1) Stammdaten erfassen (createUnternehmenEntry) →
 *        2) Ersten Termin anlegen (createTermineEntry, verknüpft mit Unternehmen) →
 *        3) Erstes Dokument hinzufügen (createDokumenteEntry, verknüpft mit Unternehmen) →
 *        4) Zusammenfassung.
 * Reads: (keine Leseschritte — alle Datensätze werden frisch angelegt).
 * Writes: unternehmen (createUnternehmenEntry), termine (createTermineEntry),
 *         dokumente (createDokumenteEntry).
 * Composes: IntentWizardShell.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LOOKUP_OPTIONS, APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import {
  IconBuildingFactory2,
  IconCalendarEvent,
  IconFileText,
  IconCircleCheck,
  IconChevronRight,
  IconAlertCircle,
} from '@tabler/icons-react';

// ── Lookup options (read with ?. to avoid white-page crash on absent key) ──
const RECHTSFORM_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['rechtsform'] ?? [];
const BRANCHE_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['branche'] ?? [];
const STATUS_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['status'] ?? [];
const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const WIEDERHOLUNG_OPTIONS = LOOKUP_OPTIONS['termine']?.['wiederholung'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];

// ── Formatierung ──────────────────────────────────────────────────────────────
function formatCurrency(v?: number) {
  if (v == null) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function formatDateDisplay(s?: string) {
  if (!s) return '–';
  try {
    return format(new Date(s), 'dd.MM.yyyy');
  } catch {
    return s;
  }
}

function formatDateTimeDisplay(s?: string) {
  if (!s) return '–';
  try {
    return format(new Date(s), 'dd.MM.yyyy HH:mm');
  } catch {
    return s;
  }
}

// ── Kleiner Kontext-Banner ab Schritt 2 ───────────────────────────────────────
interface UnternehmenBannerProps {
  name: string;
  statusKey: string;
  statusLabel: string;
}
function UnternehmenBanner({ name, statusKey, statusLabel }: UnternehmenBannerProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary border mb-2">
      <IconBuildingFactory2 size={18} className="text-primary shrink-0" />
      <span className="font-semibold text-sm truncate min-w-0">{name}</span>
      <StatusBadge statusKey={statusKey} label={statusLabel} />
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function UnternehmenOnboardingPage() {
  const { loading, error, fetchAll } = useDashboardData();

  // Wizard-Schritt (1-basiert)
  const [step, setStep] = useState(1);

  // Ergebnisse der Erstellungsschritte
  const [unternehmenId, setUnternehmenId] = useState<string | null>(null);
  const [terminId, setTerminId] = useState<string | null>(null);
  const [dokumentId, setDokumentId] = useState<string | null>(null);

  // Fehlerzustand je Schritt
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Schritt 1: Unternehmen-Formular ────────────────────────────────────────
  const [uName, setUName] = useState('');
  const [uRechtsform, setURechtsform] = useState('none');
  const [uBranche, setUBranche] = useState('none');
  const [uStatusKey, setUStatusKey] = useState(STATUS_OPTIONS[0]?.key ?? '');
  const [uBeteiligung, setUBeteiligung] = useState('');
  const [uKapital, setUKapital] = useState('');
  const [uInvDatum, setUInvDatum] = useState('');
  const [uStadt, setUStadt] = useState('');
  const [uLand, setULand] = useState('');

  // Für den Kontext-Banner ab Schritt 2
  const uStatusLabel = STATUS_OPTIONS.find(o => o.key === uStatusKey)?.label ?? uStatusKey;

  // ── Schritt 2: Termin-Formular ──────────────────────────────────────────────
  const [tBezeichnung, setTBezeichnung] = useState('');
  const [tArtKey, setTArtKey] = useState('none');
  const [tDatum, setTDatum] = useState('');
  const [tOrt, setTOrt] = useState('');
  const [tWiederholungKey, setTWiederholungKey] = useState('none');
  const [tNotizen, setTNotizen] = useState('');

  // ── Schritt 3: Dokument-Formular ────────────────────────────────────────────
  const [dBezeichnung, setDBezeichnung] = useState('');
  const [dTypKey, setDTypKey] = useState('none');
  const [dDatum, setDDatum] = useState('');
  const [dLink, setDLink] = useState('');
  const [dBereitgestellt, setDBereitgestellt] = useState('');
  const [dBeschreibung, setDBeschreibung] = useState('');

  // Alle Hooks MÜSSEN vor dem frühen Return stehen ↑

  // ── Submit-Handler ──────────────────────────────────────────────────────────

  async function handleCreateUnternehmen() {
    if (!uName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        name: uName.trim(),
        status: uStatusKey,
      };
      if (uRechtsform !== 'none') payload.rechtsform = uRechtsform;
      if (uBranche !== 'none') payload.branche = uBranche;
      if (uBeteiligung) payload.beteiligungsquote = parseFloat(uBeteiligung);
      if (uKapital) payload.investiertes_kapital = parseFloat(uKapital);
      if (uInvDatum) payload.investitionsdatum = uInvDatum; // already YYYY-MM-DD from <Input type="date">
      if (uStadt.trim()) payload.stadt = uStadt.trim();
      if (uLand.trim()) payload.land = uLand.trim();

      const result = await LivingAppsService.createUnternehmenEntry(payload);
      setUnternehmenId(result.record_id);
      await fetchAll();
      setStep(2);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unternehmen konnte nicht angelegt werden.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateTermin() {
    if (!tBezeichnung.trim() || tArtKey === 'none' || !tDatum) return;
    if (!unternehmenId) { setStep(1); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Idempotenz-Guard: falls ein erster Versuch den Termin anlegte, aber fetchAll fehlschlug
      let tid = terminId;
      if (!tid) {
        const payload: Record<string, unknown> = {
          terminbezeichnung: tBezeichnung.trim(),
          terminart: tArtKey,
          datum_uhrzeit: tDatum, // datetime-local string ist bereits "YYYY-MM-DDTHH:mm"
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
        };
        if (tOrt.trim()) payload.ort = tOrt.trim();
        if (tWiederholungKey !== 'none') payload.wiederholung = tWiederholungKey;
        if (tNotizen.trim()) payload.notizen_termin = tNotizen.trim();

        const result = await LivingAppsService.createTermineEntry(payload);
        tid = result.record_id;
        setTerminId(tid);
        await fetchAll();
      }
      setStep(3);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Termin konnte nicht angelegt werden.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateDokument() {
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
        if (dTypKey !== 'none') payload.dokumententyp = dTypKey;
        if (dDatum) payload.dokumentendatum = dDatum;
        if (dLink.trim()) payload.dokumentenlink = dLink.trim();
        if (dBereitgestellt.trim()) payload.bereitgestellt_von = dBereitgestellt.trim();
        if (dBeschreibung.trim()) payload.dokumentenbeschreibung = dBeschreibung.trim();

        const result = await LivingAppsService.createDokumenteEntry(payload);
        did = result.record_id;
        setDokumentId(did);
        await fetchAll();
      }
      setStep(4);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Dokument konnte nicht hinzugefügt werden.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setStep(1);
    setUnternehmenId(null);
    setTerminId(null);
    setDokumentId(null);
    setSubmitError(null);
    setUName(''); setURechtsform('none'); setUBranche('none');
    setUStatusKey(STATUS_OPTIONS[0]?.key ?? '');
    setUBeteiligung(''); setUKapital(''); setUInvDatum(''); setUStadt(''); setULand('');
    setTBezeichnung(''); setTArtKey('none'); setTDatum(''); setTOrt('');
    setTWiederholungKey('none'); setTNotizen('');
    setDBezeichnung(''); setDTypKey('none'); setDDatum(''); setDLink('');
    setDBereitgestellt(''); setDBeschreibung('');
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <IntentWizardShell
      title="Unternehmen Onboarding"
      subtitle="Neues Portfolio-Unternehmen in drei Schritten anlegen"
      steps={[
        { label: 'Stammdaten' },
        { label: 'Termin' },
        { label: 'Dokument' },
        { label: 'Fertig' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Schritt 1: Unternehmen anlegen ───────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <IconBuildingFactory2 size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Stammdaten erfassen</h2>
              <p className="text-sm text-muted-foreground">Grundlegende Informationen zum neuen Portfolio-Unternehmen</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4 overflow-hidden">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Unternehmensname <span className="text-destructive">*</span></label>
              <Input
                value={uName}
                onChange={e => setUName(e.target.value)}
                placeholder="z. B. Muster GmbH"
              />
            </div>

            {/* Rechtsform + Branche */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Rechtsform</label>
                <Select value={uRechtsform} onValueChange={setURechtsform}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Bitte wählen" />
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
                <label className="text-sm font-medium">Branche</label>
                <Select value={uBranche} onValueChange={setUBranche}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Bitte wählen" />
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

            {/* Status (Radio-Style als Kacheln) */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Status <span className="text-destructive">*</span></label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setUStatusKey(o.key)}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      uStatusKey === o.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border hover:bg-secondary'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Kapital + Beteiligungsquote */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Investiertes Kapital (€)</label>
                <Input
                  type="number"
                  min="0"
                  value={uKapital}
                  onChange={e => setUKapital(e.target.value)}
                  placeholder="z. B. 500000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Beteiligungsquote (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={uBeteiligung}
                  onChange={e => setUBeteiligung(e.target.value)}
                  placeholder="z. B. 25.5"
                />
              </div>
            </div>

            {/* Investitionsdatum */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Investitionsdatum</label>
              <Input
                type="date"
                value={uInvDatum}
                onChange={e => setUInvDatum(e.target.value)}
              />
            </div>

            {/* Stadt + Land */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Stadt</label>
                <Input value={uStadt} onChange={e => setUStadt(e.target.value)} placeholder="z. B. Berlin" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Land</label>
                <Input value={uLand} onChange={e => setULand(e.target.value)} placeholder="z. B. Deutschland" />
              </div>
            </div>
          </div>

          {submitError && (
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
              {submitError}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              disabled={!uName.trim() || !uStatusKey || submitting}
              onClick={handleCreateUnternehmen}
              className="gap-2"
            >
              {submitting ? 'Wird angelegt…' : 'Weiter: Termin anlegen'}
              <IconChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Schritt 2: Ersten Termin anlegen ────────────────────────────────── */}
      {step === 2 && (
        unternehmenId ? (
          <div className="space-y-5">
            <UnternehmenBanner name={uName} statusKey={uStatusKey} statusLabel={uStatusLabel} />

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconCalendarEvent size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Ersten Termin anlegen</h2>
                <p className="text-sm text-muted-foreground">Verknüpfe direkt einen ersten Termin mit dem Unternehmen</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4 overflow-hidden">
              {/* Bezeichnung */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Terminbezeichnung <span className="text-destructive">*</span></label>
                <Input
                  value={tBezeichnung}
                  onChange={e => setTBezeichnung(e.target.value)}
                  placeholder="z. B. Kick-off Meeting"
                />
              </div>

              {/* Terminart */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Terminart <span className="text-destructive">*</span></label>
                <Select value={tArtKey} onValueChange={setTArtKey}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bitte wählen</SelectItem>
                    {TERMINART_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Datum + Uhrzeit */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Datum & Uhrzeit <span className="text-destructive">*</span></label>
                <Input
                  type="datetime-local"
                  value={tDatum}
                  onChange={e => setTDatum(e.target.value)}
                />
              </div>

              {/* Ort */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Ort</label>
                <Input value={tOrt} onChange={e => setTOrt(e.target.value)} placeholder="z. B. Büro Berlin" />
              </div>

              {/* Wiederholung */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Wiederholung</label>
                <Select value={tWiederholungKey} onValueChange={setTWiederholungKey}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Keine Wiederholung" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Wiederholung</SelectItem>
                    {WIEDERHOLUNG_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notizen */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Notizen</label>
                <Textarea
                  value={tNotizen}
                  onChange={e => setTNotizen(e.target.value)}
                  placeholder="Optionale Hinweise zum Termin …"
                  rows={3}
                />
              </div>
            </div>

            {submitError && (
              <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                {submitError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Zurück
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => { setTerminId(null); setStep(3); }}
                >
                  Schritt überspringen
                </Button>
                <Button
                  disabled={!tBezeichnung.trim() || tArtKey === 'none' || !tDatum || submitting}
                  onClick={handleCreateTermin}
                  className="gap-2"
                >
                  {submitting ? 'Wird angelegt…' : 'Weiter: Dokument hinzufügen'}
                  <IconChevronRight size={16} />
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

      {/* ── Schritt 3: Erstes Dokument hinzufügen ───────────────────────────── */}
      {step === 3 && (
        unternehmenId ? (
          <div className="space-y-5">
            <UnternehmenBanner name={uName} statusKey={uStatusKey} statusLabel={uStatusLabel} />

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconFileText size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Erstes Dokument hinzufügen</h2>
                <p className="text-sm text-muted-foreground">Verknüpfe direkt ein erstes Dokument mit dem Unternehmen</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4 overflow-hidden">
              {/* Bezeichnung */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Dokumentenbezeichnung <span className="text-destructive">*</span></label>
                <Input
                  value={dBezeichnung}
                  onChange={e => setDBezeichnung(e.target.value)}
                  placeholder="z. B. Gesellschaftsvertrag 2025"
                />
              </div>

              {/* Dokumententyp */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Dokumententyp</label>
                <Select value={dTypKey} onValueChange={setDTypKey}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Angabe</SelectItem>
                    {DOKUMENTENTYP_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dokumentendatum */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Dokumentendatum</label>
                <Input
                  type="date"
                  value={dDatum}
                  onChange={e => setDDatum(e.target.value)}
                />
              </div>

              {/* Dokumentenlink */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Link zum Dokument</label>
                <Input
                  type="url"
                  value={dLink}
                  onChange={e => setDLink(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              {/* Bereitgestellt von */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Bereitgestellt von</label>
                <Input
                  value={dBereitgestellt}
                  onChange={e => setDBereitgestellt(e.target.value)}
                  placeholder="z. B. Max Mustermann"
                />
              </div>

              {/* Beschreibung */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Beschreibung</label>
                <Textarea
                  value={dBeschreibung}
                  onChange={e => setDBeschreibung(e.target.value)}
                  placeholder="Optionale Beschreibung …"
                  rows={3}
                />
              </div>
            </div>

            {submitError && (
              <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                {submitError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                Zurück
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => { setDokumentId(null); setStep(4); }}
                >
                  Schritt überspringen
                </Button>
                <Button
                  disabled={!dBezeichnung.trim() || submitting}
                  onClick={handleCreateDokument}
                  className="gap-2"
                >
                  {submitting ? 'Wird gespeichert…' : 'Weiter: Zusammenfassung'}
                  <IconChevronRight size={16} />
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

      {/* ── Schritt 4: Zusammenfassung ──────────────────────────────────────── */}
      {step === 4 && (
        unternehmenId ? (
          <div className="space-y-6">
            {/* Erfolgs-Header */}
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <IconCircleCheck size={30} className="text-primary" />
              </div>
              <h2 className="text-xl font-bold text-center">Onboarding abgeschlossen!</h2>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Das neue Portfolio-Unternehmen wurde erfolgreich angelegt.
              </p>
            </div>

            {/* Unternehmen */}
            <div className="rounded-2xl border bg-card p-5 space-y-3 overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                <IconBuildingFactory2 size={16} className="text-primary" />
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Unternehmen</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-lg font-bold truncate min-w-0">{uName}</span>
                <StatusBadge statusKey={uStatusKey} label={uStatusLabel} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mt-2">
                {uRechtsform !== 'none' && (
                  <div>
                    <p className="text-muted-foreground text-xs">Rechtsform</p>
                    <p className="font-medium truncate">{RECHTSFORM_OPTIONS.find(o => o.key === uRechtsform)?.label ?? uRechtsform}</p>
                  </div>
                )}
                {uBranche !== 'none' && (
                  <div>
                    <p className="text-muted-foreground text-xs">Branche</p>
                    <p className="font-medium truncate">{BRANCHE_OPTIONS.find(o => o.key === uBranche)?.label ?? uBranche}</p>
                  </div>
                )}
                {uKapital && (
                  <div>
                    <p className="text-muted-foreground text-xs">Investiertes Kapital</p>
                    <p className="font-medium">{formatCurrency(parseFloat(uKapital))}</p>
                  </div>
                )}
                {uBeteiligung && (
                  <div>
                    <p className="text-muted-foreground text-xs">Beteiligungsquote</p>
                    <p className="font-medium">{uBeteiligung} %</p>
                  </div>
                )}
                {uInvDatum && (
                  <div>
                    <p className="text-muted-foreground text-xs">Investitionsdatum</p>
                    <p className="font-medium">{formatDateDisplay(uInvDatum)}</p>
                  </div>
                )}
                {(uStadt || uLand) && (
                  <div>
                    <p className="text-muted-foreground text-xs">Standort</p>
                    <p className="font-medium truncate">{[uStadt, uLand].filter(Boolean).join(', ')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Termin */}
            {terminId ? (
              <div className="rounded-2xl border bg-card p-5 space-y-2 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <IconCalendarEvent size={16} className="text-primary" />
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Erster Termin</span>
                </div>
                <p className="font-semibold truncate min-w-0">{tBezeichnung}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {tArtKey !== 'none' && <span>{TERMINART_OPTIONS.find(o => o.key === tArtKey)?.label}</span>}
                  {tDatum && <span>{formatDateTimeDisplay(tDatum)}</span>}
                  {tOrt && <span>{tOrt}</span>}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-secondary/50 p-4 text-sm text-muted-foreground flex items-center gap-2">
                <IconCalendarEvent size={16} className="shrink-0" />
                Kein Termin angelegt — kann jederzeit nachgeholt werden.
              </div>
            )}

            {/* Dokument */}
            {dokumentId ? (
              <div className="rounded-2xl border bg-card p-5 space-y-2 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <IconFileText size={16} className="text-primary" />
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Erstes Dokument</span>
                </div>
                <p className="font-semibold truncate min-w-0">{dBezeichnung}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {dTypKey !== 'none' && <span>{DOKUMENTENTYP_OPTIONS.find(o => o.key === dTypKey)?.label}</span>}
                  {dDatum && <span>{formatDateDisplay(dDatum)}</span>}
                  {dBereitgestellt && <span>Von: {dBereitgestellt}</span>}
                </div>
                {dLink && (
                  <a
                    href={dLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline truncate block min-w-0"
                  >
                    {dLink}
                  </a>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-secondary/50 p-4 text-sm text-muted-foreground flex items-center gap-2">
                <IconFileText size={16} className="shrink-0" />
                Kein Dokument hochgeladen — kann jederzeit nachgeholt werden.
              </div>
            )}

            {/* Aktionen */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button onClick={handleReset} variant="outline" className="flex-1">
                Weiteres Unternehmen anlegen
              </Button>
              <a href="#/" className="flex-1">
                <Button className="w-full">Zurück zum Dashboard</Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht das Unternehmen aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
