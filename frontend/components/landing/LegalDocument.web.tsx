import Head from 'expo-router/head';
import { Brand } from './Brand';
import { Button } from './Button';
import { Footer } from './Footer';
import type { LegalDocument } from './legalContent';
import { GLOBAL_CSS } from './styles';

interface LegalDocumentPageProps {
  document: LegalDocument;
  siblingHref: string;
  siblingLabel: string;
}

export function LegalDocumentPage({ document, siblingHref, siblingLabel }: LegalDocumentPageProps) {
  return (
    <>
      <Head>
        <title>{document.title} | PolyBuys</title>
        <meta name="description" content={document.description} />
        <meta name="robots" content="index,follow" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..900,0..100&family=Inter:wght@400;500;600;700&display=swap"
        />
      </Head>

      <style>{GLOBAL_CSS}</style>

      <div className="pb-web-scroll-shell">
        <main className="pb-page pb-doc">
          <div className="pb-doc__shell">
            <div className="pb-doc__nav">
              <Brand href="/" ariaLabel="PolyBuys home" />

              <div className="pb-doc__navLinks" aria-label="Legal navigation">
                <a href="/" className="pb-doc__navLink">
                  Home
                </a>
                <a href={siblingHref} className="pb-doc__navLink">
                  {siblingLabel}
                </a>
              </div>
            </div>

            <article className="pb-doc__card">
              <p className="pb-doc__eyebrow">{document.eyebrow}</p>
              <h1 className="pb-doc__title">{document.title}</h1>
              <p className="pb-doc__meta">Last updated {document.updatedAt}</p>

              <div className="pb-doc__lede">
                {document.intro.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              <div className="pb-doc__sections">
                {document.sections.map((section) => (
                  <section key={section.title} className="pb-doc__section">
                    <h2 className="pb-doc__sectionTitle">{section.title}</h2>

                    {section.paragraphs?.map((paragraph) => (
                      <p key={paragraph} className="pb-doc__paragraph">
                        {paragraph}
                      </p>
                    ))}

                    {section.bullets?.length ? (
                      <ul className="pb-doc__list">
                        {section.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
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
                <Button href={siblingHref} size="md">
                  {siblingLabel}
                </Button>
              </div>
            </article>
          </div>

          <Footer />
        </main>
      </div>
    </>
  );
}
