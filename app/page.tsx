import AccountChip from "@/components/home/AccountChip";
import HomeActions from "@/components/home/HomeActions";
import Image from "next/image";

export default function Home() {
  return (
    <div className="splitplay-home-pattern relative isolate flex min-h-dvh flex-1 overflow-x-hidden">
      <AccountChip variant="floating" />

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

        <HomeActions />
      </main>
    </div>
  );
}
