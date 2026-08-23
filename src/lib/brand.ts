/** Product brand. Single source of truth for names and recurring phrases shown to users. */
export const BRAND = "Shotgun.Rocks";
export const BRAND_HORNS = "Shotgun.Rocks 🤘";
export const BRAND_SHORT = "Shotgun";
export const TAGLINE = "Ride shotgun. Log the hours. Earn the license.";
export const BRAND_DOMAIN = "shotgun.rocks";
export const DESCRIPTION =
  "Shotgun.Rocks is the supervised-practice tracker for California learner drivers and the adults who ride shotgun. Log drives with GPS, reflect, get feedback, and watch the 50/10/6-hour progress add up.";

/** Share text when a learner invites an adult to link accounts. */
export function linkInviteShareText(learnerName: string, url: string): string {
  return `Come ride shotgun with me 🤘 ${learnerName} needs a licensed adult in the passenger seat to log permit practice hours on ${BRAND}. Link your account here: ${url}`;
}
/** Share text when a learner asks an already-linked adult to go for a drive. */
export function rideRequestShareText(learnerName: string, url: string): string {
  return `Come ride shotgun with me? 🤘 ${learnerName} wants to get some practice hours on the books. Confirm on your phone: ${url}`;
}
