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
import { t, appLabel, fieldLabel, lookupLabel, dateFnsLocale, dateFormat } from '@/i18n';
import { format, parseISO } from 'date-fns';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), dateFormat(), { locale: dateFnsLocale() }); } catch { return d; }
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
          <DialogTitle>{t('view_entity', { entity: appLabel('unternehmen') })}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            {t('edit_button')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'name')}</Label>
            <p className="text-sm">{record.fields.name ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'rechtsform')}</Label>
            <Badge variant="secondary">{lookupLabel('unternehmen', 'rechtsform', record.fields.rechtsform?.key) ?? record.fields.rechtsform?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'branche')}</Label>
            <Badge variant="secondary">{lookupLabel('unternehmen', 'branche', record.fields.branche?.key) ?? record.fields.branche?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'status')}</Label>
            <Badge variant="secondary">{lookupLabel('unternehmen', 'status', record.fields.status?.key) ?? record.fields.status?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'beteiligungsquote')}</Label>
            <p className="text-sm">{record.fields.beteiligungsquote ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'investiertes_kapital')}</Label>
            <p className="text-sm">{record.fields.investiertes_kapital ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'aktueller_wert')}</Label>
            <p className="text-sm">{record.fields.aktueller_wert ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'investitionsdatum')}</Label>
            <p className="text-sm">{formatDate(record.fields.investitionsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'stadt')}</Label>
            <p className="text-sm">{record.fields.stadt ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'land')}</Label>
            <p className="text-sm">{record.fields.land ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'website')}</Label>
            <p className="text-sm">{record.fields.website ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'ansprechpartner_vorname')}</Label>
            <p className="text-sm">{record.fields.ansprechpartner_vorname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'ansprechpartner_nachname')}</Label>
            <p className="text-sm">{record.fields.ansprechpartner_nachname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'ansprechpartner_email')}</Label>
            <p className="text-sm">{record.fields.ansprechpartner_email ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'ansprechpartner_telefon')}</Label>
            <p className="text-sm">{record.fields.ansprechpartner_telefon ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'cockpit_zusammenfassung')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.cockpit_zusammenfassung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('unternehmen', 'allgemeine_notizen')}</Label>
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