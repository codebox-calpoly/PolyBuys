import { LegalDocumentPage } from '../components/landing/LegalDocument.web';
import { TERMS_OF_SERVICE_DOC } from '../components/landing/legalContent';

export default function TermsRoute() {
  return (
    <LegalDocumentPage
      document={TERMS_OF_SERVICE_DOC}
      siblingHref="/privacy"
      siblingLabel="Read privacy policy"
    />
  );
}
