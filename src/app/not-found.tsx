import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <div className="num text-[52px] font-semibold leading-none text-ink-700">404</div>
        <h1 className="mt-3 text-[18px] font-semibold text-ink-100">Хуудас олдсонгүй</h1>
        <p className="mt-1.5 text-[13px] text-ink-400">
          Хайсан хуудас байхгүй эсвэл шилжсэн байна.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-lg border border-ink-700 bg-ink-900 px-4 py-2 text-[12.5px] text-ink-200 transition hover:border-sand-500/40 hover:text-ink-100"
        >
          Ерөнхий самбар руу буцах
        </Link>
      </div>
    </div>
  );
}
