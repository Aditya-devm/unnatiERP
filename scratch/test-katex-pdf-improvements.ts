import katex from 'katex';

function cleanMarkdownText(str: string): string {
  if (!str) return '';
  const mathBlocks: string[] = [];
  const tokenPrefix = 'XKATEXMATHTOKEN';
  const tokenSuffix = 'XKATEXENDTOKEN';

  const protectedStr = str.replace(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n]+?\$|\\\([\s\S]+?\\\))/g, (match) => {
    mathBlocks.push(match);
    return `${tokenPrefix}${mathBlocks.length - 1}${tokenSuffix}`;
  });

  const cleaned = protectedStr
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/[\*_](.*?)([\*_])/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[\-\*]{3,}\s*$/gm, '')
    .replace(/^[\*\-]\s+/gm, '• ');

  const restoreRegex = new RegExp(`${tokenPrefix}(\\d+)${tokenSuffix}`, 'g');
  return cleaned.replace(restoreRegex, (_, idx) => {
    return mathBlocks[parseInt(idx, 10)] || '';
  });
}

function testKaTeXMathProtection() {
  console.log("=== TESTING KATEX FRACTIONS & ROOTS MATH PROTECTION ===");

  const testContent = "Solve the quadratic equation $\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$ for $x_1$ and $x_2$.";
  
  console.log(`Original Text:\n"${testContent}"`);
  
  const cleaned = cleanMarkdownText(testContent);
  console.log(`\nCleaned Text (Math Protected):\n"${cleaned}"`);

  if (cleaned.includes('\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}') && cleaned.includes('$x_1$') && cleaned.includes('$x_2$')) {
    console.log("\n[PASS] Fractions, square roots, and subscripts are 100% preserved!");
  } else {
    console.error("\n[FAIL] Math expression was corrupted!");
    process.exit(1);
  }

  // Test KaTeX rendering
  const latexStr = "\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}";
  const html = katex.renderToString(latexStr, { displayMode: true, throwOnError: false });
  console.log(`\nRendered KaTeX HTML Length: ${html.length} chars`);
  if (html.includes('frac-line') && html.includes('sqrt')) {
    console.log("[PASS] KaTeX fraction bar and square root elements generated correctly!");
  } else {
    console.error("[FAIL] KaTeX output missing fraction or root elements!");
    process.exit(1);
  }

  process.exit(0);
}

testKaTeXMathProtection();
