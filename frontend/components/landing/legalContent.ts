export const LEGAL_SUPPORT_EMAIL =
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@polybuys.com';

export const LEGAL_UPDATED_AT = 'April 20, 2026';

export type LegalSection = {
  title: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
};

export type LegalDocument = {
  slug: 'privacy' | 'terms';
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
  intro: readonly string[];
  sections: readonly LegalSection[];
};

export const PRIVACY_POLICY_DOC: LegalDocument = {
  slug: 'privacy',
  eyebrow: 'Privacy Policy',
  title: 'PolyBuys Privacy Policy',
  description:
    'How PolyBuys collects, uses, shares, and deletes account data, listings, messages, notifications, and diagnostics.',
  updatedAt: LEGAL_UPDATED_AT,
  intro: [
    'PolyBuys is a student marketplace for the Cal Poly community. This Privacy Policy explains what information we collect, how we use it, and the choices you have when you use the PolyBuys app, website, and related services.',
    'This policy applies to the PolyBuys iOS app, Android app, website, and any related features we operate.',
  ],
  sections: [
    {
      title: 'Quick summary',
      bullets: [
        'We collect your Cal Poly email, account details, profile information, listings, listing photos, messages, reports, and other content you choose to submit.',
        'We also collect optional push notification tokens and limited device, app, crash, and error diagnostics to keep PolyBuys working reliably.',
        'We use this information to authenticate users, operate the marketplace, enable messaging and notifications, prevent abuse, and improve the service.',
      ],
    },
    {
      title: 'Information we collect',
      paragraphs: [
        'We collect information you provide directly when you create an account, verify your email, edit your profile, upload photos, post a listing, message another user, save a listing, report content, or contact support.',
      ],
      bullets: [
        'Account and verification data, such as your Cal Poly email address, authentication records, and session information.',
        'Profile data, such as your name, bio, major, graduation year, and profile photo.',
        'Marketplace content, such as listing titles, descriptions, prices, item condition, categories, listing images, saved listings, messages, reports, and blocks.',
        'Notification and preference data, such as your push notification token and whether message notifications are enabled.',
        'Technical and diagnostic data, such as device/app diagnostics, crash reports, and error logs.',
      ],
    },
    {
      title: 'How we use information',
      bullets: [
        'To verify eligible users and secure accounts.',
        'To create profiles, publish listings, show marketplace content, and enable messaging between users.',
        'To send verification emails and optional push notifications.',
        'To detect spam, scams, abusive content, and other misuse of the service.',
        'To troubleshoot bugs, monitor reliability, respond to support requests, and improve PolyBuys.',
      ],
    },
    {
      title: 'Permissions and device access',
      paragraphs: ['Some features ask for device permissions only when you choose to use them.'],
      bullets: [
        'Photo library or camera access is used only if you choose to upload listing photos or a profile picture.',
        'Notification permission is used only if you allow PolyBuys to send message-related push notifications.',
        'PolyBuys stores authentication/session data locally on your device so you can stay signed in.',
      ],
    },
    {
      title: 'What we do not currently collect',
      bullets: [
        'We do not currently collect precise GPS location.',
        'We do not run third-party advertising inside PolyBuys or sell personal information.',
        'We do not process payments inside the app.',
      ],
    },
    {
      title: 'How information is shared',
      paragraphs: [
        'Some information is shared with other users as part of the marketplace experience. For example, your public profile details, listings, listing photos, and messages are visible to the users involved in those interactions.',
      ],
      bullets: [
        'With service providers that help us operate PolyBuys, including Convex for backend infrastructure and storage, Resend for verification emails, Expo push notification services, and Sentry for crash and error monitoring.',
        'When required by law, legal process, or a good-faith belief that sharing is necessary to protect the safety, rights, or integrity of PolyBuys, our users, or the public.',
      ],
    },
    {
      title: 'Retention and deletion',
      paragraphs: [
        'We keep information for as long as needed to operate the service, maintain security, resolve disputes, and enforce our policies.',
        'If you delete your account, we will remove or de-identify associated account data from active systems, subject to records we may need to keep for fraud prevention, abuse investigation, or legal compliance.',
      ],
    },
    {
      title: 'Your choices',
      bullets: [
        'You can update your profile details in the app.',
        'You can remove or replace uploaded photos and listings you no longer want to display.',
        'You can disable message notifications.',
        'You can request account deletion from the app settings.',
      ],
    },
    {
      title: "Children's privacy",
      paragraphs: [
        'PolyBuys is not directed to children under 13, and we do not knowingly collect personal information from children under 13.',
      ],
    },
    {
      title: 'Changes to this policy',
      paragraphs: [
        'We may update this Privacy Policy from time to time. If we make material changes, we will post the updated policy here and update the "Last updated" date.',
      ],
    },
    {
      title: 'Contact us',
      paragraphs: [
        `If you have questions about this Privacy Policy or how PolyBuys handles data, contact us at ${LEGAL_SUPPORT_EMAIL}.`,
      ],
    },
  ],
};

