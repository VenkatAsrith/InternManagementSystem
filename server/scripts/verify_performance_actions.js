const BASE_URL = 'http://localhost:5000/api/v1';

async function req(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(fullUrl, {
    ...options,
    headers,
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return { status: res.status, data };
}

async function verifyPerformance() {
  console.log('Testing HR Admin Performance Review Actions...\n');

  const authRes = await req('/auth/login', {
    method: 'POST',
    body: { email: 'hr@techmecha.com', password: 'Password2026!' }
  });
  const hrHeaders = { Authorization: `Bearer ${authRes.data.data.token}` };

  // 1. Fetch active interns
  const internsRes = await req('/interns?status=ACTIVE', { headers: hrHeaders });
  const intern = internsRes.data.data[0];
  console.log(`1. Target intern: ${intern.internId} (${intern.userId?.firstName || 'Intern'})`);

  // 2. Initiate a review cycle
  console.log('2. Initiating performance review cycle via POST /performance/reviews...');
  const createRes = await req('/performance/reviews', {
    method: 'POST',
    headers: hrHeaders,
    body: {
      internId: intern._id,
      type: 'MID_TERM',
      cycleTitle: 'Q4 Mid-Term Engineering Evaluation'
    }
  });
  const review = createRes.data.data;
  console.log(`   Created review ID: ${review._id}, Status: ${review.status}`);

  // 3. Fetch reviews via GET /performance/reviews
  console.log('3. Verifying GET /performance/reviews...');
  const listRes = await req('/performance/reviews', { headers: hrHeaders });
  console.log(`   Found ${listRes.data.data.length} total reviews.`);

  // 4. Intern submits self-assessment
  console.log('4. Logging in as target intern to submit self-assessment...');
  const internAuth = await req('/auth/login', {
    method: 'POST',
    body: { email: 'arjun.sharma@example.com', password: 'Password2026!' }
  });
  const internHeaders = { Authorization: `Bearer ${internAuth.data.data.token}` };

  const selfRes = await req(`/performance/reviews/${review._id}/self-assessment`, {
    method: 'POST',
    headers: internHeaders,
    body: {
      scores: [
        { metricName: 'Technical Skills & Code Quality', score: 9, comments: 'Delivered high quality backend microservices.' },
        { metricName: 'Task Completion & Velocity', score: 9, comments: 'Completed all sprint story points on time.' }
      ],
      strengths: 'Fast learner, proactive communication, solid test coverage.',
      growthAreas: 'System design depth for large distributed clusters.',
      generalComments: 'Great mentorship from Elena and Marcus.'
    }
  });
  console.log(`   Self-assessment submitted! New status: ${selfRes.data.data.status}`);

  // 5. Finalize or review as HR/Admin
  console.log('5. Finalizing review as HR Admin...');
  const finalizeRes = await req(`/performance/reviews/${review._id}/finalize`, {
    method: 'POST',
    headers: hrHeaders,
    body: {
      rating: 'EXCEEDS_EXPECTATIONS',
      strengths: 'Outstanding execution and initiative.',
      areasForImprovement: 'Continue deep-diving into microservices architectures.',
      pmoNotes: 'Recommended for PPO (Pre-Placement Offer).'
    }
  });
  console.log(`   Review finalized! New status: ${finalizeRes.data.data.status}, Final Score: ${finalizeRes.data.data.finalScore}`);

  console.log('\n✅ All Performance Review flows verified successfully!');
}

verifyPerformance().catch(err => {
  console.error('❌ Performance Verification Failed:', err.status, err.data || err.message);
  process.exit(1);
});
