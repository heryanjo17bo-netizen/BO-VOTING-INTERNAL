import test from 'node:test';
import assert from 'node:assert/strict';
import { VotingEngine } from '../src/server/votingEngine.ts';

test('VotingEngine: First vote succeeds and increments contestant and outlet vote count', async () => {
  const engine = new VotingEngine({ inMemory: true });
  const contestants = engine.getContestants('BOPIK');
  assert.ok(contestants.length > 0, 'BOPIK should have contestants');

  const target = contestants[0];
  const initialVotes = target.votes;
  const initialOutlet = engine.getOutlet('BOPIK')!;
  const initialOutletVotes = initialOutlet.totalVotes;

  const result = await engine.castVote({
    voterId: 'test-voter-device-abc-12345',
    outletCode: 'BOPIK',
    contestantId: target.id,
  });

  assert.equal(result.success, true);
  assert.equal(result.contestant?.votes, initialVotes + 1);
  assert.equal(engine.getOutlet('BOPIK')?.totalVotes, initialOutletVotes + 1);

  // Check voter status
  const status = engine.getVoterStatus('test-voter-device-abc-12345');
  assert.equal(status.hasVoted, true);
  assert.equal(status.contestant?.id, target.id);
});

test('VotingEngine: Duplicate vote from same voting identity is rejected', async () => {
  const engine = new VotingEngine({ inMemory: true });
  const contestants = engine.getContestants('BOPIK');
  const target1 = contestants[0];
  const target2 = contestants[1];

  // First vote succeeds
  const first = await engine.castVote({
    voterId: 'unique-voter-session-999',
    outletCode: 'BOPIK',
    contestantId: target1.id,
  });
  assert.equal(first.success, true);

  // Second vote on same contestant fails
  const second = await engine.castVote({
    voterId: 'unique-voter-session-999',
    outletCode: 'BOPIK',
    contestantId: target1.id,
  });
  assert.equal(second.success, false);
  assert.equal(second.code, 'DUPLICATE_VOTE');

  // Second vote on different contestant fails as well
  const third = await engine.castVote({
    voterId: 'unique-voter-session-999',
    outletCode: 'BOPIK',
    contestantId: target2.id,
  });
  assert.equal(third.success, false);
  assert.equal(third.code, 'DUPLICATE_VOTE');
});

test('VotingEngine: Voter cannot vote in a different outlet in the same event', async () => {
  const engine = new VotingEngine({ inMemory: true });
  const pikContestant = engine.getContestants('BOPIK')[0];
  const scbdContestant = engine.getContestants('BOSCBD')[0];

  // Vote in PIK
  const pikVote = await engine.castVote({
    voterId: 'traveling-guest-session-444',
    outletCode: 'BOPIK',
    contestantId: pikContestant.id,
  });
  assert.equal(pikVote.success, true);

  // Attempt vote in SCBD in same event
  const scbdVote = await engine.castVote({
    voterId: 'traveling-guest-session-444',
    outletCode: 'BOSCBD',
    contestantId: scbdContestant.id,
  });
  assert.equal(scbdVote.success, false);
  assert.equal(scbdVote.code, 'DUPLICATE_VOTE');
});

test('VotingEngine: Simultaneous race-condition votes result in exactly one accepted vote', async () => {
  const engine = new VotingEngine({ inMemory: true });
  const contestant = engine.getContestants('BOKG')[0];
  const initialVotes = contestant.votes;
  const voterId = 'concurrent-voter-race-111';

  // Fire 5 simultaneous vote promises
  const promises = [
    engine.castVote({ voterId, outletCode: 'BOKG', contestantId: contestant.id }),
    engine.castVote({ voterId, outletCode: 'BOKG', contestantId: contestant.id }),
    engine.castVote({ voterId, outletCode: 'BOKG', contestantId: contestant.id }),
    engine.castVote({ voterId, outletCode: 'BOKG', contestantId: contestant.id }),
    engine.castVote({ voterId, outletCode: 'BOKG', contestantId: contestant.id }),
  ];

  const results = await Promise.all(promises);
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  assert.equal(successes.length, 1, 'Exactly one simultaneous vote should succeed');
  assert.equal(failures.length, 4, 'Remaining simultaneous votes must fail');
  assert.equal(contestant.votes, initialVotes + 1, 'Vote count must only increment by 1');
});

