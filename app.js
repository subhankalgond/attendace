// Simple attendance app using localStorage
const datePicker = document.getElementById('datePicker');
const studentsTableBody = document.querySelector('#studentsTable tbody');
const studentNameInput = document.getElementById('studentName');
const studentRollInput = document.getElementById('studentRoll');
const addStudentBtn = document.getElementById('addStudentBtn');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const clearBtn = document.getElementById('clearBtn');

const STORAGE_KEYS = { STUDENTS: 'attendance_students_v1', ATT: 'attendance_records_v1' };

let students = []; // [{id, name}]
let attendance = {}; // { 'YYYY-MM-DD': { studentId: true/false } }

function todayISO(){ return new Date().toISOString().slice(0,10); }

function load(){
  datePicker.value = todayISO();
  students = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS) || '[]');
  attendance = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATT) || '{}');
  render();
}

function saveAll(){
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  localStorage.setItem(STORAGE_KEYS.ATT, JSON.stringify(attendance));
}

function render(){
  const date = datePicker.value;
  const dayAtt = attendance[date] || {};
  studentsTableBody.innerHTML = '';
  if (students.length === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5" style="color:#666">No students yet — add a student.</td>';
    studentsTableBody.appendChild(tr);
    return;
  }

  // Precompute all dates for percentage
  const allDates = Object.keys(attendance).sort();

  for (const s of students){
    const tr = document.createElement('tr');
    const raw = dayAtt[s.id];
    let status;
    if (raw === true) status = 'present';
    else if (raw === false) status = 'absent';
    else status = raw; // 'present' | 'absent' | undefined
    const presentCell = `<span class="present-toggle ${status==='present'? 'on':''}" data-id="${s.id}" title="Mark present" role="button" aria-pressed="${status==='present'}">P</span><span class="absent-toggle ${status==='absent'? 'on':''}" data-id="${s.id}" title="Mark absent" role="button" aria-pressed="${status==='absent'}">A</span>`;

    // compute attendance % (over all recorded dates)
    let pct = '-';
    if (allDates.length > 0){
      let presentCount = 0, total = 0;
      for (const d of allDates){
        if (attendance[d] && typeof attendance[d][s.id] !== 'undefined'){
          total++;
          if (attendance[d][s.id]) presentCount++;
        }
      }
      if (total > 0) pct = Math.round((presentCount/total)*100) + '%';
    }

    tr.innerHTML = `
      <td>${escapeHtml(s.roll || '')}</td>
      <td>${escapeHtml(s.name)}</td>
      <td>${presentCell}</td>
      <td>${pct}</td>
      <td><button class="remove" data-id="${s.id}">Remove</button></td>
    `;
    studentsTableBody.appendChild(tr);
  }
}

