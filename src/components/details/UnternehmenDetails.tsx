import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface UnternehmenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Unternehmen;
  /** 1:N „Termine": VOLLE Liste — der Block filtert auf diesen Record. */
  termineList: Termine[];
  /** Zeilen-Klick → overlay.push auf das Termine-Detail (nie der Edit-Dialog). */
  onOpenTermine: (record: Termine) => void;
  /** Kontextuelles „+": öffnet den Termine-Dialog mit diesem Record vorgesetzt. */
  onAddTermine: () => void;
  /** 1:N „Dokumente": VOLLE Liste — der Block filtert auf diesen Record. */
  dokumenteList: Dokumente[];
  /** Zeilen-Klick → overlay.push auf das Dokumente-Detail (nie der Edit-Dialog). */
  onOpenDokumente: (record: Dokumente) => void;
  /** Kontextuelles „+": öffnet den Dokumente-Dialog mit diesem Record vorgesetzt. */
  onAddDokumente: () => void;
  /** 1:N „Notizen": VOLLE Liste — der Block filtert auf diesen Record. */
  notizenList: Notizen[];
  /** Zeilen-Klick → overlay.push auf das Notizen-Detail (nie der Edit-Dialog). */
  onOpenNotizen: (record: Notizen) => void;
  /** Kontextuelles „+": öffnet den Notizen-Dialog mit diesem Record vorgesetzt. */
  onAddNotizen: () => void;
}

export function UnternehmenDetails({
  record,
  termineList,
  onOpenTermine,
  onAddTermine,
  dokumenteList,
  onOpenDokumente,
  onAddDokumente,
  notizenList,
  onOpenNotizen,
  onAddNotizen,
}: UnternehmenDetailsProps) {
  return (
    <>
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

      <SatelliteSection
        title={appLabel('termine')}
        items={termineList.filter(r => extractRecordId(r.fields.unternehmen) === record.record_id)}
        map={r => ({ name: r.fields.terminbezeichnung ?? appLabel('termine'), meta: r.fields.datum_uhrzeit })}
        onOpen={onOpenTermine}
        onAdd={onAddTermine}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('dokumente')}
        items={dokumenteList.filter(r => extractRecordId(r.fields.unternehmen) === record.record_id)}
        map={r => ({ name: r.fields.dokumentenbezeichnung ?? appLabel('dokumente'), meta: r.fields.dokumentendatum })}
        onOpen={onOpenDokumente}
        onAdd={onAddDokumente}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('notizen')}
        items={notizenList.filter(r => extractRecordId(r.fields.unternehmen) === record.record_id)}
        map={r => ({ name: r.fields.notiz_titel ?? appLabel('notizen'), meta: r.fields.notiz_datum })}
        onOpen={onOpenNotizen}
        onAdd={onAddNotizen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.UNTERNEHMEN} recordId={record.record_id} />
    </>
  );
}
