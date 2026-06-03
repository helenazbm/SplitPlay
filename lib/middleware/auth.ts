import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseToken } from "@/lib/firebase-admin";

// Interface para o token decodificado do Firebase
interface DecodedFirebaseToken {
  uid: string;
  email?: string;
  role?: string;
}

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    uid: string;
    email?: string;
    role?: string;
  };
}

export interface RouteContext {
  params?: Promise<Record<string, string>>;
}

export const withAuth = (handler: (req: AuthenticatedRequest, context?: RouteContext) => Promise<NextResponse>) => {
  return async (req: NextRequest, context?: RouteContext) => {
    try {
      // Extrair token do header Authorization
      const authHeader = req.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json(
          { error: "Token de autenticação necessário" },
          { status: 401 }
        );
      }

      const token = authHeader.split("Bearer ")[1];
      
      // Verificar token com Firebase Admin
      const { success, user } = await verifyFirebaseToken(token);

      if (!success || !user) {
        return NextResponse.json(
          { error: "Token inválido" },
          { status: 401 }
        );
      }

      // Fazer cast para a interface do token decodificado
      const decodedUser = user as DecodedFirebaseToken;
      
      // Extrair role dos custom claims
      const role = decodedUser.role || "client";

      // Adicionar usuário à requisição
      const authenticatedReq = req as AuthenticatedRequest;
      authenticatedReq.user = {
        uid: decodedUser.uid,
        email: decodedUser.email,
        role: role,
      };

      return handler(authenticatedReq, context);
    } catch (error) {
      console.error("Erro na autenticação:", error);
      return NextResponse.json(
        { error: "Erro interno de autenticação" },
        { status: 500 }
      );
    }
  };
};

// Middleware para verificar roles específicos
export const withRole = (allowedRoles: string[]) => {
  return (handler: (req: AuthenticatedRequest, context?: RouteContext) => Promise<NextResponse>) => {
    return withAuth(async (req: AuthenticatedRequest, context?: RouteContext) => {
      if (!req.user) {
        return NextResponse.json(
          { error: "Usuário não autenticado" },
          { status: 401 }
        );
      }

      if (!allowedRoles.includes(req.user.role || "client")) {
        return NextResponse.json(
          { error: "Acesso negado" },
          { status: 403 }
        );
      }

      return handler(req, context);
    });
  };
};
