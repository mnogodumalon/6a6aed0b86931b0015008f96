/**
 * Unternehmen Onboarding — 4-Schritt-Wizard.
 * Steps: 1) Stammdaten erfassen & Unternehmen anlegen → 2) Kickoff-Termin planen →
 *        3) Einstiegsdokument erfassen → 4) Onboarding-Notiz anlegen & Abschluss.
 * Reads: unternehmen (Portfolioanzahl als Kontext). Writes: unternehmen (createUnternehmenEntry),
 *        termine (createTermineEntry), dokumente (createDokumenteEntry), notizen (createNotizenEntry).
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
} from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';

const RECHTSFORM_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['rechtsform'] ?? [];
const BRANCHE_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['branche'] ?? [];
const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

export default function UnternehmenOnboardingPage() {
  const { unternehmen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // IDs der erstellten Datensätze (für Idempotenz bei Retry)
  const [createdUnternehmenId, setCreatedUnternehmenId] = useState<string | null>(null);
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);
  const [createdDokumentId, setCreatedDokumentId] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);

  // Schritt 1: Stammdaten
  const [name, setName] = useState('');
  const [rechtsformKey, setRechtsformKey] = useState('');
  const [brancheKey, setBrancheKey] = useState('');
  const [stadt, setStadt] = useState('');
  const [land, setLand] = useState('');
  const [investiertesKapital, setInvestiertesKapital] = useState('');
  const [beteiligungsquote, setBeteiligungsquote] = useState('');
  const [investitionsdatum, setInvestitionsdatum] = useState('');

  // Schritt 2: Termin
  const [terminbezeichnung, setTerminbezeichnung] = useState('');
  const [terminartKey, setTerminartKey] = useState('');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');

  // Schritt 3: Dokument
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententypKey, setDokumententypKey] = useState('');
  const [dokumentendatum, setDokumentendatum] = useState('');
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [bereitgestelltVon, setBereitgestelltVon] = useState('');

  // Schritt 4: Notiz
  const [notizTitel, setNotizTitel] = useState('');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [kategorieKey, setKategorieKey] = useState('');
  const [prioritaetKey, setPrioritaetKey] = useState('');
  const [schlagwoerter, setSchlagwoerter] = useState('');

  const handleReset = () => {
    setStep(1);
    setCreatedUnternehmenId(null);
    setCreatedTerminId(null);
    setCreatedDokumentId(null);
    setCreatedNotizId(null);
    setName('');
    setRechtsformKey('');
    setBrancheKey('');
    setStadt('');
    setLand('');
    setInvestiertesKapital('');
    setBeteiligungsquote('');
    setInvestitionsdatum('');
    setTerminbezeichnung('');
    setTerminartKey('');
    setDatumUhrzeit('');
    setOrt('');
    setDokumentenbezeichnung('');
    setDokumententypKey('');
    setDokumentendatum('');
    setDokumentenlink('');
    setBereitgestelltVon('');
    setNotizTitel('');
    setNotizInhalt('');
    setKategorieKey('');
    setPrioritaetKey('');
    setSchlagwoerter('');
    setSaveError(null);
  };

  const handleSaveUnternehmen = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      let uid = createdUnternehmenId;
      if (!uid) {
        const payload: Record<string, unknown> = {
          name: name.trim(),
          status: 'aktiv',
        };
        if (rechtsformKey && rechtsformKey !== 'none') payload.rechtsform = rechtsformKey;
        if (brancheKey && brancheKey !== 'none') payload.branche = brancheKey;
        if (stadt.trim()) payload.stadt = stadt.trim();
        if (land.trim()) payload.land = land.trim();
        if (investiertesKapital) payload.investiertes_kapital = parseFloat(investiertesKapital);
        if (beteiligungsquote) payload.beteiligungsquote = parseFloat(beteiligungsquote);
        if (investitionsdatum) payload.investitionsdatum = investitionsdatum;
        const result = await LivingAppsService.createUnternehmenEntry(payload);
        uid = result.record_id;
        setCreatedUnternehmenId(uid);
      }
      await fetchAll();
      setStep(2);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTermin = async () => {
    if (!terminbezeichnung.trim() || !terminartKey || terminartKey === 'none' || !datumUhrzeit) return;
    if (!createdUnternehmenId) { setStep(1); return; }
    setSaving(true);
    setSaveError(null);
    try {
      let tid = createdTerminId;
      if (!tid) {
        const payload: Record<string, unknown> = {
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, createdUnternehmenId),
          terminbezeichnung: terminbezeichnung.trim(),
          terminart: terminartKey,
          datum_uhrzeit: datumUhrzeit,
        };
        if (ort.trim()) payload.ort = ort.trim();
        const result = await LivingAppsService.createTermineEntry(payload);
        tid = result.record_id;
        setCreatedTerminId(tid);
      }
      await fetchAll();
      setStep(3);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDokument = async () => {
    if (!dokumentenbezeichnung.trim()) return;
    if (!createdUnternehmenId) { setStep(1); return; }
    setSaving(true);
    setSaveError(null);
    try {
      let did = createdDokumentId;
      if (!did) {
        const payload: Record<string, unknown> = {
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, createdUnternehmenId),
          dokumentenbezeichnung: dokumentenbezeichnung.trim(),
        };
        if (dokumententypKey && dokumententypKey !== 'none') payload.dokumententyp = dokumententypKey;
        if (dokumentendatum) payload.dokumentendatum = dokumentendatum;
        if (dokumentenlink.trim()) payload.dokumentenlink = dokumentenlink.trim();
        if (bereitgestelltVon.trim()) payload.bereitgestellt_von = bereitgestelltVon.trim();
        const result = await LivingAppsService.createDokumenteEntry(payload);
        did = result.record_id;
        setCreatedDokumentId(did);
      }
      await fetchAll();
      setStep(4);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotiz = async () => {
    if (!notizTitel.trim() || !notizInhalt.trim()) return;
    if (!createdUnternehmenId) { setStep(1); return; }
    setSaving(true);
    setSaveError(null);
    try {
      let nid = createdNotizId;
      if (!nid) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const payload: Record<string, unknown> = {
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, createdUnternehmenId),
          notiz_titel: notizTitel.trim(),
          notiz_inhalt: notizInhalt.trim(),
          notiz_datum: today,
        };
        if (kategorieKey && kategorieKey !== 'none') payload.kategorie = kategorieKey;
        if (prioritaetKey && prioritaetKey !== 'none') payload.prioritaet = prioritaetKey;
        if (schlagwoerter.trim()) payload.schlagwoerter = schlagwoerter.trim();
        const result = await LivingAppsService.createNotizenEntry(payload);
        nid = result.record_id;
        setCreatedNotizId(nid);
      }
      await fetchAll();
      setStep(5);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const portfolioAnzahl = unternehmen.length;

  return (
    <IntentWizardShell
      title="Unternehmen onboarden"
      subtitle="Neues Portfolio-Unternehmen in 4 Schritten einrichten"
      steps={[
        { label: 'Stammdaten' },
        { label: 'Kickoff-Termin' },
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
      {/* ── Schritt 1: Stammdaten ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-secondary">
            <IconBuilding size={24} className="text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm">Neues Unternehmen anlegen</p>
              <p className="text-xs text-muted-foreground">
                Portfolio enthält aktuell <strong>{portfolioAnzahl}</strong> {portfolioAnzahl === 1 ? 'Unternehmen' : 'Unternehmen'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="name">Unternehmensname *</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="z. B. TechVentures GmbH"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rechtsform">Rechtsform</Label>
              <Select value={rechtsformKey} onValueChange={setRechtsformKey}>
                <SelectTrigger id="rechtsform" className="w-full">
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
              <Label htmlFor="branche">Branche</Label>
              <Select value={brancheKey} onValueChange={setBrancheKey}>
                <SelectTrigger id="branche" className="w-full">
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
              <Label htmlFor="stadt">Stadt</Label>
              <Input
                id="stadt"
                value={stadt}
                onChange={e => setStadt(e.target.value)}
                placeholder="z. B. Berlin"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="land">Land</Label>
              <Input
                id="land"
                value={land}
                onChange={e => setLand(e.target.value)}
                placeholder="z. B. Deutschland"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="kapital">Investiertes Kapital (€)</Label>
              <Input
                id="kapital"
                type="number"
                min="0"
                value={investiertesKapital}
                onChange={e => setInvestiertesKapital(e.target.value)}
                placeholder="z. B. 500000"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quote">Beteiligungsquote (%)</Label>
              <Input
                id="quote"
                type="number"
                min="0"
                max="100"
                value={beteiligungsquote}
                onChange={e => setBeteiligungsquote(e.target.value)}
                placeholder="z. B. 25"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="investitionsdatum">Investitionsdatum</Label>
              <Input
                id="investitionsdatum"
                type="date"
                value={investitionsdatum}
                onChange={e => setInvestitionsdatum(e.target.value)}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-secondary text-xs text-muted-foreground">
            Status wird automatisch auf <strong>Aktiv</strong> gesetzt.
          </div>

          {saveError && (
            <p className="text-sm text-destructive">{saveError}</p>
          )}

          <Button
            className="w-full"
            disabled={!name.trim() || saving}
            onClick={handleSaveUnternehmen}
          >
            {saving ? 'Wird gespeichert…' : createdUnternehmenId ? 'Weiter zu Schritt 2' : 'Unternehmen anlegen & weiter'}
            {!saving && <IconChevronRight size={16} className="ml-1" />}
          </Button>
        </div>
      )}

      {/* ── Schritt 2: Kickoff-Termin ── */}
      {step === 2 && (
        createdUnternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-secondary">
              <IconCalendarPlus size={24} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm">Kickoff-Termin für <strong className="truncate">{name}</strong></p>
                <p className="text-xs text-muted-foreground">Termin wird mit dem Unternehmen verknüpft</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="terminbezeichnung">Terminbezeichnung *</Label>
                <Input
                  id="terminbezeichnung"
                  value={terminbezeichnung}
                  onChange={e => setTerminbezeichnung(e.target.value)}
                  placeholder="z. B. Kickoff-Meeting TechVentures"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="terminart">Terminart *</Label>
                <Select value={terminartKey} onValueChange={setTerminartKey}>
                  <SelectTrigger id="terminart" className="w-full">
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
                <Label htmlFor="datum_uhrzeit">Datum & Uhrzeit *</Label>
                <Input
                  id="datum_uhrzeit"
                  type="datetime-local"
                  value={datumUhrzeit}
                  onChange={e => setDatumUhrzeit(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="ort">Ort</Label>
                <Input
                  id="ort"
                  value={ort}
                  onChange={e => setOrt(e.target.value)}
                  placeholder="z. B. Büro Berlin, Konferenzraum 2"
                />
              </div>
            </div>

            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setSaveError(null); setStep(3); }}
              >
                Schritt überspringen
              </Button>
              <Button
                className="flex-1"
                disabled={!terminbezeichnung.trim() || !terminartKey || terminartKey === 'none' || !datumUhrzeit || saving}
                onClick={handleSaveTermin}
              >
                {saving ? 'Wird gespeichert…' : createdTerminId ? 'Weiter zu Schritt 3' : 'Termin anlegen & weiter'}
                {!saving && <IconChevronRight size={16} className="ml-1" />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Daten aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Schritt 3: Einstiegsdokument ── */}
      {step === 3 && (
        createdUnternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-secondary">
              <IconFileText size={24} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm">Einstiegsdokument für <strong className="truncate">{name}</strong></p>
                <p className="text-xs text-muted-foreground">Wichtigstes Dokument für den Einstieg erfassen</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="dokumentenbezeichnung">Dokumentenbezeichnung *</Label>
                <Input
                  id="dokumentenbezeichnung"
                  value={dokumentenbezeichnung}
                  onChange={e => setDokumentenbezeichnung(e.target.value)}
                  placeholder="z. B. Beteiligungsvertrag TechVentures 2026"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dokumententyp">Dokumententyp</Label>
                <Select value={dokumententypKey} onValueChange={setDokumententypKey}>
                  <SelectTrigger id="dokumententyp" className="w-full">
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
                <Label htmlFor="dokumentendatum">Dokumentendatum</Label>
                <Input
                  id="dokumentendatum"
                  type="date"
                  value={dokumentendatum}
                  onChange={e => setDokumentendatum(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="dokumentenlink">Dokumentenlink (URL)</Label>
                <Input
                  id="dokumentenlink"
                  type="url"
                  value={dokumentenlink}
                  onChange={e => setDokumentenlink(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="bereitgestellt_von">Bereitgestellt von</Label>
                <Input
                  id="bereitgestellt_von"
                  value={bereitgestelltVon}
                  onChange={e => setBereitgestelltVon(e.target.value)}
                  placeholder="z. B. Rechtsanwalt Müller"
                />
              </div>
            </div>

            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setSaveError(null); setStep(4); }}
              >
                Schritt überspringen
              </Button>
              <Button
                className="flex-1"
                disabled={!dokumentenbezeichnung.trim() || saving}
                onClick={handleSaveDokument}
              >
                {saving ? 'Wird gespeichert…' : createdDokumentId ? 'Weiter zu Schritt 4' : 'Dokument anlegen & weiter'}
                {!saving && <IconChevronRight size={16} className="ml-1" />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Daten aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Schritt 4: Onboarding-Notiz ── */}
      {step === 4 && (
        createdUnternehmenId ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-secondary">
              <IconNotes size={24} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm">Onboarding-Notiz für <strong className="truncate">{name}</strong></p>
                <p className="text-xs text-muted-foreground">
                  Datum wird automatisch auf heute gesetzt ({format(new Date(), 'dd.MM.yyyy')})
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="notiz_titel">Titel *</Label>
                <Input
                  id="notiz_titel"
                  value={notizTitel}
                  onChange={e => setNotizTitel(e.target.value)}
                  placeholder="z. B. Onboarding-Zusammenfassung"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="kategorie">Kategorie</Label>
                <Select value={kategorieKey} onValueChange={setKategorieKey}>
                  <SelectTrigger id="kategorie" className="w-full">
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
                      onClick={() => setPrioritaetKey(prioritaetKey === o.key ? '' : o.key)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        prioritaetKey === o.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-foreground hover:bg-secondary'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="notiz_inhalt">Inhalt *</Label>
                <Textarea
                  id="notiz_inhalt"
                  value={notizInhalt}
                  onChange={e => setNotizInhalt(e.target.value)}
                  placeholder="Beschreibe die wichtigsten Erkenntnisse und nächsten Schritte…"
                  rows={4}
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="schlagwoerter">Schlagwörter</Label>
                <Input
                  id="schlagwoerter"
                  value={schlagwoerter}
                  onChange={e => setSchlagwoerter(e.target.value)}
                  placeholder="z. B. onboarding, kickoff, erstkontakt"
                />
              </div>
            </div>

            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}

            <Button
              className="w-full"
              disabled={!notizTitel.trim() || !notizInhalt.trim() || saving}
              onClick={handleSaveNotiz}
            >
              {saving ? 'Wird gespeichert…' : createdNotizId ? 'Onboarding abschließen' : 'Notiz anlegen & abschließen'}
              {!saving && <IconCheck size={16} className="ml-1" />}
            </Button>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Daten aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Schritt 5: Abschluss ── */}
      {step === 5 && (
        <div className="space-y-6 text-center py-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <IconCheck size={32} className="text-primary" stroke={2} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Onboarding abgeschlossen!</h2>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              <strong>{name}</strong> wurde erfolgreich ins Portfolio aufgenommen
              {createdTerminId ? ', ein Kickoff-Termin geplant' : ''}
              {createdDokumentId ? ', das Einstiegsdokument erfasst' : ''}
              {createdNotizId ? ' und eine Onboarding-Notiz angelegt' : ''}.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-lg mx-auto">
            <div className={`p-3 rounded-xl border text-sm ${createdUnternehmenId ? 'bg-primary/5 border-primary/20' : 'bg-secondary'}`}>
              <p className="font-medium">Unternehmen</p>
              <p className="text-xs text-muted-foreground">{createdUnternehmenId ? 'Angelegt' : 'Übersprungen'}</p>
            </div>
            <div className={`p-3 rounded-xl border text-sm ${createdTerminId ? 'bg-primary/5 border-primary/20' : 'bg-secondary'}`}>
              <p className="font-medium">Kickoff-Termin</p>
              <p className="text-xs text-muted-foreground">{createdTerminId ? 'Geplant' : 'Übersprungen'}</p>
            </div>
            <div className={`p-3 rounded-xl border text-sm ${createdDokumentId ? 'bg-primary/5 border-primary/20' : 'bg-secondary'}`}>
              <p className="font-medium">Dokument</p>
              <p className="text-xs text-muted-foreground">{createdDokumentId ? 'Erfasst' : 'Übersprungen'}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
            <Button variant="outline" className="flex-1" onClick={handleReset}>
              Weiteres Unternehmen onboarden
            </Button>
            <a href="#/" className="flex-1">
              <Button className="w-full">Zurück zum Dashboard</Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
