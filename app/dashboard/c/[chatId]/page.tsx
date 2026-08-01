import AIChatInterface from '@/components/AIChatInterface';

export default async function ExistingChatPage({ params }: { params: Promise<{ chatId: string }> }) {
    const { chatId } = await params;
    return <AIChatInterface chatId={chatId} />;
}
