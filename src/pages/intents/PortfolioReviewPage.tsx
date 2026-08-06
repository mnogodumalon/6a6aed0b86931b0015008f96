/**
 * Portfolio Review — 4-Schritt-Wizard.
 * Steps: 1) Unternehmen auswählen (nur status=aktiv) → 2) Review-Dokument ablegen →
 *         3) Folgetermin planen → 4) Review-Notiz erfassen & bestätigen.
 * Reads: unternehmen, dokumente, termine, notizen.
 * Writes: dokumente (createDokumenteEntry), termine (createTermineEntry), notizen (createNotizenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  IconBuilding,
  IconFileText,
  IconCalendarEvent,
  IconNotes,
  IconCircleCheck,
  IconAlertTriangle,
  IconLoader2,
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
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';

const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];
const TERMINART_OPTIONS = LOOKUP_OPTIONS['termine']?.['terminart'] ?? [];
const WIEDERHOLUNG_OPTIONS = LOOKUP_OPTIONS['termine']?.['wiederholung'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

export default function PortfolioReviewPage() {
  const { unternehmen, dokumente, termine, notizen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedUnternehmenId, setSelectedUnternehmenId] = useState<string | null>(null);

  // Step 2: Dokument
  const [dokBezeichnung, setDokBezeichnung] = useState('');
  const [dokTypKey, setDokTypKey] = useState('');
  const [dokDatum, setDokDatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dokLink, setDokLink] = useState('');
  const [dokBeschreibung, setDokBeschreibung] = useState('');
  const [dokBereitgestelltVon, setDokBereitgestelltVon] = useState('');
  const [dokSubmitting, setDokSubmitting] = useState(false);
  const [dokError, setDokError] = useState<string | null>(null);
  const [dokCreatedId, setDokCreatedId] = useState<string | null>(null);

  // Step 3: Termin
  const [terBezeichnung, setTerBezeichnung] = useState('');
  const [terArtKey, setTerArtKey] = useState('');
  const [terDatumUhrzeit, setTerDatumUhrzeit] = useState('');
  const [terOrt, setTerOrt] = useState('');
  const [terWiederholungKey, setTerWiederholungKey] = useState('');
  const [terErinnerungTage, setTerErinnerungTage] = useState('');
  const [terSubmitting, setTerSubmitting] = useState(false);
  const [terError, setTerError] = useState<string | null>(null);
  const [terCreatedId, setTerCreatedId] = useState<string | null>(null);

  // Step 4: Notiz
  const [notTitel, setNotTitel] = useState('');
  const [notInhalt, setNotInhalt] = useState('');
  const [notKategorieKey, setNotKategorieKey] = useState('');
  const [notPrioritaetKey, setNotPrioritaetKey] = useState(PRIORITAET_OPTIONS[1]?.key ?? '');
  const [notSchlagwoerter, setNotSchlagwoerter] = useState('');
  const [notSubmitting, setNotSubmitting] = useState(false);
  const [notError, setNotError] = useState<string | null>(null);
  const [notCreatedId, setNotCreatedId] = useState<string | null>(null);

  // Aktive Unternehmen
  const aktiveUnternehmen = useMemo(
    () => (unternehmen as Unternehmen[]).filter(u => u.fields.status?.key === 'aktiv'),
    [unternehmen]
  );

  // Dokument-Anzahl pro Unternehmen
  const dokCountByUnternehmen = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of dokumente) {
      const uid = extractRecordId(d.fields.unternehmen);
      if (uid) counts[uid] = (counts[uid] ?? 0) + 1;
    }
    return counts;
  }, [dokumente]);

  const selectedUnternehmen = useMemo(
    () => aktiveUnternehmen.find(u => u.record_id === selectedUnternehmenId) ?? null,
    [aktiveUnternehmen, selectedUnternehmenId]
  );

  // Gesamtstats für ausgewähltes Unternehmen (Kontext)
  const unternehmenDokCount = selectedUnternehmenId
    ? (dokCountByUnternehmen[selectedUnternehmenId] ?? 0)
    : 0;
  const unternehmenTermineCount = useMemo(() => {
    if (!selectedUnternehmenId) return 0;
    return termine.filter(t => extractRecordId(t.fields.unternehmen) === selectedUnternehmenId).length;
  }, [termine, selectedUnternehmenId]);
  const unternehmenNotizenCount = useMemo(() => {
    if (!selectedUnternehmenId) return 0;
    return notizen.filter(n => extractRecordId(n.fields.unternehmen) === selectedUnternehmenId).length;
  }, [notizen, selectedUnternehmenId]);

  // Step 2: Dokument speichern
  const handleDokumentSpeichern = async () => {
    if (!selectedUnternehmenId || !dokBezeichnung) return;
    setDokError(null);
    setDokSubmitting(true);
    try {
      let pid = dokCreatedId;
      if (!pid) {
        const result = await LivingAppsService.createDokumenteEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          dokumentenbezeichnung: dokBezeichnung,
          ...(dokTypKey && dokTypKey !== 'none' ? { dokumententyp: dokTypKey } : {}),
          ...(dokDatum ? { dokumentendatum: dokDatum } : {}),
          ...(dokLink ? { dokumentenlink: dokLink } : {}),
          ...(dokBeschreibung ? { dokumentenbeschreibung: dokBeschreibung } : {}),
          ...(dokBereitgestelltVon ? { bereitgestellt_von: dokBereitgestelltVon } : {}),
        });
        pid = result.record_id;
        setDokCreatedId(pid);
      }
      await fetchAll();
      setStep(3);
    } catch (e) {
      setDokError('Dokument konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setDokSubmitting(false);
    }
  };

  // Step 3: Termin speichern
  const handleTerminSpeichern = async () => {
    if (!selectedUnternehmenId || !terBezeichnung || !terArtKey || !terDatumUhrzeit) return;
    setTerError(null);
    setTerSubmitting(true);
    try {
      let tid = terCreatedId;
      if (!tid) {
        const result = await LivingAppsService.createTermineEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          terminbezeichnung: terBezeichnung,
          terminart: terArtKey,
          datum_uhrzeit: terDatumUhrzeit,
          ...(terOrt ? { ort: terOrt } : {}),
          ...(terWiederholungKey && terWiederholungKey !== 'none' ? { wiederholung: terWiederholungKey } : {}),
          ...(terErinnerungTage ? { erinnerung_tage: Number(terErinnerungTage) } : {}),
          terminstatus: 'geplant',
        });
        tid = result.record_id;
        setTerCreatedId(tid);
      }
      await fetchAll();
      setStep(4);
    } catch (e) {
      setTerError('Termin konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setTerSubmitting(false);
    }
  };

  // Step 4: Notiz speichern
  const handleNotizSpeichern = async () => {
    if (!selectedUnternehmenId || !notTitel || !notInhalt) return;
    setNotError(null);
    setNotSubmitting(true);
    try {
      let nid = notCreatedId;
      if (!nid) {
        const result = await LivingAppsService.createNotizenEntry({
          unternehmen: createRecordUrl(APP_IDS.UNTERNEHMEN, selectedUnternehmenId),
          notiz_titel: notTitel,
          notiz_inhalt: notInhalt,
          notiz_datum: format(new Date(), 'yyyy-MM-dd'),
          ...(notKategorieKey && notKategorieKey !== 'none' ? { kategorie: notKategorieKey } : {}),
          ...(notPrioritaetKey && notPrioritaetKey !== 'none' ? { prioritaet: notPrioritaetKey } : {}),
          ...(notSchlagwoerter ? { schlagwoerter: notSchlagwoerter } : {}),
        });
        nid = result.record_id;
        setNotCreatedId(nid);
      }
      await fetchAll();
      setStep(5);
    } catch (e) {
      setNotError('Notiz konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setNotSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedUnternehmenId(null);
    setDokBezeichnung('');
    setDokTypKey('');
    setDokDatum(format(new Date(), 'yyyy-MM-dd'));
    setDokLink('');
    setDokBeschreibung('');
    setDokBereitgestelltVon('');
    setDokCreatedId(null);
    setDokError(null);
    setTerBezeichnung('');
    setTerArtKey('');
    setTerDatumUhrzeit('');
    setTerOrt('');
    setTerWiederholungKey('');
    setTerErinnerungTage('');
    setTerCreatedId(null);
    setTerError(null);
    setNotTitel('');
    setNotInhalt('');
    setNotKategorieKey('');
    setNotPrioritaetKey(PRIORITAET_OPTIONS[1]?.key ?? '');
    setNotSchlagwoerter('');
    setNotCreatedId(null);
    setNotError(null);
    setStep(1);
  };

  const STEPS = [
    { label: 'Unternehmen' },
    { label: 'Dokument' },
    { label: 'Folgetermin' },
    { label: 'Notiz' },
    { label: 'Fertig' },
  ];

  return (
    <IntentWizardShell
      title="Portfolio Review"
      subtitle="Dokument ablegen, Folgetermin planen und Review-Notiz erfassen"
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Unternehmen auswählen */}
      {step === 1 && (
        <EntitySelectStep
          items={aktiveUnternehmen.map(u => ({
            id: u.record_id,
            title: u.fields.name ?? u.record_id,
            subtitle: [
              u.fields.rechtsform?.label,
              u.fields.branche?.label,
              u.fields.stadt,
            ].filter(Boolean).join(' · '),
            status: u.fields.status
              ? { key: u.fields.status.key, label: u.fields.status.label }
              : undefined,
            icon: <IconBuilding size={20} className="text-primary" />,
            stats: [
              {
                label: 'Dokumente',
                value: dokCountByUnternehmen[u.record_id] ?? 0,
              },
            ],
          }))}
          onSelect={id => {
            setSelectedUnternehmenId(id);
            setStep(2);
          }}
          searchPlaceholder="Unternehmen suchen …"
          emptyText="Keine aktiven Unternehmen gefunden"
          emptyIcon={<IconBuilding size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Review-Dokument ablegen */}
      {step === 2 && (
        selectedUnternehmenId ? (
          <div className="space-y-6">
            {/* Kontext */}
            <div className="rounded-2xl border bg-secondary/40 p-4 flex items-center gap-3">
              <IconBuilding size={20} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold truncate">{selectedUnternehmen?.fields.name}</p>
                <p className="text-xs text-muted-foreground">
                  {unternehmenDokCount} Dokument{unternehmenDokCount !== 1 ? 'e' : ''} vorhanden
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card shadow-lg p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <IconFileText size={20} className="text-primary" />
                <h2 className="font-semibold text-base">Review-Dokument ablegen</h2>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="dok-bezeichnung">Dokumentenbezeichnung *</Label>
                  <Input
                    id="dok-bezeichnung"
                    value={dokBezeichnung}
                    onChange={e => setDokBezeichnung(e.target.value)}
                    placeholder="z. B. Q2-Review TechCo GmbH"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="dok-typ">Dokumententyp</Label>
                    <Select value={dokTypKey} onValueChange={setDokTypKey}>
                      <SelectTrigger id="dok-typ" className="w-full">
                        <SelectValue placeholder="Typ wählen …" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Kein Typ —</SelectItem>
                        {DOKUMENTENTYP_OPTIONS.map(opt => (
                          <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="dok-datum">Dokumentendatum</Label>
                    <Input
                      id="dok-datum"
                      type="date"
                      value={dokDatum}
                      onChange={e => setDokDatum(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="dok-link">Dokumentenlink (URL)</Label>
                  <Input
                    id="dok-link"
                    type="url"
                    value={dokLink}
                    onChange={e => setDokLink(e.target.value)}
                    placeholder="https://…"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="dok-beschreibung">Beschreibung</Label>
                  <Textarea
                    id="dok-beschreibung"
                    value={dokBeschreibung}
                    onChange={e => setDokBeschreibung(e.target.value)}
                    placeholder="Kurze Beschreibung des Dokuments …"
                    rows={3}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="dok-bereitgestellt">Bereitgestellt von</Label>
                  <Input
                    id="dok-bereitgestellt"
                    value={dokBereitgestelltVon}
                    onChange={e => setDokBereitgestelltVon(e.target.value)}
                    placeholder="Name oder Organisation"
                  />
                </div>
              </div>

              {dokError && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  <IconAlertTriangle size={16} className="shrink-0" />
                  {dokError}
                </div>
              )}

              {dokCreatedId && (
                <div className="flex items-center gap-2 rounded-xl bg-primary/10 p-3 text-sm text-primary">
                  <IconCircleCheck size={16} className="shrink-0" />
                  Dokument gespeichert — weiter zu Schritt 3.
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>Zurück</Button>
                <Button
                  disabled={!dokBezeichnung || dokSubmitting}
                  onClick={handleDokumentSpeichern}
                  className="flex-1"
                >
                  {dokSubmitting ? (
                    <><IconLoader2 size={16} className="animate-spin mr-2" />Speichern …</>
                  ) : (
                    'Dokument speichern & weiter'
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setStep(3)}>Überspringen</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* Step 3: Folgetermin planen */}
      {step === 3 && (
        selectedUnternehmenId ? (
          <div className="space-y-6">
            {/* Kontext */}
            <div className="rounded-2xl border bg-secondary/40 p-4 flex items-center gap-3">
              <IconBuilding size={20} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold truncate">{selectedUnternehmen?.fields.name}</p>
                <p className="text-xs text-muted-foreground">
                  {unternehmenTermineCount} Termin{unternehmenTermineCount !== 1 ? 'e' : ''} vorhanden
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card shadow-lg p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <IconCalendarEvent size={20} className="text-primary" />
                <h2 className="font-semibold text-base">Folgetermin planen</h2>
                <span className="ml-1 text-xs text-muted-foreground">(Status wird automatisch auf „Geplant" gesetzt)</span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="ter-bezeichnung">Terminbezeichnung *</Label>
                  <Input
                    id="ter-bezeichnung"
                    value={terBezeichnung}
                    onChange={e => setTerBezeichnung(e.target.value)}
                    placeholder="z. B. Q3-Review Meeting"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="ter-art">Terminart *</Label>
                    <Select value={terArtKey} onValueChange={setTerArtKey}>
                      <SelectTrigger id="ter-art" className="w-full">
                        <SelectValue placeholder="Terminart wählen …" />
                      </SelectTrigger>
                      <SelectContent>
                        {TERMINART_OPTIONS.map(opt => (
                          <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="ter-datum">Datum & Uhrzeit *</Label>
                    <Input
                      id="ter-datum"
                      type="datetime-local"
                      value={terDatumUhrzeit}
                      onChange={e => setTerDatumUhrzeit(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="ter-ort">Ort</Label>
                  <Input
                    id="ter-ort"
                    value={terOrt}
                    onChange={e => setTerOrt(e.target.value)}
                    placeholder="z. B. Berlin, Online"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="ter-wiederholung">Wiederholung</Label>
                    <Select value={terWiederholungKey} onValueChange={setTerWiederholungKey}>
                      <SelectTrigger id="ter-wiederholung" className="w-full">
                        <SelectValue placeholder="Wiederholung wählen …" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Keine —</SelectItem>
                        {WIEDERHOLUNG_OPTIONS.map(opt => (
                          <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="ter-erinnerung">Erinnerung (Tage vorher)</Label>
                    <Input
                      id="ter-erinnerung"
                      type="number"
                      min="0"
                      value={terErinnerungTage}
                      onChange={e => setTerErinnerungTage(e.target.value)}
                      placeholder="z. B. 3"
                    />
                  </div>
                </div>
              </div>

              {terError && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  <IconAlertTriangle size={16} className="shrink-0" />
                  {terError}
                </div>
              )}

              {terCreatedId && (
                <div className="flex items-center gap-2 rounded-xl bg-primary/10 p-3 text-sm text-primary">
                  <IconCircleCheck size={16} className="shrink-0" />
                  Termin gespeichert — weiter zu Schritt 4.
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>Zurück</Button>
                <Button
                  disabled={!terBezeichnung || !terArtKey || !terDatumUhrzeit || terSubmitting}
                  onClick={handleTerminSpeichern}
                  className="flex-1"
                >
                  {terSubmitting ? (
                    <><IconLoader2 size={16} className="animate-spin mr-2" />Speichern …</>
                  ) : (
                    'Termin speichern & weiter'
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setStep(4)}>Überspringen</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* Step 4: Review-Notiz erfassen */}
      {step === 4 && (
        selectedUnternehmenId ? (
          <div className="space-y-6">
            {/* Kontext */}
            <div className="rounded-2xl border bg-secondary/40 p-4 flex items-center gap-3">
              <IconBuilding size={20} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold truncate">{selectedUnternehmen?.fields.name}</p>
                <p className="text-xs text-muted-foreground">
                  {unternehmenNotizenCount} Notiz{unternehmenNotizenCount !== 1 ? 'en' : ''} vorhanden
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card shadow-lg p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <IconNotes size={20} className="text-primary" />
                <h2 className="font-semibold text-base">Review-Notiz erfassen</h2>
                <span className="ml-1 text-xs text-muted-foreground">(Datum wird automatisch auf heute gesetzt)</span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="not-titel">Notiz-Titel *</Label>
                  <Input
                    id="not-titel"
                    value={notTitel}
                    onChange={e => setNotTitel(e.target.value)}
                    placeholder="z. B. Q2-Review Ergebnisse"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="not-inhalt">Notiz-Inhalt *</Label>
                  <Textarea
                    id="not-inhalt"
                    value={notInhalt}
                    onChange={e => setNotInhalt(e.target.value)}
                    placeholder="Review-Ergebnisse, Beobachtungen, nächste Schritte …"
                    rows={5}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="not-kategorie">Kategorie</Label>
                    <Select value={notKategorieKey} onValueChange={setNotKategorieKey}>
                      <SelectTrigger id="not-kategorie" className="w-full">
                        <SelectValue placeholder="Kategorie wählen …" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Keine —</SelectItem>
                        {KATEGORIE_OPTIONS.map(opt => (
                          <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Priorität</Label>
                    <div className="flex gap-2 flex-wrap">
                      {PRIORITAET_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setNotPrioritaetKey(opt.key)}
                          className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors ${
                            notPrioritaetKey === opt.key
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-secondary text-foreground border-border hover:bg-secondary/70'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="not-schlagwoerter">Schlagwörter</Label>
                  <Input
                    id="not-schlagwoerter"
                    value={notSchlagwoerter}
                    onChange={e => setNotSchlagwoerter(e.target.value)}
                    placeholder="z. B. wachstum, risiko, strategie"
                  />
                </div>
              </div>

              {notError && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  <IconAlertTriangle size={16} className="shrink-0" />
                  {notError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(3)}>Zurück</Button>
                <Button
                  disabled={!notTitel || !notInhalt || notSubmitting}
                  onClick={handleNotizSpeichern}
                  className="flex-1"
                >
                  {notSubmitting ? (
                    <><IconLoader2 size={16} className="animate-spin mr-2" />Speichern …</>
                  ) : (
                    'Notiz speichern & abschließen'
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* Step 5: Abgeschlossen */}
      {step === 5 && (
        <div className="text-center py-12 space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-5">
              <IconCircleCheck size={48} className="text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Review abgeschlossen</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Dokument, Folgetermin und Notiz wurden für{' '}
              <span className="font-medium text-foreground">{selectedUnternehmen?.fields.name}</span>{' '}
              erfolgreich angelegt.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={handleReset} variant="outline">
              Neuen Review starten
            </Button>
            <a href="#/">
              <Button className="w-full sm:w-auto">Zurück zum Dashboard</Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
