import Link from "next/link";
export function ExportButton({ learnerId }: { learnerId: string }) {
  return (
    <Link
      href={`/api/reports/instructor?learner=${learnerId}`}
      prefetch={false}
      className="tap inline-flex items-center rounded-xl border border-border px-3 py-2 text-sm font-semibold"
    >
      Instructor PDF
    </Link>
  );
}
