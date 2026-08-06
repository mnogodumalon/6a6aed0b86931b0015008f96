/**
 * Neue Beteiligung — 5-Schritt-Wizard.
 * Steps: 1) Unternehmensdaten erfassen → 2) Ersten Termin planen → 3) Erstes Dokument hinterlegen → 4) Prüfen → 5) Fertig.
 * Reads: unternehmen (für Kontext-Statistik).
 * Writes: unternehmen (createUnternehmenEntry), termine (createTermineEntry), dokumente (createDokumenteEntry).
 * Composes: IntentWizardShell, SummaryStep, SuccessStep.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconBuildingSkyscraper,
  IconCalendarEvent,
  IconFileDescription,
  IconCheck,
} from '@tabler/icons-react';

import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';

import { useDashboardData } from '@/hooks/useDashboardData';
import { useIntentSubmit } from '@/hooks/useIntentSubmit';

import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';

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

// ─── Lookup options ──────────────────────────────────────────────────────────
const RECHTSFORM_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['rechtsform'] ?? [];
const BRANCHE_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['branche'] ?? [];
const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];

// ─── Draft shape ─────────────────────────────────────────────────────────────
interface DraftState {
  // Step 1 — Unternehmen
  name: string;
  rechtsformKey: string;
  brancheKey: string;
  investiertes_kapital: string;
  beteiligungsquote: string;
  investitionsdatum: string;
  stadt: string;
  land: string;
  ansprechpartner_vorname: string;
  ansprechpartner_nachname: string;
  ansprechpartner_email: string;
  // Step 2 — Termin
  terminbezeichnung: string;
  terminartKey: string;
  datum_uhrzeit: string;
  ort: string;
  // Step 3 — Dokument
  dokumentenbezeichnung: string;
  dokumententypKey: string;
  dokumentendatum: string;
  dokumentenlink: string;
  bereitgestellt_von: string;
}

const INITIAL_STATE: DraftState = {
  name: '',
  rechtsformKey: '',
  brancheKey: '',
  investiertes_kapital: '',
  beteiligungsquote: '',
  investitionsdatum: '',
  stadt: '',
  land: '',
  ansprechpartner_vorname: '',
  ansprechpartner_nachname: '',
  ansprechpartner_email: '',
  terminbezeichnung: '',
  terminartKey: TERMINART_OPTIONS[0]?.key ?? '',
  datum_uhrzeit: '',
  ort: '',
  dokumentenbezeichnung: '',
  dokumententypKey: 'beteiligungsvertrag',
  dokumentendatum: '',
  dokumentenlink: '',
  bereitgestellt_von: '',
};

const DRAFT_KEY = 'intent:neue-beteiligung';

const STEPS = [
  { label: 'Unternehmen' },
  { label: 'Termin' },
  { label: 'Dokument' },
  { label: 'Prüfen' },
  { label: 'Fertig' },
];

export default function NeueBeteiligungPage() {
  const { unternehmen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [state, setState] = useState<DraftState>(INITIAL_STATE);

  // Idempotency ids for chained creates
  const [unternehmenId, setUnternehmenId] = useState<string | null>(null);
  const [terminId, setTerminId] = useState<string | null>(null);
  const [dokumentId, setDokumentId] = useState<string | null>(null);

  const { submit, submitting, error: submitError, result, reset } = useIntentSubmit(
    async () => {
      // Guard: create unternehmen only once
      let uid = unternehmenId;
      if (!uid) {
        const u = await LivingAppsService.createUnternehmenEntry({
          name: state.name,
          rechtsform: state.rechtsformKey || undefined,
          branche: state.brancheKey || undefined,
          investiertes_kapital: state.investiertes_kapital ? Number(state.investiertes_kapital) : undefined,
          beteiligungsquote: state.beteiligungsquote ? Number(state.beteiligungsquote) : undefined,
          investitionsdatum: state.investitionsdatum || undefined,
          stadt: state.stadt || undefined,
          land: state.land || undefined,
          ansprechpartner_vorname: state.ansprechpartner_vorname || undefined,
          ansprechpartner_nachname: state.ansprechpartner_nachname || undefined,
          ansprechpartner_email: state.ansprechpartner_email || undefined,
          status: 'aktiv',
        });
        uid = u.record_id;
        setUnternehmenId(uid);
      }

      // Guard: create termin only once
      let tid = terminId;
      if (!tid) {
        const t = await LivingAppsService.createTermineEntry({
          terminbezeichnung: state.terminbezeichnung,
          terminart: state.terminartKey || undefined,
          datum_uhrzeit: state.datum_uhrzeit || undefined,
          ort: state.ort || undefined,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, uid),
        });
        tid = t.record_id;
        setTerminId(tid);
      }

      // Guard: create dokument only once
      let did = dokumentId;
      if (!did) {
        const d = await LivingAppsService.createDokumenteEntry({
          dokumentenbezeichnung: state.dokumentenbezeichnung,
          dokumententyp: state.dokumententypKey || undefined,
          dokumentendatum: state.dokumentendatum || undefined,
          dokumentenlink: state.dokumentenlink || undefined,
          bereitgestellt_von: state.bereitgestellt_von || undefined,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, uid),
        });
        did = d.record_id;
        setDokumentId(did);
      }

      await fetchAll();

      return {
        unternehmenId: uid,
        unternehmensname: state.name,
        terminbezeichnung: state.terminbezeichnung,
        dokumentenbezeichnung: state.dokumentenbezeichnung,
      };
    },
    { draftKey: DRAFT_KEY }
  );

  const aktiveUnternehmen = unternehmen.filter(
    (u) => u.fields.status?.key === 'aktiv'
  ).length;

  const resetWizard = () => {
    setState(INITIAL_STATE);
    setUnternehmenId(null);
    setTerminId(null);
    setDokumentId(null);
    reset();
    setStep(1);
  };

  const set = (key: keyof DraftState, value: string) =>
    setState((s) => ({ ...s, [key]: value }));

  // Missing required fields for SummaryStep
  const missing: string[] = [];
  if (!state.name.trim()) missing.push('Unternehmensname');
  if (!state.terminbezeichnung.trim()) missing.push('Terminbezeichnung');
  if (!state.datum_uhrzeit) missing.push('Datum & Uhrzeit');
  if (!state.dokumentenbezeichnung.trim()) missing.push('Dokumentenbezeichnung');

  const rechtsformLabel = RECHTSFORM_OPTIONS.find((o) => o.key === state.rechtsformKey)?.label ?? '—';
  const brancheLabel = BRANCHE_OPTIONS.find((o) => o.key === state.brancheKey)?.label ?? '—';
  const terminartLabel = TERMINART_OPTIONS.find((o) => o.key === state.terminartKey)?.label ?? '—';
  const dokumententypLabel = DOKUMENTENTYP_OPTIONS.find((o) => o.key === state.dokumententypKey)?.label ?? '—';

  return (
    <IntentWizardShell
      title="Neue Beteiligung anlegen"
      subtitle="Unternehmen, Onboarding-Termin und Beteiligungsvertrag in einem Flow"
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
      intro={{
        description:
          'Legt ein neues Portfolio-Unternehmen an, plant das Onboarding-Meeting und hinterlegt den Beteiligungsvertrag — alles in einem Durchgang.',
        requirements: [
          'Name des Unternehmens',
          'Datum für das Onboarding-Meeting',
          'Bezeichnung des Beteiligungsvertrags',
        ],
      }}
      answers={
        step > 1 && state.name
          ? [
              { label: 'Unternehmen', value: state.name },
              ...(step > 2 && state.terminbezeichnung
                ? [{ label: 'Termin', value: state.terminbezeichnung }]
                : []),
            ]
          : undefined
      }
      draftKey={DRAFT_KEY}
      draft={state}
      onDraftRestore={(d) => setState(d as DraftState)}
    >
      {/* ─── Step 1: Unternehmensdaten ─────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <IconBuildingSkyscraper size={20} className="text-primary" />
            <h2 className="text-base font-semibold">Stammdaten des Unternehmens</h2>
          </div>

          <div className="rounded-2xl border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
            Bereits im Portfolio:{' '}
            <span className="font-semibold text-foreground">{aktiveUnternehmen} aktive Beteiligungen</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="name">Unternehmensname *</Label>
              <Input
                id="name"
                value={state.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="z. B. Muster GmbH"
              />
            </div>

            <div className="space-y-1">
              <Label>Rechtsform</Label>
              <Select value={state.rechtsformKey || 'none'} onValueChange={(v) => set('rechtsformKey', v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Rechtsform wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Angabe</SelectItem>
                  {RECHTSFORM_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Branche</Label>
              <Select value={state.brancheKey || 'none'} onValueChange={(v) => set('brancheKey', v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Branche wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Angabe</SelectItem>
                  {BRANCHE_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="investiertes_kapital">Investiertes Kapital (€)</Label>
              <Input
                id="investiertes_kapital"
                type="number"
                min="0"
                value={state.investiertes_kapital}
                onChange={(e) => set('investiertes_kapital', e.target.value)}
                placeholder="z. B. 500000"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="beteiligungsquote">Beteiligungsquote (%)</Label>
              <Input
                id="beteiligungsquote"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={state.beteiligungsquote}
                onChange={(e) => set('beteiligungsquote', e.target.value)}
                placeholder="z. B. 25"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="investitionsdatum">Investitionsdatum</Label>
              <Input
                id="investitionsdatum"
                type="date"
                value={state.investitionsdatum}
                onChange={(e) => set('investitionsdatum', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="stadt">Stadt</Label>
              <Input
                id="stadt"
                value={state.stadt}
                onChange={(e) => set('stadt', e.target.value)}
                placeholder="z. B. Berlin"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="land">Land</Label>
              <Input
                id="land"
                value={state.land}
                onChange={(e) => set('land', e.target.value)}
                placeholder="z. B. Deutschland"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <p className="text-sm font-medium text-muted-foreground pt-1">Ansprechpartner (optional)</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ap_vorname">Vorname</Label>
              <Input
                id="ap_vorname"
                value={state.ansprechpartner_vorname}
                onChange={(e) => set('ansprechpartner_vorname', e.target.value)}
                placeholder="Vorname"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="ap_nachname">Nachname</Label>
              <Input
                id="ap_nachname"
                value={state.ansprechpartner_nachname}
                onChange={(e) => set('ansprechpartner_nachname', e.target.value)}
                placeholder="Nachname"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ap_email">E-Mail</Label>
              <Input
                id="ap_email"
                type="email"
                value={state.ansprechpartner_email}
                onChange={(e) => set('ansprechpartner_email', e.target.value)}
                placeholder="kontakt@beispiel.de"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Status wird automatisch auf „Aktiv" gesetzt.
          </p>

          <Button
            className="w-full"
            disabled={!state.name.trim()}
            onClick={() => setStep(2)}
          >
            Weiter: Onboarding-Termin planen
          </Button>
        </div>
      )}

      {/* ─── Step 2: Erster Termin ──────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <IconCalendarEvent size={20} className="text-primary" />
            <h2 className="text-base font-semibold">
              Onboarding-Meeting für {state.name} planen
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="terminbezeichnung">Terminbezeichnung *</Label>
              <Input
                id="terminbezeichnung"
                value={state.terminbezeichnung}
                onChange={(e) => set('terminbezeichnung', e.target.value)}
                placeholder={`Onboarding ${state.name}`}
              />
            </div>

            <div className="space-y-1">
              <Label>Terminart *</Label>
              <Select
                value={state.terminartKey || TERMINART_OPTIONS[0]?.key || 'none'}
                onValueChange={(v) => set('terminartKey', v === 'none' ? '' : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Terminart wählen" />
                </SelectTrigger>
                <SelectContent>
                  {TERMINART_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="datum_uhrzeit">Datum & Uhrzeit *</Label>
              <Input
                id="datum_uhrzeit"
                type="datetime-local"
                value={state.datum_uhrzeit}
                onChange={(e) => set('datum_uhrzeit', e.target.value)}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ort">Ort</Label>
              <Input
                id="ort"
                value={state.ort}
                onChange={(e) => set('ort', e.target.value)}
                placeholder="z. B. Büro Berlin, Videokonferenz"
              />
            </div>
          </div>

          <Button
            className="w-full"
            disabled={!state.terminbezeichnung.trim() || !state.datum_uhrzeit || !state.terminartKey}
            onClick={() => setStep(3)}
          >
            Weiter: Beteiligungsvertrag hinterlegen
          </Button>
        </div>
      )}

      {/* ─── Step 3: Erstes Dokument ────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <IconFileDescription size={20} className="text-primary" />
            <h2 className="text-base font-semibold">
              Beteiligungsvertrag für {state.name} hinterlegen
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="dokumentenbezeichnung">Dokumentenbezeichnung *</Label>
              <Input
                id="dokumentenbezeichnung"
                value={state.dokumentenbezeichnung}
                onChange={(e) => set('dokumentenbezeichnung', e.target.value)}
                placeholder={`Beteiligungsvertrag ${state.name}`}
              />
            </div>

            <div className="space-y-1">
              <Label>Dokumententyp</Label>
              <Select
                value={state.dokumententypKey || 'none'}
                onValueChange={(v) => set('dokumententypKey', v === 'none' ? '' : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Typ wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Angabe</SelectItem>
                  {DOKUMENTENTYP_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dokumentendatum">Dokumentendatum</Label>
              <Input
                id="dokumentendatum"
                type="date"
                value={state.dokumentendatum}
                onChange={(e) => set('dokumentendatum', e.target.value)}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="dokumentenlink">Link zum Dokument (URL)</Label>
              <Input
                id="dokumentenlink"
                type="url"
                value={state.dokumentenlink}
                onChange={(e) => set('dokumentenlink', e.target.value)}
                placeholder="https://drive.example.com/..."
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="bereitgestellt_von">Bereitgestellt von</Label>
              <Input
                id="bereitgestellt_von"
                value={state.bereitgestellt_von}
                onChange={(e) => set('bereitgestellt_von', e.target.value)}
                placeholder="z. B. Kanzlei Mustermann"
              />
            </div>
          </div>

          <Button
            className="w-full"
            disabled={!state.dokumentenbezeichnung.trim()}
            onClick={() => setStep(4)}
          >
            Weiter: Alles prüfen
          </Button>
        </div>
      )}

      {/* ─── Step 4: Prüfen ─────────────────────────────────────────────────── */}
      {step === 4 && !result && (
        <SummaryStep
          items={[
            { label: 'Unternehmensname', value: state.name, step: 1 },
            { label: 'Rechtsform', value: rechtsformLabel, step: 1 },
            { label: 'Branche', value: brancheLabel, step: 1 },
            {
              label: 'Investiertes Kapital',
              value: state.investiertes_kapital
                ? `${Number(state.investiertes_kapital).toLocaleString('de-DE')} €`
                : '—',
              step: 1,
            },
            {
              label: 'Beteiligungsquote',
              value: state.beteiligungsquote ? `${state.beteiligungsquote} %` : '—',
              step: 1,
            },
            {
              label: 'Investitionsdatum',
              value: state.investitionsdatum
                ? format(new Date(state.investitionsdatum + 'T00:00'), 'dd.MM.yyyy')
                : '—',
              step: 1,
            },
            {
              label: 'Standort',
              value: [state.stadt, state.land].filter(Boolean).join(', ') || '—',
              step: 1,
            },
            {
              label: 'Ansprechpartner',
              value:
                [state.ansprechpartner_vorname, state.ansprechpartner_nachname]
                  .filter(Boolean)
                  .join(' ') || '—',
              step: 1,
            },
            { label: 'Status (automatisch)', value: 'Aktiv' },
            { label: 'Terminbezeichnung', value: state.terminbezeichnung, step: 2 },
            { label: 'Terminart', value: terminartLabel, step: 2 },
            {
              label: 'Datum & Uhrzeit',
              value: state.datum_uhrzeit
                ? format(new Date(state.datum_uhrzeit), "dd.MM.yyyy 'um' HH:mm 'Uhr'")
                : '—',
              step: 2,
            },
            { label: 'Ort', value: state.ort || '—', step: 2 },
            { label: 'Dokumentenbezeichnung', value: state.dokumentenbezeichnung, step: 3 },
            { label: 'Dokumententyp', value: dokumententypLabel, step: 3 },
            {
              label: 'Dokumentendatum',
              value: state.dokumentendatum
                ? format(new Date(state.dokumentendatum + 'T00:00'), 'dd.MM.yyyy')
                : '—',
              step: 3,
            },
            { label: 'Bereitgestellt von', value: state.bereitgestellt_von || '—', step: 3 },
          ]}
          onEdit={setStep}
          whatHappensNext={`Das Unternehmen „${state.name}" wird als aktive Beteiligung angelegt, der Onboarding-Termin wird eingetragen und der Beteiligungsvertrag wird hinterlegt.`}
          confirmLabel="Beteiligung anlegen"
          onConfirm={async () => {
            if (await submit()) setStep(5);
          }}
          submitting={submitting}
          missing={missing}
          error={submitError}
        />
      )}

      {/* ─── Step 5: Fertig ─────────────────────────────────────────────────── */}
      {step === 5 && result && (
        <SuccessStep
          title={`${result.unternehmensname} erfolgreich angelegt`}
          details={[
            `Unternehmen „${result.unternehmensname}" als aktive Beteiligung angelegt`,
            `Termin „${result.terminbezeichnung}" geplant`,
            `Dokument „${result.dokumentenbezeichnung}" hinterlegt`,
            'Status automatisch auf „Aktiv" gesetzt',
          ]}
          actions={[
            {
              label: 'Weiter: Termin nachbereiten',
              href: '#/intents/termin-nachbereiten',
              icon: <IconCheck size={16} />,
            },
            {
              label: 'Weitere Beteiligung anlegen',
              onClick: resetWizard,
            },
            {
              label: 'Zurück zum Dashboard',
              href: '#/',
            },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
