/**
 * Unternehmens-Review — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen auswählen (aktiv|inaktiv) → 2) Bewertung & Status aktualisieren
 *        → 3) Nächsten Termin anlegen (optional) → 4) Reviewnotiz erfassen (optional) → Zusammenfassung.
 * Reads: unternehmen. Writes: unternehmen (updateUnternehmenEntry), termine (createTermineEntry),
 *        notizen (createNotizenEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconBuilding,
  IconChartBar,
  IconCalendarPlus,
  IconNotes,
  IconCheck,
  IconAlertTriangle,
  IconArrowRight,
  IconPlayerSkipForward,
} from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
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
import type { Unternehmen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';

const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const WIEDERHOLUNG_OPTIONS = LOOKUP_OPTIONS['termine']?.['wiederholung'] ?? [];
const UNTERNEHMEN_STATUS_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['status'] ?? [];
const NOTIZ_KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const NOTIZ_PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

function formatCurrency(val?: number): string {
  if (val === undefined || val === null) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
}

export default function UnternehmensReviewPage() {
  const { unternehmen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);

  // Step 1 — selection
  const [selectedUnternehmen, setSelectedUnternehmen] = useState<Unternehmen | null>(null);

  // Step 2 — Bewertung aktualisieren
  const [neuerWert, setNeuerWert] = useState('');
  const [neuerStatus, setNeuerStatus] = useState('');
  const [neueBeteiligungsquote, setNeueBeteiligungsquote] = useState('');
  const [cockpitZusammenfassung, setCockpitZusammenfassung] = useState('');
  const [savingBewertung, setSavingBewertung] = useState(false);
  const [bewertungError, setBewertungError] = useState<string | null>(null);

  // Step 3 — Termin (optional)
  const [skipTermin, setSkipTermin] = useState(false);
  const [terminBezeichnung, setTerminBezeichnung] = useState('');
  const [terminArt, setTerminArt] = useState(TERMINART_OPTIONS[0]?.key ?? '');
  const [terminDatumUhrzeit, setTerminDatumUhrzeit] = useState('');
  const [terminOrt, setTerminOrt] = useState('');
  const [terminStatus, setTerminStatus] = useState('geplant');
  const [terminWiederholung, setTerminWiederholung] = useState('einmalig');
  const [savingTermin, setSavingTermin] = useState(false);
  const [terminError, setTerminError] = useState<string | null>(null);
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);

  // Step 4 — Notiz (optional)
  const [skipNotiz, setSkipNotiz] = useState(false);
  const [notizTitel, setNotizTitel] = useState('');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notizKategorie, setNotizKategorie] = useState('strategie');
  const [notizPrioritaet, setNotizPrioritaet] = useState('hoch');
  const [savingNotiz, setSavingNotiz] = useState(false);
  const [notizError, setNotizError] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);

  // Summary state
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  const eligibleUnternehmen = unternehmen.filter(
    u => u.fields.status?.key !== 'exit'
  );

  // Step 1 handler
  function handleSelectUnternehmen(id: string) {
    const u = unternehmen.find(x => x.record_id === id) ?? null;
    setSelectedUnternehmen(u);
    if (u) {
      setNeuerWert(u.fields.aktueller_wert !== undefined ? String(u.fields.aktueller_wert) : '');
      setNeuerStatus(u.fields.status?.key ?? UNTERNEHMEN_STATUS_OPTIONS[0]?.key ?? '');
      setNeueBeteiligungsquote(u.fields.beteiligungsquote !== undefined ? String(u.fields.beteiligungsquote) : '');
      setCockpitZusammenfassung(u.fields.cockpit_zusammenfassung ?? '');
    }
    setStep(2);
  }

  // Step 2 save
  async function handleSaveBewertung() {
    if (!selectedUnternehmen) return;
    setSavingBewertung(true);
    setBewertungError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (neuerStatus) payload.status = neuerStatus;
      if (neuerWert !== '') payload.aktueller_wert = parseFloat(neuerWert);
      if (neueBeteiligungsquote !== '') payload.beteiligungsquote = parseFloat(neueBeteiligungsquote);
      if (cockpitZusammenfassung !== '') payload.cockpit_zusammenfassung = cockpitZusammenfassung;

      await LivingAppsService.updateUnternehmenEntry(selectedUnternehmen.record_id, payload);
      setSavedStatus(neuerStatus);
      await fetchAll();
      setStep(3);
    } catch (err) {
      setBewertungError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSavingBewertung(false);
    }
  }

  // Step 3 save
  async function handleSaveTermin() {
    if (!selectedUnternehmen) return;
    setSavingTermin(true);
    setTerminError(null);
    try {
      let tid = createdTerminId;
      if (!tid) {
        const result = await LivingAppsService.createTermineEntry({
          terminbezeichnung: terminBezeichnung,
          terminart: terminArt,
          datum_uhrzeit: terminDatumUhrzeit,
          ort: terminOrt || undefined,
          terminstatus: terminStatus,
          wiederholung: terminWiederholung,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmen.record_id),
        });
        tid = result.record_id;
        setCreatedTerminId(tid);
      }
      await fetchAll();
      setStep(4);
    } catch (err) {
      setTerminError(err instanceof Error ? err.message : 'Fehler beim Anlegen des Termins');
    } finally {
      setSavingTermin(false);
    }
  }

  // Step 4 save
  async function handleSaveNotiz() {
    if (!selectedUnternehmen) return;
    setSavingNotiz(true);
    setNotizError(null);
    try {
      let nid = createdNotizId;
      if (!nid) {
        const result = await LivingAppsService.createNotizenEntry({
          notiz_titel: notizTitel,
          notiz_inhalt: notizInhalt,
          notiz_datum: notizDatum,
          kategorie: notizKategorie,
          prioritaet: notizPrioritaet,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmen.record_id),
        });
        nid = result.record_id;
        setCreatedNotizId(nid);
      }
      await fetchAll();
      setStep(5);
    } catch (err) {
      setNotizError(err instanceof Error ? err.message : 'Fehler beim Anlegen der Notiz');
    } finally {
      setSavingNotiz(false);
    }
  }

  function handleReset() {
    setStep(1);
    setSelectedUnternehmen(null);
    setNeuerWert('');
    setNeuerStatus('');
    setNeueBeteiligungsquote('');
    setCockpitZusammenfassung('');
    setBewertungError(null);
    setSkipTermin(false);
    setTerminBezeichnung('');
    setTerminArt(TERMINART_OPTIONS[0]?.key ?? '');
    setTerminDatumUhrzeit('');
    setTerminOrt('');
    setTerminStatus('geplant');
    setTerminWiederholung('einmalig');
    setTerminError(null);
    setCreatedTerminId(null);
    setSkipNotiz(false);
    setNotizTitel('');
    setNotizInhalt('');
    setNotizKategorie('strategie');
    setNotizPrioritaet('hoch');
    setNotizError(null);
    setCreatedNotizId(null);
    setSavedStatus(null);
  }

  // Compute value delta for live feedback
  const investiert = selectedUnternehmen?.fields.investiertes_kapital ?? 0;
  const wertNeu = neuerWert !== '' ? parseFloat(neuerWert) : (selectedUnternehmen?.fields.aktueller_wert ?? 0);
  const delta = wertNeu - investiert;

  return (
    <IntentWizardShell
      title="Unternehmens-Review"
      subtitle="Status aktualisieren, Termin anlegen und Notiz erfassen"
      steps={[
        { label: 'Unternehmen' },
        { label: 'Bewertung' },
        { label: 'Termin' },
        { label: 'Notiz' },
        { label: 'Fertig' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* STEP 1 — Unternehmen auswählen */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-4">
            <h2 className="font-semibold text-base mb-1">Unternehmen auswählen</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Wähle ein aktives oder inaktives Portfoliounternehmen für den Review aus.
            </p>
            <EntitySelectStep
              items={eligibleUnternehmen.map(u => ({
                id: u.record_id,
                title: u.fields.name ?? '(kein Name)',
                subtitle: [
                  u.fields.branche?.label,
                  u.fields.stadt,
                ].filter(Boolean).join(' · '),
                status: u.fields.status
                  ? { key: u.fields.status.key, label: u.fields.status.label }
                  : undefined,
                stats: [
                  { label: 'Investiert', value: formatCurrency(u.fields.investiertes_kapital) },
                  { label: 'Aktueller Wert', value: formatCurrency(u.fields.aktueller_wert) },
                ],
                icon: <IconBuilding size={20} className="text-primary" />,
              }))}
              onSelect={handleSelectUnternehmen}
              searchPlaceholder="Unternehmen suchen..."
              emptyText="Keine aktiven oder inaktiven Unternehmen gefunden."
              emptyIcon={<IconBuilding size={32} />}
            />
          </div>
        </div>
      )}

      {/* STEP 2 — Bewertung aktualisieren */}
      {step === 2 && (
        <div className="space-y-4">
          {!selectedUnternehmen ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                Dieser Schritt benötigt ein ausgewähltes Unternehmen aus Schritt 1.
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              {/* Context card */}
              <div className="rounded-2xl border bg-card p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconBuilding size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{selectedUnternehmen.fields.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {selectedUnternehmen.fields.branche && (
                      <span className="text-xs text-muted-foreground">{selectedUnternehmen.fields.branche.label}</span>
                    )}
                    {selectedUnternehmen.fields.status && (
                      <StatusBadge
                        statusKey={selectedUnternehmen.fields.status.key}
                        label={selectedUnternehmen.fields.status.label}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Value delta live feedback */}
              <div className={`rounded-2xl border p-4 flex items-center gap-3 ${delta >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <IconChartBar size={20} className={delta >= 0 ? 'text-green-600' : 'text-red-600'} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Wertentwicklung vs. investiertes Kapital</p>
                  <p className={`font-semibold text-sm ${delta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                    <span className="font-normal text-muted-foreground ml-2">
                      (Investiert: {formatCurrency(investiert)})
                    </span>
                  </p>
                </div>
              </div>

              {/* Bewertung-Formular */}
              <div className="rounded-2xl border bg-card p-4 space-y-4">
                <h2 className="font-semibold text-base">Bewertung aktualisieren</h2>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Aktueller Marktwert (€)</label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder={String(selectedUnternehmen.fields.aktueller_wert ?? '')}
                    value={neuerWert}
                    onChange={e => setNeuerWert(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Status <span className="text-destructive">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {UNTERNEHMEN_STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setNeuerStatus(opt.key)}
                        className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                          neuerStatus === opt.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border text-foreground hover:border-primary/50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Beteiligungsquote (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder={String(selectedUnternehmen.fields.beteiligungsquote ?? '')}
                    value={neueBeteiligungsquote}
                    onChange={e => setNeueBeteiligungsquote(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Cockpit-Zusammenfassung</label>
                  <Textarea
                    placeholder="Kurze Zusammenfassung für das Cockpit..."
                    value={cockpitZusammenfassung}
                    onChange={e => setCockpitZusammenfassung(e.target.value)}
                    rows={3}
                  />
                </div>

                {bewertungError && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-xl p-3">
                    <IconAlertTriangle size={16} className="shrink-0" />
                    {bewertungError}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" onClick={() => setStep(1)}>Zurück</Button>
                  <Button
                    disabled={!neuerStatus || savingBewertung}
                    onClick={handleSaveBewertung}
                    className="gap-1.5"
                  >
                    {savingBewertung ? 'Speichern...' : 'Speichern & weiter'}
                    {!savingBewertung && <IconArrowRight size={15} />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 3 — Termin anlegen (optional) */}
      {step === 3 && (
        <div className="space-y-4">
          {!selectedUnternehmen ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                Dieser Schritt benötigt ein ausgewähltes Unternehmen aus Schritt 1.
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              {/* Context */}
              <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconCalendarPlus size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Nächsten Termin anlegen</p>
                  <p className="text-xs text-muted-foreground">für {selectedUnternehmen.fields.name}</p>
                </div>
              </div>

              {!skipTermin && (
                <div className="rounded-2xl border bg-card p-4 space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Terminbezeichnung <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="z. B. Q3-Review 2026"
                      value={terminBezeichnung}
                      onChange={e => setTerminBezeichnung(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Terminart <span className="text-destructive">*</span>
                    </label>
                    <Select value={terminArt} onValueChange={setTerminArt}>
                      <SelectTrigger>
                        <SelectValue placeholder="Terminart wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {TERMINART_OPTIONS.map(opt => (
                          <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Datum & Uhrzeit <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="datetime-local"
                      value={terminDatumUhrzeit}
                      onChange={e => setTerminDatumUhrzeit(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Ort</label>
                    <Input
                      placeholder="z. B. Büro Berlin"
                      value={terminOrt}
                      onChange={e => setTerminOrt(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Terminstatus</label>
                    <div className="flex flex-wrap gap-2">
                      {TERMINSTATUS_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setTerminStatus(opt.key)}
                          className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                            terminStatus === opt.key
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card border-border text-foreground hover:border-primary/50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Wiederholung</label>
                    <Select value={terminWiederholung} onValueChange={setTerminWiederholung}>
                      <SelectTrigger>
                        <SelectValue placeholder="Wiederholung wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {WIEDERHOLUNG_OPTIONS.map(opt => (
                          <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {terminError && (
                    <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-xl p-3">
                      <IconAlertTriangle size={16} className="shrink-0" />
                      {terminError}
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" onClick={() => setStep(2)}>Zurück</Button>
                    <Button
                      variant="outline"
                      onClick={() => { setSkipTermin(true); setStep(4); }}
                      className="gap-1.5"
                    >
                      <IconPlayerSkipForward size={15} />
                      Überspringen
                    </Button>
                    <Button
                      disabled={!terminBezeichnung || !terminArt || !terminDatumUhrzeit || savingTermin}
                      onClick={handleSaveTermin}
                      className="gap-1.5"
                    >
                      {savingTermin ? 'Anlegen...' : 'Termin anlegen & weiter'}
                      {!savingTermin && <IconArrowRight size={15} />}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* STEP 4 — Notiz erfassen (optional) */}
      {step === 4 && (
        <div className="space-y-4">
          {!selectedUnternehmen ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                Dieser Schritt benötigt ein ausgewähltes Unternehmen aus Schritt 1.
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              {/* Context */}
              <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconNotes size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Reviewnotiz erfassen</p>
                  <p className="text-xs text-muted-foreground">für {selectedUnternehmen.fields.name}</p>
                </div>
              </div>

              {!skipNotiz && (
                <div className="rounded-2xl border bg-card p-4 space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Titel <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="z. B. Review August 2026"
                      value={notizTitel}
                      onChange={e => setNotizTitel(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Inhalt <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      placeholder="Notizinhalt..."
                      value={notizInhalt}
                      onChange={e => setNotizInhalt(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Datum <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="date"
                      value={notizDatum}
                      readOnly
                      className="bg-muted cursor-default"
                    />
                    <p className="text-xs text-muted-foreground">Wird automatisch auf heute gesetzt.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Kategorie</label>
                    <Select value={notizKategorie} onValueChange={setNotizKategorie}>
                      <SelectTrigger>
                        <SelectValue placeholder="Kategorie wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {NOTIZ_KATEGORIE_OPTIONS.map(opt => (
                          <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Priorität</label>
                    <div className="flex flex-wrap gap-2">
                      {NOTIZ_PRIORITAET_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setNotizPrioritaet(opt.key)}
                          className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                            notizPrioritaet === opt.key
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card border-border text-foreground hover:border-primary/50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {notizError && (
                    <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-xl p-3">
                      <IconAlertTriangle size={16} className="shrink-0" />
                      {notizError}
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" onClick={() => setStep(3)}>Zurück</Button>
                    <Button
                      variant="outline"
                      onClick={() => { setSkipNotiz(true); setStep(5); }}
                      className="gap-1.5"
                    >
                      <IconPlayerSkipForward size={15} />
                      Überspringen
                    </Button>
                    <Button
                      disabled={!notizTitel || !notizInhalt || savingNotiz}
                      onClick={handleSaveNotiz}
                      className="gap-1.5"
                    >
                      {savingNotiz ? 'Speichern...' : 'Notiz speichern & abschließen'}
                      {!savingNotiz && <IconArrowRight size={15} />}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* STEP 5 — Zusammenfassung */}
      {step === 5 && (
        <div className="space-y-4">
          {!selectedUnternehmen ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                Dieser Schritt benötigt ein ausgewähltes Unternehmen aus Schritt 1.
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center shrink-0">
                  <IconCheck size={24} className="text-green-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">Review abgeschlossen</h2>
                  <p className="text-sm text-muted-foreground">Alle Änderungen wurden gespeichert.</p>
                </div>
              </div>

              <div className="divide-y divide-border rounded-xl border overflow-hidden">
                <div className="flex items-center gap-3 p-3 bg-secondary/30">
                  <IconBuilding size={16} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Unternehmen</p>
                    <p className="font-medium text-sm truncate">{selectedUnternehmen.fields.name}</p>
                  </div>
                  {savedStatus && (
                    <StatusBadge
                      statusKey={savedStatus}
                      label={UNTERNEHMEN_STATUS_OPTIONS.find(o => o.key === savedStatus)?.label ?? savedStatus}
                    />
                  )}
                </div>

                <div className="flex items-center gap-3 p-3 bg-secondary/30">
                  <IconCalendarPlus size={16} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Termin</p>
                    <p className="font-medium text-sm">
                      {createdTerminId ? terminBezeichnung : 'Kein Termin angelegt'}
                    </p>
                  </div>
                  {createdTerminId && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium shrink-0">
                      Angelegt
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 p-3 bg-secondary/30">
                  <IconNotes size={16} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Notiz</p>
                    <p className="font-medium text-sm">
                      {createdNotizId ? notizTitel : 'Keine Notiz erfasst'}
                    </p>
                  </div>
                  {createdNotizId && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium shrink-0">
                      Angelegt
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleReset} variant="outline">
                  Weiteren Review starten
                </Button>
                <a href="#/">
                  <Button>Zurück zum Dashboard</Button>
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
