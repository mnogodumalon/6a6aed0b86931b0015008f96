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

import { makeT } from '@/i18n';

const tt = makeT({
  de: {
    unternehmen: 'Unternehmen',
    termin: 'Termin',
    dokument: 'Dokument',
    pruefen: 'Prüfen',
    fertig: 'Fertig',
    datum_uhrzeit: 'Datum & Uhrzeit',
    neue_beteiligung_anlegen: 'Neue Beteiligung anlegen',
    unternehmen_onboarding_termin_un: 'Unternehmen, Onboarding-Termin und Beteiligungsvertrag in einem Flow',
    legt_ein_neues_portfolio_unterne: 'Legt ein neues Portfolio-Unternehmen an, plant das Onboarding-Meeting und hinterlegt den Beteiligungsvertrag — alles in einem Durchgang.',
    stammdaten_des_unternehmens: 'Stammdaten des Unternehmens',
    bereits_im_portfolio: 'Bereits im Portfolio:',
    aktive_beteiligungen: 'aktive Beteiligungen',
    unternehmensname: 'Unternehmensname *',
    z_b_muster_gmbh: 'z. B. Muster GmbH',
    rechtsform: 'Rechtsform',
    rechtsform_waehlen: 'Rechtsform wählen',
    keine_angabe: 'Keine Angabe',
    branche: 'Branche',
    branche_waehlen: 'Branche wählen',
    investiertes_kapital: 'Investiertes Kapital (€)',
    beteiligungsquote: 'Beteiligungsquote (%)',
    investitionsdatum: 'Investitionsdatum',
    stadt: 'Stadt',
    z_b_berlin: 'z. B. Berlin',
    land: 'Land',
    z_b_deutschland: 'z. B. Deutschland',
    ansprechpartner_optional: 'Ansprechpartner (optional)',
    vorname: 'Vorname',
    nachname: 'Nachname',
    e_mail: 'E-Mail',
    kontakt_beispiel_de: 'kontakt@beispiel.de',
    status_wird_automatisch_auf_akti: 'Status wird automatisch auf „Aktiv" gesetzt.',
    weiter_onboarding_termin_planen: 'Weiter: Onboarding-Termin planen',
    onboarding_meeting_fuer: 'Onboarding-Meeting für',
    planen: 'planen',
    terminbezeichnung: 'Terminbezeichnung *',
    onboarding: 'Onboarding {p0}',
    terminart: 'Terminart *',
    terminart_waehlen: 'Terminart wählen',
    datum_uhrzeit_2: 'Datum & Uhrzeit *',
    ort: 'Ort',
    z_b_buero_berlin_videokonferenz: 'z. B. Büro Berlin, Videokonferenz',
    weiter_beteiligungsvertrag_hinte: 'Weiter: Beteiligungsvertrag hinterlegen',
    beteiligungsvertrag_fuer: 'Beteiligungsvertrag für',
    hinterlegen: 'hinterlegen',
    dokumentenbezeichnung: 'Dokumentenbezeichnung *',
    beteiligungsvertrag: 'Beteiligungsvertrag {p0}',
    dokumententyp: 'Dokumententyp',
    typ_waehlen: 'Typ wählen',
    dokumentendatum: 'Dokumentendatum',
    link_zum_dokument_url: 'Link zum Dokument (URL)',
    https_drive_example_com: 'https://drive.example.com/...',
    bereitgestellt_von: 'Bereitgestellt von',
    z_b_kanzlei_mustermann: 'z. B. Kanzlei Mustermann',
    weiter_alles_pruefen: 'Weiter: Alles prüfen',
    unternehmensname_2: 'Unternehmensname',
    investiertes_kapital_2: 'Investiertes Kapital',
    beteiligungsquote_2: 'Beteiligungsquote',
    standort: 'Standort',
    ansprechpartner: 'Ansprechpartner',
    status_automatisch: 'Status (automatisch)',
    terminbezeichnung_2: 'Terminbezeichnung',
    terminart_2: 'Terminart',
    dokumentenbezeichnung_2: 'Dokumentenbezeichnung',
    das_unternehmen_wird_als_aktive: 'Das Unternehmen „{p0}" wird als aktive Beteiligung angelegt, der Onboarding-Termin wird eingetragen und der Beteiligungsvertrag wird hinterlegt.',
    unternehmen_als_aktive_beteiligu: 'Unternehmen „{p0}" als aktive Beteiligung angelegt',
    termin_geplant: 'Termin „{p0}" geplant',
    dokument_hinterlegt: 'Dokument „{p0}" hinterlegt',
    weiter_termin_nachbereiten: 'Weiter: Termin nachbereiten',
    weitere_beteiligung_anlegen: 'Weitere Beteiligung anlegen',
    zurueck_zum_dashboard: 'Zurück zum Dashboard',
  },
  en: {
    unternehmen: 'Company',
    termin: 'Appointment',
    dokument: 'Document',
    pruefen: 'Review',
    fertig: 'Finish',
    datum_uhrzeit: 'Date & Time',
    neue_beteiligung_anlegen: 'Add New Investment',
    unternehmen_onboarding_termin_un: 'Company, Onboarding Appointment, and Participation Agreement in One Flow',
    legt_ein_neues_portfolio_unterne: 'Creates a new portfolio company, schedules the onboarding meeting, and stores the participation agreement — all in one go.',
    stammdaten_des_unternehmens: 'Master Data of the Company',
    bereits_im_portfolio: 'Already in Portfolio:',
    aktive_beteiligungen: 'active participations',
    unternehmensname: 'Company Name *',
    z_b_muster_gmbh: 'e.g. Sample LLC',
    rechtsform: 'Legal Form',
    rechtsform_waehlen: 'Select Legal Form',
    keine_angabe: 'Not Specified',
    branche: 'Industry',
    branche_waehlen: 'Select Industry',
    investiertes_kapital: 'Invested Capital (€)',
    beteiligungsquote: 'Participation Ratio (%)',
    investitionsdatum: 'Investment Date',
    stadt: 'City',
    z_b_berlin: 'e.g. Berlin',
    land: 'Country',
    z_b_deutschland: 'e.g. Germany',
    ansprechpartner_optional: 'Contact Person (optional)',
    vorname: 'First Name',
    nachname: 'Last Name',
    e_mail: 'E-Mail',
    kontakt_beispiel_de: 'contact@example.com',
    status_wird_automatisch_auf_akti: 'Status will be set to "Active" automatically.',
    weiter_onboarding_termin_planen: 'Next: Schedule Onboarding Appointment',
    onboarding_meeting_fuer: 'Schedule Onboarding Meeting for',
    planen: 'schedule',
    terminbezeichnung: 'Appointment Title *',
    onboarding: 'Onboarding {p0}',
    terminart: 'Appointment Type *',
    terminart_waehlen: 'Select Appointment Type',
    datum_uhrzeit_2: 'Date & Time *',
    ort: 'Location',
    z_b_buero_berlin_videokonferenz: 'e.g. Berlin Office, Video Conference',
    weiter_beteiligungsvertrag_hinte: 'Next: Store Participation Agreement',
    beteiligungsvertrag_fuer: 'Participation Agreement for',
    hinterlegen: 'store',
    dokumentenbezeichnung: 'Document Title *',
    beteiligungsvertrag: 'Participation Agreement {p0}',
    dokumententyp: 'Document Type',
    typ_waehlen: 'Select Type',
    dokumentendatum: 'Document Date',
    link_zum_dokument_url: 'Link to Document (URL)',
    https_drive_example_com: 'https://drive.example.com/...',
    bereitgestellt_von: 'Provided by',
    z_b_kanzlei_mustermann: 'e.g. Law Firm Mustermann',
    weiter_alles_pruefen: 'Next: Review All',
    unternehmensname_2: 'Company Name',
    investiertes_kapital_2: 'Invested Capital',
    beteiligungsquote_2: 'Ownership Stake',
    standort: 'Location',
    ansprechpartner: 'Contact Person',
    status_automatisch: 'Status (automatic)',
    terminbezeichnung_2: 'Appointment Title',
    terminart_2: 'Appointment Type',
    dokumentenbezeichnung_2: 'Document Title',
    das_unternehmen_wird_als_aktive: 'The company "{p0}" will be created as an active participation, the onboarding appointment will be entered, and the participation agreement will be stored.',
    unternehmen_als_aktive_beteiligu: 'Company "{p0}" created as active participation',
    termin_geplant: 'Appointment "{p0}" scheduled',
    dokument_hinterlegt: 'Document "{p0}" stored',
    weiter_termin_nachbereiten: 'Next: Follow Up Appointment',
    weitere_beteiligung_anlegen: 'Add Another Participation',
    zurueck_zum_dashboard: 'Back to Dashboard',
  },
});

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

