import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md bg-[#FAF9F5] border border-[#E2DFD7] p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 shrink-0 border border-[#E2DFD7] bg-white flex items-center justify-center text-[#141413]">
              <AlertTriangle className="w-4 h-4 text-[#991B1B]" />
            </div>
            <div>
              <h3
                id="confirm-dialog-title"
                className="font-editorial text-xl font-semibold text-[#141413]"
              >
                {title}
              </h3>
              <p className="mt-1.5 text-sm text-[#57554E] leading-relaxed">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="p-1.5 text-[#78756C] hover:text-[#141413] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-[#E6E4DD] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-[#141413] bg-white border border-[#D6D3C9] hover:bg-[#F2F0E8] transition-colors whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-medium text-white transition-colors whitespace-nowrap ${
              variant === 'danger'
                ? 'bg-[#991B1B] hover:bg-[#7F1D1D]'
                : 'bg-[#141413] hover:bg-[#2C2C2A]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
