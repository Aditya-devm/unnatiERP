import katex from 'katex';

function cleanMarkdownText(str: string): string {
  if (!str) return '';
  return str.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '');
}

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

  return result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function buildStructuredPDFHTML(content: string): string {
  const lines = content.split('\n');
  let bodyHtml = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (/^(SECTION|PART)\s+[A-Z0-9]/i.test(trimmed) || /^#{1,3}\s+(SECTION|PART)/i.test(trimmed)) {
      const cleanTitle = cleanMarkdownText(trimmed);
      bodyHtml += `
        <div class="pdf-block section-title">
          ${cleanTitle}
        </div>
      `;
      continue;
    }

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

async function testKaTeXVectorPDF() {
  console.log("=== TESTING KATEX VECTOR HTML/CSS PRINT PDF PIPELINE ===");

  const sampleMathInput = `
SECTION A: QUADRATIC EQUATIONS
Question 1. Solve the quadratic equation:
$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$
For the equation $2x^2 + 5x - 3 = 0$:
$$x = \\frac{-5 \\pm \\sqrt{25 - 4(2)(-3)}}{2(2)}$$
$$x = \\frac{-5 \\pm \\sqrt{25 + 24}}{4} = \\frac{-5 \\pm 7}{4}$$
Therefore, the solutions are $x = \\frac{1}{2}$ and $x = -3$.
  `;

  const htmlOutput = buildStructuredPDFHTML(sampleMathInput);

  if (htmlOutput.includes('pdf-block section-title') && htmlOutput.includes('pdf-block katex-display')) {
    console.log("[PASS] PDF blocks generated with page-break protection classes (pdf-block)!");
  } else {
    console.error("[FAIL] Missing pdf-block page-break protection classes!");
    process.exit(1);
  }

  if (htmlOutput.includes('class="katex"') && htmlOutput.includes('frac-line')) {
    console.log("[PASS] KaTeX stacked fractions (frac-line) successfully rendered into vector HTML!");
  } else {
    console.error("[FAIL] KaTeX fraction rendering failed!");
    process.exit(1);
  }

  console.log("\nALL KATEX VECTOR PDF PIPELINE TESTS PASSED 100% SUCCESSFULLY!");
}

testKaTeXVectorPDF().catch((err) => {
  console.error("Test Error:", err);
  process.exit(1);
});
