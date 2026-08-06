/**
 * Portfolio-Review — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen auswählen → 2) Kennzahlen & Status aktualisieren →
 *         3) Nächsten Termin planen → 4) Review-Notiz erfassen & Zusammenfassung.
 * Reads: unternehmen. Writes: unternehmen (updateUnternehmenEntry),
 *         termine (createTermineEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  IconBuilding,
  IconChartBar,
  IconCalendarPlus,
  IconNotes,
  IconCheck,
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
const STATUS_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['status'] ?? [];

export default function PortfolioReviewPage() {
  const { unternehmen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedUnternehmen, setSelectedUnternehmen] = useState<Unternehmen | null>(null);

  // Step 2: Kennzahlen
  const [neuerWert, setNeuerWert] = useState('');
  const [neueBeteiligungsquote, setNeueBeteiligungsquote] = useState('');
  const [neuerStatus, setNeuerStatus] = useState(STATUS_OPTIONS[0]?.key ?? 'aktiv');
  const [cockpitZusammenfassung, setCockpitZusammenfassung] = useState('');
  const [savingKennzahlen, setSavingKennzahlen] = useState(false);
  const [kennzahlenSaved, setKennzahlenSaved] = useState(false);

  // Step 3: Termin
  const [terminbezeichnung, setTerminbezeichnung] = useState('');
  const [terminart, setTerminart] = useState(TERMINART_OPTIONS[0]?.key ?? '');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [terminstatus] = useState('geplant');
  const [savingTermin, setSavingTermin] = useState(false);
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);
  const [createdTerminBezeichnung, setCreatedTerminBezeichnung] = useState('');
  const [createdTerminDatum, setCreatedTerminDatum] = useState('');

  // Step 4: Notiz
  const [notizTitel, setNotizTitel] = useState('');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kategorieKey, setKategorieKey] = useState('meeting');
  const [prioritaetKey, setPrioritaetKey] = useState(PRIORITAET_OPTIONS[0]?.key ?? '');
  const [savingNotiz, setSavingNotiz] = useState(false);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);

  // Computed values for step 2 live preview
  const alterWert = selectedUnternehmen?.fields.aktueller_wert ?? 0;
  const neuerWertNum = parseFloat(neuerWert) || 0;
  const wertDiff = neuerWertNum - alterWert;
  const wertDiffProzent = alterWert > 0 ? ((wertDiff / alterWert) * 100) : 0;

  const aktiveUnternehmen = unternehmen.filter(
    (u) => u.fields.status?.key === 'aktiv'
  );

  const handleSelectUnternehmen = (id: string) => {
    const found = unternehmen.find((u) => u.record_id === id) ?? null;
    setSelectedUnternehmen(found);
    if (found) {
      setNeuerStatus(found.fields.status?.key ?? STATUS_OPTIONS[0]?.key ?? 'aktiv');
      setNeueBeteiligungsquote(found.fields.beteiligungsquote?.toString() ?? '');
      setCockpitZusammenfassung(found.fields.cockpit_zusammenfassung ?? '');
    }
    setStep(2);
  };

  const handleSaveKennzahlen = async () => {
    if (!selectedUnternehmen) return;
    setSavingKennzahlen(true);
    try {
      const payload: Record<string, unknown> = { status: neuerStatus };
      if (neuerWert !== '') payload.aktueller_wert = parseFloat(neuerWert);
      if (neueBeteiligungsquote !== '') payload.beteiligungsquote = parseFloat(neueBeteiligungsquote);
      if (cockpitZusammenfassung !== '') payload.cockpit_zusammenfassung = cockpitZusammenfassung;
      await LivingAppsService.updateUnternehmenEntry(selectedUnternehmen.record_id, payload);
      await fetchAll();
      setKennzahlenSaved(true);
      setStep(3);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingKennzahlen(false);
    }
  };

  const handleCreateTermin = async () => {
    if (!selectedUnternehmen || !terminbezeichnung || !terminart || !datumUhrzeit) return;
    setSavingTermin(true);
    try {
      let tid = createdTerminId;
      if (!tid) {
        const result = await LivingAppsService.createTermineEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmen.record_id),
          terminbezeichnung,
          terminart,
          datum_uhrzeit: datumUhrzeit,
          ort: ort || undefined,
          terminstatus,
        });
        tid = result.record_id;
        setCreatedTerminId(tid);
        setCreatedTerminBezeichnung(terminbezeichnung);
        setCreatedTerminDatum(datumUhrzeit);
      }
      setStep(4);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingTermin(false);
    }
  };

  const handleCreateNotiz = async () => {
    if (!selectedUnternehmen || !notizTitel || !notizInhalt || !notizDatum) return;
    setSavingNotiz(true);
    try {
      let nid = createdNotizId;
      if (!nid) {
        const result = await LivingAppsService.createNotizenEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmen.record_id),
          notiz_titel: notizTitel,
          notiz_inhalt: notizInhalt,
          notiz_datum: notizDatum,
          kategorie: kategorieKey,
          prioritaet: prioritaetKey || undefined,
        });
        nid = result.record_id;
        setCreatedNotizId(nid);
      }
      await fetchAll();
      setStep(5);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingNotiz(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedUnternehmen(null);
    setNeuerWert('');
    setNeueBeteiligungsquote('');
    setNeuerStatus(STATUS_OPTIONS[0]?.key ?? 'aktiv');
    setCockpitZusammenfassung('');
    setKennzahlenSaved(false);
    setTerminbezeichnung('');
    setTerminart(TERMINART_OPTIONS[0]?.key ?? '');
    setDatumUhrzeit('');
    setOrt('');
    setCreatedTerminId(null);
    setCreatedTerminBezeichnung('');
    setCreatedTerminDatum('');
    setNotizTitel('');
    setNotizInhalt('');
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    setKategorieKey('meeting');
    setPrioritaetKey(PRIORITAET_OPTIONS[0]?.key ?? '');
    setSavingNotiz(false);
    setCreatedNotizId(null);
  };

  return (
    <IntentWizardShell
      title="Portfolio-Review"
      subtitle="Kennzahlen aktualisieren, Termin planen, Notiz dokumentieren"
      steps={[
        { label: 'Unternehmen' },
        { label: 'Kennzahlen' },
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
      {/* Step 1: Unternehmen auswählen */}
      {step === 1 && (
        <EntitySelectStep
          items={aktiveUnternehmen.map((u) => ({
            id: u.record_id,
            title: u.fields.name ?? '(ohne Name)',
            subtitle: [
              u.fields.branche?.label,
              u.fields.aktueller_wert != null
                ? `Wert: ${u.fields.aktueller_wert.toLocaleString('de-DE')} €`
                : undefined,
            ]
              .filter(Boolean)
              .join(' · '),
            status: u.fields.status
              ? { key: u.fields.status.key, label: u.fields.status.label }
              : undefined,
            icon: <IconBuilding size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectUnternehmen}
          searchPlaceholder="Unternehmen suchen …"
          emptyText="Keine aktiven Unternehmen gefunden."
          emptyIcon={<IconBuilding size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Kennzahlen & Status aktualisieren */}
      {step === 2 && (
        selectedUnternehmen ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-secondary rounded-2xl">
              <IconBuilding size={20} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold truncate">{selectedUnternehmen.fields.name}</p>
                <p className="text-sm text-muted-foreground">{selectedUnternehmen.fields.branche?.label}</p>
              </div>
              <StatusBadge statusKey={selectedUnternehmen.fields.status?.key} label={selectedUnternehmen.fields.status?.label} className="ml-auto shrink-0" />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aktueller_wert">Aktueller Wert (€)</Label>
                <Input
                  id="aktueller_wert"
                  type="number"
                  value={neuerWert}
                  onChange={(e) => setNeuerWert(e.target.value)}
                  placeholder={alterWert > 0 ? `Bisher: ${alterWert.toLocaleString('de-DE')} €` : 'Wert in €'}
                />
              </div>

              {/* Live Wertveränderung */}
              {neuerWert !== '' && alterWert > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary text-sm">
                  {wertDiff > 0 ? (
                    <IconTrendingUp size={18} className="text-green-600 shrink-0" />
                  ) : wertDiff < 0 ? (
                    <IconTrendingDown size={18} className="text-red-500 shrink-0" />
                  ) : (
                    <IconMinus size={18} className="text-muted-foreground shrink-0" />
                  )}
                  <span>
                    Veränderung:{' '}
                    <span className={wertDiff > 0 ? 'text-green-600 font-semibold' : wertDiff < 0 ? 'text-red-500 font-semibold' : 'font-semibold'}>
                      {wertDiff >= 0 ? '+' : ''}{wertDiff.toLocaleString('de-DE')} €
                    </span>
                    {' '}({wertDiffProzent >= 0 ? '+' : ''}{wertDiffProzent.toFixed(1)} %)
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="beteiligungsquote">Beteiligungsquote (%)</Label>
                <Input
                  id="beteiligungsquote"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={neueBeteiligungsquote}
                  onChange={(e) => setNeueBeteiligungsquote(e.target.value)}
                  placeholder={
                    selectedUnternehmen.fields.beteiligungsquote != null
                      ? `Bisher: ${selectedUnternehmen.fields.beteiligungsquote} %`
                      : 'Quote in %'
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setNeuerStatus(opt.key)}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                        neuerStatus === opt.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-foreground hover:bg-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cockpit_zusammenfassung">Cockpit-Zusammenfassung</Label>
                <Textarea
                  id="cockpit_zusammenfassung"
                  value={cockpitZusammenfassung}
                  onChange={(e) => setCockpitZusammenfassung(e.target.value)}
                  placeholder="Kurze Zusammenfassung der aktuellen Lage …"
                  rows={4}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Zurück
              </Button>
              <Button
                onClick={handleSaveKennzahlen}
                disabled={savingKennzahlen}
                className="flex-1"
              >
                <IconChartBar size={16} className="mr-2" />
                {savingKennzahlen ? 'Speichere …' : 'Speichern & weiter'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* Step 3: Nächsten Termin planen */}
      {step === 3 && (
        selectedUnternehmen ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-secondary rounded-2xl">
              <IconCalendarPlus size={20} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold truncate">Termin für: {selectedUnternehmen.fields.name}</p>
                {kennzahlenSaved && (
                  <p className="text-sm text-green-600">Kennzahlen aktualisiert</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="terminbezeichnung">Terminbezeichnung *</Label>
                <Input
                  id="terminbezeichnung"
                  value={terminbezeichnung}
                  onChange={(e) => setTerminbezeichnung(e.target.value)}
                  placeholder="z. B. Quartalsgespräch Q3 2026"
                />
              </div>

              <div className="space-y-2">
                <Label>Terminart *</Label>
                <Select value={terminart} onValueChange={setTerminart}>
                  <SelectTrigger>
                    <SelectValue placeholder="Terminart wählen" />
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
                <Label htmlFor="datum_uhrzeit">Datum & Uhrzeit *</Label>
                <Input
                  id="datum_uhrzeit"
                  type="datetime-local"
                  value={datumUhrzeit}
                  onChange={(e) => setDatumUhrzeit(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ort">Ort (optional)</Label>
                <Input
                  id="ort"
                  value={ort}
                  onChange={(e) => setOrt(e.target.value)}
                  placeholder="z. B. Büro Berlin"
                />
              </div>

              <div className="space-y-2">
                <Label>Terminstatus</Label>
                <div className="flex flex-wrap gap-2">
                  {TERMINSTATUS_OPTIONS.map((opt) => (
                    <div
                      key={opt.key}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium ${
                        opt.key === 'geplant'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-muted-foreground'
                      }`}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Standard: Geplant</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Zurück
              </Button>
              <Button
                onClick={handleCreateTermin}
                disabled={savingTermin || !terminbezeichnung || !terminart || !datumUhrzeit}
                className="flex-1"
              >
                <IconCalendarPlus size={16} className="mr-2" />
                {savingTermin ? 'Speichere …' : 'Termin anlegen & weiter'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* Step 4: Review-Notiz erfassen */}
      {step === 4 && (
        selectedUnternehmen ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-secondary rounded-2xl">
              <IconNotes size={20} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold truncate">Notiz für: {selectedUnternehmen.fields.name}</p>
                {createdTerminBezeichnung && (
                  <p className="text-sm text-green-600">Termin angelegt: {createdTerminBezeichnung}</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notiz_titel">Titel *</Label>
                <Input
                  id="notiz_titel"
                  value={notizTitel}
                  onChange={(e) => setNotizTitel(e.target.value)}
                  placeholder="z. B. Review-Ergebnis August 2026"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notiz_inhalt">Inhalt *</Label>
                <Textarea
                  id="notiz_inhalt"
                  value={notizInhalt}
                  onChange={(e) => setNotizInhalt(e.target.value)}
                  placeholder="Zusammenfassung des Reviews, Erkenntnisse, Maßnahmen …"
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notiz_datum">Datum *</Label>
                <Input
                  id="notiz_datum"
                  type="date"
                  value={notizDatum}
                  onChange={(e) => setNotizDatum(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Kategorie</Label>
                <Select value={kategorieKey} onValueChange={setKategorieKey}>
                  <SelectTrigger>
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

              <div className="space-y-2">
                <Label>Priorität</Label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITAET_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPrioritaetKey(opt.key)}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                        prioritaetKey === opt.key
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

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                Zurück
              </Button>
              <Button
                onClick={handleCreateNotiz}
                disabled={savingNotiz || !notizTitel || !notizInhalt || !notizDatum}
                className="flex-1"
              >
                <IconNotes size={16} className="mr-2" />
                {savingNotiz ? 'Speichere …' : 'Notiz speichern & abschließen'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* Step 5: Zusammenfassung */}
      {step === 5 && (
        selectedUnternehmen ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <IconCheck size={28} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Review abgeschlossen</h2>
                <p className="text-sm text-muted-foreground mt-1">Alle Daten wurden erfolgreich gespeichert.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  <IconBuilding size={14} />
                  Unternehmen
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold truncate">{selectedUnternehmen.fields.name}</span>
                  <StatusBadge statusKey={neuerStatus} label={STATUS_OPTIONS.find(o => o.key === neuerStatus)?.label} />
                </div>
                {neuerWert !== '' && (
                  <div className="flex items-center gap-4 text-sm mt-1">
                    <span className="text-muted-foreground">Neuer Wert:</span>
                    <span className="font-semibold">{parseFloat(neuerWert).toLocaleString('de-DE')} €</span>
                    {alterWert > 0 && (
                      <span className={wertDiff >= 0 ? 'text-green-600' : 'text-red-500'}>
                        ({wertDiff >= 0 ? '+' : ''}{wertDiff.toLocaleString('de-DE')} €)
                      </span>
                    )}
                  </div>
                )}
                {neueBeteiligungsquote !== '' && (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">Beteiligungsquote:</span>
                    <span className="font-semibold">{neueBeteiligungsquote} %</span>
                  </div>
                )}
              </div>

              {createdTerminBezeichnung && (
                <div className="rounded-2xl border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    <IconCalendarPlus size={14} />
                    Nächster Termin
                  </div>
                  <p className="font-semibold">{createdTerminBezeichnung}</p>
                  {createdTerminDatum && (
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(createdTerminDatum.replace('T', ' ')), "dd. MMMM yyyy, HH:mm 'Uhr'", { locale: de })}
                    </p>
                  )}
                </div>
              )}

              {notizTitel && (
                <div className="rounded-2xl border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    <IconNotes size={14} />
                    Review-Notiz
                  </div>
                  <p className="font-semibold">{notizTitel}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{notizInhalt}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {kategorieKey && (
                      <span className="text-xs bg-secondary px-2 py-1 rounded-lg">
                        {KATEGORIE_OPTIONS.find(o => o.key === kategorieKey)?.label ?? kategorieKey}
                      </span>
                    )}
                    {prioritaetKey && (
                      <span className="text-xs bg-secondary px-2 py-1 rounded-lg">
                        {PRIORITAET_OPTIONS.find(o => o.key === prioritaetKey)?.label ?? prioritaetKey}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button onClick={handleReset} variant="outline" className="flex-1">
                Neues Review starten
              </Button>
              <a href="#/" className="flex-1">
                <Button className="w-full">Zurück zum Dashboard</Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Kein Review-Ergebnis gefunden.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
