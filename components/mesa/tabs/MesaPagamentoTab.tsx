"use client";

export default function MesaPagamentoTab() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        gap: "var(--spacing-fluid-3)",
        paddingBlock: "var(--spacing-fluid-6)",
      }}
      role="tabpanel"
    >
      <i
        aria-hidden="true"
        className="pi pi-wallet text-[#418964]"
        style={{ fontSize: "var(--text-fluid-3xl)" }}
      />
      <h2
        className="font-bagel text-[#418964]"
        style={{ fontSize: "var(--text-fluid-lg)" }}
      >
        Pagamento
      </h2>
      <p
        className="font-poppins text-[#64835b]"
        style={{ fontSize: "var(--text-fluid-sm)" }}
      >
        Em breve você poderá acompanhar e fechar a sua parte da conta por aqui.
      </p>
    </div>
  );
}
