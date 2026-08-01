import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export interface TestConfig {
    isTest: boolean;
    templateStyle: 'new' | 'previous';
    subject: string;
    grade: string;
    duration: string;
    docNo: string;
    totalMarks: number;
}

// Helper to check if content is educational to trigger intro/outro removal
const isEducationalContent = (content: string): boolean => {
    const triggers = ['worksheet', 'practice questions', 'mock paper', 'sample paper', 'test paper'];
    const lower = content.toLowerCase();
    return triggers.some(t => lower.includes(t));
};

const parsePercent = (val: string, maxVal: number): number => {
    if (val.endsWith('%')) {
        return (parseFloat(val) / 100) * maxVal;
    }
    return parseFloat(val);
};

const parseHue = (val: string): number => {
    if (val.endsWith('deg')) {
        return parseFloat(val);
    }
    if (val.endsWith('rad')) {
        return (parseFloat(val) * 180) / Math.PI;
    }
    if (val.endsWith('turn')) {
        return parseFloat(val) * 360;
    }
    return parseFloat(val);
};

const oklabToRgb = (L: number, a: number, b: number) => {
    L = Math.max(0, L);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const r =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const b_out = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    const toSrgb = (c: number) => {
        if (c <= 0.0031308) {
            return 12.92 * c;
        }
        return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    };

    const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));

    return {
        r: clamp(toSrgb(r) * 255),
        g: clamp(toSrgb(g) * 255),
        b: clamp(toSrgb(b_out) * 255)
    };
};

const parseAndConvertColor = (colorStr: string): string => {
    if (typeof colorStr !== 'string') return colorStr;
    if (!colorStr.includes('oklab') && !colorStr.includes('oklch')) return colorStr;

    const oklchRegex = /oklch\(\s*([0-9.+-]+%?)\s+([0-9.+-]+%?)\s+([0-9.+-]+(?:deg|rad|turn)?)(?:\s*\/\s*([0-9.+-]+%?))?\s*\)/gi;
    const oklabRegex = /oklab\(\s*([0-9.+-]+%?)\s+([0-9.+-]+%?)\s+([0-9.+-]+%?)(?:\s*\/\s*([0-9.+-]+%?))?\s*\)/gi;

    let result = colorStr;

    result = result.replace(oklchRegex, (match, p1, p2, p3, p4) => {
        try {
            const L = parsePercent(p1, 1.0);
            const C = parseFloat(p2);
            const H = parseHue(p3);
            const A = p4 !== undefined ? parsePercent(p4, 1.0) : 1.0;
            
            const hRad = (H * Math.PI) / 180;
            const a = C * Math.cos(hRad);
            const b = C * Math.sin(hRad);
            
            const rgb = oklabToRgb(L, a, b);
            return A === 1.0 ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${A})`;
        } catch (e) {
            return match;
        }
    });

    result = result.replace(oklabRegex, (match, p1, p2, p3, p4) => {
        try {
            const L = parsePercent(p1, 1.0);
            const a = parseFloat(p2);
            const b = parseFloat(p3);
            const A = p4 !== undefined ? parsePercent(p4, 1.0) : 1.0;
            
            const rgb = oklabToRgb(L, a, b);
            return A === 1.0 ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${A})`;
        } catch (e) {
            return match;
        }
    });

    return result;
};

const patchWindowGetComputedStyle = (w: Window) => {
    try {
        const originalGetComputedStyle = w.getComputedStyle;
        w.getComputedStyle = function(el, pseudo) {
            const style = originalGetComputedStyle(el, pseudo);
            return new Proxy(style, {
                get(target, prop) {
                    if (prop === 'getPropertyValue') {
                        return function(name: string) {
                            const val = target.getPropertyValue(name);
                            return parseAndConvertColor(val);
                        };
                    }
                    const val = (target as any)[prop];
                    if (typeof val === 'function') {
                        return val.bind(target);
                    }
                    return parseAndConvertColor(val);
                }
            }) as any;
        };
        return () => {
            w.getComputedStyle = originalGetComputedStyle;
        };
    } catch (e) {
        return () => {};
    }
};

