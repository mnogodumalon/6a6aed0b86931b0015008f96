/**
 * Unternehmens-Review — 4-Schritt-Wizard für periodisches Portfolio-Review.
 * Steps: 1) Unternehmen auswählen (nur aktive) → 2) Review-Notiz erfassen →
 *         3) Folgetermin planen (optional) → 4) Abschluss & Zusammenfassung.
 * Reads: unternehmen. Writes: notizen (createNotizenEntry), termine (createTermineEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconBuilding,
  IconNotes,
  IconCalendarPlus,
  IconCircleCheck,
  IconChevronRight,
  IconArrowLeft,
} from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
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

const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];
const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const WIEDERHOLUNG_OPTIONS = LOOKUP_OPTIONS['termine']?.['wiederholung'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];

export default function UnternehmensReviewPage() {
  const { unternehmen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);

  // Schritt 1
  const [selectedUnternehmen, setSelectedUnternehmen] = useState<Unternehmen | null>(null);

  // Schritt 2 — Notiz-Felder
  const [notizTitel, setNotizTitel] = useState('');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kategorie, setKategorie] = useState('strategie');
  const [prioritaet, setPrioritaet] = useState('mittel');
  const [schlagwoerter, setSchlagwoerter] = useState('');

  // Schritt 3 — Termin-Felder
  const [terminBezeichnung, setTerminBezeichnung] = useState('');
  const [terminArt, setTerminArt] = useState('strategiemeeting');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [wiederholung, setWiederholung] = useState('quartalsweise');
  const [terminStatus, setTerminStatus] = useState('geplant');
  const [notizenTermin, setNotizenTermin] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);

  const activeUnternehmen = Object.values(unternehmen ?? {}).filter(
    (u) => u.fields.status?.key === 'aktiv'
  );

  const handleUnternehmenSelect = (id: string) => {
    const found = Object.values(unternehmen ?? {}).find((u) => u.record_id === id) ?? null;
    setSelectedUnternehmen(found);
    setStep(2);
  };

  const handleNotizSubmit = async () => {
    if (!selectedUnternehmen) return;
    if (!notizTitel.trim() || !notizInhalt.trim() || !notizDatum) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      let nid = createdNotizId;
      if (!nid) {
        const result = await LivingAppsService.createNotizenEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmen.record_id),
          notiz_titel: notizTitel,
          notiz_inhalt: notizInhalt,
          notiz_datum: notizDatum,
          kategorie,
          prioritaet,
          schlagwoerter: schlagwoerter.trim() || undefined,
        });
        nid = result.record_id;
        setCreatedNotizId(nid);
      }
      await fetchAll();
      setStep(3);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Speichern der Notiz.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTerminSubmit = async () => {
    if (!selectedUnternehmen) return;
    if (!terminBezeichnung.trim() || !datumUhrzeit) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      let tid = createdTerminId;
      if (!tid) {
        const result = await LivingAppsService.createTermineEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmen.record_id),
          terminbezeichnung: terminBezeichnung,
          terminart: terminArt,
          datum_uhrzeit: datumUhrzeit,
          ort: ort.trim() || undefined,
          wiederholung,
          terminstatus: terminStatus,
          notizen_termin: notizenTermin.trim() || undefined,
        });
        tid = result.record_id;
        setCreatedTerminId(tid);
      }
      await fetchAll();
      setStep(4);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Speichern des Termins.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipTermin = () => {
    setStep(4);
  };

  const handleReset = () => {
    setSelectedUnternehmen(null);
    setNotizTitel('');
    setNotizInhalt('');
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    setKategorie('strategie');
    setPrioritaet('mittel');
    setSchlagwoerter('');
    setTerminBezeichnung('');
    setTerminArt('strategiemeeting');
    setDatumUhrzeit('');
    setOrt('');
    setWiederholung('quartalsweise');
    setTerminStatus('geplant');
    setNotizenTermin('');
    setSubmitError(null);
    setCreatedNotizId(null);
    setCreatedTerminId(null);
    setStep(1);
  };

  const notizValid = notizTitel.trim().length > 0 && notizInhalt.trim().length > 0 && notizDatum.length > 0;
  const terminValid = terminBezeichnung.trim().length > 0 && datumUhrzeit.length > 0;

  return (
    <IntentWizardShell
      title="Unternehmens-Review"
      subtitle="Notiz erfassen und Folgetermin planen"
      steps={[
        { label: 'Unternehmen' },
        { label: 'Review-Notiz' },
        { label: 'Folgetermin' },
        { label: 'Abschluss' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Schritt 1: Unternehmen auswählen */}
      {step === 1 && (
        <EntitySelectStep
          items={activeUnternehmen.map((u) => ({
            id: u.record_id,
            title: u.fields.name ?? '(Kein Name)',
            subtitle: [u.fields.branche?.label, u.fields.stadt].filter(Boolean).join(' · '),
            stats: u.fields.investiertes_kapital
              ? [
                  {
                    label: 'Investiert',
                    value: new Intl.NumberFormat('de-DE', {
                      style: 'currency',
                      currency: 'EUR',
                      maximumFractionDigits: 0,
                    }).format(u.fields.investiertes_kapital),
                  },
                ]
              : [],
            icon: <IconBuilding size={20} className="text-primary" />,
            status: u.fields.status
              ? { key: u.fields.status.key, label: u.fields.status.label }
              : undefined,
          }))}
          onSelect={handleUnternehmenSelect}
          searchPlaceholder="Unternehmen suchen …"
          emptyText="Keine aktiven Unternehmen gefunden"
          emptyIcon={<IconBuilding size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Schritt 2: Review-Notiz erfassen */}
      {step === 2 && (
        <div className="space-y-5">
          {selectedUnternehmen ? (
            <>
              {/* Kontext-Banner */}
              <div className="rounded-2xl border bg-secondary p-4 flex items-center gap-3">
                <IconNotes size={20} className="text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{selectedUnternehmen.fields.name}</p>
                  {selectedUnternehmen.fields.branche && (
                    <p className="text-sm text-muted-foreground">
                      {selectedUnternehmen.fields.branche.label}
                    </p>
                  )}
                </div>
              </div>

              {/* Formular */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h2 className="font-semibold text-base">Review-Notiz erfassen</h2>

                <div className="space-y-2">
                  <Label htmlFor="notiz-titel">Titel *</Label>
                  <Input
                    id="notiz-titel"
                    value={notizTitel}
                    onChange={(e) => setNotizTitel(e.target.value)}
                    placeholder="z. B. Q3-Review 2026"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notiz-inhalt">Inhalt *</Label>
                  <Textarea
                    id="notiz-inhalt"
                    value={notizInhalt}
                    onChange={(e) => setNotizInhalt(e.target.value)}
                    placeholder="Erkenntnisse, Beobachtungen, Empfehlungen …"
                    rows={5}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="notiz-datum">Datum *</Label>
                    <Input
                      id="notiz-datum"
                      type="date"
                      value={notizDatum}
                      onChange={(e) => setNotizDatum(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notiz-kategorie">Kategorie</Label>
                    <Select value={kategorie} onValueChange={setKategorie}>
                      <SelectTrigger id="notiz-kategorie">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KATEGORIE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.key} value={opt.key}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Priorität</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRIORITAET_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setPrioritaet(opt.key)}
                        className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                          prioritaet === opt.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-foreground border-border hover:bg-secondary'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notiz-schlagwoerter">Schlagwörter</Label>
                  <Input
                    id="notiz-schlagwoerter"
                    value={schlagwoerter}
                    onChange={(e) => setSchlagwoerter(e.target.value)}
                    placeholder="z. B. Wachstum, Risiko, Partner"
                  />
                </div>

                {submitError && (
                  <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
                    {submitError}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-2"
                  >
                    <IconArrowLeft size={16} />
                    Zurück
                  </Button>
                  <Button
                    onClick={handleNotizSubmit}
                    disabled={!notizValid || submitting}
                    className="flex items-center gap-2 flex-1 sm:flex-none"
                  >
                    {submitting ? 'Speichern …' : 'Notiz speichern & weiter'}
                    <IconChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                Dieser Schritt braucht die Auswahl aus Schritt 1.
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>
                Neu starten
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Schritt 3: Folgetermin planen */}
      {step === 3 && (
        <div className="space-y-5">
          {selectedUnternehmen ? (
            <>
              {/* Kontext-Banner */}
              <div className="rounded-2xl border bg-secondary p-4 flex items-center gap-3">
                <IconCalendarPlus size={20} className="text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{selectedUnternehmen.fields.name}</p>
                  <p className="text-sm text-muted-foreground">Folgetermin (optional)</p>
                </div>
              </div>

              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h2 className="font-semibold text-base">Folgetermin planen</h2>

                <div className="space-y-2">
                  <Label htmlFor="termin-bezeichnung">Bezeichnung *</Label>
                  <Input
                    id="termin-bezeichnung"
                    value={terminBezeichnung}
                    onChange={(e) => setTerminBezeichnung(e.target.value)}
                    placeholder="z. B. Q4-Review-Meeting"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="termin-art">Terminart</Label>
                    <Select value={terminArt} onValueChange={setTerminArt}>
                      <SelectTrigger id="termin-art">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TERMINART_OPTIONS.map((opt) => (
                          <SelectItem key={opt.key} value={opt.key}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="termin-datum">Datum & Uhrzeit *</Label>
                    <Input
                      id="termin-datum"
                      type="datetime-local"
                      value={datumUhrzeit}
                      onChange={(e) => setDatumUhrzeit(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="termin-ort">Ort</Label>
                    <Input
                      id="termin-ort"
                      value={ort}
                      onChange={(e) => setOrt(e.target.value)}
                      placeholder="z. B. Berlin, Videokonferenz"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="termin-wiederholung">Wiederholung</Label>
                    <Select value={wiederholung} onValueChange={setWiederholung}>
                      <SelectTrigger id="termin-wiederholung">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WIEDERHOLUNG_OPTIONS.map((opt) => (
                          <SelectItem key={opt.key} value={opt.key}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {TERMINSTATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setTerminStatus(opt.key)}
                        className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                          terminStatus === opt.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-foreground border-border hover:bg-secondary'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="termin-notizen">Notizen zum Termin</Label>
                  <Textarea
                    id="termin-notizen"
                    value={notizenTermin}
                    onChange={(e) => setNotizenTermin(e.target.value)}
                    placeholder="Agenda, Vorbereitung, Teilnehmer …"
                    rows={3}
                  />
                </div>

                {submitError && (
                  <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
                    {submitError}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="flex items-center gap-2"
                  >
                    <IconArrowLeft size={16} />
                    Zurück
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSkipTermin}
                    className="flex-1 sm:flex-none"
                  >
                    Überspringen
                  </Button>
                  <Button
                    onClick={handleTerminSubmit}
                    disabled={!terminValid || submitting}
                    className="flex items-center gap-2 flex-1 sm:flex-none"
                  >
                    {submitting ? 'Speichern …' : 'Termin speichern & weiter'}
                    <IconChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                Dieser Schritt braucht die Auswahl aus Schritt 1.
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>
                Neu starten
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Schritt 4: Abschluss */}
      {step === 4 && (
        <div className="space-y-5">
          {selectedUnternehmen ? (
            <>
              <div className="rounded-2xl border bg-card p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <IconCircleCheck size={28} className="text-primary shrink-0" />
                  <div>
                    <h2 className="font-semibold text-lg">Review abgeschlossen</h2>
                    <p className="text-sm text-muted-foreground">
                      Das Review für {selectedUnternehmen.fields.name} wurde gespeichert.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-border rounded-xl border overflow-hidden">
                  {/* Unternehmen */}
                  <div className="flex items-start gap-3 p-4 bg-secondary/30">
                    <IconBuilding size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                        Unternehmen
                      </p>
                      <p className="font-medium truncate">{selectedUnternehmen.fields.name}</p>
                      {selectedUnternehmen.fields.branche && (
                        <p className="text-sm text-muted-foreground">
                          {selectedUnternehmen.fields.branche.label}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Notiz */}
                  {createdNotizId && (
                    <div className="flex items-start gap-3 p-4">
                      <IconNotes size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                          Review-Notiz
                        </p>
                        <p className="font-medium truncate">{notizTitel || '(Notiz erstellt)'}</p>
                        <p className="text-sm text-muted-foreground">
                          {KATEGORIE_OPTIONS.find((o) => o.key === kategorie)?.label ?? kategorie}
                          {' · '}
                          {PRIORITAET_OPTIONS.find((o) => o.key === prioritaet)?.label ?? prioritaet}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Termin */}
                  {createdTerminId ? (
                    <div className="flex items-start gap-3 p-4">
                      <IconCalendarPlus
                        size={18}
                        className="text-muted-foreground shrink-0 mt-0.5"
                      />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                          Folgetermin
                        </p>
                        <p className="font-medium truncate">{terminBezeichnung}</p>
                        <p className="text-sm text-muted-foreground">
                          {TERMINART_OPTIONS.find((o) => o.key === terminArt)?.label ?? terminArt}
                          {datumUhrzeit ? ` · ${datumUhrzeit.replace('T', ', ')}` : ''}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-4">
                      <IconCalendarPlus
                        size={18}
                        className="text-muted-foreground shrink-0 mt-0.5"
                      />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                          Folgetermin
                        </p>
                        <p className="text-sm text-muted-foreground">Kein Folgetermin geplant</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button onClick={handleReset} variant="outline" className="flex-1 sm:flex-none">
                    Weiteres Unternehmen reviewen
                  </Button>
                  <a href="#/" className="flex-1 sm:flex-none">
                    <Button className="w-full">Zurück zum Dashboard</Button>
                  </a>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                Dieser Schritt braucht die Auswahl aus Schritt 1.
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>
                Neu starten
              </Button>
            </div>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
