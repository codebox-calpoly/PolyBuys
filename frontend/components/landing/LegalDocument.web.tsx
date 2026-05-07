import Head from 'expo-router/head';
import { Brand } from './Brand';
import { Button } from './Button';
import { Footer } from './Footer';
import type { LegalDocument } from './legalContent';
import { LEGAL_SUPPORT_EMAIL } from './legalContent';
import { GLOBAL_CSS } from './styles';

interface LegalDocumentPageProps {
  legalDocument: LegalDocument;
  siblingHref: string;
  siblingLabel: string;
}

export function LegalDocumentPage({
  legalDocument,
  siblingHref,
  siblingLabel,
}: LegalDocumentPageProps) {
  const isSupport = legalDocument.slug === 'support';

  return (
    <>
      <Head>
        <title>{legalDocument.title} | PolyBuys</title>
        <meta name="description" content={legalDocument.description} />
        <meta name="robots" content="index,follow" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Fraunces:SOFT,opsz,wght@0..100,9..144,300..900&family=Inter:wght@400;500;600;700&display=swap"
        />
        <style>{GLOBAL_CSS}</style>
      </Head>

      <div className="pb-web-scroll-shell">
        <main className="pb-page pb-doc">
          <div className="pb-doc__shell">
            <div className="pb-doc__nav">
              <Brand href="/" ariaLabel="PolyBuys home" />

              <div className="pb-doc__navLinks" aria-label="Legal navigation">
                <a href="/" className="pb-doc__navLink">
                  Home
                </a>
                {isSupport ? (
                  <>
                    <a href="/privacy" className="pb-doc__navLink">
                      Privacy
                    </a>
                    <a href="/terms" className="pb-doc__navLink">
                      Terms
                    </a>
                  </>
                ) : (
                  <>
                    <a href="/support" className="pb-doc__navLink">
                      Support
                    </a>
                    <a href={siblingHref} className="pb-doc__navLink">
                      {siblingLabel}
                    </a>
                  </>
                )}
              </div>
            </div>

            <article className="pb-doc__card">
              <p className="pb-doc__eyebrow">{legalDocument.eyebrow}</p>
              <h1 className="pb-doc__title">{legalDocument.title}</h1>
              <p className="pb-doc__meta">Last updated {legalDocument.updatedAt}</p>

              <div className="pb-doc__lede">
                {legalDocument.intro.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>

              <div className="pb-doc__sections">
                {legalDocument.sections.map((section) => (
                  <section key={section.title} className="pb-doc__section">
                    <h2 className="pb-doc__sectionTitle">{section.title}</h2>

                    {section.paragraphs?.map((paragraph, i) => (
                      <p key={i} className="pb-doc__paragraph">
                        {paragraph}
                      </p>
                    ))}

                    {section.bullets?.length ? (
                      <ul className="pb-doc__list">
                        {section.bullets.map((bullet, i) => (
                          <li key={i}>{bullet}</li>
                        ))}
                      </ul>
                    ) : null}

                    {section.contactLines?.length ? (
                      <ul className="pb-doc__list">
                        {section.contactLines.map((line) => (
                          <li key={`${line.lead}-${line.href}`}>
                            <strong>{line.lead}:</strong>{' '}
                            <a
                              href={line.href}
                              className="pb-doc__contactLink"
                              {...(line.href.startsWith('http')
                                ? { target: '_blank', rel: 'noopener noreferrer' }
                                : {})}
                            >
                              {line.text}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ))}
              </div>

              <div className="pb-doc__actions">
                <Button href="/" variant="ghost" size="md">
                  Back to home
                </Button>
                {isSupport ? (
                  <Button href={`mailto:${LEGAL_SUPPORT_EMAIL}`} size="md">
                    Email support
                  </Button>
                ) : (
                  <Button href={siblingHref} size="md">
                    {siblingLabel}
                  </Button>
                )}
              </div>
            </article>
          </div>

          <Footer />
        </main>
      </div>
    </>
  );
}
