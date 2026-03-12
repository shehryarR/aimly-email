// ============================================================
// CreateCampaignModal.tsx - Modal for creating a new campaign
// ============================================================

import React, { useState } from 'react';
import styled from 'styled-components';
import {
  ModalOverlay, ModalContent, ModalHeader, ModalTitle, CloseButton,
  ModalBody, ModalFooter, FormGroup, Label, Input, Button,
} from './campaigns.styles.ts';
import { CloseIcon } from '../../theme/icons';

// ── Unsaved changes dialog ─────────────────────────────────
const UnsavedOverlay = styled.div`
  position: fixed; inset: 0; z-index: 11000;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
`;
const UnsavedBox = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  padding: 1.5rem; max-width: 420px; width: 90%;
  box-shadow: 0 20px 40px rgba(0,0,0,0.4);
`;
const UnsavedActions = styled.div`display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;`;
const KeepBtn = styled.button<{ theme: any }>`
  padding: 0.625rem 1.25rem; border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]}; color: ${p => p.theme.colors.base.content};
  border: 1px solid ${p => p.theme.colors.base[300]};
  font-weight: 500; font-size: 0.875rem; cursor: pointer; transition: all 0.2s;
  &:hover { background: ${p => p.theme.colors.base[300]}; }
`;
const DiscardBtn = styled.button<{ theme: any }>`
  padding: 0.625rem 1.25rem; border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.error.main}; color: ${p => p.theme.colors.error.content};
  border: none; font-weight: 500; font-size: 0.875rem; cursor: pointer; transition: all 0.2s;
  &:hover { opacity: 0.9; }
`;

interface CreateCampaignModalProps {
  isOpen: boolean;
  newCampaignName: string;
  loading: boolean;
  theme: any;
  onNameChange: (value: string) => void;
  onCreate: () => void;
  onClose: () => void;
}

const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({
  isOpen, newCampaignName, loading, theme,
  onNameChange, onCreate, onClose,
}) => {
  const [confirmClose, setConfirmClose] = useState(false);

  const handleClose = () => {
    if (newCampaignName.trim()) { setConfirmClose(true); return; }
    onClose();
  };

  const handleDiscard = () => {
    setConfirmClose(false);
    onNameChange('');
    onClose();
  };

  return (
    <>
      <ModalOverlay $isOpen={isOpen} onClick={handleClose}>
        <ModalContent theme={theme} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <ModalHeader theme={theme}>
            <ModalTitle>Create New Campaign</ModalTitle>
            <CloseButton theme={theme} onClick={handleClose} title="Close">
              <CloseIcon />
            </CloseButton>
          </ModalHeader>

          <ModalBody>
            <FormGroup>
              <Label theme={theme}>Campaign Name</Label>
              <Input
                theme={theme}
                type="text"
                placeholder="Enter campaign name"
                value={newCampaignName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value)}
                onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && onCreate()}
                autoFocus
              />
            </FormGroup>
          </ModalBody>

          <ModalFooter theme={theme}>
            <Button
              theme={theme}
              onClick={onCreate}
              disabled={!newCampaignName.trim() || loading}
            >
              {loading ? 'Creating...' : 'Create Campaign'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalOverlay>

      {confirmClose && (
        <UnsavedOverlay onClick={() => setConfirmClose(false)}>
          <UnsavedBox theme={theme} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: (theme.colors.warning?.main || '#f59e0b') + '18', color: theme.colors.warning?.main || '#f59e0b', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.2rem' }}>Unsaved changes</div>
                <div style={{ fontSize: '0.8125rem', opacity: 0.6, lineHeight: 1.4 }}>You have unsaved changes. Closing will discard them.</div>
              </div>
            </div>
            <UnsavedActions>
              <KeepBtn theme={theme} onClick={() => setConfirmClose(false)}>Keep editing</KeepBtn>
              <DiscardBtn theme={theme} onClick={handleDiscard}>Discard changes</DiscardBtn>
            </UnsavedActions>
          </UnsavedBox>
        </UnsavedOverlay>
      )}
    </>
  );
};

export default CreateCampaignModal;