test('VotingEngine: Outlet isolation prevents voting for contestant from another outlet', async () => {
  const engine = new VotingEngine({ inMemory: true });
  const bohoContestant = engine.getContestants('BOHO')[0];

  // Attempt to vote for BOHO contestant under BOALL outlet URL
  const result = await engine.castVote({
    voterId: 'hacker-cross-outlet-777',
    outletCode: 'BOALL',
    contestantId: bohoContestant.id,
  });

  assert.equal(result.success, false);
  assert.equal(result.code, 'OUTLET_MISMATCH');
});

test('VotingEngine: Voting is blocked when outlet voting is closed', async () => {
  const engine = new VotingEngine({ inMemory: true });
  const contestant = engine.getContestants('BOALL')[0];

  // Close voting for BOALL
  engine.setOutletVotingStatus('BOALL', false, 'TEST_ADMIN');

  const result = await engine.castVote({
    voterId: 'late-guest-voter-888',
    outletCode: 'BOALL',
    contestantId: contestant.id,
  });

  assert.equal(result.success, false);
  assert.equal(result.code, 'VOTING_CLOSED');
});

test('VotingEngine: Leaderboard correctly sorts by vote count descending', async () => {
  const engine = new VotingEngine({ inMemory: true });
  const leaderboard = engine.getLeaderboard('BOALL');

  for (let i = 0; i < leaderboard.length - 1; i++) {
    assert.ok(
      leaderboard[i].votes >= leaderboard[i + 1].votes,
      `Rank ${i + 1} (${leaderboard[i].votes}) should have >= votes than Rank ${i + 2} (${leaderboard[i + 1].votes})`
    );
    assert.equal(leaderboard[i].rank, i + 1);
  }
});

test('VotingEngine: Newly added contestants with zero votes appear on leaderboard', () => {
  const engine = new VotingEngine({ inMemory: true });
  const newContestant = engine.addContestant({
    outletCode: 'BOALL',
    name: 'Zero Vote Test Contestant',
    costume: 'Shadow Stalker',
    imageUrl: 'https://example.com/test.jpg',
    hasConsented: true,
    actor: 'TEST',
  });

  assert.equal(newContestant.votes, 0);

  const leaderboard = engine.getLeaderboard('BOALL');
  const found = leaderboard.find((c) => c.id === newContestant.id);
  assert.ok(found, 'Contestant with 0 votes must appear on leaderboard');
  assert.equal(found?.votes, 0);
});

test('VotingEngine: Deterministic tie-break sorts equal votes by contestant number ascending', () => {
  const engine = new VotingEngine({ inMemory: true });
  const c1 = engine.addContestant({
    outletCode: 'BOALL',
    name: 'Contestant Early',
    costume: 'Theme A',
    imageUrl: 'https://example.com/a.jpg',
    hasConsented: true,
    actor: 'TEST',
  });
  const c2 = engine.addContestant({
    outletCode: 'BOALL',
    name: 'Contestant Later',
    costume: 'Theme B',
    imageUrl: 'https://example.com/b.jpg',
    hasConsented: true,
    actor: 'TEST',
  });

  // Both have 0 votes
  assert.equal(c1.votes, 0);
  assert.equal(c2.votes, 0);
  assert.ok(c1.number < c2.number, 'c1 should have smaller number than c2');

  const leaderboard = engine.getLeaderboard('BOALL');
  const idx1 = leaderboard.findIndex((c) => c.id === c1.id);
  const idx2 = leaderboard.findIndex((c) => c.id === c2.id);

  assert.ok(idx1 < idx2, 'Contestant with lower number should rank higher when votes are tied');
});

