import { BRAND, BRAND_DOMAIN } from "@/lib/brand";

/**
 * Legal documents shown to users. DRAFT — prepared for attorney review; not legal advice and not yet reviewed.
 * Bump TERMS_VERSION whenever any text changes; every user must re-accept and the acceptance hash changes.
 */
export const TERMS_VERSION = "2026-08-22-draft1";
export const LEGAL_CONTACT = `legal@${BRAND_DOMAIN}`;

export interface LegalDoc {
  key: "terms" | "privacy" | "risk_indemnity" | "supervisor_attestation" | "guardian_consent";
  title: string;
  summary: string;
  body: string;
}

export const TERMS: LegalDoc = {
  key: "terms",
  title: "Terms of Use",
  summary: `I have read and agree to the ${BRAND} Terms of Use and Privacy Policy.`,
  body: `TERMS OF USE — ${BRAND} (${TERMS_VERSION}) — DRAFT PENDING ATTORNEY REVIEW

1. Who we are and what this is. ${BRAND} ("the Service," "we," "us") is a record-keeping and coaching aid for learner drivers and the licensed adults who supervise them. The Service helps families log supervised practice, reflect on drives, and track progress toward California licensing requirements. The Service is not a driving school, is not affiliated with the California DMV or any government agency, does not certify hours, and does not replace the official permit, the driving-school certificate, or any DMV record.

2. Eligibility and accounts. You must be at least 13 years old to create an account. Users under 18 ("Learners") may use the Service only with the knowledge and consent of a parent or legal guardian, who must link an account and accept these Terms on the Learner's behalf. Adults who link to a Learner ("Supervising Adults") represent that they are legally permitted to supervise that Learner under California law. You are responsible for keeping your password secure and for everything done under your account.

3. Safety is your responsibility. The Service is a recording tool. It does not control the vehicle, cannot see road conditions, and cannot prevent distraction. The Learner's screen locks only within this app; it cannot lock a phone or block other apps. You agree that: (a) the Learner will not touch or look at any phone while the vehicle is moving; (b) a qualified Supervising Adult will be physically present in the front passenger seat on every practice drive as required by law; (c) you will obey all traffic laws and the terms of the permit and license; (d) you will use the Service only while parked.

4. No legal advice; your compliance. Information about licensing rules is provided for convenience, may be incomplete or out of date, and is not legal advice. You are solely responsible for knowing and complying with the requirements of the California DMV and any other authority, and for the accuracy of any record you create, approve, or submit to anyone.

5. GPS, accuracy, and availability. Location data comes from your device and browser and may be inaccurate, delayed, or missing. Distances, routes, night-time calculations, and "live" views are estimates. The Service may be unavailable, interrupted, or discontinued at any time. We do not guarantee that any record will be retained, accurate, or accepted by any third party.

6. Acceptable use. You will not use the Service to falsify records, to supervise a Learner you are not legally permitted to supervise, to access another family's data, to interfere with the Service, or for any unlawful purpose. We may suspend or terminate accounts at our discretion.

7. Your content. You keep ownership of what you enter. You grant us a license to store, process, and display it to the people you link, and to generate reports at your request. Location data is never sold and is never used for advertising.

8. Disclaimer of warranties. THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT, TO THE FULLEST EXTENT PERMITTED BY LAW.

9. Limitation of liability. TO THE FULLEST EXTENT PERMITTED BY LAW, WE AND OUR OWNERS, OFFICERS, EMPLOYEES, CONTRACTORS, AND SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY PERSONAL INJURY, DEATH, PROPERTY DAMAGE, TRAFFIC CITATION, LICENSING DELAY OR DENIAL, OR LOSS OF DATA, ARISING OUT OF OR RELATED TO DRIVING, SUPERVISION, OR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY. OUR TOTAL LIABILITY FOR ANY CLAIM WILL NOT EXCEED THE GREATER OF THE AMOUNT YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM OR ONE HUNDRED U.S. DOLLARS (US$100). Some jurisdictions do not allow certain limitations; in that case these limits apply to the maximum extent permitted.

10. Disputes. These Terms are governed by the laws of the State of California. Any dispute will be resolved in the state or federal courts located in California, and you consent to their jurisdiction. You agree to bring claims only in your individual capacity and not as a plaintiff or class member in any class or representative proceeding.

11. Changes. We may update these Terms. When we do, you will be asked to accept the new version before continuing to use the Service. Continued use after acceptance constitutes agreement.

12. Contact. ${LEGAL_CONTACT}.`,
};