const patchDocumentStyles = (docObj: Document = document) => {
    if (typeof window === 'undefined') return;
    try {
        docObj.querySelectorAll('style').forEach(styleTag => {
            try {
                const css = styleTag.innerHTML;
                if (css.includes('oklab') || css.includes('oklch')) {
                    styleTag.innerHTML = css
                        .replace(/oklab\([^)]+\)/g, 'rgb(30, 41, 59)')
                        .replace(/oklch\([^)]+\)/g, 'rgb(30, 41, 59)');
                }
            } catch (e) {}
        });

        const sheets = Array.from(docObj.styleSheets);
        sheets.forEach((sheet: any) => {
            try {
                const rules = sheet.cssRules || sheet.rules;
                if (!rules) return;
                
                let hasUnsupportedColors = false;
                for (let i = 0; i < rules.length; i++) {
                    const text = rules[i].cssText || '';
                    if (text.includes('oklab') || text.includes('oklch')) {
                        hasUnsupportedColors = true;
                        break;
                    }
                }

                if (hasUnsupportedColors) {
                    const cssText = Array.from(rules)
                        .map((r: any) => r.cssText || '')
                        .join('\n')
                        .replace(/oklab\([^)]+\)/g, 'rgb(30, 41, 59)')
                        .replace(/oklch\([^)]+\)/g, 'rgb(30, 41, 59)');
                    
                    const newStyle = docObj.createElement('style');
                    newStyle.innerHTML = cssText;
                    docObj.head.appendChild(newStyle);
                    
                    if (sheet.ownerNode) {
                        sheet.ownerNode.remove();
                    }
                }
            } catch (err) {
                if (sheet.ownerNode && sheet.ownerNode.tagName === 'STYLE') {
                    try {
                        sheet.ownerNode.innerHTML = sheet.ownerNode.innerHTML
                            .replace(/oklab\([^)]+\)/g, 'rgb(30, 41, 59)')
                            .replace(/oklch\([^)]+\)/g, 'rgb(30, 41, 59)');
                    } catch (e) {}
                }
            }
        });
    } catch (e) {}
};

// Styling overrides for the PDF-rendered cloned DOM
const SAFE_CSS = `
    body { 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important; 
        background: #ffffff !important; 
        color: #1e293b !important; 
        font-size: 12px !important; 
        line-height: 1.35 !important;
        letter-spacing: normal !important;
        word-spacing: normal !important;
        text-rendering: optimizeLegibility !important;
        -webkit-font-smoothing: antialiased !important;
        margin: 0 !important;
        padding: 0 !important;
    }
    #pdf-export-single-container {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        background: #ffffff !important;
        color: #1e293b !important;
        padding: 12px !important;
        box-sizing: border-box !important;
        width: 720px !important;
    }
    #pdf-export-single-container * {
        overflow: visible !important;
    }
    #pdf-export-single-container *:not(.katex):not(.katex *) {
        box-sizing: border-box !important;
    }
    .prose { 
        color: #1e293b !important; 
        max-width: 100% !important; 
        font-size: 12px !important;
        word-spacing: normal !important;
        letter-spacing: normal !important;
        overflow: visible !important;
    }
    /* Overrides to prevent letters (especially descenders like y, g, p, q, j) from clipping, excluding KaTeX components */
    .prose p, .prose li, .prose h1, .prose h2, .prose h3, .prose pre, .prose code,
    .prose span:not(.katex):not(.katex *):not(.katex-display):not(.katex-display *), 
    .prose div:not(.katex):not(.katex *):not(.katex-display):not(.katex-display *) { 
        overflow: visible !important;
        padding-bottom: 2px !important; 
        line-height: 1.35 !important;
    }
    .prose p {
        margin: 3px 0 !important;
    }
    .prose code { 
        background: #f1f5f9 !important; 
        color: #0f172a !important;
        padding: 2px 4px !important; 
        border-radius: 3px !important; 
        font-family: monospace !important; 
        font-size: 11px !important; 
    }
    .prose pre { 
        background: #f1f5f9 !important; 
        color: #0f172a !important;
        padding: 0.8em !important; 
        border-radius: 6px !important; 
        font-size: 11px !important; 
        margin: 0.4em 0 !important; 
        overflow: visible !important;
        white-space: pre-wrap !important;
        word-wrap: break-word !important;
    }
    .prose pre code {
        background: transparent !important;
        padding: 0 !important;
    }
    .prose h1, .prose h2, .prose h3 { 
        color: #0f172a !important; 
        letter-spacing: normal !important; 
        margin-top: 6px !important; 
        margin-bottom: 3px !important;
        padding-bottom: 1px !important;
    }
    .prose h1 { font-size: 16px !important; font-weight: 700 !important; border-bottom: 1px solid #e2e8f0 !important; }
    .prose ul, .prose ol { padding-left: 1.2em !important; margin: 3px 0 !important; }
    .prose li { margin: 1px 0 !important; padding-bottom: 1px !important; }
    .katex-display { margin: 4px 0 !important; padding: 2px 0 !important; overflow: visible !important; }
    
    /* Targeted KaTeX structure and line overrides for perfect sub/superscripts and fraction rendering */
    .katex { 
        font-family: KaTeX_Main, KaTeX_Math, "Times New Roman", serif !important;
        font-size: 1.05em !important; 
        line-height: 1.25 !important; 
        display: inline-block !important;
        overflow: visible !important;
        padding-right: 1.5px !important;
    }
    .katex * {
        line-height: 1.25 !important;
        overflow: visible !important;
    }
    /* Fix html2canvas fraction bar rendering by providing a solid height and color override */
    .katex .frac-line {
        border-bottom-width: 1.2px !important;
        min-height: 1.2px !important;
        height: 1.2px !important;
        background-color: currentColor !important;
        border-bottom-style: solid !important;
        display: block !important;
        opacity: 1 !important;
    }
`;

