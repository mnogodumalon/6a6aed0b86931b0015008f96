/**
 * Beteiligung abschließen — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen auswählen (nur status=aktiv) → 2) Abschlussdetails (Status-Übergang + Notizen)
 *        → 3) Abschlussnotiz anlegen → 4) Abschlussdokument anlegen → 5) Zusammenfassung → 6) Erfolg.
 * Reads: unternehmen. Writes: unternehmen (updateUnternehmenEntry), notizen (createNotizenEntry),
 *        dokumente (createDokumenteEntry).
 * Composes: IntentWizardShell, EntitySelectStep, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconBuildingSkyscraper,
  IconFileText,
  IconNote,
  IconCheckbox,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { IntentWizardShell, clearIntentDraft } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useIntentSubmit } from '@/hooks/useIntentSubmit';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Unternehmen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';

const DRAFT_KEY = 'intent:beteiligung-abschliessen';

const STATUS_OPTIONS = LOOKUP_OPTIONS['unternehmen']?.['status'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

type WizardState = {
  unternehmenId: string;
  // Step 2
  neuerStatus: string;
  investiertesKapital: string;
  aktuellerWert: string;
  allgemeineNotizen: string;
  // Step 3
  notizTitel: string;
  notizInhalt: string;
  prioritaet: string;
  schlagwoerter: string;
  // Step 4
  dokumentenbezeichnung: string;
  dokumentendatum: string;
  dokumentenlink: string;
  bereitgestelltVon: string;
  notizenDokument: string;
};

function formatEur(v?: number) {
  if (v == null) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function unternehmenName(u: Unternehmen) {
  return u.fields.name ?? u.record_id;
}

export default function BeteiligungAbschliessenPage() {
  const { unternehmen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>({
    unternehmenId: '',
    neuerStatus: 'exit',
    investiertesKapital: '',
    aktuellerWert: '',
    allgemeineNotizen: '',
    notizTitel: '',
    notizInhalt: '',
    prioritaet: PRIORITAET_OPTIONS[0]?.key ?? 'mittel',
    schlagwoerter: '',
    dokumentenbezeichnung: '',
    dokumentendatum: '',
    dokumentenlink: '',
    bereitgestelltVon: '',
    notizenDokument: '',
  });

  // IDs stored to make the submit idempotent on retry
  const [createdNotizenId, setCreatedNotizenId] = useState<string | null>(null);
  const [createdDokumenteId, setCreatedDokumenteId] = useState<string | null>(null);

  const aktiveUnternehmen = unternehmen.filter(
    (u) => u.fields.status?.key === 'aktiv'
  );

  const selectedUnternehmen = unternehmen.find((u) => u.record_id === state.unternehmenId) ?? null;

  const today = format(new Date(), 'yyyy-MM-dd');

  const { submit, submitting, error: submitError, done, reset } = useIntentSubmit(async () => {
    if (!selectedUnternehmen) throw new Error('Kein Unternehmen ausgewählt');

    // 1. Update Unternehmen status (idempotent — update is safe to repeat)
    await LivingAppsService.updateUnternehmenEntry(state.unternehmenId, {
      status: state.neuerStatus,
      ...(state.investiertesKapital !== ''
        ? { investiertes_kapital: parseFloat(state.investiertesKapital) }
        : {}),
      ...(state.aktuellerWert !== ''
        ? { aktueller_wert: parseFloat(state.aktuellerWert) }
        : {}),
      ...(state.allgemeineNotizen !== '' ? { allgemeine_notizen: state.allgemeineNotizen } : {}),
    });

    // 2. Notiz anlegen (guarded — skip if already created)
    let notizenId = createdNotizenId;
    if (!notizenId) {
      const notizResult = await LivingAppsService.createNotizenEntry({
        notiz_titel: state.notizTitel,
        notiz_inhalt: state.notizInhalt,
        notiz_datum: today,
        kategorie: 'strategie',
        prioritaet: state.prioritaet,
        schlagwoerter: state.schlagwoerter || undefined,
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, state.unternehmenId),
      });
      notizenId = notizResult.record_id;
      setCreatedNotizenId(notizenId);
    }

    // 3. Dokument anlegen (guarded — skip if already created)
    let dokumenteId = createdDokumenteId;
    if (!dokumenteId) {
      const dokResult = await LivingAppsService.createDokumenteEntry({
        dokumentenbezeichnung: state.dokumentenbezeichnung,
        dokumententyp: 'beteiligungsvertrag',
        dokumentendatum: state.dokumentendatum || undefined,
        dokumentenlink: state.dokumentenlink || undefined,
        bereitgestellt_von: state.bereitgestelltVon || undefined,
        notizen_dokument: state.notizenDokument || undefined,
        unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, state.unternehmenId),
      });
      dokumenteId = dokResult.record_id;
      setCreatedDokumenteId(dokumenteId);
    }

    clearIntentDraft(DRAFT_KEY);
    await fetchAll();
  });

  const handleReset = () => {
    reset();
    setCreatedNotizenId(null);
    setCreatedDokumenteId(null);
    setState({
      unternehmenId: '',
      neuerStatus: 'exit',
      investiertesKapital: '',
      aktuellerWert: '',
      allgemeineNotizen: '',
      notizTitel: '',
      notizInhalt: '',
      prioritaet: PRIORITAET_OPTIONS[0]?.key ?? 'mittel',
      schlagwoerter: '',
      dokumentenbezeichnung: '',
      dokumentendatum: '',
      dokumentenlink: '',
      bereitgestelltVon: '',
      notizenDokument: '',
    });
    setStep(1);
  };

  const setField = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  };

  const unternehmensName = selectedUnternehmen ? unternehmenName(selectedUnternehmen) : '';

  const statusLabel =
    STATUS_OPTIONS.find((o) => o.key === state.neuerStatus)?.label ?? state.neuerStatus;

  const exitStatusOptions = STATUS_OPTIONS.filter((o) => o.key === 'inaktiv' || o.key === 'exit');

  const rendite =
    selectedUnternehmen
      ? (selectedUnternehmen.fields.aktueller_wert ?? 0) -
        (selectedUnternehmen.fields.investiertes_kapital ?? 0)
      : 0;

  const step2Complete =
    state.neuerStatus !== '';
  const step3Complete = state.notizTitel.trim() !== '' && state.notizInhalt.trim() !== '';
  const step4Complete = state.dokumentenbezeichnung.trim() !== '';

  const answers =
    step > 1 && selectedUnternehmen
      ? [
          { label: 'Unternehmen', value: unternehmensName },
          ...(step > 2 ? [{ label: 'Neuer Status', value: statusLabel }] : []),
        ]
      : undefined;

  return (
    <IntentWizardShell
      title="Beteiligung abschließen"
      subtitle="Status-Übergang, Abschlussnotiz und Dokumentation in einem Ablauf"
      steps={[
        { label: 'Unternehmen' },
        { label: 'Abschluss' },
        { label: 'Notiz' },
        { label: 'Dokument' },
        { label: 'Prüfen' },
        { label: 'Fertig' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
      intro={{
        description:
          'Schließe eine aktive Beteiligung ab: setze den Status auf Exit oder Inaktiv, erfasse die Abschlussnotiz und lege das Abschlussdokument an.',
        requirements: ['Aktives Portfolio-Unternehmen', 'Abschlussnotiz', 'Abschlussdokument'],
      }}
      answers={answers}
      draftKey={DRAFT_KEY}
      draft={state}
      onDraftRestore={(d) => setState(d as WizardState)}
    >
      {/* ── Schritt 1: Unternehmen auswählen ─────────────────────────── */}
      {step === 1 && (
        <EntitySelectStep
          items={aktiveUnternehmen.map((u) => {
            const delta =
              (u.fields.aktueller_wert ?? 0) - (u.fields.investiertes_kapital ?? 0);
            const deltaSign = delta >= 0 ? '+' : '';
            return {
              id: u.record_id,
              title: u.fields.name ?? u.record_id,
              subtitle: [
                u.fields.rechtsform?.label,
                u.fields.beteiligungsquote != null
                  ? `${u.fields.beteiligungsquote} %`
                  : undefined,
              ]
                .filter(Boolean)
                .join(' · '),
              status: u.fields.status
                ? { key: u.fields.status.key, label: u.fields.status.label }
                : undefined,
              stats: [
                {
                  label: 'Investiert',
                  value: formatEur(u.fields.investiertes_kapital),
                },
                {
                  label: 'Rendite-Delta',
                  value: `${deltaSign}${formatEur(delta)}`,
                },
              ],
              icon: <IconBuildingSkyscraper size={20} className="text-primary" />,
            };
          })}
          onSelect={(id) => {
            const u = unternehmen.find((x) => x.record_id === id);
            setField('unternehmenId', id);
            if (u) {
              setField('investiertesKapital', String(u.fields.investiertes_kapital ?? ''));
              setField('aktuellerWert', String(u.fields.aktueller_wert ?? ''));
              setField('allgemeineNotizen', u.fields.allgemeine_notizen ?? '');
              setField('notizTitel', `Beteiligungsabschluss ${u.fields.name ?? ''}`);
              setField(
                'dokumentenbezeichnung',
                `Abschlussdokumentation ${u.fields.name ?? ''}`
              );
            }
            setStep(2);
          }}
          searchPlaceholder="Unternehmen suchen …"
          emptyText="Keine aktiven Beteiligungen gefunden."
          emptyIcon={<IconBuildingSkyscraper size={32} className="text-muted-foreground" />}
        />
      )}

      {/* ── Schritt 2: Abschlussdetails ──────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          {!selectedUnternehmen ? (
            <div className="text-sm text-muted-foreground">
              Kein Unternehmen gewählt.{' '}
              <button
                className="underline text-primary"
                onClick={() => setStep(1)}
              >
                Zurück zu Schritt 1
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border bg-card p-4 space-y-1">
                <p className="font-semibold text-base">{unternehmensName}</p>
                <p className="text-sm text-muted-foreground">
                  Investiert: {formatEur(selectedUnternehmen.fields.investiertes_kapital)} ·
                  Aktueller Wert: {formatEur(selectedUnternehmen.fields.aktueller_wert)}
                </p>
                <p
                  className={`text-sm font-medium ${rendite >= 0 ? 'text-green-600' : 'text-destructive'}`}
                >
                  Rendite-Delta: {rendite >= 0 ? '+' : ''}{formatEur(rendite)}
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Neuer Status *</Label>
                <div className="flex gap-3 flex-wrap">
                  {exitStatusOptions.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setField('neuerStatus', opt.key)}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                        state.neuerStatus === opt.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:border-primary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {state.neuerStatus === 'exit' && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    <IconAlertTriangle size={14} />
                    <span>Exit ist endgültig — das Unternehmen wird aus aktiven Beteiligungen entfernt.</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Investiertes Kapital (EUR)</Label>
                  <Input
                    type="number"
                    value={state.investiertesKapital}
                    onChange={(e) => setField('investiertesKapital', e.target.value)}
                    placeholder="z. B. 500000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Aktuell: {formatEur(selectedUnternehmen.fields.investiertes_kapital)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Aktueller Wert (EUR)</Label>
                  <Input
                    type="number"
                    value={state.aktuellerWert}
                    onChange={(e) => setField('aktuellerWert', e.target.value)}
                    placeholder="z. B. 750000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Aktuell: {formatEur(selectedUnternehmen.fields.aktueller_wert)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Allgemeine Notizen</Label>
                <Textarea
                  value={state.allgemeineNotizen}
                  onChange={(e) => setField('allgemeineNotizen', e.target.value)}
                  placeholder="Hintergrundinformationen zum Abschluss …"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Zurück
                </Button>
                <Button
                  disabled={!step2Complete}
                  onClick={() => setStep(3)}
                  className="flex-1"
                >
                  Weiter: Abschlussnotiz
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Schritt 3: Abschlussnotiz ────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          {!selectedUnternehmen ? (
            <div className="text-sm text-muted-foreground">
              Kein Unternehmen gewählt.{' '}
              <button className="underline text-primary" onClick={() => setStep(1)}>
                Zurück zu Schritt 1
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconNote size={16} />
                <span>
                  Notiz für <strong>{unternehmensName}</strong> · Datum: {today} · Kategorie: Strategie (automatisch)
                </span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Titel *</Label>
                <Input
                  value={state.notizTitel}
                  onChange={(e) => setField('notizTitel', e.target.value)}
                  placeholder={`Beteiligungsabschluss ${unternehmensName}`}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Inhalt *</Label>
                <Textarea
                  value={state.notizInhalt}
                  onChange={(e) => setField('notizInhalt', e.target.value)}
                  placeholder="Beschreibe die Hintergründe und den Verlauf des Abschlusses …"
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Priorität</Label>
                <div className="flex gap-3 flex-wrap">
                  {PRIORITAET_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setField('prioritaet', opt.key)}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                        state.prioritaet === opt.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:border-primary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Schlagwörter</Label>
                <Input
                  value={state.schlagwoerter}
                  onChange={(e) => setField('schlagwoerter', e.target.value)}
                  placeholder="z. B. exit, portfolio-bereinigung"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Zurück
                </Button>
                <Button
                  disabled={!step3Complete}
                  onClick={() => setStep(4)}
                  className="flex-1"
                >
                  Weiter: Abschlussdokument
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Schritt 4: Abschlussdokument ─────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-5">
          {!selectedUnternehmen ? (
            <div className="text-sm text-muted-foreground">
              Kein Unternehmen gewählt.{' '}
              <button className="underline text-primary" onClick={() => setStep(1)}>
                Zurück zu Schritt 1
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconFileText size={16} />
                <span>
                  Dokument für <strong>{unternehmensName}</strong> · Typ: Beteiligungsvertrag (automatisch)
                </span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Dokumentenbezeichnung *</Label>
                <Input
                  value={state.dokumentenbezeichnung}
                  onChange={(e) => setField('dokumentenbezeichnung', e.target.value)}
                  placeholder={`Abschlussdokumentation ${unternehmensName}`}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Dokumentendatum</Label>
                <Input
                  type="date"
                  value={state.dokumentendatum}
                  onChange={(e) => setField('dokumentendatum', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Dokumentenlink (URL)</Label>
                <Input
                  type="url"
                  value={state.dokumentenlink}
                  onChange={(e) => setField('dokumentenlink', e.target.value)}
                  placeholder="https://…"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Bereitgestellt von</Label>
                <Input
                  value={state.bereitgestelltVon}
                  onChange={(e) => setField('bereitgestelltVon', e.target.value)}
                  placeholder="z. B. Rechtsabteilung"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Notizen zum Dokument</Label>
                <Textarea
                  value={state.notizenDokument}
                  onChange={(e) => setField('notizenDokument', e.target.value)}
                  placeholder="Weitere Hinweise zum Dokument …"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Zurück
                </Button>
                <Button
                  disabled={!step4Complete}
                  onClick={() => setStep(5)}
                  className="flex-1"
                >
                  Weiter: Zusammenfassung
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Schritt 5: Zusammenfassung (SummaryStep) ─────────────────── */}
      {step === 5 && !done && (
        <SummaryStep
          title="Alles richtig?"
          items={[
            { label: 'Unternehmen', value: unternehmensName, step: 1 },
            {
              label: 'Neuer Status',
              value: statusLabel,
              step: 2,
            },
            {
              label: 'Investiertes Kapital',
              value: state.investiertesKapital
                ? formatEur(parseFloat(state.investiertesKapital))
                : '(unverändert)',
              step: 2,
            },
            {
              label: 'Aktueller Wert',
              value: state.aktuellerWert
                ? formatEur(parseFloat(state.aktuellerWert))
                : '(unverändert)',
              step: 2,
            },
            { label: 'Notiz-Titel', value: state.notizTitel, step: 3 },
            {
              label: 'Notiz-Priorität',
              value:
                PRIORITAET_OPTIONS.find((o) => o.key === state.prioritaet)?.label ??
                state.prioritaet,
              step: 3,
            },
            { label: 'Dokument', value: state.dokumentenbezeichnung, step: 4 },
            { label: 'Notiz-Datum', value: today },
            { label: 'Dokumententyp', value: 'Beteiligungsvertrag' },
            { label: 'Kategorie', value: 'Strategie' },
          ]}
          onEdit={setStep}
          whatHappensNext={`Der Status von „${unternehmensName}" wird auf „${statusLabel}" gesetzt, eine Abschlussnotiz und ein Abschlussdokument werden angelegt.`}
          confirmLabel="Beteiligung abschließen"
          onConfirm={async () => {
            if (await submit()) setStep(6);
          }}
          submitting={submitting}
          error={submitError}
        />
      )}

      {/* ── Schritt 6: Erfolg (SuccessStep) ──────────────────────────── */}
      {step === 6 && (
        <SuccessStep
          title={`Beteiligung „${unternehmensName}" abgeschlossen`}
          details={[
            `Status auf „${statusLabel}" gesetzt`,
            'Abschlussnotiz angelegt (Kategorie: Strategie)',
            'Abschlussdokument (Typ: Beteiligungsvertrag) angelegt',
          ]}
          actions={[
            {
              label: 'Weitere Beteiligung abschließen',
              onClick: handleReset,
              icon: <IconCheckbox size={16} />,
            },
            { label: 'Zum Dashboard', href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
