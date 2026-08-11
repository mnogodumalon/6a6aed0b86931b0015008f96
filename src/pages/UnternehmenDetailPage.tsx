import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Unternehmen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { UnternehmenDialog } from '@/components/dialogs/UnternehmenDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Unternehmen';
import { evalComputed } from '@/config/form-enhancements/types';
import { t, appLabel, fieldLabel, localeTag, CURRENCY } from '@/i18n';

export default function UnternehmenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Unternehmen | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const list = await LivingAppsService.getUnternehmen();
      setRecord(list.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Unternehmen['fields']) {
    if (!record) return;
    await LivingAppsService.updateUnternehmenEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteUnternehmenEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/unternehmen');
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title={t('not_found')}
        action={
          <Button variant="ghost" onClick={() => navigate('/unternehmen')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            {t('back')}
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/unternehmen')}
      onEdit={() => setEditing(true)}
      backLabel={t('back')}
      editLabel={t('edit_button')}
    >
      <RecordHeader title={record.fields.name ?? appLabel('unternehmen')} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
        };
        const fmtComputed = (k: string, n: number) =>
          /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k)
            ? n.toLocaleString(localeTag(), { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString(localeTag(), { maximumFractionDigits: 2 });
        const computedFacts = Object.entries(formEnhancements.computed)
          .map(([key, formula]) => {
            const v = evalComputed(formula, record!.fields as Record<string, unknown>, { lookupLists });
            return v != null
              ? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: fmtComputed(key, v) }
              : null;
          })
          .filter((f): f is { label: string; value: string } => f !== null);
        return computedFacts.length > 0 ? <RecordKeyFacts items={computedFacts} /> : null;
      })()}

      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('unternehmen', 'name')} value={record.fields.name} format="text" />
        <RecordField label={fieldLabel('unternehmen', 'rechtsform')} value={record.fields.rechtsform} format="pill" />
        <RecordField label={fieldLabel('unternehmen', 'branche')} value={record.fields.branche} format="pill" />
        <RecordField label={fieldLabel('unternehmen', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('unternehmen', 'beteiligungsquote')} value={record.fields.beteiligungsquote} format="text" />
        <RecordField label={fieldLabel('unternehmen', 'investiertes_kapital')} value={record.fields.investiertes_kapital} format="text" />
        <RecordField label={fieldLabel('unternehmen', 'aktueller_wert')} value={record.fields.aktueller_wert} format="text" />
        <RecordField label={fieldLabel('unternehmen', 'investitionsdatum')} value={record.fields.investitionsdatum} format="date" />
        <RecordField label={fieldLabel('unternehmen', 'stadt')} value={record.fields.stadt} format="text" />
        <RecordField label={fieldLabel('unternehmen', 'land')} value={record.fields.land} format="text" />
        <RecordField label={fieldLabel('unternehmen', 'website')} value={record.fields.website} format="url" />
        <RecordField label={fieldLabel('unternehmen', 'ansprechpartner_vorname')} value={record.fields.ansprechpartner_vorname} format="text" />
        <RecordField label={fieldLabel('unternehmen', 'ansprechpartner_nachname')} value={record.fields.ansprechpartner_nachname} format="text" />
        <RecordField label={fieldLabel('unternehmen', 'ansprechpartner_email')} value={record.fields.ansprechpartner_email} format="email" />
        <RecordField label={fieldLabel('unternehmen', 'ansprechpartner_telefon')} value={record.fields.ansprechpartner_telefon} format="text" />
        <RecordField label={fieldLabel('unternehmen', 'cockpit_zusammenfassung')} value={record.fields.cockpit_zusammenfassung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('unternehmen', 'allgemeine_notizen')} value={record.fields.allgemeine_notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.UNTERNEHMEN} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          {t('delete')}
        </Button>
      </div>

      <UnternehmenDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Unternehmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Unternehmen']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('delete_entity', { entity: appLabel('unternehmen') })}
        description={t('confirm_delete_desc')}
      />
    </RecordView>
  );
}
