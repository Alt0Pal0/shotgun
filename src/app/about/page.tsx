import Link from "next/link";
import type { Metadata } from "next";
import { BRAND, BRAND_HORNS, TAGLINE } from "@/lib/brand";
import { CA_SHOTGUN_RULES } from "@/lib/copy";

export const metadata: Metadata = {
  title: "About",
  description: `Why ${BRAND} is named after calling shotgun — the rules of the game, and California's rules for who rides shotgun with a learner driver.`,
};

export default function AboutPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-lg px-4 pb-16 pt-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">{BRAND_HORNS}</p>
      <h1 className="mt-1 text-3xl font-bold">Why &ldquo;Shotgun&rdquo;?</h1>
      <p className="mt-2 text-muted">{TAGLINE}</p>

      <section className="card mt-6 p-4">
        <h2 className="text-lg font-bold">Riding shotgun</h2>
        <p className="mt-2 text-sm leading-relaxed">
          The phrase comes from the stagecoach era: the guard who sat up front next to the driver, shotgun across his
          lap, was &ldquo;riding shotgun.&rdquo; Hollywood westerns made the term famous, and by the 1950s kids had
          borrowed it for the best seat in the family car — the front passenger seat.
        </p>
        <p className="mt-2 text-sm leading-relaxed">
          For a learner driver, the front passenger seat is where the most important person in the car sits: the
          licensed adult who watches, coaches, and can grab the wheel. Every practice drive is a parent riding shotgun.
          That&rsquo;s the whole product, so that&rsquo;s the name.
        </p>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="text-lg font-bold">The game (and its rules)</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Everyone played it: on the way to the car, whoever yells &ldquo;Shotgun!&rdquo; first gets the front seat. The
          unwritten rulebook varies by family and by decade, but the classics are:
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>The car must be in sight — no calling it from the couch.</li>
          <li>Everyone in the group must be outside (or at least headed to the car). Early calls are void.</li>
          <li>You must say it out loud; whispers and texts don&rsquo;t count. First clear call wins.</li>
          <li>One call per trip. Calling it again for the ride home requires a new trip and a new call.</li>
          <li>The driver can overrule for safety, and a parent outranks everyone. (House rules apply.)</li>
        </ol>
        <p className="mt-3 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">
          <strong>The Shotgun.Rocks rule:</strong> when a learner is driving, the shotgun seat isn&rsquo;t won by
          yelling. It belongs to the licensed adult who rides along — that&rsquo;s the law, and it&rsquo;s the point.
        </p>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="text-lg font-bold">Who can ride shotgun in California</h2>
        <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider text-muted">With an instruction permit</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {CA_SHOTGUN_RULES.permit.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm font-semibold uppercase tracking-wider text-muted">
          First year with a provisional license
        </h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {CA_SHOTGUN_RULES.provisional.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          {CA_SHOTGUN_RULES.disclaimer} See the{" "}
          <a
            className="underline"
            href="https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/getting-an-instruction-permit-and-drivers-license/"
            target="_blank"
            rel="noreferrer"
          >
            California Driver Handbook
          </a>{" "}
          and the{" "}
          <a className="underline" href="https://www.dmv.ca.gov/portal/teen-drivers/" target="_blank" rel="noreferrer">
            Teen Driver Roadmap
          </a>
          .
        </p>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="text-lg font-bold">How {BRAND} works</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>
            The learner creates a permit profile and invites an adult to <em>ride shotgun</em> — that links the
            accounts.
          </li>
          <li>
            Before a drive, the learner asks a linked adult to ride along. The adult confirms from their own phone that
            they&rsquo;re in the car and it&rsquo;s parked.
          </li>
          <li>
            The learner&rsquo;s phone records the drive and locks itself. The adult riding shotgun sees the live drive
            and taps quick observations.
          </li>
          <li>
            After parking, the learner reflects, the adult reviews and approves, and only approved time counts toward
            the 50 / 10 / 6 hours.
          </li>
        </ol>
      </section>

      <p className="mt-6 text-center text-sm">
        <Link className="text-accent underline" href="/">
          Back to {BRAND}
        </Link>
      </p>
    </main>
  );
}
