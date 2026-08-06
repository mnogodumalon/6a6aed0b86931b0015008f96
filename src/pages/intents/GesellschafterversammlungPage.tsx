/**
 * Gesellschafterversammlung vorbereiten — 6-Schritt-Wizard.
 * Steps: 1) Unternehmen wählen → 2) Termin anlegen → 3) Protokoll-Dokument erfassen →
 *         4) Besprechungsnotiz anlegen → 5) Zusammenfassung prüfen → 6) Erfolg.
 * Reads: unternehmen, termine. Writes: termine (createTermineEntry), dokumente (createDokumenteEntry),
 *         notizen (createNotizenEntry).
 * Composes: IntentWizardShell, EntitySelectStep, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconBuilding,
  IconCalendarEvent,
  IconFileText,
  IconNotes,
  IconPlus,
} from '@tabler/icons-react';
import { IntentWizardShell, clearIntentDraft } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useIntentSubmit } from '@/hooks/useIntentSubmit';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Unternehmen } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { lookupKey } from '@/lib/formatters';

const DRAFT_KEY = 'intent:gesellschafterversammlung';

interface WizardState {
  unternehmenId: string;
  terminbezeichnung: string;
  datum_uhrzeit: string;
  ort: string;
  erinnerung_tage: string;
  notizen_termin: string;
  dokumentenbezeichnung: string;
  dokumentendatum: string;
  dokumentenlink: string;
  bereitgestellt_von: string;
  notizen_dokument: string;
  notiz_titel: string;
  notiz_inhalt: string;
  prioritaetKey: string;
  schlagwoerter: string;
}

const defaultState: WizardState = {
  unternehmenId: '',
  terminbezeichnung: '',
  datum_uhrzeit: '',
  ort: '',
  erinnerung_tage: '',
  notizen_termin: '',
  dokumentenbezeichnung: '',
  dokumentendatum: '',
  dokumentenlink: '',
  bereitgestellt_von: '',
  notizen_dokument: '',
  notiz_titel: '',
  notiz_inhalt: '',
  prioritaetKey: 'mittel',
  schlagwoerter: '',
};

export default function GesellschafterversammlungPage() {
  const { unternehmen, termine, loading, error, fetchAll } = useDashboardData();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(defaultState);

  const selectedUnternehmen: Unternehmen | undefined = unternehmen.find(
    (u) => u.record_id === state.unternehmenId
  );

  const unternehmenName = selectedUnternehmen?.fields.name ?? '';

  const offeneTermineCount = termine.filter(
    (t) =>
      t.fields.unternehmen?.includes(state.unternehmenId) &&
      lookupKey(t.fields.terminstatus) === 'geplant'
  ).length;

  const update = (patch: Partial<WizardState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const resetWizard = () => {
    setState(defaultState);
    setStep(1);
  };

  const { submit, submitting, error: submitError } = useIntentSubmit(async () => {
    const termin = await LivingAppsService.createTermineEntry({
      terminbezeichnung: state.terminbezeichnung,
      datum_uhrzeit: state.datum_uhrzeit,
      ort: state.ort || undefined,
      erinnerung_tage: state.erinnerung_tage ? Number(state.erinnerung_tage) : undefined,
      notizen_termin: state.notizen_termin || undefined,
      unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, state.unternehmenId),
      terminart: 'gesellschafterversammlung',
      terminstatus: 'geplant',
    });

    await LivingAppsService.createDokumenteEntry({
      dokumentenbezeichnung: state.dokumentenbezeichnung,
      dokumentendatum: state.dokumentendatum || undefined,
      dokumentenlink: state.dokumentenlink || undefined,
      bereitgestellt_von: state.bereitgestellt_von || undefined,
      notizen_dokument: state.notizen_dokument || undefined,
      unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, state.unternehmenId),
      dokumententyp: 'protokoll',
    });

    await LivingAppsService.createNotizenEntry({
      notiz_titel: state.notiz_titel,
      notiz_inhalt: state.notiz_inhalt,
      prioritaet: state.prioritaetKey !== 'none' ? state.prioritaetKey : undefined,
      schlagwoerter: state.schlagwoerter || undefined,
      unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, state.unternehmenId),
      notiz_datum: format(new Date(), 'yyyy-MM-dd'),
      kategorie: 'meeting',
    });

    clearIntentDraft(DRAFT_KEY);
    await fetchAll();
    return termin;
  });

  const activeUnternehmen = unternehmen.filter(
    (u) => lookupKey(u.fields.status) === 'aktiv'
  );

  const steps = [
    { label: 'Unternehmen' },
    { label: 'Termin' },
    { label: 'Protokoll' },
    { label: 'Notiz' },
    { label: 'Prüfen' },
    { label: 'Fertig' },
  ];

  const answers =
    step > 1 && selectedUnternehmen
      ? [
          { label: 'Unternehmen', value: unternehmenName },
          ...(step > 2 && state.terminbezeichnung
            ? [{ label: 'Termin', value: state.terminbezeichnung }]
            : []),
        ]
      : undefined;

  return (
    <IntentWizardShell
      title="Gesellschafterversammlung vorbereiten"
      subtitle="Termin, Protokoll und Notiz in einem Durchgang anlegen"
      steps={steps}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
      intro={{
        description:
          'Legt einen GV-Termin an, erfasst das Protokoll-Dokument und erstellt eine Besprechungsnotiz — alles für ein Portfoliounternehmen in einem Durchgang.',
        requirements: ['Portfoliounternehmen (Status: Aktiv)', 'Datum und Uhrzeit der Versammlung'],
      }}
      answers={answers}
      draftKey={DRAFT_KEY}
      draft={state}
      onDraftRestore={(d) => setState(d as WizardState)}
    >
      {/* Step 1: Unternehmen wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={activeUnternehmen.map((u) => {
            const termineCount = termine.filter(
              (t) =>
                t.fields.unternehmen?.includes(u.record_id) &&
                lookupKey(t.fields.terminstatus) === 'geplant'
            ).length;
            return {
              id: u.record_id,
              title: u.fields.name ?? '(kein Name)',
              subtitle: [
                u.fields.rechtsform?.label,
                u.fields.beteiligungsquote != null
                  ? `${u.fields.beteiligungsquote}% Beteiligung`
                  : undefined,
              ]
                .filter(Boolean)
                .join(' · '),
              status: u.fields.status
                ? { key: u.fields.status.key, label: u.fields.status.label }
                : undefined,
              stats: [{ label: 'Offene Termine', value: termineCount }],
              icon: <IconBuilding size={20} className="text-primary" />,
            };
          })}
          onSelect={(id) => {
            const u = unternehmen.find((x) => x.record_id === id);
            const name = u?.fields.name ?? '';
            update({
              unternehmenId: id,
              terminbezeichnung: `Gesellschafterversammlung ${name}`,
              notiz_titel: `GV-Notizen ${name}`,
            });
            setStep(2);
          }}
          searchPlaceholder="Unternehmen suchen …"
          emptyText="Keine aktiven Unternehmen gefunden."
          emptyIcon={<IconBuilding size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Termin anlegen */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <IconCalendarEvent size={20} className="text-primary" />
            <h2 className="text-lg font-semibold">
              Termin für {unternehmenName} anlegen
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Terminart <b>Gesellschafterversammlung</b> und Status <b>Geplant</b> werden automatisch gesetzt.
          </p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="terminbezeichnung">Terminbezeichnung *</Label>
              <Input
                id="terminbezeichnung"
                value={state.terminbezeichnung}
                onChange={(e) => update({ terminbezeichnung: e.target.value })}
                placeholder={`Gesellschafterversammlung ${unternehmenName}`}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="datum_uhrzeit">Datum & Uhrzeit *</Label>
              <Input
                id="datum_uhrzeit"
                type="datetime-local"
                value={state.datum_uhrzeit}
                onChange={(e) => update({ datum_uhrzeit: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ort">Ort</Label>
              <Input
                id="ort"
                value={state.ort}
                onChange={(e) => update({ ort: e.target.value })}
                placeholder="z. B. Konferenzraum Berlin"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="erinnerung_tage">Erinnerung (Tage vorher)</Label>
              <Input
                id="erinnerung_tage"
                type="number"
                min={0}
                value={state.erinnerung_tage}
                onChange={(e) => update({ erinnerung_tage: e.target.value })}
                placeholder="z. B. 7"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notizen_termin">Notizen zum Termin</Label>
              <Textarea
                id="notizen_termin"
                value={state.notizen_termin}
                onChange={(e) => update({ notizen_termin: e.target.value })}
                placeholder="Agenda, Teilnehmer, Hinweise …"
                rows={3}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Zurück
            </Button>
            <Button
              disabled={!state.terminbezeichnung || !state.datum_uhrzeit}
              onClick={() => setStep(3)}
            >
              Weiter zu Schritt 3
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Protokoll-Dokument anlegen */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <IconFileText size={20} className="text-primary" />
            <h2 className="text-lg font-semibold">
              Protokoll-Dokument für {unternehmenName}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Dokumententyp <b>Sitzungsprotokoll</b> wird automatisch gesetzt.
          </p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dokumentenbezeichnung">Dokumentenbezeichnung *</Label>
              <Input
                id="dokumentenbezeichnung"
                value={state.dokumentenbezeichnung}
                onChange={(e) => update({ dokumentenbezeichnung: e.target.value })}
                placeholder={`Protokoll GV ${state.datum_uhrzeit ? state.datum_uhrzeit.slice(0, 10) : ''}`}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dokumentendatum">Dokumentendatum</Label>
              <Input
                id="dokumentendatum"
                type="date"
                value={state.dokumentendatum}
                onChange={(e) => update({ dokumentendatum: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dokumentenlink">Dokumentenlink (URL)</Label>
              <Input
                id="dokumentenlink"
                type="url"
                value={state.dokumentenlink}
                onChange={(e) => update({ dokumentenlink: e.target.value })}
                placeholder="https://…"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bereitgestellt_von">Bereitgestellt von</Label>
              <Input
                id="bereitgestellt_von"
                value={state.bereitgestellt_von}
                onChange={(e) => update({ bereitgestellt_von: e.target.value })}
                placeholder="z. B. Geschäftsführer Müller"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notizen_dokument">Notizen zum Dokument</Label>
              <Textarea
                id="notizen_dokument"
                value={state.notizen_dokument}
                onChange={(e) => update({ notizen_dokument: e.target.value })}
                placeholder="Hinweise zum Dokument …"
                rows={3}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              Zurück
            </Button>
            <Button
              disabled={!state.dokumentenbezeichnung}
              onClick={() => setStep(4)}
            >
              Weiter zu Schritt 4
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Besprechungsnotiz anlegen */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <IconNotes size={20} className="text-primary" />
            <h2 className="text-lg font-semibold">
              Besprechungsnotiz für {unternehmenName}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Kategorie <b>Meeting</b> und Datum <b>heute</b> werden automatisch gesetzt.
          </p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="notiz_titel">Titel *</Label>
              <Input
                id="notiz_titel"
                value={state.notiz_titel}
                onChange={(e) => update({ notiz_titel: e.target.value })}
                placeholder={`GV-Notizen ${unternehmenName} ${state.datum_uhrzeit ? state.datum_uhrzeit.slice(0, 10) : ''}`}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notiz_inhalt">Inhalt *</Label>
              <Textarea
                id="notiz_inhalt"
                value={state.notiz_inhalt}
                onChange={(e) => update({ notiz_inhalt: e.target.value })}
                placeholder="Beschlüsse, Diskussionspunkte, Maßnahmen …"
                rows={5}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prioritaet">Priorität</Label>
              <Select
                value={state.prioritaetKey}
                onValueChange={(v) => update({ prioritaetKey: v })}
              >
                <SelectTrigger id="prioritaet">
                  <SelectValue placeholder="Priorität wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoch">Hoch</SelectItem>
                  <SelectItem value="mittel">Mittel</SelectItem>
                  <SelectItem value="niedrig">Niedrig</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="schlagwoerter">Schlagwörter</Label>
              <Input
                id="schlagwoerter"
                value={state.schlagwoerter}
                onChange={(e) => update({ schlagwoerter: e.target.value })}
                placeholder="z. B. GV, Beschluss, 2026"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep(3)}>
              Zurück
            </Button>
            <Button
              disabled={!state.notiz_titel || !state.notiz_inhalt}
              onClick={() => setStep(5)}
            >
              Weiter zur Zusammenfassung
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Zusammenfassung (SummaryStep) */}
      {step === 5 && (
        <SummaryStep
          items={[
            { label: 'Unternehmen', value: unternehmenName, step: 1 },
            {
              label: 'Termin',
              value: `${state.terminbezeichnung}${state.datum_uhrzeit ? ' · ' + state.datum_uhrzeit.replace('T', ' ') : ''}${state.ort ? ' · ' + state.ort : ''}`,
              step: 2,
            },
            {
              label: 'Protokoll-Dokument',
              value: `${state.dokumentenbezeichnung}${state.dokumentendatum ? ' · ' + state.dokumentendatum : ''}`,
              step: 3,
            },
            {
              label: 'Besprechungsnotiz',
              value: `${state.notiz_titel} · Priorität: ${state.prioritaetKey}`,
              step: 4,
            },
            {
              label: 'Offene Termine (aktuell)',
              value: `${offeneTermineCount} geplante Termine für ${unternehmenName}`,
            },
            {
              label: 'Abgeleitet',
              value: 'Terminart: Gesellschafterversammlung · Status: Geplant · Dokumententyp: Protokoll · Kategorie: Meeting · Datum: heute',
            },
          ]}
          onEdit={setStep}
          whatHappensNext={`Termin, Protokoll-Dokument und Besprechungsnotiz werden für ${unternehmenName} gleichzeitig angelegt.`}
          confirmLabel="Gesellschafterversammlung anlegen"
          onConfirm={async () => {
            if (await submit()) setStep(6);
          }}
          submitting={submitting}
          error={submitError}
        />
      )}

      {/* Step 6: Erfolg (SuccessStep) */}
      {step === 6 && (
        <SuccessStep
          title={`Gesellschafterversammlung für ${unternehmenName} vorbereitet`}
          details={[
            `Termin „${state.terminbezeichnung}" angelegt (Status: Geplant)`,
            `Protokoll-Dokument „${state.dokumentenbezeichnung}" erfasst`,
            `Besprechungsnotiz „${state.notiz_titel}" erstellt`,
          ]}
          actions={[
            {
              label: 'Weiteres Unternehmen vorbereiten',
              onClick: resetWizard,
              icon: <IconPlus size={16} />,
            },
            { label: 'Zurück zum Dashboard', href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
