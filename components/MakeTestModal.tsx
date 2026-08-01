'use client';

import { useState } from 'react';
import { X, ClipboardList, FileText, Sparkles, AlertCircle } from 'lucide-react';

export interface TestDetails {
    subject: string;
    grade: string;
    level: 'easy' | 'moderate' | 'hard';
    totalMarks: number;
    sectionMarking: string;
    questionTypes: string[];
    additionalInstructions: string;
    includeAnswerKey: boolean;
}

interface MakeTestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (details: TestDetails) => void;
    attachedFileName?: string | null;
}

export default function MakeTestModal({ isOpen, onClose, onSubmit, attachedFileName }: MakeTestModalProps) {
    const [subject, setSubject] = useState('');
    const [grade, setGrade] = useState('Class 10');
    const [level, setLevel] = useState<'easy' | 'moderate' | 'hard'>('moderate');
    const [totalMarks, setTotalMarks] = useState(50);
    const [sectionMarking, setSectionMarking] = useState(
        "Section A: 10 MCQs (1 mark each)\nSection B: 5 Short Answer questions (2 marks each)\nSection C: 6 Long Answer questions (5 marks each)"
    );
    const [questionTypes, setQuestionTypes] = useState<string[]>(['MCQ', 'Short Answer', 'Long Answer']);
    const [additionalInstructions, setAdditionalInstructions] = useState('');
    const [includeAnswerKey, setIncludeAnswerKey] = useState(true);

    if (!isOpen) return null;

    const handleQuestionTypeToggle = (type: string) => {
        setQuestionTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim()) return;
        onSubmit({
            subject,
            grade,
            level,
            totalMarks,
            sectionMarking,
            questionTypes,
            additionalInstructions,
            includeAnswerKey
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                
                {/* Modal Header */}
                <div className="flex justify-between items-center px-6 py-4.5 border-b border-slate-200/50 bg-slate-50/50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-650">
                            <ClipboardList className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">Create Custom Test Paper</h3>
                            <p className="text-[10px] sm:text-xs text-slate-400 font-bold">Configure details for AI-powered generation</p>
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
                <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                    
                    {/* Attached file notification */}
                    {attachedFileName ? (
                        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100/60 p-3 rounded-2xl">
                            <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-extrabold text-blue-800 truncate">Worksheet / Past Paper Attached</p>
                                <p className="text-[10px] text-blue-600 font-bold truncate">Analyzing: {attachedFileName}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-2.5 bg-amber-50/60 border border-amber-100/60 p-3 rounded-2xl text-[11px] font-bold text-amber-700">
                            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                            <p>To analyze a specific reference worksheet or past paper, attach it in the main chat screen before opening this menu.</p>
                        </div>
                    )}

                    {/* Subject/Topic */}
                    <div>
                        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Subject & Topic <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            required
                            placeholder="e.g., Class 10 Mathematics - Circles"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Grade */}
                        <div>
                            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Grade / Standard</label>
                            <select
                                value={grade}
                                onChange={(e) => setGrade(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 font-medium focus:outline-none transition-all"
                            >
                                {Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`).map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>

                        {/* Total Marks */}
                        <div>
                            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Total Marks</label>
                            <input
                                type="number"
                                min={5}
                                max={100}
                                value={totalMarks}
                                onChange={(e) => setTotalMarks(Number(e.target.value))}
                                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 rounded-xl px-4 py-2.5 text-sm text-slate-800 font-medium focus:outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Difficulty Level */}
                    <div>
                        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Difficulty Level</label>
                        <div className="grid grid-cols-3 gap-2 bg-slate-100/60 p-1 rounded-xl">
                            {(['easy', 'moderate', 'hard'] as const).map((lvl) => {
                                const activeStyles = {
                                    easy: 'bg-green-600 text-white shadow-sm hover:bg-green-700',
                                    moderate: 'bg-amber-500 text-white shadow-sm hover:bg-amber-600',
                                    hard: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
                                };
                                const inactiveStyles = 'text-slate-500 hover:text-slate-850 hover:bg-slate-200/50';
                                const isActive = level === lvl;
                                
                                return (
                                    <button
                                        key={lvl}
                                        type="button"
                                        onClick={() => setLevel(lvl)}
                                        className={`py-2 rounded-lg text-xs font-black capitalize transition-all cursor-pointer ${isActive ? activeStyles[lvl] : inactiveStyles}`}
                                    >
                                        {lvl}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Question Types */}
                    <div>
                        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Types of Questions</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['MCQ', 'Short Answer', 'Long Answer', 'True / False', 'Fill in the blanks'].map((type) => {
                                const isChecked = questionTypes.includes(type);
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => handleQuestionTypeToggle(type)}
                                        className={`flex items-center gap-2.5 px-3 py-2 border rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${isChecked ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50/55 border-slate-200 text-slate-600 hover:bg-slate-100/50'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            readOnly
                                            className="h-3.5 w-3.5 accent-indigo-600 cursor-pointer pointer-events-none"
                                        />
                                        <span>{type}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Section wise marking */}
                    <div>
                        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Section-wise Marking / Structure</label>
                        <textarea
                            rows={3}
                            placeholder="Detail sections and mark allocations..."
                            value={sectionMarking}
                            onChange={(e) => setSectionMarking(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none transition-all resize-none"
                        />
                    </div>

                    {/* Additional Instructions */}
                    <div>
                        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Additional Instructions (Optional)</label>
                        <textarea
                            rows={2}
                            placeholder="e.g., Include diagram-based questions, prioritize board-exam format..."
                            value={additionalInstructions}
                            onChange={(e) => setAdditionalInstructions(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none transition-all resize-none"
                        />
                    </div>

                    {/* Include Answer Key Toggle */}
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/50 rounded-2xl">
                        <div>
                            <span className="block text-xs font-extrabold text-slate-800">Generate Answers & Solutions</span>
                            <span className="block text-[10px] text-slate-400 font-bold">Appends solutions at the bottom of the test</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeAnswerKey}
                                onChange={(e) => setIncludeAnswerKey(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:height-5 after:width-5 after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                </form>

                {/* Modal Footer */}
                <div className="px-6 py-4.5 border-t border-slate-200/50 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4.5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl font-extrabold text-xs text-slate-600 transition-all hover:bg-slate-50 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleFormSubmit}
                        disabled={!subject.trim()}
                        className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-xl font-extrabold text-xs shadow-md shadow-indigo-600/10 hover:shadow-lg hover:scale-102 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        Generate Test
                    </button>
                </div>
            </div>
        </div>
    );
}
