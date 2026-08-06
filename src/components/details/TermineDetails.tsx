import type { Termine, Unternehmen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';

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
      <RecordSection title="Details" cols={2}>
        <RecordField label="Terminbezeichnung" value={record.fields.terminbezeichnung} format="text" />
        <RecordField label="Terminart" value={record.fields.terminart} format="pill" />
        <RecordField label="Datum & Uhrzeit" value={record.fields.datum_uhrzeit} format="datetime" />
        <RecordField label="Ort / Videolink" value={record.fields.ort} format="text" />
        <RecordField label="Wiederholung" value={record.fields.wiederholung} format="pill" />
        <RecordField label="Erinnerung (Tage vorher)" value={record.fields.erinnerung_tage} format="text" />
        <RecordField label="Mit Google-Kalender synchronisieren" value={record.fields.google_kalender} format="bool" />
        <RecordField label="Status" value={record.fields.terminstatus} format="pill" />
        <RecordField label="Notizen zum Termin" value={record.fields.notizen_termin} format="longtext" className="md:col-span-2" />
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

      <RecordAttachments appId={APP_IDS.TERMINE} recordId={record.record_id} />
    </>
  );
}
