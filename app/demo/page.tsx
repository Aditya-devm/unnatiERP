'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function DemoPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [messageCount, setMessageCount] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const MESSAGE_LIMIT = 5;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver(() => {
            scrollToBottom();
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const handleSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
        if (e) e.preventDefault();
        if (!input.trim() || isLoading || messageCount >= MESSAGE_LIMIT) return;

        const userMessage = input.trim();
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);
        setMessageCount(prev => prev + 1);

        // Hardcoded demo response to avoid using API key tokens for guests if desired,
        // OR we can still call the API but differently.
        // For "Unnati Powerprep", let's simulate a helpful response or call a restricted API.
        // I will mock it for the demo to save tokens and ensure reliability without auth.

        setTimeout(() => {
            const demoResponses = [
                "That's a great question! In a full account, I would analyze your syllabus and provide a detailed answer. As a guest, I can tell you that consistent practice is key.",
                "I can help you create worksheets for this topic. Please sign up to access the document generator.",
                "Interesting topic! Unnati Powerprep has 50+ past papers related to this. Register to view them.",
                "To get a personalized study plan, please log in to your student 'Ready to Help You' space."
            ];
            const randomResponse = demoResponses[Math.floor(Math.random() * demoResponses.length)];

            setMessages((prev) => [...prev, { role: 'assistant', content: randomResponse + "\n\n(Demo Mode limited response)" }]);
            setIsLoading(false);
        }, 1000);
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col relative px-3 sm:px-6 py-4 overflow-hidden w-full bg-slate-50/20">
            {/* Header Area inside the Demo interface */}
            <header className="shrink-0 py-2 sm:py-3 mb-2">
                <div className="mx-auto flex justify-between items-center glass px-5 py-3.5 rounded-2xl shadow-md border border-white/60">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-base sm:text-[17px] font-black text-slate-800 tracking-tight">Demo Chatbot</h1>
                            <p className="text-[10px] sm:text-xs text-slate-400 font-bold">Limited Guest Workspace</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-extrabold text-orange-600 bg-orange-50 border border-orange-100 px-3.5 py-1.5 rounded-full uppercase tracking-wider">
                            Guest Mode ({messageCount}/{MESSAGE_LIMIT})
                        </span>
                    </div>
                </div>
            </header>

            <main className="flex-grow overflow-hidden flex flex-col w-full relative glass rounded-[24px] sm:rounded-[32px] shadow-xl border border-white/75 bg-white/40">
                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-8 scroll-smooth w-full">
                    <div ref={containerRef} className="max-w-3xl mx-auto space-y-6 sm:space-y-7 pb-12">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center text-center mt-8 sm:mt-16 transition-all duration-700 ease-out">
                                <div className="mb-6 relative">
                                    <div className="absolute inset-[-15%] bg-indigo-500/10 blur-3xl rounded-full animate-pulse"></div>
                                    <img src="/logo.png" alt="Unnati Classes" className="h-20 w-20 sm:h-24 sm:w-24 object-contain shadow-lg rounded-full bg-white p-2 relative z-10 border border-slate-100" />
                                </div>
                                <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-2 tracking-tight">Try out Unnati AI Companion!</h2>
                                <p className="text-slate-400 text-xs sm:text-sm font-bold max-w-sm mb-10 px-4">Ask a question or select a quick starter topic below to see it in action.</p>
                                
                                {/* Suggestion Quick Prompts */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-4">
                                    {[
                                        { title: "Algebra Worksheet", desc: "Create practice questions.", icon: "📝", prompt: "Can you generate a worksheet with 5 practice questions for Class 10 Algebra?" },
                                        { title: "Explain Photosynthesis", desc: "Break down complex concepts.", icon: "💡", prompt: "Explain how photosynthesis works in plants with simple terms." },
                                        { title: "Solve Maths equation", desc: "View step-by-step doubt resolutions.", icon: "🔢", prompt: "Solve the equation: 2x + 5 = 15. Show step by step." },
                                        { title: "5-day science prep", desc: "Make revision study plans.", icon: "📅", prompt: "Create a 5-day study plan for preparing for science exam." }
                                    ].map((suggestion, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setInput(suggestion.prompt)}
                                            className="text-left p-4.5 bg-white/70 hover:bg-white border border-slate-200/50 hover:border-indigo-300 rounded-2xl shadow-sm hover:shadow transition-all duration-200 group cursor-pointer"
                                            disabled={messageCount >= MESSAGE_LIMIT}
                                        >
                                            <div className="flex items-center gap-2.5 mb-1.5">
                                                <span className="text-lg">{suggestion.icon}</span>
                                                <span className="text-sm font-extrabold text-slate-800 group-hover:text-indigo-650 transition-colors">{suggestion.title}</span>
                                            </div>
                                            <p className="text-[11px] sm:text-xs text-slate-400 font-bold leading-normal">{suggestion.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg, index) => {
                            const isUser = msg.role === 'user';
                            return (
                                <div
                                    key={index}
                                    className={`flex w-full transition-all duration-300 ease-out ${isUser ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`flex gap-3 sm:gap-4 w-fit max-w-[90%] sm:max-w-[85%] rounded-[24px] px-5 py-4 sm:px-6 sm:py-5 shadow-sm border ${
                                            isUser
                                            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-500 text-white rounded-tr-none shadow-blue-500/10'
                                            : 'bg-white/90 border-slate-200/60 text-slate-800 rounded-tl-none'
                                        }`}
                                    >
                                        <div className={`shrink-0 flex items-center justify-center h-8.5 w-8.5 rounded-xl overflow-hidden shadow-inner ${isUser ? 'bg-white/15' : 'bg-indigo-50 border border-indigo-100'}`}>
                                            {isUser ? <User className="h-4.5 w-4.5 text-white" /> : <img src="/logo.png" alt="Unnati" className="h-full w-full object-contain p-1.5" />}
                                        </div>
                                        
                                        <div className={`leading-relaxed text-sm prose max-w-none prose-p:my-1.5 prose-headings:my-2.5 prose-li:my-0.5 overflow-x-auto ${isUser ? 'text-white prose-invert font-bold' : 'text-slate-800 font-semibold'}`}>
                                            {isUser ? (
                                                <div className="whitespace-pre-wrap">{msg.content}</div>
                                            ) : (
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm, remarkMath]}
                                                    rehypePlugins={[rehypeKatex]}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {isLoading && (
                            <div className="flex w-full justify-start transition-all duration-300 ease-out">
                                <div className="flex gap-3 w-fit rounded-[24px] rounded-tl-none bg-white border border-slate-200/50 shadow-sm px-5 py-4.5">
                                    <div className="shrink-0 flex items-center justify-center h-8.5 w-8.5 rounded-xl overflow-hidden bg-indigo-50 border border-indigo-100 shadow-inner">
                                        <img src="/logo.png" alt="Unnati" className="h-full w-full object-contain p-1.5" />
                                    </div>
                                    <div className="flex items-center gap-1.5 h-8">
                                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {messageCount >= MESSAGE_LIMIT && (
                            <div className="flex justify-center my-6">
                                <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-6 text-center shadow-sm w-full max-w-md">
                                     <p className="text-slate-500 text-xs font-semibold mb-3">Create a free account to enjoy unlimited chats and resources.</p>
                                     <Link href="/login" className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-extrabold text-xs uppercase tracking-wider border-b-4 border-blue-800 cursor-pointer active:scale-95">
                                         Get started for free
                                     </Link>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} className="h-4" />
                    </div>
                </div>

                {/* Input Area Group */}
                <div className="w-full bg-transparent pt-4 pb-4 px-3 sm:px-6 shrink-0 z-20 border-t border-slate-200/50 bg-white/20">
                    <div className="max-w-3xl mx-auto relative group">
                        <div className="absolute inset-0 bg-blue-600/5 blur-2xl rounded-[24px] group-focus-within:bg-blue-600/8 transition-all duration-300"></div>
                        <form onSubmit={handleSubmit} className={`relative flex items-end gap-2 bg-white/95 backdrop-blur-xl rounded-[20px] sm:rounded-[24px] border border-slate-200/60 shadow-lg ${messageCount >= MESSAGE_LIMIT ? 'opacity-70 bg-gray-50/50 cursor-not-allowed' : 'focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/5'} transition-all overflow-hidden p-2`}>
                            <textarea
                                value={input}
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                                placeholder={messageCount >= MESSAGE_LIMIT ? "Demo limit reached. Register to continue..." : "Message Demo Chat..."}
                                rows={1}
                                className="flex-1 max-h-[150px] min-h-[44px] sm:min-h-[52px] w-full resize-none bg-transparent py-3.5 pl-4 pr-16 text-slate-800 placeholder:text-slate-400 focus:outline-none text-sm sm:text-[15px] leading-relaxed disabled:text-gray-400"
                                disabled={isLoading || messageCount >= MESSAGE_LIMIT}
                                style={{ height: 'auto' }}
                            />
                            <div className="absolute right-2.5 bottom-2.5">
                                <button
                                    type="submit"
                                    disabled={isLoading || !input.trim() || messageCount >= MESSAGE_LIMIT}
                                    className="flex items-center justify-center p-2 h-10 w-10 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-white hover:from-orange-500 hover:to-orange-700 disabled:from-gray-100 disabled:to-gray-200 disabled:text-gray-400 focus:outline-none shadow-md shadow-orange-500/10 transition-all hover:scale-103 active:scale-95 cursor-pointer"
                                >
                                    {isLoading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
                                </button>
                            </div>
                        </form>
                        <div className="text-center mt-2.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                            Demo Mode. {MESSAGE_LIMIT - messageCount} messages remaining.
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
