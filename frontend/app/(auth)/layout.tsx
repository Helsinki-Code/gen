import ThemeToggle from "@/components/ThemeToggle";

export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#070c12] flex flex-col items-center justify-center px-4 py-12">
      {/* Background radial glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[700px] w-[700px] rounded-full bg-[radial-gradient(ellipse,hsl(var(--primary)/0.11),transparent_65%)]" />
        <div className="absolute left-1/3 top-1/3 h-[450px] w-[450px] rounded-full bg-[radial-gradient(ellipse,hsl(var(--accent)/0.06),transparent_65%)]" />
      </div>

      {/* Theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle compact />
      </div>

      {children}
    </div>
  );
}
