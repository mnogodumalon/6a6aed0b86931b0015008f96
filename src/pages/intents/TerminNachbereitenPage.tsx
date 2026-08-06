/**
 * Termin Nachbereiten — 5-Schritt-Wizard.
 * Steps: 1) Termin auswählen → 2) Termin abschließen → 3) Protokoll anlegen →
 *        4) Ergebnis-Notiz → 5) Prüfen & Bestätigen → 6) Fertig.
 * Reads: termine, unternehmen, dokumente, notizen.
 * Writes: updateTermineEntry (status → stattgefunden),
 *         createDokumenteEntry (Sitzungsprotokoll),
 *         createNotizenEntry (Ergebnis-Notiz).
 * Composes: IntentWizardShell, EntitySelectStep, SummaryStep, SuccessStep.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  IconCalendarCheck,
  IconFileText,
  IconNotes,
  IconAlertCircle,
  IconChevronRight,
} from '@tabler/icons-react';

import { useDashboardData } from '@/hooks/useDashboardData';
import { useIntentSubmit } from '@/hooks/useIntentSubmit';
import type { Termine } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { lookupKey, formatDateTime } from '@/lib/formatters';
import { undoToast } from '@/lib/polish';
import { IntentWizardShell, clearIntentDraft } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const DRAFT_KEY = 'intent:termin-nachbereiten';

const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

type WizardState = {
  terminId: string;
  notizen_termin: string;
  // Protokoll
  dokumentenbezeichnung: string;
  dokumententypKey: string;
  dokumentendatum: string;
  dokumentenlink: string;
  bereitgestellt_von: string;
  // Notiz
  notiz_titel: string;
  notiz_inhalt: string;
  kategorieKey: string;
  prioritaetKey: string;
};

const initialState: WizardState = {
  terminId: '',
  notizen_termin: '',
  dokumentenbezeichnung: '',
  dokumententypKey: 'protokoll',
  dokumentendatum: format(new Date(), 'yyyy-MM-dd'),
  dokumentenlink: '',
  bereitgestellt_von: '',
  notiz_titel: '',
  notiz_inhalt: '',
  kategorieKey: 'meeting',
  prioritaetKey: 'mittel',
};

export default function TerminNachbereitenPage() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(initialState);

  // Idempotency ids for chained creates
  const [protokollId, setProtokollId] = useState<string | null>(null);
  const [notizId, setNotizId] = useState<string | null>(null);

  const { termine, unternehmen, dokumente, notizen, loading, error, fetchAll, unternehmenMap } =
    useDashboardData();

  const { submit, submitting, error: submitError, done, result, reset } = useIntentSubmit(
    async () => {
      const termin = termine.find(t => t.record_id === state.terminId);
      if (!termin) throw new Error('Termin nicht gefunden');

      const unternehmenId = extractRecordId(termin.fields.unternehmen);
      const unternehmenUrl = unternehmenId
        ? createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId)
        : undefined;

      // Step 2: update termin status
      await LivingAppsService.updateTermineEntry(state.terminId, {
        terminstatus: 'stattgefunden',
        notizen_termin: state.notizen_termin || undefined,
      });

      // Step 3: create Protokoll (idempotent)
      let pid = protokollId;
      if (!pid) {
        const dok = await LivingAppsService.createDokumenteEntry({
          unternehmen: unternehmenUrl,
          dokumentenbezeichnung: state.dokumentenbezeichnung,
          dokumententyp: state.dokumententypKey !== 'none' ? state.dokumententypKey : undefined,
          dokumentendatum: state.dokumentendatum,
          dokumentenlink: state.dokumentenlink || undefined,
          bereitgestellt_von: state.bereitgestellt_von || undefined,
        });
        pid = dok.record_id;
        setProtokollId(pid);
      }

      // Step 4: create Notiz (idempotent)
      let nid = notizId;
      if (!nid) {
        const notizDatum = format(new Date(), 'yyyy-MM-dd');
        const noz = await LivingAppsService.createNotizenEntry({
          unternehmen: unternehmenUrl,
          notiz_titel: state.notiz_titel,
          notiz_inhalt: state.notiz_inhalt,
          notiz_datum: notizDatum,
          kategorie: state.kategorieKey !== 'none' ? state.kategorieKey : undefined,
          prioritaet: state.prioritaetKey !== 'none' ? state.prioritaetKey : undefined,
        });
        nid = noz.record_id;
        setNotizId(nid);
      }

      await fetchAll();

      return {
        terminbezeichnung: termin.fields.terminbezeichnung ?? '(Termin)',
        unternehmenName: unternehmenId
          ? (unternehmenMap.get(unternehmenId)?.fields.name ?? '—')
          : '—',
        protokollId: pid,
        notizId: nid,
        dokumentenbezeichnung: state.dokumentenbezeichnung,
        notiz_titel: state.notiz_titel,
      };
    },
    { draftKey: DRAFT_KEY },
  );

  // Eligible: nur Termine mit terminstatus 'geplant'
  const geplantTermine = termine.filter(
    t => lookupKey(t.fields.terminstatus) === 'geplant',
  );

  const selectedTermin: Termine | undefined = termine.find(t => t.record_id === state.terminId);
  const selectedUnternehmenId = selectedTermin
    ? extractRecordId(selectedTermin.fields.unternehmen)
    : null;
  const selectedUnternehmen = selectedUnternehmenId
    ? unternehmenMap.get(selectedUnternehmenId)
    : undefined;

  // Stats per termin for step 1
  function terminStats(t: Termine) {
    const uid = extractRecordId(t.fields.unternehmen);
    const docsCount = uid ? dokumente.filter(d => extractRecordId(d.fields.unternehmen) === uid).length : 0;
    const notizCount = uid ? notizen.filter(n => extractRecordId(n.fields.unternehmen) === uid).length : 0;
    return [
      { label: 'Dokumente', value: docsCount },
      { label: 'Notizen', value: notizCount },
    ];
  }

  function resetWizard() {
    setState(initialState);
    setProtokollId(null);
    setNotizId(null);
    reset();
    clearIntentDraft(DRAFT_KEY);
    setStep(1);
  }

  const answers =
    step > 1 && selectedTermin
      ? [
          {
            label: 'Termin',
            value: `${selectedTermin.fields.terminbezeichnung ?? '—'} · ${selectedUnternehmen?.fields.name ?? '—'}`,
          },
        ]
      : undefined;

  const missingForConfirm: string[] = [
    ...(state.dokumentenbezeichnung.trim() ? [] : ['Dokumentenbezeichnung']),
    ...(state.notiz_titel.trim() ? [] : ['Notiz-Titel']),
    ...(state.notiz_inhalt.trim() ? [] : ['Notiz-Inhalt']),
  ];

  const STEPS = [
    { label: 'Termin' },
    { label: 'Abschließen' },
    { label: 'Protokoll' },
    { label: 'Notiz' },
    { label: 'Prüfen' },
    { label: 'Fertig' },
  ];

  return (
    <IntentWizardShell
      title="Termin nachbereiten"
      subtitle="Status setzen, Protokoll anlegen, Ergebnis festhalten"
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
      intro={{
        description:
          'Schließe einen abgehaltenen Termin ab: setze den Status auf „Stattgefunden", lege ein Sitzungsprotokoll an und halte das Ergebnis als Notiz fest.',
        requirements: ['Abgehaltener Termin (Status: Geplant)', 'Protokollbezeichnung', 'Ergebnisnotiz'],
      }}
      answers={answers}
      draftKey={DRAFT_KEY}
      draft={state}
      onDraftRestore={d => setState(d as WizardState)}
    >
      {/* ─── Step 1: Termin auswählen ─── */}
      {step === 1 && (
        <EntitySelectStep
          items={geplantTermine.map(t => {
            const uid = extractRecordId(t.fields.unternehmen);
            const uName = uid ? (unternehmenMap.get(uid)?.fields.name ?? '—') : '—';
            return {
              id: t.record_id,
              title: t.fields.terminbezeichnung ?? '(ohne Bezeichnung)',
              subtitle: `${formatDateTime(t.fields.datum_uhrzeit)} · ${t.fields.ort ?? '—'} · ${uName}`,
              status: t.fields.terminstatus
                ? { key: t.fields.terminstatus.key, label: t.fields.terminstatus.label }
                : undefined,
              stats: terminStats(t),
              icon: <IconCalendarCheck size={20} className="text-primary" />,
            };
          })}
          onSelect={id => {
            const t = termine.find(x => x.record_id === id);
            setState(s => ({
              ...s,
              terminId: id,
              notiz_titel: t?.fields.terminbezeichnung ?? '',
            }));
            setStep(2);
          }}
          emptyText="Keine geplanten Termine vorhanden."
          searchPlaceholder="Termin suchen …"
        />
      )}

      {/* ─── Step 2: Termin abschließen ─── */}
      {step === 2 && (
        <div className="space-y-5">
          {!selectedTermin ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
              <IconAlertCircle size={32} />
              <p>Kein Termin ausgewählt.</p>
              <Button variant="outline" onClick={() => setStep(1)}>
                Zurück zu Schritt 1
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border bg-card p-4 space-y-1">
                <p className="font-semibold text-base">
                  {selectedTermin.fields.terminbezeichnung}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(selectedTermin.fields.datum_uhrzeit)}
                  {selectedTermin.fields.ort ? ` · ${selectedTermin.fields.ort}` : ''}
                </p>
                {selectedUnternehmen && (
                  <p className="text-sm text-muted-foreground">
                    {selectedUnternehmen.fields.name}
                  </p>
                )}
                <div className="pt-1">
                  <StatusBadge statusKey="stattgefunden" label="Stattgefunden" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notizen_termin">Notizen zum Termin (optional)</Label>
                <Textarea
                  id="notizen_termin"
                  value={state.notizen_termin}
                  onChange={e => setState(s => ({ ...s, notizen_termin: e.target.value }))}
                  placeholder="Kurznotiz zum Verlauf des Termins …"
                  rows={3}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => setStep(3)}
              >
                Weiter: Protokoll anlegen
                <IconChevronRight size={16} className="ml-1" />
              </Button>
            </>
          )}
        </div>
      )}

      {/* ─── Step 3: Protokoll anlegen ─── */}
      {step === 3 && (
        <div className="space-y-5">
          {!selectedTermin ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
              <IconAlertCircle size={32} />
              <p>Kein Termin ausgewählt.</p>
              <Button variant="outline" onClick={() => setStep(1)}>
                Zurück zu Schritt 1
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-secondary/40 p-3 flex items-center gap-2 text-sm">
                <IconFileText size={16} className="text-primary shrink-0" />
                <span>
                  Protokoll für <strong>{selectedTermin.fields.terminbezeichnung}</strong>
                  {selectedUnternehmen ? ` · ${selectedUnternehmen.fields.name}` : ''}
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dok_bezeichnung">
                  Dokumentenbezeichnung <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dok_bezeichnung"
                  value={state.dokumentenbezeichnung}
                  onChange={e => setState(s => ({ ...s, dokumentenbezeichnung: e.target.value }))}
                  placeholder={`Protokoll ${selectedTermin.fields.terminbezeichnung ?? ''}`}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dok_typ">Dokumententyp</Label>
                <Select
                  value={state.dokumententypKey}
                  onValueChange={v => setState(s => ({ ...s, dokumententypKey: v }))}
                >
                  <SelectTrigger id="dok_typ">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOKUMENTENTYP_OPTIONS.map(opt => (
                      <SelectItem key={opt.key} value={opt.key}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dok_datum">Dokumentendatum</Label>
                <Input
                  id="dok_datum"
                  type="date"
                  value={state.dokumentendatum}
                  onChange={e => setState(s => ({ ...s, dokumentendatum: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dok_link">Dokumentenlink (optional)</Label>
                <Input
                  id="dok_link"
                  type="url"
                  value={state.dokumentenlink}
                  onChange={e => setState(s => ({ ...s, dokumentenlink: e.target.value }))}
                  placeholder="https://…"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dok_bereit">Bereitgestellt von (optional)</Label>
                <Input
                  id="dok_bereit"
                  value={state.bereitgestellt_von}
                  onChange={e => setState(s => ({ ...s, bereitgestellt_von: e.target.value }))}
                  placeholder="Name oder Team"
                />
              </div>

              <Button
                className="w-full"
                disabled={!state.dokumentenbezeichnung.trim()}
                onClick={() => setStep(4)}
              >
                Weiter: Ergebnis-Notiz
                <IconChevronRight size={16} className="ml-1" />
              </Button>
            </>
          )}
        </div>
      )}

      {/* ─── Step 4: Ergebnis-Notiz ─── */}
      {step === 4 && (
        <div className="space-y-5">
          {!selectedTermin ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
              <IconAlertCircle size={32} />
              <p>Kein Termin ausgewählt.</p>
              <Button variant="outline" onClick={() => setStep(1)}>
                Zurück zu Schritt 1
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-secondary/40 p-3 flex items-center gap-2 text-sm">
                <IconNotes size={16} className="text-primary shrink-0" />
                <span>
                  Ergebnis-Notiz für <strong>{selectedTermin.fields.terminbezeichnung}</strong>
                  {selectedUnternehmen ? ` · ${selectedUnternehmen.fields.name}` : ''}
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notiz_titel">
                  Notiz-Titel <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="notiz_titel"
                  value={state.notiz_titel}
                  onChange={e => setState(s => ({ ...s, notiz_titel: e.target.value }))}
                  placeholder={selectedTermin.fields.terminbezeichnung ?? 'Ergebnis …'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notiz_inhalt">
                  Notiz-Inhalt <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="notiz_inhalt"
                  value={state.notiz_inhalt}
                  onChange={e => setState(s => ({ ...s, notiz_inhalt: e.target.value }))}
                  placeholder="Was wurde besprochen? Welche Beschlüsse wurden gefasst? Welche nächsten Schritte?"
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="notiz_kategorie">Kategorie</Label>
                  <Select
                    value={state.kategorieKey}
                    onValueChange={v => setState(s => ({ ...s, kategorieKey: v }))}
                  >
                    <SelectTrigger id="notiz_kategorie">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KATEGORIE_OPTIONS.map(opt => (
                        <SelectItem key={opt.key} value={opt.key}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Priorität</Label>
                  <div className="flex gap-2 flex-wrap">
                    {PRIORITAET_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setState(s => ({ ...s, prioritaetKey: opt.key }))}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                          state.prioritaetKey === opt.key
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

              <Button
                className="w-full"
                disabled={!state.notiz_titel.trim() || !state.notiz_inhalt.trim()}
                onClick={() => setStep(5)}
              >
                Weiter: Prüfen & Bestätigen
                <IconChevronRight size={16} className="ml-1" />
              </Button>
            </>
          )}
        </div>
      )}

      {/* ─── Step 5: Prüfen & Bestätigen ─── */}
      {step === 5 && !done && (
        <SummaryStep
          items={[
            {
              label: 'Termin',
              value: selectedTermin?.fields.terminbezeichnung ?? '—',
              step: 1,
            },
            {
              label: 'Unternehmen',
              value: selectedUnternehmen?.fields.name ?? '—',
            },
            {
              label: 'Termin-Notizen',
              value: state.notizen_termin.trim() || '(keine)',
              step: 2,
            },
            {
              label: 'Protokoll',
              value: state.dokumentenbezeichnung || '—',
              step: 3,
            },
            {
              label: 'Dokumententyp',
              value:
                DOKUMENTENTYP_OPTIONS.find(o => o.key === state.dokumententypKey)?.label ?? '—',
              step: 3,
            },
            {
              label: 'Ergebnis-Notiz',
              value: state.notiz_titel || '—',
              step: 4,
            },
            {
              label: 'Notiz-Inhalt',
              value:
                state.notiz_inhalt.length > 80
                  ? state.notiz_inhalt.slice(0, 80) + '…'
                  : state.notiz_inhalt || '—',
              step: 4,
            },
            {
              label: 'Priorität',
              value:
                PRIORITAET_OPTIONS.find(o => o.key === state.prioritaetKey)?.label ?? '—',
              step: 4,
            },
            {
              label: 'Datum (heute)',
              value: format(new Date(), 'dd.MM.yyyy', { locale: de }),
            },
          ]}
          onEdit={setStep}
          whatHappensNext="Der Termin wird als 'Stattgefunden' markiert, ein Sitzungsprotokoll und eine Ergebnis-Notiz werden beim Unternehmen abgelegt."
          confirmLabel="Termin abschließen & speichern"
          onConfirm={async () => {
            if (await submit()) setStep(6);
          }}
          submitting={submitting}
          missing={missingForConfirm}
          error={submitError}
        />
      )}

      {/* ─── Step 6: Fertig ─── */}
      {step === 6 && result && (
        <SuccessStep
          title={`„${result.terminbezeichnung}" abgeschlossen`}
          details={[
            `Terminstatus auf „Stattgefunden" gesetzt`,
            `Protokoll „${result.dokumentenbezeichnung}" angelegt`,
            `Ergebnis-Notiz „${result.notiz_titel}" erstellt`,
            `Verknüpft mit: ${result.unternehmenName}`,
          ]}
          actions={[
            {
              label: 'Neue Beteiligung aufnehmen',
              href: '#/intents/neue-beteiligung',
            },
            {
              label: 'Weiteren Termin nachbereiten',
              onClick: resetWizard,
            },
            {
              label: 'Zurück zum Dashboard',
              href: '#/',
            },
          ]}
        />
      )}

      {/* Fallback: step 6 without result (shouldn't happen, but safe) */}
      {step === 6 && !result && done && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-muted-foreground">Termin wurde erfolgreich abgeschlossen.</p>
          <Button onClick={resetWizard}>Weiteren Termin nachbereiten</Button>
          <a href="#/" className="text-sm text-muted-foreground underline">
            Zurück zum Dashboard
          </a>
        </div>
      )}
    </IntentWizardShell>
  );
}
