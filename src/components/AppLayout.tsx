import { ReactNode, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./AppSidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppLayout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (isMobile) setSheetOpen(false);
  }, [isMobile, location.pathname]);

  return (
    <div className="flex h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-background">
      <AppSidebar variant="sidebar" />
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 h-14 z-40 flex items-center gap-3 px-4 bg-background border-b border-border md:hidden">
          <button type="button" onClick={() => setSheetOpen(true)} className="p-2 -ml-2 rounded-md text-muted-foreground hover:bg-muted touch-manipulation" aria-label="Open menu">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-heading font-bold text-lg text-foreground">Sheeza Saloon</span>
        </header>
      )}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-[280px] max-w-[85vw] p-0 gap-0 flex flex-col" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <AppSidebar variant="drawer" />
        </SheetContent>
      </Sheet>
      <main className={cn("flex-1 min-w-0 h-full overflow-y-auto", isMobile && "pt-14")}>
        {children}
      </main>
    </div>
  );
}
