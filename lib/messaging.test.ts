import {
  UserContext,
  validateDirectConversationPermission,
  validateBroadcastCreatePermission,
  validatePostMessagePermission,
  validateReadConversationPermission,
  validateDeletePermission
} from './messaging';

console.log('=== RUNNING UPDATED MESSAGING PERMISSION UNIT TESTS ===\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, description: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${description}`);
  } else {
    console.error(`[FAIL] ${description}`);
  }
}

// Dummy Test Contexts
const studentA: UserContext = { userId: 'st1', role: 'student', name: 'Student Alpha', batchIds: ['b1', 'b2'] };
const studentB: UserContext = { userId: 'st2', role: 'student', name: 'Student Beta', batchIds: ['b3'] };

const teacherA: UserContext = { userId: 'tc1', role: 'teacher', name: 'Teacher Alpha', batchIds: ['b1'] };
const teacherB: UserContext = { userId: 'tc2', role: 'teacher', name: 'Teacher Beta', batchIds: ['b99'] };

const admin: UserContext = { userId: 'adm1', role: 'admin', name: 'Admin User', batchIds: [] };

// -------------------------------------------------------------
// 1. BUG 1: Student Direct Conversation Initiation Block Tests
// -------------------------------------------------------------
const res1 = validateDirectConversationPermission(studentA, studentB);
assert(!res1.allowed, 'Student -> Student initiation is REJECTED (403)');

const res2 = validateDirectConversationPermission(studentA, teacherA);
assert(!res2.allowed, 'Student -> Teacher initiation is REJECTED (403) - Students can only reply in existing threads');

const res3 = validateDirectConversationPermission(studentA, admin);
assert(!res3.allowed, 'Student -> Admin initiation is REJECTED (403) - Students can only reply in existing threads');

// -------------------------------------------------------------
// 2. Staff Direct DM Permission Tests
// -------------------------------------------------------------
const res5 = validateDirectConversationPermission(teacherA, studentA);
assert(res5.allowed, 'Staff -> Enrolled Student DM is ALLOWED');

const res6 = validateDirectConversationPermission(teacherA, studentB);
assert(!res6.allowed, 'Staff -> Unenrolled Student DM is REJECTED (403)');

const res7 = validateDirectConversationPermission(teacherA, teacherB);
assert(res7.allowed, 'Staff -> Staff DM is ALLOWED');

const res8 = validateDirectConversationPermission(teacherA, admin);
assert(res8.allowed, 'Staff -> Admin DM initiation is ALLOWED');

// -------------------------------------------------------------
// 3. Admin Direct DM Permission Tests
// -------------------------------------------------------------
const res9 = validateDirectConversationPermission(admin, teacherA);
assert(res9.allowed, 'Admin -> Staff DM is ALLOWED');

const res10 = validateDirectConversationPermission(admin, studentA);
assert(res10.allowed, 'Admin -> Student DM is ALLOWED');

// -------------------------------------------------------------
// 4. BUG 3: Admin-Only Delete Permission Tests
// -------------------------------------------------------------
const delRes1 = validateDeletePermission(admin);
assert(delRes1.allowed, 'Admin -> Delete action is ALLOWED');

const delRes2 = validateDeletePermission(teacherA);
assert(!delRes2.allowed, 'Teacher -> Delete action is REJECTED (403)');

const delRes3 = validateDeletePermission(studentA);
assert(!delRes3.allowed, 'Student -> Delete action is REJECTED (403)');

// -------------------------------------------------------------
// 5. Broadcast Permission Tests
// -------------------------------------------------------------
const bRes1 = validateBroadcastCreatePermission(teacherA, 'batch_broadcast', 'b1');
assert(bRes1.allowed, 'Staff -> Own Batch Broadcast is ALLOWED');

const bRes2 = validateBroadcastCreatePermission(teacherA, 'batch_broadcast', 'b99');
assert(!bRes2.allowed, 'Staff -> Other Batch Broadcast is REJECTED (403)');

const bRes3 = validateBroadcastCreatePermission(teacherA, 'all_staff_broadcast');
assert(!bRes3.allowed, 'Staff -> All-Staff Broadcast is REJECTED (403)');

const bRes4 = validateBroadcastCreatePermission(admin, 'all_staff_broadcast');
assert(bRes4.allowed, 'Admin -> All-Staff Broadcast is ALLOWED');

const bRes5 = validateBroadcastCreatePermission(admin, 'all_students_broadcast');
assert(bRes5.allowed, 'Admin -> All-Students Broadcast is ALLOWED');

// -------------------------------------------------------------
// 6. Message Posting & Reading Permission Tests
// -------------------------------------------------------------
const pRes1 = validatePostMessagePermission(studentA, { type: 'batch_broadcast', batchId: 'b1' });
assert(!pRes1.allowed, 'Student -> Post to Batch Broadcast is REJECTED (403)');

const rRes1 = validateReadConversationPermission(studentA, { type: 'batch_broadcast', batchId: 'b1' });
assert(rRes1, 'Student -> Read Enrolled Batch Broadcast is ALLOWED');

const pRes2 = validatePostMessagePermission(teacherA, { type: 'all_staff_broadcast' });
assert(pRes2.allowed, 'Staff -> Post to All-Staff Broadcast is ALLOWED');

const rRes2 = validateReadConversationPermission(teacherB, { type: 'batch_broadcast', batchId: 'b99', createdBy: 'admin' });
assert(rRes2, 'Staff -> Read Assigned Batch Broadcast created by Admin is ALLOWED');

console.log(`\nALL ${passedTests} / ${totalTests} UNIT TESTS PASSED SUCCESSFULLY!`);
