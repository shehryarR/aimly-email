// ============================================================
// EmailDetailModal.styles.ts
// Styled components used only by EmailDetailModal.tsx
// ============================================================

import styled, { keyframes } from 'styled-components';

// ── Animations ─────────────────────────────────────────────────────────────────

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const modalUp = keyframes`
  from { opacity: 0; transform: scale(0.96) translateY(16px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
`;

// ── Modal shell ────────────────────────────────────────────────────────────────

export const ModalOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: ${p => p.$isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

export const ModalContent = styled.div<{ theme: any }>`
  background-color: ${p => p.theme.colors.base[200]};
  border-radius: ${p => p.theme.radius.box};
  width: 100%;
  max-width: 620px;
  max-height: 88vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: ${modalUp} 0.25s ease;
`;

export const ModalHeader = styled.div<{ theme: any }>`
  padding: 1.5rem;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
`;

export const CloseButton = styled.button<{ theme: any }>`
  padding: 0.375rem;
  border: none;
  background: transparent;
  color: ${p => p.theme.colors.base.content};
  cursor: pointer;
  border-radius: ${p => p.theme.radius.field};
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: all 0.2s ease;

  &:hover { opacity: 1; background-color: ${p => p.theme.colors.base[100]}; }
  svg { width: 20px; height: 20px; }
`;

export const ModalBody = styled.div`
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

export const ModalFooter = styled.div<{ theme: any }>`
  padding: 1.25rem 1.5rem;
  border-top: 1px solid ${p => p.theme.colors.base[300]};
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  align-items: center;
`;

// ── Status badge ───────────────────────────────────────────────────────────────

export const StatusBadge = styled.span<{ theme: any; $status: 'sent' | 'draft' | 'scheduled' | 'failed' }>`
  display: inline-flex;
  align-items: center;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  ${p => {
    const m = {
      sent:      `background:${(p.theme.colors.success?.main || '#22c55e')}20;color:${p.theme.colors.success?.main || '#22c55e'};`,
      draft:     `background:${(p.theme.colors.warning?.main || '#f59e0b')}20;color:${p.theme.colors.warning?.main || '#f59e0b'};`,
      scheduled: `background:${(p.theme.colors.info?.main    || p.theme.colors.primary.main)}20;color:${p.theme.colors.info?.main || p.theme.colors.primary.main};`,
      failed:    `background:${(p.theme.colors.error?.main   || '#ef4444')}20;color:${p.theme.colors.error?.main || '#ef4444'};`,
    };
    return m[p.$status];
  }}
`;

// ── Form fields ────────────────────────────────────────────────────────────────

export const FormGroup = styled.div``;

export const FormLabel = styled.label<{ theme: any }>`
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.45;
  margin-bottom: 0.375rem;
  color: ${p => p.theme.colors.base.content};
`;

export const FormInput = styled.input<{ theme: any }>`
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid ${p => p.theme.colors.base[400] || p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background-color: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem;
  transition: all 0.2s ease;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: ${p => p.theme.colors.primary.main};
    background-color: ${p => p.theme.colors.base[400]};
    box-shadow: 0 0 0 3px ${p => p.theme.colors.primary.main}20;
  }
  &::placeholder { opacity: 0.4; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

export const FormTextarea = styled.textarea<{ theme: any }>`
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid ${p => p.theme.colors.base[400] || p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background-color: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem;
  font-family: inherit;
  resize: vertical;
  min-height: 220px;
  line-height: 1.6;
  transition: all 0.2s ease;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: ${p => p.theme.colors.primary.main};
    background-color: ${p => p.theme.colors.base[400]};
    box-shadow: 0 0 0 3px ${p => p.theme.colors.primary.main}20;
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

export const ReadBlock = styled.div<{ theme: any }>`
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  line-height: 1.6;
  background: ${p => p.theme.colors.base[400]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  white-space: pre-wrap;
`;

// ── Buttons ────────────────────────────────────────────────────────────────────

export const CancelButton = styled.button<{ theme: any }>`
  padding: 0.625rem 1.25rem;
  border-radius: ${p => p.theme.radius.field};
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: ${p => p.theme.colors.base[100]};
  color: ${p => p.theme.colors.base.content};
  border: 1px solid ${p => p.theme.colors.base[300]};
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover { background-color: ${p => p.theme.colors.base[300]}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  svg { width: 16px; height: 16px; }
`;

export const DangerButton = styled.button<{ theme: any }>`
  padding: 0.625rem 1.25rem;
  border-radius: ${p => p.theme.radius.field};
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: ${p => p.theme.colors.error.main};
  color: ${p => p.theme.colors.error.content};
  border: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover { opacity: 0.9; transform: translateY(-1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  svg { width: 16px; height: 16px; }
`;

export const PrimaryButton = styled.button<{ theme: any }>`
  padding: 0.625rem 1.25rem;
  border-radius: ${p => p.theme.radius.field};
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: ${p => p.theme.colors.primary.main};
  color: ${p => p.theme.colors.primary.content};
  border: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover { opacity: 0.9; transform: translateY(-1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  svg { width: 16px; height: 16px; }
`;

// ── Spinner ────────────────────────────────────────────────────────────────────

export const Spinner = styled.div<{ theme: any; $size?: number }>`
  width: ${p => p.$size || 16}px;
  height: ${p => p.$size || 16}px;
  border: 2px solid ${p => p.theme.colors.base[300]};
  border-top-color: ${p => p.theme.colors.primary.main};
  border-radius: 50%;
  animation: ${spin} 0.65s linear infinite;
  flex-shrink: 0;
`;

export const BtnSpinner = styled.div`
  width: 15px;
  height: 15px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: ${spin} 0.65s linear infinite;
  flex-shrink: 0;
`;

// ── Auto-save note ─────────────────────────────────────────────────────────────

export const AutoSaveNote = styled.span`
  font-size: 0.75rem;
  opacity: 0.5;
  margin-right: auto;
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;