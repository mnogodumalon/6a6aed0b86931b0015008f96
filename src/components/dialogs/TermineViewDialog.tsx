import type { Termine, Unternehmen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface TermineViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Termine | null;
  onEdit: (record: Termine) => void;
  unternehmenList: Unternehmen[];
}

export function TermineViewDialog({ open, onClose, record, onEdit, unternehmenList }: TermineViewDialogProps) {
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
          <DialogTitle>Termine anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Unternehmen</Label>
            <p className="text-sm">{getUnternehmenDisplayName(record.fields.unternehmen)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Terminbezeichnung</Label>
            <p className="text-sm">{record.fields.terminbezeichnung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Terminart</Label>
            <Badge variant="secondary">{record.fields.terminart?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Datum & Uhrzeit</Label>
            <p className="text-sm">{formatDate(record.fields.datum_uhrzeit)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ort / Videolink</Label>
            <p className="text-sm">{record.fields.ort ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Wiederholung</Label>
            <Badge variant="secondary">{record.fields.wiederholung?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Erinnerung (Tage vorher)</Label>
            <p className="text-sm">{record.fields.erinnerung_tage ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Mit Google-Kalender synchronisieren</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.google_kalender ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.google_kalender ? 'Ja' : 'Nein'}
            </span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Badge variant="secondary">{record.fields.terminstatus?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notizen zum Termin</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.notizen_termin ?? '—'}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.TERMINE} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}