export default function NeueBeteiligungPage() {
  const STEPS = [
  { label: tt('unternehmen') },
  { label: tt('termin') },
  { label: tt('dokument') },
  { label: tt('pruefen') },
  { label: tt('fertig') },
];

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
  if (!state.name.trim()) missing.push(tt('unternehmensname_2'));
  if (!state.terminbezeichnung.trim()) missing.push(tt('terminbezeichnung_2'));
  if (!state.datum_uhrzeit) missing.push(tt('datum_uhrzeit'));
  if (!state.dokumentenbezeichnung.trim()) missing.push(tt('dokumentenbezeichnung_2'));

  const rechtsformLabel = RECHTSFORM_OPTIONS.find((o) => o.key === state.rechtsformKey)?.label ?? '—';
  const brancheLabel = BRANCHE_OPTIONS.find((o) => o.key === state.brancheKey)?.label ?? '—';
  const terminartLabel = TERMINART_OPTIONS.find((o) => o.key === state.terminartKey)?.label ?? '—';
  const dokumententypLabel = DOKUMENTENTYP_OPTIONS.find((o) => o.key === state.dokumententypKey)?.label ?? '—';

  return (
    <IntentWizardShell
      title={tt('neue_beteiligung_anlegen')}
      subtitle={tt('unternehmen_onboarding_termin_un')}
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
      intro={{
        description:
          tt('legt_ein_neues_portfolio_unterne'),
        requirements: [
          'Name des Unternehmens',
          'Datum für das Onboarding-Meeting',
          'Bezeichnung des Beteiligungsvertrags',
        ],
      }}
      answers={
        step > 1 && state.name
          ? [
              { label: tt('unternehmen'), value: state.name },
              ...(step > 2 && state.terminbezeichnung
                ? [{ label: tt('termin'), value: state.terminbezeichnung }]
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
            <h2 className="text-base font-semibold">{tt('stammdaten_des_unternehmens')}</h2>
          </div>

          <div className="rounded-2xl border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
            {tt('bereits_im_portfolio')}{' '}
            <span className="font-semibold text-foreground">{aktiveUnternehmen} {tt('aktive_beteiligungen')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="name">{tt('unternehmensname')}</Label>
              <Input
                id="name"
                value={state.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder={tt('z_b_muster_gmbh')}
              />
            </div>

            <div className="space-y-1">
              <Label>{tt('rechtsform')}</Label>
              <Select value={state.rechtsformKey || 'none'} onValueChange={(v) => set('rechtsformKey', v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={tt('rechtsform_waehlen')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tt('keine_angabe')}</SelectItem>
                  {RECHTSFORM_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{tt('branche')}</Label>
              <Select value={state.brancheKey || 'none'} onValueChange={(v) => set('brancheKey', v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={tt('branche_waehlen')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tt('keine_angabe')}</SelectItem>
                  {BRANCHE_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="investiertes_kapital">{tt('investiertes_kapital')}</Label>
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
              <Label htmlFor="beteiligungsquote">{tt('beteiligungsquote')}</Label>
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
              <Label htmlFor="investitionsdatum">{tt('investitionsdatum')}</Label>
              <Input
                id="investitionsdatum"
                type="date"
                value={state.investitionsdatum}
                onChange={(e) => set('investitionsdatum', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="stadt">{tt('stadt')}</Label>
              <Input
                id="stadt"
                value={state.stadt}
                onChange={(e) => set('stadt', e.target.value)}
                placeholder={tt('z_b_berlin')}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="land">{tt('land')}</Label>
              <Input
                id="land"
                value={state.land}
                onChange={(e) => set('land', e.target.value)}
                placeholder={tt('z_b_deutschland')}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <p className="text-sm font-medium text-muted-foreground pt-1">{tt('ansprechpartner_optional')}</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ap_vorname">{tt('vorname')}</Label>
              <Input
                id="ap_vorname"
                value={state.ansprechpartner_vorname}
                onChange={(e) => set('ansprechpartner_vorname', e.target.value)}
                placeholder={tt('vorname')}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="ap_nachname">{tt('nachname')}</Label>
              <Input
                id="ap_nachname"
                value={state.ansprechpartner_nachname}
                onChange={(e) => set('ansprechpartner_nachname', e.target.value)}
                placeholder={tt('nachname')}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ap_email">{tt('e_mail')}</Label>
              <Input
                id="ap_email"
                type="email"
                value={state.ansprechpartner_email}
                onChange={(e) => set('ansprechpartner_email', e.target.value)}
                placeholder={tt('kontakt_beispiel_de')}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {tt('status_wird_automatisch_auf_akti')}
          </p>

          <Button
            className="w-full"
            disabled={!state.name.trim()}
            onClick={() => setStep(2)}
          >
            {tt('weiter_onboarding_termin_planen')}
          </Button>
        </div>
      )}

      {/* ─── Step 2: Erster Termin ──────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <IconCalendarEvent size={20} className="text-primary" />
            <h2 className="text-base font-semibold">
              {tt('onboarding_meeting_fuer')} {state.name} {tt('planen')}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="terminbezeichnung">{tt('terminbezeichnung')}</Label>
              <Input
                id="terminbezeichnung"
                value={state.terminbezeichnung}
                onChange={(e) => set('terminbezeichnung', e.target.value)}
                placeholder={tt('onboarding', { p0: state.name })}
              />
            </div>

            <div className="space-y-1">
              <Label>{tt('terminart')}</Label>
              <Select
                value={state.terminartKey || TERMINART_OPTIONS[0]?.key || 'none'}
                onValueChange={(v) => set('terminartKey', v === 'none' ? '' : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={tt('terminart_waehlen')} />
                </SelectTrigger>
                <SelectContent>
                  {TERMINART_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="datum_uhrzeit">{tt('datum_uhrzeit_2')}</Label>
              <Input
                id="datum_uhrzeit"
                type="datetime-local"
                value={state.datum_uhrzeit}
                onChange={(e) => set('datum_uhrzeit', e.target.value)}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ort">{tt('ort')}</Label>
              <Input
                id="ort"
                value={state.ort}
                onChange={(e) => set('ort', e.target.value)}
                placeholder={tt('z_b_buero_berlin_videokonferenz')}
              />
            </div>
          </div>

          <Button
            className="w-full"
            disabled={!state.terminbezeichnung.trim() || !state.datum_uhrzeit || !state.terminartKey}
            onClick={() => setStep(3)}
          >
            {tt('weiter_beteiligungsvertrag_hinte')}
          </Button>
        </div>
      )}

      {/* ─── Step 3: Erstes Dokument ────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <IconFileDescription size={20} className="text-primary" />
            <h2 className="text-base font-semibold">
              {tt('beteiligungsvertrag_fuer')} {state.name} {tt('hinterlegen')}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="dokumentenbezeichnung">{tt('dokumentenbezeichnung')}</Label>
              <Input
                id="dokumentenbezeichnung"
                value={state.dokumentenbezeichnung}
                onChange={(e) => set('dokumentenbezeichnung', e.target.value)}
                placeholder={tt('beteiligungsvertrag', { p0: state.name })}
              />
            </div>

            <div className="space-y-1">
              <Label>{tt('dokumententyp')}</Label>
              <Select
                value={state.dokumententypKey || 'none'}
                onValueChange={(v) => set('dokumententypKey', v === 'none' ? '' : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={tt('typ_waehlen')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tt('keine_angabe')}</SelectItem>
                  {DOKUMENTENTYP_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dokumentendatum">{tt('dokumentendatum')}</Label>
              <Input
                id="dokumentendatum"
                type="date"
                value={state.dokumentendatum}
                onChange={(e) => set('dokumentendatum', e.target.value)}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="dokumentenlink">{tt('link_zum_dokument_url')}</Label>
              <Input
                id="dokumentenlink"
                type="url"
                value={state.dokumentenlink}
                onChange={(e) => set('dokumentenlink', e.target.value)}
                placeholder={tt('https_drive_example_com')}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="bereitgestellt_von">{tt('bereitgestellt_von')}</Label>
              <Input
                id="bereitgestellt_von"
                value={state.bereitgestellt_von}
                onChange={(e) => set('bereitgestellt_von', e.target.value)}
                placeholder={tt('z_b_kanzlei_mustermann')}
              />
            </div>
          </div>

          <Button
            className="w-full"
            disabled={!state.dokumentenbezeichnung.trim()}
            onClick={() => setStep(4)}
          >
            {tt('weiter_alles_pruefen')}
          </Button>
        </div>
      )}

      {/* ─── Step 4: Prüfen ─────────────────────────────────────────────────── */}
      {step === 4 && !result && (
        <SummaryStep
          items={[
            { label: tt('unternehmensname_2'), value: state.name, step: 1 },
            { label: tt('rechtsform'), value: rechtsformLabel, step: 1 },
            { label: tt('branche'), value: brancheLabel, step: 1 },
            {
              label: tt('investiertes_kapital_2'),
              value: state.investiertes_kapital
                ? `${Number(state.investiertes_kapital).toLocaleString('de-DE')} €`
                : '—',
              step: 1,
            },
            {
              label: tt('beteiligungsquote_2'),
              value: state.beteiligungsquote ? `${state.beteiligungsquote} %` : '—',
              step: 1,
            },
            {
              label: tt('investitionsdatum'),
              value: state.investitionsdatum
                ? format(new Date(state.investitionsdatum + 'T00:00'), 'dd.MM.yyyy')
                : '—',
              step: 1,
            },
            {
              label: tt('standort'),
              value: [state.stadt, state.land].filter(Boolean).join(', ') || '—',
              step: 1,
            },
            {
              label: tt('ansprechpartner'),
              value:
                [state.ansprechpartner_vorname, state.ansprechpartner_nachname]
                  .filter(Boolean)
                  .join(' ') || '—',
              step: 1,
            },
            { label: tt('status_automatisch'), value: 'Aktiv' },
            { label: tt('terminbezeichnung_2'), value: state.terminbezeichnung, step: 2 },
            { label: tt('terminart_2'), value: terminartLabel, step: 2 },
            {
              label: tt('datum_uhrzeit'),
              value: state.datum_uhrzeit
                ? format(new Date(state.datum_uhrzeit), "dd.MM.yyyy 'um' HH:mm 'Uhr'")
                : '—',
              step: 2,
            },
            { label: tt('ort'), value: state.ort || '—', step: 2 },
            { label: tt('dokumentenbezeichnung_2'), value: state.dokumentenbezeichnung, step: 3 },
            { label: tt('dokumententyp'), value: dokumententypLabel, step: 3 },
            {
              label: tt('dokumentendatum'),
              value: state.dokumentendatum
                ? format(new Date(state.dokumentendatum + 'T00:00'), 'dd.MM.yyyy')
                : '—',
              step: 3,
            },
            { label: tt('bereitgestellt_von'), value: state.bereitgestellt_von || '—', step: 3 },
          ]}
          onEdit={setStep}
          whatHappensNext={tt('das_unternehmen_wird_als_aktive', { p0: state.name })}
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
            tt('unternehmen_als_aktive_beteiligu', { p0: result.unternehmensname }),
            tt('termin_geplant', { p0: result.terminbezeichnung }),
            tt('dokument_hinterlegt', { p0: result.dokumentenbezeichnung }),
            'Status automatisch auf „Aktiv" gesetzt',
          ]}
          actions={[
            {
              label: tt('weiter_termin_nachbereiten'),
              href: '#/intents/termin-nachbereiten',
              icon: <IconCheck size={16} />,
            },
            {
              label: tt('weitere_beteiligung_anlegen'),
              onClick: resetWizard,
            },
            {
              label: tt('zurueck_zum_dashboard'),
              href: '#/',
            },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
