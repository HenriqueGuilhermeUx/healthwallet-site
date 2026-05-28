import type { Metadata } from "next";
import "./globals.css";
import { Providers, Header } from "@/components/Layout";

export const metadata: Metadata = {
  title: "HealthWallet.pro - Plataforma para Profissionais de Saúde",
  description: "Acesse exames e dados de saúde dos seus pacientes de forma segura",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-50">
        <Providers>
          <Header />
          <main className="flex-1">
            {children}
          </main>
          <footer className="border-t py-6 bg-white">
            <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-500">
              <p>HealthWallet.pro - Plataforma Segura para Profissionais de Saúde</p>
              <p className="mt-1">Seus dados são protegidos e criptografados</p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
