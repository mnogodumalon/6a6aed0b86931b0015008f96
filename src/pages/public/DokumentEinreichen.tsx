import { useEffect, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  listPublicRecords,
  createPublicRecord,
  prepareChallenge,
  recordRef,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
  type PublicEndpointConfig,
} from '@/lib/publicClient';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  IconBuilding,
  IconFileText,
  IconCheck,
  IconSearch,
  IconChevronRight,
} from '@tabler/icons-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Company {
  id: string;
  name: string;
  rechtsform?: string;
}

const DOKUMENTENTYP_OPTIONS: { key: string; label: string }[] = [
  { key: 'gesellschaftsvertrag', label: 'Gesellschaftsvertrag' },
  { key: 'jahresabschluss', label: 'Jahresabschluss' },
  { key: 'protokoll', label: 'Sitzungsprotokoll' },
  { key: 'praesentation', label: 'Präsentation' },
  { key: 'beteiligungsvertrag', label: 'Beteiligungsvertrag' },
  { key: 'geschaeftsbericht', label: 'Geschäftsbericht' },
  { key: 'dokumententyp_sonstiges', label: 'Sonstiges' },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DokumentEinreichen() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  const [step, setStep] = useState(1);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companySearch, setCompanySearch] = useState('');

  // Form fields
  const [dokumentenbezeichnung, setDokumentenbezeichnung] = useState('');
  const [dokumententyp, setDokumententyp] = useState('');
  const [dokumentenbeschreibung, setDokumentenbeschreibung] = useState('');
  const [dokumentendatum, setDokumentendatum] = useState('');
  const [dokumentenlink, setDokumentenlink] = useState('');
  const [bereitgestelltVon, setBereitgestelltVon] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Load config
  useEffect(() => {
    loadPublicPagesConfig().then(c => {
      const p = c?.pages['dokument-einreichen'] ?? null;
      if (!c || !p) {
        setUnavailable(true);
        setLoading(false);
        return;
      }
      setCfg(c);
      setPage(p);
      setLoading(false);
    });
  }, []);

  // Load companies once config is ready
  useEffect(() => {
    if (!cfg || !page) return;
    const unternehmensEp = page.endpoints?.find(
      (e: PublicEndpointConfig) => e.entity === 'unternehmen' && e.op === 'list',
    );
    if (!unternehmensEp) return;

    setCompaniesLoading(true);
    listPublicRecords(cfg, page, { appId: unternehmensEp.app_id, limit: 200 })
      .then(records => {
        const list: Company[] = Object.entries(records).map(([id, r]) => ({
          id,
          name: (r.fields.name as string) ?? '',
          rechtsform: (r.fields.rechtsform as string | undefined),
        }));
        list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
        setCompanies(list);
      })
      .finally(() => setCompaniesLoading(false));
  }, [cfg, page]);

  // Warm up PoW challenge when user starts typing in step 2
  useEffect(() => {
    if (!cfg || !page || step !== 2) return;
    const dokEp = page.endpoints?.find(
      (e: PublicEndpointConfig) => e.entity === 'dokumente' && e.op === 'create',
    );
    if (!dokEp) return;
    prepareChallenge(cfg, { ...page, app_id: dokEp.app_id }, 'POST', `/apps/${dokEp.app_id}/records`);
  }, [cfg, page, step]);

  if (loading) return <PublicShell loading />;
  if (unavailable || !cfg || !page) return <PublicShell unavailable />;

  const unternehmensEp = page.endpoints?.find(
    (e: PublicEndpointConfig) => e.entity === 'unternehmen' && e.op === 'list',
  );
  const dokEp = page.endpoints?.find(
    (e: PublicEndpointConfig) => e.entity === 'dokumente' && e.op === 'create',
  );

  const filteredCompanies = companySearch.trim()
    ? companies.filter(c =>
        c.name.toLowerCase().includes(companySearch.toLowerCase()),
      )
    : companies;

  async function handleSubmit() {
    if (!selectedCompany || !dokumentenbezeichnung.trim() || !cfg || !page || !unternehmensEp || !dokEp) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const fields: Record<string, unknown> = {
        unternehmen: recordRef(cfg, page, unternehmensEp.app_id, selectedCompany.id),
        dokumentenbezeichnung: dokumentenbezeichnung.trim(),
      };
      if (dokumententyp) fields.dokumententyp = dokumententyp;
      if (dokumentenbeschreibung.trim()) fields.dokumentenbeschreibung = dokumentenbeschreibung.trim();
      if (dokumentendatum) fields.dokumentendatum = dokumentendatum;
      if (dokumentenlink.trim()) fields.dokumentenlink = dokumentenlink.trim();
      if (bereitgestelltVon.trim()) fields.bereitgestellt_von = bereitgestelltVon.trim();

      await createPublicRecord(cfg, { ...page, app_id: dokEp.app_id }, fields);
      setDone(true);
      setStep(3);
    } catch {
      setSubmitError('Das Dokument konnte nicht eingereicht werden. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicShell title="Dokument einreichen" description="Reiche ein Dokument für dein Unternehmen ein.">
      <IntentWizardShell
        steps={[
          { label: 'Unternehmen' },
          { label: 'Dokument' },
          { label: 'Bestätigung' },
        ]}
        currentStep={step}
        onStepChange={setStep}
        back={false}
      >
        {/* ------------------------------------------------------------------ */}
        {/* Step 1: Select company                                              */}
        {/* ------------------------------------------------------------------ */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                Wähle dein Unternehmen aus der Liste aus, um fortzufahren.
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
              <Input
                placeholder="Unternehmen suchen …"
                value={companySearch}
                onChange={e => setCompanySearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Company list */}
            {companiesLoading ? (
              <div className="flex flex-col gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <IconBuilding size={40} stroke={1.5} />
                <p className="text-sm">
                  {companySearch ? 'Kein Unternehmen gefunden.' : 'Keine aktiven Unternehmen verfügbar.'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {filteredCompanies.map(company => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => {
                      setSelectedCompany(company);
                      setStep(2);
                    }}
                    className="flex items-center justify-between rounded-lg border px-4 py-3 text-left hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <IconBuilding size={18} className="shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{company.name}</p>
                        {company.rechtsform && (
                          <p className="text-xs text-muted-foreground">{company.rechtsform}</p>
                        )}
                      </div>
                    </div>
                    <IconChevronRight size={16} className="shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Step 2: Document details                                            */}
        {/* ------------------------------------------------------------------ */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            {/* Company reminder */}
            {selectedCompany && (
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                <IconBuilding size={16} className="shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium truncate">{selectedCompany.name}</span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="ml-auto text-xs text-primary hover:underline shrink-0"
                >
                  Ändern
                </button>
              </div>
            )}

            {/* Dokumentenbezeichnung (required) */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dok-name">
                Dokumentenbezeichnung <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dok-name"
                value={dokumentenbezeichnung}
                onChange={e => setDokumentenbezeichnung(e.target.value)}
                placeholder="z. B. Jahresabschluss 2024"
              />
            </div>

            {/* Dokumententyp */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dok-typ">Dokumententyp</Label>
              <Select value={dokumententyp} onValueChange={setDokumententyp}>
                <SelectTrigger id="dok-typ">
                  <SelectValue placeholder="Typ wählen …" />
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

            {/* Dokumentenbeschreibung */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dok-beschreibung">Beschreibung</Label>
              <Textarea
                id="dok-beschreibung"
                value={dokumentenbeschreibung}
                onChange={e => setDokumentenbeschreibung(e.target.value)}
                placeholder="Kurze Beschreibung des Dokuments …"
                rows={3}
              />
            </div>

            {/* Dokumentendatum */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dok-datum">Datum des Dokuments</Label>
              <Input
                id="dok-datum"
                type="date"
                value={dokumentendatum}
                onChange={e => setDokumentendatum(e.target.value)}
              />
            </div>

            {/* Dokumentenlink */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dok-link">Link zum Dokument</Label>
              <Input
                id="dok-link"
                type="url"
                value={dokumentenlink}
                onChange={e => setDokumentenlink(e.target.value)}
                placeholder="https://drive.google.com/…"
              />
              <p className="text-xs text-muted-foreground">
                Füge einen Link zu deinem Dokument ein (Google Drive, Dropbox, SharePoint o. Ä.).
              </p>
            </div>

            {/* Bereitgestellt von */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dok-von">Bereitgestellt von</Label>
              <Input
                id="dok-von"
                value={bereitgestelltVon}
                onChange={e => setBereitgestelltVon(e.target.value)}
                placeholder="Name der einreichenden Person"
              />
            </div>

            {submitError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {submitError}
              </p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting || !dokumentenbezeichnung.trim()}
              className="w-full"
            >
              {submitting ? 'Wird eingereicht …' : 'Dokument einreichen'}
            </Button>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Step 3: Success                                                     */}
        {/* ------------------------------------------------------------------ */}
        {step === 3 && done && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <IconCheck size={28} className="text-success" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold">Dokument eingereicht!</p>
              <p className="text-sm text-muted-foreground">
                <strong>{dokumentenbezeichnung}</strong> wurde für{' '}
                <strong>{selectedCompany?.name}</strong> erfolgreich eingereicht.
                <br />
                Das Team prüft das Dokument und meldet sich bei Rückfragen.
              </p>
            </div>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => {
                setStep(1);
                setSelectedCompany(null);
                setCompanySearch('');
                setDokumentenbezeichnung('');
                setDokumententyp('');
                setDokumentenbeschreibung('');
                setDokumentendatum('');
                setDokumentenlink('');
                setBereitgestelltVon('');
                setDone(false);
              }}
            >
              <IconFileText size={16} className="shrink-0" />
              Weiteres Dokument einreichen
            </Button>
          </div>
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
