'use client';

import { useState, useEffect } from 'react';
import { X, FileText, FileSpreadsheet, Sparkles, Settings2, ArrowRight } from 'lucide-react';

export interface DownloadConfig {
    mode: 'normal' | 'test';
    templateStyle: 'new' | 'previous';
    subject: string;
    grade: string;
    duration: string;
    docNo: string;
    totalMarks: number;
}

interface DownloadOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (config: DownloadConfig) => void;
    defaultDetails: {
        subject: string;
        grade: string;
        duration: string;
        docNo: string;
        totalMarks: number;
    };
}

export default function DownloadOptionsModal({ isOpen, onClose, onSubmit, defaultDetails }: DownloadOptionsModalProps) {
    const [mode, setMode] = useState<'normal' | 'test'>('normal');
    const [templateStyle, setTemplateStyle] = useState<'new' | 'previous'>('new');
    const [subject, setSubject] = useState('');
    const [grade, setGrade] = useState('');
    const [duration, setDuration] = useState('');
    const [docNo, setDocNo] = useState('');
    const [totalMarks, setTotalMarks] = useState(40);

    // Sync with defaultDetails when modal opens
    useEffect(() => {
        if (isOpen) {
            setSubject(defaultDetails.subject || 'Mathematics');
            setGrade(defaultDetails.grade || 'Class 10');
            setDuration(defaultDetails.duration || '1½ hours');
            setDocNo(defaultDetails.docNo || 'UC/053');
            setTotalMarks(defaultDetails.totalMarks || 40);
        }
    }, [isOpen, defaultDetails]);

    if (!isOpen) return null;

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            mode,
            templateStyle,
            subject,
            grade,
            duration,
            docNo,
            totalMarks
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                
                {/* Modal Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200/50 bg-slate-50/50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-650">
                            <Settings2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base font-black text-slate-800 tracking-tight">Export PDF Options</h3>
                            <p className="text-[10px] text-slate-400 font-bold">Select and configure document template</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                    
                    {/* Mode Selector */}
                    <div>
                        <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider mb-2">Export Mode</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setMode('normal')}
                                className={`p-4 border rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer ${mode === 'normal' ? 'bg-indigo-50/40 border-indigo-250 text-indigo-700 shadow-sm' : 'bg-slate-50/50 border-slate-200 text-slate-650 hover:bg-slate-100/50'}`}
                            >
                                <FileText className="h-5 w-5" />
                                <div>
                                    <span className="block text-xs font-extrabold">Normal Download</span>
                                    <span className="block text-[9px] text-slate-400 mt-0.5">Clean format, general study</span>
                                </div>
                            </button>
                            
                            <button
                                type="button"
                                onClick={() => setMode('test')}
                                className={`p-4 border rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer ${mode === 'test' ? 'bg-indigo-50/40 border-indigo-250 text-indigo-700 shadow-sm' : 'bg-slate-50/50 border-slate-200 text-slate-650 hover:bg-slate-100/50'}`}
                            >
                                <FileSpreadsheet className="h-5 w-5" />
                                <div>
                                    <span className="block text-xs font-extrabold">Test Paper Template</span>
                                    <span className="block text-[9px] text-slate-400 mt-0.5">Official school exam format</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Test configuration options (collapsible) */}
                    {mode === 'test' && (
                        <div className="space-y-4 border-t border-slate-100 pt-4 animate-in slide-in-from-top-3 duration-250">
                            
                            {/* Template Style */}
                            <div>
                                <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider mb-2">Template Style</label>
                                <div className="grid grid-cols-2 gap-2.5 bg-slate-100/60 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setTemplateStyle('new')}
                                        className={`py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${templateStyle === 'new' ? 'bg-indigo-650 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        New Exam Template
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTemplateStyle('previous')}
                                        className={`py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${templateStyle === 'previous' ? 'bg-indigo-650 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Previous Template
                                    </button>
                                </div>
                            </div>

                            {/* Conditional Header Settings (Only for New template) */}
                            {templateStyle === 'new' && (
                                <div className="space-y-3.5 bg-slate-50/50 border border-slate-150/40 p-4 rounded-2xl animate-in zoom-in-98 duration-150">
                                    <div className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider border-b border-slate-100 pb-1.5 mb-1 flex items-center gap-1.5">
                                        <Sparkles className="h-3 w-3 text-indigo-500" /> Header Info Settings
                                    </div>
                                    
                                    {/* Subject */}
                                    <div>
                                        <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">Subject</label>
                                        <input
                                            type="text"
                                            required
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            className="w-full bg-white border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none transition-all"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {/* STD */}
                                        <div>
                                            <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">STD / Class</label>
                                            <input
                                                type="text"
                                                required
                                                value={grade}
                                                onChange={(e) => setGrade(e.target.value)}
                                                className="w-full bg-white border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none transition-all"
                                            />
                                        </div>

                                        {/* Total Marks */}
                                        <div>
                                            <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">Total Marks</label>
                                            <input
                                                type="number"
                                                required
                                                value={totalMarks}
                                                onChange={(e) => setTotalMarks(Number(e.target.value))}
                                                className="w-full bg-white border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Duration */}
                                        <div>
                                            <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">Duration</label>
                                            <input
                                                type="text"
                                                required
                                                value={duration}
                                                onChange={(e) => setDuration(e.target.value)}
                                                className="w-full bg-white border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none transition-all"
                                            />
                                        </div>

                                        {/* Doc No */}
                                        <div>
                                            <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">Doc No</label>
                                            <input
                                                type="text"
                                                required
                                                value={docNo}
                                                onChange={(e) => setDocNo(e.target.value)}
                                                className="w-full bg-white border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </form>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-slate-200/50 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl font-extrabold text-xs text-slate-600 transition-all hover:bg-slate-50 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleFormSubmit}
                        className="flex items-center gap-1.5 px-4.5 py-2 bg-gradient-to-br from-indigo-650 to-blue-650 text-white rounded-xl font-extrabold text-xs shadow-md shadow-indigo-650/10 hover:shadow-lg hover:scale-102 active:scale-95 transition-all cursor-pointer"
                    >
                        Export Document
                        <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
