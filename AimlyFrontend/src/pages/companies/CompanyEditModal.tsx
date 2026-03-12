// ============================================================
// CompanyEditModal.tsx - Edit company details
// Uses new companies.styles imports (no extra styled lib needed)
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  ModalOverlay, ModalContent, ModalHeader, ModalTitle, CloseButton,
  ModalBody, ModalFooter, FormGrid, FormGroup, Label, Input, Textarea,
  SaveButton, CancelButton,
} from './companies.styles';
import type { Company } from './companies.types';

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const SaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);

interface CompanyEditModalProps {
  company: Company | null;
  isOpen: boolean;
  loading: boolean;
  theme: any;
  onSave: (updated: Partial<Company>) => void;
  onClose: () => void;
}

type FormState = {
  name: string; email: string; phone_number: string; address: string; company_info: string;
};

const CompanyEditModal: React.FC<CompanyEditModalProps> = ({
  company, isOpen, loading, theme, onSave, onClose,
}) => {
  const [form, setForm] = useState<FormState>({
    name: '', email: '', phone_number: '', address: '', company_info: '',
  });

  useEffect(() => {
    if (company) {
      setForm({
        name:         company.name         || '',
        email:        company.email        || '',
        phone_number: company.phone_number || '',
        address:      company.address      || '',
        company_info: company.company_info || '',
      });
    }
  }, [company]);

  const handleChange = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSave = () => {
    if (!form.name.trim() || !form.email.trim()) return;
    onSave({
      name:         form.name.trim(),
      email:        form.email.trim(),
      phone_number: form.phone_number.trim() || null,
      address:      form.address.trim()      || null,
      company_info: form.company_info.trim() || null,
    });
  };

  const isValid = form.name.trim() && form.email.trim();

  return (
    <ModalOverlay $isOpen={isOpen} onClick={onClose}>
      <ModalContent theme={theme} $wide onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <ModalHeader theme={theme}>
          <ModalTitle>
            <EditIcon />
            Edit Company
          </ModalTitle>
          <CloseButton theme={theme} onClick={onClose}><CloseIcon /></CloseButton>
        </ModalHeader>

        <ModalBody>
          <FormGrid>
            <FormGroup>
              <Label theme={theme}>Company Name *</Label>
              <Input theme={theme} value={form.name} onChange={handleChange('name')} placeholder="Acme Corp" autoFocus />
            </FormGroup>
            <FormGroup>
              <Label theme={theme}>Email *</Label>
              <Input theme={theme} type="email" value={form.email} onChange={handleChange('email')} placeholder="contact@acme.com" />
            </FormGroup>
            <FormGroup>
              <Label theme={theme}>Phone</Label>
              <Input theme={theme} value={form.phone_number} onChange={handleChange('phone_number')} placeholder="+1 (555) 000-0000" />
            </FormGroup>
            <FormGroup $span>
              <Label theme={theme}>Address</Label>
              <Input theme={theme} value={form.address} onChange={handleChange('address')} placeholder="123 Main St, City, State" />
            </FormGroup>
            <FormGroup $span>
              <Label theme={theme}>Company Info</Label>
              <Textarea theme={theme} value={form.company_info} onChange={handleChange('company_info')} placeholder="Additional notes about this company..." rows={4} />
            </FormGroup>
          </FormGrid>
        </ModalBody>

        <ModalFooter theme={theme}>
          <CancelButton theme={theme} onClick={onClose}>
            <CloseIcon /> Cancel
          </CancelButton>
          <SaveButton theme={theme} onClick={handleSave} disabled={!isValid || loading}>
            <SaveIcon />
            {loading ? 'Saving…' : 'Save Changes'}
          </SaveButton>
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>
  );
};

export default CompanyEditModal;