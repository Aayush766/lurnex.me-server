/**
 * pdfService.js
 * Generates a branded, enterprise-grade PDF assessment report using pdfkit.
 * Install: npm install pdfkit
 */

const PDFDocument = require('pdfkit');

// Brand colours (Lurnex)
const BRAND = {
  primary: '#059669',      // emerald-600
  primaryDark: '#047857',  // emerald-700
  navy: '#0a192f',
  navyLight: '#112240',
  slate: '#64748b',
  slateLight: '#cbd5e1',
  white: '#ffffff',
  offWhite: '#f8fafc',
  textDark: '#0f172a',
  textMid: '#334155',
  amber: '#d97706',
  rose: '#e11d48',
  successBg: '#ecfdf5',
  warnBg: '#fffbeb',
};

/**
 * Generates a complete PDF result report as a Buffer.
 * @param {Object} params
 * @param {string} params.candidateName
 * @param {string} params.candidateEmail
 * @param {string} params.candidateGrade
 * @param {string} params.candidateSchool
 * @param {string} params.assessmentTitle
 * @param {number} params.score
 * @param {number} params.totalMarks
 * @param {number} params.percentage
 * @param {Array}  params.subjectAnalysis  [{subject, correct, total, percentage}]
 * @param {Array}  params.strengths        [string]
 * @param {Array}  params.weaknesses       [string]
 * @param {Date}   params.submittedAt
 * @returns {Promise<Buffer>}
 */
