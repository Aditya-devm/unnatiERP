'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import {
  Send,
  Sparkles,
  Paperclip,
  X,
  Copy,
  Check,
  User,
  Loader2,
  FileText,
  HelpCircle,
  BookOpen,
  Calendar,
  Download,
  Menu
} from 'lucide-react';
import katex from 'katex';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface AIMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  attachmentName?: string | null;
  createdAt?: any;
}

// Clean raw Markdown syntax symbols (**, ##, ###, ---, *) from text output, while protecting LaTeX math expressions ($...$, $$...$$)
function cleanMarkdownText(str: string): string {
  if (!str) return '';

  const mathBlocks: string[] = [];
  const tokenPrefix = 'XKATEXMATHTOKEN';
  const tokenSuffix = 'XKATEXENDTOKEN';

  // Protect LaTeX math expressions before markdown regex cleaning
  const protectedStr = str.replace(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n]+?\$|\\\([\s\S]+?\\\))/g, (match) => {
    mathBlocks.push(match);
    return `${tokenPrefix}${mathBlocks.length - 1}${tokenSuffix}`;
  });

  const cleaned = protectedStr
    // Remove bold markers **text** -> text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    // Remove italic markers *text* or _text_ -> text (outside protected math tokens)
    .replace(/[\*_](.*?)([\*_])/g, '$1')
    // Remove heading markers ### Heading -> Heading
    .replace(/^#{1,6}\s+/gm, '')
    // Remove horizontal rules --- or ***
    .replace(/^[\-\*]{3,}\s*$/gm, '')
    // Clean bullet symbols at start of lines * or -
    .replace(/^[\*\-]\s+/gm, '• ');

  // Restore exact LaTeX math blocks
  const restoreRegex = new RegExp(`${tokenPrefix}(\\d+)${tokenSuffix}`, 'g');
  return cleaned.replace(restoreRegex, (_, idx) => {
    return mathBlocks[parseInt(idx, 10)] || '';
  });
}

// Sanitize LaTeX math symbols for plain text PDF fallback so raw $, $$, \frac, \sqrt, \pm symbols never appear
function sanitizeLaTeXForTextPDF(str: string): string {
  if (!str) return '';
  let text = cleanMarkdownText(str);

  text = text
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\pm/g, '±')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\leftarrow/g, '←')
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\degree/g, '°')
    .replace(/\\pi/g, 'π')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\theta/g, 'θ')
    .replace(/\\text\{([^}]+)\}/g, '$1');

  text = text
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\\\[/g, '')
    .replace(/\\\]/g, '')
    .replace(/\\\(/g, '')
    .replace(/\\\)/g, '')
    .replace(/\\/g, '');

  return text;
}

// Render inline math ($...$) inside a line without breaking sentences into separate paragraph blocks
function renderInlineMathInLine(lineStr: string): string {
  const inlineRegex = /(\$[^\$\n]+?\$|\\\([\s\S]+?\\\))/g;

  let result = lineStr.replace(inlineRegex, (match) => {
    const latex = match.startsWith('$') ? match.slice(1, -1).trim() : match.slice(2, -2).trim();
    try {
      return katex.renderToString(latex, { displayMode: false, throwOnError: false });
    } catch (e) {
      return match;
    }
  });

  result = result
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^#{1,6}\s+/gm, '');

  return result;
}

// Build clean, un-boxed publication-grade PDF HTML with sub-item line splitting, full page height utilization, and larger fonts
function buildStructuredPDFHTML(content: string): string {
  const lines = content.split('\n');
  let bodyHtml = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check if line starts a new Section Header (e.g. SECTION A: ..., PART B: ...)
    if (/^(SECTION|PART)\s+[A-Z0-9]/i.test(trimmed) || /^#{1,3}\s+(SECTION|PART)/i.test(trimmed)) {
      const cleanTitle = cleanMarkdownText(trimmed);
      bodyHtml += `
        <div class="pdf-block section-title">
          ${cleanTitle}
        </div>
      `;
      continue;
    }

    // Check if line is a standalone Display Block Math $$...$$ or \[...\]
    if ((trimmed.startsWith('$$') && trimmed.endsWith('$$')) || (trimmed.startsWith('\\[') && trimmed.endsWith('\\]'))) {
      const latex = trimmed.startsWith('$$') ? trimmed.slice(2, -2).trim() : trimmed.slice(2, -2).trim();
      try {
        const renderedMath = katex.renderToString(latex, { displayMode: true, throwOnError: false });
        bodyHtml += `<div class="pdf-block katex-display">${renderedMath}</div>`;
      } catch (e) {
        bodyHtml += `<div class="pdf-block text-rose-600 font-mono">${trimmed}</div>`;
      }
      continue;
    }

    // Check if line starts a Question (e.g. Question 1., Q1., 1.)
    const isQuestionStart = /^(Question\s+\d+|Q\d+|\d+\.)/i.test(trimmed);
    const lineWithInlineMath = renderInlineMathInLine(rawLine);

    if (isQuestionStart) {
      bodyHtml += `
        <div class="pdf-block question-title">
          ${lineWithInlineMath}
        </div>
      `;
    } else {
      bodyHtml += `
        <div class="pdf-block content-text">
          ${lineWithInlineMath}
        </div>
      `;
    }
  }

  return bodyHtml;
}

// Component to render text containing clean formatting and KaTeX math formulas ($...$ or $$...$$) without colored background boxes
const KaTeXFormattedText = React.memo(function KaTeXFormattedText({ content, isUser }: { content: string; isUser: boolean }) {
  const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n]+?\$|\\\([\s\S]+?\\\))/g;
  const parts = content.split(regex);

  return (
    <div className={`prose max-w-none text-sm leading-relaxed ${isUser ? 'text-white font-medium' : 'text-slate-800 font-normal'}`}>
      {parts.map((part, i) => {
        if (!part) return null;

        // Display Block Math $$...$$ or \[...\]
        if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('\\[') && part.endsWith('\\]'))) {
          const latex = part.startsWith('$$') ? part.slice(2, -2).trim() : part.slice(2, -2).trim();
          try {
            const html = katex.renderToString(latex, { displayMode: true, throwOnError: false });
            return (
              <div
                key={i}
                className="my-3 overflow-x-auto py-2 text-center text-slate-900 font-normal border-y border-slate-200/50"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (e) {
            return <code key={i} className="text-rose-500 font-mono">{part}</code>;
          }
        }

        // Inline Math $...$ or \(...\)
        if ((part.startsWith('$') && part.endsWith('$') && part.length > 2) || (part.startsWith('\\(') && part.endsWith('\\)'))) {
          const latex = part.startsWith('$') ? part.slice(1, -1).trim() : part.slice(2, -2).trim();
          try {
            const html = katex.renderToString(latex, { displayMode: false, throwOnError: false });
            return (
              <span
                key={i}
                className={`inline-block mx-0.5 font-normal ${isUser ? 'text-white' : 'text-slate-900'}`}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (e) {
            return <code key={i} className="text-rose-500 font-mono">{part}</code>;
          }
        }

        // Regular Text (Cleaned of raw **, ##, ### markers)
        const cleanedText = cleanMarkdownText(part);
        return (
          <span key={i} className="whitespace-pre-wrap">
            {cleanedText}
          </span>
        );
      })}
    </div>
  );
});

// Memoized AIMessageCard to isolate input keystrokes from message tree re-renders
const AIMessageCard = React.memo(function AIMessageCard({
  msg,
  index,
  isUser,
  copiedIndex,
  generatingPdfIndex,
  copyToClipboard,
  downloadResponsePDF
}: {
  msg: AIMessage;
  index: number;
  isUser: boolean;
  copiedIndex: number | null;
  generatingPdfIndex: number | null;
  copyToClipboard: (text: string, index: number) => void;
  downloadResponsePDF: (index: number, content: string) => void;
}) {
  return (
    <div className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-sm">
          <img src="/logo.png" alt="Unnati Classes Logo" className="w-full h-full object-contain" />
        </div>
      )}

      <div className={`flex flex-col max-w-[90%] sm:max-w-[82%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm ${isUser ? 'bg-indigo-600 text-white rounded-br-none font-medium' : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none font-normal'}`}>
          {msg.attachmentName && (
            <div className={`flex items-center gap-1.5 mb-2 pb-2 text-xs font-bold ${isUser ? 'border-b border-indigo-400/50 text-indigo-100' : 'border-b border-slate-100 text-slate-500'}`}>
              <FileText className="w-3.5 h-3.5" />
              <span>Attachment: {msg.attachmentName}</span>
            </div>
          )}

          <KaTeXFormattedText content={msg.content} isUser={isUser} />
        </div>

        {!isUser && (
          <div className="mt-2 flex items-center gap-3 px-1">
            <button
              onClick={() => copyToClipboard(msg.content, index)}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              {copiedIndex === index ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-500 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Text</span>
                </>
              )}
            </button>

            <button
              onClick={() => downloadResponsePDF(index, msg.content)}
              disabled={generatingPdfIndex === index}
              className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-2.5 py-1 rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Download KaTeX Formatted PDF"
            >
              {generatingPdfIndex === index ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3 h-3" />
                  <span>Download PDF</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-md">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
});

// Animated loading status showing typing sequence for Line 1, reversing after 2s, and typing Line 2
function AnimatedLoadingStatus() {
  const line1 = "⚡ Unnati AI is generating your personalized solution...";
  const line2 = "✨ Unnati AI is crafting your response...";

  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    let isMounted = true;
    let timeoutId: any = null;

    const runSequence = async () => {
      // 1. Type Line 1 letter by letter
      for (let i = 1; i <= line1.length; i++) {
        if (!isMounted) return;
        setDisplayText(line1.slice(0, i));
        await new Promise((r) => { timeoutId = setTimeout(r, 22); });
      }

      // 2-second hold before reversing
      await new Promise((r) => { timeoutId = setTimeout(r, 2000); });

      // 2. Reverse Line 1 (backspacing letter by letter)
      for (let i = line1.length; i >= 0; i--) {
        if (!isMounted) return;
        setDisplayText(line1.slice(0, i));
        await new Promise((r) => { timeoutId = setTimeout(r, 14); });
      }

      // Brief pause before typing line 2
      await new Promise((r) => { timeoutId = setTimeout(r, 300); });

      // 3. Type Line 2 letter by letter
      for (let i = 1; i <= line2.length; i++) {
        if (!isMounted) return;
        setDisplayText(line2.slice(0, i));
        await new Promise((r) => { timeoutId = setTimeout(r, 22); });
      }
    };

    runSequence();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="flex gap-3 items-start justify-start animate-in fade-in duration-300">
      <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-sm">
        <img src="/logo.png" alt="Unnati Classes Logo" className="w-full h-full object-contain" />
      </div>
      <div className="bg-white border border-indigo-200/80 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2.5">
        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
        <span className="text-xs font-bold text-slate-700 font-mono tracking-tight">
          {displayText}
          <span className="inline-block w-1.5 h-3.5 bg-indigo-500 ml-1 animate-pulse vertical-middle" />
        </span>
      </div>
    </div>
  );
}

export default function AIChatInterface({ chatId }: { chatId?: string | null }) {
  const { user } = useAuth();
  const router = useRouter();

  const [sessionId, setSessionId] = useState<string | null>(chatId || null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [generatingPdfIndex, setGeneratingPdfIndex] = useState<number | null>(null);

  // File attachment state
  const [selectedFile, setSelectedFile] = useState<{ name: string; data: string; mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs for DOM elements
  const messageCardRefs = useRef<{ [index: number]: HTMLDivElement | null }>({});
  const messagesScrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesScrollAreaRef.current) {
      messagesScrollAreaRef.current.scrollTo({
        top: messagesScrollAreaRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loadingMsg]);

  useEffect(() => {
    setSessionId(chatId || null);
  }, [chatId]);

  // Firestore Snapshot for AI messages
  useEffect(() => {
    if (!user || !sessionId) {
      setMessages([]);
      return;
    }

    setLoadingSession(true);
    const msgsCol = collection(db, 'users', user.uid, 'chatSessions', sessionId, 'messages');
    const q = query(msgsCol, orderBy('createdAt', 'asc'));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: AIMessage[] = [];
        const seenKeys = new Set<string>();

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as AIMessage;
          const msgId = docSnap.id;
          const uniqueKey = msgId || `${data.role}-${data.content}-${data.createdAt}`;

          if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            list.push({ id: msgId, ...data });
          }
        });

        setMessages(list);
        setLoadingSession(false);
      },
      (err) => {
        console.error('Error fetching AI messages:', err);
        setLoadingSession(false);
      }
    );

    return () => unsub();
  }, [user, sessionId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      setSelectedFile({
        name: file.name,
        data: base64Data,
        mimeType: file.type || 'application/octet-stream'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (promptOverride?: string) => {
    const textToSend = (promptOverride || inputText).trim();
    if ((!textToSend && !selectedFile) || loadingMsg || !user) return;

    let currentSessionId = sessionId;
    setInputText('');
    const currentFile = selectedFile;
    setSelectedFile(null);
    setLoadingMsg(true);

    try {
      if (!currentSessionId) {
        const titleSnippet = textToSend.slice(0, 35) || 'New Study Discussion';
        const sessionRef = doc(collection(db, 'users', user.uid, 'chatSessions'));
        currentSessionId = sessionRef.id;

        await setDoc(sessionRef, {
          title: titleSnippet,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        setSessionId(currentSessionId);
        router.push(`/dashboard/c/${currentSessionId}`);
      } else {
        const sessionRef = doc(db, 'users', user.uid, 'chatSessions', currentSessionId);
        await updateDoc(sessionRef, {
          updatedAt: new Date().toISOString()
        });
      }

      const userMsgRef = doc(collection(db, 'users', user.uid, 'chatSessions', currentSessionId, 'messages'));
      const userMsgData: AIMessage = {
        role: 'user',
        content: textToSend,
        attachmentName: currentFile?.name || null,
        createdAt: new Date().toISOString()
      };
      await setDoc(userMsgRef, userMsgData);

      const history = messages.map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          file: currentFile ? { data: currentFile.data, mimeType: currentFile.mimeType } : null,
          history
        })
      });

      if (!res.ok) throw new Error(`AI Service Error (${res.status})`);

      const data = await res.json();
      const aiReply = data.reply || "I'm sorry, I couldn't generate a response. Please try again.";

      const aiMsgRef = doc(collection(db, 'users', user.uid, 'chatSessions', currentSessionId, 'messages'));
      const aiMsgData: AIMessage = {
        role: 'assistant',
        content: aiReply,
        createdAt: new Date().toISOString()
      };
      await setDoc(aiMsgRef, aiMsgData);
    } catch (err: any) {
      console.error('Error in AI Chat:', err);
      if (currentSessionId) {
        const errorMsgData: AIMessage = {
          role: 'assistant',
          content: 'I apologize, but I am experiencing high traffic right now. Please re-send your question in a moment!',
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'users', user.uid, 'chatSessions', currentSessionId, 'messages'), errorMsgData);
      }
    } finally {
      setLoadingMsg(false);
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    const cleanedText = cleanMarkdownText(text);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(cleanedText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = cleanedText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Clipboard API Error, executing fallback:', err);
      try {
        const textArea = document.createElement('textarea');
        textArea.value = cleanedText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
      } catch (fallbackErr) {
        console.error('All copy methods failed:', fallbackErr);
        alert('Could not copy text automatically. Please select and copy text manually.');
      }
    }
  };

  // Real HTML/CSS Vector PDF Export Pipeline with KaTeX DOM layout & CSS Page Break Protection
  const downloadResponsePDF = async (index: number, content: string) => {
    setGeneratingPdfIndex(index);

    try {
      let printFrame = document.getElementById('pdf-print-iframe') as HTMLIFrameElement;
      if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'pdf-print-iframe';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        printFrame.style.visibility = 'hidden';
        document.body.appendChild(printFrame);
      }

      const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
      if (!frameDoc) throw new Error('Could not access print frame document.');

      const structuredBody = buildStructuredPDFHTML(content);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Unnati_AI_Solution_${index + 1}</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.33/dist/katex.min.css">
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 12mm 15mm 12mm;
            }
            @media print {
              html, body {
                background: #ffffff !important;
                color: #0f172a !important;
                font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
                font-size: 13px !important;
                line-height: 1.6 !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .no-print { display: none !important; }
              .pdf-block {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .doc-header {
                page-break-after: avoid !important;
                break-after: avoid !important;
              }
            }

            body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              color: #0f172a;
              background-color: #ffffff;
              padding: 10px;
              font-size: 13px;
              line-height: 1.6;
            }

            .doc-header {
              border-bottom: 2px solid #4f46e5;
              padding-bottom: 12px;
              margin-bottom: 20px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              page-break-after: avoid;
              break-after: avoid;
            }
            .doc-title {
              font-size: 18px;
              font-weight: 800;
              color: #1e1b4b;
              margin: 0 0 4px 0;
              letter-spacing: -0.2px;
            }
            .doc-meta {
              font-size: 11px;
              color: #64748b;
              font-weight: 600;
              margin: 0;
            }
            .doc-badge {
              background-color: #e0e7ff;
              color: #3730a3;
              font-size: 10px;
              font-weight: 800;
              padding: 4px 10px;
              border-radius: 9999px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }

            .section-title {
              font-size: 14px;
              font-weight: 800;
              color: #312e81;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-bottom: 1.5px solid #cbd5e1;
              padding-bottom: 4px;
              margin-top: 18px;
              margin-bottom: 10px;
              page-break-after: avoid;
              break-after: avoid;
            }

            .pdf-block {
              margin-bottom: 12px;
              page-break-inside: avoid;
              break-inside: avoid;
            }

            .question-title {
              font-weight: 700;
              font-size: 14px;
              color: #0f172a;
              margin-top: 14px;
              margin-bottom: 6px;
              page-break-after: avoid;
              break-after: avoid;
            }

            .content-text {
              margin: 6px 0;
              font-size: 13px;
              color: #1e293b;
              line-height: 1.65;
            }

            .katex-display {
              margin: 14px 0 !important;
              padding: 8px 0 !important;
              text-align: center !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .katex {
              font-size: 1.15em !important;
              line-height: 1.2 !important;
            }
            .katex .frac-line {
              border-bottom-width: 1.5px !important;
              border-color: #0f172a !important;
            }

            .doc-footer {
              margin-top: 30px;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
              text-align: center;
              font-size: 10px;
              color: #94a3b8;
              font-weight: 600;
              page-break-before: auto;
            }
          </style>
        </head>
        <body>
          <div class="doc-header">
            <div>
              <h1 class="doc-title">Unnati Powerprep AI Companion</h1>
              <p class="doc-meta">Official Study & Solution Document • ${new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <main>
            ${structuredBody}
          </main>

          <footer class="doc-footer">
            Generated by Unnati Powerprep AI Tutor • www.unnaticlasses.online
          </footer>
        </body>
        </html>
      `;

      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();

      // Wait for KaTeX stylesheet and web fonts to fully load inside iframe before printing
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (frameDoc.fonts && frameDoc.fonts.ready) {
        await frameDoc.fonts.ready;
      }

      if (printFrame.contentWindow) {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      }
    } catch (err: any) {
      console.error('PDF Generation error:', err);
      alert('Could not generate PDF. Please try again.');
    } finally {
      setGeneratingPdfIndex(null);
    }
  };

  const quickPrompts = [
    { title: 'Explain Photosynthesis', desc: 'Step-by-step with KaTeX formulas', icon: BookOpen, prompt: 'Explain photosynthesis with equations in KaTeX format.' },
    { title: 'Solve Math Doubts', desc: 'Quadratic & Calculus formulas', icon: HelpCircle, prompt: 'Solve quadratic equation $ax^2 + bx + c = 0$ using KaTeX quadratic formula.' },
    { title: 'Create Practice Quiz', desc: '5 multiple choice questions', icon: Sparkles, prompt: 'Create a 5-question science quiz with KaTeX math formulas.' },
    { title: 'Study Revision Plan', desc: 'Personalized revision routine', icon: Calendar, prompt: 'Help me design a 7-day study revision timetable for board exams.' }
  ];

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 text-slate-800 relative overflow-hidden">
      {/* Fixed Header */}
      <div className="shrink-0 px-4 sm:px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={() => window.dispatchEvent(new Event('toggleSidebar'))}
            className="md:hidden p-2 -ml-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
            title="Open Past Conversations"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-white border border-slate-200/80 shadow-md p-1 flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Unnati Classes Logo" className="w-full h-full object-contain drop-shadow-xs" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-800 text-sm sm:text-lg flex items-center gap-2">
              Unnati Powerprep AI Companion
              <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200 hidden sm:inline-block">
                PRO AI
              </span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
              Your personal AI study companion for instant doubt solving, detailed explanations, structured solutions, and easy-to-download PDF notes.
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={messagesScrollAreaRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth"
      >
        {loadingSession ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
            <p className="text-xs font-semibold">Loading conversation history...</p>
          </div>
        ) : (messages.length === 0 && !loadingMsg) ? (
          /* Empty State */
          <div className="max-w-2xl mx-auto pt-8 pb-12 flex flex-col items-center text-center space-y-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center p-3 shadow-xl">
                <img src="/logo.png" alt="Unnati Powerprep Logo" className="w-14 h-14 object-contain drop-shadow-md" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">How can I help your studies today?</h2>
              <p className="text-sm text-slate-500 font-medium max-w-md">
                I format all math formulas using KaTeX. Click <strong className="text-indigo-600">Download PDF</strong> on any answer to save a formatted copy.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-4">
              {quickPrompts.map((q, idx) => {
                const IconComponent = q.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q.prompt)}
                    className="flex items-start gap-3 p-4 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-2xl text-left transition-all shadow-sm hover:shadow-md group cursor-pointer"
                  >
                    <div className="p-2.5 bg-indigo-100/70 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform shrink-0">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block group-hover:text-indigo-600 transition-colors">
                        {q.title}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">
                        {q.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Conversation Message List */
          <div className="max-w-3xl mx-auto space-y-6 pb-4">
            {messages.map((msg, index) => (
              <AIMessageCard
                key={msg.id || index}
                msg={msg}
                index={index}
                isUser={msg.role === 'user'}
                copiedIndex={copiedIndex}
                generatingPdfIndex={generatingPdfIndex}
                copyToClipboard={copyToClipboard}
                downloadResponsePDF={downloadResponsePDF}
              />
            ))}

            {loadingMsg && <AnimatedLoadingStatus />}
          </div>
        )}
      </div>

      {/* Fixed Input Bar */}
      <div className="shrink-0 p-4 bg-white border-t border-slate-200 z-10">
        <div className="max-w-3xl mx-auto space-y-2">
          {selectedFile && (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold animate-in fade-in duration-200">
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate">{selectedFile.name}</span>
              </div>
              <button onClick={() => setSelectedFile(null)} className="p-1 hover:bg-indigo-100 rounded-lg text-indigo-500 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 bg-slate-100/80 border border-slate-200 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-2xl p-1.5 transition-all"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,application/pdf"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
              title="Attach photo or PDF question paper"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask Unnati AI anything... (Math formulas auto-render with KaTeX)"
              className="flex-1 bg-transparent px-2 py-1.5 text-slate-800 text-sm font-medium focus:outline-none placeholder-slate-400"
              disabled={loadingMsg}
            />

            <button
              type="submit"
              disabled={(!inputText.trim() && !selectedFile) || loadingMsg}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
              title="Send to Unnati AI"
            >
              {loadingMsg ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