function escapeHtml(s){ return s.replace(/[&<>\"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

function addStudent(){
  const name = studentNameInput.value.trim();
  const roll = studentRollInput.value.trim();
  if (!name) return alert('Enter a student name');
  if (roll && students.some(s=>s.roll === roll)) {
    if (!confirm('A student with this roll number already exists. Continue?')) return;
  }
  const id = 's_'+Date.now();
  students.push({id, name, roll});
  studentNameInput.value = '';
  studentRollInput.value = '';
  saveAll();
  render();
}

function removeStudent(id){
  if (!confirm('Remove this student?')) return;
  students = students.filter(s=>s.id !== id);
  // remove from all attendance records
  for (const d of Object.keys(attendance)){
    if (attendance[d][id] !== undefined) delete attendance[d][id];
  }
  saveAll();
  render();
}

function setStatus(id, state){
  const date = datePicker.value;
  if (!attendance[date]) attendance[date] = {};
  const current = attendance[date][id];
  let currState;
  if (current === true) currState = 'present';
  else if (current === false) currState = 'absent';
  else currState = current;

  if (currState === state){
    // toggle off (clear)
    delete attendance[date][id];
  } else {
    attendance[date][id] = state;
  }
  saveAll();
  render();
}

// export rows: studentId,studentRoll,studentName,date,present(1/0)
function exportCSV(){
  const date = datePicker.value;
  if (!date) return alert('Pick a date to export');
  const day = attendance[date] || {};
  // If no recorded values for that date, warn
  const hasAny = Object.keys(day).length > 0;
  if (!hasAny) return alert('No attendance recorded for the selected date');

  const lines = ['studentRoll,studentName,date,present'];
  for (const s of students){
    const val = attendance[date] && attendance[date][s.id];
    let p;
    if (val === 'present' || val === true) p = '1';
    else if (val === 'absent' || val === false) p = '0';
    else p = '';
    lines.push(`"${(s.roll||'').replace(/"/g,'""')}","${s.name.replace(/"/g,'""')}",${date},${p}`);
  }
  const blob = new Blob([lines.join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `attendance_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAllCSV(){
  const lines = ['studentRoll,studentName,date,present'];
  for (const d of Object.keys(attendance).sort()){
    for (const s of students){
      const val = attendance[d][s.id];
      let p;
      if (val === 'present' || val === true) p = '1';
      else if (val === 'absent' || val === false) p = '0';
      else p = '';
      lines.push(`"${(s.roll||'').replace(/"/g,'""')}","${s.name.replace(/"/g,'""')}",${d},${p}`);
    }
  }
  const blob = new Blob([lines.join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'attendance_all_dates.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function importCSVFile(file){
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    parseCSVImport(text);
  };
  reader.readAsText(file);
}

function parseCSVImport(text){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if (lines.length === 0) return alert('CSV seems empty');
  const header = lines.shift().split(',').map(h=>h.trim().toLowerCase());
  const idxStudentId = header.indexOf('studentid');
  const idxStudentRoll = header.indexOf('studentroll');
  const idxStudentName = header.indexOf('studentname');
  const idxDate = header.indexOf('date');
  const idxPresent = header.indexOf('present');
  if (idxDate < 0 || idxPresent < 0 || (idxStudentId < 0 && idxStudentRoll < 0 && idxStudentName < 0)){
    return alert('CSV must include date and present columns, and at least one of studentRoll or studentName or studentId');
  }

  for (const raw of lines){
    // simple CSV split (handles quoted fields)
    const parts = splitCSVLine(raw);
    const sidCandidate = idxStudentId >= 0 ? parts[idxStudentId] : undefined;
    const sroll = idxStudentRoll >= 0 ? (parts[idxStudentRoll] || '').trim() : '';
    const sname = idxStudentName >= 0 ? (parts[idxStudentName] || '').trim() : (sroll ? '' : 'Unknown');
    const date = parts[idxDate];
    const rawP = (parts[idxPresent] || '').toString().trim();
    let p;
    if (rawP === '1' || rawP.toLowerCase() === 'true' || rawP.toLowerCase() === 'p') p = 'present';
    else if (rawP === '0' || rawP.toLowerCase() === 'false' || rawP.toLowerCase() === 'a' || rawP.toLowerCase() === 'absent') p = 'absent';
    else p = undefined;

    // find matching student: prefer id, then roll, then name
    let existing;
    if (sidCandidate) existing = students.find(s=>s.id===sidCandidate);
    if (!existing && sroll) existing = students.find(s=>s.roll===sroll);
    if (!existing && sname) existing = students.find(s=>s.name===sname);

    if (existing){
      if (sname) existing.name = sname;
      if (sroll) existing.roll = sroll;
    } else {
      const newId = 's_' + Date.now() + '_' + Math.floor(Math.random()*10000);
      students.push({id:newId, name:sname || 'Unknown', roll:sroll});
      existing = students[students.length-1];
    }

    if (!attendance[date]) attendance[date] = {};
    if (typeof p !== 'undefined') attendance[date][existing.id] = p;
  }
  saveAll();
  render();
}

function splitCSVLine(line){
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i=0;i<line.length;i++){
    const ch = line[i];
    if (ch === '"'){
      if (inQuotes && line[i+1] === '"'){ cur += '"'; i++; } else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes){ out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(s=>s.replace(/^"|"$/g,''));
}

function clearAll(){
  if (!confirm('Clear all students and attendance?')) return;
  students = [];
  attendance = {};
  saveAll();
  render();
}

// event wiring
addStudentBtn.addEventListener('click', addStudent);
studentNameInput.addEventListener('keydown', e=>{ if (e.key === 'Enter') addStudent(); });
studentRollInput.addEventListener('keydown', e=>{ if (e.key === 'Enter') addStudent(); });
saveBtn.addEventListener('click', ()=>{ saveAll(); alert('Saved'); });
exportBtn.addEventListener('click', exportCSV);
const exportAllBtn = document.getElementById('exportAllBtn');
if (exportAllBtn) exportAllBtn.addEventListener('click', exportAllCSV);
importBtn.addEventListener('click', ()=>importFile.click());
importFile.addEventListener('change', e=>{ const f = e.target.files[0]; if (f) importCSVFile(f); importFile.value = ''; });
clearBtn.addEventListener('click', clearAll);

// delegate clicks for toggles and remove buttons
studentsTableBody.addEventListener('click', (e)=>{
  const target = e.target;
  if (target.classList.contains('present-toggle')){
    const id = target.dataset.id;
    setStatus(id, 'present');
  } else if (target.classList.contains('absent-toggle')){
    const id = target.dataset.id;
    setStatus(id, 'absent');
  } else if (target.classList.contains('remove')){
    const id = target.dataset.id;
    removeStudent(id);
  }
});

// date change
datePicker.addEventListener('change', ()=> render());

// initial load
load();