exports.generateResultPDF = ({
  candidateName,
  candidateEmail,
  candidateGrade,
  candidateSchool,
  assessmentTitle,
  score,
  totalMarks,
  percentage,
  subjectAnalysis = [],
  strengths = [],
  weaknesses = [],
  submittedAt,
}) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 40, left: 0, right: 0 },
        info: {
          Title: `Assessment Report – ${candidateName}`,
          Author: 'Lurnex Academic Platform',
          Subject: assessmentTitle,
          Creator: 'Lurnex',
        },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PAGE_W = doc.page.width;
      const MARGIN = 50;
      const CONTENT_W = PAGE_W - MARGIN * 2;

      // ─── HEADER BAND ───────────────────────────────────────────────────────
      doc.rect(0, 0, PAGE_W, 130).fill(BRAND.navy);

      // Brand name (left)
      doc
        .fillColor(BRAND.white)
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('LURNEX', MARGIN, 38, { continued: true })
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#64748b')
        .text('  ·  Academic Readiness Platform', { continued: false });

      // Tag line
      doc
        .fillColor('#94a3b8')
        .fontSize(8)
        .font('Helvetica')
        .text('Learn better. Grow ahead. Excel always.', MARGIN, 62);

      // Score badge (right)
      const badgeX = PAGE_W - MARGIN - 110;
      doc.roundedRect(badgeX, 22, 110, 90, 12).fill(BRAND.primary);

      const pctLabel = `${percentage}%`;
      doc
        .fillColor(BRAND.white)
        .fontSize(36)
        .font('Helvetica-Bold')
        .text(pctLabel, badgeX, 32, { width: 110, align: 'center' });

      doc
        .fillColor('#d1fae5')
        .fontSize(8)
        .font('Helvetica')
        .text(`${score} / ${totalMarks} correct`, badgeX, 75, { width: 110, align: 'center' });

      doc
        .fillColor('#6ee7b7')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('OVERALL SCORE', badgeX, 89, { width: 110, align: 'center' });

      // ─── SUB-HEADER / REPORT TITLE ────────────────────────────────────────
      doc.rect(0, 130, PAGE_W, 52).fill(BRAND.primary);

      doc
        .fillColor(BRAND.white)
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Diagnostic Performance Report', MARGIN, 144, { continued: false });

      doc
        .fillColor('#a7f3d0')
        .fontSize(9)
        .font('Helvetica')
        .text(assessmentTitle, MARGIN, 161);

      let y = 200; // start of content area

      // ─── CANDIDATE INFO GRID ──────────────────────────────────────────────
      const infoFields = [
        ['Candidate Name', candidateName],
        ['Email Address', candidateEmail],
        ['Grade', `Grade ${candidateGrade}`],
        ['School / Institution', candidateSchool],
        ['Assessment Date', new Date(submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })],
        ['Report Generated', new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })],
      ];

      doc.rect(MARGIN, y, CONTENT_W, 14).fill(BRAND.navy);
      doc.fillColor(BRAND.white).fontSize(8).font('Helvetica-Bold')
        .text('CANDIDATE INFORMATION', MARGIN + 10, y + 3);
      y += 18;

      const colW = CONTENT_W / 2;
      infoFields.forEach(([label, value], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = MARGIN + col * colW;
        const cy = y + row * 28;
        const bg = row % 2 === 0 ? BRAND.offWhite : BRAND.white;
        doc.rect(cx, cy, colW, 28).fill(bg).stroke(BRAND.slateLight);
        doc.fillColor(BRAND.slate).fontSize(7).font('Helvetica').text(label, cx + 8, cy + 5);
        doc.fillColor(BRAND.textDark).fontSize(9).font('Helvetica-Bold').text(value || '—', cx + 8, cy + 15, { width: colW - 16, ellipsis: true });
      });

      y += Math.ceil(infoFields.length / 2) * 28 + 20;

      // ─── PERFORMANCE BAND ─────────────────────────────────────────────────
      const perfColor = percentage >= 70 ? BRAND.primary : percentage >= 50 ? BRAND.amber : BRAND.rose;
      const perfLabel = percentage >= 70 ? 'Strong Performance' : percentage >= 50 ? 'Satisfactory Performance' : 'Needs Improvement';

      doc.roundedRect(MARGIN, y, CONTENT_W, 48, 8).fill(perfColor);
      doc.fillColor(BRAND.white).fontSize(16).font('Helvetica-Bold')
        .text(perfLabel, MARGIN + 16, y + 10);
      doc.fillColor('rgba(255,255,255,0.75)').fontSize(9).font('Helvetica')
        .text(`Scored ${percentage}% – ${score} out of ${totalMarks} questions answered correctly.`, MARGIN + 16, y + 30);

      y += 62;

      // ─── SUBJECT-WISE ANALYSIS ────────────────────────────────────────────
      if (subjectAnalysis.length) {
        doc.rect(MARGIN, y, CONTENT_W, 14).fill(BRAND.navyLight);
        doc.fillColor(BRAND.white).fontSize(8).font('Helvetica-Bold')
          .text('SUBJECT-WISE PERFORMANCE', MARGIN + 10, y + 3);
        y += 18;

        subjectAnalysis.forEach((item, i) => {
          const rowBg = i % 2 === 0 ? BRAND.offWhite : BRAND.white;
          doc.rect(MARGIN, y, CONTENT_W, 30).fill(rowBg);

          // Subject name
          doc.fillColor(BRAND.textDark).fontSize(9).font('Helvetica-Bold')
            .text(item.subject, MARGIN + 10, y + 5, { width: 180 });
          doc.fillColor(BRAND.slate).fontSize(8).font('Helvetica')
            .text(`${item.correct}/${item.total} correct`, MARGIN + 10, y + 17, { width: 180 });

          // Progress bar
          const barX = MARGIN + 200;
          const barW = CONTENT_W - 230;
          const barH = 8;
          const barY = y + 11;
          const fill = Math.round((item.percentage / 100) * barW);
          const barColor = item.percentage >= 70 ? BRAND.primary : item.percentage >= 50 ? BRAND.amber : BRAND.rose;

          doc.roundedRect(barX, barY, barW, barH, 4).fill(BRAND.slateLight);
          if (fill > 0) doc.roundedRect(barX, barY, fill, barH, 4).fill(barColor);

          // Percentage label
          doc.fillColor(barColor).fontSize(9).font('Helvetica-Bold')
            .text(`${item.percentage}%`, barX + barW + 8, y + 9, { width: 40 });

          y += 30;
        });
        y += 16;
      }

      // ─── STRENGTHS & FOCUS AREAS ──────────────────────────────────────────
      const halfW = (CONTENT_W - 12) / 2;

      // Strengths header
      doc.roundedRect(MARGIN, y, halfW, 14, 0).fill(BRAND.primary);
      doc.fillColor(BRAND.white).fontSize(8).font('Helvetica-Bold')
        .text('YOUR STRENGTHS', MARGIN + 8, y + 3);

      // Focus header
      doc.roundedRect(MARGIN + halfW + 12, y, halfW, 14, 0).fill(BRAND.amber);
      doc.fillColor(BRAND.white).fontSize(8).font('Helvetica-Bold')
        .text('FOCUS AREAS', MARGIN + halfW + 20, y + 3);

      y += 16;
      const insightStart = y;

      // Strengths list
      if (strengths.length) {
        strengths.forEach((s, i) => {
          const bg = i % 2 === 0 ? BRAND.successBg : BRAND.white;
          doc.rect(MARGIN, y, halfW, 22).fill(bg);
          doc.circle(MARGIN + 14, y + 11, 3).fill(BRAND.primary);
          doc.fillColor(BRAND.textMid).fontSize(9).font('Helvetica')
            .text(s, MARGIN + 22, y + 6, { width: halfW - 30 });
          y += 22;
        });
      } else {
        doc.rect(MARGIN, y, halfW, 22).fill(BRAND.offWhite);
        doc.fillColor(BRAND.slate).fontSize(9).font('Helvetica')
          .text('No specific strength identified.', MARGIN + 8, y + 6);
        y += 22;
      }

      // Focus areas list (reset y to insightStart)
      let fy = insightStart;
      if (weaknesses.length) {
        weaknesses.forEach((w, i) => {
          const bg = i % 2 === 0 ? BRAND.warnBg : BRAND.white;
          doc.rect(MARGIN + halfW + 12, fy, halfW, 22).fill(bg);
          doc.circle(MARGIN + halfW + 26, fy + 11, 3).fill(BRAND.amber);
          doc.fillColor(BRAND.textMid).fontSize(9).font('Helvetica')
            .text(w, MARGIN + halfW + 34, fy + 6, { width: halfW - 42 });
          fy += 22;
        });
      } else {
        doc.rect(MARGIN + halfW + 12, fy, halfW, 22).fill(BRAND.offWhite);
        doc.fillColor(BRAND.slate).fontSize(9).font('Helvetica')
          .text('No specific focus area identified.', MARGIN + halfW + 20, fy + 6);
        fy += 22;
      }

      y = Math.max(y, fy) + 24;

      // ─── NEXT STEPS BANNER ────────────────────────────────────────────────
      doc.roundedRect(MARGIN, y, CONTENT_W, 60, 8).fill(BRAND.offWhite).stroke(BRAND.slateLight);
      doc.fillColor(BRAND.navy).fontSize(11).font('Helvetica-Bold')
        .text('What happens next?', MARGIN + 16, y + 12);
      doc.fillColor(BRAND.slate).fontSize(9).font('Helvetica')
        .text(
          'A Lurnex academic counsellor will review your results and reach out within 24 hours to discuss a personalised 1:1 learning plan tailored to your strengths and focus areas.',
          MARGIN + 16, y + 28,
          { width: CONTENT_W - 32 }
        );

      y += 78;

      // ─── FOOTER ───────────────────────────────────────────────────────────
      doc.rect(0, doc.page.height - 40, PAGE_W, 40).fill(BRAND.navy);
      doc
        .fillColor('#94a3b8')
        .fontSize(8)
        .font('Helvetica')
        .text(
          'Lurnex Academic Platform  ·  support@lurnex.me  ·  +91-9990-054-003  ·  www.lurnex.me',
          0,
          doc.page.height - 24,
          { align: 'center', width: PAGE_W }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });