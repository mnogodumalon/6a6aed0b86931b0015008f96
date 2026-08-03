/**
 * Meeting Abschluss — 3-Schritt-Wizard.
 * Steps: 1) Termin auswählen (nur status=geplant) → 2) Protokoll-Dokument anlegen →
 *        3) Abschlussnotiz erfassen & Termin auf stattgefunden setzen.
 * Reads: termine, unternehmen. Writes: dokumente (createDokumenteEntry), notizen (createNotizenEntry),
 *        termine (updateTermineEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IconCalendarCheck, IconFileText, IconNotes, IconCheck, IconBuildingSkyscraper } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { EnrichedTermine } from '@/types/enriched';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';

const DOKUMENTENTYP_OPTIONS = LOOKUP_OPTIONS['dokumente']?.['dokumententyp'] ?? [];
const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['notizen']?.['kategorie'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [];

export default function MeetingAbschlussPage() {
  const { termine, unternehmenMap, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);

  // Step 1: selected meeting
  const [selectedTermin, setSelectedTermin] = useState<EnrichedTermine | null>(null);
  const [terminId, setTerminId] = useState('');
  const [unternehmenId, setUnternehmenId] = useState('');

  // Step 2: Dokument fields
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententyp, setDokumententyp] = useState('protokoll');
  const [dokumentendatum, setDokumentendatum] = useState('');
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [bereitgestellt_von, setBereitgestellt_von] = useState('');
  const [dokSubmitting, setDokSubmitting] = useState(false);
  const [dokError, setDokError] = useState<string | null>(null);
  const [createdDokumentId, setCreatedDokumentId] = useState('');

  // Step 3: Notiz fields
  const [notiz_titel, setNotiz_titel] = useState('');
  const [notiz_inhalt, setNotiz_inhalt] = useState('');
  const [notiz_datum, setNotiz_datum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kategorieKey, setKategorieKey] = useState('meeting');
  const [prioritaetKey, setPrioritaetKey] = useState('mittel');
  const [abschlussSubmitting, setAbschlussSubmitting] = useState(false);
  const [abschlussError, setAbschlussError] = useState<string | null>(null);
  const [createdNotizId, setCreatedNotizId] = useState('');
  const [terminAbgeschlossen, setTerminAbgeschlossen] = useState(false);

  // Filter: only geplant
  const geplanteTermine = termine.filter(
    t => t.fields.terminstatus?.key === 'geplant'
  );

  const enrichedTermine: EnrichedTermine[] = geplanteTermine.map(t => {
    const unternId = t.fields.unternehmen ? extractRecordId(t.fields.unternehmen) : '';
    const untern = unternId ? unternehmenMap.get(unternId) : undefined;
    return { ...t, unternehmenName: untern?.fields.name ?? '' };
  });

  function handleTerminSelect(id: string) {
    const termin = enrichedTermine.find(t => t.record_id === id);
    if (!termin) return;
    const unternId = termin.fields.unternehmen ? extractRecordId(termin.fields.unternehmen) ?? '' : '';
    setSelectedTermin(termin);
    setTerminId(id);
    setUnternehmenId(unternId);

    // Pre-fill step 2
    const bezeichnung = termin.fields.terminbezeichnung ?? '';
    setDokumentenbezeichnung(`Protokoll: ${bezeichnung}`);
    // Extract date portion from datum_uhrzeit (format: YYYY-MM-DDTHH:MM or YYYY-MM-DD)
    const raw = termin.fields.datum_uhrzeit ?? '';
    const datePart = raw.length >= 10 ? raw.slice(0, 10) : '';
    setDokumentendatum(datePart);

    // Pre-fill step 3
    setNotiz_titel(`Meeting-Fazit: ${bezeichnung}`);

    setStep(2);
  }

  async function handleDokumentSubmit() {
    if (!dokumentenbezeichnung.trim()) return;
    setDokSubmitting(true);
    setDokError(null);
    try {
      let pid = createdDokumentId;
      if (!pid) {
        const res = await LivingAppsService.createDokumenteEntry({
          unternehmen: unternehmenId ? createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId) : undefined,
          dokumentenbezeichnung,
          dokumententyp,
          dokumentendatum: dokumentendatum || undefined,
          dokumentenlink: dokumentenlink || undefined,
          bereitgestellt_von: bereitgestellt_von || undefined,
        });
        pid = res.record_id;
        setCreatedDokumentId(pid);
      }
      await fetchAll();
      setStep(3);
    } catch (e) {
      setDokError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setDokSubmitting(false);
    }
  }

  async function handleAbschlussSubmit() {
    if (!notiz_titel.trim() || !notiz_inhalt.trim() || !notiz_datum) return;
    setAbschlussSubmitting(true);
    setAbschlussError(null);
    try {
      let nid = createdNotizId;
      if (!nid) {
        const res = await LivingAppsService.createNotizenEntry({
          unternehmen: unternehmenId ? createRecordUrl(APP_IDS.UNTERNEHMEN, unternehmenId) : undefined,
          notiz_titel,
          notiz_inhalt,
          notiz_datum,
          kategorie: kategorieKey,
          prioritaet: prioritaetKey,
        });
        nid = res.record_id;
        setCreatedNotizId(nid);
      }
      if (!terminAbgeschlossen) {
        await LivingAppsService.updateTermineEntry(terminId, { terminstatus: 'stattgefunden' });
        setTerminAbgeschlossen(true);
      }
      await fetchAll();
      setStep(4);
    } catch (e) {
      setAbschlussError(e instanceof Error ? e.message : 'Fehler beim Abschließen');
    } finally {
      setAbschlussSubmitting(false);
    }
  }

  function handleReset() {
    setStep(1);
    setSelectedTermin(null);
    setTerminId('');
    setUnternehmenId('');
    setDokumentenbezeichnung('');
    setDokumententyp('protokoll');
    setDokumentendatum('');
    setDokumentenlink('');
    setBereitgestellt_von('');
    setDokSubmitting(false);
    setDokError(null);
    setCreatedDokumentId('');
    setNotiz_titel('');
    setNotiz_inhalt('');
    setNotiz_datum(format(new Date(), 'yyyy-MM-dd'));
    setKategorieKey('meeting');
    setPrioritaetKey('mittel');
    setAbschlussSubmitting(false);
    setAbschlussError(null);
    setCreatedNotizId('');
    setTerminAbgeschlossen(false);
  }

  const contextHeader = selectedTermin ? (
    <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-xl text-sm text-muted-foreground">
      <IconCalendarCheck size={16} className="text-primary shrink-0" />
      <span className="font-medium text-foreground truncate">{selectedTermin.fields.terminbezeichnung}</span>
      {selectedTermin.unternehmenName && (
        <>
          <span className="mx-1">·</span>
          <IconBuildingSkyscraper size={14} className="shrink-0" />
          <span className="truncate">{selectedTermin.unternehmenName}</span>
        </>
      )}
    </div>
  ) : null;

  return (
    <IntentWizardShell
      title="Meeting abschließen"
      subtitle="Protokoll hinterlegen, Notiz erfassen und Termin als stattgefunden markieren"
      steps={[{ label: 'Termin' }, { label: 'Protokoll' }, { label: 'Notiz' }, { label: 'Fertig' }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Termin auswählen */}
      {step === 1 && (
        <EntitySelectStep
          items={enrichedTermine.map(t => ({
            id: t.record_id,
            title: t.fields.terminbezeichnung ?? '(kein Titel)',
            subtitle: [
              t.fields.datum_uhrzeit ? t.fields.datum_uhrzeit.slice(0, 16).replace('T', ' Uhr ') : '',
              t.fields.ort ?? '',
              t.unternehmenName,
            ].filter(Boolean).join(' · '),
            status: t.fields.terminstatus
              ? { key: t.fields.terminstatus.key, label: t.fields.terminstatus.label }
              : undefined,
            icon: <IconCalendarCheck size={20} className="text-primary" />,
          }))}
          onSelect={handleTerminSelect}
          searchPlaceholder="Termin suchen …"
          emptyText="Keine geplanten Termine gefunden"
          emptyIcon={<IconCalendarCheck size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Protokoll-Dokument anlegen */}
      {step === 2 && (
        selectedTermin ? (
          <div className="space-y-5">
            {contextHeader}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <IconFileText size={20} className="text-primary" />
                <h2 className="font-semibold text-base">Protokoll-Dokument anlegen</h2>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Dokumentenbezeichnung *</label>
                  <Input
                    value={dokumentenbezeichnung}
                    onChange={e => setDokumentenbezeichnung(e.target.value)}
                    placeholder="z. B. Protokoll: Strategiemeeting"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Dokumententyp</label>
                  <Select value={dokumententyp} onValueChange={setDokumententyp}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Typ auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOKUMENTENTYP_OPTIONS.map(opt => (
                        <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Dokumentendatum</label>
                  <Input
                    type="date"
                    value={dokumentendatum}
                    onChange={e => setDokumentendatum(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Dokumentenlink</label>
                  <Input
                    type="url"
                    value={dokumentenlink}
                    onChange={e => setDokumentenlink(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Bereitgestellt von</label>
                  <Input
                    value={bereitgestellt_von}
                    onChange={e => setBereitgestellt_von(e.target.value)}
                    placeholder="Name oder Abteilung"
                  />
                </div>
              </div>
              {dokError && (
                <p className="text-sm text-destructive">{dokError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                >
                  Zurück
                </Button>
                <Button
                  onClick={handleDokumentSubmit}
                  disabled={!dokumentenbezeichnung.trim() || dokSubmitting}
                  className="flex-1"
                >
                  {dokSubmitting ? 'Wird gespeichert …' : 'Dokument anlegen & weiter'}
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

      {/* Step 3: Abschlussnotiz & Termin abschließen */}
      {step === 3 && (
        selectedTermin ? (
          <div className="space-y-5">
            {contextHeader}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <IconNotes size={20} className="text-primary" />
                <h2 className="font-semibold text-base">Abschlussnotiz erfassen</h2>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Titel *</label>
                  <Input
                    value={notiz_titel}
                    onChange={e => setNotiz_titel(e.target.value)}
                    placeholder="z. B. Meeting-Fazit: …"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Inhalt *</label>
                  <Textarea
                    value={notiz_inhalt}
                    onChange={e => setNotiz_inhalt(e.target.value)}
                    placeholder="Ergebnisse, Beschlüsse, nächste Schritte …"
                    rows={5}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Datum *</label>
                  <Input
                    type="date"
                    value={notiz_datum}
                    onChange={e => setNotiz_datum(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Kategorie</label>
                    <Select value={kategorieKey} onValueChange={setKategorieKey}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Kategorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {KATEGORIE_OPTIONS.map(opt => (
                          <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Priorität</label>
                    <Select value={prioritaetKey} onValueChange={setPrioritaetKey}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Priorität" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITAET_OPTIONS.map(opt => (
                          <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">
                Nach dem Speichern wird der Termin automatisch auf <strong>Stattgefunden</strong> gesetzt.
              </div>
              {abschlussError && (
                <p className="text-sm text-destructive">{abschlussError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                >
                  Zurück
                </Button>
                <Button
                  onClick={handleAbschlussSubmit}
                  disabled={!notiz_titel.trim() || !notiz_inhalt.trim() || !notiz_datum || abschlussSubmitting}
                  className="flex-1"
                >
                  {abschlussSubmitting ? 'Wird abgeschlossen …' : 'Meeting abschließen'}
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

      {/* Step 4: Zusammenfassung */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="rounded-2xl border bg-card p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <IconCheck size={24} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Meeting erfolgreich abgeschlossen</h2>
                <p className="text-sm text-muted-foreground">Alle Schritte wurden durchgeführt.</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl bg-secondary p-3">
                <IconCalendarCheck size={18} className="text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selectedTermin?.fields.terminbezeichnung}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge statusKey="stattgefunden" label="Stattgefunden" />
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-secondary p-3">
                <IconFileText size={18} className="text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{dokumentenbezeichnung}</p>
                  <p className="text-xs text-muted-foreground">Dokument angelegt</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-secondary p-3">
                <IconNotes size={18} className="text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{notiz_titel}</p>
                  <p className="text-xs text-muted-foreground">Notiz gespeichert</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                Weiteres Meeting abschließen
              </Button>
              <a href="#/" className="flex-1">
                <Button className="w-full">Zurück zum Dashboard</Button>
              </a>
            </div>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
