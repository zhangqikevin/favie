import { createContext, useContext, useState } from "react";
import BookCallModal from "@/components/book-call-modal";

interface BookCallContextValue {
  openBookCall: () => void;
}

const BookCallContext = createContext<BookCallContextValue>({
  openBookCall: () => {},
});

export function useBookCall() {
  return useContext(BookCallContext).openBookCall;
}

export function BookCallProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <BookCallContext.Provider value={{ openBookCall: () => setOpen(true) }}>
      {children}
      <BookCallModal open={open} onOpenChange={setOpen} />
    </BookCallContext.Provider>
  );
}
