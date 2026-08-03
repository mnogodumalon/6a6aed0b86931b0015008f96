/**
 * Portfolio-Review vorbereiten — 4-Schritt-Wizard.
 * Steps: 1) Aktives Unternehmen wählen → 2) Review-Termin anlegen → 3) Strategienotiz erfassen → 4) Dokument verlinken (optional) + Zusammenfassung.
 * Reads: unternehmen (gefiltert auf status === 'aktiv'). Writes: termine (createTermineEntry), notizen (createNotizenEntry), dokumente (createDokumenteEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Unternehmen } from '@/types/app';
import { formatCurrency, formatDate, lookupKey } from '@/lib/formatters';
import {
  IconBuilding,
  IconCalendarEvent,
  IconFileText,
  IconNotes,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconAlertCircle,
  IconLoader2,
} from '@tabler/icons-react';

const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const TERMINSTATUS_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminstatus'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];
const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];

const WIZARD_STEPS = [
  { label: 'Unternehmen' },
  { label: 'Termin' },
  { label: 'Notiz' },
  { label: 'Dokument' },
];

export default function PortfolioReviewPage() {
  const { unternehmen, loading, error, fetchAll } = useDashboardData();
  const [searchParams] = useSearchParams();

  // Read deep-link params
  const urlStep = parseInt(searchParams.get('step') ?? '', 10);
  const urlUnternehmenId = searchParams.get('unternehmenId') ?? '';

  const [step, setStep] = useState(() => {
    if (urlStep >= 1 && urlStep <= 4) return urlStep;
    return 1;
  });

  // Step 1 — Unternehmen
  const [selectedUnternehmen, setSelectedUnternehmen] = useState<Unternehmen | null>(null);
  const [selectedUnternehmenId, setSelectedUnternehmenId] = useState<string>(urlUnternehmenId);

  // Step 2 — Termin
  const [terminbezeichnung, setTerminbezeichnung] = useState('');
  const [terminart, setTerminart] = useState(TERMINART_OPTIONS.find(o => o.key === 'strategiemeeting')?.key ?? TERMINART_OPTIONS[0]?.key ?? '');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [erinnerungTage, setErinnerungTage] = useState('');
  const [terminstatus, setTerminstatus] = useState(TERMINSTATUS_OPTIONS.find(o => o.key === 'geplant')?.key ?? TERMINSTATUS_OPTIONS[0]?.key ?? '');
  const [terminSaving, setTerminSaving] = useState(false);
  const [terminError, setTerminError] = useState<string | null>(null);
  const [createdTerminId, setCreatedTerminId] = useState<string | null>(null);

  // Step 3 — Notiz
  const [notizTitel, setNotizTitel] = useState('');
  const [notizInhalt, setNotizInhalt] = useState('');
  const [notizDatum, setNotizDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kategorie, setKategorie] = useState(KATEGORIE_OPTIONS.find(o => o.key === 'strategie')?.key ?? KATEGORIE_OPTIONS[0]?.key ?? '');
  const [prioritaet, setPrioritaet] = useState(PRIORITAET_OPTIONS.find(o => o.key === 'hoch')?.key ?? PRIORITAET_OPTIONS[0]?.key ?? '');
  const [notizSaving, setNotizSaving] = useState(false);
  const [notizError, setNotizError] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState<string | null>(null);

  // Step 4 — Dokument (optional)
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententyp, setDokumententyp] = useState(DOKUMENTENTYP_OPTIONS.find(o => o.key === 'praesentation')?.key ?? DOKUMENTENTYP_OPTIONS[0]?.key ?? '');
  const [dokumentendatum, setDokumentendatum] = useState('');
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [bereitgestelltVon, setBereitgestelltVon] = useState('');
  const [dokumentSaving, setDokumentSaving] = useState(false);
  const [dokumentError, setDokumentError] = useState<string | null>(null);
  const [createdDokumentId, setCreatedDokumentId] = useState<string | null>(null);
  const [dokumentSkipped, setDokumentSkipped] = useState(false);

  // Resolve selected Unternehmen from list when navigating from URL
  const resolveUnternehmen = useCallback((id: string) => {
    const found = unternehmen.find(u => u.record_id === id);
    if (found) {
      setSelectedUnternehmen(found);
      // Pre-fill Termin-Bezeichnung with company name if empty
      if (!terminbezeichnung) {
        setTerminbezeichnung(`Portfolio-Review ${found.fields.name ?? ''}`);
      }
    }
  }, [unternehmen, terminbezeichnung]);

  // Handle company selection
  const handleSelectUnternehmen = useCallback((id: string) => {
    const found = unternehmen.find(u => u.record_id === id) ?? null;
    setSelectedUnternehmen(found);
    setSelectedUnternehmenId(id);
    setTerminbezeichnung(`Portfolio-Review ${found?.fields.name ?? ''}`);
    setNotizTitel(`Review-Notiz ${found?.fields.name ?? ''}`);
    setStep(2);
  }, [unternehmen]);

  // If we have a URL unternehmenId but no selectedUnternehmen yet, try to resolve
  if (urlUnternehmenId && !selectedUnternehmen && unternehmen.length > 0) {
    resolveUnternehmen(urlUnternehmenId);
  }

  // Filter to active companies only
  const aktiveUnternehmen = unternehmen.filter(u => lookupKey(u.fields.status) === 'aktiv');

  // Save Termin (idempotent — skip if already created)
  const handleSaveTermin = async () => {
    if (!terminbezeichnung || !datumUhrzeit || !selectedUnternehmenId) return;
    setTerminSaving(true);
    setTerminError(null);
    try {
      let tid = createdTerminId;
      if (!tid) {
        const result = await LivingAppsService.createTermineEntry({
          terminbezeichnung,
          terminart: terminart || undefined,
          datum_uhrzeit: datumUhrzeit,
          ort: ort || undefined,
          erinnerung_tage: erinnerungTage ? Number(erinnerungTage) : undefined,
          terminstatus: terminstatus || undefined,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
        });
        tid = result.record_id;
        setCreatedTerminId(tid);
      }
      await fetchAll();
      setStep(3);
    } catch (err) {
      setTerminError(err instanceof Error ? err.message : 'Fehler beim Speichern des Termins.');
    } finally {
      setTerminSaving(false);
    }
  };

  // Save Notiz (idempotent)
  const handleSaveNotiz = async () => {
    if (!notizTitel || !notizInhalt || !notizDatum || !selectedUnternehmenId) return;
    setNotizSaving(true);
    setNotizError(null);
    try {
      let nid = createdNotizId;
      if (!nid) {
        const result = await LivingAppsService.createNotizenEntry({
          notiz_titel: notizTitel,
          notiz_inhalt: notizInhalt,
          notiz_datum: notizDatum,
          kategorie: kategorie || undefined,
          prioritaet: prioritaet || undefined,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
        });
        nid = result.record_id;
        setCreatedNotizId(nid);
      }
      await fetchAll();
      setStep(4);
    } catch (err) {
      setNotizError(err instanceof Error ? err.message : 'Fehler beim Speichern der Notiz.');
    } finally {
      setNotizSaving(false);
    }
  };

  // Save Dokument (optional)
  const handleSaveDokument = async () => {
    if (!dokumentenbezeichnung || !selectedUnternehmenId) return;
    setDokumentSaving(true);
    setDokumentError(null);
    try {
      let did = createdDokumentId;
      if (!did) {
        const result = await LivingAppsService.createDokumenteEntry({
          dokumentenbezeichnung,
          dokumententyp: dokumententyp || undefined,
          dokumentendatum: dokumentendatum || undefined,
          dokumentenlink: dokumentenlink || undefined,
          bereitgestellt_von: bereitgestelltVon || undefined,
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
        });
        did = result.record_id;
        setCreatedDokumentId(did);
      }
      await fetchAll();
      setStep(5);
    } catch (err) {
      setDokumentError(err instanceof Error ? err.message : 'Fehler beim Speichern des Dokuments.');
    } finally {
      setDokumentSaving(false);
    }
  };

  const handleSkipDokument = () => {
    setDokumentSkipped(true);
    setStep(5);
  };

  const handleReset = () => {
    setStep(1);
    setSelectedUnternehmen(null);
    setSelectedUnternehmenId('');
    setTerminbezeichnung('');
    setTerminart(TERMINART_OPTIONS.find(o => o.key === 'strategiemeeting')?.key ?? '');
    setDatumUhrzeit('');
    setOrt('');
    setErinnerungTage('');
    setTerminstatus(TERMINSTATUS_OPTIONS.find(o => o.key === 'geplant')?.key ?? '');
    setCreatedTerminId(null);
    setTerminError(null);
    setNotizTitel('');
    setNotizInhalt('');
    setNotizDatum(format(new Date(), 'yyyy-MM-dd'));
    setKategorie(KATEGORIE_OPTIONS.find(o => o.key === 'strategie')?.key ?? '');
    setPrioritaet(PRIORITAET_OPTIONS.find(o => o.key === 'hoch')?.key ?? '');
    setCreatedNotizId(null);
    setNotizError(null);
    setDokumentenbezeichnung('');
    setDokumententyp(DOKUMENTENTYP_OPTIONS.find(o => o.key === 'praesentation')?.key ?? '');
    setDokumentendatum('');
    setDokumentenlink('');
    setBereitgestelltVon('');
    setCreatedDokumentId(null);
    setDokumentError(null);
    setDokumentSkipped(false);
  };

  // Context bar shown after step 1
  const ContextBar = () => {
    if (!selectedUnternehmen) return null;
    const u = selectedUnternehmen;
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/15 text-sm mb-2">
        <IconBuilding size={15} className="text-primary shrink-0" />
        <span className="font-semibold text-foreground truncate max-w-[160px]">{u.fields.name ?? '—'}</span>
        {u.fields.branche && (
          <span className="text-muted-foreground">{u.fields.branche.label}</span>
        )}
        {u.fields.investiertes_kapital != null && (
          <span className="ml-auto font-medium text-foreground">{formatCurrency(u.fields.investiertes_kapital)}</span>
        )}
      </div>
    );
  };

  const allSteps = [...WIZARD_STEPS, { label: 'Fertig' }];

  return (
    <IntentWizardShell
      title="Portfolio-Review vorbereiten"
      subtitle="Termin, Notiz und Dokument in einem Ablauf anlegen"
      steps={allSteps}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ─── Schritt 1: Unternehmen wählen ─── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Unternehmen auswählen</h2>
            <p className="text-sm text-muted-foreground">Wähle ein aktives Beteiligungsunternehmen für den Review.</p>
          </div>
          <EntitySelectStep
            items={aktiveUnternehmen.map(u => ({
              id: u.record_id,
              title: u.fields.name ?? '—',
              subtitle: [
                u.fields.branche?.label,
                u.fields.stadt,
              ].filter(Boolean).join(' · '),
              status: u.fields.status
                ? { key: u.fields.status.key, label: u.fields.status.label }
                : undefined,
              stats: [
                ...(u.fields.investiertes_kapital != null
                  ? [{ label: 'Investiert', value: formatCurrency(u.fields.investiertes_kapital) }]
                  : []),
                ...(u.fields.beteiligungsquote != null
                  ? [{ label: 'Beteiligung', value: `${u.fields.beteiligungsquote} %` }]
                  : []),
              ],
              icon: <IconBuilding size={20} className="text-primary" />,
            }))}
            onSelect={handleSelectUnternehmen}
            searchPlaceholder="Unternehmen suchen..."
            emptyText="Keine aktiven Unternehmen gefunden."
            emptyIcon={<IconBuilding size={32} />}
          />
        </div>
      )}

      {/* ─── Schritt 2: Review-Termin anlegen ─── */}
      {step === 2 && (
        <div className="space-y-5">
          {selectedUnternehmen ? (
            <>
              <div>
                <h2 className="text-lg font-semibold mb-1">Review-Termin anlegen</h2>
                <p className="text-sm text-muted-foreground">Lege den Termin für das Portfolio-Review fest.</p>
              </div>
              <ContextBar />
              <div className="space-y-4 rounded-2xl border bg-card p-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Terminbezeichnung *</label>
                  <Input
                    value={terminbezeichnung}
                    onChange={e => setTerminbezeichnung(e.target.value)}
                    placeholder={`Portfolio-Review ${selectedUnternehmen.fields.name ?? ''}`}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Terminart *</label>
                    <Select value={terminart} onValueChange={setTerminart}>
                      <SelectTrigger>
                        <SelectValue placeholder="Terminart wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {TERMINART_OPTIONS.map(o => (
                          <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={terminstatus} onValueChange={setTerminstatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {TERMINSTATUS_OPTIONS.map(o => (
                          <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Datum & Uhrzeit *</label>
                  <Input
                    type="datetime-local"
                    value={datumUhrzeit}
                    onChange={e => setDatumUhrzeit(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Ort</label>
                    <Input
                      value={ort}
                      onChange={e => setOrt(e.target.value)}
                      placeholder="z. B. Konferenzraum 2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Erinnerung (Tage vorher)</label>
                    <Input
                      type="number"
                      min={0}
                      value={erinnerungTage}
                      onChange={e => setErinnerungTage(e.target.value)}
                      placeholder="z. B. 3"
                    />
                  </div>
                </div>

                {terminError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    <IconAlertCircle size={15} />
                    {terminError}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <IconChevronLeft size={15} className="mr-1" />
                    Zurück
                  </Button>
                  <Button
                    disabled={!terminbezeichnung || !datumUhrzeit || terminSaving}
                    onClick={handleSaveTermin}
                  >
                    {terminSaving ? (
                      <IconLoader2 size={15} className="mr-1.5 animate-spin" />
                    ) : (
                      <IconChevronRight size={15} className="mr-1.5" />
                    )}
                    {createdTerminId ? 'Weiter' : 'Termin anlegen & weiter'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          )}
        </div>
      )}

      {/* ─── Schritt 3: Strategienotiz erfassen ─── */}
      {step === 3 && (
        <div className="space-y-5">
          {selectedUnternehmen ? (
            <>
              <div>
                <h2 className="text-lg font-semibold mb-1">Strategienotiz erfassen</h2>
                <p className="text-sm text-muted-foreground">Halte die wichtigsten Erkenntnisse und Strategiepunkte fest.</p>
              </div>
              <ContextBar />
              <div className="space-y-4 rounded-2xl border bg-card p-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Titel *</label>
                  <Input
                    value={notizTitel}
                    onChange={e => setNotizTitel(e.target.value)}
                    placeholder={`Review-Notiz ${selectedUnternehmen.fields.name ?? ''}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Inhalt *</label>
                  <Textarea
                    value={notizInhalt}
                    onChange={e => setNotizInhalt(e.target.value)}
                    placeholder="Strategische Erkenntnisse, Handlungsfelder, Beschlüsse ..."
                    rows={5}
                    className="resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Datum *</label>
                    <Input
                      type="date"
                      value={notizDatum}
                      onChange={e => setNotizDatum(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Kategorie</label>
                    <Select value={kategorie} onValueChange={setKategorie}>
                      <SelectTrigger>
                        <SelectValue placeholder="Kategorie wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {KATEGORIE_OPTIONS.map(o => (
                          <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Priorität</label>
                    <Select value={prioritaet} onValueChange={setPrioritaet}>
                      <SelectTrigger>
                        <SelectValue placeholder="Priorität wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITAET_OPTIONS.map(o => (
                          <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {notizError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    <IconAlertCircle size={15} />
                    {notizError}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <IconChevronLeft size={15} className="mr-1" />
                    Zurück
                  </Button>
                  <Button
                    disabled={!notizTitel || !notizInhalt || !notizDatum || notizSaving}
                    onClick={handleSaveNotiz}
                  >
                    {notizSaving ? (
                      <IconLoader2 size={15} className="mr-1.5 animate-spin" />
                    ) : (
                      <IconChevronRight size={15} className="mr-1.5" />
                    )}
                    {createdNotizId ? 'Weiter' : 'Notiz speichern & weiter'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          )}
        </div>
      )}

      {/* ─── Schritt 4: Dokument verlinken (optional) ─── */}
      {step === 4 && (
        <div className="space-y-5">
          {selectedUnternehmen ? (
            <>
              <div>
                <h2 className="text-lg font-semibold mb-1">Dokument verlinken <span className="text-muted-foreground font-normal text-base">(optional)</span></h2>
                <p className="text-sm text-muted-foreground">Verlinke ein relevantes Dokument zum Review — oder überspringe diesen Schritt.</p>
              </div>
              <ContextBar />
              <div className="space-y-4 rounded-2xl border bg-card p-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Dokumentenbezeichnung *</label>
                  <Input
                    value={dokumentenbezeichnung}
                    onChange={e => setDokumentenbezeichnung(e.target.value)}
                    placeholder={`Review-Präsentation ${selectedUnternehmen.fields.name ?? ''}`}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Dokumententyp</label>
                    <Select value={dokumententyp} onValueChange={setDokumententyp}>
                      <SelectTrigger>
                        <SelectValue placeholder="Typ wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOKUMENTENTYP_OPTIONS.map(o => (
                          <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Dokumentendatum</label>
                    <Input
                      type="date"
                      value={dokumentendatum}
                      onChange={e => setDokumentendatum(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Link zum Dokument</label>
                  <Input
                    type="url"
                    value={dokumentenlink}
                    onChange={e => setDokumentenlink(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Bereitgestellt von</label>
                  <Input
                    value={bereitgestelltVon}
                    onChange={e => setBereitgestelltVon(e.target.value)}
                    placeholder="Name oder Abteilung"
                  />
                </div>

                {dokumentError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    <IconAlertCircle size={15} />
                    {dokumentError}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    <IconChevronLeft size={15} className="mr-1" />
                    Zurück
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSkipDokument}>
                      Überspringen
                    </Button>
                    <Button
                      disabled={!dokumentenbezeichnung || dokumentSaving}
                      onClick={handleSaveDokument}
                    >
                      {dokumentSaving ? (
                        <IconLoader2 size={15} className="mr-1.5 animate-spin" />
                      ) : (
                        <IconCheck size={15} className="mr-1.5" />
                      )}
                      {createdDokumentId ? 'Weiter' : 'Dokument speichern & abschließen'}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
              <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
            </div>
          )}
        </div>
      )}

      {/* ─── Schritt 5: Zusammenfassung ─── */}
      {step === 5 && (
        <div className="space-y-5">
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <IconCheck size={28} className="text-primary" stroke={2.5} />
            </div>
            <h2 className="text-xl font-bold">Portfolio-Review vorbereitet!</h2>
            <p className="text-sm text-muted-foreground mt-1">Alle Einträge wurden erfolgreich angelegt.</p>
          </div>

          <div className="space-y-3">
            {/* Unternehmen */}
            {selectedUnternehmen && (
              <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <IconBuilding size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Unternehmen</p>
                  <p className="font-semibold text-sm truncate">{selectedUnternehmen.fields.name ?? '—'}</p>
                  {selectedUnternehmen.fields.branche && (
                    <p className="text-xs text-muted-foreground">{selectedUnternehmen.fields.branche.label}</p>
                  )}
                  {selectedUnternehmen.fields.investiertes_kapital != null && (
                    <p className="text-xs text-muted-foreground">Investiert: {formatCurrency(selectedUnternehmen.fields.investiertes_kapital)}</p>
                  )}
                </div>
              </div>
            )}

            {/* Termin */}
            <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
              <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <IconCalendarEvent size={18} className="text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Termin</p>
                <p className="font-semibold text-sm truncate">{terminbezeichnung || '—'}</p>
                {datumUhrzeit && (
                  <p className="text-xs text-muted-foreground">{formatDate(datumUhrzeit)}</p>
                )}
                {ort && <p className="text-xs text-muted-foreground">{ort}</p>}
              </div>
            </div>

            {/* Notiz */}
            <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <IconNotes size={18} className="text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Strategienotiz</p>
                <p className="font-semibold text-sm truncate">{notizTitel || '—'}</p>
                {notizDatum && <p className="text-xs text-muted-foreground">{formatDate(notizDatum)}</p>}
                {notizInhalt && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notizInhalt}</p>
                )}
              </div>
            </div>

            {/* Dokument */}
            {!dokumentSkipped && createdDokumentId && (
              <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <IconFileText size={18} className="text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Dokument</p>
                  <p className="font-semibold text-sm truncate">{dokumentenbezeichnung || '—'}</p>
                  {dokumententyp && (
                    <p className="text-xs text-muted-foreground">
                      {DOKUMENTENTYP_OPTIONS.find(o => o.key === dokumententyp)?.label ?? dokumententyp}
                    </p>
                  )}
                  {dokumentendatum && <p className="text-xs text-muted-foreground">{formatDate(dokumentendatum)}</p>}
                </div>
              </div>
            )}

            {dokumentSkipped && (
              <div className="flex items-center gap-3 rounded-xl border border-dashed bg-card/50 p-4 text-sm text-muted-foreground">
                <IconFileText size={18} className="shrink-0 opacity-40" />
                Kein Dokument verlinkt.
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={handleReset}>
              Neuen Review vorbereiten
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