export const generatePDF = async (
    messages: Message[],
    indices: number[],
    filename: string = 'unnati-study-material.pdf',
    testConfig?: TestConfig
) => {
    // Clean original document styles to prevent html2canvas oklab/oklch parser crashes
    patchDocumentStyles(document);

    if (!messages || messages.length === 0 || !indices || indices.length === 0) {
        console.error('Missing messages or indices for PDF generation');
        return;
    }

    // Wait for all document fonts (including KaTeX math fonts) to be fully loaded
    if (typeof window !== 'undefined' && window.document && window.document.fonts) {
        try {
            await window.document.fonts.ready;
        } catch (e) {
            console.warn('Font loading wait failed:', e);
        }
    }

    // 1. Pre-fetch logo base64 once at the start to prevent fetching on every page addition
    let logoBase64: string | null = null;
    try {
        const res = await fetch('/logo.png');
        const blob = await res.blob();
        logoBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.warn('Failed to pre-fetch logo:', err);
    }

    // If Test Template style "new" is requested, redirect to specialized rendering pipeline
    if (testConfig && testConfig.isTest && testConfig.templateStyle === 'new') {
        await generateTestPDFNew(messages, indices, filename, testConfig, logoBase64);
        return;
    }

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
        putOnlyUsedFonts: true
    });

    doc.setProperties({
        title: 'Unnati Study Material',
        subject: 'Educational Content',
        author: 'Unnati Powerprep',
        creator: 'Unnati Classes'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;

    // Helper to add page header synchronously using cached logo
    const addHeader = (): number => {
        if (logoBase64) {
            try {
                doc.addImage(logoBase64, 'PNG', margin, 10, 18, 18);
            } catch (e) {
                console.error('Error rendering logo on page:', e);
            }
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(15, 23, 42);
        doc.text('Unnati Classes', margin + 22, 20);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('A place where success is tradition', margin + 22, 26);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, 32, pageWidth - margin, 32);
        return 38;
    };

    const addFooter = (pageNum: number, totalPages: number) => {
        doc.setPage(pageNum);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
            'Generated By Unnati Powerprep — Study Companion of Unnati Classes',
            pageWidth / 2,
            pageHeight - 7,
            { align: 'center' }
        );
        doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
    };

    // Styling overrides for the PDF-rendered cloned DOM
    // (moved to module level SAFE_CSS)

    // 2. Build a temporary off-screen container holding all message prose contents
    const container = document.createElement('div');
    container.id = 'pdf-export-single-container';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '720px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '24px';
    container.style.backgroundColor = '#ffffff';
    container.style.padding = '20px';
    container.style.boxSizing = 'border-box';

    const isSingleResponse = indices.length === 1 && messages[indices[0]].role === 'assistant';

    for (let i = 0; i < indices.length; i++) {
        const index = indices[i];
        const msg = messages[index];
        if (!msg) continue;

        const mainElement = document.getElementById(`msg-content-${index}`);
        if (!mainElement) continue;

        // Try to clone just the prose element inside the bubble, or fallback to the bubble container
        const proseElement = mainElement.querySelector('.prose') || mainElement;
        const proseClone = proseElement.cloneNode(true) as HTMLElement;

        // Remove any download buttons inside the clone
        proseClone.querySelectorAll('button, .border-t').forEach(btn => btn.remove());

        // Create message box wrapper
        const msgBlock = document.createElement('div');
        msgBlock.className = 'pdf-msg-block';
        msgBlock.id = `pdf-msg-${index}`;
        msgBlock.style.display = 'flex';
        msgBlock.style.flexDirection = 'column';
        msgBlock.style.gap = '8px';

        // Add role headers if it is a multi-message export (transcript style)
        if (!isSingleResponse) {
            const roleHeader = document.createElement('div');
            roleHeader.style.fontWeight = '800';
            roleHeader.style.fontSize = '11px';
            roleHeader.style.textTransform = 'uppercase';
            roleHeader.style.letterSpacing = '0.05em';
            roleHeader.style.color = msg.role === 'user' ? '#2563eb' : '#4f46e5';
            roleHeader.textContent = msg.role === 'user' ? 'Question / Prompt' : 'Unnati Powerprep Companion';
            msgBlock.appendChild(roleHeader);
        }

        // Clean up intro/outro if educational
        const isEdu = isEducationalContent(msg.content);
        if (isEdu) {
            Array.from(proseClone.children).forEach((child) => {
                const txt = child.textContent?.toLowerCase() || '';
                if (txt.includes('hello student') || txt.includes('keep practicing') || txt.includes('powerprep assistant')) {
                    (child as HTMLElement).style.display = 'none';
                }
            });
        }

        msgBlock.appendChild(proseClone);
        container.appendChild(msgBlock);

        // Add divider between messages
        if (i < indices.length - 1) {
            const divider = document.createElement('div');
            divider.style.borderTop = '1px solid #f1f5f9';
            divider.style.margin = '8px 0';
            container.appendChild(divider);
        }
    }

    document.body.appendChild(container);

    // Measure vertical offsets of the message blocks for smart page breaking (in CSS pixels)
    const blocks = Array.from(container.querySelectorAll('.pdf-msg-block')) as HTMLElement[];
    const blockPositions = blocks.map(el => {
        return {
            top: el.offsetTop,
            bottom: el.offsetTop + el.offsetHeight,
            height: el.offsetHeight
        };
    });

    // 3. Render the entire container in a single html2canvas call (massive speedup)
    const restoreGetComputedStyle = patchWindowGetComputedStyle(window);
    let canvas;
    try {
        canvas = await html2canvas(container, {
            scale: 2.0, // High-quality 2.0 scale (balanced between resolution and rendering speed)
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            onclone: (clonedDoc) => {
                // Patch the cloned window's getComputedStyle
                const clonedWindow = clonedDoc.defaultView;
                if (clonedWindow) {
                    patchWindowGetComputedStyle(clonedWindow);
                }

                // Patch oklab/oklch unsupported CSS colors
                patchDocumentStyles(clonedDoc);

                // Do not delete stylesheets as it ruins KaTeX math structure, tables, and spacing.
                // Just append our SAFE_CSS overrides to the document head to clean up layout and fix font clipping.
                const style = clonedDoc.createElement('style');
                style.innerHTML = SAFE_CSS;
                clonedDoc.head.appendChild(style);

                // Hide UI avatars and buttons inside cloned document if any remained
                clonedDoc.querySelectorAll('img[src*="logo"], .avatar, .bot-icon, button').forEach(e => {
                    (e as HTMLElement).style.display = 'none';
                });
            }
        });
    } finally {
        restoreGetComputedStyle();
    }

    // Cleanup temporary container immediately
    document.body.removeChild(container);

    if (canvas.width <= 0 || canvas.height <= 0) {
        console.error('Invalid canvas dimensions generated');
        return;
    }

    // 4. Slice the single tall canvas into PDF pages
    yPos = addHeader();

    const mmPerPx = contentWidth / canvas.width;
    const canvasHeight = canvas.height;
    const scale = 2.0;

    let srcY = 0; // in canvas pixels
    while (srcY < canvasHeight - 1) {
        const currentAvailMM = pageHeight - yPos - 18; // 18mm padding at bottom

        if (currentAvailMM < 15) {
            doc.addPage();
            yPos = addHeader();
            continue;
        }

        // Maximum height we can slice on this page (in mm and canvas pixels)
        const sliceMMMax = Math.min(currentAvailMM, (canvasHeight - srcY) * mmPerPx);
        const slicePxMax = Math.floor(sliceMMMax / mmPerPx);

        if (slicePxMax <= 0) {
            doc.addPage();
            yPos = addHeader();
            continue;
        }

        // Target height for this slice
        let slicePx = slicePxMax;

        // If this slice doesn't cover the rest of the canvas, let's find a smart break point
        if (srcY + slicePxMax < canvasHeight) {
            const srcY_css = srcY / scale;
            const maxY_css = (srcY + slicePxMax) / scale;

            // Find the best block boundary to break at
            let bestBreakCSS = -1;

            for (const block of blockPositions) {
                // Break point is just below the block bottom (plus a tiny margin)
                const breakPoint = block.bottom + 6; 
                if (breakPoint > srcY_css && breakPoint <= maxY_css) {
                    bestBreakCSS = Math.max(bestBreakCSS, breakPoint);
                }
            }

            // If we found a valid block boundary to break at, update slicePx
            if (bestBreakCSS > 0) {
                const targetSlicePx = Math.floor(bestBreakCSS * scale) - srcY;
                // Only use this break point if it doesn't make the page too empty (e.g. at least 35% of max slice height)
                if (targetSlicePx > slicePxMax * 0.35) {
                    slicePx = targetSlicePx;
                }
            }
        }

        // Create the slice canvas
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = slicePx;
        const ctx = sliceCanvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(canvas, 0, srcY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);

        const sliceMM = slicePx * mmPerPx;
        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
        doc.addImage(sliceData, 'JPEG', margin, yPos, contentWidth, sliceMM, undefined, 'FAST');

        // Move srcY forward.
        // If we broke at a block boundary, we move forward by slicePx (no overlap needed).
        // If we had to cut in the middle of a block, we overlap by 16 canvas pixels (~8 CSS pixels) to prevent text loss/cutting.
        const isSmartBreak = (slicePx < slicePxMax);
        const overlapPx = isSmartBreak ? 0 : Math.min(16, canvasHeight - (srcY + slicePx));

        srcY += (slicePx - overlapPx);
        yPos += (sliceMM - (overlapPx * mmPerPx));

        if (srcY < canvasHeight - 1) {
            doc.addPage();
            yPos = addHeader();
        }
    }

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        addFooter(i, totalPages);
    }

    // Sanitize filename for mobile compatibility
    const safeFilename = filename.replace(/[^a-z0-9\-\.]/gi, '_');

    // Trigger download
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', safeFilename);
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
};

