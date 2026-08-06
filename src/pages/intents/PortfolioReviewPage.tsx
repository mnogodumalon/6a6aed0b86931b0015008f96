/**
 * Portfolio-Review — 5-Schritt-Wizard.
 * Steps: 1) Unternehmen auswählen (aktiv) → 2) Review-Termin erfassen →
 *        3) Review-Notiz erstellen → 4) Dokument verlinken (optional) → 5) Abschluss.
 * Reads: unternehmen (gefiltert auf status=aktiv).
 * Writes: termine (createTermineEntry), notizen (createNotizenEntry),
 *         dokumente (createDokumenteEntry, optional).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconFileText,
  IconLink,
  IconNotes,
  IconPlayerSkipForward,
} from '@tabler/icons-react';

import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';

import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
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

// Lookup option arrays — always use ?. to avoid white-page crash on absent keys
const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];

const WIZARD_STEPS = [
  { label: 'Unternehmen' },
  { label: 'Termin' },
  { label: 'Notiz' },
  { label: 'Dokument' },
  { label: 'Abschluss' },
];

export default function PortfolioReviewPage() {
  const { unternehmen, loading, error, fetchAll } = useDashboardData();

  // ── Wizard navigation ──
  const [step, setStep] = useState(1);

  // ── Step 1: Unternehmen ──
  const [unternehmenId, setUnternehmenId] = useState('');
  const [unternehmenName, setUnternehmenName] = useState('');

  // ── Step 2: Termin ──
  const [terminbezeichnung, setTerminbezeichnung] = useState('');
  const [terminart, setTerminart] = useState(TERMINART_OPTIONS[0]?.key ?? '');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [terminstatus, setTerminstatus] = useState(TERMINSTATUS_OPTIONS[0]?.key ?? '');
  const [notizenTermin, setNotizenTermin] = useState('');
  const [terminId, setTerminId] = useState('');
  const [terminSaving, setTerminSaving] = useState(false);
  const [terminError, setTerminError] = useState('');

  // ── Step 3: Notiz ──
  const [notizTitel, setNotizTitel] = useState('');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kategorie, setKategorie] = useState('meeting');
  const [prioritaet, setPrioitaet] = useState(PRIORITAET_OPTIONS[0]?.key ?? '');
  const [schlagwoerter, setSchlagwoerter] = useState('');
  const [notizId, setNotizId] = useState('');
  const [notizSaving, setNotizSaving] = useState(false);
  const [notizError, setNotizError] = useState('');

  // ── Step 4: Dokument ──
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententyp, setDokumententyp] = useState('protokoll');
  const [dokumentendatum, setDokumentendatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [bereitgestelltVon, setBereitgestelltVon] = useState('');
  const [dokumentId, setDokumentId] = useState('');
  const [dokSaving, setDokSaving] = useState(false);
  const [dokError, setDokError] = useState('');
  const [dokSkipped, setDokSkipped] = useState(false);

  // ── Handlers ──

  function handleUnternehmenSelect(id: string) {
    const found = unternehmen.find(u => u.record_id === id);
    setUnternehmenId(id);
    setUnternehmenName(found?.fields.name ?? id);
    setStep(2);
  }

  async function handleTerminSave() {
    if (!terminbezeichnung || !terminart || !datumUhrzeit) return;
    setTerminSaving(true);
    setTerminError('');
    try {
      // Guard: only create if not yet saved (idempotency on retry)
      let tid = terminId;
      if (!tid) {
        const result = await LivingAppsService.createTermineEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
          terminbezeichnung,
          terminart,
          datum_uhrzeit: datumUhrzeit, // from <Input type="datetime-local">, passed through as-is
          ort: ort || undefined,
          terminstatus: terminstatus || undefined,
          notizen_termin: notizenTermin || undefined,
        });
        tid = result.record_id;
        setTerminId(tid);
      }
      await fetchAll();
      setStep(3);
    } catch (e) {
      setTerminError(e instanceof Error ? e.message : 'Fehler beim Speichern des Termins.');
    } finally {
      setTerminSaving(false);
    }
  }

  async function handleNotizSave() {
    if (!notizTitel || !notizInhalt || !notizDatum) return;
    setNotizSaving(true);
    setNotizError('');
    try {
      let nid = notizId;
      if (!nid) {
        const result = await LivingAppsService.createNotizenEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
          notiz_titel: notizTitel,
          notiz_inhalt: notizInhalt,
          notiz_datum: notizDatum, // from <Input type="date">, passed through as-is
          kategorie: kategorie || undefined,
          prioritaet: prioritaet || undefined,
          schlagwoerter: schlagwoerter || undefined,
        });
        nid = result.record_id;
        setNotizId(nid);
      }
      await fetchAll();
      setStep(4);
    } catch (e) {
      setNotizError(e instanceof Error ? e.message : 'Fehler beim Speichern der Notiz.');
    } finally {
      setNotizSaving(false);
    }
  }

  async function handleDokumentSave() {
    if (!dokumentenbezeichnung) return;
    setDokSaving(true);
    setDokError('');
    try {
      let did = dokumentId;
      if (!did) {
        const result = await LivingAppsService.createDokumenteEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
          dokumentenbezeichnung,
          dokumententyp: dokumententyp || undefined,
          dokumentendatum: dokumentendatum || undefined,
          dokumentenlink: dokumentenlink || undefined,
          bereitgestellt_von: bereitgestelltVon || undefined,
        });
        did = result.record_id;
        setDokumentId(did);
      }
      await fetchAll();
      setStep(5);
    } catch (e) {
      setDokError(e instanceof Error ? e.message : 'Fehler beim Speichern des Dokuments.');
    } finally {
      setDokSaving(false);
    }
  }

  function handleSkipDokument() {
    setDokSkipped(true);
    setStep(5);
  }

  function handleReset() {
    setStep(1);
    setUnternehmenId('');
    setUnternehmenName('');
    setTerminbezeichnung('');
    setTerminart(TERMINART_OPTIONS[0]?.key ?? '');
    setDatumUhrzeit('');
    setOrt('');
    setTerminstatus(TERMINSTATUS_OPTIONS[0]?.key ?? '');
    setNotizenTermin('');
    setTerminId('');
    setTerminError('');
    setNotizTitel('');
    setNotizInhalt('');
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    setKategorie('meeting');
    setPrioitaet(PRIORITAET_OPTIONS[0]?.key ?? '');
    setSchlagwoerter('');
    setNotizId('');
    setNotizError('');
    setDokumentenbezeichnung('');
    setDokumententyp('protokoll');
    setDokumentendatum(format(new Date(), 'yyyy-MM-dd'));
    setDokumentenlink('');
    setBereitgestelltVon('');
    setDokumentId('');
    setDokError('');
    setDokSkipped(false);
  }

  // Filter: only aktiv companies
  const aktiveUnternehmen = unternehmen.filter(
    u => u.fields.status?.key === 'aktiv'
  );

  return (
    <IntentWizardShell
      title="Portfolio-Review"
      subtitle="Termin, Notiz und Dokument für ein Portfoliounternehmen in einem Durchgang erfassen."
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Unternehmen auswählen ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Unternehmen auswählen</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Wähle das Portfoliounternehmen, für das du den Review durchführst. Es werden nur aktive Unternehmen angezeigt.
            </p>
          </div>
          <EntitySelectStep
            items={aktiveUnternehmen.map(u => ({
              id: u.record_id,
              title: u.fields.name ?? '(Kein Name)',
              subtitle: [u.fields.branche?.label, u.fields.stadt]
                .filter(Boolean)
                .join(' · '),
              status: u.fields.status
                ? { key: u.fields.status.key, label: u.fields.status.label }
                : undefined,
              icon: <IconBuilding size={20} className="text-primary" />,
            }))}
            onSelect={handleUnternehmenSelect}
            searchPlaceholder="Unternehmen suchen..."
            emptyIcon={<IconBuilding size={32} />}
            emptyText="Keine aktiven Unternehmen gefunden."
          />
        </div>
      )}

      {/* ── Step 2: Termin erfassen ── */}
      {step === 2 && (
        unternehmenId ? (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <IconCalendar size={18} className="text-primary" />
                <h2 className="text-lg font-semibold">Review-Termin erfassen</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Dokumentiere den Termin für <span className="font-medium text-foreground">{unternehmenName}</span>.
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="terminbezeichnung">Terminbezeichnung *</Label>
                <Input
                  id="terminbezeichnung"
                  value={terminbezeichnung}
                  onChange={e => setTerminbezeichnung(e.target.value)}
                  placeholder="z.B. Q3-Review 2026"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="terminart">Terminart *</Label>
                  <Select value={terminart} onValueChange={setTerminart}>
                    <SelectTrigger id="terminart">
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent>
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ort">Ort</Label>
                  <Input
                    id="ort"
                    value={ort}
                    onChange={e => setOrt(e.target.value)}
                    placeholder="z.B. Büro München"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="terminstatus">Status</Label>
                  <Select value={terminstatus} onValueChange={setTerminstatus}>
                    <SelectTrigger id="terminstatus">
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMINSTATUS_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notizen_termin">Notizen zum Termin</Label>
                <Textarea
                  id="notizen_termin"
                  value={notizenTermin}
                  onChange={e => setNotizenTermin(e.target.value)}
                  placeholder="Agenda, Teilnehmer, Besonderheiten..."
                  rows={3}
                />
              </div>
            </div>

            {terminError && (
              <p className="text-sm text-destructive">{terminError}</p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                Zurück
              </Button>
              <Button
                onClick={handleTerminSave}
                disabled={terminSaving || !terminbezeichnung || !terminart || !datumUhrzeit}
                className="flex-1 sm:flex-none"
              >
                {terminSaving ? 'Wird gespeichert...' : 'Termin speichern & weiter'}
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

      {/* ── Step 3: Notiz erstellen ── */}
      {step === 3 && (
        unternehmenId ? (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <IconNotes size={18} className="text-primary" />
                <h2 className="text-lg font-semibold">Review-Notiz erstellen</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Halte deine Erkenntnisse zum Review von <span className="font-medium text-foreground">{unternehmenName}</span> fest.
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="notiz_titel">Titel *</Label>
                <Input
                  id="notiz_titel"
                  value={notizTitel}
                  onChange={e => setNotizTitel(e.target.value)}
                  placeholder="z.B. Erkenntnisse Q3-Review"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notiz_inhalt">Inhalt *</Label>
                <Textarea
                  id="notiz_inhalt"
                  value={notizInhalt}
                  onChange={e => setNotizInhalt(e.target.value)}
                  placeholder="Was wurde besprochen? Welche Entscheidungen wurden getroffen?"
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="notiz_datum">Datum *</Label>
                  <Input
                    id="notiz_datum"
                    type="date"
                    value={notizDatum}
                    onChange={e => setNotizDatum(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kategorie">Kategorie</Label>
                  <Select value={kategorie} onValueChange={setKategorie}>
                    <SelectTrigger id="kategorie">
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {KATEGORIE_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prioritaet">Priorität</Label>
                  <Select value={prioritaet} onValueChange={setPrioitaet}>
                    <SelectTrigger id="prioritaet">
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITAET_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="schlagwoerter">Schlagwörter</Label>
                <Input
                  id="schlagwoerter"
                  value={schlagwoerter}
                  onChange={e => setSchlagwoerter(e.target.value)}
                  placeholder="z.B. Wachstum, Strategie, Q3"
                />
              </div>
            </div>

            {notizError && (
              <p className="text-sm text-destructive">{notizError}</p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>
                Zurück
              </Button>
              <Button
                onClick={handleNotizSave}
                disabled={notizSaving || !notizTitel || !notizInhalt || !notizDatum}
                className="flex-1 sm:flex-none"
              >
                {notizSaving ? 'Wird gespeichert...' : 'Notiz speichern & weiter'}
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

      {/* ── Step 4: Dokument verlinken (optional) ── */}
      {step === 4 && (
        unternehmenId ? (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <IconLink size={18} className="text-primary" />
                <h2 className="text-lg font-semibold">Dokument verlinken</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Optional: Verlinke ein zugehöriges Dokument (z.B. Protokoll, Präsentation) für{' '}
                <span className="font-medium text-foreground">{unternehmenName}</span>.
                Du kannst diesen Schritt auch überspringen.
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="dokumentenbezeichnung">Bezeichnung *</Label>
                <Input
                  id="dokumentenbezeichnung"
                  value={dokumentenbezeichnung}
                  onChange={e => setDokumentenbezeichnung(e.target.value)}
                  placeholder="z.B. Review-Protokoll Q3 2026"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dokumententyp">Dokumententyp</Label>
                  <Select value={dokumententyp} onValueChange={setDokumententyp}>
                    <SelectTrigger id="dokumententyp">
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOKUMENTENTYP_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dokumentendatum">Datum</Label>
                  <Input
                    id="dokumentendatum"
                    type="date"
                    value={dokumentendatum}
                    onChange={e => setDokumentendatum(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dokumentenlink">Link zum Dokument</Label>
                <Input
                  id="dokumentenlink"
                  type="url"
                  value={dokumentenlink}
                  onChange={e => setDokumentenlink(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bereitgestellt_von">Bereitgestellt von</Label>
                <Input
                  id="bereitgestellt_von"
                  value={bereitgestelltVon}
                  onChange={e => setBereitgestelltVon(e.target.value)}
                  placeholder="z.B. Max Mustermann"
                />
              </div>
            </div>

            {dokError && (
              <p className="text-sm text-destructive">{dokError}</p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setStep(3)}>
                Zurück
              </Button>
              <Button
                variant="outline"
                onClick={handleSkipDokument}
                className="gap-1.5"
              >
                <IconPlayerSkipForward size={16} />
                Überspringen
              </Button>
              <Button
                onClick={handleDokumentSave}
                disabled={dokSaving || !dokumentenbezeichnung}
                className="flex-1 sm:flex-none"
              >
                {dokSaving ? 'Wird gespeichert...' : 'Dokument speichern & weiter'}
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

      {/* ── Step 5: Abschluss ── */}
      {step === 5 && (
        unternehmenId ? (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <IconCheck size={28} className="text-primary" stroke={2.5} />
              </div>
              <h2 className="text-xl font-bold">Review abgeschlossen!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Der Portfolio-Review für <span className="font-medium text-foreground">{unternehmenName}</span> wurde erfolgreich dokumentiert.
              </p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Unternehmen */}
              <div className="rounded-2xl border bg-card p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconBuilding size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">Unternehmen</p>
                  <p className="text-sm font-semibold truncate">{unternehmenName}</p>
                </div>
              </div>

              {/* Termin */}
              <div className="rounded-2xl border bg-card p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconCalendar size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">Termin</p>
                  <p className="text-sm font-semibold truncate">{terminbezeichnung}</p>
                  {datumUhrzeit && (
                    <p className="text-xs text-muted-foreground">{datumUhrzeit.replace('T', ' ')}</p>
                  )}
                </div>
              </div>

              {/* Notiz */}
              <div className="rounded-2xl border bg-card p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconNotes size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">Notiz</p>
                  <p className="text-sm font-semibold truncate">{notizTitel}</p>
                  {notizDatum && (
                    <p className="text-xs text-muted-foreground">{notizDatum}</p>
                  )}
                </div>
              </div>

              {/* Dokument */}
              <div className="rounded-2xl border bg-card p-4 flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${dokumentId ? 'bg-primary/10' : 'bg-muted'}`}>
                  {dokumentId ? (
                    <IconFileText size={18} className="text-primary" />
                  ) : (
                    <IconLink size={18} className="text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">Dokument</p>
                  {dokumentId ? (
                    <>
                      <p className="text-sm font-semibold truncate">{dokumentenbezeichnung}</p>
                      {dokumentenlink && (
                        <a
                          href={dokumentenlink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary underline truncate block"
                        >
                          {dokumentenlink}
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{dokSkipped ? 'Übersprungen' : 'Kein Dokument'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={handleReset} variant="outline">
                Neuen Review starten
              </Button>
              <a href="#/">
                <Button>Zurück zum Dashboard</Button>
              </a>
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
    </IntentWizardShell>
  );
}
