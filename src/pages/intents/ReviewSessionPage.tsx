/**
 * Review-Session vorbereiten — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen auswählen (nur aktiv/inaktiv, kein Exit)
 *        → 2) Review-Termin anlegen (verknüpft mit Unternehmen)
 *        → 3) Notizen erfassen (verknüpft mit Unternehmen)
 *        → 4) Zusammenfassung & Abschluss.
 * Reads: unternehmen. Writes: termine (createTermineEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  IconBuilding,
  IconCalendarEvent,
  IconNotes,
  IconCheck,
  IconAlertCircle,
  IconMapPin,
  IconBell,
  IconRepeat,
  IconTag,
} from '@tabler/icons-react';

import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Unternehmen } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { formatCurrency, formatDate, lookupKey } from '@/lib/formatters';
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

const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const WIEDERHOLUNG_OPTIONS = LOOKUP_OPTIONS['termine']?.['wiederholung'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

export default function ReviewSessionPage() {
  const { unternehmen, loading, error, fetchAll } = useDashboardData();

  // Step state
  const [step, setStep] = useState(1);

  // Step 1 — selected company
  const [selectedUnternehmenId, setSelectedUnternehmenId] = useState<string | null>(null);

  // Step 2 — Termin fields
  const [terminbezeichnung, setTerminbezeichnung] = useState('Quartalsgespräch');
  const [terminart, setTerminart] = useState('strategiemeeting');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [wiederholung, setWiederholung] = useState('quartalsweise');
  const [erinnerungTage, setErinnerungTage] = useState('7');
  const [terminstatus, setTerminstatus] = useState('geplant');
  const [notizenTermin, setNotizenTermin] = useState('');

  // Step 2 — submission state
  const [terminSubmitting, setTerminSubmitting] = useState(false);
  const [terminError, setTerminError] = useState<string | null>(null);
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);

  // Step 3 — Notizen fields
  const [notizTitel, setNotizTitel] = useState('Review-Notizen [Quartal]');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kategorie, setKategorie] = useState('meeting');
  const [prioritaet, setPrioraet] = useState('mittel');
  const [schlagwoerter, setSchlagwoerter] = useState('');

  // Step 3 — submission state
  const [notizSubmitting, setNotizSubmitting] = useState(false);
  const [notizError, setNotizError] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);

  // Derive selected company object
  const selectedUnternehmen: Unternehmen | undefined = unternehmen.find(
    u => u.record_id === selectedUnternehmenId
  );

  // Filter: exclude exit companies
  const eligibleUnternehmen = unternehmen.filter(
    u => lookupKey(u.fields.status) !== 'exit'
  );

  // Handle step 2 submit — idempotent: only create if not yet created
  async function handleTerminSubmit() {
    if (!selectedUnternehmenId) return;
    if (!terminbezeichnung.trim() || !datumUhrzeit) {
      setTerminError('Bitte Bezeichnung und Datum/Uhrzeit angeben.');
      return;
    }
    setTerminError(null);
    setTerminSubmitting(true);
    try {
      let tid = createdTerminId;
      if (!tid) {
        const result = await LivingAppsService.createTermineEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          terminbezeichnung: terminbezeichnung.trim(),
          terminart,
          datum_uhrzeit: datumUhrzeit,
          ort: ort.trim() || undefined,
          wiederholung,
          erinnerung_tage: parseInt(erinnerungTage, 10) || 7,
          terminstatus,
          notizen_termin: notizenTermin.trim() || undefined,
        });
        tid = result.record_id;
        setCreatedTerminId(tid);
      }
      await fetchAll();
      setStep(3);
    } catch (err) {
      setTerminError(err instanceof Error ? err.message : 'Fehler beim Speichern des Termins.');
    } finally {
      setTerminSubmitting(false);
    }
  }

  // Handle step 3 submit — idempotent
  async function handleNotizSubmit() {
    if (!selectedUnternehmenId) return;
    if (!notizTitel.trim() || !notizInhalt.trim()) {
      setNotizError('Bitte Titel und Inhalt der Notiz angeben.');
      return;
    }
    setNotizError(null);
    setNotizSubmitting(true);
    try {
      let nid = createdNotizId;
      if (!nid) {
        const result = await LivingAppsService.createNotizenEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          notiz_titel: notizTitel.trim(),
          notiz_inhalt: notizInhalt.trim(),
          notiz_datum: notizDatum,
          kategorie,
          prioritaet,
          schlagwoerter: schlagwoerter.trim() || undefined,
        });
        nid = result.record_id;
        setCreatedNotizId(nid);
      }
      await fetchAll();
      setStep(4);
    } catch (err) {
      setNotizError(err instanceof Error ? err.message : 'Fehler beim Speichern der Notiz.');
    } finally {
      setNotizSubmitting(false);
    }
  }

  function handleReset() {
    setStep(1);
    setSelectedUnternehmenId(null);
    setTerminbezeichnung('Quartalsgespräch');
    setTerminart('strategiemeeting');
    setDatumUhrzeit('');
    setOrt('');
    setWiederholung('quartalsweise');
    setErinnerungTage('7');
    setTerminstatus('geplant');
    setNotizenTermin('');
    setTerminError(null);
    setCreatedTerminId(null);
    setNotizTitel('Review-Notizen [Quartal]');
    setNotizInhalt('');
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    setKategorie('meeting');
    setPrioraet('mittel');
    setSchlagwoerter('');
    setNotizError(null);
    setCreatedNotizId(null);
  }

  return (
    <IntentWizardShell
      title="Review-Session vorbereiten"
      subtitle="Unternehmen auswählen, Termin anlegen und Notizen erfassen."
      steps={[
        { label: 'Unternehmen' },
        { label: 'Termin' },
        { label: 'Notizen' },
        { label: 'Fertig' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ------------------------------------------------------------------ */}
      {/* STEP 1 — Unternehmen auswählen                                       */}
      {/* ------------------------------------------------------------------ */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Portfoliounternehmen auswählen</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Alle aktiven und inaktiven Unternehmen — Exit-Unternehmen werden nicht angezeigt.
            </p>
          </div>
          <EntitySelectStep
            items={eligibleUnternehmen.map(u => ({
              id: u.record_id,
              title: u.fields.name ?? '(Kein Name)',
              subtitle: [
                u.fields.branche?.label,
                u.fields.stadt,
              ].filter(Boolean).join(' · '),
              status: u.fields.status
                ? { key: u.fields.status.key, label: u.fields.status.label }
                : undefined,
              stats: [
                {
                  label: 'Investiert',
                  value: formatCurrency(u.fields.investiertes_kapital),
                },
                {
                  label: 'Aktueller Wert',
                  value: formatCurrency(u.fields.aktueller_wert),
                },
              ],
              icon: <IconBuilding size={20} className="text-primary" />,
            }))}
            onSelect={(id) => {
              setSelectedUnternehmenId(id);
              setStep(2);
            }}
            searchPlaceholder="Unternehmen suchen..."
            emptyText="Keine aktiven oder inaktiven Unternehmen gefunden."
            emptyIcon={<IconBuilding size={32} />}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* STEP 2 — Review-Termin anlegen                                       */}
      {/* ------------------------------------------------------------------ */}
      {step === 2 && (
        selectedUnternehmenId && selectedUnternehmen ? (
          <div className="space-y-5">
            {/* Context card */}
            <CompanyContextCard unternehmen={selectedUnternehmen} />

            <div>
              <h2 className="text-lg font-semibold">Review-Termin anlegen</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Der Termin wird automatisch mit dem gewählten Unternehmen verknüpft.
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              {/* Terminbezeichnung */}
              <div className="space-y-1.5">
                <Label htmlFor="terminbezeichnung">
                  Bezeichnung <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="terminbezeichnung"
                  value={terminbezeichnung}
                  onChange={e => setTerminbezeichnung(e.target.value)}
                  placeholder="z. B. Quartalsgespräch"
                />
              </div>

              {/* Terminart */}
              <div className="space-y-1.5">
                <Label htmlFor="terminart">
                  Terminart <span className="text-destructive">*</span>
                </Label>
                <Select value={terminart} onValueChange={setTerminart}>
                  <SelectTrigger id="terminart">
                    <SelectValue placeholder="Terminart wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {TERMINART_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Datum & Uhrzeit */}
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

              {/* Ort */}
              <div className="space-y-1.5">
                <Label htmlFor="ort" className="flex items-center gap-1.5">
                  <IconMapPin size={14} />
                  Ort
                </Label>
                <Input
                  id="ort"
                  value={ort}
                  onChange={e => setOrt(e.target.value)}
                  placeholder="z. B. Büro Berlin, Videokonferenz"
                />
              </div>

              {/* Wiederholung + Erinnerung in einer Reihe */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="wiederholung" className="flex items-center gap-1.5">
                    <IconRepeat size={14} />
                    Wiederholung
                  </Label>
                  <Select value={wiederholung} onValueChange={setWiederholung}>
                    <SelectTrigger id="wiederholung">
                      <SelectValue placeholder="Auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {WIEDERHOLUNG_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="erinnerung_tage" className="flex items-center gap-1.5">
                    <IconBell size={14} />
                    Erinnerung (Tage vorher)
                  </Label>
                  <Input
                    id="erinnerung_tage"
                    type="number"
                    min="0"
                    value={erinnerungTage}
                    onChange={e => setErinnerungTage(e.target.value)}
                    placeholder="7"
                  />
                </div>
              </div>

              {/* Terminstatus */}
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2">
                  {TERMINSTATUS_OPTIONS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setTerminstatus(o.key)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        terminstatus === o.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notizen zum Termin */}
              <div className="space-y-1.5">
                <Label htmlFor="notizen_termin">Notizen zum Termin</Label>
                <Textarea
                  id="notizen_termin"
                  value={notizenTermin}
                  onChange={e => setNotizenTermin(e.target.value)}
                  placeholder="Agendapunkte, Vorbereitungshinweise..."
                  rows={3}
                />
              </div>

              {/* Error */}
              {terminError && (
                <div className="flex items-center gap-2 text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
                  <IconAlertCircle size={16} />
                  {terminError}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="sm:w-auto w-full"
              >
                Zurück
              </Button>
              <Button
                onClick={handleTerminSubmit}
                disabled={terminSubmitting || !terminbezeichnung.trim() || !datumUhrzeit}
                className="sm:flex-1 w-full"
              >
                {terminSubmitting ? 'Wird gespeichert...' : 'Termin anlegen & weiter'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt benötigt ein ausgewähltes Unternehmen aus Schritt 1.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ------------------------------------------------------------------ */}
      {/* STEP 3 — Notizen erfassen                                            */}
      {/* ------------------------------------------------------------------ */}
      {step === 3 && (
        selectedUnternehmenId && selectedUnternehmen ? (
          <div className="space-y-5">
            {/* Context card */}
            <CompanyContextCard unternehmen={selectedUnternehmen} />

            <div>
              <h2 className="text-lg font-semibold">Notizen zur Review-Session</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Erfasse die wichtigsten Erkenntnisse und Beschlüsse der Session.
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              {/* Titel */}
              <div className="space-y-1.5">
                <Label htmlFor="notiz_titel">
                  Titel <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="notiz_titel"
                  value={notizTitel}
                  onChange={e => setNotizTitel(e.target.value)}
                  placeholder="z. B. Review-Notizen Q3 2026"
                />
              </div>

              {/* Inhalt */}
              <div className="space-y-1.5">
                <Label htmlFor="notiz_inhalt">
                  Inhalt <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="notiz_inhalt"
                  value={notizInhalt}
                  onChange={e => setNotizInhalt(e.target.value)}
                  placeholder="Erkenntnisse, Entscheidungen, nächste Schritte..."
                  rows={6}
                />
              </div>

              {/* Datum */}
              <div className="space-y-1.5">
                <Label htmlFor="notiz_datum">
                  Datum <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="notiz_datum"
                  type="date"
                  value={notizDatum}
                  onChange={e => setNotizDatum(e.target.value)}
                />
              </div>

              {/* Kategorie */}
              <div className="space-y-1.5">
                <Label htmlFor="kategorie">Kategorie</Label>
                <Select value={kategorie} onValueChange={setKategorie}>
                  <SelectTrigger id="kategorie">
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {KATEGORIE_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priorität */}
              <div className="space-y-2">
                <Label>Priorität</Label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITAET_OPTIONS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setPrioraet(o.key)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        prioritaet === o.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schlagwörter */}
              <div className="space-y-1.5">
                <Label htmlFor="schlagwoerter" className="flex items-center gap-1.5">
                  <IconTag size={14} />
                  Schlagwörter
                </Label>
                <Input
                  id="schlagwoerter"
                  value={schlagwoerter}
                  onChange={e => setSchlagwoerter(e.target.value)}
                  placeholder="z. B. Wachstum, Risiko, Q3"
                />
              </div>

              {/* Error */}
              {notizError && (
                <div className="flex items-center gap-2 text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
                  <IconAlertCircle size={16} />
                  {notizError}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="sm:w-auto w-full"
              >
                Zurück
              </Button>
              <Button
                onClick={handleNotizSubmit}
                disabled={notizSubmitting || !notizTitel.trim() || !notizInhalt.trim()}
                className="sm:flex-1 w-full"
              >
                {notizSubmitting ? 'Wird gespeichert...' : 'Notiz speichern & abschließen'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt benötigt ein ausgewähltes Unternehmen aus Schritt 1.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ------------------------------------------------------------------ */}
      {/* STEP 4 — Zusammenfassung                                             */}
      {/* ------------------------------------------------------------------ */}
      {step === 4 && (
        selectedUnternehmen ? (
          <div className="space-y-6">
            {/* Success header */}
            <div className="flex flex-col items-center text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <IconCheck size={28} className="text-primary" stroke={2.5} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Review-Session vorbereitet!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Termin und Notizen wurden erfolgreich angelegt.
                </p>
              </div>
            </div>

            {/* Summary cards */}
            <div className="space-y-3">
              {/* Company */}
              <div className="rounded-2xl border bg-card p-4 flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconBuilding size={20} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Unternehmen</p>
                  <p className="font-semibold truncate">{selectedUnternehmen.fields.name ?? '—'}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    {selectedUnternehmen.fields.branche && (
                      <span className="text-xs text-muted-foreground">
                        {selectedUnternehmen.fields.branche.label}
                      </span>
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

              {/* Termin */}
              <div className="rounded-2xl border bg-card p-4 flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconCalendarEvent size={20} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Termin</p>
                  <p className="font-semibold truncate">{terminbezeichnung}</p>
                  <p className="text-xs text-muted-foreground">
                    {datumUhrzeit
                      ? format(new Date(datumUhrzeit), "dd.MM.yyyy, HH:mm 'Uhr'", { locale: de })
                      : '—'}
                    {' · '}
                    {TERMINART_OPTIONS.find(o => o.key === terminart)?.label ?? terminart}
                  </p>
                </div>
              </div>

              {/* Notiz */}
              <div className="rounded-2xl border bg-card p-4 flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconNotes size={20} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Notiz</p>
                  <p className="font-semibold truncate">{notizTitel}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(notizDatum)}
                    {' · '}
                    {KATEGORIE_OPTIONS.find(o => o.key === kategorie)?.label ?? kategorie}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleReset}
                className="sm:flex-1 w-full"
              >
                Neue Review-Session anlegen
              </Button>
              <a href="#/" className="sm:flex-1 w-full">
                <Button className="w-full">Zurück zum Dashboard</Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Kein Unternehmen ausgewählt. Bitte von vorne beginnen.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}

// ---- Internal presentational sub-component ----

function CompanyContextCard({ unternehmen }: { unternehmen: Unternehmen }) {
  return (
    <div className="rounded-2xl border bg-secondary/40 p-4 flex items-center gap-3 overflow-hidden">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <IconBuilding size={20} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm truncate">{unternehmen.fields.name ?? '—'}</p>
          {unternehmen.fields.status && (
            <StatusBadge
              statusKey={unternehmen.fields.status.key}
              label={unternehmen.fields.status.label}
            />
          )}
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground flex-wrap mt-0.5">
          {unternehmen.fields.branche && (
            <span>{unternehmen.fields.branche.label}</span>
          )}
          {unternehmen.fields.aktueller_wert != null && (
            <span>Wert: {formatCurrency(unternehmen.fields.aktueller_wert)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
