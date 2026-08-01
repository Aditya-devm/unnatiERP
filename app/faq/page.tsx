'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const faqs = [
    {
        question: "What is Unnati Powerprep?",
        answer: "Unnati Powerprep is an AI-powered educational platform designed to help students prepare for exams using personalized worksheets/questions and an interactive chatbot."
    },
    {
        question: "How does the chatbot work?",
        answer: "The chatbot uses advanced AI (ChatGPT) to understand your questions and provide instant, accurate answers. It can help with concepts, doubts, and creating practice questions."
    },
    {
        question: "Is it free to use?",
        answer: "We offer a guest mode with limited features. Full access to Ready to Help You, personalized worksheets, and unlimited chat requires a registered student account."
    },
    {
        question: "How do I register?",
        answer: "You can sign up for a student account from the registration page. Admin accounts are managed by the institue administrators."
    },
    {
        question: "Can I access it on mobile?",
        answer: "Yes, our platform is fully responsive and works on mobile devices, tablets, and desktops."
    }
];

export default function FAQPage() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <div className="min-h-screen py-24 sm:py-32 relative overflow-hidden grid-pattern">
            {/* Ambient background glows */}
            <div className="absolute top-[10%] left-[-15%] w-[45%] h-[45%] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none animate-liquid"></div>
            <div className="absolute bottom-[10%] right-[-15%] w-[40%] h-[40%] bg-orange-500/5 rounded-full blur-[100px] pointer-events-none animate-liquid" style={{ animationDelay: '-4s' }}></div>

            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="mx-auto max-w-3xl text-center mb-16">
                    <h2 className="text-sm font-black leading-7 text-indigo-600 uppercase tracking-[0.25em] mb-3">Questions & Answers</h2>
                    <p className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
                        Frequently Asked Questions
                    </p>
                    <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-500 font-bold max-w-2xl mx-auto">
                        Have a different question and can’t find the answer you’re looking for? Feel free to contact our support team.
                    </p>
                </div>
                
                <div className="mx-auto max-w-3xl space-y-4">
                    {faqs.map((faq, index) => {
                        const isOpen = openIndex === index;
                        return (
                            <div 
                                key={index} 
                                className={`glass rounded-2xl border transition-all duration-300 overflow-hidden ${
                                    isOpen 
                                    ? 'border-indigo-200 bg-white/95 shadow-lg shadow-indigo-500/5' 
                                    : 'border-slate-200/50 hover:border-slate-300 hover:bg-white/90 shadow-sm'
                                }`}
                            >
                                <dt>
                                    <button
                                        onClick={() => setOpenIndex(isOpen ? null : index)}
                                        className="flex w-full items-center justify-between text-left text-slate-800 p-6 font-bold text-sm sm:text-base focus:outline-none transition-colors"
                                    >
                                        <span>{faq.question}</span>
                                        <span className={`ml-6 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                                            isOpen 
                                            ? 'bg-indigo-50 text-indigo-600 rotate-185' 
                                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                        }`}>
                                            {isOpen ? (
                                                <ChevronUp className="h-4 w-4" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4" />
                                            )}
                                        </span>
                                    </button>
                                </dt>
                                {isOpen && (
                                    <dd className="px-6 pb-6 pr-12 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <p className="text-sm sm:text-[15px] leading-relaxed text-slate-500 font-bold">{faq.answer}</p>
                                    </dd>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
