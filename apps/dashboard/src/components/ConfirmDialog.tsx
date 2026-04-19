import React from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  isDangerous?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isLoading = false,
  isDangerous = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card p-lg max-w-sm w-full mx-md">
        <h2 className="text-title-lg text-dark-100 font-display font-bold">{title}</h2>
        {description && <p className="text-body-md text-dark-400 mt-md">{description}</p>}

        <div className="flex gap-md mt-lg justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={isDangerous ? 'outline' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
            className={isDangerous ? 'text-red-400 border-red-400 hover:bg-red-400/10' : ''}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
