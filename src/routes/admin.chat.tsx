import { createFileRoute } from "@tanstack/react-router";
import { ChatConversaciones } from "@/components/admin/ChatConversaciones";

export const Route = createFileRoute("/admin/chat")({
  component: AdminChatPage,
});

function AdminChatPage() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Conversaciones del asistente</h1>
      <ChatConversaciones />
    </div>
  );
}