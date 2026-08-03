/**
 * Meeting-Vorbereitung — 5-Schritt-Wizard.
 * Steps: 1) Unternehmen wählen → 2) Termin anlegen → 3) Vorbereitungsnotiz schreiben (optional)
 *        → 4) Dokument verknüpfen (optional) → 5) Zusammenfassung.
 * Reads: unternehmen. Writes: termine (createTermineEntry), notizen (createNotizenEntry),
 *        dokumente (createDokumenteEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  IconBuilding,
  IconCalendarEvent,
  IconFileText,
  IconPaperclip,
  IconCheck,
  IconChevronRight,
  IconAlertCircle,
  IconRefresh,
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

const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const WIEDERHOLUNG_OPTIONS = LOOKUP_OPTIONS['termine']?.['wiederholung'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];

export default function MeetingVorbereitungPage() {
  const { unternehmen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);

  // Step 1
  const [selectedUnternehmenId, setSelectedUnternehmenId] = useState<string | null>(null);

  // Step 2 — Termin
  const [terminbezeichnung, setTerminbezeichnung] = useState('');
  const [terminart, setTerminart] = useState(TERMINART_OPTIONS[0]?.key ?? '');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [wiederholung, setWiederholung] = useState('none');
  const [erinnerungTage, setErinnerungTage] = useState('');
  const [terminstatus, setTerminstatus] = useState('geplant');
  const [notizenTermin, setNotizenTermin] = useState('');
  const [terminSubmitting, setTerminSubmitting] = useState(false);
  const [terminError, setTerminError] = useState<string | null>(null);
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);

  // Step 3 — Notiz (optional)
  const [notizTitel, setNotizTitel] = useState('');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notizKategorie, setNotizKategorie] = useState('meeting');
  const [notizPrioritaet, setNotizPrioritaet] = useState('mittel');
  const [notizSubmitting, setNotizSubmitting] = useState(false);
  const [notizError, setNotizError] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);
  const [notizSkipped, setNotizSkipped] = useState(false);

  // Step 4 — Dokument (optional)
  const [dokumentBezeichnung, setDokumentBezeichnung] = useState('');
  const [dokumentTyp, setDokumentTyp] = useState('praesentation');
  const [dokumentDatum, setDokumentDatum] = useState('');
  const [dokumentLink, setDokumentLink] = useState('');
  const [bereitgestelltVon, setBereitgestelltVon] = useState('');
  const [dokumentSubmitting, setDokumentSubmitting] = useState(false);
  const [dokumentError, setDokumentError] = useState<string | null>(null);
  const [createdDokumentId, setCreatedDokumentId] = useState<string | null>(null);
  const [dokumentSkipped, setDokumentSkipped] = useState(false);

  const selectedUnternehmen: Unternehmen | null = selectedUnternehmenId
    ? (Object.values(unternehmen).find((u) => u.record_id === selectedUnternehmenId) ?? null)
    : null;

  const aktiveUnternehmen = Object.values(unternehmen).filter(
    (u) => u.fields.status?.key === 'aktiv'
  );

  const handleSelectUnternehmen = (id: string) => {
    setSelectedUnternehmenId(id);
    setStep(2);
  };

  const handleCreateTermin = async () => {
    if (!selectedUnternehmenId || !terminbezeichnung || !datumUhrzeit || !terminart) return;
    setTerminSubmitting(true);
    setTerminError(null);
    try {
      let tid = createdTerminId;
      if (!tid) {
        const result = await LivingAppsService.createTermineEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          terminbezeichnung,
          terminart,
          datum_uhrzeit: datumUhrzeit,
          ort: ort || undefined,
          wiederholung: wiederholung !== 'none' ? wiederholung : undefined,
          erinnerung_tage: erinnerungTage ? Number(erinnerungTage) : undefined,
          terminstatus,
          notizen_termin: notizenTermin || undefined,
        });
        tid = result.record_id;
        setCreatedTerminId(tid);
      }
      setNotizTitel('Vorbereitung: ' + terminbezeichnung);
      setDokumentBezeichnung('Unterlagen: ' + terminbezeichnung);
      setStep(3);
    } catch (e) {
      setTerminError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Termins.');
    } finally {
      setTerminSubmitting(false);
    }
  };

  const handleCreateNotiz = async () => {
    if (!selectedUnternehmenId || !notizTitel) return;
    setNotizSubmitting(true);
    setNotizError(null);
    try {
      let nid = createdNotizId;
      if (!nid) {
        const result = await LivingAppsService.createNotizenEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          notiz_titel: notizTitel,
          notiz_inhalt: notizInhalt || undefined,
          notiz_datum: notizDatum,
          kategorie: notizKategorie,
          prioritaet: notizPrioritaet,
        });
        nid = result.record_id;
        setCreatedNotizId(nid);
      }
      setStep(4);
    } catch (e) {
      setNotizError(e instanceof Error ? e.message : 'Fehler beim Anlegen der Notiz.');
    } finally {
      setNotizSubmitting(false);
    }
  };

  const handleSkipNotiz = () => {
    setNotizSkipped(true);
    setStep(4);
  };

  const handleCreateDokument = async () => {
    if (!selectedUnternehmenId || !dokumentBezeichnung) return;
    setDokumentSubmitting(true);
    setDokumentError(null);
    try {
      let did = createdDokumentId;
      if (!did) {
        const result = await LivingAppsService.createDokumenteEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          dokumentenbezeichnung: dokumentBezeichnung,
          dokumententyp: dokumentTyp,
          dokumentendatum: dokumentDatum || undefined,
          dokumentenlink: dokumentLink || undefined,
          bereitgestellt_von: bereitgestelltVon || undefined,
        });
        did = result.record_id;
        setCreatedDokumentId(did);
      }
      setStep(5);
    } catch (e) {
      setDokumentError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Dokuments.');
    } finally {
      setDokumentSubmitting(false);
    }
  };

  const handleSkipDokument = () => {
    setDokumentSkipped(true);
    setStep(5);
  };

  const handleReset = () => {
    setSelectedUnternehmenId(null);
    setTerminbezeichnung('');
    setTerminart(TERMINART_OPTIONS[0]?.key ?? '');
    setDatumUhrzeit('');
    setOrt('');
    setWiederholung('none');
    setErinnerungTage('');
    setTerminstatus('geplant');
    setNotizenTermin('');
    setTerminSubmitting(false);
    setTerminError(null);
    setCreatedTerminId(null);
    setNotizTitel('');
    setNotizInhalt('');
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    setNotizKategorie('meeting');
    setNotizPrioritaet('mittel');
    setNotizSubmitting(false);
    setNotizError(null);
    setCreatedNotizId(null);
    setNotizSkipped(false);
    setDokumentBezeichnung('');
    setDokumentTyp('praesentation');
    setDokumentDatum('');
    setDokumentLink('');
    setBereitgestelltVon('');
    setDokumentSubmitting(false);
    setDokumentError(null);
    setCreatedDokumentId(null);
    setDokumentSkipped(false);
    setStep(1);
  };

  const unternehmenName = selectedUnternehmen?.fields.name ?? '';

  const formatDisplayDate = (val: string) => {
    if (!val) return '';
    try {
      return format(new Date(val), 'dd.MM.yyyy HH:mm', { locale: de });
    } catch {
      return val;
    }
  };

  const formatDisplayDateOnly = (val: string) => {
    if (!val) return '';
    try {
      return format(new Date(val), 'dd.MM.yyyy', { locale: de });
    } catch {
      return val;
    }
  };

  return (
    <IntentWizardShell
      title="Meeting vorbereiten"
      subtitle="Termin, Notiz und Unterlagen in einem Ablauf anlegen"
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
      {/* Step 1: Unternehmen wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={aktiveUnternehmen.map((u) => ({
            id: u.record_id,
            title: u.fields.name ?? '(Kein Name)',
            subtitle: [
              u.fields.branche?.label,
              u.fields.ansprechpartner_vorname && u.fields.ansprechpartner_nachname
                ? `${u.fields.ansprechpartner_vorname} ${u.fields.ansprechpartner_nachname}`
                : u.fields.ansprechpartner_vorname ?? u.fields.ansprechpartner_nachname,
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

      {/* Step 2: Termin anlegen */}
      {step === 2 && (
        selectedUnternehmenId ? (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
              <IconBuilding size={20} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Unternehmen</p>
                <p className="font-medium truncate">{unternehmenName}</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <IconCalendarEvent size={18} className="text-primary" />
                Termin anlegen
              </h2>

              <div className="space-y-2">
                <Label htmlFor="terminbezeichnung">Bezeichnung *</Label>
                <Input
                  id="terminbezeichnung"
                  value={terminbezeichnung}
                  onChange={(e) => setTerminbezeichnung(e.target.value)}
                  placeholder="z. B. Q3 Strategiemeeting"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="terminart">Terminart *</Label>
                  <Select value={terminart} onValueChange={setTerminart}>
                    <SelectTrigger id="terminart">
                      <SelectValue placeholder="Bitte wählen" />
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
                    value={datumUhrzeit}
                    onChange={(e) => setDatumUhrzeit(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ort">Ort</Label>
                  <Input
                    id="ort"
                    value={ort}
                    onChange={(e) => setOrt(e.target.value)}
                    placeholder="z. B. Berlin, Online"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wiederholung">Wiederholung</Label>
                  <Select value={wiederholung} onValueChange={setWiederholung}>
                    <SelectTrigger id="wiederholung">
                      <SelectValue placeholder="Keine Wiederholung" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keine Wiederholung</SelectItem>
                      {WIEDERHOLUNG_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="erinnerung_tage">Erinnerung (Tage vorher)</Label>
                  <Input
                    id="erinnerung_tage"
                    type="number"
                    min="0"
                    value={erinnerungTage}
                    onChange={(e) => setErinnerungTage(e.target.value)}
                    placeholder="z. B. 3"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {TERMINSTATUS_OPTIONS.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setTerminstatus(o.key)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          terminstatus === o.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-foreground border-border hover:bg-secondary'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notizen_termin">Notizen zum Termin</Label>
                <Textarea
                  id="notizen_termin"
                  value={notizenTermin}
                  onChange={(e) => setNotizenTermin(e.target.value)}
                  placeholder="Interne Hinweise, Agenda-Punkte …"
                  rows={3}
                />
              </div>

              {terminError && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 text-destructive px-4 py-3 text-sm">
                  <IconAlertCircle size={16} className="shrink-0" />
                  {terminError}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleCreateTermin}
                  disabled={terminSubmitting || !terminbezeichnung || !datumUhrzeit || !terminart}
                >
                  {terminSubmitting ? (
                    <>
                      <IconRefresh size={16} className="mr-2 animate-spin" />
                      Wird angelegt …
                    </>
                  ) : (
                    <>
                      Termin anlegen
                      <IconChevronRight size={16} className="ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt benötigt ein ausgewähltes Unternehmen aus Schritt 1.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Neu starten
            </Button>
          </div>
        )
      )}

      {/* Step 3: Vorbereitungsnotiz (optional) */}
      {step === 3 && (
        selectedUnternehmenId ? (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
              <IconBuilding size={20} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Unternehmen · Termin</p>
                <p className="font-medium truncate">{unternehmenName} · {terminbezeichnung}</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <IconFileText size={18} className="text-primary" />
                  Vorbereitungsnotiz
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </h2>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notiz_titel">Titel *</Label>
                <Input
                  id="notiz_titel"
                  value={notizTitel}
                  onChange={(e) => setNotizTitel(e.target.value)}
                  placeholder="z. B. Vorbereitung: Q3 Strategiemeeting"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notiz_inhalt">Inhalt</Label>
                <Textarea
                  id="notiz_inhalt"
                  value={notizInhalt}
                  onChange={(e) => setNotizInhalt(e.target.value)}
                  placeholder="Agenda, offene Punkte, Fragen …"
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="notiz_datum">Datum</Label>
                  <Input
                    id="notiz_datum"
                    type="date"
                    value={notizDatum}
                    onChange={(e) => setNotizDatum(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notiz_kategorie">Kategorie</Label>
                  <Select value={notizKategorie} onValueChange={setNotizKategorie}>
                    <SelectTrigger id="notiz_kategorie">
                      <SelectValue />
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
                  <Label>Priorität</Label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {PRIORITAET_OPTIONS.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setNotizPrioritaet(o.key)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          notizPrioritaet === o.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-foreground border-border hover:bg-secondary'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {notizError && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 text-destructive px-4 py-3 text-sm">
                  <IconAlertCircle size={16} className="shrink-0" />
                  {notizError}
                </div>
              )}

              <div className="flex flex-wrap justify-between gap-3 pt-1">
                <Button variant="outline" onClick={handleSkipNotiz}>
                  Schritt überspringen
                </Button>
                <Button
                  onClick={handleCreateNotiz}
                  disabled={notizSubmitting || !notizTitel}
                >
                  {notizSubmitting ? (
                    <>
                      <IconRefresh size={16} className="mr-2 animate-spin" />
                      Wird angelegt …
                    </>
                  ) : (
                    <>
                      Notiz anlegen
                      <IconChevronRight size={16} className="ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt benötigt ein ausgewähltes Unternehmen aus Schritt 1.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Neu starten
            </Button>
          </div>
        )
      )}

      {/* Step 4: Dokument (optional) */}
      {step === 4 && (
        selectedUnternehmenId ? (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
              <IconBuilding size={20} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Unternehmen · Termin</p>
                <p className="font-medium truncate">{unternehmenName} · {terminbezeichnung}</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <IconPaperclip size={18} className="text-primary" />
                Dokument verknüpfen
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </h2>

              <div className="space-y-2">
                <Label htmlFor="dokument_bezeichnung">Bezeichnung *</Label>
                <Input
                  id="dokument_bezeichnung"
                  value={dokumentBezeichnung}
                  onChange={(e) => setDokumentBezeichnung(e.target.value)}
                  placeholder="z. B. Unterlagen: Q3 Strategiemeeting"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dokument_typ">Dokumententyp</Label>
                  <Select value={dokumentTyp} onValueChange={setDokumentTyp}>
                    <SelectTrigger id="dokument_typ">
                      <SelectValue />
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
                  <Label htmlFor="dokument_datum">Dokumentendatum</Label>
                  <Input
                    id="dokument_datum"
                    type="date"
                    value={dokumentDatum}
                    onChange={(e) => setDokumentDatum(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dokument_link">Link / URL</Label>
                <Input
                  id="dokument_link"
                  type="url"
                  value={dokumentLink}
                  onChange={(e) => setDokumentLink(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bereitgestellt_von">Bereitgestellt von</Label>
                <Input
                  id="bereitgestellt_von"
                  value={bereitgestelltVon}
                  onChange={(e) => setBereitgestelltVon(e.target.value)}
                  placeholder="Name oder Organisation"
                />
              </div>

              {dokumentError && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 text-destructive px-4 py-3 text-sm">
                  <IconAlertCircle size={16} className="shrink-0" />
                  {dokumentError}
                </div>
              )}

              <div className="flex flex-wrap justify-between gap-3 pt-1">
                <Button variant="outline" onClick={handleSkipDokument}>
                  Schritt überspringen
                </Button>
                <Button
                  onClick={handleCreateDokument}
                  disabled={dokumentSubmitting || !dokumentBezeichnung}
                >
                  {dokumentSubmitting ? (
                    <>
                      <IconRefresh size={16} className="mr-2 animate-spin" />
                      Wird angelegt …
                    </>
                  ) : (
                    <>
                      Dokument anlegen
                      <IconChevronRight size={16} className="ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt benötigt ein ausgewähltes Unternehmen aus Schritt 1.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Neu starten
            </Button>
          </div>
        )
      )}

      {/* Step 5: Zusammenfassung */}
      {step === 5 && (
        selectedUnternehmenId && createdTerminId ? (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <IconCheck size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-base">Meeting vorbereitet</h2>
                  <p className="text-sm text-muted-foreground">
                    Alle Schritte wurden erfolgreich abgeschlossen.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-border rounded-xl border overflow-hidden">
                <div className="flex items-start gap-3 p-4 bg-secondary/30">
                  <IconBuilding size={18} className="text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Unternehmen</p>
                    <p className="font-medium truncate">{unternehmenName}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4">
                  <IconCalendarEvent size={18} className="text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Termin angelegt</p>
                    <p className="font-medium truncate">{terminbezeichnung}</p>
                    {datumUhrzeit && (
                      <p className="text-sm text-muted-foreground">
                        {formatDisplayDate(datumUhrzeit)}
                        {ort ? ` · ${ort}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {!notizSkipped && createdNotizId && (
                  <div className="flex items-start gap-3 p-4">
                    <IconFileText size={18} className="text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Notiz angelegt</p>
                      <p className="font-medium truncate">{notizTitel}</p>
                      {notizDatum && (
                        <p className="text-sm text-muted-foreground">
                          {formatDisplayDateOnly(notizDatum)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {notizSkipped && (
                  <div className="flex items-start gap-3 p-4">
                    <IconFileText size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Notiz</p>
                      <p className="text-sm text-muted-foreground">Übersprungen</p>
                    </div>
                  </div>
                )}

                {!dokumentSkipped && createdDokumentId && (
                  <div className="flex items-start gap-3 p-4">
                    <IconPaperclip size={18} className="text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Dokument angelegt</p>
                      <p className="font-medium truncate">{dokumentBezeichnung}</p>
                    </div>
                  </div>
                )}

                {dokumentSkipped && (
                  <div className="flex items-start gap-3 p-4">
                    <IconPaperclip size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Dokument</p>
                      <p className="text-sm text-muted-foreground">Übersprungen</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              <Button variant="outline" onClick={handleReset}>
                Neues Meeting vorbereiten
              </Button>
              <a href="#/">
                <Button>Zurück zum Dashboard</Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Die vorherigen Schritte wurden noch nicht abgeschlossen.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Neu starten
            </Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
