/**
 * Portfolio-Review — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen auswählen (status aktiv|inaktiv) → 2) Review-Termin anlegen →
 *        3) Review-Notiz erfassen → 4) Statusaktualisierung (optional) & Abschluss.
 * Reads: unternehmen. Writes: termine (createTermineEntry), notizen (createNotizenEntry),
 *        unternehmen (updateUnternehmenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  IconBuilding,
  IconCalendar,
  IconNotes,
  IconChartBar,
  IconCheck,
  IconRefresh,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
} from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];
const UNTERNEHMEN_STATUS_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['status'] ?? [];

function formatCurrency(val?: number): string {
  if (val == null) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
}

function formatPercent(val?: number): string {
  if (val == null) return '–';
  return `${val.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`;
}

export default function PortfolioReviewPage() {
  const { unternehmen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);

  // Step 1
  const [selectedUnternehmenId, setSelectedUnternehmenId] = useState<string | null>(null);

  // Step 2 — Termin
  const [terminbezeichnung, setTerminbezeichnung] = useState('Portfolio-Review');
  const [terminart, setTerminart] = useState(TERMINART_OPTIONS[0]?.key ?? '');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [terminstatus, setTerminstatus] = useState('stattgefunden');
  const [notizenTermin, setNotizenTermin] = useState('');
  const [terminSaving, setTerminSaving] = useState(false);
  const [terminError, setTerminError] = useState<string | null>(null);
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);

  // Step 3 — Notiz
  const [notizTitel, setNotizTitel] = useState('Review-Ergebnisse');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kategorieKey, setKategorieKey] = useState('strategie');
  const [prioritaetKey, setPrioritaetKey] = useState(PRIORITAET_OPTIONS[0]?.key ?? '');
  const [schlagwoerter, setSchlagwoerter] = useState('');
  const [notizSaving, setNotizSaving] = useState(false);
  const [notizError, setNotizError] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);

  // Step 4 — Statusaktualisierung
  const [aktuellerWert, setAktuellerWert] = useState('');
  const [neuerStatus, setNeuerStatus] = useState('');
  const [cockpitZusammenfassung, setCockpitZusammenfassung] = useState('');
  const [updateSaving, setUpdateSaving] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateDone, setUpdateDone] = useState(false);

  // Abschluss
  const [finished, setFinished] = useState(false);

  const selectedUnternehmen = useMemo<Unternehmen | null>(
    () => unternehmen.find(u => u.record_id === selectedUnternehmenId) ?? null,
    [unternehmen, selectedUnternehmenId]
  );

  // Filter: nur aktiv | inaktiv (kein exit)
  const eligibleUnternehmen = useMemo(
    () => unternehmen.filter(u => {
      const key = u.fields.status?.key;
      return key === 'aktiv' || key === 'inaktiv';
    }),
    [unternehmen]
  );

  // Performance-Berechnung
  const investiert = selectedUnternehmen?.fields.investiertes_kapital ?? 0;
  const aktuell = selectedUnternehmen?.fields.aktueller_wert ?? 0;
  const performanceAbsolut = (investiert > 0 && aktuell > 0) ? aktuell - investiert : null;
  const performanceProzent =
    investiert > 0 && aktuell > 0 ? ((aktuell - investiert) / investiert) * 100 : null;

  async function handleTerminSpeichern() {
    if (!selectedUnternehmenId || !terminbezeichnung || !datumUhrzeit) return;
    setTerminSaving(true);
    setTerminError(null);
    try {
      let tid = createdTerminId;
      if (!tid) {
        const result = await LivingAppsService.createTermineEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          terminbezeichnung,
          terminart: terminart || undefined,
          datum_uhrzeit: datumUhrzeit,
          ort: ort || undefined,
          terminstatus: terminstatus || undefined,
          notizen_termin: notizenTermin || undefined,
        });
        tid = result.record_id;
        setCreatedTerminId(tid);
      }
      setStep(3);
    } catch (e) {
      setTerminError(e instanceof Error ? e.message : 'Fehler beim Speichern des Termins');
    } finally {
      setTerminSaving(false);
    }
  }

  async function handleNotizSpeichern() {
    if (!selectedUnternehmenId || !notizTitel) return;
    setNotizSaving(true);
    setNotizError(null);
    try {
      let nid = createdNotizId;
      if (!nid) {
        const result = await LivingAppsService.createNotizenEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          notiz_titel: notizTitel,
          notiz_inhalt: notizInhalt || undefined,
          notiz_datum: notizDatum,
          kategorie: kategorieKey || undefined,
          prioritaet: prioritaetKey || undefined,
          schlagwoerter: schlagwoerter || undefined,
        });
        nid = result.record_id;
        setCreatedNotizId(nid);
      }
      setStep(4);
    } catch (e) {
      setNotizError(e instanceof Error ? e.message : 'Fehler beim Speichern der Notiz');
    } finally {
      setNotizSaving(false);
    }
  }

  async function handleUpdateSpeichern() {
    if (!selectedUnternehmenId) return;
    setUpdateSaving(true);
    setUpdateError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (aktuellerWert !== '') payload.aktueller_wert = parseFloat(aktuellerWert);
      if (neuerStatus) payload.status = neuerStatus;
      if (cockpitZusammenfassung) payload.cockpit_zusammenfassung = cockpitZusammenfassung;

      if (Object.keys(payload).length > 0) {
        await LivingAppsService.updateUnternehmenEntry(selectedUnternehmenId, payload);
        await fetchAll();
      }
      setUpdateDone(true);
      setFinished(true);
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : 'Fehler beim Aktualisieren');
    } finally {
      setUpdateSaving(false);
    }
  }

  function handleUeberspringen() {
    setUpdateDone(true);
    setFinished(true);
  }

  function handleReset() {
    setSelectedUnternehmenId(null);
    setTerminbezeichnung('Portfolio-Review');
    setTerminart(TERMINART_OPTIONS[0]?.key ?? '');
    setDatumUhrzeit('');
    setOrt('');
    setTerminstatus('stattgefunden');
    setNotizenTermin('');
    setTerminSaving(false);
    setTerminError(null);
    setCreatedTerminId(null);
    setNotizTitel('Review-Ergebnisse');
    setNotizInhalt('');
    setKategorieKey('strategie');
    setPrioritaetKey(PRIORITAET_OPTIONS[0]?.key ?? '');
    setSchlagwoerter('');
    setNotizSaving(false);
    setNotizError(null);
    setCreatedNotizId(null);
    setAktuellerWert('');
    setNeuerStatus('');
    setCockpitZusammenfassung('');
    setUpdateSaving(false);
    setUpdateError(null);
    setUpdateDone(false);
    setFinished(false);
    setStep(1);
  }

  return (
    <IntentWizardShell
      title="Portfolio-Review"
      subtitle="Unternehmen reviewen, Termin dokumentieren, Notiz erfassen und Status aktualisieren"
      steps={[
        { label: 'Unternehmen' },
        { label: 'Termin' },
        { label: 'Notiz' },
        { label: 'Status' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ─── STEP 1: Unternehmen auswählen ─── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Unternehmen auswählen</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Wähle das Unternehmen, für das du den Review durchführst. Nur aktive und inaktive Portfoliounternehmen werden angezeigt.
            </p>
          </div>

          <EntitySelectStep
            items={eligibleUnternehmen.map(u => ({
              id: u.record_id,
              title: u.fields.name ?? u.record_id,
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
                { label: 'Beteiligung', value: formatPercent(u.fields.beteiligungsquote) },
              ],
              icon: <IconBuilding size={20} className="text-primary" />,
            }))}
            onSelect={(id) => {
              setSelectedUnternehmenId(id);
              setStep(2);
            }}
            searchPlaceholder="Nach Name oder Stadt suchen..."
            emptyIcon={<IconBuilding size={32} />}
            emptyText="Keine aktiven oder inaktiven Portfoliounternehmen gefunden."
          />
        </div>
      )}

      {/* ─── STEP 2: Review-Termin anlegen ─── */}
      {step === 2 && (
        selectedUnternehmenId ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Review-Termin anlegen</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Erfasse den Review-Termin für{' '}
                <span className="font-medium text-foreground">
                  {selectedUnternehmen?.fields.name ?? selectedUnternehmenId}
                </span>
              </p>
            </div>

            {/* Kennzahlen-Karten */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border bg-card p-3 space-y-0.5 overflow-hidden">
                <p className="text-xs text-muted-foreground">Investiertes Kapital</p>
                <p className="text-base font-semibold truncate">{formatCurrency(selectedUnternehmen?.fields.investiertes_kapital)}</p>
              </div>
              <div className="rounded-xl border bg-card p-3 space-y-0.5 overflow-hidden">
                <p className="text-xs text-muted-foreground">Aktueller Wert</p>
                <p className="text-base font-semibold truncate">{formatCurrency(selectedUnternehmen?.fields.aktueller_wert)}</p>
              </div>
              <div className="rounded-xl border bg-card p-3 space-y-0.5 overflow-hidden">
                <p className="text-xs text-muted-foreground">Beteiligungsquote</p>
                <p className="text-base font-semibold">{formatPercent(selectedUnternehmen?.fields.beteiligungsquote)}</p>
              </div>
            </div>

            {/* Performance-Indikator */}
            {performanceAbsolut !== null && performanceProzent !== null && (
              <div className={`rounded-xl border p-3 flex items-center gap-3 overflow-hidden ${
                performanceAbsolut >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
              }`}>
                {performanceAbsolut >= 0 ? (
                  <IconTrendingUp size={20} className="text-emerald-600 shrink-0" />
                ) : (
                  <IconTrendingDown size={20} className="text-red-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${performanceAbsolut >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {performanceAbsolut >= 0 ? '+' : ''}{formatCurrency(performanceAbsolut)}
                    {' '}
                    ({performanceProzent >= 0 ? '+' : ''}{performanceProzent.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %)
                  </p>
                  <p className={`text-xs ${performanceAbsolut >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {performanceAbsolut >= 0 ? 'Wertsteigerung' : 'Wertverlust'} gegenüber investiertem Kapital
                  </p>
                </div>
              </div>
            )}

            {/* Termin-Formular */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="terminbezeichnung">
                  Terminbezeichnung <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="terminbezeichnung"
                  value={terminbezeichnung}
                  onChange={e => setTerminbezeichnung(e.target.value)}
                  placeholder="z. B. Portfolio-Review Q3 2026"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="terminart">Terminart</Label>
                  <Select value={terminart} onValueChange={setTerminart}>
                    <SelectTrigger id="terminart">
                      <SelectValue placeholder="Bitte wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMINART_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="datum_uhrzeit">
                    Datum & Uhrzeit <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="datum_uhrzeit"
                    type="datetime-local"
                    value={datumUhrzeit}
                    onChange={e => setDatumUhrzeit(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ort">Ort</Label>
                  <Input
                    id="ort"
                    value={ort}
                    onChange={e => setOrt(e.target.value)}
                    placeholder="z. B. Büro Berlin"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="terminstatus">Status</Label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {TERMINSTATUS_OPTIONS.map(o => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setTerminstatus(o.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          terminstatus === o.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-foreground border-border hover:bg-accent'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notizen_termin">Notizen zum Termin</Label>
                <Textarea
                  id="notizen_termin"
                  value={notizenTermin}
                  onChange={e => setNotizenTermin(e.target.value)}
                  placeholder="Agenda, Besprechungspunkte, Teilnehmer..."
                  rows={3}
                />
              </div>
            </div>

            {terminError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">{terminError}</p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>Zurück</Button>
              <Button
                onClick={handleTerminSpeichern}
                disabled={terminSaving || !terminbezeichnung || !datumUhrzeit}
                className="flex-1"
              >
                {terminSaving ? 'Wird gespeichert...' : 'Termin speichern & weiter'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Kein Unternehmen gewählt. Bitte starte von vorne.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ─── STEP 3: Review-Notiz erfassen ─── */}
      {step === 3 && (
        selectedUnternehmenId ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Review-Notiz erfassen</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Dokumentiere die wichtigsten Erkenntnisse des Reviews für{' '}
                <span className="font-medium text-foreground">
                  {selectedUnternehmen?.fields.name ?? selectedUnternehmenId}
                </span>
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="notiz_titel">
                  Titel <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="notiz_titel"
                  value={notizTitel}
                  onChange={e => setNotizTitel(e.target.value)}
                  placeholder="z. B. Review-Ergebnisse Q3 2026"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notiz_inhalt">Inhalt</Label>
                <Textarea
                  id="notiz_inhalt"
                  value={notizInhalt}
                  onChange={e => setNotizInhalt(e.target.value)}
                  placeholder="Kernpunkte des Reviews, Erkenntnisse, nächste Schritte..."
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Datum</Label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-secondary text-sm text-muted-foreground">
                    <IconCalendar size={14} />
                    {format(new Date(notizDatum), 'dd. MMMM yyyy', { locale: de })}
                    <span className="text-xs ml-auto">(heute)</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kategorie">Kategorie</Label>
                  <Select value={kategorieKey} onValueChange={setKategorieKey}>
                    <SelectTrigger id="kategorie">
                      <SelectValue placeholder="Bitte wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {KATEGORIE_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Priorität</Label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITAET_OPTIONS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setPrioritaetKey(o.key)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        prioritaetKey === o.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:bg-accent'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="schlagwoerter">Schlagwörter</Label>
                <Input
                  id="schlagwoerter"
                  value={schlagwoerter}
                  onChange={e => setSchlagwoerter(e.target.value)}
                  placeholder="z. B. wachstum, risiko, exit-planung"
                />
              </div>
            </div>

            {notizError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">{notizError}</p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>Zurück</Button>
              <Button
                onClick={handleNotizSpeichern}
                disabled={notizSaving || !notizTitel}
                className="flex-1"
              >
                {notizSaving ? 'Wird gespeichert...' : 'Notiz speichern & weiter'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Kein Unternehmen gewählt. Bitte starte von vorne.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ─── STEP 4: Statusaktualisierung ─── */}
      {step === 4 && (
        selectedUnternehmenId ? (
          finished ? (
            /* Abschluss-Zusammenfassung */
            <div className="space-y-6">
              <div className="rounded-2xl border bg-card p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconCheck size={24} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Review abgeschlossen</h2>
                    <p className="text-sm text-muted-foreground">
                      Alle Schritte wurden erfolgreich gespeichert.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-border rounded-xl border overflow-hidden">
                  <div className="flex items-center gap-3 p-4 bg-secondary/40">
                    <IconBuilding size={16} className="text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Unternehmen</p>
                      <p className="text-sm font-medium truncate">
                        {selectedUnternehmen?.fields.name ?? selectedUnternehmenId}
                      </p>
                    </div>
                    {selectedUnternehmen?.fields.status && (
                      <StatusBadge
                        statusKey={selectedUnternehmen.fields.status.key}
                        label={selectedUnternehmen.fields.status.label}
                        className="ml-auto"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-3 p-4">
                    <IconCalendar size={16} className="text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Termin</p>
                      <p className="text-sm font-medium truncate">{terminbezeichnung}</p>
                      {datumUhrzeit && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(datumUhrzeit), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4">
                    <IconNotes size={16} className="text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Notiz</p>
                      <p className="text-sm font-medium truncate">{notizTitel}</p>
                    </div>
                  </div>
                  {updateDone && (
                    <div className="flex items-center gap-3 p-4">
                      <IconChartBar size={16} className="text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Statusaktualisierung</p>
                        <p className="text-sm font-medium">
                          {Object.keys({
                            ...(aktuellerWert !== '' ? { aktueller_wert: aktuellerWert } : {}),
                            ...(neuerStatus ? { status: neuerStatus } : {}),
                            ...(cockpitZusammenfassung ? { zusammenfassung: cockpitZusammenfassung } : {}),
                          }).length > 0
                            ? 'Aktualisiert'
                            : 'Übersprungen'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  <IconRefresh size={16} className="mr-2" />
                  Neuen Review starten
                </Button>
                <a href="#/" className="flex-1">
                  <Button className="w-full">Zurück zum Dashboard</Button>
                </a>
              </div>
            </div>
          ) : (
            /* Status-Formular */
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Statusaktualisierung</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Aktualisiere optional den aktuellen Wert und Status von{' '}
                  <span className="font-medium text-foreground">
                    {selectedUnternehmen?.fields.name ?? selectedUnternehmenId}
                  </span>
                </p>
              </div>

              {/* Aktuelle Kennzahlen (readonly) */}
              <div className="rounded-2xl border bg-secondary/30 p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Aktuelle Werte
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Investiertes Kapital</p>
                    <p className="text-sm font-semibold">{formatCurrency(selectedUnternehmen?.fields.investiertes_kapital)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Aktueller Wert</p>
                    <p className="text-sm font-semibold">{formatCurrency(selectedUnternehmen?.fields.aktueller_wert)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Beteiligungsquote</p>
                    <p className="text-sm font-semibold">{formatPercent(selectedUnternehmen?.fields.beteiligungsquote)}</p>
                  </div>
                </div>

                {performanceAbsolut !== null && performanceProzent !== null && (
                  <div className={`flex items-center gap-2 pt-2 border-t border-border ${
                    performanceAbsolut >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {performanceAbsolut >= 0 ? (
                      <IconTrendingUp size={15} className="shrink-0" />
                    ) : performanceAbsolut === 0 ? (
                      <IconMinus size={15} className="shrink-0" />
                    ) : (
                      <IconTrendingDown size={15} className="shrink-0" />
                    )}
                    <p className="text-xs font-medium">
                      Performance:{' '}
                      {performanceAbsolut >= 0 ? '+' : ''}{formatCurrency(performanceAbsolut)}
                      {' '}({performanceProzent >= 0 ? '+' : ''}{performanceProzent.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %)
                    </p>
                  </div>
                )}
              </div>

              {/* Bearbeitbare Felder */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="aktueller_wert">Aktueller Wert (€) — optional aktualisieren</Label>
                  <Input
                    id="aktueller_wert"
                    type="number"
                    value={aktuellerWert}
                    onChange={e => setAktuellerWert(e.target.value)}
                    placeholder={selectedUnternehmen?.fields.aktueller_wert?.toString() ?? '0'}
                    min={0}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setNeuerStatus('')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        neuerStatus === ''
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:bg-accent'
                      }`}
                    >
                      Unverändert
                    </button>
                    {UNTERNEHMEN_STATUS_OPTIONS.map(o => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setNeuerStatus(o.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          neuerStatus === o.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-foreground border-border hover:bg-accent'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cockpit_zusammenfassung">Cockpit-Zusammenfassung</Label>
                  <Textarea
                    id="cockpit_zusammenfassung"
                    value={cockpitZusammenfassung}
                    onChange={e => setCockpitZusammenfassung(e.target.value)}
                    placeholder="Kurze Zusammenfassung der aktuellen Lage für das Cockpit..."
                    rows={3}
                  />
                </div>
              </div>

              {updateError && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">{updateError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={() => setStep(3)}>Zurück</Button>
                <Button
                  variant="outline"
                  onClick={handleUeberspringen}
                  className="sm:flex-1"
                >
                  Überspringen
                </Button>
                <Button
                  onClick={handleUpdateSpeichern}
                  disabled={updateSaving}
                  className="sm:flex-1"
                >
                  {updateSaving ? 'Wird gespeichert...' : 'Speichern & abschließen'}
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Kein Unternehmen gewählt. Bitte starte von vorne.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