// ==========================================
// Specialized Test Paper PDF Export Pipeline
// ==========================================

const parseRenderedDOM = (proseElement: HTMLElement) => {
    const children = Array.from(proseElement.children);
    const instructionsNodes: HTMLElement[] = [];
    const sections: { title: string; nodes: HTMLElement[] }[] = [];
    let currentSection: { title: string; nodes: HTMLElement[] } | null = null;
    let inInstructions = false;

    children.forEach((child) => {
        const text = child.textContent || '';
        const tagName = child.tagName;
        const isHeading = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tagName);
        
        const isSectionHeader = (isHeading || tagName === 'P') && /^\s*Sec(tion)?\s*[-–—]?\s*[A-Z]/i.test(text.trim());
        const isInstructionsHeader = (isHeading || tagName === 'P') && /General\s+Instructions/i.test(text);

        if (isInstructionsHeader) {
            inInstructions = true;
        } else if (isSectionHeader) {
            inInstructions = false;
            currentSection = {
                title: text.replace(/[#*]/g, '').trim(),
                nodes: []
            };
            sections.push(currentSection);
        } else {
            if (currentSection) {
                currentSection.nodes.push(child.cloneNode(true) as HTMLElement);
            } else if (inInstructions) {
                instructionsNodes.push(child.cloneNode(true) as HTMLElement);
            } else if (instructionsNodes.length === 0) {
                instructionsNodes.push(child.cloneNode(true) as HTMLElement);
            }
        }
    });

    return { instructionsNodes, sections };
};

const buildLastPageHTML = (pageNumVal: number) => {
    const page = document.createElement('div');
    page.className = 'test-pdf-page';
    page.style.cssText = `
        width: 794px;
        height: 1123px;
        padding: 25px 35px;
        box-sizing: border-box;
        background-color: #ffffff;
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: #1e293b;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    const calligraphy = document.createElement('div');
    calligraphy.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 15px;
        margin-top: -50px;
    `;

    calligraphy.innerHTML = `
        <svg width="220" height="220" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="4 4" />
            <g>
                <text x="50%" y="42%" text-anchor="middle" font-family="'Brush Script MT', 'Great Vibes', cursive, sans-serif" font-size="20" font-weight="bold" fill="#000" font-style="italic">All</text>
                <text x="50%" y="54%" text-anchor="middle" font-family="'Arial', sans-serif" font-size="8" font-weight="900" text-transform="uppercase" letter-spacing="3" fill="#64748b">the</text>
                <text x="50%" y="74%" text-anchor="middle" font-family="'Brush Script MT', 'Great Vibes', cursive, sans-serif" font-size="22" font-weight="bold" fill="#0284c7" font-style="italic">Best</text>
            </g>
        </svg>
    `;

    page.appendChild(calligraphy);

    const pageNum = document.createElement('div');
    pageNum.textContent = String(pageNumVal);
    pageNum.style.cssText = `
        position: absolute;
        bottom: 25px;
        right: 50px;
        font-weight: bold;
        font-size: 12px;
        color: #000;
    `;
    page.appendChild(pageNum);

    return page;
};

const createPageFrame = (pageNum: number): HTMLElement => {
    const page = document.createElement('div');
    page.className = 'test-pdf-page';
    page.style.cssText = `
        width: 794px;
        height: 1123px;
        padding: 25px 35px;
        box-sizing: border-box;
        background-color: #ffffff;
        position: relative;
        display: flex;
        flex-direction: column;
        color: #1e293b;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    
    const contentArea = document.createElement('div');
    contentArea.className = 'prose';
    contentArea.style.cssText = `
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: 4px;
    `;
    page.appendChild(contentArea);

    const pageNumEl = document.createElement('div');
    pageNumEl.textContent = String(pageNum);
    pageNumEl.style.cssText = `
        position: absolute;
        bottom: 25px;
        right: 50px;
        font-weight: bold;
        font-size: 12px;
        color: #000;
    `;
    page.appendChild(pageNumEl);

    return page;
};const groupSectionNodes = (nodes: HTMLElement[], secTitle?: HTMLElement): HTMLElement[] => {
    const items: HTMLElement[] = [];
    let pendingHeaders: HTMLElement[] = [];
    
    if (secTitle) {
        pendingHeaders.push(secTitle.cloneNode(true) as HTMLElement);
    }
    let currentQuestionBlock: HTMLDivElement | null = null;

    nodes.forEach((node) => {
        const text = node.textContent?.trim() || '';
        const tagName = node.tagName.toUpperCase();
        
        const isHeading = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tagName);
        const isSectionTitle = (isHeading || tagName === 'P') && /^\s*Sec(tion)?\s*[-–—]?\s*[A-Z]/i.test(text.trim());
        const isPartHeader = /^(Part\s+[I|V]+|Directions\s+for\s+Q)/i.test(text);
        const isInstruction = text.startsWith('(') && text.endsWith(')');
        
        const isQuestionStart = /^(Q\d+|Question\d+)/i.test(text);

        if (isSectionTitle || isPartHeader || isInstruction) {
            if (currentQuestionBlock) {
                items.push(currentQuestionBlock);
                currentQuestionBlock = null;
            }
            pendingHeaders.push(node.cloneNode(true) as HTMLElement);
        } else if (isQuestionStart) {
            if (currentQuestionBlock) {
                items.push(currentQuestionBlock);
            }
            
            currentQuestionBlock = document.createElement('div');
            currentQuestionBlock.className = 'pdf-question-block';
            currentQuestionBlock.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 2px;
                width: 100%;
                page-break-inside: avoid;
            `;
            
            pendingHeaders.forEach(h => currentQuestionBlock!.appendChild(h));
            pendingHeaders = [];
            currentQuestionBlock.appendChild(node.cloneNode(true));
        } else {
            if (currentQuestionBlock) {
                currentQuestionBlock.appendChild(node.cloneNode(true));
            } else {
                pendingHeaders.push(node.cloneNode(true) as HTMLElement);
            }
        }
    });

    if (currentQuestionBlock) {
        items.push(currentQuestionBlock);
    }
    
    if (pendingHeaders.length > 0) {
        const fallbackBlock = document.createElement('div');
        fallbackBlock.className = 'pdf-question-block';
        fallbackBlock.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 2px;
            width: 100%;
            page-break-inside: avoid;
        `;
        pendingHeaders.forEach(h => fallbackBlock.appendChild(h));
        items.push(fallbackBlock);
    }

    return items;
};

const generateTestPDFNew = async (
    messages: Message[],
    indices: number[],
    filename: string,
    config: TestConfig,
    logoBase64: string | null
) => {
    // Clean original document styles to prevent html2canvas oklab/oklch parser crashes
    patchDocumentStyles(document);

    const index = indices[0];
    const mainElement = document.getElementById(`msg-content-${index}`);
    if (!mainElement) {
        console.error('Prose element not found for test generation');
        return;
    }
    const proseElement = (mainElement.querySelector('.prose') || mainElement) as HTMLElement;

    const { instructionsNodes, sections } = parseRenderedDOM(proseElement);

    // Setup measuring container attached to body
    const measureContainer = document.createElement('div');
    measureContainer.style.cssText = `
        position: absolute;
        left: -9999px;
        top: -9999px;
        width: 794px;
        display: flex;
        flex-direction: column;
        background-color: #ffffff;
    `;
    document.body.appendChild(measureContainer);

    const pages: HTMLElement[] = [];
    let currentPageNum = 1;

    // Create Page 1 and append to measure container
    const page1 = createPageFrame(currentPageNum);
    const contentArea1 = page1.querySelector('.prose') as HTMLElement;
    pages.push(page1);
    measureContainer.appendChild(page1);

    // Render Page 1 Header box
    const headerBox = document.createElement('div');
    headerBox.style.cssText = `
        border: 2px solid #000000;
        border-radius: 4px;
        padding: 6px 12px;
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 4px;
        position: relative;
    `;
    
    const dots = ['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'];
    dots.forEach(pos => {
        const dot = document.createElement('div');
        dot.style.cssText = `
            position: absolute;
            width: 6px;
            height: 6px;
            background: #000;
            border-radius: 50%;
        `;
        if (pos.includes('top-0')) dot.style.top = '-3px';
        if (pos.includes('bottom-0')) dot.style.bottom = '-3px';
        if (pos.includes('left-0')) dot.style.left = '-3px';
        if (pos.includes('right-0')) dot.style.right = '-3px';
        headerBox.appendChild(dot);
    });

    if (logoBase64) {
        const logoImg = document.createElement('img');
        logoImg.src = logoBase64;
        logoImg.style.cssText = `
            height: 52px;
            width: 52px;
            object-fit: contain;
            border: 1px solid #e2e8f0;
            padding: 2px;
            border-radius: 50%;
            background: white;
        `;
        headerBox.appendChild(logoImg);
    }

    const headerRight = document.createElement('div');
    headerRight.style.cssText = `
        flex: 1;
        display: flex;
        flex-direction: column;
    `;

    const titleRow = document.createElement('div');
    titleRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 2px;
    `;

    const titleText = document.createElement('h1');
    titleText.textContent = 'Unnati Classes';
    titleText.style.cssText = `
        font-family: "Arial Black", "Impact", sans-serif;
        font-weight: 900;
        font-style: italic;
        font-size: 24px;
        color: #009fe3;
        margin: 0;
        line-height: 1;
    `;
    titleRow.appendChild(titleText);
    headerRight.appendChild(titleRow);

    const fieldsGrid = document.createElement('div');
    fieldsGrid.style.cssText = `
        display: grid;
        grid-template-cols: 1fr 1fr;
        gap: 3px 10px;
        font-size: 11px;
        font-weight: bold;
        color: #000;
    `;
    fieldsGrid.innerHTML = `
        <div>Name:- _______________________</div>
        <div>STD:- ________________________</div>
        <div>Subject:- ${config.subject}</div>
        <div>Date:- _______________________</div>
    `;
    headerRight.appendChild(fieldsGrid);
    headerBox.appendChild(headerRight);
    contentArea1.appendChild(headerBox);

    const hr1 = document.createElement('div');
    hr1.style.cssText = `
        border-bottom: 3px double #000000;
        margin-bottom: 4px;
    `;
    contentArea1.appendChild(hr1);

    const subHeader = document.createElement('div');
    subHeader.style.cssText = `
        display: flex;
        justify-content: space-between;
        font-weight: bold;
        font-size: 11px;
        color: #000000;
        margin: 2px 0;
    `;
    subHeader.innerHTML = `
        <div>Duration:- ${config.duration}</div>
        <div>Doc No:- ${config.docNo}</div>
        <div>Total marks:- ${config.totalMarks}</div>
    `;
    contentArea1.appendChild(subHeader);

    const hr2 = document.createElement('div');
    hr2.style.cssText = `
        border-bottom: 3px double #000000;
        margin-bottom: 6px;
    `;
    contentArea1.appendChild(hr2);

    // General Instructions
    if (instructionsNodes.length > 0) {
        const instBlock = document.createElement('div');
        instBlock.style.cssText = `
            font-size: 11px;
            line-height: 1.35;
            margin-bottom: 4px;
        `;
        
        const instTitle = document.createElement('div');
        instTitle.textContent = 'General Instructions:';
        instTitle.style.cssText = `
            font-weight: bold;
            margin-bottom: 2px;
            color: #000;
        `;
        instBlock.appendChild(instTitle);

        instructionsNodes.forEach(node => {
            const clonedNode = node.cloneNode(true) as HTMLElement;
            clonedNode.style.fontSize = '11px';
            clonedNode.style.lineHeight = '1.35';
            instBlock.appendChild(clonedNode);
        });
        contentArea1.appendChild(instBlock);

        const hr3 = document.createElement('div');
        hr3.style.cssText = `
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 6px;
        `;
        contentArea1.appendChild(hr3);
    }

    // Gather all test content items to layout sequentially, utilizing stateful grouping
    const itemsToLayout: HTMLElement[] = [];

    sections.forEach((sec) => {
        const secTitle = document.createElement('div');
        secTitle.textContent = sec.title;
        secTitle.style.cssText = `
            font-size: 14px;
            font-weight: bold;
            text-align: center;
            margin-top: 10px;
            margin-bottom: 6px;
            color: #000;
            text-decoration: underline;
        `;

        const grouped = groupSectionNodes(sec.nodes, secTitle);
        grouped.forEach(block => {
            itemsToLayout.push(block);
        });
    });

    let currentPage = page1;
    let currentContentArea = contentArea1;

    // Distribute elements page by page dynamically, enforcing specific user layout instructions
    for (let i = 0; i < itemsToLayout.length; i++) {
        const item = itemsToLayout[i];
        const text = item.textContent || '';

        currentContentArea.appendChild(item);

        const pageRect = currentPage.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        const relativeBottom = itemRect.bottom - pageRect.top;

        let shouldWrap = relativeBottom > 1080;

        // Identify if this block contains a new section header (excluding Section A)
        const isNewSection = /SECTION\s+[B-D]/i.test(text);

        // If it's a new section and it fits, check if remaining space on current page is too small
        if (!shouldWrap && isNewSection) {
            const remainingSpace = 1080 - (relativeBottom - itemRect.height);
            // If remaining space before this section is less than 280px, wrap to the next page
            if (remainingSpace < 280) {
                shouldWrap = true;
            }
        }

        if (shouldWrap) {
            currentContentArea.removeChild(item);

            currentPageNum++;
            currentPage = createPageFrame(currentPageNum);
            currentContentArea = currentPage.querySelector('.prose') as HTMLElement;
            pages.push(currentPage);
            measureContainer.appendChild(currentPage);

            currentContentArea.appendChild(item);
        }
    }

    // Check if the calligraphy fits on the last page to save a whole page and avoid blank space
    const pageRect = currentPage.getBoundingClientRect();
    const currentProse = currentPage.querySelector('.prose') as HTMLElement;
    const proseRect = currentProse.getBoundingClientRect();
    const relativeBottom = proseRect.bottom - pageRect.top;

    if (relativeBottom + 160 <= 1080) {
        // It fits at the bottom of the current page!
        const calligraphy = document.createElement('div');
        calligraphy.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-top: 15px;
            margin-bottom: 10px;
            width: 100%;
        `;
        calligraphy.innerHTML = `
            <svg width="150" height="150" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="45" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="4 4" />
                <g>
                    <text x="50%" y="42%" text-anchor="middle" font-family="'Brush Script MT', 'Great Vibes', cursive, sans-serif" font-size="20" font-weight="bold" fill="#000" font-style="italic">All</text>
                    <text x="50%" y="54%" text-anchor="middle" font-family="'Arial', sans-serif" font-size="8" font-weight="900" text-transform="uppercase" letter-spacing="3" fill="#64748b">the</text>
                    <text x="50%" y="74%" text-anchor="middle" font-family="'Brush Script MT', 'Great Vibes', cursive, sans-serif" font-size="22" font-weight="bold" fill="#0284c7" font-style="italic">Best</text>
                </g>
            </svg>
        `;
        currentContentArea.appendChild(calligraphy);
    } else {
        // It does not fit. Append a new calligraphy page
        currentPageNum++;
        const lastPage = buildLastPageHTML(currentPageNum);
        pages.push(lastPage);
        measureContainer.appendChild(lastPage);
    }

    // Render jsPDF document page by page
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
        putOnlyUsedFonts: true
    });

    doc.setProperties({
        title: `${config.subject} Test Paper`,
        subject: 'Test Paper',
        author: 'Unnati Powerprep',
        creator: 'Unnati Classes'
    });

    for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];
        await new Promise(resolve => setTimeout(resolve, 50));

        const restoreGetComputedStyle = patchWindowGetComputedStyle(window);
        let canvas;
        try {
            canvas = await html2canvas(pageEl, {
                scale: 2.0,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                    const clonedWindow = clonedDoc.defaultView;
                    if (clonedWindow) {
                        patchWindowGetComputedStyle(clonedWindow);
                    }
                    patchDocumentStyles(clonedDoc);
                    const style = clonedDoc.createElement('style');
                    style.innerHTML = SAFE_CSS;
                    clonedDoc.head.appendChild(style);
                }
            });
        } finally {
            restoreGetComputedStyle();
        }

        const pageData = canvas.toDataURL('image/jpeg', 0.92);
        
        if (i > 0) {
            doc.addPage();
        }
        doc.addImage(pageData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }

    // Clean up temporary DOM measurement structure
    document.body.removeChild(measureContainer);

    const safeFilename = filename.replace(/[^a-z0-9\-\.]/gi, '_');
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', safeFilename);
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
};

export const parseTestDetails = (text: string) => {
    const details = {
        subject: '',
        grade: 'Class 10',
        duration: '1½ hours',
        docNo: `UC/${Math.floor(Math.random() * 900) + 100}`,
        totalMarks: 40
    };

    const gradeMatch = text.match(/(Class\s+\d+|Grade\s+\d+|Standard\s+\d+)/i);
    if (gradeMatch) {
        details.grade = gradeMatch[1];
    }

    const subjectMatch = text.match(/Subject:\s*([^\n|]+)/i);
    if (subjectMatch) {
        details.subject = subjectMatch[1].trim();
    } else {
        const firstLine = text.split('\n')[0].replace(/[#*`]/g, '').trim();
        if (firstLine && firstLine.length < 50 && !firstLine.toLowerCase().includes('test paper')) {
            details.subject = firstLine;
        } else {
            details.subject = 'Mathematics';
        }
    }

    const marksMatch = text.match(/(Total\s+)?Marks:\s*(\d+)/i);
    if (marksMatch) {
        details.totalMarks = parseInt(marksMatch[2]);
    }

    const durationMatch = text.match(/(Duration|Time( Allowed)?):\s*([^\n|]+)/i);
    if (durationMatch) {
        details.duration = durationMatch[3].trim();
    }

    return details;
};
