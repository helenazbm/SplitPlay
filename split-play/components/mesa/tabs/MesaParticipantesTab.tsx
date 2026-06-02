"use client";

export type MesaParticipanteView = {
  uid: string;
  displayName: string;
  isAdmin: boolean;
  paid: boolean;
};

type MesaParticipantesTabProps = {
  participantes?: MesaParticipanteView[];
};

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function MesaParticipantesTab({
  participantes = [],
}: MesaParticipantesTabProps) {
  const pagos = participantes.filter((p) => p.paid).length;

  return (
    <div
      className="flex flex-col"
      style={{ gap: "var(--spacing-fluid-3)" }}
      role="tabpanel"
    >
      <div
        className="flex items-center justify-between"
        style={{ gap: "var(--spacing-fluid-2)" }}
      >
        <h2
          className="font-bagel text-[#418964]"
          style={{ fontSize: "var(--text-fluid-lg)" }}
        >
          Participantes
        </h2>
        {participantes.length > 0 ? (
          <span
            className="font-poppins rounded-full bg-[#cde9da] px-3 py-1 font-semibold text-[#418964]"
            style={{ fontSize: "var(--text-fluid-xs)" }}
          >
            {pagos} de {participantes.length} pagaram
          </span>
        ) : null}
      </div>

      {participantes.length === 0 ? (
        <p
          className="font-poppins text-center text-[#64835b]"
          style={{ fontSize: "var(--text-fluid-sm)" }}
        >
          Nenhum participante na mesa ainda.
        </p>
      ) : (
        <ul
          className="flex flex-col"
          style={{ gap: "var(--spacing-fluid-2)" }}
        >
          {participantes.map((participante) => (
            <li
              key={participante.uid}
              className="flex items-center justify-between rounded-[10px_10px_25px_10px] border border-[#418964]/25 bg-white"
              style={{
                padding: "var(--spacing-fluid-3)",
                gap: "var(--spacing-fluid-3)",
              }}
            >
              <div
                className="flex min-w-0 items-center"
                style={{ gap: "var(--spacing-fluid-3)" }}
              >
                <span
                  className="flex shrink-0 items-center justify-center rounded-full bg-[#418964] font-poppins font-semibold text-white"
                  style={{
                    height: "2.5rem",
                    width: "2.5rem",
                    fontSize: "var(--text-fluid-xs)",
                  }}
                >
                  {getInitials(participante.displayName)}
                </span>
                <div className="min-w-0">
                  <p
                    className="font-poppins truncate font-semibold text-[#418964]"
                    style={{ fontSize: "var(--text-fluid-sm)" }}
                  >
                    {participante.displayName}
                    {participante.isAdmin ? (
                      <span
                        className="ml-2 inline-flex rounded-full bg-[#fdebd0] px-2 py-0.5 font-medium text-[#8a6d3b]"
                        style={{ fontSize: "0.65rem" }}
                      >
                        Admin
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>

              <span
                className={`font-poppins shrink-0 rounded-full px-2 py-1 font-semibold ${
                  participante.paid
                    ? "bg-[#cde9da] text-[#418964]"
                    : "bg-[#fdebd0] text-[#8a6d3b]"
                }`}
                style={{ fontSize: "0.65rem" }}
              >
                {participante.paid ? "Pago" : "Pendente"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
