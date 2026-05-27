import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, description, confirmText = "确认", cancelText = "取消", onConfirm, onCancel }: ConfirmDialogProps): JSX.Element | null {
  if (!open) {
    return null;
  }
  return (
    <div className="confirm-overlay" role="presentation" onMouseDown={onCancel}>
      <section className="confirm-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="confirm-icon"><AlertTriangle size={18} /></div>
        <div>
          <h2 id="confirm-title">{title}</h2>
          <p>{description}</p>
        </div>
        <div className="confirm-actions">
          <button type="button" className="ghost-button" onClick={onCancel}>{cancelText}</button>
          <button type="button" className="danger-button" onClick={onConfirm}>{confirmText}</button>
        </div>
      </section>
    </div>
  );
}
