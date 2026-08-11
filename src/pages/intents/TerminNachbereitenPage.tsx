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

import { makeT } from '@/i18n';

const tt = makeT({
  de: {
    termin: '(Termin)',
    dokumente: 'Dokumente',
    notizen: 'Notizen',
    termin_2: 'Termin',
    abschliessen: 'Abschließen',
    protokoll: 'Protokoll',
    notiz: 'Notiz',
    pruefen: 'Prüfen',
    fertig: 'Fertig',
    termin_nachbereiten: 'Termin nachbereiten',
    status_setzen_protokoll_anlegen: 'Status setzen, Protokoll anlegen, Ergebnis festhalten',
    schliesse_einen_abgehaltenen_ter: 'Schließe einen abgehaltenen Termin ab: setze den Status auf „Stattgefunden", lege ein Sitzungsprotokoll an und halte das Ergebnis als Notiz fest.',
    ohne_bezeichnung: '(ohne Bezeichnung)',
    keine_geplanten_termine_vorhande: 'Keine geplanten Termine vorhanden.',
    termin_suchen: 'Termin suchen …',
    kein_termin_ausgewaehlt: 'Kein Termin ausgewählt.',
    zurueck_zu_schritt_1: 'Zurück zu Schritt 1',
    stattgefunden: 'Stattgefunden',
    notizen_zum_termin_optional: 'Notizen zum Termin (optional)',
    kurznotiz_zum_verlauf_des_termin: 'Kurznotiz zum Verlauf des Termins …',
    weiter_protokoll_anlegen: 'Weiter: Protokoll anlegen',
    protokoll_fuer: 'Protokoll für',
    dokumentenbezeichnung: 'Dokumentenbezeichnung',
    protokoll_2: 'Protokoll {p0}',
    dokumententyp: 'Dokumententyp',
    dokumentendatum: 'Dokumentendatum',
    dokumentenlink_optional: 'Dokumentenlink (optional)',
    https: 'https://…',
    bereitgestellt_von_optional: 'Bereitgestellt von (optional)',
    name_oder_team: 'Name oder Team',
    weiter_ergebnis_notiz: 'Weiter: Ergebnis-Notiz',
    ergebnis_notiz_fuer: 'Ergebnis-Notiz für',
    notiz_titel: 'Notiz-Titel',
    ergebnis: 'Ergebnis …',
    notiz_inhalt: 'Notiz-Inhalt',
    was_wurde_besprochen_welche_besc: 'Was wurde besprochen? Welche Beschlüsse wurden gefasst? Welche nächsten Schritte?',
    kategorie: 'Kategorie',
    prioritaet: 'Priorität',
    weiter_pruefen_bestaetigen: 'Weiter: Prüfen & Bestätigen',
    unternehmen: 'Unternehmen',
    termin_notizen: 'Termin-Notizen',
    ergebnis_notiz: 'Ergebnis-Notiz',
    datum_heute: 'Datum (heute)',
    protokoll_angelegt: 'Protokoll „{p0}" angelegt',
    ergebnis_notiz_erstellt: 'Ergebnis-Notiz „{p0}" erstellt',
    verknuepft_mit: 'Verknüpft mit: {p0}',
    neue_beteiligung_aufnehmen: 'Neue Beteiligung aufnehmen',
    weiteren_termin_nachbereiten: 'Weiteren Termin nachbereiten',
    zurueck_zum_dashboard: 'Zurück zum Dashboard',
    termin_wurde_erfolgreich_abgesch: 'Termin wurde erfolgreich abgeschlossen.',
  },
  en: {
    termin: '(Appointment)',
    dokumente: 'Documents',
    notizen: 'Notes',
    termin_2: 'Appointment',
    abschliessen: 'Complete',
    protokoll: 'Minutes',
    notiz: 'Note',
    pruefen: 'Review',
    fertig: 'Finish',
    termin_nachbereiten: 'Follow Up on Appointment',
    status_setzen_protokoll_anlegen: 'Set status, create minutes, record outcome',
    schliesse_einen_abgehaltenen_ter: 'Complete a held appointment: set the status to "Took Place", create meeting minutes, and record the outcome as a note.',
    ohne_bezeichnung: '(no title)',
    keine_geplanten_termine_vorhande: 'No scheduled appointments available.',
    termin_suchen: 'Search appointment …',
    kein_termin_ausgewaehlt: 'No appointment selected.',
    zurueck_zu_schritt_1: 'Back to Step 1',
    stattgefunden: 'Took Place',
    notizen_zum_termin_optional: 'Notes on Appointment (optional)',
    kurznotiz_zum_verlauf_des_termin: 'Brief note on the course of the appointment …',
    weiter_protokoll_anlegen: 'Next: Create Minutes',
    protokoll_fuer: 'Minutes for',
    dokumentenbezeichnung: 'Document Title',
    protokoll_2: 'Protocol {p0}',
    dokumententyp: 'Document Type',
    dokumentendatum: 'Document Date',
    dokumentenlink_optional: 'Document Link (optional)',
    https: 'https://…',
    bereitgestellt_von_optional: 'Provided by (optional)',
    name_oder_team: 'Name or Team',
    weiter_ergebnis_notiz: 'Next: Result Note',
    ergebnis_notiz_fuer: 'Result Note for',
    notiz_titel: 'Note Title',
    ergebnis: 'Result …',
    notiz_inhalt: 'Note Content',
    was_wurde_besprochen_welche_besc: 'What was discussed? What decisions were made? What are the next steps?',
    kategorie: 'Category',
    prioritaet: 'Priority',
    weiter_pruefen_bestaetigen: 'Next: Review & Confirm',
    unternehmen: 'Company',
    termin_notizen: 'Appointment Notes',
    ergebnis_notiz: 'Result Note',
    datum_heute: 'Date (today)',
    protokoll_angelegt: 'Protocol "{p0}" created',
    ergebnis_notiz_erstellt: 'Result Note "{p0}" created',
    verknuepft_mit: 'Linked to: {p0}',
    neue_beteiligung_aufnehmen: 'Add New Participation',
    weiteren_termin_nachbereiten: 'Follow Up Another Appointment',
    zurueck_zum_dashboard: 'Back to Dashboard',
    termin_wurde_erfolgreich_abgesch: 'Appointment was completed successfully.',
  },
});

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
        terminbezeichnung: termin.fields.terminbezeichnung ?? tt('termin'),
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
      { label: tt('dokumente'), value: docsCount },
      { label: tt('notizen'), value: notizCount },
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
            label: tt('termin_2'),
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
    { label: tt('termin_2') },
    { label: tt('abschliessen') },
    { label: tt('protokoll') },
    { label: tt('notiz') },
    { label: tt('pruefen') },
    { label: tt('fertig') },
  ];

  return (
    <IntentWizardShell
      title={tt('termin_nachbereiten')}
      subtitle={tt('status_setzen_protokoll_anlegen')}
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
      intro={{
        description:
          tt('schliesse_einen_abgehaltenen_ter'),
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
              title: t.fields.terminbezeichnung ?? tt('ohne_bezeichnung'),
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
          emptyText={tt('keine_geplanten_termine_vorhande')}
          searchPlaceholder={tt('termin_suchen')}
        />
      )}

      {/* ─── Step 2: Termin abschließen ─── */}
      {step === 2 && (
        <div className="space-y-5">
          {!selectedTermin ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
              <IconAlertCircle size={32} />
              <p>{tt('kein_termin_ausgewaehlt')}</p>
              <Button variant="outline" onClick={() => setStep(1)}>
                {tt('zurueck_zu_schritt_1')}
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
                  <StatusBadge statusKey="stattgefunden" label={tt('stattgefunden')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notizen_termin">{tt('notizen_zum_termin_optional')}</Label>
                <Textarea
                  id="notizen_termin"
                  value={state.notizen_termin}
                  onChange={e => setState(s => ({ ...s, notizen_termin: e.target.value }))}
                  placeholder={tt('kurznotiz_zum_verlauf_des_termin')}
                  rows={3}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => setStep(3)}
              >
                {tt('weiter_protokoll_anlegen')}
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
              <p>{tt('kein_termin_ausgewaehlt')}</p>
              <Button variant="outline" onClick={() => setStep(1)}>
                {tt('zurueck_zu_schritt_1')}
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-secondary/40 p-3 flex items-center gap-2 text-sm">
                <IconFileText size={16} className="text-primary shrink-0" />
                <span>
                  {tt('protokoll_fuer')} <strong>{selectedTermin.fields.terminbezeichnung}</strong>
                  {selectedUnternehmen ? ` · ${selectedUnternehmen.fields.name}` : ''}
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dok_bezeichnung">
                  {tt('dokumentenbezeichnung')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dok_bezeichnung"
                  value={state.dokumentenbezeichnung}
                  onChange={e => setState(s => ({ ...s, dokumentenbezeichnung: e.target.value }))}
                  placeholder={tt('protokoll_2', { p0: selectedTermin.fields.terminbezeichnung ?? '' })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dok_typ">{tt('dokumententyp')}</Label>
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
                <Label htmlFor="dok_datum">{tt('dokumentendatum')}</Label>
                <Input
                  id="dok_datum"
                  type="date"
                  value={state.dokumentendatum}
                  onChange={e => setState(s => ({ ...s, dokumentendatum: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dok_link">{tt('dokumentenlink_optional')}</Label>
                <Input
                  id="dok_link"
                  type="url"
                  value={state.dokumentenlink}
                  onChange={e => setState(s => ({ ...s, dokumentenlink: e.target.value }))}
                  placeholder={tt('https')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dok_bereit">{tt('bereitgestellt_von_optional')}</Label>
                <Input
                  id="dok_bereit"
                  value={state.bereitgestellt_von}
                  onChange={e => setState(s => ({ ...s, bereitgestellt_von: e.target.value }))}
                  placeholder={tt('name_oder_team')}
                />
              </div>

              <Button
                className="w-full"
                disabled={!state.dokumentenbezeichnung.trim()}
                onClick={() => setStep(4)}
              >
                {tt('weiter_ergebnis_notiz')}
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
              <p>{tt('kein_termin_ausgewaehlt')}</p>
              <Button variant="outline" onClick={() => setStep(1)}>
                {tt('zurueck_zu_schritt_1')}
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-secondary/40 p-3 flex items-center gap-2 text-sm">
                <IconNotes size={16} className="text-primary shrink-0" />
                <span>
                  {tt('ergebnis_notiz_fuer')} <strong>{selectedTermin.fields.terminbezeichnung}</strong>
                  {selectedUnternehmen ? ` · ${selectedUnternehmen.fields.name}` : ''}
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notiz_titel">
                  {tt('notiz_titel')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="notiz_titel"
                  value={state.notiz_titel}
                  onChange={e => setState(s => ({ ...s, notiz_titel: e.target.value }))}
                  placeholder={selectedTermin.fields.terminbezeichnung ?? tt('ergebnis')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notiz_inhalt">
                  {tt('notiz_inhalt')} <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="notiz_inhalt"
                  value={state.notiz_inhalt}
                  onChange={e => setState(s => ({ ...s, notiz_inhalt: e.target.value }))}
                  placeholder={tt('was_wurde_besprochen_welche_besc')}
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="notiz_kategorie">{tt('kategorie')}</Label>
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
                  <Label>{tt('prioritaet')}</Label>
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
                {tt('weiter_pruefen_bestaetigen')}
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
              label: tt('termin_2'),
              value: selectedTermin?.fields.terminbezeichnung ?? '—',
              step: 1,
            },
            {
              label: tt('unternehmen'),
              value: selectedUnternehmen?.fields.name ?? '—',
            },
            {
              label: tt('termin_notizen'),
              value: state.notizen_termin.trim() || '(keine)',
              step: 2,
            },
            {
              label: tt('protokoll'),
              value: state.dokumentenbezeichnung || '—',
              step: 3,
            },
            {
              label: tt('dokumententyp'),
              value:
                DOKUMENTENTYP_OPTIONS.find(o => o.key === state.dokumententypKey)?.label ?? '—',
              step: 3,
            },
            {
              label: tt('ergebnis_notiz'),
              value: state.notiz_titel || '—',
              step: 4,
            },
            {
              label: tt('notiz_inhalt'),
              value:
                state.notiz_inhalt.length > 80
                  ? state.notiz_inhalt.slice(0, 80) + '…'
                  : state.notiz_inhalt || '—',
              step: 4,
            },
            {
              label: tt('prioritaet'),
              value:
                PRIORITAET_OPTIONS.find(o => o.key === state.prioritaetKey)?.label ?? '—',
              step: 4,
            },
            {
              label: tt('datum_heute'),
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
            tt('protokoll_angelegt', { p0: result.dokumentenbezeichnung }),
            tt('ergebnis_notiz_erstellt', { p0: result.notiz_titel }),
            tt('verknuepft_mit', { p0: result.unternehmenName }),
          ]}
          actions={[
            {
              label: tt('neue_beteiligung_aufnehmen'),
              href: '#/intents/neue-beteiligung',
            },
            {
              label: tt('weiteren_termin_nachbereiten'),
              onClick: resetWizard,
            },
            {
              label: tt('zurueck_zum_dashboard'),
              href: '#/',
            },
          ]}
        />
      )}

      {/* Fallback: step 6 without result (shouldn't happen, but safe) */}
      {step === 6 && !result && done && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-muted-foreground">{tt('termin_wurde_erfolgreich_abgesch')}</p>
          <Button onClick={resetWizard}>{tt('weiteren_termin_nachbereiten')}</Button>
          <a href="#/" className="text-sm text-muted-foreground underline">
            {tt('zurueck_zum_dashboard')}
          </a>
        </div>
      )}
    </IntentWizardShell>
  );
}
