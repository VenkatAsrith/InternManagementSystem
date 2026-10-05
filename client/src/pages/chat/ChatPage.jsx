import React from 'react';
import { PageHeader } from '../../components/ui';
import { ChatPanel } from '../../components/chat/ChatPanel';

export function ChatPage() {
  return (
    <>
      <PageHeader
        title="Real-Time Collaboration"
        description="Communicate with teammates, mentors, and project groups in secure, role-governed channels."
      />
      <div className="mt-4">
        <ChatPanel className="h-[calc(100vh-14rem)] min-h-[520px]" />
      </div>
    </>
  );
}
