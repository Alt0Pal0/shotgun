/** User-facing safety, privacy, and attestation copy. Kept in one place for review. */
export const ATTESTATION_TEXT =
  "I attest that the information I approve is accurate, and that when I ride shotgun with a California learner under 18 I am a California-licensed driver age 25 or older who meets the applicable licensing and age requirements. I understand this app is a record-keeping aid and not a DMV certification service.";

export const SAFETY_LOCK_COPY = {
  title: "Drive in progress",
  body: "Put your phone away and focus on driving. Whoever's riding shotgun has the wheel on feedback — the app unlocks when you park.",
  limits:
    "This app locks only its own screen. It cannot lock your phone or block other apps. We recommend enabling your phone's Driving Focus or Driving Mode before you start.",
};

export const GPS_LIMITS_COPY =
  "Browser GPS runs only while this app is open and visible. Switching apps, locking the screen, low-power mode, or the browser closing may create gaps in the route. Drive time is kept even when the route is incomplete.";

export const PRIVACY_COPY =
  "Your exact routes, reflections, and feedback are private to you and the adults you have linked. We never share or sell location data, and precise coordinates are never sent to analytics.";

export const NOT_LEGAL_COPY =
  "This report is informational, generated from family-approved records, and does not replace official California DMV records, the signed permit, or a driving-school certificate.";

export const BETA_TERMS_PLACEHOLDER =
  "Private beta. Terms of use and privacy policy: placeholder pending legal review.";

/**
 * California shotgun-seat rules, verified against the DMV Driver Handbook and Teen Driver Roadmap (reviewed 2026-08-22).
 * Sources: https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/getting-an-instruction-permit-and-drivers-license/
 *          https://www.dmv.ca.gov/portal/teen-drivers/
 */
export const CA_SHOTGUN_RULES = {
  permit: [
    "With an instruction permit you can never drive alone — not even to the DMV for your driving test.",
    "A California-licensed driver who is at least 25 years old (a parent, guardian, or other qualified adult) must ride shotgun, close enough to take control.",
    "Friends can't be your shotgun: a 16-year-old with a license does not count as your supervising adult.",
    "50 practice hours are required before the driving test, and 10 of them must be at night.",
  ],
  provisional: [
    "For the first 12 months after you get your license (or until you turn 18): no driving between 11 p.m. and 5 a.m.",
    "No passengers under 20 unless a parent/guardian or another California-licensed driver 25 or older rides with you.",
    "Exceptions exist for medical, school, employment, and immediate-family needs, but you must carry a signed note (physician, school official, employer, or parent/guardian).",
  ],
  disclaimer:
    "Summarized from the California DMV Driver Handbook. Rules change; confirm current requirements with the DMV before relying on them.",
};
