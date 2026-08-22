export default function DriveLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto w-full max-w-lg px-4 pb-10 pt-5">
      {children}
    </main>
  );
}
