import { NextResponse } from 'next/server'

// Triggers the monthly_ai_report GitHub Actions workflow via workflow_dispatch.
// Requires GITHUB_PAT env var with 'workflow' scope.
// Repo: timkene/CIL-BACKEND, workflow: monthly_ai_report.yml

const GITHUB_PAT  = process.env.GITHUB_PAT
const GITHUB_REPO = 'timkene/CIL-BACKEND'
const WORKFLOW_ID = 'monthly_ai_report.yml'

export async function POST() {
  if (!GITHUB_PAT) {
    return NextResponse.json(
      { message: 'GITHUB_PAT not configured. Add it to Vercel environment variables.' },
      { status: 500 }
    )
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_PAT}`,
      'Accept':        'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ ref: 'fix-reqs' }),
  })

  if (res.status === 204) {
    return NextResponse.json({ message: 'Workflow triggered successfully' })
  }

  const text = await res.text()
  return NextResponse.json(
    { message: `GitHub API error ${res.status}: ${text}` },
    { status: res.status }
  )
}