test('Staff Permissions: Role check enforces outlet scoping', async () => {
  const { verifyStaffAccess } = await import('../src/server/votingEngine.ts');

  // Super Admin can access any outlet
  const superCheck = verifyStaffAccess('heryanjojo@gmail.com', 'BOALL');
  assert.equal(superCheck.ok, true);
  assert.equal(superCheck.user?.role, 'SUPER_ADMIN');

  const superCheck2 = verifyStaffAccess('heryanjojo@gmail.com', 'BOHO');
  assert.equal(superCheck2.ok, true);

  // Outlet Admin for branch (e.g. PIK / SCBD) can access BOALL
  const pikAdminCheck = verifyStaffAccess('admin.pik@blackowl.id', 'BOALL');
  assert.equal(pikAdminCheck.ok, true);
  assert.equal(pikAdminCheck.user?.role, 'OUTLET_ADMIN');

  // Branch Outlet Admin is strictly blocked from accessing Head Office
  const pikAdminBlockedFromHo = verifyStaffAccess('admin.pik@blackowl.id', 'BOHO');
  assert.equal(pikAdminBlockedFromHo.ok, false);
  assert.equal(pikAdminBlockedFromHo.status, 403);

  // Head Office admin can access BOHO
  const hoAdminCheck = verifyStaffAccess('admin.ho@blackowl.id', 'BOHO');
  assert.equal(hoAdminCheck.ok, true);

  // Head Office admin is blocked from BOALL
  const hoAdminBlockedFromAll = verifyStaffAccess('admin.ho@blackowl.id', 'BOALL');
  assert.equal(hoAdminBlockedFromAll.ok, false);
  assert.equal(hoAdminBlockedFromAll.status, 403);

  // Unauthorized user is rejected
  const unknownUser = verifyStaffAccess('stranger@example.com', 'BOALL');
  assert.equal(unknownUser.ok, false);
  assert.equal(unknownUser.status, 403);
});

test('Staff Management: Add, verify and remove dynamic staff user', async () => {
  const { addStaffUser, removeStaffUser, verifyStaffAccess } = await import('../src/server/votingEngine.ts');

  // Add new outlet admin for BOHO
  const added = addStaffUser({
    email: 'new.admin@blackowl.id',
    name: 'New Admin Test',
    role: 'OUTLET_ADMIN',
    assignedOutlet: 'BOHO',
  });
  assert.equal(added.email, 'new.admin@blackowl.id');

  // Verify access for assigned outlet
  const allowedCheck = verifyStaffAccess('new.admin@blackowl.id', 'BOHO');
  assert.equal(allowedCheck.ok, true);

  // Verify forbidden for another outlet (BOALL)
  const forbiddenCheck = verifyStaffAccess('new.admin@blackowl.id', 'BOALL');
  assert.equal(forbiddenCheck.ok, false);
  assert.equal(forbiddenCheck.status, 403);

  // Cannot delete primary owner
  const cannotRemoveOwner = removeStaffUser('heryanjojo@gmail.com');
  assert.equal(cannotRemoveOwner, false);

  // Successfully remove dynamic staff
  const removed = removeStaffUser('new.admin@blackowl.id');
  assert.equal(removed, true);

  const afterRemoved = verifyStaffAccess('new.admin@blackowl.id', 'BOHO');
  assert.equal(afterRemoved.ok, false);
});

test('Staff Management: Support custom individual PIN and updating staff PIN', async () => {
  const { addStaffUser, updateStaffPin, removeStaffUser, STAFF_USERS } = await import('../src/server/votingEngine.ts');

  // Add Budi with custom PIN
  const budi = addStaffUser({
    email: 'budi@blackowl.id',
    name: 'Budi Santoso',
    role: 'OUTLET_ADMIN',
    assignedOutlet: 'BOPIK',
    pin: '8821',
  });

  assert.equal(budi.pin, '8821');
  assert.equal(STAFF_USERS['budi@blackowl.id'].pin, '8821');

  // Update Budi's PIN
  const updatedBudi = updateStaffPin('budi@blackowl.id', 'budi999');
  assert.equal(updatedBudi?.pin, 'budi999');
  assert.equal(STAFF_USERS['budi@blackowl.id'].pin, 'budi999');

  // Clean up
  removeStaffUser('budi@blackowl.id');
});

