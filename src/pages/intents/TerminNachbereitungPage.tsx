/**
 * Termin Nachbereitung — 4-Schritt-Wizard.
 * Steps: 1) Termin auswählen → 2) Termin abschließen → 3) Protokoll ablegen → 4) Nachverfolgungs-Notiz erfassen.
 * Reads: termine, unternehmen. Writes: termine (updateTermineEntry), dokumente (createDokumenteEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { IconCalendarCheck, IconFileText, IconNotes, IconCircleCheck } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Termine } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';

const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

function formatDateTime(val: string | undefined): string {
  if (!val) return '';
  try {
    return format(parseISO(val), 'dd.MM.yyyy HH:mm', { locale: de });
  } catch {
    return val;
  }
}

function formatDateOnly(val: string | undefined): string {
  if (!val) return '';
  try {
    return format(parseISO(val), 'dd.MM.yyyy', { locale: de });
  } catch {
    return val;
  }
}

function extractDatePart(val: string | undefined): string {
  if (!val) return format(new Date(), 'yyyy-MM-dd');
  try {
    return format(parseISO(val), 'yyyy-MM-dd');
  } catch {
    return format(new Date(), 'yyyy-MM-dd');
  }
}

export default function TerminNachbereitungPage() {
  const { termine, unternehmen, fetchAll, loading, error } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedTermin, setSelectedTermin] = useState<Termine | null>(null);

  // Step 2 state
  const [terminStatus, setTerminStatus] = useState('stattgefunden');
  const [notizenTermin, setNotizenTermin] = useState('');
  const [step2Saving, setStep2Saving] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [step2Done, setStep2Done] = useState(false);

  // Step 3 state
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententypKey, setDokumententypKey] = useState('protokoll');
  const [dokumentendatum, setDokumentendatum] = useState('');
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [step3Saving, setStep3Saving] = useState(false);
  const [step3Error, setStep3Error] = useState<string | null>(null);
  const [createdDokumentId, setCreatedDokumentId] = useState<string | null>(null);

  // Step 4 state
  const [notizTitel, setNotizTitel] = useState('');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kategorieKey, setKategorieKey] = useState('meeting');
  const [prioritaetKey, setPrioritaetKey] = useState('mittel');
  const [step4Saving, setStep4Saving] = useState(false);
  const [step4Error, setStep4Error] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);

  const eligibleTermine = termine.filter((t) => {
    const key = t.fields.terminstatus?.key;
    return key === 'geplant' || key === undefined || key === null;
  });

  const handleTerminSelect = useCallback((id: string) => {
    const found = termine.find((t) => t.record_id === id) ?? null;
    setSelectedTermin(found);
    if (found) {
      setDokumentenbezeichnung('Protokoll: ' + (found.fields.terminbezeichnung ?? ''));
      setDokumentendatum(extractDatePart(found.fields.datum_uhrzeit));
      setNotizTitel('Follow-up: ' + (found.fields.terminbezeichnung ?? ''));
      setNotizenTermin('');
      setStep2Done(false);
      setCreatedDokumentId(null);
      setCreatedNotizId(null);
    }
    setStep(2);
  }, [termine]);

  const unternehmenId = selectedTermin
    ? extractRecordId(selectedTermin.fields.unternehmen)
    : null;

  const unternehmenRecord = unternehmenId
    ? unternehmen.find((u) => u.record_id === unternehmenId) ?? null
    : null;

  const handleStep2Submit = async () => {
    if (!selectedTermin) return;
    setStep2Saving(true);
    setStep2Error(null);
    try {
      await LivingAppsService.updateTermineEntry(selectedTermin.record_id, {
        terminstatus: terminStatus,
        notizen_termin: notizenTermin || undefined,
      });
      await fetchAll();
      setStep2Done(true);
      setStep(3);
    } catch (e) {
      setStep2Error(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setStep2Saving(false);
    }
  };

  const handleStep3Submit = async () => {
    if (!unternehmenId) return;
    setStep3Saving(true);
    setStep3Error(null);
    try {
      let did = createdDokumentId;
      if (!did) {
        const result = await LivingAppsService.createDokumenteEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
          dokumentenbezeichnung,
          dokumententyp: dokumententypKey,
          dokumentendatum: dokumentendatum || undefined,
          dokumentenlink: dokumentenlink || undefined,
        });
        did = result.record_id;
        setCreatedDokumentId(did);
      }
      await fetchAll();
      setStep(4);
    } catch (e) {
      setStep3Error(e instanceof Error ? e.message : 'Fehler beim Anlegen des Dokuments');
    } finally {
      setStep3Saving(false);
    }
  };

  const handleStep4Submit = async () => {
    if (!unternehmenId) return;
    setStep4Saving(true);
    setStep4Error(null);
    try {
      let nid = createdNotizId;
      if (!nid) {
        const result = await LivingAppsService.createNotizenEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId),
          notiz_titel: notizTitel,
          notiz_inhalt: notizInhalt,
          notiz_datum: notizDatum,
          kategorie: kategorieKey,
          prioritaet: prioritaetKey,
        });
        nid = result.record_id;
        setCreatedNotizId(nid);
      }
      await fetchAll();
      setStep(5);
    } catch (e) {
      setStep4Error(e instanceof Error ? e.message : 'Fehler beim Anlegen der Notiz');
    } finally {
      setStep4Saving(false);
    }
  };

  const handleReset = () => {
    setSelectedTermin(null);
    setStep(1);
    setTerminStatus('stattgefunden');
    setNotizenTermin('');
    setStep2Done(false);
    setStep2Error(null);
    setDokumentenbezeichnung('');
    setDokumententypKey('protokoll');
    setDokumentendatum('');
    setDokumentenlink('');
    setStep3Error(null);
    setCreatedDokumentId(null);
    setNotizTitel('');
    setNotizInhalt('');
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    setKategorieKey('meeting');
    setPrioritaetKey('mittel');
    setStep4Error(null);
    setCreatedNotizId(null);
  };

  return (
    <IntentWizardShell
      title="Termin nachbereiten"
      subtitle="Status setzen, Protokoll ablegen, Nachverfolgung erfassen"
      steps={[
        { label: 'Termin' },
        { label: 'Abschließen' },
        { label: 'Protokoll' },
        { label: 'Notiz' },
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
          items={eligibleTermine.map((t) => {
            const u = t.fields.unternehmen
              ? unternehmen.find((u) => u.record_id === extractRecordId(t.fields.unternehmen))
              : undefined;
            return {
              id: t.record_id,
              title: t.fields.terminbezeichnung ?? '(Kein Titel)',
              subtitle: [
                t.fields.datum_uhrzeit ? formatDateTime(t.fields.datum_uhrzeit) : '',
                u?.fields.name ?? '',
              ]
                .filter(Boolean)
                .join(' · '),
              status: t.fields.terminstatus
                ? { key: t.fields.terminstatus.key, label: t.fields.terminstatus.label }
                : undefined,
              icon: <IconCalendarCheck size={20} className="text-primary" />,
            };
          })}
          onSelect={handleTerminSelect}
          searchPlaceholder="Termin suchen …"
          emptyText="Keine offenen Termine gefunden"
          emptyIcon={<IconCalendarCheck size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Termin abschließen */}
      {step === 2 && (
        selectedTermin ? (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-4 space-y-1">
              <p className="font-semibold text-foreground">{selectedTermin.fields.terminbezeichnung ?? '(Kein Titel)'}</p>
              {selectedTermin.fields.datum_uhrzeit && (
                <p className="text-sm text-muted-foreground">{formatDateTime(selectedTermin.fields.datum_uhrzeit)}</p>
              )}
              {unternehmenRecord && (
                <p className="text-sm text-muted-foreground">{unternehmenRecord.fields.name}</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Terminstatus</p>
                <div className="flex flex-wrap gap-2">
                  {TERMINSTATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setTerminStatus(opt.key)}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
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
                <label className="text-sm font-medium text-foreground" htmlFor="notizen_termin">
                  Notizen zum Termin
                </label>
                <Textarea
                  id="notizen_termin"
                  value={notizenTermin}
                  onChange={(e) => setNotizenTermin(e.target.value)}
                  placeholder="Kurze Zusammenfassung, Beschlüsse, Teilnehmer …"
                  rows={4}
                />
              </div>
            </div>

            {step2Error && (
              <p className="text-sm text-destructive">{step2Error}</p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                Zurück
              </Button>
              <Button onClick={handleStep2Submit} disabled={step2Saving}>
                {step2Saving ? 'Wird gespeichert …' : 'Termin abschließen'}
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

      {/* Step 3: Protokoll ablegen */}
      {step === 3 && (
        selectedTermin && unternehmenId ? (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-4 space-y-1">
              <div className="flex items-center gap-2">
                <IconFileText size={18} className="text-primary" />
                <p className="font-semibold text-foreground">Protokoll anlegen</p>
              </div>
              {unternehmenRecord && (
                <p className="text-sm text-muted-foreground">Unternehmen: {unternehmenRecord.fields.name}</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="dokumentenbezeichnung">
                  Dokumentenbezeichnung *
                </label>
                <Input
                  id="dokumentenbezeichnung"
                  value={dokumentenbezeichnung}
                  onChange={(e) => setDokumentenbezeichnung(e.target.value)}
                  placeholder="z. B. Protokoll: Strategiemeeting Q3"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="dokumententyp">
                  Dokumententyp
                </label>
                <Select value={dokumententypKey} onValueChange={setDokumententypKey}>
                  <SelectTrigger id="dokumententyp">
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
                <label className="text-sm font-medium text-foreground" htmlFor="dokumentendatum">
                  Dokumentendatum
                </label>
                <Input
                  id="dokumentendatum"
                  type="date"
                  value={dokumentendatum}
                  onChange={(e) => setDokumentendatum(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="dokumentenlink">
                  Link zum Dokument
                </label>
                <Input
                  id="dokumentenlink"
                  type="url"
                  value={dokumentenlink}
                  onChange={(e) => setDokumentenlink(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            </div>

            {step3Error && (
              <p className="text-sm text-destructive">{step3Error}</p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>
                Zurück
              </Button>
              <Button
                onClick={handleStep3Submit}
                disabled={step3Saving || !dokumentenbezeichnung.trim()}
              >
                {step3Saving ? 'Wird angelegt …' : createdDokumentId ? 'Weiter' : 'Protokoll anlegen'}
              </Button>
              <Button variant="ghost" onClick={() => setStep(4)}>
                Überspringen
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

      {/* Step 4: Nachverfolgungs-Notiz erfassen */}
      {step === 4 && (
        selectedTermin && unternehmenId ? (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-4 space-y-1">
              <div className="flex items-center gap-2">
                <IconNotes size={18} className="text-primary" />
                <p className="font-semibold text-foreground">Follow-up Notiz</p>
              </div>
              {unternehmenRecord && (
                <p className="text-sm text-muted-foreground">Unternehmen: {unternehmenRecord.fields.name}</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="notiz_titel">
                  Titel *
                </label>
                <Input
                  id="notiz_titel"
                  value={notizTitel}
                  onChange={(e) => setNotizTitel(e.target.value)}
                  placeholder="z. B. Follow-up: Strategiemeeting Q3"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="notiz_inhalt">
                  Inhalt *
                </label>
                <Textarea
                  id="notiz_inhalt"
                  value={notizInhalt}
                  onChange={(e) => setNotizInhalt(e.target.value)}
                  placeholder="Offene Punkte, nächste Schritte, Verantwortlichkeiten …"
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="notiz_datum">
                  Datum *
                </label>
                <Input
                  id="notiz_datum"
                  type="date"
                  value={notizDatum}
                  onChange={(e) => setNotizDatum(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="kategorie">
                  Kategorie
                </label>
                <Select value={kategorieKey} onValueChange={setKategorieKey}>
                  <SelectTrigger id="kategorie">
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
                <p className="text-sm font-medium text-foreground">Priorität</p>
                <div className="flex flex-wrap gap-2">
                  {PRIORITAET_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPrioritaetKey(opt.key)}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                        prioritaetKey === opt.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:bg-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {step4Error && (
              <p className="text-sm text-destructive">{step4Error}</p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)}>
                Zurück
              </Button>
              <Button
                onClick={handleStep4Submit}
                disabled={step4Saving || !notizTitel.trim() || !notizInhalt.trim() || !notizDatum}
              >
                {step4Saving ? 'Wird erfasst …' : createdNotizId ? 'Weiter' : 'Notiz erfassen'}
              </Button>
              <Button variant="ghost" onClick={() => setStep(5)}>
                Überspringen
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
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-3">
              <IconCircleCheck size={28} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-lg">Nachbereitung abgeschlossen</p>
              {selectedTermin && (
                <p className="text-sm text-muted-foreground">{selectedTermin.fields.terminbezeichnung ?? ''}</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-card divide-y overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <IconCalendarCheck size={18} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Termin abgeschlossen</p>
                {selectedTermin && (
                  <p className="text-sm text-muted-foreground truncate">
                    {selectedTermin.fields.terminbezeichnung ?? ''}{' '}
                    {selectedTermin.fields.datum_uhrzeit
                      ? '· ' + formatDateOnly(selectedTermin.fields.datum_uhrzeit)
                      : ''}
                  </p>
                )}
              </div>
              {step2Done && (
                <span className="ml-auto text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 shrink-0">
                  {TERMINSTATUS_OPTIONS.find((o) => o.key === terminStatus)?.label ?? terminStatus}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 p-4">
              <IconFileText size={18} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Protokoll</p>
                {createdDokumentId ? (
                  <p className="text-sm text-muted-foreground truncate">{dokumentenbezeichnung}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Übersprungen</p>
                )}
              </div>
              {createdDokumentId && (
                <span className="ml-auto text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 shrink-0">
                  Angelegt
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 p-4">
              <IconNotes size={18} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Follow-up Notiz</p>
                {createdNotizId ? (
                  <p className="text-sm text-muted-foreground truncate">{notizTitel}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Übersprungen</p>
                )}
              </div>
              {createdNotizId && (
                <span className="ml-auto text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 shrink-0">
                  Erfasst
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleReset} variant="outline">
              Weiteren Termin nachbereiten
            </Button>
            <a href="#/">
              <Button>Zurück zum Dashboard</Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
