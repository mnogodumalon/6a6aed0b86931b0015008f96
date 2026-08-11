import type { Dokumente, Unternehmen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';

export interface DokumenteDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Dokumente;
  /** N:1-Ziel „Unternehmen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  unternehmenList: Unternehmen[];
  /** Klick auf die Unternehmen-Relation → overlay.push auf dessen Detail. */
  onOpenUnternehmen?: (record: Unternehmen) => void;
}

export function DokumenteDetails({
  record,
  unternehmenList,
  onOpenUnternehmen,
}: DokumenteDetailsProps) {
  const unternehmenTarget = unternehmenList.find(r => r.record_id === extractRecordId(record.fields.unternehmen));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('dokumente', 'dokumentenbezeichnung')} value={record.fields.dokumentenbezeichnung} format="text" />
        <RecordField label={fieldLabel('dokumente', 'dokumententyp')} value={record.fields.dokumententyp} format="pill" />
        <RecordField label={fieldLabel('dokumente', 'dokumentenbeschreibung')} value={record.fields.dokumentenbeschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('dokumente', 'dokumentendatum')} value={record.fields.dokumentendatum} format="date" />
        <RecordField label={fieldLabel('dokumente', 'dokumentenlink')} value={record.fields.dokumentenlink} format="url" />
        <RecordField label={fieldLabel('dokumente', 'datei_upload')} className="md:col-span-2">
          {record.fields.datei_upload ? (
            <MediaThumbnail src={record.fields.datei_upload as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('dokumente', 'bereitgestellt_von')} value={record.fields.bereitgestellt_von} format="text" />
        <RecordField label={fieldLabel('dokumente', 'notizen_dokument')} value={record.fields.notizen_dokument} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('dokumente', 'unternehmen')}
          name={unternehmenTarget?.fields.name ?? '—'}
          meta={[unternehmenTarget?.fields.ansprechpartner_email, unternehmenTarget?.fields.ansprechpartner_telefon].filter(Boolean).join(' · ') || undefined}
          onClick={unternehmenTarget && onOpenUnternehmen ? () => onOpenUnternehmen!(unternehmenTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.DOKUMENTE} recordId={record.record_id} />
    </>
  );
}
