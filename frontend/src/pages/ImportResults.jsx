import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const PROGRAMME_CATEGORIES = ['kiddies', 'sub_junior', 'junior', 'senior', 'super_senior', 'general'];

export default function ImportResults() {
  const [teams, setTeams] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [fileData, setFileData] = useState([]);
  const [validation, setValidation] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsData, categoriesData] = await Promise.all([
          apiClient('/teams'),
          apiClient('/categories')
        ]);
        setTeams(teamsData || []);
        setCategories(categoriesData || []);
      } catch (err) {
        console.error('Failed to load initial data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "Programme Category": "junior",
        "Programme": "Quran Recitation",
        "Score Category": categories[0]?.name || "Category A",
        "1st Team": teams[0]?.name || "Team Noor",
        "1st Candidate": "Ali",
        "2nd Team": teams[1]?.name || "Team Huda",
        "2nd Candidate": "Omar",
        "3rd Team": "",
        "3rd Candidate": ""
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "MilaadFest_Import_Template.xlsx");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportStats(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setFileData(data);
      validateData(data);
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const normalizeString = (str) => (str || '').toString().trim().toLowerCase();

  const validateData = (data) => {
    const results = data.map((row, index) => {
      const errors = [];
      const rowNum = index + 2; // +1 for 0-index, +1 for header row

      const progCatInput = normalizeString(row['Programme Category']);
      const categoryMatch = PROGRAMME_CATEGORIES.find(c => c.toLowerCase() === progCatInput || c.replace('_', ' ').toLowerCase() === progCatInput);
      if (!categoryMatch) {
        errors.push(`Invalid Programme Category: "${row['Programme Category'] || 'Empty'}"`);
      }

      if (!row['Programme'] || !row['Programme'].toString().trim()) {
        errors.push('Programme Name is missing');
      }

      const scoreCatInput = normalizeString(row['Score Category']);
      const scoreCatMatch = categories.find(c => c.name.toLowerCase() === scoreCatInput);
      if (!scoreCatMatch) {
        errors.push(`Score Category "${row['Score Category'] || 'Empty'}" not found`);
      }

      const validateTeam = (teamName, posLabel) => {
        if (!teamName) return null;
        const teamMatch = teams.find(t => t.name.toLowerCase() === normalizeString(teamName));
        if (!teamMatch) {
          errors.push(`${posLabel} Team "${teamName}" not found`);
        }
        return teamMatch;
      };

      const team1 = validateTeam(row['1st Team'], '1st Place');
      const team2 = validateTeam(row['2nd Team'], '2nd Place');
      const team3 = validateTeam(row['3rd Team'], '3rd Place');

      const hasFirst = team1 || row['1st Candidate'];
      const hasSecond = team2 || row['2nd Candidate'];
      const hasThird = team3 || row['3rd Candidate'];

      if (!hasFirst && !hasSecond && !hasThird) {
        errors.push('At least one position (team or candidate) must be filled.');
      }

      return {
        rowNum,
        original: row,
        isValid: errors.length === 0,
        errors,
        parsed: errors.length === 0 ? {
          programme_category: categoryMatch,
          programme: row['Programme'].toString().trim(),
          scoring_category_id: scoreCatMatch.id,
          first_points: scoreCatMatch.first_points,
          second_points: scoreCatMatch.second_points,
          third_points: scoreCatMatch.third_points,
          team1,
          candidate1: row['1st Candidate'] ? row['1st Candidate'].toString().trim() : '',
          team2,
          candidate2: row['2nd Candidate'] ? row['2nd Candidate'].toString().trim() : '',
          team3,
          candidate3: row['3rd Candidate'] ? row['3rd Candidate'].toString().trim() : '',
        } : null
      };
    });

    setValidation(results);
  };

  const handleImport = async () => {
    const validRows = validation.filter(v => v.isValid).map(v => v.parsed);
    if (validRows.length === 0) return;

    setImporting(true);
    let successCount = 0;
    let failCount = 0;

    const submissions = [];
    validRows.forEach(row => {
      const base = {
        programme_category: row.programme_category,
        programme: row.programme,
        scoring_category_id: row.scoring_category_id
      };
      if (row.team1 || row.candidate1) submissions.push({ ...base, team_id: row.team1 ? row.team1.id : null, candidate_name: row.candidate1 || '', position: 1, points_awarded: row.first_points });
      if (row.team2 || row.candidate2) submissions.push({ ...base, team_id: row.team2 ? row.team2.id : null, candidate_name: row.candidate2 || '', position: 2, points_awarded: row.second_points });
      if (row.team3 || row.candidate3) submissions.push({ ...base, team_id: row.team3 ? row.team3.id : null, candidate_name: row.candidate3 || '', position: 3, points_awarded: row.third_points });
    });

    try {
      // Chunking to avoid too many simultaneous requests if the file is huge
      const chunkSize = 10;
      for (let i = 0; i < submissions.length; i += chunkSize) {
        const chunk = submissions.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (sub) => {
          try {
            await apiClient('/results', { method: 'POST', body: JSON.stringify(sub) });
            successCount++;
          } catch (e) {
            console.error(e);
            failCount++;
          }
        }));
      }
      
      setImportStats({ success: successCount, failed: failCount });
      setFileData([]);
      setValidation([]);
    } catch (err) {
      alert('A critical error occurred during import: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader className="animate-spin mx-auto text-indigo-500" /></div>;

  const validCount = validation.filter(v => v.isValid).length;
  const errorCount = validation.filter(v => !v.isValid).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bulk Import Results</h1>
          <p className="text-slate-500 mt-1">Upload an Excel file to quickly import multiple results.</p>
        </div>
        <button onClick={downloadTemplate} className="flex items-center space-x-2 text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 transition border border-indigo-100">
          <Download size={18} />
          <span>Download Template</span>
        </button>
      </div>

      {importStats && (
        <div className={`p-6 rounded-xl border ${importStats.failed > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          <h3 className="text-lg font-bold flex items-center space-x-2">
            <CheckCircle2 size={24} />
            <span>Import Complete</span>
          </h3>
          <p className="mt-2">Successfully imported <strong>{importStats.success}</strong> result records.</p>
          {importStats.failed > 0 && <p className="mt-1 text-red-600">Failed to import {importStats.failed} records.</p>}
        </div>
      )}

      {!fileData.length && !importStats && (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:bg-slate-50 transition-colors">
          <FileSpreadsheet size={48} className="mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-bold text-slate-700 mb-2">Upload Excel File</h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">Make sure your file matches the template columns exactly. Teams and Score Categories must match your existing database records.</p>
          
          <label className="cursor-pointer bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition inline-flex items-center space-x-2">
            <UploadCloud size={20} />
            <span>Select .xlsx File</span>
            <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      )}

      {fileData.length > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-xl">{validation.length}</div>
              <div><p className="text-sm text-slate-500 font-medium">Total Rows</p></div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-green-200 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-xl">{validCount}</div>
              <div><p className="text-sm text-green-600 font-medium">Valid & Ready</p></div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold text-xl">{errorCount}</div>
              <div><p className="text-sm text-red-600 font-medium">Errors Found</p></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Preview Data</h2>
              <div className="space-x-3">
                <button onClick={() => { setFileData([]); setValidation([]); }} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition">Cancel</button>
                <button 
                  onClick={handleImport} 
                  disabled={importing || validCount === 0}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition disabled:opacity-50 inline-flex items-center space-x-2"
                >
                  {importing ? <Loader className="animate-spin" size={18} /> : <UploadCloud size={18} />}
                  <span>Import {validCount} Valid Rows</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-white sticky top-0 shadow-sm z-10">
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                    <th className="p-3 font-semibold w-16">Row</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold">Programme</th>
                    <th className="p-3 font-semibold">1st Place</th>
                    <th className="p-3 font-semibold">2nd Place</th>
                    <th className="p-3 font-semibold">3rd Place</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {validation.map((v, i) => (
                    <tr key={i} className={v.isValid ? 'hover:bg-slate-50' : 'bg-red-50/50'}>
                      <td className="p-3 font-medium text-slate-500">{v.rowNum}</td>
                      <td className="p-3">
                        {v.isValid ? (
                          <span className="inline-flex items-center space-x-1 text-green-600 font-medium bg-green-100 px-2 py-1 rounded text-xs">
                            <CheckCircle2 size={14} /><span>Valid</span>
                          </span>
                        ) : (
                          <div className="flex flex-col space-y-1">
                            <span className="inline-flex items-center space-x-1 text-red-600 font-medium bg-red-100 px-2 py-1 rounded text-xs w-max">
                              <AlertTriangle size={14} /><span>Error</span>
                            </span>
                            {v.errors.map((e, idx) => <span key={idx} className="text-xs text-red-500">{e}</span>)}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{v.original['Programme'] || '-'}</div>
                        <div className="text-xs text-slate-500">{v.original['Programme Category']} • {v.original['Score Category']}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-amber-700">{v.original['1st Team'] || '-'}</div>
                        <div className="text-xs text-slate-500">{v.original['1st Candidate']}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-700">{v.original['2nd Team'] || '-'}</div>
                        <div className="text-xs text-slate-500">{v.original['2nd Candidate']}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-orange-800">{v.original['3rd Team'] || '-'}</div>
                        <div className="text-xs text-slate-500">{v.original['3rd Candidate']}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