test('Outlet Management: Bulk delete contestants and reset single outlet to 0', async () => {
  const { VotingEngine } = await import('../src/server/votingEngine.ts');
  const engine = new VotingEngine({ inMemory: true });

  const c1 = engine.addContestant({
    outletCode: 'BOKG',
    name: 'Bulk Test 1',
    costume: 'Costume 1',
    imageUrl: 'https://example.com/1.jpg',
    hasConsented: true,
    actor: 'TEST',
  });

  const c2 = engine.addContestant({
    outletCode: 'BOKG',
    name: 'Bulk Test 2',
    costume: 'Costume 2',
    imageUrl: 'https://example.com/2.jpg',
    hasConsented: true,
    actor: 'TEST',
  });

  // Cast vote
  await engine.castVote({
    voterId: 'voter_bulk_test_12345',
    outletCode: 'BOKG',
    contestantId: c1.id,
  });

  const outletBefore = engine.getOutlet('BOKG');
  assert.ok((outletBefore?.totalVotes || 0) > 0);

  // Bulk delete c1
  const bulkRes = engine.deleteMultipleContestants([c1.id], 'BOKG', 'TEST');
  assert.equal(bulkRes.deletedCount, 1);
  assert.equal(engine.getContestantById(c1.id), undefined);
  assert.ok(engine.getContestantById(c2.id) !== undefined);

  // Reset BOKG outlet to 0
  const resetRes = engine.resetOutlet('BOKG', 'TEST');
  assert.equal(resetRes.success, true);
  assert.equal(resetRes.outlet.totalVotes, 0);
  assert.equal(engine.getContestants('BOKG', true).length, 0);
});

test('Privacy & Instagram: Phone number is stored for admin but redacted for public voting', async () => {
  const engine = new VotingEngine({ inMemory: true });
  const newContestant = engine.addContestant({
    outletCode: 'BOPIK',
    name: 'Natasha Val',
    costume: 'natashaval_queen', // user entered without @
    instagram: 'natashaval_queen',
    phoneNumber: '081298765432',
    imageUrl: 'https://example.com/natasha.jpg',
    hasConsented: true,
    actor: 'Heryan Jojo',
  });

  // Verify Instagram handle was normalized with leading @
  assert.equal(newContestant.instagram, '@natashaval_queen');
  assert.equal(newContestant.costume, '@natashaval_queen');
  assert.equal(newContestant.phoneNumber, '081298765432');

  // Admin access (includePrivate = true): phone number must be present
  const adminList = engine.getContestants('BOPIK', true, true);
  const foundAdmin = adminList.find((c) => c.id === newContestant.id);
  assert.equal(foundAdmin?.phoneNumber, '081298765432');

  // Public guest access (includePrivate = false): phone number must be stripped
  const publicList = engine.getContestants('BOPIK', false, false);
  const foundPublic = publicList.find((c) => c.id === newContestant.id);
  assert.equal(foundPublic?.phoneNumber, undefined);

  // Public leaderboard access: phone number must be stripped
  const leaderboard = engine.getLeaderboard('BOPIK');
  const foundLeaderboard = leaderboard.find((c) => c.id === newContestant.id);
  assert.equal(foundLeaderboard?.phoneNumber, undefined);
});

