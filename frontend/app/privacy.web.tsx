import { LegalDocumentPage } from '../components/landing/LegalDocument.web';
import { PRIVACY_POLICY_DOC } from '../components/landing/legalContent';

export default function PrivacyRoute() {
  return (
    <LegalDocumentPage
      legalDocument={PRIVACY_POLICY_DOC}
      siblingHref="/terms"
      siblingLabel="Read terms of service"
    />
  );
}