export const TERMS_OF_SERVICE_DOC: LegalDocument = {
  slug: 'terms',
  eyebrow: 'Terms of Service',
  title: 'PolyBuys Terms of Service',
  description:
    'Rules for using PolyBuys, including eligibility, listings, user conduct, transactions, enforcement, and liability.',
  updatedAt: LEGAL_UPDATED_AT,
  intro: [
    'These Terms of Service govern your use of PolyBuys. By accessing or using the PolyBuys app, website, or related services, you agree to these terms.',
    'PolyBuys is an independent student marketplace and is not affiliated with California Polytechnic State University.',
  ],
  sections: [
    {
      title: 'Eligibility and accounts',
      bullets: [
        'You must be at least 13 years old and legally allowed to use the service.',
        'You must use a valid @calpoly.edu email address or another account expressly approved by PolyBuys.',
        'You are responsible for keeping your account information accurate and for activity that occurs under your account.',
      ],
    },
    {
      title: 'What PolyBuys provides',
      paragraphs: [
        'PolyBuys provides a platform that lets users browse listings, post items, manage profiles, and message one another.',
        'PolyBuys is not the buyer, seller, broker, shipper, insurer, or guarantor in transactions between users.',
      ],
    },
    {
      title: 'Your content and listings',
      bullets: [
        'You are responsible for the listings, photos, profile content, messages, and other material you submit.',
        'You must have the right to post any content you upload and any item you offer for sale.',
        'By posting content to PolyBuys, you give us a limited license to host, store, reproduce, and display that content as needed to operate the service.',
        'You must keep listing information accurate, lawful, and not misleading.',
      ],
    },
    {
      title: 'Prohibited conduct',
      bullets: [
        'Do not post illegal, stolen, counterfeit, unsafe, or otherwise prohibited goods.',
        'Do not scam, spam, harass, threaten, impersonate, or abuse other users.',
        'Do not submit false reports, evade blocks or moderation, or try to bypass account restrictions.',
        'Do not scrape the service, interfere with its operation, upload malicious code, or attempt unauthorized access.',
        "Do not share another person's private information without permission.",
      ],
    },
    {
      title: 'Transactions and safety',
      bullets: [
        'Users are solely responsible for their own transactions, including pricing, payment, delivery, pickup, inspections, and resolving disputes.',
        'PolyBuys encourages users to meet in safe, public locations and to use reasonable caution before completing a transaction.',
        'PolyBuys does not guarantee item quality, seller identity, buyer identity, payment completion, or transaction outcomes.',
      ],
    },
    {
      title: 'Enforcement and termination',
      paragraphs: [
        'We may remove content, limit features, suspend accounts, or terminate access at any time if we believe a user has violated these terms, created a safety risk, or exposed PolyBuys or other users to legal or operational harm.',
      ],
    },
    {
      title: 'Disclaimers',
      paragraphs: [
        'PolyBuys is provided on an "as is" and "as available" basis. To the fullest extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose, non-infringement, and uninterrupted availability.',
      ],
    },
    {
      title: 'Limitation of liability',
      paragraphs: [
        'To the fullest extent permitted by law, PolyBuys and its operators will not be liable for indirect, incidental, special, consequential, or punitive damages, or for losses arising from user-to-user transactions, listings, messages, or use of the service.',
      ],
    },
    {
      title: 'Privacy',
      paragraphs: [
        'Your use of PolyBuys is also governed by our Privacy Policy, which explains how we collect, use, and share data.',
      ],
    },
    {
      title: 'Changes to these terms',
      paragraphs: [
        'We may update these Terms of Service from time to time. If we do, we will post the revised version here and update the "Last updated" date.',
      ],
    },
    {
      title: 'Contact us',
      paragraphs: [
        `If you have questions about these Terms of Service, contact us at ${LEGAL_SUPPORT_EMAIL}.`,
      ],
    },
  ],
};
