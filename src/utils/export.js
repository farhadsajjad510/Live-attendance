import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatTime, calcPct } from './helpers';

export function exportToExcel(session, records, students, deptName) {
  const present = records.filter(r => r.status === 'present').length;
  const rows = [
    ['Live Attendance Report'],
    [`Department: ${deptName}`],
    [`Subject: ${session?.subjectName || session?.subject || '—'}`],
    [`Date: ${formatDate(session?.createdAt)}`],
    [`Present: ${present}  |  Absent: ${students.length - present}  |  Attendance: ${calcPct(present, students.length)}%`],
    [],
    ['Roll No', 'Student Name', 'Status', 'Time Marked'],
    ...students.map(s => {
      const rec = records.find(r => r.studentId === s.id || r.rollNumber === (s.rollNumber||s.id));
      return [s.rollNumber||s.id, s.displayName||s.name, rec?((rec.status||'present').toUpperCase()):'ABSENT', rec?formatTime(rec.markedAt):'—'];
    }),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch:14 },{ wch:32 },{ wch:10 },{ wch:14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  XLSX.writeFile(wb, `Attendance_${deptName}_${formatDate(session?.createdAt)}.xlsx`);
}

export function exportToPDF(session, records, students, deptName) {
  const doc = new jsPDF();
  const present = records.filter(r => r.status === 'present').length;
  const pct = calcPct(present, students.length);
  doc.setFillColor(37,99,235);
  doc.rect(0,0,220,28,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(16); doc.setFont('helvetica','bold');
  doc.text('Live Attendance Report', 14, 18);
  doc.setTextColor(40,40,40); doc.setFontSize(10); doc.setFont('helvetica','normal');
  [`Department: ${deptName}`,`Subject: ${session?.subjectName||session?.subject||'—'}`,`Date: ${formatDate(session?.createdAt)}`,`Present: ${present}  |  Absent: ${students.length-present}  |  Attendance: ${pct}%`]
    .forEach((l,i) => doc.text(l, 14, 38+i*7));
  autoTable(doc, {
    startY: 72,
    head:[['Roll No','Student Name','Status','Time']],
    body: students.map(s => {
      const rec = records.find(r => r.studentId===s.id || r.rollNumber===(s.rollNumber||s.id));
      return [s.rollNumber||s.id, s.displayName||s.name, rec?((rec.status||'present').toUpperCase()):'ABSENT', rec?formatTime(rec.markedAt):'—'];
    }),
    headStyles:{ fillColor:[37,99,235], fontStyle:'bold' },
    alternateRowStyles:{ fillColor:[245,248,255] },
    styles:{ fontSize:9 },
  });
  const pages = doc.internal.getNumberOfPages();
  for (let i=1;i<=pages;i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(160); doc.text(`Powered by FarhadAIStudio · Live Attendance · Page ${i}/${pages}`, 14, doc.internal.pageSize.height-8); }
  doc.save(`Attendance_${deptName}_${formatDate(session?.createdAt)}.pdf`);
}

export function exportStudentsExcel(students, deptName) {
  const rows = [[`Student List — ${deptName}`],[],['Roll No','Name','Program','Semester','Email','Phone'],
    ...students.map(s=>[s.rollNumber||'',s.displayName||s.name||'',s.program||'',s.semester||'',s.email||'',s.phone||''])];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Students');
  XLSX.writeFile(wb, `Students_${deptName}.xlsx`);
}
