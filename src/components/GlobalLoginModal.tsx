// src/components/GlobalLoginModal.tsx
// Instancia única del LoginModal controlada por useAuthModalStore.
import { LoginModal } from "@/components/LoginModal";
import { useAuthModalStore } from "@/stores/authModalStore";

export function GlobalLoginModal() {
  const open = useAuthModalStore((s) => s.open);
  const setOpen = useAuthModalStore((s) => s.setOpen);
  return <LoginModal open={open} onOpenChange={setOpen} />;
}
