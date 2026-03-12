// ============================================================
// ToastAndConfirm.tsx - Toast notifications + Confirm dialog
// ============================================================

import React from 'react';
import {
  ToastContainer, ToastContent, ToastTitle, ToastMessage, ToastCloseButton,
  ConfirmOverlay, ConfirmBox, ConfirmHeader, ConfirmIconWrapper, ConfirmContent,
  ConfirmTitle, ConfirmMessage, ConfirmButtons, ConfirmButton, CancelButton,
} from './campaigns.styles.ts';
import { TrashIcon, CheckIcon, AlertTriangleIcon, CloseIcon } from '../../theme/icons';
import type { ToastState, ConfirmDialogState } from './campaigns.types';

interface ToastProps {
  toast: ToastState;
  onDismiss: () => void;
  theme: any;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss, theme }) => {
  if (!toast.isVisible) return null;
  return (
    <ToastContainer theme={theme} $type={toast.type}>
      <ToastContent>
        <ToastTitle>{toast.title}</ToastTitle>
        <ToastMessage>{toast.message}</ToastMessage>
      </ToastContent>
      <ToastCloseButton onClick={onDismiss}>
        <CloseIcon />
      </ToastCloseButton>
    </ToastContainer>
  );
};

interface ConfirmDialogProps {
  dialog: ConfirmDialogState;
  onClose: () => void;
  onConfirm: () => void;
  theme: any;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ dialog, onClose, onConfirm, theme }) => {
  if (!dialog.isOpen) return null;
  return (
    <ConfirmOverlay onClick={onClose}>
      <ConfirmBox theme={theme} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <ConfirmHeader>
          <ConfirmIconWrapper theme={theme} $variant={dialog.variant}>
            <AlertTriangleIcon />
          </ConfirmIconWrapper>
          <ConfirmContent>
            <ConfirmTitle>{dialog.title}</ConfirmTitle>
            <ConfirmMessage>{dialog.message}</ConfirmMessage>
          </ConfirmContent>
        </ConfirmHeader>
        <ConfirmButtons>
          <CancelButton theme={theme} onClick={onClose}>
            <CloseIcon />
            {dialog.cancelText || 'Cancel'}
          </CancelButton>
          <ConfirmButton theme={theme} $variant={dialog.variant} onClick={onConfirm}>
            {dialog.variant === 'danger' ? <TrashIcon /> : <CheckIcon />}
            {dialog.confirmText || 'Confirm'}
          </ConfirmButton>
        </ConfirmButtons>
      </ConfirmBox>
    </ConfirmOverlay>
  );
};