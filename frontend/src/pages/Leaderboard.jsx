import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Trophy } from 'lucide-react';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const data = await apiClient('/leaderboard');
      setLeaderboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Live Leaderboard</h1>
        <button onClick={fetchLeaderboard} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 text-sm">
          Refresh
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium text-sm">
                <th className="p-4 w-16 text-center">Rank</th>
                <th className="p-4">Team</th>
                <th className="p-4 text-center">1st</th>
                <th className="p-4 text-center">2nd</th>
                <th className="p-4 text-center">3rd</th>
                <th className="p-4 text-right pr-6">Total Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500">No teams found. Add teams to see the leaderboard.</td>
                </tr>
              ) : (
                leaderboard.map((team, idx) => {
                  const isFirst = idx === 0;
                  const isSecond = idx === 1;
                  const isThird = idx === 2;
                  
                  return (
                    <tr key={team.id} className={`hover:bg-slate-50 transition-colors ${isFirst ? 'bg-amber-50/30' : ''}`}>
                      <td className="p-4 text-center">
                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                          isFirst ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' :
                          isSecond ? 'bg-slate-200 text-slate-700' :
                          isThird ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {idx + 1}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          {isFirst && <Trophy size={18} className="text-amber-500" />}
                          <span className={`font-semibold ${isFirst ? 'text-amber-900 text-lg' : 'text-slate-700'}`}>
                            {team.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center text-slate-600">{team.firstCount}</td>
                      <td className="p-4 text-center text-slate-600">{team.secondCount}</td>
                      <td className="p-4 text-center text-slate-600">{team.thirdCount}</td>
                      <td className={`p-4 text-right pr-6 font-bold ${isFirst ? 'text-amber-700 text-xl' : 'text-slate-800 text-lg'}`}>
                        {team.totalPoints}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
