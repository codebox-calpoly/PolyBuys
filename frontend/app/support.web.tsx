import { LegalDocumentPage } from '../components/landing/LegalDocument.web';
import { getSupportDocument } from '../components/landing/legalContent';

export default function SupportRoute() {
  return (
    <LegalDocumentPage
      legalDocument={getSupportDocument()}
      siblingHref="/privacy"
      siblingLabel="Privacy Policy"
    />
  );
}
