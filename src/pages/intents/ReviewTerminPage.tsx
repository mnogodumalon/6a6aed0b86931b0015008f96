/**
 * Review-Termin vorbereiten — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen auswählen → 2) Termin anlegen → 3) Dokument hinzufügen (optional) → 4) Meeting-Notiz erfassen (optional).
 * Reads: unternehmen (gefiltert: status=aktiv). Writes: termine (createTermineEntry), dokumente (createDokumenteEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconBuilding,
  IconCalendarEvent,
  IconCheck,
  IconFileText,
  IconNotes,
  IconArrowRight,
  IconPlayerSkipForward,
} from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const WIEDERHOLUNG_OPTIONS = LOOKUP_OPTIONS['termine']?.['wiederholung'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

export default function ReviewTerminPage() {
  const { unternehmen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);

  // Step 1
  const [selectedUnternehmenId, setSelectedUnternehmenId] = useState<string | null>(null);
  const [selectedUnternehmenName, setSelectedUnternehmenName] = useState<string>('');

  // Step 2 — Termin
  const [terminbezeichnung, setTerminbezeichnung] = useState('Review-Meeting');
  const [terminart, setTerminart] = useState('strategiemeeting');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [wiederholungKey, setWiederholungKey] = useState('none');
  const [terminstatusKey, setTerminstatusKey] = useState('geplant');
  const [notizenTermin, setNotizenTermin] = useState('');
  const [terminSaving, setTerminSaving] = useState(false);
  const [terminError, setTerminError] = useState<string | null>(null);
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);
  const [createdTerminBezeichnung, setCreatedTerminBezeichnung] = useState('');
  const [createdTerminDatum, setCreatedTerminDatum] = useState('');

  // Step 3 — Dokument
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('Review-Unterlagen');
  const [dokumententypKey, setDokumententypKey] = useState('praesentation');
  const [dokumentendatum, setDokumentendatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [bereitgestelltVon, setBereitgestelltVon] = useState('');
  const [dokumentSaving, setDokumentSaving] = useState(false);
  const [dokumentError, setDokumentError] = useState<string | null>(null);
  const [createdDokumentId, setCreatedDokumentId] = useState<string | null>(null);
  const [dokumentSkipped, setDokumentSkipped] = useState(false);

  // Step 4 — Notiz
  const [notizTitel, setNotizTitel] = useState('Review-Notizen');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kategorieKey, setKategorieKey] = useState('meeting');
  const [prioritaetKey, setPrioritaetKey] = useState('mittel');
  const [notizSaving, setNotizSaving] = useState(false);
  const [notizError, setNotizError] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);
  const [notizSkipped, setNotizSkipped] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  const aktiveUnternehmen = unternehmen.filter(
    (u) => u.fields.status?.key === 'aktiv'
  );

  const handleUnternehmenSelect = (id: string) => {
    const u = unternehmen.find((u) => u.record_id === id);
    setSelectedUnternehmenId(id);
    setSelectedUnternehmenName(u?.fields.name ?? '');
    setStep(2);
  };

  const handleTerminSave = async () => {
    if (!selectedUnternehmenId) return;
    if (!datumUhrzeit) {
      setTerminError('Bitte Datum und Uhrzeit auswählen.');
      return;
    }

    let tid = createdTerminId;
    if (!tid) {
      setTerminSaving(true);
      setTerminError(null);
      try {
        const payload: Record<string, unknown> = {
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          terminbezeichnung,
          terminart,
          datum_uhrzeit: datumUhrzeit,
          terminstatus: terminstatusKey,
        };
        if (ort) payload.ort = ort;
        if (wiederholungKey !== 'none') payload.wiederholung = wiederholungKey;
        if (notizenTermin) payload.notizen_termin = notizenTermin;

        const result = await LivingAppsService.createTermineEntry(payload);
        tid = result.record_id;
        setCreatedTerminId(tid);
        setCreatedTerminBezeichnung(terminbezeichnung);
        setCreatedTerminDatum(datumUhrzeit);
        await fetchAll();
      } catch {
        setTerminError('Termin konnte nicht gespeichert werden. Bitte erneut versuchen.');
        return;
      } finally {
        setTerminSaving(false);
      }
    }
    setStep(3);
  };

  const handleDokumentSave = async () => {
    if (!selectedUnternehmenId) return;

    let did = createdDokumentId;
    if (!did) {
      setDokumentSaving(true);
      setDokumentError(null);
      try {
        const payload: Record<string, unknown> = {
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          dokumentenbezeichnung,
          dokumententyp: dokumententypKey,
          dokumentendatum,
        };
        if (dokumentenlink) payload.dokumentenlink = dokumentenlink;
        if (bereitgestelltVon) payload.bereitgestellt_von = bereitgestelltVon;

        const result = await LivingAppsService.createDokumenteEntry(payload);
        did = result.record_id;
        setCreatedDokumentId(did);
        await fetchAll();
      } catch {
        setDokumentError('Dokument konnte nicht gespeichert werden. Bitte erneut versuchen.');
        return;
      } finally {
        setDokumentSaving(false);
      }
    }
    setStep(4);
  };

  const handleDokumentSkip = () => {
    setDokumentSkipped(true);
    setStep(4);
  };

  const handleNotizSave = async () => {
    if (!selectedUnternehmenId) return;
    if (!notizInhalt.trim()) {
      setNotizError('Bitte einen Notizinhalt eingeben.');
      return;
    }

    let nid = createdNotizId;
    if (!nid) {
      setNotizSaving(true);
      setNotizError(null);
      try {
        const result = await LivingAppsService.createNotizenEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          notiz_titel: notizTitel,
          notiz_inhalt: notizInhalt,
          notiz_datum: notizDatum,
          kategorie: kategorieKey,
          prioritaet: prioritaetKey,
        });
        nid = result.record_id;
        setCreatedNotizId(nid);
        await fetchAll();
      } catch {
        setNotizError('Notiz konnte nicht gespeichert werden. Bitte erneut versuchen.');
        return;
      } finally {
        setNotizSaving(false);
      }
    }
    setStep(5);
  };

  const handleNotizSkip = () => {
    setNotizSkipped(true);
    setStep(5);
  };

  const handleReset = () => {
    setStep(1);
    setSelectedUnternehmenId(null);
    setSelectedUnternehmenName('');
    setTerminbezeichnung('Review-Meeting');
    setTerminart('strategiemeeting');
    setDatumUhrzeit('');
    setOrt('');
    setWiederholungKey('none');
    setTerminstatusKey('geplant');
    setNotizenTermin('');
    setTerminError(null);
    setCreatedTerminId(null);
    setCreatedTerminBezeichnung('');
    setCreatedTerminDatum('');
    setDokumentenbezeichnung('Review-Unterlagen');
    setDokumententypKey('praesentation');
    setDokumentendatum(format(new Date(), 'yyyy-MM-dd'));
    setDokumentenlink('');
    setBereitgestelltVon('');
    setDokumentError(null);
    setCreatedDokumentId(null);
    setDokumentSkipped(false);
    setNotizTitel('Review-Notizen');
    setNotizInhalt('');
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    setKategorieKey('meeting');
    setPrioritaetKey('mittel');
    setNotizError(null);
    setCreatedNotizId(null);
    setNotizSkipped(false);
  };

  return (
    <IntentWizardShell
      title="Review-Termin vorbereiten"
      subtitle="Termin, Dokument und Notiz in einem Ablauf anlegen"
      steps={[
        { label: 'Unternehmen' },
        { label: 'Termin' },
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
      {/* Step 1: Unternehmen auswählen */}
      {step === 1 && (
        <EntitySelectStep
          items={aktiveUnternehmen.map((u) => ({
            id: u.record_id,
            title: u.fields.name ?? '(Ohne Name)',
            subtitle: [u.fields.branche?.label, u.fields.stadt].filter(Boolean).join(' · '),
            status: u.fields.status
              ? { key: u.fields.status.key, label: u.fields.status.label }
              : undefined,
            icon: <IconBuilding size={20} className="text-primary" />,
          }))}
          onSelect={handleUnternehmenSelect}
          searchPlaceholder="Unternehmen suchen …"
          emptyText="Keine aktiven Unternehmen gefunden."
        />
      )}

      {/* Step 2: Termin anlegen */}
      {step === 2 && (
        selectedUnternehmenId ? (
          <div className="space-y-5">
            <div className="rounded-2xl bg-secondary/50 border px-4 py-3 flex items-center gap-3">
              <IconBuilding size={18} className="text-primary shrink-0" />
              <span className="font-medium text-sm truncate">{selectedUnternehmenName}</span>
            </div>

            <div className="rounded-2xl border p-5 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <IconCalendarEvent size={18} className="text-primary" />
                Termin anlegen
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Bezeichnung *</label>
                  <Input
                    value={terminbezeichnung}
                    onChange={(e) => setTerminbezeichnung(e.target.value)}
                    placeholder="Terminbezeichnung"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Terminart *</label>
                  <Select value={terminart} onValueChange={setTerminart}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMINART_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Datum & Uhrzeit *</label>
                  <Input
                    type="datetime-local"
                    value={datumUhrzeit}
                    onChange={(e) => setDatumUhrzeit(e.target.value)}
                    min={`${today}T00:00`}
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Ort</label>
                  <Input
                    value={ort}
                    onChange={(e) => setOrt(e.target.value)}
                    placeholder="z.B. Büro, Online, Adresse …"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Wiederholung</label>
                  <Select value={wiederholungKey} onValueChange={setWiederholungKey}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keine Wiederholung</SelectItem>
                      {WIEDERHOLUNG_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {TERMINSTATUS_OPTIONS.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setTerminstatusKey(o.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          terminstatusKey === o.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border hover:bg-secondary'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Notizen</label>
                  <Textarea
                    value={notizenTermin}
                    onChange={(e) => setNotizenTermin(e.target.value)}
                    placeholder="Agenda, Themen, Anmerkungen …"
                    rows={3}
                  />
                </div>
              </div>

              {terminError && (
                <p className="text-sm text-destructive">{terminError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  onClick={handleTerminSave}
                  disabled={terminSaving || !terminbezeichnung || !datumUhrzeit}
                  className="flex-1"
                >
                  {terminSaving ? 'Wird gespeichert …' : 'Termin anlegen'}
                  {!terminSaving && <IconArrowRight size={16} className="ml-1" />}
                </Button>
                <Button variant="outline" onClick={() => setStep(1)}>
                  Zurück
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* Step 3: Dokument hinzufügen (optional) */}
      {step === 3 && (
        selectedUnternehmenId ? (
          <div className="space-y-5">
            <div className="rounded-2xl bg-secondary/50 border px-4 py-3 flex items-center gap-3">
              <IconBuilding size={18} className="text-primary shrink-0" />
              <span className="font-medium text-sm truncate">{selectedUnternehmenName}</span>
              {createdTerminBezeichnung && (
                <span className="text-sm text-muted-foreground truncate">· {createdTerminBezeichnung}</span>
              )}
            </div>

            <div className="rounded-2xl border p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold flex items-center gap-2">
                  <IconFileText size={18} className="text-primary" />
                  Dokument hinzufügen
                </h2>
                <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5 shrink-0">Optional</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Bezeichnung *</label>
                  <Input
                    value={dokumentenbezeichnung}
                    onChange={(e) => setDokumentenbezeichnung(e.target.value)}
                    placeholder="Dokumentenbezeichnung"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Dokumententyp</label>
                  <Select value={dokumententypKey} onValueChange={setDokumententypKey}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOKUMENTENTYP_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Dokumentendatum</label>
                  <Input
                    type="date"
                    value={dokumentendatum}
                    onChange={(e) => setDokumentendatum(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Link / URL</label>
                  <Input
                    type="url"
                    value={dokumentenlink}
                    onChange={(e) => setDokumentenlink(e.target.value)}
                    placeholder="https://…"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Bereitgestellt von</label>
                  <Input
                    value={bereitgestelltVon}
                    onChange={(e) => setBereitgestelltVon(e.target.value)}
                    placeholder="Name oder Team"
                  />
                </div>
              </div>

              {dokumentError && (
                <p className="text-sm text-destructive">{dokumentError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  onClick={handleDokumentSave}
                  disabled={dokumentSaving || !dokumentenbezeichnung}
                  className="flex-1"
                >
                  {dokumentSaving ? 'Wird gespeichert …' : 'Dokument anlegen'}
                  {!dokumentSaving && <IconArrowRight size={16} className="ml-1" />}
                </Button>
                <Button variant="outline" onClick={handleDokumentSkip}>
                  <IconPlayerSkipForward size={16} className="mr-1" />
                  Überspringen
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* Step 4: Meeting-Notiz erfassen (optional) */}
      {step === 4 && (
        selectedUnternehmenId ? (
          <div className="space-y-5">
            <div className="rounded-2xl bg-secondary/50 border px-4 py-3 flex items-center gap-3">
              <IconBuilding size={18} className="text-primary shrink-0" />
              <span className="font-medium text-sm truncate">{selectedUnternehmenName}</span>
              {createdTerminBezeichnung && (
                <span className="text-sm text-muted-foreground truncate">· {createdTerminBezeichnung}</span>
              )}
            </div>

            <div className="rounded-2xl border p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold flex items-center gap-2">
                  <IconNotes size={18} className="text-primary" />
                  Meeting-Notiz erfassen
                </h2>
                <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5 shrink-0">Optional</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Titel *</label>
                  <Input
                    value={notizTitel}
                    onChange={(e) => setNotizTitel(e.target.value)}
                    placeholder="Notiz-Titel"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Inhalt *</label>
                  <Textarea
                    value={notizInhalt}
                    onChange={(e) => setNotizInhalt(e.target.value)}
                    placeholder="Ergebnisse, Beschlüsse, To-dos …"
                    rows={5}
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Datum</label>
                  <Input
                    type="date"
                    value={notizDatum}
                    onChange={(e) => setNotizDatum(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Kategorie</label>
                  <Select value={kategorieKey} onValueChange={setKategorieKey}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KATEGORIE_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Priorität</label>
                  <div className="flex flex-wrap gap-2">
                    {PRIORITAET_OPTIONS.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setPrioritaetKey(o.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          prioritaetKey === o.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border hover:bg-secondary'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {notizError && (
                <p className="text-sm text-destructive">{notizError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  onClick={handleNotizSave}
                  disabled={notizSaving || !notizTitel || !notizInhalt.trim()}
                  className="flex-1"
                >
                  {notizSaving ? 'Wird gespeichert …' : 'Notiz anlegen'}
                  {!notizSaving && <IconArrowRight size={16} className="ml-1" />}
                </Button>
                <Button variant="outline" onClick={handleNotizSkip}>
                  <IconPlayerSkipForward size={16} className="mr-1" />
                  Überspringen
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* Step 5: Abschluss-Summary */}
      {step === 5 && (
        <div className="space-y-5">
          <div className="rounded-2xl border p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <IconCheck size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Review-Termin vorbereitet!</h2>
                <p className="text-sm text-muted-foreground">Alle Schritte abgeschlossen.</p>
              </div>
            </div>

            <div className="rounded-xl bg-secondary/50 divide-y divide-border overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <IconBuilding size={16} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Unternehmen</p>
                  <p className="font-medium text-sm truncate">{selectedUnternehmenName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-3">
                <IconCalendarEvent size={16} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Termin</p>
                  <p className="font-medium text-sm truncate">{createdTerminBezeichnung}</p>
                  {createdTerminDatum && (
                    <p className="text-xs text-muted-foreground">{createdTerminDatum.replace('T', ' ')}</p>
                  )}
                </div>
                <IconCheck size={16} className="text-primary ml-auto shrink-0" />
              </div>

              <div className="flex items-center gap-3 px-4 py-3">
                <IconFileText size={16} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Dokument</p>
                  <p className="text-sm truncate">
                    {createdDokumentId ? dokumentenbezeichnung : (dokumentSkipped ? 'Übersprungen' : '—')}
                  </p>
                </div>
                {createdDokumentId && <IconCheck size={16} className="text-primary ml-auto shrink-0" />}
              </div>

              <div className="flex items-center gap-3 px-4 py-3">
                <IconNotes size={16} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Notiz</p>
                  <p className="text-sm truncate">
                    {createdNotizId ? notizTitel : (notizSkipped ? 'Übersprungen' : '—')}
                  </p>
                </div>
                {createdNotizId && <IconCheck size={16} className="text-primary ml-auto shrink-0" />}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleReset} variant="outline" className="flex-1">
              Neuen Review-Termin anlegen
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
