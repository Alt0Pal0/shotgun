import { headers } from "next/headers";
import { requireUser } from "@/lib/server/session";
import { BottomNav, Shell } from "@/components/ui/Page";
import { LiveBanner } from "@/components/drive/LiveBanner";
import { AppHeader } from "@/components/ui/AppHeader";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { me } = await requireUser({ enforceLock: true });
  const isLearner = Boolean(me.track);
  const isAdult = Boolean(me.profile?.is_adult || me.learners.length);
  const items = isLearner
    ? [
        { href: "/home", label: "Home", icon: "⌂" },
        { href: "/drives", label: "Drives", icon: "≡" },
        { href: "/progress", label: "Progress", icon: "◔" },
        { href: "/profile", label: "Me", icon: "◯" },
      ]
    : isAdult
      ? [
          { href: "/reviews", label: "Reviews", icon: "✓" },
          { href: "/learners", label: "Learners", icon: "☺" },
          { href: "/profile", label: "Me", icon: "◯" },
        ]
      : [{ href: "/profile", label: "Me", icon: "◯" }];
  const path = (await headers()).get("x-pathname") ?? "";
  const active = items.find((i) => path.startsWith(i.href))?.href ?? items[0].href;
  return (
    <>
      <AppHeader />
      <Shell>
        {isAdult && <LiveBanner />}
        {children}
      </Shell>
      <BottomNav items={items} active={active} />
    </>
  );
}
