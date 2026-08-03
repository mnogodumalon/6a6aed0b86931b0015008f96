/**
 * Meeting Nachbereitung — 4-Schritt-Wizard.
 * Steps: 1) Termin auswählen (nur 'geplant') → 2) Terminstatus & Notizen aktualisieren
 *        → 3) Protokollnotiz anlegen → 4) Dokument anhängen (überspringbar) → Zusammenfassung.
 * Reads: termine (gefiltert auf terminstatus 'geplant'), unternehmen (für Kontext).
 * Writes: termine (updateTermineEntry), notizen (createNotizenEntry), dokumente (createDokumenteEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconCalendarCheck,
  IconFileText,
  IconPaperclip,
  IconCheck,
  IconAlertCircle,
} from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { EnrichedTermine } from '@/types/enriched';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';

const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];

export default function MeetingNachbereitungPage() {
  const { termine, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedTermin, setSelectedTermin] = useState<EnrichedTermine | null>(null);

  // Step 2 state
  const [terminStatus, setTerminStatus] = useState('stattgefunden');
  const [notizenTermin, setNotizenTermin] = useState('');
  const [step2Saving, setStep2Saving] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [step2Done, setStep2Done] = useState(false);

  // Step 3 state
  const [notizTitel, setNotizTitel] = useState('');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notizKategorie, setNotizKategorie] = useState('meeting');
  const [notizPrioritaet, setNotizPrioritaet] = useState('mittel');
  const [step3Saving, setStep3Saving] = useState(false);
  const [step3Error, setStep3Error] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);

  // Step 4 state
  const [dokBezeichnung, setDokBezeichnung] = useState('');
  const [dokTyp, setDokTyp] = useState('protokoll');
  const [dokDatum, setDokDatum] = useState('');
  const [dokLink, setDokLink] = useState('');
  const [step4Saving, setStep4Saving] = useState(false);
  const [step4Error, setStep4Error] = useState<string | null>(null);
  const [createdDokId, setCreatedDokId] = useState<string | null>(null);

  // Filter termine to only 'geplant'
  const geplanteTermine = termine.filter(
    (t) => t.fields.terminstatus?.key === 'geplant'
  ) as EnrichedTermine[];

  const handleSelectTermin = (id: string) => {
    const t = geplanteTermine.find((t) => t.record_id === id);
    if (!t) return;
    setSelectedTermin(t);
    // Pre-fill step 3 fields
    setNotizTitel('Protokoll: ' + (t.fields.terminbezeichnung ?? ''));
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    // Pre-fill step 4 fields
    setDokBezeichnung('Protokoll: ' + (t.fields.terminbezeichnung ?? ''));
    setStep(2);
  };

  const handleStep2Submit = async () => {
    if (!selectedTermin) return;
    setStep2Saving(true);
    setStep2Error(null);
    try {
      await LivingAppsService.updateTermineEntry(selectedTermin.record_id, {
        terminstatus: terminStatus,
        notizen_termin: notizenTermin || undefined,
      });
      setStep2Done(true);
      await fetchAll();
      setStep(3);
    } catch (e) {
      setStep2Error(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setStep2Saving(false);
    }
  };

  const handleStep3Submit = async () => {
    if (!selectedTermin) return;
    setStep3Saving(true);
    setStep3Error(null);
    try {
      let nid = createdNotizId;
      if (!nid) {
        const unternehmenId = extractRecordId(selectedTermin.fields.unternehmen);
        const result = await LivingAppsService.createNotizenEntry({
          unternehmen: unternehmenId
            ? createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId)
            : undefined,
          notiz_titel: notizTitel,
          notiz_inhalt: notizInhalt,
          notiz_datum: notizDatum,
          kategorie: notizKategorie,
          prioritaet: notizPrioritaet,
        });
        nid = result.record_id;
        setCreatedNotizId(nid);
      }
      await fetchAll();
      setStep(4);
    } catch (e) {
      setStep3Error(e instanceof Error ? e.message : 'Fehler beim Anlegen der Notiz');
    } finally {
      setStep3Saving(false);
    }
  };

  const handleStep4Submit = async () => {
    if (!selectedTermin) return;
    setStep4Saving(true);
    setStep4Error(null);
    try {
      let did = createdDokId;
      if (!did) {
        const unternehmenId = extractRecordId(selectedTermin.fields.unternehmen);
        const result = await LivingAppsService.createDokumenteEntry({
          unternehmen: unternehmenId
            ? createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId)
            : undefined,
          dokumentenbezeichnung: dokBezeichnung,
          dokumententyp: dokTyp,
          dokumentendatum: dokDatum || undefined,
          dokumentenlink: dokLink || undefined,
        });
        did = result.record_id;
        setCreatedDokId(did);
      }
      await fetchAll();
      setStep(5);
    } catch (e) {
      setStep4Error(e instanceof Error ? e.message : 'Fehler beim Anlegen des Dokuments');
    } finally {
      setStep4Saving(false);
    }
  };

  const handleSkipStep4 = () => {
    setStep(5);
  };

  const handleReset = () => {
    setSelectedTermin(null);
    setTerminStatus('stattgefunden');
    setNotizenTermin('');
    setStep2Done(false);
    setStep2Error(null);
    setNotizTitel('');
    setNotizInhalt('');
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    setNotizKategorie('meeting');
    setNotizPrioritaet('mittel');
    setCreatedNotizId(null);
    setStep3Error(null);
    setDokBezeichnung('');
    setDokTyp('protokoll');
    setDokDatum('');
    setDokLink('');
    setCreatedDokId(null);
    setStep4Error(null);
    setStep(1);
  };

  const createdCount = (createdNotizId ? 1 : 0) + (createdDokId ? 1 : 0);

  return (
    <IntentWizardShell
      title="Meeting Nachbereitung"
      subtitle="Termin abschließen, Protokoll und Dokument anlegen"
      steps={[
        { label: 'Termin' },
        { label: 'Status' },
        { label: 'Protokoll' },
        { label: 'Dokument' },
        { label: 'Fertig' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Termin auswählen */}
      {step === 1 && (
        <EntitySelectStep
          items={geplanteTermine.map((t) => ({
            id: t.record_id,
            title: t.fields.terminbezeichnung ?? '(Kein Titel)',
            subtitle: [
              t.fields.terminart?.label,
              t.fields.datum_uhrzeit
                ? format(new Date(t.fields.datum_uhrzeit), 'dd.MM.yyyy HH:mm')
                : undefined,
              t.unternehmenName,
            ]
              .filter(Boolean)
              .join(' · '),
            status: t.fields.terminstatus
              ? { key: t.fields.terminstatus.key, label: t.fields.terminstatus.label }
              : undefined,
            icon: <IconCalendarCheck size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectTermin}
          searchPlaceholder="Termin suchen …"
          emptyText="Keine geplanten Termine gefunden"
        />
      )}

      {/* Step 2: Terminstatus aktualisieren */}
      {step === 2 && (
        selectedTermin ? (
          <div className="space-y-6">
            {/* Kontext-Header */}
            <div className="rounded-2xl border bg-card p-4 space-y-1">
              <div className="flex items-center gap-2">
                <IconCalendarCheck size={18} className="text-primary" />
                <span className="font-semibold truncate">
                  {selectedTermin.fields.terminbezeichnung ?? '(Kein Titel)'}
                </span>
                {selectedTermin.fields.terminstatus && (
                  <StatusBadge
                    statusKey={selectedTermin.fields.terminstatus.key}
                    label={selectedTermin.fields.terminstatus.label}
                  />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {[
                  selectedTermin.fields.terminart?.label,
                  selectedTermin.fields.datum_uhrzeit
                    ? format(new Date(selectedTermin.fields.datum_uhrzeit), 'dd.MM.yyyy HH:mm')
                    : undefined,
                  selectedTermin.unternehmenName,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>

            {/* Mini-Form */}
            <div className="rounded-2xl border bg-card p-5 space-y-5">
              <h3 className="font-medium">Status aktualisieren</h3>

              <div className="space-y-2">
                <Label>Terminstatus</Label>
                <div className="flex flex-wrap gap-2">
                  {TERMINSTATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setTerminStatus(opt.key)}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                        terminStatus === opt.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border hover:bg-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notizen-termin">Anmerkungen (optional)</Label>
                <Textarea
                  id="notizen-termin"
                  value={notizenTermin}
                  onChange={(e) => setNotizenTermin(e.target.value)}
                  placeholder="Kurze Anmerkungen zum Termin …"
                  rows={3}
                />
              </div>

              {step2Error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <IconAlertCircle size={16} />
                  {step2Error}
                </div>
              )}

              <Button
                onClick={handleStep2Submit}
                disabled={step2Saving}
                className="w-full"
              >
                {step2Saving ? 'Wird gespeichert …' : 'Status speichern & weiter'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt braucht die Auswahl aus Schritt 1.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Neu starten
            </Button>
          </div>
        )
      )}

      {/* Step 3: Protokollnotiz anlegen */}
      {step === 3 && (
        selectedTermin ? (
          <div className="space-y-6">
            {/* Kontext-Header */}
            <div className="rounded-2xl border bg-card p-4 space-y-1">
              <div className="flex items-center gap-2">
                <IconFileText size={18} className="text-primary" />
                <span className="font-semibold truncate">
                  {selectedTermin.fields.terminbezeichnung ?? '(Kein Titel)'}
                </span>
                {step2Done && (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <IconCheck size={14} /> Status aktualisiert
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{selectedTermin.unternehmenName}</p>
            </div>

            {/* Mini-Form */}
            <div className="rounded-2xl border bg-card p-5 space-y-5">
              <h3 className="font-medium">Protokollnotiz anlegen</h3>

              <div className="space-y-2">
                <Label htmlFor="notiz-titel">Titel *</Label>
                <Input
                  id="notiz-titel"
                  value={notizTitel}
                  onChange={(e) => setNotizTitel(e.target.value)}
                  placeholder="Titel der Notiz"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notiz-inhalt">Inhalt *</Label>
                <Textarea
                  id="notiz-inhalt"
                  value={notizInhalt}
                  onChange={(e) => setNotizInhalt(e.target.value)}
                  placeholder="Protokollinhalt, Beschlüsse, Aufgaben …"
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
                  <Label htmlFor="notiz-prioritaet">Priorität</Label>
                  <Select value={notizPrioritaet} onValueChange={setNotizPrioritaet}>
                    <SelectTrigger id="notiz-prioritaet">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITAET_OPTIONS.map((opt) => (
                        <SelectItem key={opt.key} value={opt.key}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Kategorie</Label>
                <div className="flex flex-wrap gap-2">
                  {KATEGORIE_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setNotizKategorie(opt.key)}
                      className={`px-3 py-1.5 rounded-xl border text-sm transition-colors ${
                        notizKategorie === opt.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border hover:bg-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {step3Error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <IconAlertCircle size={16} />
                  {step3Error}
                </div>
              )}

              <Button
                onClick={handleStep3Submit}
                disabled={step3Saving || !notizTitel || !notizInhalt || !notizDatum}
                className="w-full"
              >
                {step3Saving ? 'Wird gespeichert …' : 'Notiz anlegen & weiter'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt braucht die Auswahl aus Schritt 1.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Neu starten
            </Button>
          </div>
        )
      )}

      {/* Step 4: Dokument anhängen (überspringbar) */}
      {step === 4 && (
        selectedTermin ? (
          <div className="space-y-6">
            {/* Kontext-Header */}
            <div className="rounded-2xl border bg-card p-4 space-y-1">
              <div className="flex items-center gap-2">
                <IconPaperclip size={18} className="text-primary" />
                <span className="font-semibold truncate">
                  {selectedTermin.fields.terminbezeichnung ?? '(Kein Titel)'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Schritt optional — du kannst ihn überspringen.
              </p>
            </div>

            {/* Mini-Form */}
            <div className="rounded-2xl border bg-card p-5 space-y-5">
              <h3 className="font-medium">Dokument anhängen (optional)</h3>

              <div className="space-y-2">
                <Label htmlFor="dok-bezeichnung">Bezeichnung *</Label>
                <Input
                  id="dok-bezeichnung"
                  value={dokBezeichnung}
                  onChange={(e) => setDokBezeichnung(e.target.value)}
                  placeholder="Dokumentenbezeichnung"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dok-typ">Dokumententyp</Label>
                  <Select value={dokTyp} onValueChange={setDokTyp}>
                    <SelectTrigger id="dok-typ">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOKUMENTENTYP_OPTIONS.map((opt) => (
                        <SelectItem key={opt.key} value={opt.key}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dok-datum">Datum</Label>
                  <Input
                    id="dok-datum"
                    type="date"
                    value={dokDatum}
                    onChange={(e) => setDokDatum(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dok-link">Dokumentenlink (URL)</Label>
                <Input
                  id="dok-link"
                  type="url"
                  value={dokLink}
                  onChange={(e) => setDokLink(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              {step4Error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <IconAlertCircle size={16} />
                  {step4Error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleStep4Submit}
                  disabled={step4Saving || !dokBezeichnung}
                  className="flex-1"
                >
                  {step4Saving ? 'Wird gespeichert …' : 'Dokument anlegen & weiter'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSkipStep4}
                  disabled={step4Saving}
                  className="flex-1"
                >
                  Überspringen
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt braucht die Auswahl aus Schritt 1.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Neu starten
            </Button>
          </div>
        )
      )}

      {/* Step 5: Zusammenfassung */}
      {step === 5 && (
        selectedTermin ? (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-6 space-y-4 text-center">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <IconCheck size={28} className="text-green-600" />
                </div>
              </div>
              <h2 className="text-xl font-semibold">Nachbereitung abgeschlossen</h2>
              <p className="text-muted-foreground">
                Der Termin wurde erfolgreich nachbereitet.
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-medium">Zusammenfassung</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Termin</dt>
                  <dd className="font-medium truncate text-right">
                    {selectedTermin.fields.terminbezeichnung ?? '(Kein Titel)'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Unternehmen</dt>
                  <dd className="font-medium truncate text-right">
                    {selectedTermin.unternehmenName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    {(() => {
                      const opt = TERMINSTATUS_OPTIONS.find((o) => o.key === terminStatus);
                      return (
                        <StatusBadge
                          statusKey={terminStatus}
                          label={opt?.label ?? terminStatus}
                        />
                      );
                    })()}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Angelegte Datensätze</dt>
                  <dd className="font-medium">{createdCount}</dd>
                </div>
                {createdNotizId && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground flex items-center gap-1">
                      <IconFileText size={14} /> Protokollnotiz
                    </dt>
                    <dd className="text-green-600 font-medium">Angelegt</dd>
                  </div>
                )}
                {createdDokId && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground flex items-center gap-1">
                      <IconPaperclip size={14} /> Dokument
                    </dt>
                    <dd className="text-green-600 font-medium">Angelegt</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                Neue Nachbereitung
              </Button>
              <a href="#/" className="flex-1">
                <Button className="w-full">Zurück zum Dashboard</Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt braucht die Auswahl aus Schritt 1.
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
