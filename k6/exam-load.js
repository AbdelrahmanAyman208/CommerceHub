import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },    // Ramp up to 50 VUs
    { duration: '1m', target: 200 },    // Ramp up to 200 VUs
    { duration: '2m', target: 500 },    // Peak exam submission spike: 500 VUs
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],    // Less than 1% failure rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 1. Health check / Ping
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'services healthy': (r) => r.json('status') === 'healthy',
  });

  sleep(1);

  // 2. Student Login
  const loginPayload = JSON.stringify({
    identifier: '10000001',
    password: 'student123',
  });

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const loginSuccess = check(loginRes, {
    'login status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });

  if (loginRes.status === 200) {
    const token = loginRes.json('accessToken');
    const authHeaders = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };

    // 3. Fetch Exams
    const examsRes = http.get(`${BASE_URL}/api/exams`, authHeaders);
    check(examsRes, {
      'get exams 200': (r) => r.status === 200,
    });

    const exams = examsRes.json('exams');
    if (exams && exams.length > 0) {
      const examId = exams[0].id;

      // 4. Autosave answers simulation
      const autosavePayload = JSON.stringify({
        answers: [
          { question_id: '00000000-0000-0000-0000-000000000001', selected_key: 'A' },
        ],
      });

      const saveRes = http.put(`${BASE_URL}/api/exams/${examId}/autosave`, autosavePayload, authHeaders);
      check(saveRes, {
        'autosave handled': (r) => r.status === 200 || r.status === 400,
      });
    }
  }

  sleep(2);
}
