import type { Dokumente, Unternehmen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
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
      <RecordSection title="Details" cols={2}>
        <RecordField label="Dokumentenbezeichnung" value={record.fields.dokumentenbezeichnung} format="text" />
        <RecordField label="Dokumententyp" value={record.fields.dokumententyp} format="pill" />
        <RecordField label="Beschreibung" value={record.fields.dokumentenbeschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label="Datum des Dokuments" value={record.fields.dokumentendatum} format="date" />
        <RecordField label="Dokumentenlink (URL)" value={record.fields.dokumentenlink} format="url" />
        <RecordField label="Datei-Upload" className="md:col-span-2">
          {record.fields.datei_upload ? (
            <MediaThumbnail src={record.fields.datei_upload as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label="Bereitgestellt von" value={record.fields.bereitgestellt_von} format="text" />
        <RecordField label="Notizen zum Dokument" value={record.fields.notizen_dokument} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={1}>
        <RecordRelation
          label="Unternehmen"
          name={unternehmenTarget?.fields.name ?? '—'}
          meta={[unternehmenTarget?.fields.ansprechpartner_email, unternehmenTarget?.fields.ansprechpartner_telefon].filter(Boolean).join(' · ') || undefined}
          onClick={unternehmenTarget && onOpenUnternehmen ? () => onOpenUnternehmen!(unternehmenTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.DOKUMENTE} recordId={record.record_id} />
    </>
  );
}
