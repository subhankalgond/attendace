# Student Attendance (Local)

Simple browser-based attendance app that stores data in your browser (localStorage).

Features
- Add / remove students
- Choose a date and mark each student Present (toggle)
- Save data to localStorage (auto-save on actions)
- Export attendance as CSV and import CSV backups
- Clear all data

How to use
1. Open `index.html` in a browser.
2. Use the date picker (defaults to today).
3. Add students with name and optional Roll number using the inputs and `Add Student` button.
4. Toggle Present/Absent (P/A) to mark attendance for that date.
5. Use `Export CSV` to download a backup. Use `Import CSV` to restore.

Notes
- Attendance is stored locally; export if you need to move data to another device.
- CSV format: columns `studentId,studentRoll,studentName,date,present` (present: 1 or 0)

File list
- `index.html` - main UI
- `styles.css` - styling
- `app.js` - app logic using `localStorage`

Enjoy! ✨