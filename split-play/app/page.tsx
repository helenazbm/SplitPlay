import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="splitplay-home-pattern relative isolate flex min-h-dvh flex-1 overflow-x-hidden">
      <Link
        href="/sobre"
        aria-label="Informações sobre o SplitPlay"
        className="font-poppins absolute right-[var(--spacing-fluid-4)] top-[var(--spacing-fluid-5)] z-20 flex items-center justify-center rounded-full border-2 border-white font-bold leading-none text-white"
        style={{
          height: "clamp(1.25rem, 5cqi, 1.75rem)",
          width: "clamp(1.25rem, 5cqi, 1.75rem)",
          fontSize: "var(--text-fluid-xs)",
        }}
      >
        i
      </Link>

      <main
        className="relative z-10 flex min-h-dvh w-full flex-col items-center justify-center"
        style={{
          paddingInline: "var(--spacing-fluid-4)",
          paddingBlock: "clamp(2.5rem, 7dvh, 4.5rem)",
        }}
      >
        <section
          aria-label="SplitPlay"
          className="flex w-full flex-col items-center"
        >
          <Image
            src="/home.svg"
            alt=""
            width={356}
            height={160}
            priority
            className="h-auto w-[356px]"
          />

          <Image
            src="/logo.svg"
            alt="SplitPlay"
            width={207}
            height={49}
            priority
            className="h-auto w-[70%] max-w-[17.5rem]"
            style={{ marginTop: "var(--spacing-fluid-3)" }}
          />

          <div
            className="h-0.5 w-[86%] rounded-full bg-[#fffbf0]"
            style={{ marginTop: "var(--spacing-fluid-3)" }}
          />

          <p
            className="font-poppins text-center font-semibold leading-snug text-white"
            style={{
              marginTop: "var(--spacing-fluid-2)",
              fontSize: "var(--text-fluid-xs)",
            }}
          >
            Dividir a conta nunca foi tão simples e divertido
          </p>
        </section>

        <nav
          className="font-acme flex w-full flex-col items-center"
          style={{
            marginTop: "var(--spacing-fluid-7)",
            gap: "var(--spacing-fluid-3)",
          }}
        >
          <Link
            href="/mesa/entrar"
            className="flex w-full max-w-[min(16.25rem,72cqi)] items-center justify-center rounded-[10px_10px_25px_10px] bg-white leading-none text-[#64835b] shadow-sm transition hover:bg-[#fffbf0] focus:outline-none focus:ring-2 focus:ring-white/80 focus:ring-offset-2 focus:ring-offset-[#418964]"
            style={{
              height: "var(--height-control-lg)",
              fontSize: "var(--text-fluid-lg)",
            }}
          >
            Entrar em uma mesa
          </Link>

          <Link
            href="/login"
            className="flex w-full max-w-[min(16.25rem,72cqi)] items-center justify-center rounded-[10px_10px_25px_10px] bg-white leading-none text-[#64835b] shadow-sm transition hover:bg-[#fffbf0] focus:outline-none focus:ring-2 focus:ring-white/80 focus:ring-offset-2 focus:ring-offset-[#418964]"
            style={{
              height: "var(--height-control-lg)",
              fontSize: "var(--text-fluid-lg)",
            }}
          >
            Login
          </Link>

          <Link
            href="/signup"
            className="border-b border-white leading-tight text-white transition hover:text-[#fffbf0] focus:outline-none focus:ring-2 focus:ring-white/80 focus:ring-offset-4 focus:ring-offset-[#418964]"
            style={{
              marginTop: "var(--spacing-fluid-1)",
              fontSize: "var(--text-fluid-base)",
            }}
          >
            Criar conta
          </Link>
        </nav>
      </main>
    </div>
  );
}
