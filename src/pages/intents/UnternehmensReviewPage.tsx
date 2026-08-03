/**
 * Unternehmens-Review — 5-Schritt-Wizard.
 * Steps: 1) Unternehmen wählen (nur aktive) → 2) Review-Termin anlegen →
 *        3) Meeting-Notiz erfassen → 4) Dokument hinzufügen (optional) → 5) Zusammenfassung.
 * Reads: unternehmen (gefiltert: status aktiv).
 * Writes: termine (createTermineEntry), notizen (createNotizenEntry),
 *         dokumente (createDokumenteEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  APP_IDS,
  LOOKUP_OPTIONS,
} from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { useDashboardData } from '@/hooks/useDashboardData';
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
import {
  IconBuilding,
  IconCalendarEvent,
  IconNote,
  IconFileText,
  IconCheck,
  IconArrowRight,
  IconChevronLeft,
  IconAlertCircle,
  IconLoader2,
} from '@tabler/icons-react';

const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];

export default function UnternehmensReviewPage() {
  const { unternehmen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);

  // Schritt 1: Unternehmen
  const [selectedUnternehmenId, setSelectedUnternehmenId] = useState<string | null>(null);

  // Schritt 2: Termin
  const [terminbezeichnung, setTerminbezeichnung] = useState('');
  const [terminart, setTerminart] = useState(TERMINART_OPTIONS[0]?.key ?? '');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [terminstatus, setTerminstatus] = useState(TERMINSTATUS_OPTIONS[0]?.key ?? '');
  const [notizenTermin, setNotizenTermin] = useState('');
  const [terminSubmitting, setTerminSubmitting] = useState(false);
  const [terminError, setTerminError] = useState<string | null>(null);
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);
  const [createdTerminBezeichnung, setCreatedTerminBezeichnung] = useState('');
  const [createdTerminDatum, setCreatedTerminDatum] = useState('');
  const [createdTerminArt, setCreatedTerminArt] = useState('');

  // Schritt 3: Notiz
  const [notizTitel, setNotizTitel] = useState('');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kategorieKey, setKategorieKey] = useState('meeting');
  const [prioritaetKey, setPrioritetKey] = useState(PRIORITAET_OPTIONS[0]?.key ?? '');
  const [schlagwoerter, setSchlagwoerter] = useState('');
  const [notizSubmitting, setNotizSubmitting] = useState(false);
  const [notizError, setNotizError] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);
  const [createdNotizTitel, setCreatedNotizTitel] = useState('');
  const [createdNotizPrioritaet, setCreatedNotizPrioritaet] = useState('');

  // Schritt 4: Dokument (optional)
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententypKey, setDokumententypKey] = useState('protokoll');
  const [dokumentendatum, setDokumentendatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [bereitgestelltVon, setBereitgestelltVon] = useState('');
  const [dokumentSubmitting, setDokumentSubmitting] = useState(false);
  const [dokumentError, setDokumentError] = useState<string | null>(null);
  const [createdDokumentId, setCreatedDokumentId] = useState<string | null>(null);
  const [createdDokumentBezeichnung, setCreatedDokumentBezeichnung] = useState('');

  const selectedUnternehmen = selectedUnternehmenId
    ? Object.values(unternehmen).find(u => u.record_id === selectedUnternehmenId)
    : null;

  const activeUnternehmen = Object.values(unternehmen).filter(
    u => u.fields.status?.key === 'aktiv'
  );

  // Helpers
  function handleSelectUnternehmen(id: string) {
    const u = Object.values(unternehmen).find(x => x.record_id === id);
    setSelectedUnternehmenId(id);
    const name = u?.fields.name ?? '';
    setTerminbezeichnung(`Review – ${name}`);
    setNotizTitel(`Review-Notiz – ${name}`);
    setStep(2);
  }

  function handleResetWizard() {
    setStep(1);
    setSelectedUnternehmenId(null);
    setTerminbezeichnung('');
    setTerminart(TERMINART_OPTIONS[0]?.key ?? '');
    setDatumUhrzeit('');
    setOrt('');
    setTerminstatus(TERMINSTATUS_OPTIONS[0]?.key ?? '');
    setNotizenTermin('');
    setTerminSubmitting(false);
    setTerminError(null);
    setCreatedTerminId(null);
    setCreatedTerminBezeichnung('');
    setCreatedTerminDatum('');
    setCreatedTerminArt('');
    setNotizTitel('');
    setNotizInhalt('');
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    setKategorieKey('meeting');
    setPrioritetKey(PRIORITAET_OPTIONS[0]?.key ?? '');
    setSchlagwoerter('');
    setNotizSubmitting(false);
    setNotizError(null);
    setCreatedNotizId(null);
    setCreatedNotizTitel('');
    setCreatedNotizPrioritaet('');
    setDokumentenbezeichnung('');
    setDokumententypKey('protokoll');
    setDokumentendatum(format(new Date(), 'yyyy-MM-dd'));
    setDokumentenlink('');
    setBereitgestelltVon('');
    setDokumentSubmitting(false);
    setDokumentError(null);
    setCreatedDokumentId(null);
    setCreatedDokumentBezeichnung('');
  }

  async function handleTerminSpeichern() {
    if (!selectedUnternehmenId || !terminbezeichnung || !datumUhrzeit) return;
    // Idempotency: skip create if already done
    let tid = createdTerminId;
    if (!tid) {
      setTerminSubmitting(true);
      setTerminError(null);
      try {
        const result = await LivingAppsService.createTermineEntry({
          terminbezeichnung,
          terminart: terminart || undefined,
          datum_uhrzeit: datumUhrzeit,
          ort: ort || undefined,
          terminstatus: terminstatus || undefined,
          notizen_termin: notizenTermin || undefined,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
        });
        tid = result.record_id;
        setCreatedTerminId(tid);
        setCreatedTerminBezeichnung(terminbezeichnung);
        setCreatedTerminDatum(datumUhrzeit);
        setCreatedTerminArt(TERMINART_OPTIONS.find(o => o.key === terminart)?.label ?? terminart);
        await fetchAll();
      } catch (e) {
        setTerminError(e instanceof Error ? e.message : 'Unbekannter Fehler');
        setTerminSubmitting(false);
        return;
      }
      setTerminSubmitting(false);
    }
    setStep(3);
  }

  async function handleNotizSpeichern() {
    if (!selectedUnternehmenId || !notizTitel) return;
    let nid = createdNotizId;
    if (!nid) {
      setNotizSubmitting(true);
      setNotizError(null);
      try {
        const result = await LivingAppsService.createNotizenEntry({
          notiz_titel: notizTitel,
          notiz_inhalt: notizInhalt || undefined,
          notiz_datum: notizDatum || undefined,
          kategorie: kategorieKey || undefined,
          prioritaet: prioritaetKey || undefined,
          schlagwoerter: schlagwoerter || undefined,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
        });
        nid = result.record_id;
        setCreatedNotizId(nid);
        setCreatedNotizTitel(notizTitel);
        setCreatedNotizPrioritaet(PRIORITAET_OPTIONS.find(o => o.key === prioritaetKey)?.label ?? prioritaetKey);
        await fetchAll();
      } catch (e) {
        setNotizError(e instanceof Error ? e.message : 'Unbekannter Fehler');
        setNotizSubmitting(false);
        return;
      }
      setNotizSubmitting(false);
    }
    setStep(4);
  }

  async function handleDokumentSpeichern() {
    if (!selectedUnternehmenId || !dokumentenbezeichnung) return;
    let did = createdDokumentId;
    if (!did) {
      setDokumentSubmitting(true);
      setDokumentError(null);
      try {
        const result = await LivingAppsService.createDokumenteEntry({
          dokumentenbezeichnung,
          dokumententyp: dokumententypKey || undefined,
          dokumentendatum: dokumentendatum || undefined,
          dokumentenlink: dokumentenlink || undefined,
          bereitgestellt_von: bereitgestelltVon || undefined,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
        });
        did = result.record_id;
        setCreatedDokumentId(did);
        setCreatedDokumentBezeichnung(dokumentenbezeichnung);
        await fetchAll();
      } catch (e) {
        setDokumentError(e instanceof Error ? e.message : 'Unbekannter Fehler');
        setDokumentSubmitting(false);
        return;
      }
      setDokumentSubmitting(false);
    }
    setStep(5);
  }

  // Context banner (shown from step 2 onward)
  const contextBanner = selectedUnternehmen && step > 1 ? (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 mb-4">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <IconBuilding size={16} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{selectedUnternehmen.fields.name}</p>
        <p className="text-xs text-muted-foreground">
          {selectedUnternehmen.fields.branche?.label ?? ''}
          {selectedUnternehmen.fields.beteiligungsquote != null
            ? ` · ${selectedUnternehmen.fields.beteiligungsquote} % Beteiligung`
            : ''}
        </p>
      </div>
      <StatusBadge statusKey={selectedUnternehmen.fields.status?.key} label={selectedUnternehmen.fields.status?.label} />
    </div>
  ) : null;

  return (
    <IntentWizardShell
      title="Unternehmens-Review"
      subtitle="Termin anlegen, Notiz erfassen und Dokument hinzufügen"
      steps={[
        { label: 'Unternehmen' },
        { label: 'Termin' },
        { label: 'Notiz' },
        { label: 'Dokument' },
        { label: 'Fertig' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ─── Schritt 1: Unternehmen wählen ─── */}
      {step === 1 && (
        <EntitySelectStep
          items={activeUnternehmen.map(u => ({
            id: u.record_id,
            title: u.fields.name ?? '(Kein Name)',
            subtitle: [
              u.fields.branche?.label,
              u.fields.stadt,
              u.fields.beteiligungsquote != null ? `${u.fields.beteiligungsquote} % Beteiligung` : undefined,
            ].filter(Boolean).join(' · '),
            status: u.fields.status
              ? { key: u.fields.status.key, label: u.fields.status.label }
              : undefined,
            icon: <IconBuilding size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectUnternehmen}
          searchPlaceholder="Unternehmen suchen..."
          emptyText="Keine aktiven Unternehmen gefunden."
          emptyIcon={<IconBuilding size={32} />}
        />
      )}

      {/* ─── Schritt 2: Review-Termin anlegen ─── */}
      {step === 2 && (
        <div className="space-y-4">
          {contextBanner}
          {!selectedUnternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <IconCalendarEvent size={18} className="text-primary" />
                <h2 className="text-base font-semibold">Review-Termin anlegen</h2>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Terminbezeichnung *</label>
                  <Input
                    value={terminbezeichnung}
                    onChange={e => setTerminbezeichnung(e.target.value)}
                    placeholder="z.B. Review – Musterfirma GmbH"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Terminart *</label>
                    <Select value={terminart} onValueChange={setTerminart}>
                      <SelectTrigger>
                        <SelectValue placeholder="Terminart wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {TERMINART_OPTIONS.map(o => (
                          <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={terminstatus} onValueChange={setTerminstatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {TERMINSTATUS_OPTIONS.map(o => (
                          <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Datum & Uhrzeit *</label>
                  <Input
                    type="datetime-local"
                    value={datumUhrzeit}
                    onChange={e => setDatumUhrzeit(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Ort</label>
                  <Input
                    value={ort}
                    onChange={e => setOrt(e.target.value)}
                    placeholder="z.B. Büro München, Online"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Notizen zum Termin</label>
                  <Textarea
                    value={notizenTermin}
                    onChange={e => setNotizenTermin(e.target.value)}
                    placeholder="Agenda, Themen, Vorbereitung..."
                    rows={3}
                  />
                </div>
              </div>

              {terminError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  <IconAlertCircle size={15} />
                  {terminError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5">
                  <IconChevronLeft size={15} />
                  Zurück
                </Button>
                <Button
                  className="flex-1 gap-1.5"
                  disabled={!terminbezeichnung || !datumUhrzeit || terminSubmitting}
                  onClick={handleTerminSpeichern}
                >
                  {terminSubmitting ? (
                    <IconLoader2 size={15} className="animate-spin" />
                  ) : (
                    <IconArrowRight size={15} />
                  )}
                  Termin speichern & weiter
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Schritt 3: Meeting-Notiz erfassen ─── */}
      {step === 3 && (
        <div className="space-y-4">
          {contextBanner}
          {!selectedUnternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <IconNote size={18} className="text-primary" />
                <h2 className="text-base font-semibold">Meeting-Notiz erfassen</h2>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Titel *</label>
                  <Input
                    value={notizTitel}
                    onChange={e => setNotizTitel(e.target.value)}
                    placeholder="z.B. Review-Notiz – Musterfirma GmbH"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Inhalt *</label>
                  <Textarea
                    value={notizInhalt}
                    onChange={e => setNotizInhalt(e.target.value)}
                    placeholder="Ergebnisse, Beschlüsse, nächste Schritte..."
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Datum</label>
                    <Input
                      type="date"
                      value={notizDatum}
                      onChange={e => setNotizDatum(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Kategorie</label>
                    <Select value={kategorieKey} onValueChange={setKategorieKey}>
                      <SelectTrigger>
                        <SelectValue placeholder="Kategorie wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {KATEGORIE_OPTIONS.map(o => (
                          <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Priorität</label>
                  <div className="flex gap-2 flex-wrap">
                    {PRIORITAET_OPTIONS.map(o => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setPrioritetKey(o.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          prioritaetKey === o.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border text-foreground hover:bg-accent'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Schlagwörter</label>
                  <Input
                    value={schlagwoerter}
                    onChange={e => setSchlagwoerter(e.target.value)}
                    placeholder="z.B. Q3, Budget, Strategie"
                  />
                </div>
              </div>

              {notizError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  <IconAlertCircle size={15} />
                  {notizError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5">
                  <IconChevronLeft size={15} />
                  Zurück
                </Button>
                <Button
                  className="flex-1 gap-1.5"
                  disabled={!notizTitel || notizSubmitting}
                  onClick={handleNotizSpeichern}
                >
                  {notizSubmitting ? (
                    <IconLoader2 size={15} className="animate-spin" />
                  ) : (
                    <IconArrowRight size={15} />
                  )}
                  Notiz speichern & weiter
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Schritt 4: Dokument hinzufügen (optional) ─── */}
      {step === 4 && (
        <div className="space-y-4">
          {contextBanner}
          {!selectedUnternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <IconFileText size={18} className="text-primary" />
                  <h2 className="text-base font-semibold">Dokument hinzufügen</h2>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Optional</span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Dokumentenbezeichnung *</label>
                  <Input
                    value={dokumentenbezeichnung}
                    onChange={e => setDokumentenbezeichnung(e.target.value)}
                    placeholder="z.B. Review-Protokoll Q3 2026"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Dokumententyp</label>
                    <Select value={dokumententypKey} onValueChange={setDokumententypKey}>
                      <SelectTrigger>
                        <SelectValue placeholder="Typ wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOKUMENTENTYP_OPTIONS.map(o => (
                          <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Dokumentendatum</label>
                    <Input
                      type="date"
                      value={dokumentendatum}
                      onChange={e => setDokumentendatum(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Dokumentenlink (URL)</label>
                  <Input
                    type="url"
                    value={dokumentenlink}
                    onChange={e => setDokumentenlink(e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Bereitgestellt von</label>
                  <Input
                    value={bereitgestelltVon}
                    onChange={e => setBereitgestelltVon(e.target.value)}
                    placeholder="z.B. Max Mustermann"
                  />
                </div>
              </div>

              {dokumentError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  <IconAlertCircle size={15} />
                  {dokumentError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep(3)} className="gap-1.5">
                  <IconChevronLeft size={15} />
                  Zurück
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep(5)}
                  className="gap-1.5"
                >
                  Überspringen
                </Button>
                <Button
                  className="flex-1 gap-1.5"
                  disabled={!dokumentenbezeichnung || dokumentSubmitting}
                  onClick={handleDokumentSpeichern}
                >
                  {dokumentSubmitting ? (
                    <IconLoader2 size={15} className="animate-spin" />
                  ) : (
                    <IconArrowRight size={15} />
                  )}
                  Dokument speichern & weiter
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Schritt 5: Zusammenfassung ─── */}
      {step === 5 && (
        <div className="space-y-4">
          {!selectedUnternehmenId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          ) : (
            <>
              {/* Success Header */}
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <IconCheck size={28} className="text-primary" stroke={2.5} />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-bold">Review abgeschlossen!</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Alle Daten wurden erfolgreich gespeichert.
                  </p>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="space-y-3">
                {/* Unternehmen */}
                {selectedUnternehmen && (
                  <div className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <IconBuilding size={16} className="text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unternehmen</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-semibold">{selectedUnternehmen.fields.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedUnternehmen.fields.branche?.label ?? ''}
                          {selectedUnternehmen.fields.beteiligungsquote != null
                            ? ` · ${selectedUnternehmen.fields.beteiligungsquote} % Beteiligung`
                            : ''}
                        </p>
                      </div>
                      <StatusBadge statusKey={selectedUnternehmen.fields.status?.key} label={selectedUnternehmen.fields.status?.label} />
                    </div>
                  </div>
                )}

                {/* Termin */}
                {createdTerminId && (
                  <div className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <IconCalendarEvent size={16} className="text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Termin angelegt</span>
                    </div>
                    <p className="font-semibold">{createdTerminBezeichnung}</p>
                    <div className="flex gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                      {createdTerminDatum && (
                        <span>Datum: <span className="text-foreground font-medium">{createdTerminDatum.replace('T', ' ').slice(0, 16)}</span></span>
                      )}
                      {createdTerminArt && (
                        <span>Art: <span className="text-foreground font-medium">{createdTerminArt}</span></span>
                      )}
                    </div>
                  </div>
                )}

                {/* Notiz */}
                {createdNotizId && (
                  <div className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <IconNote size={16} className="text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notiz angelegt</span>
                    </div>
                    <p className="font-semibold">{createdNotizTitel}</p>
                    {createdNotizPrioritaet && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Priorität: <span className="text-foreground font-medium">{createdNotizPrioritaet}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Dokument */}
                {createdDokumentId && (
                  <div className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <IconFileText size={16} className="text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dokument angelegt</span>
                    </div>
                    <p className="font-semibold">{createdDokumentBezeichnung}</p>
                  </div>
                )}

                {!createdDokumentId && (
                  <div className="rounded-xl border border-dashed bg-card/50 p-4 text-center">
                    <p className="text-sm text-muted-foreground">Kein Dokument hinzugefügt.</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleResetWizard}
                >
                  Neuen Review anlegen
                </Button>
                <a href="#/" className="flex-1">
                  <Button className="w-full gap-1.5">
                    Zurück zum Dashboard
                  </Button>
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
