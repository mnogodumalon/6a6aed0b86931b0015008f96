import type { Dokumente, Unternehmen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconFileText } from '@tabler/icons-react';
import { t, appLabel, fieldLabel, lookupLabel, dateFnsLocale, dateFormat } from '@/i18n';
import { format, parseISO } from 'date-fns';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), dateFormat(), { locale: dateFnsLocale() }); } catch { return d; }
}

interface DokumenteViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Dokumente | null;
  onEdit: (record: Dokumente) => void;
  unternehmenList: Unternehmen[];
}

export function DokumenteViewDialog({ open, onClose, record, onEdit, unternehmenList }: DokumenteViewDialogProps) {
  function getUnternehmenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return unternehmenList.find(r => r.record_id === id)?.fields.name ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('view_entity', { entity: appLabel('dokumente') })}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            {t('edit_button')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('dokumente', 'unternehmen')}</Label>
            <p className="text-sm">{getUnternehmenDisplayName(record.fields.unternehmen)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('dokumente', 'dokumentenbezeichnung')}</Label>
            <p className="text-sm">{record.fields.dokumentenbezeichnung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('dokumente', 'dokumententyp')}</Label>
            <Badge variant="secondary">{lookupLabel('dokumente', 'dokumententyp', record.fields.dokumententyp?.key) ?? record.fields.dokumententyp?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('dokumente', 'dokumentenbeschreibung')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.dokumentenbeschreibung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('dokumente', 'dokumentendatum')}</Label>
            <p className="text-sm">{formatDate(record.fields.dokumentendatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('dokumente', 'dokumentenlink')}</Label>
            <p className="text-sm">{record.fields.dokumentenlink ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('dokumente', 'datei_upload')}</Label>
            {record.fields.datei_upload ? (
              <MediaThumbnail src={record.fields.datei_upload} fit="contain" className="w-full rounded-lg border" />
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('dokumente', 'bereitgestellt_von')}</Label>
            <p className="text-sm">{record.fields.bereitgestellt_von ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('dokumente', 'notizen_dokument')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.notizen_dokument ?? '—'}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.DOKUMENTE} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}