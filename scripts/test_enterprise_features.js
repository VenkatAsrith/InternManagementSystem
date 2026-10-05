const API_BASE = 'http://localhost:5000/api/v1';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`[${res.status}] ${endpoint}: ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

async function runEnterpriseFeatureTests() {
  console.log('====================================================');
  console.log('🧪 TESTING NEW ENTERPRISE RBAC & PLATFORM FEATURES');
  console.log('====================================================\n');

  // 1. Authenticate as Global Admin
  console.log('1. Authenticating as Super Admin (admin@techmecha.com)...');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@techmecha.com', password: 'Password2026!' })
  });
  const token = loginRes.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('✅ Super Admin authenticated successfully.\n');

  // 2. Global Admin Overview & System Health
  console.log('2. Fetching Global Admin Command Center Overview...');
  const overview = await request('/global-admin/overview', { headers: authHeaders });
  console.log('✅ Global Admin Overview received:');
  console.log('   Organizations:', overview.data.kpis.totalOrgs, `(Active: ${overview.data.kpis.activeOrgs})`);
  console.log('   Total Users:', overview.data.kpis.totalUsers);
  console.log('   Active Interns:', overview.data.kpis.activeInterns);
  console.log('   Database State:', overview.data.systemHealth.databaseState, '| Memory:', overview.data.systemHealth.heapUsedMB, 'MB');
  console.log('   Recent Audit Events:', overview.data.recentAuditEvents.length, 'recorded.\n');

  // 3. Roles and Permission Catalog
  console.log('3. Fetching Role Registry & Permission Catalog...');
  const roles = await request('/roles', { headers: authHeaders });
  console.log(`✅ Loaded ${roles.data.length} roles from centralized registry.`);
  
  const catalog = await request('/roles/catalog/permissions', { headers: authHeaders });
  console.log(`✅ Permission catalog contains ${catalog.data.groups.length} module groups.\n`);

  // 4. Custom Role Builder
  console.log('4. Creating Custom Role "LEGAL_COUNSEL"...');
  const customRoleKey = `LEGAL_COUNSEL_${Date.now()}`;
  const customRole = await request('/roles', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      key: customRoleKey,
      label: 'Corporate Legal Counsel',
      description: 'Reviews NDAs, contractual agreements, and compliance audits.',
      category: 'COMPLIANCE',
      permissions: ['documents.*', 'templates.*', 'offers.read', 'exit.read', 'audit.read']
    })
  });
  console.log(`✅ Custom role '${customRole.data.label}' (${customRole.data.key}) created with ${customRole.data.permissions.length} permissions.\n`);

  // 5. User Role Assignment with Permission Diff
  console.log('5. Previewing Role Assignment Permission Diff...');
  // Find a test user (e.g. mentorElena)
  const users = await request('/global-admin/users', { headers: authHeaders });
  const testUser = users.data.find(u => u.email === 'elena.rostova@techmecha.com') || users.data[1];
  
  const diff = await request('/roles/preview-change', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      userId: testUser._id,
      newRoleKey: customRoleKey
    })
  });
  console.log('✅ Permission Diff Preview:');
  console.log(`   User: ${diff.data.userName} (${diff.data.currentRole} -> ${diff.data.newRole})`);
  console.log(`   + Added Permissions (${diff.data.permissionsAdded.length}):`, diff.data.permissionsAdded.join(', '));
  console.log(`   - Removed Permissions (${diff.data.permissionsRemoved.length}):`, diff.data.permissionsRemoved.join(', '));

  console.log('\n6. Committing Role Assignment...');
  const assignRes = await request('/roles/assign', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      userId: testUser._id,
      newRoleKey: customRoleKey,
      reason: 'Assigned to corporate legal review committee'
    })
  });
  console.log(`✅ Role successfully assigned: ${assignRes.message}`);

  // Revert user role back to original to preserve pristine state
  console.log('\n7. Reverting test user back to original role...');
  await request('/roles/assign', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      userId: testUser._id,
      newRoleKey: testUser.role,
      reason: 'Reverting test role assignment'
    })
  });
  console.log(`✅ Test user reverted back to ${testUser.role}.`);

  // 8. Work Record Endpoint Test
  console.log('\n8. Fetching Unified Chronological Work Record for Intern...');
  const interns = await request('/interns', { headers: authHeaders });
  if (interns.data.length > 0) {
    const targetIntern = interns.data[0];
    const workRecord = await request(`/interns/${targetIntern._id}/work-record`, { headers: authHeaders });
    console.log('✅ Work record fetched successfully:');
    console.log(`   Intern: ${workRecord.data.intern.userId.firstName} ${workRecord.data.intern.userId.lastName}`);
    console.log(`   Total Completed Tasks: ${workRecord.data.summary.completedTasks} / ${workRecord.data.summary.totalTasks}`);
    console.log(`   Journals Filed: ${workRecord.data.summary.totalJournals}`);
    console.log(`   Meetings Attended: ${workRecord.data.summary.totalMeetings}`);
    console.log(`   Unified Timeline Events: ${workRecord.data.activities.length} entries.`);
  }

  console.log('\n====================================================');
  console.log('🎉 ALL ENTERPRISE PLATFORM FEATURE TESTS PASSED!');
  console.log('====================================================');
}

runEnterpriseFeatureTests().catch(err => {
  console.error('\n❌ Enterprise Feature Test Failed:', err.message);
  process.exit(1);
});
