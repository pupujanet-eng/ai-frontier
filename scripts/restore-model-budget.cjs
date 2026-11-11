// Daily accounting is restored from durable Actions artifacts, never an evictable cache.
// A prior paid-generation step without its ledger blocks new spending, including reruns.
module.exports = async function restoreBudget({ github, context, core, now = new Date(), dir = '.model-budget', attempt = Number(process.env.GITHUB_RUN_ATTEMPT || 1) }) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const start = Date.parse(`${date}T00:00:00+08:00`);
  const runs = await github.paginate(github.rest.actions.listWorkflowRuns, { ...context.repo, workflow_id: 'deploy.yml', per_page: 100 });
  const artifacts = [];
  for (const run of runs) {
    if (Date.parse(run.updated_at) < start || (run.id === context.runId && attempt === 1)) continue;
    const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, { ...context.repo, run_id: run.id, filter: 'all', per_page: 100 });
    const generated = jobs.filter((job) => (run.id !== context.runId || job.run_attempt < attempt)
      && job.steps?.some((s) => s.name === 'Generate daily digest' && s.started_at && Date.parse(s.started_at) >= start && s.conclusion !== 'skipped'));
    if (generated.some((job) => !job.steps.some((s) => s.name === 'Restore daily model budget'))) throw new Error('Legacy generation ran today without usage accounting; wait for the next Beijing day instead of granting a fresh budget');
    const governed = generated;
    if (!governed.length) continue;
    const saved = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, { ...context.repo, run_id: run.id, per_page: 100 });
    // Every attempt that could spend must have saved its final reservation/usage ledger.
    for (const job of governed) {
      const artifact = saved.find((a) => a.name === `model-budget-${date}-${run.id}-${job.run_attempt}` && !a.expired);
      if (!artifact) throw new Error(`Run ${run.id} attempt ${job.run_attempt} generated without a readable daily ledger; refusing to reset budget`);
      artifacts.push(artifact);
    }
  }
  await fs.mkdir(dir, { recursive: true });
  core.setOutput('date', date);
  artifacts.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
  if (artifacts.length) {
    const download = await github.rest.actions.downloadArtifact({ ...context.repo, artifact_id: artifacts[0].id, archive_format: 'zip' });
    await fs.writeFile(path.join(dir, 'restore.zip'), Buffer.from(download.data));
    core.info(`Restore daily model ledger from artifact ${artifacts[0].id}`);
    core.setOutput('downloaded', 'true');
  } else {
    await fs.writeFile(path.join(dir, `${date}.json`), JSON.stringify({ version: 1, date, entries: [], validationFailures: 0 }));
    core.info('No governed generation earlier this Beijing day; initialize budget ledger');
  }
};
