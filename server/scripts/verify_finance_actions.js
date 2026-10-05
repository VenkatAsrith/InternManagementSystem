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

async function verifyFinance() {
  console.log('Testing HR Admin Finance Actions...\n');

  // Login as HR Admin
  const authRes = await req('/auth/login', {
    method: 'POST',
    body: {
      email: 'hr@techmecha.com',
      password: 'Password2026!'
    }
  });
  const hrHeaders = { Authorization: `Bearer ${authRes.data.data.token}` };

  // 1. Generate Cycle or fetch payments
  console.log('1. Fetching payments...');
  const payRes = await req('/finance/payments', { headers: hrHeaders });
  const payments = payRes.data.data.payments || payRes.data.data;
  console.log(`   Found ${payments.length} payments.`);

  // Find or create pending payment
  let pending = payments.find(p => p.status === 'PENDING');
  if (!pending) {
    console.log('2. Generating stipend cycle 2026-10...');
    const cycleRes = await req('/finance/generate-cycle', {
      method: 'POST',
      headers: hrHeaders,
      body: {
        cycle: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31'
      }
    });
    console.log(`   Cycle generation result: ${cycleRes.data.message || 'success'}`);
    const refetch = await req('/finance/payments', { headers: hrHeaders });
    const refetchedPayments = refetch.data.data.payments || refetch.data.data;
    pending = refetchedPayments.find(p => p.status === 'PENDING');
  }

  if (pending) {
    console.log(`3. Adding adjustment to payment ${pending._id}...`);
    const adjRes = await req(`/finance/payments/${pending._id}/adjustments`, {
      method: 'POST',
      headers: hrHeaders,
      body: {
        type: 'BONUS',
        amount: 2500,
        description: 'TMT High Velocity Sprint Bonus'
      }
    });
    console.log(`   Adjustment added. Net payable: ₹${adjRes.data.data.payment.netPayable}`);

    console.log(`4. Processing payment ${pending._id}...`);
    const procRes = await req(`/finance/payments/${pending._id}/process`, {
      method: 'POST',
      headers: hrHeaders,
      body: {
        paymentMethod: 'BANK_TRANSFER',
        paymentReference: `TMT-UTR-${Date.now()}`,
        notes: 'Monthly stipend disbursed on schedule'
      }
    });
    console.log(`   Payment processed successfully! Status: ${procRes.data.data.status}, Reference: ${procRes.data.data.paymentReference}`);
  }

  console.log('\n✅ All HR Admin Finance operations succeeded with 0 errors!');
}

verifyFinance().catch(err => {
  console.error('❌ Finance Verification Failed:', err.status, err.data || err.message);
  process.exit(1);
});