test('Head Office: BOHO outlet is registered and Head Office staff accounts are authorized', async () => {
  const { verifyStaffAccess } = await import('../src/server/votingEngine.ts');
  const engine = new VotingEngine({ inMemory: true });

  // 1. Verify BOHO is in the outlet list
  const outlets = engine.getOutlets();
  const boho = outlets.find((o) => o.code === 'BOHO');
  assert.ok(boho, 'BOHO outlet must exist in outlets list');
  assert.equal(boho?.name, 'Black Owl Head Office');
  assert.equal(boho?.shortName, 'Head Office');

  // 2. Verify Head Office Outlet Admin access
  const hoAdminAccess = verifyStaffAccess('admin.ho@blackowl.id', 'BOHO');
  assert.equal(hoAdminAccess.ok, true);
  assert.equal(hoAdminAccess.user?.role, 'OUTLET_ADMIN');
  assert.equal(hoAdminAccess.user?.assignedOutlet, 'BOHO');

  // Head Office outlet admin cannot modify other outlets
  const hoAdminCrossOutlet = verifyStaffAccess('admin.ho@blackowl.id', 'BOPIK');
  assert.equal(hoAdminCrossOutlet.ok, false);
  assert.equal(hoAdminCrossOutlet.status, 403);

  // 3. Verify Head Office Super Admin (HQ) access
  const hqSuperAdminAccess = verifyStaffAccess('headoffice@blackowl.id', 'BOHO');
  assert.equal(hqSuperAdminAccess.ok, true);
  assert.equal(hqSuperAdminAccess.user?.role, 'SUPER_ADMIN');

  // HQ Super Admin can access all other outlets as well
  const hqSuperAdminCrossAccess = verifyStaffAccess('headoffice@blackowl.id', 'BOSCBD');
  assert.equal(hqSuperAdminCrossAccess.ok, true);
});

test('Persistence & Reboot: Uploaded contestants are permanently retained across server restarts', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');

  const testDbDir = path.join(os.tmpdir(), `bo_test_db_${Date.now()}`);
  fs.mkdirSync(testDbDir, { recursive: true });
  const testDbFile = path.join(testDbDir, 'database.json');

  try {
    // 1. Initialize first engine instance with file persistence
    const engine1 = new VotingEngine({ dbPath: testDbFile, clean: true });
    assert.equal(engine1.getContestants('BOPIK', true).length, 0, 'Clean database starts with 0 contestants');

    // 2. Add an uploaded contestant
    const newContestant = engine1.addContestant({
      outletCode: 'BOPIK',
      name: 'Lady Dracula Real Contestant',
      costume: '@ladydracula',
      instagram: '@ladydracula',
      phoneNumber: '0812-9999-8888',
      description: 'Handmade velvet gown',
      imageUrl: '/uploads/ladydracula.jpg',
      hasConsented: true,
      actor: 'Admin Tester',
    });

    assert.equal(engine1.getContestants('BOPIK', true).length, 1);
    assert.equal(fs.existsSync(testDbFile), true, 'Main database.json must be written');
    assert.equal(fs.existsSync(`${testDbFile}.bak`), true, 'Backup database.json.bak must be written');

    // 3. Simulate server shutdown and reboot: create completely new engine instance reading same dbPath
    const engine2 = new VotingEngine({ dbPath: testDbFile, clean: true });
    const loadedContestants = engine2.getContestants('BOPIK', true);

    assert.equal(loadedContestants.length, 1, 'Contestant must survive server restart intact');
    assert.equal(loadedContestants[0].name, 'Lady Dracula Real Contestant');
    assert.equal(loadedContestants[0].costume, '@ladydracula');
    assert.equal(loadedContestants[0].phoneNumber, '0812-9999-8888');
    assert.equal(loadedContestants[0].imageUrl, '/uploads/ladydracula.jpg');

    // 4. Simulate catastrophic main file corruption: delete testDbFile, engine3 should recover from testDbFile.bak
    fs.unlinkSync(testDbFile);
    assert.equal(fs.existsSync(testDbFile), false);
    assert.equal(fs.existsSync(`${testDbFile}.bak`), true);

    const engine3 = new VotingEngine({ dbPath: testDbFile });
    const recoveredContestants = engine3.getContestants('BOPIK', true);
    assert.equal(recoveredContestants.length, 1, 'Contestant must be recovered from .bak if main file was lost');
    assert.equal(recoveredContestants[0].name, 'Lady Dracula Real Contestant');
  } finally {
    try {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    } catch {}
  }
});

