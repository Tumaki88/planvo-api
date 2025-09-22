// Utilities to apply timeframe-based progress reset on the fly (server-side)

function getCurrentPeriodStart(timeframe, now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const startOfDay = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));

  switch (String(timeframe || '').toLowerCase()) {
    case 'daily':
      return startOfDay;
    case 'weekly': {
      const day = (now.getUTCDay() + 6) % 7; // Mon=0..Sun=6
      const start = new Date(startOfDay);
      start.setUTCDate(start.getUTCDate() - day);
      return start;
    }
    case 'monthly':
      return new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    case 'yearly':
      return new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
    default: {
      const day = (now.getUTCDay() + 6) % 7;
      const start = new Date(startOfDay);
      start.setUTCDate(start.getUTCDate() - day);
      return start;
    }
  }
}

function sortJournals(journal) {
  const list = Array.isArray(journal) ? journal.slice() : [];
  return list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function applyTimeframeReset(goal, now = new Date()) {
  if (!goal) return goal;
  const timeframe = goal.timeframe || 'weekly';
  const periodStart = getCurrentPeriodStart(timeframe, now);
  const js = sortJournals(goal.journal);
  const inPeriod = js.filter((e) => new Date(e.created_at) >= periodStart);
  let progress = 0;
  if (inPeriod.length) {
    const last = inPeriod[inPeriod.length - 1];
    progress = Number(last.progress) || 0;
  }
  const bounded = Math.max(0, Math.min(100, Math.round(progress)));
  return { ...goal, progress: bounded };
}

module.exports = {
  getCurrentPeriodStart,
  applyTimeframeReset,
};
