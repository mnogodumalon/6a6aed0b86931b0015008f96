import type { Termine, Unternehmen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface TermineDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Termine;
  /** N:1-Ziel „Unternehmen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  unternehmenList: Unternehmen[];
  /** Klick auf die Unternehmen-Relation → overlay.push auf dessen Detail. */
  onOpenUnternehmen?: (record: Unternehmen) => void;
}

export function TermineDetails({
  record,
  unternehmenList,
  onOpenUnternehmen,
}: TermineDetailsProps) {
  const unternehmenTarget = unternehmenList.find(r => r.record_id === extractRecordId(record.fields.unternehmen));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('termine', 'terminbezeichnung')} value={record.fields.terminbezeichnung} format="text" />
        <RecordField label={fieldLabel('termine', 'terminart')} value={record.fields.terminart} format="pill" />
        <RecordField label={fieldLabel('termine', 'datum_uhrzeit')} value={record.fields.datum_uhrzeit} format="datetime" />
        <RecordField label={fieldLabel('termine', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('termine', 'wiederholung')} value={record.fields.wiederholung} format="pill" />
        <RecordField label={fieldLabel('termine', 'erinnerung_tage')} value={record.fields.erinnerung_tage} format="text" />
        <RecordField label={fieldLabel('termine', 'google_kalender')} value={record.fields.google_kalender} format="bool" />
        <RecordField label={fieldLabel('termine', 'terminstatus')} value={record.fields.terminstatus} format="pill" />
        <RecordField label={fieldLabel('termine', 'notizen_termin')} value={record.fields.notizen_termin} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('termine', 'unternehmen')}
          name={unternehmenTarget?.fields.name ?? '—'}
          meta={[unternehmenTarget?.fields.ansprechpartner_email, unternehmenTarget?.fields.ansprechpartner_telefon].filter(Boolean).join(' · ') || undefined}
          onClick={unternehmenTarget && onOpenUnternehmen ? () => onOpenUnternehmen!(unternehmenTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.TERMINE} recordId={record.record_id} />
    </>
  );
}
