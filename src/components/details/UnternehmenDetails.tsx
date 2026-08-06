import type { Unternehmen, Termine, Dokumente, Notizen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
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
      <RecordSection title="Details" cols={2}>
        <RecordField label="Unternehmensname" value={record.fields.name} format="text" />
        <RecordField label="Rechtsform" value={record.fields.rechtsform} format="pill" />
        <RecordField label="Branche" value={record.fields.branche} format="pill" />
        <RecordField label="Status der Beteiligung" value={record.fields.status} format="pill" />
        <RecordField label="Beteiligungsquote (%)" value={record.fields.beteiligungsquote} format="text" />
        <RecordField label="Investiertes Kapital (EUR)" value={record.fields.investiertes_kapital} format="text" />
        <RecordField label="Aktueller Unternehmenswert (EUR)" value={record.fields.aktueller_wert} format="text" />
        <RecordField label="Investitionsdatum" value={record.fields.investitionsdatum} format="date" />
        <RecordField label="Stadt" value={record.fields.stadt} format="text" />
        <RecordField label="Land" value={record.fields.land} format="text" />
        <RecordField label="Website" value={record.fields.website} format="url" />
        <RecordField label="Vorname Ansprechpartner" value={record.fields.ansprechpartner_vorname} format="text" />
        <RecordField label="Nachname Ansprechpartner" value={record.fields.ansprechpartner_nachname} format="text" />
        <RecordField label="E-Mail Ansprechpartner" value={record.fields.ansprechpartner_email} format="email" />
        <RecordField label="Telefon Ansprechpartner" value={record.fields.ansprechpartner_telefon} format="text" />
        <RecordField label="Cockpit-Zusammenfassung" value={record.fields.cockpit_zusammenfassung} format="longtext" className="md:col-span-2" />
        <RecordField label="Allgemeine Notizen" value={record.fields.allgemeine_notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title="Termine"
        items={termineList.filter(r => extractRecordId(r.fields.unternehmen) === record.record_id)}
        map={r => ({ name: r.fields.terminbezeichnung ?? 'Termine', meta: r.fields.datum_uhrzeit })}
        onOpen={onOpenTermine}
        onAdd={onAddTermine}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title="Dokumente"
        items={dokumenteList.filter(r => extractRecordId(r.fields.unternehmen) === record.record_id)}
        map={r => ({ name: r.fields.dokumentenbezeichnung ?? 'Dokumente', meta: r.fields.dokumentendatum })}
        onOpen={onOpenDokumente}
        onAdd={onAddDokumente}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title="Notizen"
        items={notizenList.filter(r => extractRecordId(r.fields.unternehmen) === record.record_id)}
        map={r => ({ name: r.fields.notiz_titel ?? 'Notizen', meta: r.fields.notiz_datum })}
        onOpen={onOpenNotizen}
        onAdd={onAddNotizen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.UNTERNEHMEN} recordId={record.record_id} />
    </>
  );
}