export const PRIVACY: LegalDoc = {
  key: "privacy",
  title: "Privacy Policy",
  summary: "Privacy Policy",
  body: `PRIVACY POLICY — ${BRAND} (${TERMS_VERSION}) — DRAFT PENDING ATTORNEY REVIEW

What we collect. Account information (name, email, password hash); learner permit profile (state and permit issue date only — no permit number, license number, or ID images); drive records (time, GPS samples and derived routes and distances, GPS quality); reflections, observations, ratings, and feedback; relationships between learner and adult accounts; device and browser information; and legal acceptances with timestamp, IP address, and user agent.

How we use it. To operate the Service for you and the people you link; to calculate progress; to generate reports you request; to keep the Service secure; and to communicate with you about your account. We do not sell personal information. We do not use location data for advertising, and precise coordinates are never sent to analytics tools.

Who can see it. Your data is visible to you and to the accounts you link (a learner and their linked adults). Exact routes and live location are never public and are never shared with other families. Service providers that host and deliver the Service (for example hosting, database, and email providers) process data on our behalf under contract.

Children. The Service is intended for users 13 and older. Learners under 18 use the Service with a parent or guardian who links an account and consents on their behalf. Parents may review and request deletion of their child's data by contacting us.

Your choices. You can delete exact route data for any drive, revoke a linked adult, and delete your account from the profile screen. Deleting an account removes personal data except records we must keep for legal, security, or audit purposes (for example, legal acceptances and audit events).

Retention and security. We keep data while your account is active and as required by law. We use encryption in transit, hashed passwords, and row-level access controls. No system is perfectly secure.

California residents. You may have rights under the CCPA/CPRA to know, delete, and correct personal information and to not be discriminated against for exercising those rights. Contact ${LEGAL_CONTACT}.

Changes and contact. We will ask you to accept material changes. Questions: ${LEGAL_CONTACT}.`,
};

export const RISK: LegalDoc = {
  key: "risk_indemnity",
  title: "Assumption of Risk, Release, and Indemnification",
  summary:
    "I understand driving is dangerous, that this app is only a record-keeping aid that cannot make driving safe, and I accept the Assumption of Risk, Release, and Indemnification below.",
  body: `ASSUMPTION OF RISK, RELEASE, AND INDEMNIFICATION — ${BRAND} (${TERMS_VERSION}) — DRAFT PENDING ATTORNEY REVIEW

I acknowledge that operating or supervising the operation of a motor vehicle involves serious risks, including injury, death, and property damage, and that a learner driver is by definition inexperienced. I understand that ${BRAND} is only a record-keeping and coaching aid: it does not control the vehicle, cannot see the road, cannot prevent distraction, and its screen lock applies only within the app.

Assumption of risk. I knowingly and voluntarily assume all risks arising from driving, supervising, and using the Service, whether or not caused by the Service's operation, accuracy, availability, or any content in it.

Release. To the fullest extent permitted by law, I release and discharge ${BRAND} and its owners, officers, employees, contractors, and suppliers (the "Released Parties") from all claims, demands, and liabilities of every kind arising out of or related to driving, supervision, licensing outcomes, or use of the Service, including claims based on negligence of the Released Parties, except to the extent caused by their gross negligence or willful misconduct.

Indemnification. I will defend, indemnify, and hold harmless the Released Parties from any claim, loss, damage, fine, citation, or expense (including reasonable attorneys' fees) brought by me or by any third party that arises out of or relates to my driving, my supervision, my compliance with licensing rules, the accuracy of records I create or approve, or my breach of the Terms of Use.

Minors. If I am under 18, I acknowledge that my parent or legal guardian has linked an account, consented to my use, and agreed to these terms on my behalf. If I am the parent or legal guardian of a minor user, I agree to these terms on the minor's behalf and on my own behalf.

I have read this document and understand it limits my legal rights. I agree to it voluntarily.`,
};

export const GUARDIAN_CONSENT: LegalDoc = {
  key: "guardian_consent",
  title: "Parent/Guardian Consent",
  summary:
    "I am the parent or legal guardian of this learner (or am authorized by one), I consent to the learner's use of the Service, and I accept the Terms of Use and the Assumption of Risk, Release, and Indemnification on the learner's behalf and my own.",
  body: `PARENT/GUARDIAN CONSENT — ${BRAND} (${TERMS_VERSION}) — DRAFT PENDING ATTORNEY REVIEW

I am the parent or legal guardian of the learner who invited me, or I am acting with the authorization of that parent or guardian. I consent to the learner's creation and use of a ${BRAND} account, including the collection of the learner's location during practice drives and its sharing with linked adults. I accept the Terms of Use, the Privacy Policy, and the Assumption of Risk, Release, and Indemnification on the learner's behalf and on my own behalf, and I agree that I am responsible for the learner's compliance with California licensing rules while I supervise.`,
};

export const SUPERVISOR_ATTESTATION: LegalDoc = {
  key: "supervisor_attestation",
  title: "Supervisor Attestation",
  summary: "Supervisor attestation",
  body: `SUPERVISOR ATTESTATION — ${BRAND} (${TERMS_VERSION})

I attest that the information I approve is accurate, and that when I ride shotgun with a California learner under 18 I am a California-licensed driver age 25 or older who meets the applicable licensing and age requirements. I understand this app is a record-keeping aid and not a DMV certification service.`,
};

export const ALL_DOCS: LegalDoc[] = [TERMS, PRIVACY, RISK, GUARDIAN_CONSENT, SUPERVISOR_ATTESTATION];
