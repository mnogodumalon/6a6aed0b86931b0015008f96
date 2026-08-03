import type { Unternehmen } from '@/types/app';
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

interface UnternehmenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Unternehmen | null;
  onEdit: (record: Unternehmen) => void;
}

export function UnternehmenViewDialog({ open, onClose, record, onEdit }: UnternehmenViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Unternehmen anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Unternehmensname</Label>
            <p className="text-sm">{record.fields.name ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Rechtsform</Label>
            <Badge variant="secondary">{record.fields.rechtsform?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Branche</Label>
            <Badge variant="secondary">{record.fields.branche?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status der Beteiligung</Label>
            <Badge variant="secondary">{record.fields.status?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Beteiligungsquote (%)</Label>
            <p className="text-sm">{record.fields.beteiligungsquote ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Investiertes Kapital (EUR)</Label>
            <p className="text-sm">{record.fields.investiertes_kapital ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Aktueller Unternehmenswert (EUR)</Label>
            <p className="text-sm">{record.fields.aktueller_wert ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Investitionsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.investitionsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Stadt</Label>
            <p className="text-sm">{record.fields.stadt ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Land</Label>
            <p className="text-sm">{record.fields.land ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Website</Label>
            <p className="text-sm">{record.fields.website ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vorname Ansprechpartner</Label>
            <p className="text-sm">{record.fields.ansprechpartner_vorname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nachname Ansprechpartner</Label>
            <p className="text-sm">{record.fields.ansprechpartner_nachname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">E-Mail Ansprechpartner</Label>
            <p className="text-sm">{record.fields.ansprechpartner_email ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Telefon Ansprechpartner</Label>
            <p className="text-sm">{record.fields.ansprechpartner_telefon ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cockpit-Zusammenfassung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.cockpit_zusammenfassung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Allgemeine Notizen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.allgemeine_notizen ?? '—'}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.UNTERNEHMEN} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}