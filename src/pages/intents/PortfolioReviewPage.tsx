/**
 * Portfolio-Review — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen wählen → 2) Review-Termin anlegen → 3) Review-Notiz erfassen → 4) Protokoll hinterlegen & Abschluss.
 * Reads: unternehmen. Writes: termine (createTermineEntry), notizen (createNotizenEntry), dokumente (createDokumenteEntry).
 * Composes: IntentWizardShell, EntitySelectStep, BudgetTracker.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconBuildingFactory2,
  IconCalendarEvent,
  IconNotes,
  IconFileText,
  IconCheck,
  IconCurrencyEuro,
  IconTrendingUp,
} from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { BudgetTracker } from '@/components/blocks/BudgetTracker';
import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Unternehmen } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
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
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];

const TODAY = format(new Date(), 'yyyy-MM-dd');

export default function PortfolioReviewPage() {
  const { unternehmen, loading, error, fetchAll } = useDashboardData();

  // Step management
  const [step, setStep] = useState(1);

  // Step 1 — Unternehmen
  const [selectedUnternehmen, setSelectedUnternehmen] = useState<Unternehmen | null>(null);

  // Step 2 — Termin
  const [terminbezeichnung, setTerminbezeichnung] = useState('');
  const [terminart, setTerminart] = useState('strategiemeeting');
  const [datum_uhrzeit, setDatum_uhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [wiederholungKey, setWiederholungKey] = useState('quartalsweise');
  const [terminstatusKey, setTerminstatusKey] = useState('geplant');
  const [terminSaving, setTerminSaving] = useState(false);
  const [terminError, setTerminError] = useState<string | null>(null);
  const [terminId, setTerminId] = useState<string | null>(null);

  // Step 3 — Notiz
  const [notiz_titel, setNotiz_titel] = useState('');
  const [notiz_inhalt, setNotiz_inhalt] = useState('');
  const [notiz_datum, setNotiz_datum] = useState(TODAY);
  const [kategorieKey, setKategorieKey] = useState('strategie');
  const [prioritaetKey, setPrioritaetKey] = useState('hoch');
  const [notizSaving, setNotizSaving] = useState(false);
  const [notizError, setNotizError] = useState<string | null>(null);
  const [notizId, setNotizId] = useState<string | null>(null);

  // Step 4 — Dokument
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententypKey, setDokumententypKey] = useState('protokoll');
  const [dokumentendatum, setDokumentendatum] = useState(TODAY);
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [bereitgestellt_von, setBereitgestellt_von] = useState('');
  const [dokSaving, setDokSaving] = useState(false);
  const [dokError, setDokError] = useState<string | null>(null);
  const [dokId, setDokId] = useState<string | null>(null);

  // Pre-fill labels when Unternehmen is selected
  const handleSelectUnternehmen = (id: string) => {
    const u = unternehmen.find((u) => u.record_id === id) ?? null;
    setSelectedUnternehmen(u);
    const name = u?.fields.name ?? '';
    setTerminbezeichnung(`Portfolio-Review ${name}`);
    setNotiz_titel(`Portfolio-Review ${name}`);
    setDokumentenbezeichnung(`Review-Protokoll ${name}`);
    setStep(2);
  };

  // Step 2 submit
  const handleTerminSave = async () => {
    if (!selectedUnternehmen || terminSaving) return;
    let tid = terminId;
    if (!tid) {
      setTerminSaving(true);
      setTerminError(null);
      try {
        const res = await LivingAppsService.createTermineEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmen.record_id),
          terminbezeichnung,
          terminart,
          datum_uhrzeit,
          ort: ort || undefined,
          wiederholung: wiederholungKey,
          terminstatus: terminstatusKey,
        });
        tid = res.record_id;
        setTerminId(tid);
        await fetchAll();
        setStep(3);
      } catch (e: unknown) {
        setTerminError(e instanceof Error ? e.message : 'Fehler beim Speichern des Termins.');
      } finally {
        setTerminSaving(false);
      }
    } else {
      setStep(3);
    }
  };

  // Step 3 submit
  const handleNotizSave = async () => {
    if (!selectedUnternehmen || notizSaving) return;
    let nid = notizId;
    if (!nid) {
      setNotizSaving(true);
      setNotizError(null);
      try {
        const res = await LivingAppsService.createNotizenEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmen.record_id),
          notiz_titel,
          notiz_inhalt,
          notiz_datum,
          kategorie: kategorieKey,
          prioritaet: prioritaetKey,
        });
        nid = res.record_id;
        setNotizId(nid);
        await fetchAll();
        setStep(4);
      } catch (e: unknown) {
        setNotizError(e instanceof Error ? e.message : 'Fehler beim Speichern der Notiz.');
      } finally {
        setNotizSaving(false);
      }
    } else {
      setStep(4);
    }
  };

  // Step 4 submit
  const handleDokSave = async () => {
    if (!selectedUnternehmen || dokSaving) return;
    let did = dokId;
    if (!did) {
      setDokSaving(true);
      setDokError(null);
      try {
        const res = await LivingAppsService.createDokumenteEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmen.record_id),
          dokumentenbezeichnung,
          dokumententyp: dokumententypKey,
          dokumentendatum,
          dokumentenlink: dokumentenlink || undefined,
          bereitgestellt_von: bereitgestellt_von || undefined,
        });
        did = res.record_id;
        setDokId(did);
        await fetchAll();
      } catch (e: unknown) {
        setDokError(e instanceof Error ? e.message : 'Fehler beim Speichern des Dokuments.');
      } finally {
        setDokSaving(false);
      }
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedUnternehmen(null);
    setTerminbezeichnung('');
    setTerminart('strategiemeeting');
    setDatum_uhrzeit('');
    setOrt('');
    setWiederholungKey('quartalsweise');
    setTerminstatusKey('geplant');
    setTerminSaving(false);
    setTerminError(null);
    setTerminId(null);
    setNotiz_titel('');
    setNotiz_inhalt('');
    setNotiz_datum(TODAY);
    setKategorieKey('strategie');
    setPrioritaetKey('hoch');
    setNotizSaving(false);
    setNotizError(null);
    setNotizId(null);
    setDokumentenbezeichnung('');
    setDokumententypKey('protokoll');
    setDokumentendatum(TODAY);
    setDokumentenlink('');
    setBereitgestellt_von('');
    setDokSaving(false);
    setDokError(null);
    setDokId(null);
  };

  // Active unternehmen only for step 1
  const aktiveUnternehmen = unternehmen.filter(
    (u) => u.fields.status?.key === 'aktiv'
  );

  // Kennzahlen-Panel for selected company (shown from step 2 onwards)
  const KennzahlenPanel = () => {
    if (!selectedUnternehmen) return null;
    const inv = selectedUnternehmen.fields.investiertes_kapital ?? 0;
    const aktuell = selectedUnternehmen.fields.aktueller_wert ?? 0;
    const rendite = inv > 0 ? (((aktuell - inv) / inv) * 100).toFixed(1) : null;
    return (
      <div className="rounded-2xl border bg-card p-4 mb-4 space-y-3 overflow-hidden">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <IconBuildingFactory2 size={16} className="text-primary" />
          <span className="truncate">{selectedUnternehmen.fields.name}</span>
          {selectedUnternehmen.fields.branche && (
            <span className="text-xs text-muted-foreground truncate">
              · {selectedUnternehmen.fields.branche.label}
            </span>
          )}
        </div>
        {inv > 0 ? (
          <BudgetTracker
            budget={aktuell}
            booked={inv}
            label="Investiert vs. aktueller Wert"
            showRemaining={false}
          />
        ) : null}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <IconCurrencyEuro size={14} />
            <span>
              Investiert:{' '}
              <strong className="text-foreground">
                {inv > 0 ? inv.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '–'}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <IconTrendingUp size={14} />
            <span>
              Aktuell:{' '}
              <strong className="text-foreground">
                {aktuell > 0
                  ? aktuell.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
                  : '–'}
              </strong>
            </span>
          </div>
          {rendite !== null && (
            <div className="text-muted-foreground">
              Rendite:{' '}
              <strong className={parseFloat(rendite) >= 0 ? 'text-green-600' : 'text-red-500'}>
                {rendite} %
              </strong>
            </div>
          )}
        </div>
      </div>
    );
  };

  const missingPrereqFallback = (
    <div className="text-center py-12 space-y-3">
      <p className="text-sm text-muted-foreground">
        Dieser Schritt benötigt ein ausgewähltes Unternehmen aus Schritt 1.
      </p>
      <Button variant="outline" onClick={() => setStep(1)}>
        Neu starten
      </Button>
    </div>
  );

  return (
    <IntentWizardShell
      title="Portfolio-Review"
      subtitle="Strukturierter Review für ein Portfoliounternehmen"
      steps={[
        { label: 'Unternehmen' },
        { label: 'Termin' },
        { label: 'Notiz' },
        { label: 'Protokoll' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Unternehmen wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={aktiveUnternehmen.map((u) => ({
            id: u.record_id,
            title: u.fields.name ?? '(kein Name)',
            subtitle: [u.fields.branche?.label, u.fields.stadt].filter(Boolean).join(' · '),
            status: u.fields.status
              ? { key: u.fields.status.key, label: u.fields.status.label }
              : undefined,
            stats: [
              {
                label: 'Investiert',
                value:
                  u.fields.investiertes_kapital != null
                    ? u.fields.investiertes_kapital.toLocaleString('de-DE', {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      })
                    : '–',
              },
              {
                label: 'Aktueller Wert',
                value:
                  u.fields.aktueller_wert != null
                    ? u.fields.aktueller_wert.toLocaleString('de-DE', {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      })
                    : '–',
              },
            ],
            icon: <IconBuildingFactory2 size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectUnternehmen}
          searchPlaceholder="Nach Name oder Stadt suchen …"
          emptyText="Keine aktiven Unternehmen gefunden."
          emptyIcon={<IconBuildingFactory2 size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Review-Termin anlegen */}
      {step === 2 &&
        (selectedUnternehmen ? (
          <div className="space-y-4">
            <KennzahlenPanel />
            <div className="rounded-2xl border bg-card p-4 space-y-4 overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                <IconCalendarEvent size={18} className="text-primary" />
                <h3 className="font-semibold text-foreground">Review-Termin anlegen</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="terminbezeichnung">Terminbezeichnung *</Label>
                <Input
                  id="terminbezeichnung"
                  value={terminbezeichnung}
                  onChange={(e) => setTerminbezeichnung(e.target.value)}
                  placeholder="Portfolio-Review …"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="terminart">Terminart *</Label>
                  <Select value={terminart} onValueChange={setTerminart}>
                    <SelectTrigger id="terminart">
                      <SelectValue placeholder="Terminart wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMINART_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="datum_uhrzeit">Datum & Uhrzeit *</Label>
                  <Input
                    id="datum_uhrzeit"
                    type="datetime-local"
                    value={datum_uhrzeit}
                    onChange={(e) => setDatum_uhrzeit(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ort">Ort</Label>
                  <Input
                    id="ort"
                    value={ort}
                    onChange={(e) => setOrt(e.target.value)}
                    placeholder="z. B. Büro Berlin"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wiederholung">Wiederholung</Label>
                  <Select value={wiederholungKey} onValueChange={setWiederholungKey}>
                    <SelectTrigger id="wiederholung">
                      <SelectValue placeholder="Wiederholung wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {WIEDERHOLUNG_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terminstatus">Status</Label>
                  <Select value={terminstatusKey} onValueChange={setTerminstatusKey}>
                    <SelectTrigger id="terminstatus">
                      <SelectValue placeholder="Status wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMINSTATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {terminError && (
                <p className="text-sm text-destructive">{terminError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                >
                  Zurück
                </Button>
                <Button
                  disabled={!terminbezeichnung || !terminart || !datum_uhrzeit || terminSaving}
                  onClick={handleTerminSave}
                  className="flex-1"
                >
                  {terminSaving ? 'Wird gespeichert …' : terminId ? 'Weiter zu Schritt 3' : 'Termin anlegen & weiter'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          missingPrereqFallback
        ))}

      {/* Step 3: Review-Notiz erfassen */}
      {step === 3 &&
        (selectedUnternehmen ? (
          <div className="space-y-4">
            <KennzahlenPanel />
            <div className="rounded-2xl border bg-card p-4 space-y-4 overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                <IconNotes size={18} className="text-primary" />
                <h3 className="font-semibold text-foreground">Review-Notiz erfassen</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notiz_titel">Notiz-Titel *</Label>
                <Input
                  id="notiz_titel"
                  value={notiz_titel}
                  onChange={(e) => setNotiz_titel(e.target.value)}
                  placeholder="Portfolio-Review …"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notiz_inhalt">Inhalt *</Label>
                <Textarea
                  id="notiz_inhalt"
                  value={notiz_inhalt}
                  onChange={(e) => setNotiz_inhalt(e.target.value)}
                  placeholder="Ergebnisse, Beobachtungen, nächste Schritte …"
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="notiz_datum">Datum *</Label>
                  <Input
                    id="notiz_datum"
                    type="date"
                    value={notiz_datum}
                    onChange={(e) => setNotiz_datum(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kategorie">Kategorie</Label>
                  <Select value={kategorieKey} onValueChange={setKategorieKey}>
                    <SelectTrigger id="kategorie">
                      <SelectValue placeholder="Kategorie wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {KATEGORIE_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prioritaet">Priorität</Label>
                  <Select value={prioritaetKey} onValueChange={setPrioritaetKey}>
                    <SelectTrigger id="prioritaet">
                      <SelectValue placeholder="Priorität wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITAET_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {notizError && (
                <p className="text-sm text-destructive">{notizError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Zurück
                </Button>
                <Button
                  disabled={!notiz_titel || !notiz_inhalt || !notiz_datum || notizSaving}
                  onClick={handleNotizSave}
                  className="flex-1"
                >
                  {notizSaving ? 'Wird gespeichert …' : notizId ? 'Weiter zu Schritt 4' : 'Notiz speichern & weiter'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          missingPrereqFallback
        ))}

      {/* Step 4: Protokoll hinterlegen */}
      {step === 4 &&
        (selectedUnternehmen ? (
          <div className="space-y-4">
            <KennzahlenPanel />

            {!dokId ? (
              <div className="rounded-2xl border bg-card p-4 space-y-4 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <IconFileText size={18} className="text-primary" />
                  <h3 className="font-semibold text-foreground">Protokoll hinterlegen</h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dokumentenbezeichnung">Bezeichnung *</Label>
                  <Input
                    id="dokumentenbezeichnung"
                    value={dokumentenbezeichnung}
                    onChange={(e) => setDokumentenbezeichnung(e.target.value)}
                    placeholder="Review-Protokoll …"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dokumententyp">Dokumententyp</Label>
                    <Select value={dokumententypKey} onValueChange={setDokumententypKey}>
                      <SelectTrigger id="dokumententyp">
                        <SelectValue placeholder="Typ wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOKUMENTENTYP_OPTIONS.map((o) => (
                          <SelectItem key={o.key} value={o.key}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dokumentendatum">Datum</Label>
                    <Input
                      id="dokumentendatum"
                      type="date"
                      value={dokumentendatum}
                      onChange={(e) => setDokumentendatum(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dokumentenlink">Link (optional)</Label>
                    <Input
                      id="dokumentenlink"
                      type="url"
                      value={dokumentenlink}
                      onChange={(e) => setDokumentenlink(e.target.value)}
                      placeholder="https://…"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bereitgestellt_von">Bereitgestellt von</Label>
                    <Input
                      id="bereitgestellt_von"
                      value={bereitgestellt_von}
                      onChange={(e) => setBereitgestellt_von(e.target.value)}
                      placeholder="Name oder Abteilung"
                    />
                  </div>
                </div>

                {dokError && (
                  <p className="text-sm text-destructive">{dokError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    Zurück
                  </Button>
                  <Button
                    disabled={!dokumentenbezeichnung || dokSaving}
                    onClick={handleDokSave}
                    className="flex-1"
                  >
                    {dokSaving ? 'Wird gespeichert …' : 'Protokoll hinterlegen & abschließen'}
                  </Button>
                </div>
              </div>
            ) : (
              /* Erfolgs-Abschluss */
              <div className="rounded-2xl border bg-card p-6 text-center space-y-4 overflow-hidden">
                <div className="flex justify-center">
                  <div className="rounded-full bg-primary/10 p-4">
                    <IconCheck size={32} className="text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Review abgeschlossen!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Portfolio-Review für{' '}
                    <strong>{selectedUnternehmen.fields.name}</strong> wurde erfolgreich
                    durchgeführt. Termin, Notiz und Protokoll wurden gespeichert.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button onClick={handleReset}>
                    Neuen Review starten
                  </Button>
                  <a href="#/">
                    <Button variant="outline" className="w-full sm:w-auto">
                      Zurück zum Dashboard
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : (
          missingPrereqFallback
        ))}
    </IntentWizardShell>
  );
}