test('Dual Vote Rule: 1 HP can cast 1 vote in Head Office AND 1 vote in Black Owl All Outlet', async () => {
  const engine = new VotingEngine({ inMemory: true });
  const bohoContestant = engine.getContestants('BOHO')[0];
  const boallContestant = engine.getContestants('BOALL')[0];
  const voterPhoneId = 'hp_samsung_galaxy_user_8899';

  // 1. Initial status: voter has not voted in either category
  const initialStatus = engine.getVoterStatus(voterPhoneId);
  assert.equal(initialStatus.votesByOutlet.BOHO.hasVoted, false);
  assert.equal(initialStatus.votesByOutlet.BOALL.hasVoted, false);

  // 2. Cast vote in Head Office
  const bohoVoteRes = await engine.castVote({
    voterId: voterPhoneId,
    outletCode: 'BOHO',
    contestantId: bohoContestant.id,
  });
  assert.equal(bohoVoteRes.success, true);
  assert.equal(bohoVoteRes.contestant?.id, bohoContestant.id);

  // 3. Status after Head Office vote: BOHO voted = true, BOALL voted = false
  const statusAfterHo = engine.getVoterStatus(voterPhoneId);
  assert.equal(statusAfterHo.votesByOutlet.BOHO.hasVoted, true);
  assert.equal(statusAfterHo.votesByOutlet.BOALL.hasVoted, false);
  assert.equal(statusAfterHo.votesByOutlet.BOHO.contestant?.id, bohoContestant.id);

  // 4. Cannot vote again in Head Office
  const bohoRepeatRes = await engine.castVote({
    voterId: voterPhoneId,
    outletCode: 'BOHO',
    contestantId: bohoContestant.id,
  });
  assert.equal(bohoRepeatRes.success, false);
  assert.equal(bohoRepeatRes.code, 'DUPLICATE_VOTE');

  // 5. CAN vote in Black Owl All Outlet with the SAME phone voter ID
  const boallVoteRes = await engine.castVote({
    voterId: voterPhoneId,
    outletCode: 'BOALL',
    contestantId: boallContestant.id,
  });
  assert.equal(boallVoteRes.success, true);
  assert.equal(boallVoteRes.contestant?.id, boallContestant.id);

  // 6. Status after both votes: both are true
  const statusAfterBoth = engine.getVoterStatus(voterPhoneId);
  assert.equal(statusAfterBoth.votesByOutlet.BOHO.hasVoted, true);
  assert.equal(statusAfterBoth.votesByOutlet.BOALL.hasVoted, true);
  assert.equal(statusAfterBoth.votesByOutlet.BOHO.contestant?.id, bohoContestant.id);
  assert.equal(statusAfterBoth.votesByOutlet.BOALL.contestant?.id, boallContestant.id);

  // 7. Cannot vote again in Black Owl All Outlet either
  const boallRepeatRes = await engine.castVote({
    voterId: voterPhoneId,
    outletCode: 'BOALL',
    contestantId: boallContestant.id,
  });
  assert.equal(boallRepeatRes.success, false);
  assert.equal(boallRepeatRes.code, 'DUPLICATE_VOTE');
});

test('Dual Vote Rule: Reverse order — voting in All Outlet first, then Head Office also succeeds', async () => {
  const engine = new VotingEngine({ inMemory: true });
  const bohoContestant = engine.getContestants('BOHO')[1];
  const boallContestant = engine.getContestants('BOALL')[1];
  const voterPhoneId = 'hp_iphone_15_pro_user_7722';

  // 1. Vote in All Outlet first
  const boallRes = await engine.castVote({
    voterId: voterPhoneId,
    outletCode: 'BOALL',
    contestantId: boallContestant.id,
  });
  assert.equal(boallRes.success, true);

  // 2. Vote in Head Office second
  const bohoRes = await engine.castVote({
    voterId: voterPhoneId,
    outletCode: 'BOHO',
    contestantId: bohoContestant.id,
  });
  assert.equal(bohoRes.success, true);

  // 3. Both are locked
  const status = engine.getVoterStatus(voterPhoneId);
  assert.equal(status.votesByOutlet.BOHO.hasVoted, true);
  assert.equal(status.votesByOutlet.BOALL.hasVoted, true);
});


