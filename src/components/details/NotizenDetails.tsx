import type { Notizen, Unternehmen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';

export interface NotizenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Notizen;
  /** N:1-Ziel „Unternehmen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  unternehmenList: Unternehmen[];
  /** Klick auf die Unternehmen-Relation → overlay.push auf dessen Detail. */
  onOpenUnternehmen?: (record: Unternehmen) => void;
}

export function NotizenDetails({
  record,
  unternehmenList,
  onOpenUnternehmen,
}: NotizenDetailsProps) {
  const unternehmenTarget = unternehmenList.find(r => r.record_id === extractRecordId(record.fields.unternehmen));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Titel der Notiz" value={record.fields.notiz_titel} format="text" />
        <RecordField label="Notizinhalt" value={record.fields.notiz_inhalt} format="longtext" className="md:col-span-2" />
        <RecordField label="Datum der Notiz" value={record.fields.notiz_datum} format="date" />
        <RecordField label="Kategorie" value={record.fields.kategorie} format="pill" />
        <RecordField label="Priorität" value={record.fields.prioritaet} format="pill" />
        <RecordField label="Schlagwörter / Tags" value={record.fields.schlagwoerter} format="text" />
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

      <RecordAttachments appId={APP_IDS.NOTIZEN} recordId={record.record_id} />
    </>
  );
}
