import Link from "next/link";

export function ForgeMark({
  href = "/",
  label = "DSA Forge home",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      className="inline-flex w-fit items-center gap-2 text-[19px] font-extrabold no-underline"
      href={href}
      aria-label={label}
    >
      <span
        className="grid h-9 w-9 place-items-center bg-black text-2xl leading-none text-white"
        aria-hidden="true"
      >
        +
      </span>
      <span>DSA Forge</span>
    </Link>
  );
}
