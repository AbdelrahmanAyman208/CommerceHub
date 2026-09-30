const bcrypt = require('bcrypt');

describe('Authentication & Student ID Validation', () => {
  test('should correctly hash and verify password with bcrypt', async () => {
    const raw = 'student123';
    const hash = await bcrypt.hash(raw, 10);

    expect(hash).not.toBe(raw);
    const valid = await bcrypt.compare(raw, hash);
    expect(valid).toBe(true);

    const invalid = await bcrypt.compare('wrongPassword', hash);
    expect(invalid).toBe(false);
  });

  test('should enforce 8-digit numeric student ID formatting', () => {
    const formatStudentId = (seqVal) => seqVal.toString().padStart(8, '0');

    const id1 = formatStudentId(10000001);
    const id2 = formatStudentId(10000050);

    expect(id1).toBe('10000001');
    expect(id1).toHaveLength(8);
    expect(/^\d{8}$/.test(id1)).toBe(true);

    expect(id2).toBe('10000050');
    expect(id2).toHaveLength(8);
    expect(/^\d{8}$/.test(id2)).toBe(true);
  });

  test('should enforce role boundaries: assistants cannot modify grades', () => {
    function canModifyStudentGrades(userRole) {
      // Only the doctor (super_admin) can modify grades
      return userRole === 'super_admin';
    }

    expect(canModifyStudentGrades('super_admin')).toBe(true);
    expect(canModifyStudentGrades('admin')).toBe(false); // Assistant
    expect(canModifyStudentGrades('student')).toBe(false);
  });
});
