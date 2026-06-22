"use client";

import AppHome from "@/components/home/AppHome";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function InicioPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?redirect=/inicio");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-dvh flex-1 items-center justify-center bg-[#418964] text-white">
        <p className="font-poppins" style={{ fontSize: "var(--text-fluid-sm)" }}>
          Carregando...
        </p>
      </main>
    );
  }

  return <AppHome />;
}
